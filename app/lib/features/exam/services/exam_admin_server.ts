import { admin, createServerClientRSC } from "../../../supabase/server";
import { getAdminExamAttemptReviews } from "../../speaking-test/services/speaking_test_server";
import type { SpeakingTestCategory } from "../../speaking-test/types";
import { type ExamCenterOverview, type ExamInterviewerStatus, type ExamSetDetail, type ExamSetStatus } from "../types";

type Database = ReturnType<typeof admin>;

function compact(value: unknown, maximum = 200) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function noStore(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function invokeExamPipeline(action: string, input: Record<string, unknown>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("The durable exam pipeline is not configured.");

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/exam-pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...input }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.ok === false || typeof payload.error === "string") {
    throw new Error(typeof payload.error === "string" ? payload.error : "The durable exam pipeline could not accept this request.");
  }
  return payload;
}

export async function requireExamAdmin() {
  const sessionClient = await createServerClientRSC();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return null;

  const { data: member } = await admin()
    .from("users")
    .select("uid, account_status")
    .eq("auth_id", user.id)
    .maybeSingle();

  return member?.account_status === "admin" && member.uid ? member.uid : null;
}

function setSummaryRows(
  sets: Array<Record<string, unknown>>,
  interviewers: Array<Record<string, unknown>>,
  items: Array<Record<string, unknown>>,
  attempts: Array<Record<string, unknown>>,
) {
  const interviewerById = new Map(interviewers.map((interviewer) => [interviewer.id, interviewer]));
  const itemsBySet = new Map<string, Array<Record<string, unknown>>>();
  items.forEach((item) => {
    const setId = typeof item.exam_set_id === "string" ? item.exam_set_id : "";
    if (!setId) return;
    const current = itemsBySet.get(setId) ?? [];
    current.push(item);
    itemsBySet.set(setId, current);
  });

  const attemptsBySet = new Map<string, Array<Record<string, unknown>>>();
  attempts.forEach((attempt) => {
    const setId = typeof attempt.exam_set_id === "string" ? attempt.exam_set_id : "";
    if (!setId) return;
    const current = attemptsBySet.get(setId) ?? [];
    current.push(attempt);
    attemptsBySet.set(setId, current);
  });

  return sets.map((set) => {
    const setItems = itemsBySet.get(String(set.id)) ?? [];
    const ready = setItems.filter((item) => item.module === "listen_repeat"
      ? item.audio_status === "ready" && item.visual_status === "ready" && item.audio_url && item.image_url
      : item.video_status === "ready" && item.video_url).length;
    const interviewer = interviewerById.get(set.interviewer_id);
    const setAttempts = attemptsBySet.get(String(set.id)) ?? [];
    const scored = setAttempts.filter((attempt) => attempt.status === "completed" && typeof attempt.overall_score === "number");
    const average = scored.length
      ? Math.round((scored.reduce((sum, attempt) => sum + Number(attempt.overall_score), 0) / scored.length) * 10) / 10
      : null;
    return {
      ...set,
      interviewer: interviewer ? {
        id: interviewer.id,
        name: interviewer.name,
        avatar_key: interviewer.avatar_key,
        occupation: interviewer.occupation,
        status: interviewer.status,
        image_url: interviewer.image_url,
      } : null,
      item_count: setItems.length,
      ready_item_count: ready,
      attempt_count: setAttempts.length,
      scored_attempt_count: scored.length,
      average_score: average,
    };
  });
}

export async function getExamCenter(): Promise<ExamCenterOverview> {
  const database = admin();
  const [interviewersResult, setsResult, itemsResult, attemptsResult] = await Promise.all([
    database.from("exam_interviewers").select("*").order("updated_at", { ascending: false }),
    database.from("exam_sets").select("*").order("updated_at", { ascending: false }),
    database.from("exam_set_items").select("exam_set_id, module, audio_status, visual_status, video_status, audio_url, image_url, video_url"),
    database.from("exam_attempts").select("exam_set_id, status, overall_score"),
  ]);

  if (interviewersResult.error || setsResult.error || itemsResult.error || attemptsResult.error) {
    console.error("[exam-center] failed to load workspace", interviewersResult.error ?? setsResult.error ?? itemsResult.error ?? attemptsResult.error);
    throw new Error("The exam workspace is temporarily unavailable.");
  }

  return {
    interviewers: (interviewersResult.data ?? []) as never[],
    sets: setSummaryRows(
      (setsResult.data ?? []) as Record<string, unknown>[],
      (interviewersResult.data ?? []) as Record<string, unknown>[],
      (itemsResult.data ?? []) as Record<string, unknown>[],
      (attemptsResult.data ?? []) as Record<string, unknown>[],
    ) as never[],
  };
}

export async function getExamSet(examSetId: string): Promise<ExamSetDetail | null> {
  if (!isUuid(examSetId)) return null;
  const database = admin();
  const { data: set, error: setError } = await database.from("exam_sets").select("*").eq("id", examSetId).maybeSingle();
  if (setError) throw new Error("The exam set could not be loaded.");
  if (!set) return null;

  const [interviewerResult, narrationResult, itemsResult] = await Promise.all([
    database.from("exam_interviewers").select("*").eq("id", set.interviewer_id).maybeSingle(),
    database.from("exam_set_narration").select("*").eq("exam_set_id", examSetId).order("position"),
    database.from("exam_set_items").select("*").eq("exam_set_id", examSetId).order("module").order("position"),
  ]);
  if (interviewerResult.error || narrationResult.error || itemsResult.error || !interviewerResult.data) {
    throw new Error("The exam detail is temporarily unavailable.");
  }

  return {
    ...set,
    interviewer: interviewerResult.data,
    narration: narrationResult.data ?? [],
    items: itemsResult.data ?? [],
    attempts: set.is_deployed ? await getAdminExamAttemptReviews(examSetId) : [],
  } as ExamSetDetail;
}

async function hasCompleteExamMedia(database: Database, examSetId: string) {
  const [narrationResult, itemsResult] = await Promise.all([
    database.from("exam_set_narration").select("media_status, audio_url").eq("exam_set_id", examSetId),
    database.from("exam_set_items").select("module, audio_status, visual_status, video_status, audio_url, image_url, video_url").eq("exam_set_id", examSetId),
  ]);

  if (narrationResult.error || itemsResult.error) {
    throw new Error("The exam media could not be checked.");
  }

  return narrationResult.data?.length === 5
    && narrationResult.data.every((cue) => cue.media_status === "ready" && cue.audio_url)
    && itemsResult.data?.length === 11
    && itemsResult.data.every((item) => item.module === "listen_repeat"
      ? item.audio_status === "ready" && item.visual_status === "ready" && item.audio_url && item.image_url
      : item.video_status === "ready" && item.video_url);
}

function deploymentCategories(input: Record<string, unknown>) {
  return Array.isArray(input.categories)
    ? [...new Set(input.categories.filter((value): value is SpeakingTestCategory => value === "topic" || value === "toefl" || value === "free"))]
    : [];
}

export async function updateExamWorkspace(action: string, input: Record<string, unknown>, adminUserId: string) {
  const database = admin();

  if (action === "create-candidates") {
    return invokeExamPipeline("create-candidates", { requestedBy: adminUserId });
  }

  if (action === "set-interviewer-status") {
    const interviewerId = compact(input.interviewerId, 80);
    const status = compact(input.status, 20) as ExamInterviewerStatus;
    if (!isUuid(interviewerId) || !["pending", "approved", "rejected"].includes(status)) throw new Error("Choose a valid interviewer status.");
    const { data, error } = await database.from("exam_interviewers")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", interviewerId)
      .select("*")
      .single();
    if (error) throw new Error("Could not update this interviewer.");
    return { interviewer: data };
  }

  if (action === "refresh-interviewer-media") {
    const interviewerId = compact(input.interviewerId, 80);
    return invokeExamPipeline("enqueue", { jobType: "interviewer", interviewerId, requestedBy: adminUserId });
  }

  if (action === "poll-interviewer-video") {
    const interviewerId = compact(input.interviewerId, 80);
    return invokeExamPipeline("poll", { interviewerId });
  }

  if (action === "suggest-set-briefs") {
    const title = compact(input.title, 140) || "Speaking practice set";
    const interviewerId = compact(input.interviewerId, 80);
    return invokeExamPipeline("suggest-briefs", { title, interviewerId });
  }

  if (action === "create-set") {
    const title = compact(input.title, 140);
    if (title.length < 2) {
      throw new Error("Add a title and two clear scenario briefs before creating the exam draft.");
    }
    return invokeExamPipeline("create-draft", {
      title,
      interviewerId: compact(input.interviewerId, 80),
      listenRepeatTheme: input.listenRepeatTheme,
      interviewTheme: input.interviewTheme,
      requestedBy: adminUserId,
    });
  }

  if (action === "prepare-media") {
    const examSetId = compact(input.examSetId, 80);
    if (!isUuid(examSetId)) throw new Error("Choose an exam set first.");
    const complete = await hasCompleteExamMedia(database, examSetId);
    if (!complete) return invokeExamPipeline("enqueue", { jobType: "exam", examSetId, requestedBy: adminUserId });
    const { data: set, error } = await database.from("exam_sets")
      .update({ status: "media_ready", updated_at: new Date().toISOString() })
      .eq("id", examSetId).select("*").single();
    if (error) throw new Error("Could not mark this imported media set as ready.");
    return { set };
  }

  if (action === "retry-item") {
    const itemId = compact(input.itemId, 80);
    return invokeExamPipeline("enqueue", { jobType: "item", itemId, requestedBy: adminUserId });
  }

  if (action === "poll-item-video") {
    const itemId = compact(input.itemId, 80);
    return invokeExamPipeline("poll", { itemId });
  }

  if (action === "retry-narration") {
    const narrationId = compact(input.narrationId, 80);
    return invokeExamPipeline("enqueue", { jobType: "narration", narrationId, requestedBy: adminUserId });
  }

  if (action === "retry-listen-repeat-visuals") {
    const examSetId = compact(input.examSetId, 80);
    return invokeExamPipeline("enqueue", { jobType: "visuals", examSetId, requestedBy: adminUserId });
  }

  if (action === "set-published") {
    const examSetId = compact(input.examSetId, 80);
    const published = input.published === true;
    if (!isUuid(examSetId)) throw new Error("Choose an exam set first.");
    if (published) {
      if (!await hasCompleteExamMedia(database, examSetId)) {
        throw new Error("Attach all durable pipeline media before publishing this exam.");
      }
    }
    const status: ExamSetStatus = published ? "published" : "media_ready";
    const { data, error } = await database.from("exam_sets")
      .update({
        status,
        published_at: published ? new Date().toISOString() : null,
        is_deployed: published ? undefined : false,
        deployed_at: published ? undefined : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", examSetId).select("*").single();
    if (error) throw new Error("Could not update the publishing status.");
    return { set: data };
  }

  if (action === "publish-and-deploy") {
    const examSetId = compact(input.examSetId, 80);
    const categories = deploymentCategories(input);
    if (!isUuid(examSetId)) throw new Error("Choose an exam set first.");
    if (categories.length === 0) throw new Error("Choose at least one learner-facing test category.");
    if (!await hasCompleteExamMedia(database, examSetId)) {
      throw new Error("Attach all durable pipeline media before publishing this exam.");
    }

    const { data: current, error: currentError } = await database
      .from("exam_sets")
      .select("id, published_at")
      .eq("id", examSetId)
      .maybeSingle();
    if (currentError || !current) throw new Error("Exam set not found.");

    const now = new Date().toISOString();
    const { data, error } = await database
      .from("exam_sets")
      .update({
        status: "published",
        published_at: current.published_at || now,
        deployment_categories: categories,
        is_deployed: true,
        deployed_at: now,
        updated_at: now,
      })
      .eq("id", examSetId)
      .select("*")
      .single();
    if (error) throw new Error("Could not publish and deploy this exam.");
    return { set: data };
  }

  if (action === "set-deployment") {
    const examSetId = compact(input.examSetId, 80);
    const isDeployed = input.isDeployed === true;
    const categories = deploymentCategories(input);
    if (!isUuid(examSetId)) throw new Error("Choose an exam set first.");
    if (isDeployed && categories.length === 0) throw new Error("Choose at least one learner-facing test category.");
    const { data: set, error: setError } = await database
      .from("exam_sets")
      .select("id, status")
      .eq("id", examSetId)
      .maybeSingle();
    if (setError || !set) throw new Error("Exam set not found.");
    if (isDeployed && set.status !== "published") throw new Error("Publish the media-ready exam before deploying it.");
    const { data, error } = await database
      .from("exam_sets")
      .update({
        deployment_categories: categories,
        is_deployed: isDeployed,
        deployed_at: isDeployed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", examSetId)
      .select("*")
      .single();
    if (error) throw new Error("Could not update this deployment.");
    return { set: data };
  }

  throw new Error("Unsupported exam workspace action.");
}
