// Admin-only ingestion for a YouTube shadowing lesson.
// It uses public timed captions when available and never invents transcript data.
// Missing captions remain in the explicit authorized-audio STT handoff state.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { admin, callerUid } from "../_shared/db.ts";
import { json, preflight } from "../_shared/cors.ts";

type CaptionEvent = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
};

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function getVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return VIDEO_ID.test(id) ? id : null;
    }
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      const id = url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
      return id && VIDEO_ID.test(id) ? id : null;
    }
  } catch {
    // Invalid URLs are rejected by the caller.
  }
  return null;
}

function captionTimestamps(events: CaptionEvent[]) {
  const result: Array<{ start: number; end: number; word: string }> = [];
  for (const event of events) {
    const text = event.segs?.map((item) => item.utf8 ?? "").join("") ?? "";
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length || typeof event.tStartMs !== "number") continue;
    const start = event.tStartMs / 1000;
    const duration = Math.max((event.dDurationMs ?? words.length * 360) / 1000, words.length * 0.08);
    words.forEach((word, index) => result.push({
      start: Number((start + (duration * index) / words.length).toFixed(3)),
      end: Number((start + (duration * (index + 1)) / words.length).toFixed(3)),
      word,
    }));
  }
  return result;
}

async function adminUid(req: Request): Promise<string | null> {
  const uid = await callerUid(req);
  if (!uid) return null;
  const { data } = await admin().from("users").select("account_status").eq("uid", uid).maybeSingle();
  return data?.account_status === "admin" ? uid : null;
}

async function validSchedulerRequest(req: Request, db: ReturnType<typeof admin>) {
  const { data: schedulerSecret, error } = await db.rpc("shadow_processing_scheduler_secret");
  return (
    !error &&
    typeof schedulerSecret === "string" &&
    schedulerSecret.length > 0 &&
    req.headers.get("x-shadow-processing-scheduler-secret") === schedulerSecret
  );
}

async function updateProgress(lessonId: string, job: Record<string, unknown>, lesson: Record<string, unknown>) {
  const db = admin();
  const updatedAt = new Date().toISOString();
  const [jobResult, lessonResult] = await Promise.all([
    db.from("shadow_processing_jobs").update({ ...job, updated_at: updatedAt }).eq("lesson_id", lessonId),
    db.from("shadow").update({ ...lesson, updated_at: updatedAt }).eq("id", lessonId),
  ]);
  if (jobResult.error) throw jobResult.error;
  if (lessonResult.error) throw lessonResult.error;
}

async function processLesson(lessonId: string) {
  const db = admin();
  const { data: job, error } = await db
    .from("shadow_processing_jobs")
    .select("youtube_video_id,requested_caption_language")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error || !job) throw error ?? new Error("job_not_found");

  await updateProgress(
    lessonId,
    { status: "processing", stage: "fetching_captions", progress: 25, error_message: null },
    { publication_status: "processing", processing: { state: "processing", stage: "fetching_captions", progress: 25 } },
  );

  const videoId = job.youtube_video_id as string;
  const language = job.requested_caption_language as string;
  let title = "YouTube shadowing lesson";
  let thumbnailUrl: string | null = null;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`);
    if (response.ok) {
      const payload = await response.json();
      if (typeof payload.title === "string" && payload.title.trim()) title = payload.title.trim();
      if (typeof payload.thumbnail_url === "string") thumbnailUrl = payload.thumbnail_url;
    }
  } catch (caught) {
    console.warn("[shadow-admin] oEmbed failed", caught instanceof Error ? caught.message : "unknown");
  }

  try {
    const response = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${encodeURIComponent(language)}&fmt=json3`);
    const payload = response.ok ? await response.json() : null;
    const timestamps = Array.isArray(payload?.events) ? captionTimestamps(payload.events as CaptionEvent[]) : [];
    if (timestamps.length >= 3) {
      const completedAt = new Date().toISOString();
      await updateProgress(
        lessonId,
        { status: "ready_for_review", stage: "caption_timestamps_ready", progress: 100, caption_source: `youtube:${language}`, completed_at: completedAt, error_message: null },
        { title, thumbnail_url: thumbnailUrl, audio_timestamps: timestamps, publication_status: "ready_for_review", processing: { state: "ready_for_review", stage: "caption_timestamps_ready", progress: 100, source: `youtube:${language}` } },
      );
      return;
    }
  } catch (caught) {
    console.warn("[shadow-admin] caption fetch failed", caught instanceof Error ? caught.message : "unknown");
  }

  await updateProgress(
    lessonId,
    { status: "needs_audio_stt", stage: "needs_authorized_audio", progress: 45, error_message: "No usable YouTube captions were available. Provide an authorized audio source before starting STT." },
    { title, thumbnail_url: thumbnailUrl, publication_status: "draft", processing: { state: "needs_audio_stt", stage: "needs_authorized_audio", progress: 45 } },
  );
}

async function processNextLesson() {
  const db = admin();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
  const { error: requeueError } = await db
    .from("shadow_processing_jobs")
    .update({ status: "queued", stage: "queued", progress: 5, updated_at: now.toISOString() })
    .eq("status", "processing")
    .lt("updated_at", staleBefore);
  if (requeueError) throw requeueError;

  const { data: queued, error: queuedError } = await db
    .from("shadow_processing_jobs")
    .select("lesson_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (queuedError) throw queuedError;
  if (!queued?.lesson_id) return false;

  const lessonId = queued.lesson_id as string;
  const { data: claimed, error: claimError } = await db
    .from("shadow_processing_jobs")
    .update({ status: "processing", stage: "queued", progress: 5, updated_at: now.toISOString() })
    .eq("lesson_id", lessonId)
    .eq("status", "queued")
    .select("lesson_id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return false;

  try {
    await processLesson(lessonId);
  } catch (caught) {
    console.error("[shadow-admin] processing failed", caught instanceof Error ? caught.message : "unknown");
    await updateProgress(
      lessonId,
      { status: "failed", stage: "failed", progress: 100, error_message: "Caption processing failed. Try again." },
      { publication_status: "failed", processing: { state: "failed", stage: "failed", progress: 100 } },
    );
  }
  return true;
}

async function continueInBackground(work: Promise<unknown>) {
  // EdgeRuntime is supplied by the Supabase Edge Runtime and is absent from Deno's
  // globals, so a bare reference does not type-check. Fall back to awaiting the
  // work in runtimes that do not expose waitUntil.
  const runtime = (
    globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }
  ).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(work);
    return;
  }
  await work;
}

Deno.serve(async (req): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof payload.action === "string" ? payload.action : "create";
  const db = admin();

  if (action === "process-next") {
    if (!(await validSchedulerRequest(req, db))) return json(req, { error: "permission_denied" }, 403);
    await continueInBackground(processNextLesson());
    return json(req, { accepted: true }, 202);
  }

  const uid = await adminUid(req);
  if (!uid) return json(req, { error: "permission_denied" }, 403);

  if (action === "publish") {
    const lessonId = typeof payload.lessonId === "string" ? payload.lessonId : "";
    const { data: lesson } = await db.from("shadow").select("audio_timestamps").eq("id", lessonId).maybeSingle();
    if (!lesson || !Array.isArray(lesson.audio_timestamps) || lesson.audio_timestamps.length < 3) {
      return json(req, { error: "lesson_not_ready" }, 409);
    }
    const now = new Date().toISOString();
    const { error } = await db.from("shadow").update({ publication_status: "published", published_at: now, updated_at: now }).eq("id", lessonId);
    if (error) return json(req, { error: "publish_failed" }, 500);
    await db.from("shadow_processing_jobs").update({ status: "published", updated_at: now }).eq("lesson_id", lessonId);
    return json(req, { lessonId, publicationStatus: "published" });
  }

  if (action !== "create" && action !== "retry") return json(req, { error: "invalid_action" }, 400);
  const youtubeUrl = typeof payload.youtubeUrl === "string" ? payload.youtubeUrl.trim() : "";
  const videoId = getVideoId(youtubeUrl);
  if (!videoId) return json(req, { error: "invalid_youtube_url" }, 400);
  const lessonId = `yt_${videoId}`;
  const category = typeof payload.category === "string" ? payload.category.trim().slice(0, 80) || "general" : "general";
  const difficulty = payload.difficulty === "novice" || payload.difficulty === "advanced" ? payload.difficulty : "intermediate";
  const language = typeof payload.captionLanguage === "string" && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(payload.captionLanguage) ? payload.captionLanguage : "en";
  const now = new Date().toISOString();

  const { error: lessonError } = await db.from("shadow").upsert({
    id: lessonId,
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
    category,
    difficulty,
    publication_status: "processing",
    processing: { state: "queued", stage: "queued", progress: 5 },
    created_by: uid,
    updated_at: now,
  }, { onConflict: "id" });
  if (lessonError) return json(req, { error: "lesson_create_failed" }, 500);

  const { error: jobError } = await db.from("shadow_processing_jobs").upsert({
    lesson_id: lessonId,
    youtube_video_id: videoId,
    requested_caption_language: language,
    status: "queued",
    stage: "queued",
    progress: 5,
    created_by: uid,
    error_message: null,
    updated_at: now,
  }, { onConflict: "lesson_id" });
  if (jobError) return json(req, { error: "job_create_failed" }, 500);

  await continueInBackground(processNextLesson());
  return json(req, { lessonId, status: "queued" }, 202);
});
