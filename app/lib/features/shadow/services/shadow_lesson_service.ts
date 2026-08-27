import { supabase } from "../../../supabase/client";

export type ShadowDifficulty = "novice" | "intermediate" | "advanced";
export type ShadowPublicationStatus =
  | "draft"
  | "processing"
  | "ready_for_review"
  | "published"
  | "failed";
export type ShadowJobStatus =
  | "queued"
  | "processing"
  | "ready_for_review"
  | "needs_audio_stt"
  | "failed"
  | "published";

export type ShadowLesson = {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string | null;
  category: string;
  difficulty: ShadowDifficulty;
  publicationStatus: ShadowPublicationStatus;
  publishedAt: string | null;
  updatedAt: string | null;
  processing?: {
    state?: string;
    stage?: string;
    progress?: number;
  } | null;
};

export type ShadowProcessingJob = {
  lessonId: string;
  status: ShadowJobStatus;
  stage: string;
  progress: number;
  captionSource: string | null;
  errorMessage: string | null;
  updatedAt: string | null;
};

export type ShadowAdminLesson = ShadowLesson & {
  job?: ShadowProcessingJob;
};

type ShadowRow = Record<string, unknown>;

const asDifficulty = (value: unknown): ShadowDifficulty =>
  value === "novice" || value === "advanced" ? value : "intermediate";

const asPublicationStatus = (value: unknown): ShadowPublicationStatus => {
  if (
    value === "draft" ||
    value === "processing" ||
    value === "ready_for_review" ||
    value === "published" ||
    value === "failed"
  ) {
    return value;
  }
  return "draft";
};

const asJobStatus = (value: unknown): ShadowJobStatus => {
  if (
    value === "queued" ||
    value === "processing" ||
    value === "ready_for_review" ||
    value === "needs_audio_stt" ||
    value === "failed" ||
    value === "published"
  ) {
    return value;
  }
  return "queued";
};

const parseProcessing = (value: unknown): ShadowLesson["processing"] =>
  value && typeof value === "object"
    ? {
        state: typeof (value as ShadowRow).state === "string" ? (value as ShadowRow).state as string : undefined,
        stage: typeof (value as ShadowRow).stage === "string" ? (value as ShadowRow).stage as string : undefined,
        progress: typeof (value as ShadowRow).progress === "number" ? (value as ShadowRow).progress as number : undefined,
      }
    : null;

const parseLesson = (row: ShadowRow): ShadowLesson => ({
  id: String(row.id ?? ""),
  title: typeof row.title === "string" && row.title.trim() ? row.title : "Untitled shadowing lesson",
  description: typeof row.description === "string" ? row.description : "",
  youtubeUrl: typeof row.youtube_url === "string" ? row.youtube_url : "",
  thumbnailUrl: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
  category: typeof row.category === "string" && row.category.trim() ? row.category : "general",
  difficulty: asDifficulty(row.difficulty),
  publicationStatus: asPublicationStatus(row.publication_status),
  publishedAt: typeof row.published_at === "string" ? row.published_at : null,
  updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  processing: parseProcessing(row.processing),
});

const parseJob = (row: ShadowRow): ShadowProcessingJob => ({
  lessonId: String(row.lesson_id ?? ""),
  status: asJobStatus(row.status),
  stage: typeof row.stage === "string" ? row.stage : "queued",
  progress: typeof row.progress === "number" ? row.progress : 0,
  captionSource: typeof row.caption_source === "string" ? row.caption_source : null,
  errorMessage: typeof row.error_message === "string" ? row.error_message : null,
  updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
});

export async function loadPublishedShadowLessons(): Promise<ShadowLesson[]> {
  const { data, error } = await supabase
    .from("shadow")
    .select("id,title,description,youtube_url,thumbnail_url,category,difficulty,publication_status,published_at,updated_at,processing")
    .eq("publication_status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((row) => parseLesson(row as ShadowRow));
}

export async function loadAdminShadowLessons(): Promise<ShadowAdminLesson[]> {
  const [lessonsResult, jobsResult] = await Promise.all([
    supabase
      .from("shadow")
      .select("id,title,description,youtube_url,thumbnail_url,category,difficulty,publication_status,published_at,updated_at,processing")
      .order("updated_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("shadow_processing_jobs")
      .select("lesson_id,status,stage,progress,caption_source,error_message,updated_at"),
  ]);
  if (lessonsResult.error) throw lessonsResult.error;
  if (jobsResult.error) throw jobsResult.error;

  const jobByLessonId = new Map(
    (jobsResult.data ?? []).map((row) => {
      const job = parseJob(row as ShadowRow);
      return [job.lessonId, job] as const;
    }),
  );

  return (lessonsResult.data ?? []).map((row) => {
    const lesson = parseLesson(row as ShadowRow);
    return { ...lesson, job: jobByLessonId.get(lesson.id) };
  });
}

export async function queueShadowLesson(input: {
  youtubeUrl: string;
  category: string;
  difficulty: ShadowDifficulty;
  captionLanguage: string;
  action?: "create" | "retry";
}): Promise<{ lessonId: string }> {
  const { data, error } = await supabase.functions.invoke("shadow-admin", {
    body: { action: input.action ?? "create", ...input },
  });
  if (error) throw error;
  if (!data || typeof data.lessonId !== "string") throw new Error("Shadow lesson queue response was invalid.");
  return { lessonId: data.lessonId };
}

export async function publishShadowLesson(lessonId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("shadow-admin", {
    body: { action: "publish", lessonId },
  });
  if (error) throw error;
}
