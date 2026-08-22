import { NextRequest, NextResponse } from "next/server";

import { createServerClientRSC } from "../../../../lib/supabase/server";
import {
  DEFAULT_STUDY_PREFERENCES,
  parseStudyPreferences,
  previewStudySchedule,
  schedulerStateForNewCard,
  type StudyCardSnapshot,
} from "../../../../lib/vocabulary/studyScheduler";

const RATINGS = ["again", "hard", "good", "easy"] as const;
const MAX_SESSION_CARDS = 500;
const FREQUENCY_WEIGHTS = { 1: 13, 2: 8, 3: 5 } as const;

type DeckItemRow = {
  id: string;
  entry_id: string;
  meaning_id: string | null;
  position: number | null;
  entry: unknown;
  meaning: unknown;
};

type StudyCardRow = {
  id: string;
  entry_id: string;
  meaning_id: string | null;
  algorithm: string;
  state: "new" | "learning" | "review" | "relearning";
  scheduler_state: Record<string, unknown> | null;
  due_at: string;
  last_reviewed_at: string | null;
  review_count: number;
  lapse_count: number;
  version: number;
};

function asObject<T extends Record<string, unknown>>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value && typeof value === "object" ? (value as T) : null;
}

function cardKey(entryId: string, meaningId: string | null) {
  return `${entryId}:${meaningId ?? ""}`;
}

function shuffle<T>(input: T[]) {
  const copy = [...input];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function selectLeitnerFrequency(
  cards: StudyCardRow[],
  sessionSize: number,
  nowIso: string,
) {
  const byBox: Record<1 | 2 | 3, StudyCardRow[]> = { 1: [], 2: [], 3: [] };
  cards.forEach((card) => {
    const rawBox = Number(card.scheduler_state?.box ?? 1);
    const box = Math.max(1, Math.min(3, Math.round(rawBox))) as 1 | 2 | 3;
    byBox[box].push(card);
  });

  const totalWeight = 26;
  const quotas: Record<1 | 2 | 3, number> = {
    1: Math.floor((sessionSize * FREQUENCY_WEIGHTS[1]) / totalWeight),
    2: Math.floor((sessionSize * FREQUENCY_WEIGHTS[2]) / totalWeight),
    3: Math.floor((sessionSize * FREQUENCY_WEIGHTS[3]) / totalWeight),
  };
  let allocated = quotas[1] + quotas[2] + quotas[3];
  for (const box of [1, 2, 3] as const) {
    if (allocated >= sessionSize) break;
    quotas[box] += 1;
    allocated += 1;
  }

  const selected: StudyCardRow[] = [];
  for (const box of [1, 2, 3] as const) {
    const ordered = [...byBox[box]].sort((a, b) => a.due_at.localeCompare(b.due_at));
    const due = ordered.filter((card) => card.due_at <= nowIso);
    const upcoming = ordered.filter((card) => card.due_at > nowIso);
    const dueTake = due.slice(0, quotas[box]);
    selected.push(...shuffle(dueTake));
    const remaining = quotas[box] - dueTake.length;
    if (remaining > 0) selected.push(...shuffle(upcoming).slice(0, remaining));
  }

  if (selected.length < sessionSize) {
    const chosenIds = new Set(selected.map((card) => card.id));
    const remainder = cards
      .filter((card) => !chosenIds.has(card.id))
      .sort((a, b) => a.due_at.localeCompare(b.due_at));
    selected.push(...remainder.slice(0, sessionSize - selected.length));
  }

  return selected.slice(0, sessionSize);
}

async function getMember(supabase: Awaited<ReturnType<typeof createServerClientRSC>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: member } = await supabase
    .from("users")
    .select("uid")
    .eq("auth_id", user.id)
    .maybeSingle();
  return member?.uid ? String(member.uid) : null;
}

export async function GET(request: NextRequest) {
  const deckId = request.nextUrl.searchParams.get("deckId")?.trim();
  if (!deckId) {
    return NextResponse.json({ error: "deckId is required" }, { status: 400 });
  }

  const supabase = await createServerClientRSC();
  const userId = await getMember(supabase);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: deck, error: deckError } = await supabase
    .from("vocabulary_decks")
    .select("id,name,description,icon,theme,visibility,is_official,item_count")
    .eq("id", deckId)
    .maybeSingle();

  if (deckError || !deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const { data: preferenceRow, error: preferenceError } = await supabase
    .from("vocabulary_deck_study_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .maybeSingle();

  if (preferenceError) {
    return NextResponse.json({ error: preferenceError.message }, { status: 500 });
  }

  const preferences = preferenceRow
    ? parseStudyPreferences(preferenceRow)
    : DEFAULT_STUDY_PREFERENCES;

  const { data: rawItems, error: itemError } = await supabase
    .from("vocabulary_deck_items")
    .select(`
      id,entry_id,meaning_id,position,
      entry:dictionary_entries!vocabulary_deck_items_entry_id_fkey(
        term,entry_type,normalized_term
      ),
      meaning:dictionary_meanings!vocabulary_deck_items_meaning_id_fkey(
        id,entry_id,grammar_type,definition_en,definition_ko,
        pronunciation_ipa,usage_labels,meaning_order
      )
    `)
    .eq("deck_id", deckId)
    .order("position", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: true });

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  const deckItems = (rawItems ?? []) as unknown as DeckItemRow[];
  if (deckItems.length === 0) {
    return NextResponse.json({
      deck,
      preferences,
      counts: { new: 0, learning: 0, review: 0, due: 0, total: 0 },
      cards: [],
    });
  }

  const { data: existingRows, error: studyError } = await supabase
    .from("vocabulary_study_cards")
    .select("id,entry_id,meaning_id,algorithm,state,scheduler_state,due_at,last_reviewed_at,review_count,lapse_count,version")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("algorithm", preferences.algorithm);

  if (studyError) {
    return NextResponse.json({ error: studyError.message }, { status: 500 });
  }

  const existing = (existingRows ?? []) as StudyCardRow[];
  const byKey = new Map(
    existing.map((card) => [cardKey(card.entry_id, card.meaning_id), card]),
  );
  const now = new Date();

  const missing = deckItems.filter(
    (item) => !byKey.has(cardKey(item.entry_id, item.meaning_id)),
  );

  if (missing.length > 0) {
    for (const item of missing) {
      const { error: insertError } = await supabase.from("vocabulary_study_cards").insert({
        user_id: userId,
        deck_id: deckId,
        entry_id: item.entry_id,
        meaning_id: item.meaning_id,
        algorithm: preferences.algorithm,
        state: "new",
        scheduler_state: schedulerStateForNewCard(preferences.algorithm, now),
        due_at: now.toISOString(),
      });
      // A concurrent queue request may have inserted the same scheduler row.
      if (insertError && insertError.code !== "23505") {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  }

  const { data: allRows, error: reloadError } = await supabase
    .from("vocabulary_study_cards")
    .select("id,entry_id,meaning_id,algorithm,state,scheduler_state,due_at,last_reviewed_at,review_count,lapse_count,version")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .eq("algorithm", preferences.algorithm);

  if (reloadError) {
    return NextResponse.json({ error: reloadError.message }, { status: 500 });
  }

  const itemKeys = new Set(
    deckItems.map((item) => cardKey(item.entry_id, item.meaning_id)),
  );
  const cards = ((allRows ?? []) as StudyCardRow[]).filter((card) =>
    itemKeys.has(cardKey(card.entry_id, card.meaning_id)),
  );
  const nowIso = now.toISOString();
  const newCards = cards
    .filter((card) => card.state === "new")
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const learningDue = cards
    .filter(
      (card) =>
        (card.state === "learning" || card.state === "relearning") &&
        card.due_at <= nowIso,
    )
    .sort((a, b) => a.due_at.localeCompare(b.due_at));
  const reviewDue = cards
    .filter((card) => card.state === "review" && card.due_at <= nowIso)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  const reviewLimit = Math.min(preferences.dailyReviewLimit, MAX_SESSION_CARDS);
  const newLimit = Math.min(
    preferences.dailyNewLimit,
    Math.max(0, MAX_SESSION_CARDS - reviewLimit),
  );

  let queue: StudyCardRow[];
  if (
    preferences.algorithm === "leitner" &&
    preferences.queueStrategy === "frequency"
  ) {
    const sessionSize = Math.min(
      MAX_SESSION_CARDS,
      Math.max(1, preferences.dailyReviewLimit + preferences.dailyNewLimit),
      cards.length,
    );
    queue = selectLeitnerFrequency(cards, sessionSize, nowIso);
  } else {
    const reviewQueue = [...learningDue, ...reviewDue].slice(0, reviewLimit);
    queue = [...reviewQueue, ...newCards.slice(0, newLimit)];
  }

  const itemMap = new Map(
    deckItems.map((item) => [cardKey(item.entry_id, item.meaning_id), item]),
  );

  const payloadCards = queue.flatMap((card) => {
    const item = itemMap.get(cardKey(card.entry_id, card.meaning_id));
    if (!item) return [];
    const entry = asObject<Record<string, unknown>>(item.entry);
    const meaning = asObject<Record<string, unknown>>(item.meaning);
    if (!entry?.term) return [];

    const snapshot: StudyCardSnapshot = {
      state: card.state,
      schedulerState: card.scheduler_state ?? {},
      dueAt: card.due_at,
      lastReviewedAt: card.last_reviewed_at,
    };
    const preview = previewStudySchedule(snapshot, preferences, now);
    const previews = Object.fromEntries(
      RATINGS.map((rating) => [
        rating,
        {
          dueAt: preview[rating].dueAt,
          intervalSeconds: preview[rating].intervalSeconds,
        },
      ]),
    );

    return [
      {
        id: card.id,
        version: card.version,
        entryId: card.entry_id,
        meaningId: card.meaning_id,
        term: String(entry.term),
        entryType: entry.entry_type === "expression" ? "expression" : "word",
        grammarType:
          typeof meaning?.grammar_type === "string" ? meaning.grammar_type : null,
        pronunciationIpa:
          typeof meaning?.pronunciation_ipa === "string"
            ? meaning.pronunciation_ipa
            : null,
        definitionEn:
          typeof meaning?.definition_en === "string" ? meaning.definition_en : "",
        definitionKo:
          typeof meaning?.definition_ko === "string" ? meaning.definition_ko : null,
        state: card.state,
        dueAt: card.due_at,
        reviewCount: card.review_count,
        lapseCount: card.lapse_count,
        previews,
      },
    ];
  });

  return NextResponse.json({
    deck,
    preferences,
    counts: {
      new: newCards.length,
      learning: learningDue.length,
      review: reviewDue.length,
      due: learningDue.length + reviewDue.length,
      total: cards.length,
    },
    cards: payloadCards,
  });
}
