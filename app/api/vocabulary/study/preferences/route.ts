import { NextRequest, NextResponse } from "next/server";

import { createServerClientRSC } from "../../../../lib/supabase/server";
import {
  DEFAULT_STUDY_PREFERENCES,
  parseStudyPreferences,
  type QueueStrategy,
  type StudyAlgorithm,
} from "../../../../lib/vocabulary/studyScheduler";

const ALGORITHMS = new Set<StudyAlgorithm>(["fsrs", "anki_legacy", "leitner"]);
const QUEUES = new Set<QueueStrategy>(["due_first", "frequency"]);

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

  const { data, error } = await supabase
    .from("vocabulary_deck_study_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("deck_id", deckId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    preferences: data ? parseStudyPreferences(data) : DEFAULT_STUDY_PREFERENCES,
  });
}

export async function PUT(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deckId = String(body.deckId ?? "").trim();
  const algorithm = String(body.algorithm ?? "") as StudyAlgorithm;
  const requestedQueue = String(body.queueStrategy ?? "") as QueueStrategy;
  if (!deckId || !ALGORITHMS.has(algorithm)) {
    return NextResponse.json({ error: "Invalid study preferences" }, { status: 400 });
  }

  const queueStrategy = QUEUES.has(requestedQueue) ? requestedQueue : "due_first";
  const desiredRetention = clamp(Number(body.desiredRetention) || 0.9, 0.7, 0.99);
  const dailyNewLimit = clamp(Math.floor(Number(body.dailyNewLimit) || 0), 0, 500);
  const dailyReviewLimit = clamp(
    Math.floor(Number(body.dailyReviewLimit) || 200),
    1,
    2000,
  );
  const maximumIntervalDays = clamp(
    Math.floor(Number(body.maximumIntervalDays) || 36500),
    1,
    36500,
  );
  const enableFuzz = body.enableFuzz !== false;
  const learningSteps = Array.isArray(body.learningSteps)
    ? body.learningSteps.map(String).filter(Boolean).slice(0, 8)
    : ["1m", "10m"];
  const relearningSteps = Array.isArray(body.relearningSteps)
    ? body.relearningSteps.map(String).filter(Boolean).slice(0, 8)
    : ["10m"];

  const supabase = await createServerClientRSC();
  const userId = await getMember(supabase);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: deck } = await supabase
    .from("vocabulary_decks")
    .select("id")
    .eq("id", deckId)
    .maybeSingle();
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("vocabulary_deck_study_preferences")
    .upsert(
      {
        user_id: userId,
        deck_id: deckId,
        scheduler_algorithm: algorithm,
        queue_strategy: queueStrategy,
        desired_retention: desiredRetention,
        daily_new_limit: dailyNewLimit,
        daily_review_limit: dailyReviewLimit,
        maximum_interval_days: maximumIntervalDays,
        enable_fuzz: enableFuzz,
        learning_steps: learningSteps.length > 0 ? learningSteps : ["1m", "10m"],
        relearning_steps:
          relearningSteps.length > 0 ? relearningSteps : ["10m"],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,deck_id" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences: parseStudyPreferences(data) });
}
