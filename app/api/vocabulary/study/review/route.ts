import { NextRequest, NextResponse } from "next/server";

import { createServerClientRSC } from "../../../../lib/supabase/server";
import {
  DEFAULT_STUDY_PREFERENCES,
  parseStudyPreferences,
  scheduleStudyRating,
  type StudyCardSnapshot,
  type StudyRating,
} from "../../../../lib/vocabulary/studyScheduler";

const VALID_RATINGS = new Set<StudyRating>([
  "again",
  "hard",
  "good",
  "easy",
]);

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

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const studyCardId = String(body.studyCardId ?? "").trim();
  const rating = String(body.rating ?? "") as StudyRating;
  const expectedVersion = Number(body.expectedVersion);
  const responseTimeMs = Math.max(
    0,
    Math.min(3_600_000, Math.floor(Number(body.responseTimeMs) || 0)),
  );

  if (!studyCardId || !VALID_RATINGS.has(rating)) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    return NextResponse.json({ error: "Invalid study card version" }, { status: 400 });
  }

  const supabase = await createServerClientRSC();
  const userId = await getMember(supabase);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: card, error: cardError } = await supabase
    .from("vocabulary_study_cards")
    .select("id,user_id,deck_id,algorithm,state,scheduler_state,due_at,last_reviewed_at,version")
    .eq("id", studyCardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (cardError || !card) {
    return NextResponse.json({ error: "Study card not found" }, { status: 404 });
  }

  if (Number(card.version) !== expectedVersion) {
    return NextResponse.json(
      { error: "Study card changed; refresh required" },
      { status: 409 },
    );
  }

  const { data: preferenceRow, error: preferenceError } = await supabase
    .from("vocabulary_deck_study_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("deck_id", card.deck_id)
    .maybeSingle();

  if (preferenceError) {
    return NextResponse.json({ error: preferenceError.message }, { status: 500 });
  }

  const preferences = preferenceRow
    ? parseStudyPreferences(preferenceRow)
    : DEFAULT_STUDY_PREFERENCES;

  if (card.algorithm !== preferences.algorithm) {
    return NextResponse.json(
      { error: "Study algorithm changed; reload this deck" },
      { status: 409 },
    );
  }

  const now = new Date();
  const snapshot: StudyCardSnapshot = {
    state: card.state,
    schedulerState:
      card.scheduler_state && typeof card.scheduler_state === "object"
        ? (card.scheduler_state as Record<string, unknown>)
        : {},
    dueAt: String(card.due_at),
    lastReviewedAt: card.last_reviewed_at ? String(card.last_reviewed_at) : null,
  };
  const outcome = scheduleStudyRating(snapshot, rating, preferences, now);

  const { data: result, error: recordError } = await supabase.rpc(
    "record_vocabulary_review",
    {
      p_study_card_id: studyCardId,
      p_expected_version: expectedVersion,
      p_rating: rating,
      p_reviewed_at: now.toISOString(),
      p_response_time_ms: responseTimeMs,
      p_next_due_at: outcome.dueAt,
      p_next_state_label: outcome.state,
      p_next_scheduler_state: outcome.schedulerState,
      p_scheduled_interval_seconds: outcome.intervalSeconds,
    },
  );

  if (recordError) {
    const status = recordError.code === "40001" ? 409 : 500;
    return NextResponse.json({ error: recordError.message }, { status });
  }

  return NextResponse.json({
    result,
    next: {
      state: outcome.state,
      dueAt: outcome.dueAt,
      intervalSeconds: outcome.intervalSeconds,
      stability: outcome.stability ?? null,
      difficulty: outcome.difficulty ?? null,
      retrievability: outcome.retrievability ?? null,
    },
  });
}
