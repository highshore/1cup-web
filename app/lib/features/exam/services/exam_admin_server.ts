import { admin, createServerClientRSC } from "../../../supabase/server";
import { EXAM_FORMAT_COPY, type ExamCenterOverview, type ExamInterviewerStatus, type ExamSetDetail, type ExamSetStatus } from "../types";

type Database = ReturnType<typeof admin>;

const CANDIDATE_PROFILES = [
  { name: "Maya Thompson", gender: "Female", occupation: "Museum educator", attire: "navy cardigan", personality: "curious", voiceTone: "measured", avatarKey: "maya-thompson" },
  { name: "Ethan Brooks", gender: "Male", occupation: "Urban planner", attire: "olive overshirt", personality: "thoughtful", voiceTone: "calm", avatarKey: "ethan-brooks" },
  { name: "Aisha Patel", gender: "Female", occupation: "Environmental scientist", attire: "soft blue blouse", personality: "encouraging", voiceTone: "friendly", avatarKey: "aisha-patel" },
  { name: "Noah Williams", gender: "Male", occupation: "Community journalist", attire: "sand jacket", personality: "observant", voiceTone: "crisp", avatarKey: "noah-williams" },
  { name: "Sofia Martin", gender: "Female", occupation: "Architect", attire: "forest-green knit", personality: "reflective", voiceTone: "warm", avatarKey: "sofia-martin" },
  { name: "Jordan Lee", gender: "Nonbinary", occupation: "Product researcher", attire: "rust shirt", personality: "direct", voiceTone: "confident", avatarKey: "jordan-lee" },
] as const;

function compact(value: unknown, maximum = 200) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function noStore(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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

function setSummaryRows(sets: Array<Record<string, unknown>>, interviewers: Array<Record<string, unknown>>, items: Array<Record<string, unknown>>) {
  const interviewerById = new Map(interviewers.map((interviewer) => [interviewer.id, interviewer]));
  const itemsBySet = new Map<string, Array<Record<string, unknown>>>();
  items.forEach((item) => {
    const setId = typeof item.exam_set_id === "string" ? item.exam_set_id : "";
    if (!setId) return;
    const current = itemsBySet.get(setId) ?? [];
    current.push(item);
    itemsBySet.set(setId, current);
  });

  return sets.map((set) => {
    const setItems = itemsBySet.get(String(set.id)) ?? [];
    const ready = setItems.filter((item) => item.module === "listen_repeat"
      ? item.audio_status === "ready" && item.visual_status === "ready" && item.audio_url && item.image_url
      : item.video_status === "ready" && item.video_url).length;
    const interviewer = interviewerById.get(set.interviewer_id);
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
    };
  });
}

export async function getExamCenter(): Promise<ExamCenterOverview> {
  const database = admin();
  const [interviewersResult, setsResult, itemsResult] = await Promise.all([
    database.from("exam_interviewers").select("*").order("updated_at", { ascending: false }),
    database.from("exam_sets").select("*").order("updated_at", { ascending: false }),
    database.from("exam_set_items").select("exam_set_id, module, audio_status, visual_status, video_status, audio_url, image_url, video_url"),
  ]);

  if (interviewersResult.error || setsResult.error || itemsResult.error) {
    console.error("[exam-center] failed to load workspace", interviewersResult.error ?? setsResult.error ?? itemsResult.error);
    throw new Error("The exam workspace is temporarily unavailable.");
  }

  return {
    interviewers: (interviewersResult.data ?? []) as never[],
    sets: setSummaryRows(
      (setsResult.data ?? []) as Record<string, unknown>[],
      (interviewersResult.data ?? []) as Record<string, unknown>[],
      (itemsResult.data ?? []) as Record<string, unknown>[],
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
  } as ExamSetDetail;
}

function buildSetContent(listenRepeatTheme: string, interviewTheme: string) {
  const listenSubject = listenRepeatTheme.replace(/[.!?]+$/, "") || "a community activity";
  const interviewSubject = interviewTheme.replace(/[.!?]+$/, "") || "everyday experiences";
  const repeatPrompts = [
    `A short update about ${listenSubject} will be shared with all participants this Monday morning.`,
    `Please bring the information you need before arriving so the group can begin on time.`,
    `The coordinator will answer questions near the main entrance after the announcement ends.`,
    `New volunteers can ask an experienced member for help during the first part of the activity.`,
    `Everyone should record any important changes before leaving the area for the day.`,
    `The schedule may change if weather conditions make the planned work unsafe or impractical.`,
    `Please remember to thank the people who helped organize this week’s shared task.`,
  ];
  const interviewPrompts = [
    `What is one personal experience that comes to mind when you think about ${interviewSubject}?`,
    `How have your preferences about ${interviewSubject} changed over time?`,
    `Can you describe a specific example that explains why ${interviewSubject} matters to you?`,
    `What advice would you give to someone exploring ${interviewSubject} for the first time?`,
  ];
  return {
    narration: [
      { cue_key: "section_intro", label: "Speaking section introduction", script: EXAM_FORMAT_COPY.sectionIntro, source: "fixed", position: 1 },
      { cue_key: "listen_repeat_instructions", label: "Listen and Repeat directions", script: EXAM_FORMAT_COPY.listenInstructions, source: "fixed", position: 2 },
      { cue_key: "listen_repeat_scenario", label: "Listen and Repeat scenario", script: `You are helping in a situation involving ${listenSubject}. Listen to the speaker and repeat what they say. Repeat only once.`, source: "authored", position: 3 },
      { cue_key: "interview_instructions", label: "Take an Interview directions", script: EXAM_FORMAT_COPY.interviewInstructions, source: "fixed", position: 4 },
      { cue_key: "interview_scenario", label: "Take an Interview scenario", script: `You have volunteered to participate in a research study about ${interviewSubject}. You will have a short online interview with a researcher. The researcher will ask you some questions. Please answer the interviewer's questions.`, source: "authored", position: 5 },
    ],
    items: [
      ...repeatPrompts.map((prompt, index) => ({ module: "listen_repeat", position: index + 1, label: `Sentence ${index + 1}`, prompt, response_seconds: 12, visual_target: listenSubject, audio_status: "idle", visual_status: "idle", video_status: "idle", media_mode: "uploaded" })),
      ...interviewPrompts.map((prompt, index) => ({ module: "interview", position: index + 1, label: `Question ${index + 1}`, prompt, response_seconds: index < 2 ? 30 : 45, visual_target: "", audio_status: "idle", visual_status: "idle", video_status: "idle", media_mode: "uploaded" })),
    ],
  };
}

async function getApprovedInterviewer(database: Database, interviewerId: string) {
  if (!isUuid(interviewerId)) return null;
  const { data, error } = await database.from("exam_interviewers").select("id, status").eq("id", interviewerId).maybeSingle();
  if (error || data?.status !== "approved") return null;
  return data;
}

export async function updateExamWorkspace(action: string, input: Record<string, unknown>, adminUserId: string) {
  const database = admin();

  if (action === "create-candidates") {
    const { data, error } = await database.from("exam_interviewers").insert(
      CANDIDATE_PROFILES.map((candidate) => ({
        name: candidate.name,
        gender: candidate.gender,
        occupation: candidate.occupation,
        attire: candidate.attire,
        personality: candidate.personality,
        voice_tone: candidate.voiceTone,
        avatar_key: candidate.avatarKey,
        status: "pending",
        image_status: "idle",
        video_status: "idle",
        media_mode: "uploaded",
        source_metadata: { source: "web-candidate-batch" },
        created_by: adminUserId,
      })),
    ).select("*");
    if (error) throw new Error("Could not create the interviewer candidate batch.");
    return { interviewers: data ?? [] };
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
    throw new Error("Interviewer media must be uploaded from a durable source; browser preview stand-ins are no longer supported.");
  }

  if (action === "create-set") {
    const title = compact(input.title, 140);
    const interviewerId = compact(input.interviewerId, 80);
    const listenRepeatTheme = compact(input.listenRepeatTheme, 220);
    const interviewTheme = compact(input.interviewTheme, 220);
    if (title.length < 2 || listenRepeatTheme.length < 6 || interviewTheme.length < 6) {
      throw new Error("Add a title and two clear scenario briefs before creating the exam draft.");
    }
    if (!await getApprovedInterviewer(database, interviewerId)) throw new Error("Approve the selected interviewer before creating an exam set.");

    const { data: set, error: setError } = await database.from("exam_sets").insert({
      title,
      interviewer_id: interviewerId,
      listen_repeat_theme: listenRepeatTheme,
      interview_theme: interviewTheme,
      scene_description: `A clear, inclusive scene for ${listenRepeatTheme}.`,
      status: "draft",
      media_mode: "uploaded",
      created_by: adminUserId,
    }).select("*").single();
    if (setError || !set) throw new Error("Could not create the exam set.");

    const content = buildSetContent(listenRepeatTheme, interviewTheme);
    const [narrationResult, itemsResult] = await Promise.all([
      database.from("exam_set_narration").insert(content.narration.map((cue) => ({ ...cue, exam_set_id: set.id, media_status: "idle" }))),
      database.from("exam_set_items").insert(content.items.map((item) => ({ ...item, exam_set_id: set.id }))),
    ]);
    if (narrationResult.error || itemsResult.error) {
      await database.from("exam_sets").delete().eq("id", set.id);
      throw new Error("Could not build the exam items. Nothing was saved.");
    }
    return { set };
  }

  if (action === "prepare-media") {
    const examSetId = compact(input.examSetId, 80);
    if (!isUuid(examSetId)) throw new Error("Choose an exam set first.");
    const [narrationResult, itemsResult] = await Promise.all([
      database.from("exam_set_narration").select("media_status, audio_url").eq("exam_set_id", examSetId),
      database.from("exam_set_items").select("module, audio_status, visual_status, video_status, audio_url, image_url, video_url").eq("exam_set_id", examSetId),
    ]);
    const complete = narrationResult.data?.length === 5
      && narrationResult.data.every((cue) => cue.media_status === "ready" && cue.audio_url)
      && itemsResult.data?.length === 11
      && itemsResult.data.every((item) => item.module === "listen_repeat"
        ? item.audio_status === "ready" && item.visual_status === "ready" && item.audio_url && item.image_url
        : item.video_status === "ready" && item.video_url);
    if (!complete) throw new Error("This set is missing durable media. Upload its source assets before marking it ready.");
    const { data: set, error } = await database.from("exam_sets")
      .update({ status: "media_ready", updated_at: new Date().toISOString() })
      .eq("id", examSetId).select("*").single();
    if (error) throw new Error("Could not mark this imported media set as ready.");
    return { set };
  }

  if (action === "retry-item") {
    throw new Error("Refreshing no longer fabricates media. Upload a replacement source asset for this item instead.");
  }

  if (action === "set-published") {
    const examSetId = compact(input.examSetId, 80);
    const published = input.published === true;
    if (!isUuid(examSetId)) throw new Error("Choose an exam set first.");
    if (published) {
      const [narrationResult, itemsResult] = await Promise.all([
        database.from("exam_set_narration").select("media_status, audio_url").eq("exam_set_id", examSetId),
        database.from("exam_set_items").select("module, audio_status, visual_status, video_status, audio_url, image_url, video_url").eq("exam_set_id", examSetId),
      ]);
      const mediaReady = Boolean(narrationResult.data?.length)
        && narrationResult.data?.every((cue) => cue.media_status === "ready" && cue.audio_url)
        && itemsResult.data?.length === 11
        && itemsResult.data?.every((item) => item.module === "listen_repeat"
          ? item.audio_status === "ready" && item.visual_status === "ready" && item.audio_url && item.image_url
          : item.video_status === "ready" && item.video_url);
      if (!mediaReady) throw new Error("Attach all durable pipeline media before publishing this exam.");
    }
    const status: ExamSetStatus = published ? "published" : "media_ready";
    const { data, error } = await database.from("exam_sets")
      .update({ status, published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", examSetId).select("*").single();
    if (error) throw new Error("Could not update the publishing status.");
    return { set: data };
  }

  throw new Error("Unsupported exam workspace action.");
}
