import {
  Rating as FsrsRating,
  State as FsrsState,
  createEmptyCard,
  fsrs,
  type Card as FsrsCard,
} from "ts-fsrs";

export type StudyAlgorithm = "fsrs" | "anki_legacy" | "leitner";
export type StudyRating = "again" | "hard" | "good" | "easy";
export type StudyStateLabel = "new" | "learning" | "review" | "relearning";
export type QueueStrategy = "due_first" | "frequency";

export type StudyPreferences = {
  algorithm: StudyAlgorithm;
  queueStrategy: QueueStrategy;
  desiredRetention: number;
  dailyNewLimit: number;
  dailyReviewLimit: number;
  maximumIntervalDays: number;
  enableFuzz: boolean;
  learningSteps: string[];
  relearningSteps: string[];
};

export type StudyCardSnapshot = {
  state: StudyStateLabel;
  schedulerState: Record<string, unknown>;
  dueAt: string;
  lastReviewedAt: string | null;
};

export type ScheduleOutcome = {
  state: StudyStateLabel;
  schedulerState: Record<string, unknown>;
  dueAt: string;
  intervalSeconds: number;
  stability?: number;
  difficulty?: number;
  retrievability?: number;
};

export type SchedulePreview = Record<StudyRating, ScheduleOutcome>;

export const DEFAULT_STUDY_PREFERENCES: StudyPreferences = {
  algorithm: "fsrs",
  queueStrategy: "due_first",
  desiredRetention: 0.9,
  dailyNewLimit: 20,
  dailyReviewLimit: 200,
  maximumIntervalDays: 36500,
  enableFuzz: true,
  learningSteps: ["1m", "10m"],
  relearningSteps: ["10m"],
};

const RATINGS: StudyRating[] = ["again", "hard", "good", "easy"];
const DAY_SECONDS = 24 * 60 * 60;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function secondsBetween(now: Date, due: Date) {
  return Math.max(0, Math.round((due.getTime() - now.getTime()) / 1000));
}

function addMinutes(now: Date, minutes: number) {
  return new Date(now.getTime() + Math.max(0, minutes) * 60_000);
}

function addDays(now: Date, days: number) {
  return new Date(now.getTime() + Math.max(0, days) * DAY_SECONDS * 1000);
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numeric(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStepMinutes(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*([smhd])$/i);
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount < 0) return fallback;
  if (unit === "s") return amount / 60;
  if (unit === "m") return amount;
  if (unit === "h") return amount * 60;
  return amount * 24 * 60;
}

function normalizePreferences(input: StudyPreferences): StudyPreferences {
  return {
    ...input,
    desiredRetention: clamp(input.desiredRetention || 0.9, 0.7, 0.99),
    dailyNewLimit: clamp(Math.floor(input.dailyNewLimit || 0), 0, 500),
    dailyReviewLimit: clamp(Math.floor(input.dailyReviewLimit || 200), 1, 2000),
    maximumIntervalDays: clamp(
      Math.floor(input.maximumIntervalDays || 36500),
      1,
      36500,
    ),
    learningSteps:
      Array.isArray(input.learningSteps) && input.learningSteps.length > 0
        ? input.learningSteps.slice(0, 8)
        : ["1m", "10m"],
    relearningSteps:
      Array.isArray(input.relearningSteps) && input.relearningSteps.length > 0
        ? input.relearningSteps.slice(0, 8)
        : ["10m"],
  };
}

function fsrsRating(rating: StudyRating) {
  switch (rating) {
    case "again":
      return FsrsRating.Again;
    case "hard":
      return FsrsRating.Hard;
    case "easy":
      return FsrsRating.Easy;
    case "good":
    default:
      return FsrsRating.Good;
  }
}

function fsrsStateLabel(state: FsrsState): StudyStateLabel {
  switch (state) {
    case FsrsState.Learning:
      return "learning";
    case FsrsState.Review:
      return "review";
    case FsrsState.Relearning:
      return "relearning";
    case FsrsState.New:
    default:
      return "new";
  }
}

function serializeFsrsCard(card: FsrsCard): Record<string, unknown> {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? null,
  };
}

function restoreFsrsCard(
  schedulerState: Record<string, unknown>,
  now: Date,
): FsrsCard {
  if (!schedulerState.due) return createEmptyCard(now);

  const due = new Date(String(schedulerState.due));
  const lastReview = schedulerState.last_review
    ? new Date(String(schedulerState.last_review))
    : undefined;

  if (Number.isNaN(due.getTime())) return createEmptyCard(now);

  return {
    due,
    stability: numeric(schedulerState.stability, 0),
    difficulty: numeric(schedulerState.difficulty, 0),
    elapsed_days: numeric(schedulerState.elapsed_days, 0),
    scheduled_days: numeric(schedulerState.scheduled_days, 0),
    learning_steps: numeric(schedulerState.learning_steps, 0),
    reps: numeric(schedulerState.reps, 0),
    lapses: numeric(schedulerState.lapses, 0),
    state: numeric(schedulerState.state, FsrsState.New) as FsrsState,
    ...(lastReview && !Number.isNaN(lastReview.getTime())
      ? { last_review: lastReview }
      : {}),
  };
}

function createFsrsScheduler(preferences: StudyPreferences) {
  const prefs = normalizePreferences(preferences);
  return fsrs({
    request_retention: prefs.desiredRetention,
    maximum_interval: prefs.maximumIntervalDays,
    enable_fuzz: prefs.enableFuzz,
    enable_short_term: true,
    learning_steps: prefs.learningSteps,
    relearning_steps: prefs.relearningSteps,
  });
}

function fsrsOutcome(
  card: FsrsCard,
  now: Date,
  scheduler: ReturnType<typeof fsrs>,
): ScheduleOutcome {
  return {
    state: fsrsStateLabel(card.state),
    schedulerState: serializeFsrsCard(card),
    dueAt: card.due.toISOString(),
    intervalSeconds: secondsBetween(now, card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    retrievability:
      card.state === FsrsState.New
        ? 1
        : scheduler.get_retrievability(card, now, false),
  };
}

function previewFsrs(
  snapshot: StudyCardSnapshot,
  preferences: StudyPreferences,
  now: Date,
): SchedulePreview {
  const scheduler = createFsrsScheduler(preferences);
  const card = restoreFsrsCard(snapshot.schedulerState, now);
  const preview = scheduler.repeat(card, now);

  return {
    again: fsrsOutcome(preview[FsrsRating.Again].card, now, scheduler),
    hard: fsrsOutcome(preview[FsrsRating.Hard].card, now, scheduler),
    good: fsrsOutcome(preview[FsrsRating.Good].card, now, scheduler),
    easy: fsrsOutcome(preview[FsrsRating.Easy].card, now, scheduler),
  };
}

function scheduleFsrs(
  snapshot: StudyCardSnapshot,
  rating: StudyRating,
  preferences: StudyPreferences,
  now: Date,
): ScheduleOutcome {
  const scheduler = createFsrsScheduler(preferences);
  const card = restoreFsrsCard(snapshot.schedulerState, now);
  const result = scheduler.next(card, now, fsrsRating(rating));
  return fsrsOutcome(result.card, now, scheduler);
}

type LegacyState = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  stepIndex?: number;
  prevIntervalDays?: number;
};

function legacyState(input: Record<string, unknown>): LegacyState {
  return {
    easeFactor: Math.max(1.3, numeric(input.easeFactor, 2.5)),
    intervalDays: Math.max(0, numeric(input.intervalDays, 0)),
    repetitions: Math.max(0, numeric(input.repetitions, 0)),
    ...(Number.isFinite(Number(input.stepIndex))
      ? { stepIndex: Math.max(0, Math.floor(Number(input.stepIndex))) }
      : {}),
    ...(Number.isFinite(Number(input.prevIntervalDays))
      ? { prevIntervalDays: Math.max(0, Number(input.prevIntervalDays)) }
      : {}),
  };
}

function legacyOutcome(
  state: StudyStateLabel,
  data: LegacyState,
  due: Date,
  now: Date,
): ScheduleOutcome {
  return {
    state,
    schedulerState: { ...data },
    dueAt: due.toISOString(),
    intervalSeconds: secondsBetween(now, due),
  };
}

// This preserves the Anki-like scheduler that existed in the user's Voca Drink
// project: 1m/10m learning, 10m relearning, 1d graduation, 4d Easy graduation,
// 1.2x Hard, ease-based Good, and a 1.3x Easy bonus.
function scheduleAnkiLegacy(
  snapshot: StudyCardSnapshot,
  rating: StudyRating,
  preferences: StudyPreferences,
  now: Date,
): ScheduleOutcome {
  const data = legacyState(snapshot.schedulerState);
  let state = snapshot.state;
  const learningSteps = normalizePreferences(preferences).learningSteps.map(
    (step, index) => parseStepMinutes(step, index === 0 ? 1 : 10),
  );
  const relearningSteps = normalizePreferences(preferences).relearningSteps.map(
    (step) => parseStepMinutes(step, 10),
  );
  const minEase = 1.3;
  const hardIntervalFactor = 1.2;
  const easyBonus = 1.3;
  const graduatingIntervalDays = 1;
  const easyInitialIntervalDays = 4;
  const lapseNewIntervalFactor = 0;
  let due = now;

  if (state === "new" || state === "learning") {
    let idx = Math.min(data.stepIndex ?? 0, learningSteps.length - 1);
    if (rating === "again") {
      idx = 0;
      state = "learning";
      data.stepIndex = idx;
      due = addMinutes(now, learningSteps[idx] ?? 1);
    } else if (rating === "hard") {
      state = "learning";
      data.stepIndex = idx;
      due = addMinutes(now, learningSteps[idx] ?? 1);
    } else if (rating === "good") {
      if (idx < learningSteps.length - 1) {
        idx += 1;
        state = "learning";
        data.stepIndex = idx;
        due = addMinutes(now, learningSteps[idx] ?? 10);
      } else {
        state = "review";
        delete data.stepIndex;
        data.intervalDays = graduatingIntervalDays;
        data.repetitions += 1;
        due = addDays(now, data.intervalDays);
      }
    } else {
      state = "review";
      delete data.stepIndex;
      data.intervalDays = easyInitialIntervalDays;
      data.repetitions += 1;
      due = addDays(now, data.intervalDays);
    }
  } else if (state === "review") {
    if (rating === "again") {
      data.easeFactor = Math.max(minEase, data.easeFactor - 0.2);
      data.prevIntervalDays = data.intervalDays;
      data.stepIndex = 0;
      data.repetitions = 0;
      state = "relearning";
      due = addMinutes(now, relearningSteps[0] ?? 10);
    } else if (rating === "hard") {
      data.easeFactor = Math.max(minEase, data.easeFactor - 0.15);
      data.intervalDays = Math.max(
        1,
        Math.round(data.intervalDays * hardIntervalFactor),
      );
      data.repetitions += 1;
      due = addDays(now, data.intervalDays);
    } else if (rating === "good") {
      data.intervalDays = Math.max(
        1,
        Math.round(data.intervalDays * data.easeFactor),
      );
      data.repetitions += 1;
      due = addDays(now, data.intervalDays);
    } else {
      data.easeFactor += 0.15;
      data.intervalDays = Math.max(
        1,
        Math.round(data.intervalDays * data.easeFactor * easyBonus),
      );
      data.repetitions += 1;
      due = addDays(now, data.intervalDays);
    }
  } else {
    let idx = Math.min(data.stepIndex ?? 0, relearningSteps.length - 1);
    if (rating === "again") {
      idx = 0;
      data.stepIndex = idx;
      due = addMinutes(now, relearningSteps[idx] ?? 10);
    } else if (rating === "hard") {
      data.stepIndex = idx;
      due = addMinutes(now, relearningSteps[idx] ?? 10);
    } else if (idx < relearningSteps.length - 1) {
      idx += 1;
      data.stepIndex = idx;
      due = addMinutes(now, relearningSteps[idx] ?? 10);
    } else {
      const previous = data.prevIntervalDays ?? 1;
      const factor = rating === "easy" ? easyBonus : 1;
      data.intervalDays = Math.max(
        1,
        Math.round(previous * lapseNewIntervalFactor * factor),
      );
      data.repetitions += 1;
      delete data.stepIndex;
      state = "review";
      due = addDays(now, data.intervalDays);
    }
  }

  return legacyOutcome(state, data, due, now);
}

type LeitnerState = { box: 1 | 2 | 3 };
const LEITNER_INTERVAL_DAYS: Record<1 | 2 | 3, number> = {
  1: 1,
  2: 3,
  3: 5,
};

function leitnerData(input: Record<string, unknown>): LeitnerState {
  const raw = Math.round(numeric(input.box, 1));
  return { box: clamp(raw, 1, 3) as 1 | 2 | 3 };
}

// Mirrors Voca Drink's final 3-box Leitner implementation. It was binary under
// the hood, so Again is a miss and Hard/Good/Easy are all successful recalls.
function scheduleLeitner(
  snapshot: StudyCardSnapshot,
  rating: StudyRating,
  now: Date,
): ScheduleOutcome {
  const data = leitnerData(snapshot.schedulerState);
  const nextBox =
    rating === "again"
      ? clamp(data.box - 1, 1, 3)
      : clamp(data.box + 1, 1, 3);
  data.box = nextBox as 1 | 2 | 3;
  const due = addDays(now, LEITNER_INTERVAL_DAYS[data.box]);

  return {
    state: "review",
    schedulerState: { box: data.box },
    dueAt: due.toISOString(),
    intervalSeconds: secondsBetween(now, due),
  };
}

export function previewStudySchedule(
  snapshot: StudyCardSnapshot,
  preferences: StudyPreferences,
  now = new Date(),
): SchedulePreview {
  if (preferences.algorithm === "fsrs") {
    return previewFsrs(snapshot, preferences, now);
  }

  const outcomes = {} as SchedulePreview;
  for (const rating of RATINGS) {
    outcomes[rating] =
      preferences.algorithm === "anki_legacy"
        ? scheduleAnkiLegacy(snapshot, rating, preferences, now)
        : scheduleLeitner(snapshot, rating, now);
  }
  return outcomes;
}

export function scheduleStudyRating(
  snapshot: StudyCardSnapshot,
  rating: StudyRating,
  preferences: StudyPreferences,
  now = new Date(),
): ScheduleOutcome {
  if (preferences.algorithm === "fsrs") {
    return scheduleFsrs(snapshot, rating, preferences, now);
  }
  if (preferences.algorithm === "anki_legacy") {
    return scheduleAnkiLegacy(snapshot, rating, preferences, now);
  }
  return scheduleLeitner(snapshot, rating, now);
}

export function schedulerStateForNewCard(
  algorithm: StudyAlgorithm,
  now = new Date(),
): Record<string, unknown> {
  if (algorithm === "fsrs") return serializeFsrsCard(createEmptyCard(now));
  if (algorithm === "anki_legacy") {
    return { easeFactor: 2.5, intervalDays: 0, repetitions: 0, stepIndex: 0 };
  }
  return { box: 1 };
}

export function parseStudyPreferences(row: unknown): StudyPreferences {
  const value = safeObject(row);
  const algorithm = ["fsrs", "anki_legacy", "leitner"].includes(
    String(value.scheduler_algorithm),
  )
    ? (String(value.scheduler_algorithm) as StudyAlgorithm)
    : DEFAULT_STUDY_PREFERENCES.algorithm;
  const queueStrategy = ["due_first", "frequency"].includes(
    String(value.queue_strategy),
  )
    ? (String(value.queue_strategy) as QueueStrategy)
    : DEFAULT_STUDY_PREFERENCES.queueStrategy;

  return normalizePreferences({
    algorithm,
    queueStrategy,
    desiredRetention: numeric(
      value.desired_retention,
      DEFAULT_STUDY_PREFERENCES.desiredRetention,
    ),
    dailyNewLimit: numeric(
      value.daily_new_limit,
      DEFAULT_STUDY_PREFERENCES.dailyNewLimit,
    ),
    dailyReviewLimit: numeric(
      value.daily_review_limit,
      DEFAULT_STUDY_PREFERENCES.dailyReviewLimit,
    ),
    maximumIntervalDays: numeric(
      value.maximum_interval_days,
      DEFAULT_STUDY_PREFERENCES.maximumIntervalDays,
    ),
    enableFuzz:
      typeof value.enable_fuzz === "boolean"
        ? value.enable_fuzz
        : DEFAULT_STUDY_PREFERENCES.enableFuzz,
    learningSteps: Array.isArray(value.learning_steps)
      ? value.learning_steps.map(String)
      : DEFAULT_STUDY_PREFERENCES.learningSteps,
    relearningSteps: Array.isArray(value.relearning_steps)
      ? value.relearning_steps.map(String)
      : DEFAULT_STUDY_PREFERENCES.relearningSteps,
  });
}
