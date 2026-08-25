import { NextRequest, NextResponse } from "next/server";

import { admin, createServerClientRSC } from "../../../lib/supabase/server";

type QuestionType = "listen_repeat" | "picture_description" | "interview";
type AssetType = "image" | "audio";

const questionTypes = new Set<QuestionType>(["listen_repeat", "picture_description", "interview"]);
const assetTypes = new Set<AssetType>(["image", "audio"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function string(value: unknown, maxLength = 4000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}

function integer(value: unknown, min: number, max: number): number | null {
  return Number.isInteger(value) && typeof value === "number" && value >= min && value <= max ? value : null;
}

async function requireAdmin() {
  const sessionClient = await createServerClientRSC();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return null;

  const database = admin();
  const { data: member } = await database
    .from("users")
    .select("uid, account_status")
    .eq("auth_id", user.id)
    .maybeSingle();
  return member?.account_status === "admin" && member.uid ? member.uid : null;
}

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const adminUserId = await requireAdmin();
  if (!adminUserId) return noStore({ error: "Administrator access is required." }, 403);

  const database = admin();
  const [sets, sections, questions, assets, privateRows, links, attempts, responses, members] = await Promise.all([
    database.from("speaking_question_sets").select("*").order("updated_at", { ascending: false }),
    database.from("speaking_test_sections").select("*").order("position"),
    database.from("speaking_question_bank").select("*").order("updated_at", { ascending: false }),
    database.from("speaking_question_assets").select("*").order("created_at", { ascending: false }),
    database.from("speaking_question_private").select("*"),
    database.from("speaking_section_questions").select("*").order("position"),
    database.from("speaking_test_attempts").select("id, user_id, test_version, question_set_id, task_count, overall_cefr, overall_band, overall_score, completed_at").order("completed_at", { ascending: false }).limit(100),
    database.from("speaking_test_responses").select("attempt_id, task_number, task_kind, question_id, duration_seconds, word_count").order("created_at", { ascending: false }).limit(700),
    database.from("users").select("uid, display_name, is_placeholder"),
  ]);

  if ([sets, sections, questions, assets, privateRows, links, attempts, responses, members].some((result) => result.error)) {
    console.error("[test-center] could not load test center data");
    return noStore({ error: "The test center is temporarily unavailable." }, 500);
  }

  return noStore({
    sets: sets.data ?? [],
    sections: sections.data ?? [],
    questions: questions.data ?? [],
    assets: assets.data ?? [],
    privateRows: privateRows.data ?? [],
    links: links.data ?? [],
    attempts: attempts.data ?? [],
    responses: responses.data ?? [],
    members: (members.data ?? []).filter((member) => member.is_placeholder !== true),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return noStore({ error: "Invalid request origin." }, 403);

  const adminUserId = await requireAdmin();
  if (!adminUserId) return noStore({ error: "Administrator access is required." }, 403);

  let body: Record<string, unknown>;
  try {
    const payload = await request.json();
    if (!isRecord(payload)) return noStore({ error: "Invalid builder request." }, 400);
    body = payload;
  } catch {
    return noStore({ error: "Invalid builder request." }, 400);
  }

  const action = string(body.action, 80);
  const database = admin();

  if (action === "create-set") {
    const slug = string(body.slug, 80);
    const title = string(body.title, 140);
    const description = string(body.description) ?? "";
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !title) {
      return noStore({ error: "A lowercase slug and title are required." }, 400);
    }
    const { data, error } = await database.from("speaking_question_sets").insert({ slug, title, description, created_by: adminUserId }).select("*").single();
    if (error) return noStore({ error: "Could not create the test set. The slug may already exist." }, 400);
    return noStore({ set: data });
  }

  if (action === "create-section") {
    const questionSetId = string(body.questionSetId, 80);
    const type = string(body.questionType, 40) as QuestionType | null;
    const title = string(body.title, 140);
    const directions = string(body.directions);
    const position = integer(body.position, 1, 20);
    const preparationSeconds = integer(body.preparationSeconds, 0, 120);
    const responseSeconds = integer(body.responseSeconds, 5, 180);
    const requiredQuestionCount = integer(body.requiredQuestionCount, 1, 20);
    if (!questionSetId || !type || !questionTypes.has(type) || !title || directions === null || position === null || preparationSeconds === null || responseSeconds === null || requiredQuestionCount === null) {
      return noStore({ error: "Complete all section fields." }, 400);
    }
    const { data, error } = await database.from("speaking_test_sections").insert({ question_set_id: questionSetId, question_type: type, title, directions, position, preparation_seconds: preparationSeconds, response_seconds: responseSeconds, required_question_count: requiredQuestionCount }).select("*").single();
    if (error) return noStore({ error: "Could not create the section." }, 400);
    return noStore({ section: data });
  }

  if (action === "create-asset") {
    const type = string(body.assetType, 20) as AssetType | null;
    const storagePath = string(body.storagePath, 1000);
    const altText = string(body.altText) ?? "";
    const durationSeconds = body.durationSeconds === null || body.durationSeconds === undefined ? null : Number(body.durationSeconds);
    if (!type || !assetTypes.has(type) || !storagePath || (durationSeconds !== null && (!Number.isFinite(durationSeconds) || durationSeconds < 0))) {
      return noStore({ error: "Provide a valid asset type and storage path." }, 400);
    }
    const { data, error } = await database.from("speaking_question_assets").insert({ asset_type: type, storage_path: storagePath, alt_text: altText, duration_seconds: durationSeconds, created_by: adminUserId }).select("*").single();
    if (error) return noStore({ error: "Could not register the asset. The path may already exist." }, 400);
    return noStore({ asset: data });
  }

  if (action === "create-question") {
    const type = string(body.questionType, 40) as QuestionType | null;
    const topic = string(body.topic, 160) ?? "";
    const cefrTarget = string(body.cefrTarget, 4);
    const prompt = string(body.prompt) ?? "";
    const scenario = string(body.scenario) ?? "";
    const imageAssetId = string(body.imageAssetId, 80) || null;
    const audioAssetId = string(body.audioAssetId, 80) || null;
    const expectedTranscript = string(body.expectedTranscript, 2000) || null;
    const internalNotes = string(body.internalNotes) ?? "";
    const scoringNotes = isRecord(body.scoringNotes) ? body.scoringNotes : {};
    if (!type || !questionTypes.has(type) || ![null, "A1", "A2", "B1", "B2", "C1", "C2"].includes(cefrTarget)) {
      return noStore({ error: "Provide a valid question type and CEFR target." }, 400);
    }
    if ((type === "listen_repeat" && !audioAssetId) || (type === "picture_description" && !imageAssetId)) {
      return noStore({ error: "Listen & Repeat needs an audio asset; Picture Description needs an image asset." }, 400);
    }
    const requiredAssetId = type === "listen_repeat" ? audioAssetId : type === "picture_description" ? imageAssetId : null;
    if (requiredAssetId) {
      const { data: asset } = await database
        .from("speaking_question_assets")
        .select("asset_type")
        .eq("id", requiredAssetId)
        .maybeSingle();
      const expectedType: AssetType = type === "listen_repeat" ? "audio" : "image";
      if (!asset || asset.asset_type !== expectedType) return noStore({ error: `Choose a ${expectedType} asset for this question type.` }, 400);
    }
    const { data: question, error: questionError } = await database
      .from("speaking_question_bank")
      .insert({ question_type: type, topic, cefr_target: cefrTarget || null, prompt, scenario, image_asset_id: imageAssetId, audio_asset_id: audioAssetId, created_by: adminUserId })
      .select("*")
      .single();
    if (questionError || !question) return noStore({ error: "Could not create the question." }, 400);
    const { error: privateError } = await database.from("speaking_question_private").insert({ question_id: question.id, expected_transcript: expectedTranscript, scoring_notes: scoringNotes, internal_notes: internalNotes });
    if (privateError) {
      await database.from("speaking_question_bank").delete().eq("id", question.id);
      return noStore({ error: "Could not save the private scoring data." }, 500);
    }
    return noStore({ question });
  }

  if (action === "add-question-to-section") {
    const sectionId = string(body.sectionId, 80);
    const questionId = string(body.questionId, 80);
    const position = integer(body.position, 1, 20);
    if (!sectionId || !questionId || position === null) return noStore({ error: "Choose a section, question, and position." }, 400);
    const [{ data: section }, { data: question }] = await Promise.all([
      database.from("speaking_test_sections").select("question_type").eq("id", sectionId).maybeSingle(),
      database.from("speaking_question_bank").select("question_type").eq("id", questionId).maybeSingle(),
    ]);
    if (!section || !question || section.question_type !== question.question_type) return noStore({ error: "A section can contain only questions of the same type." }, 400);
    const { data, error } = await database.from("speaking_section_questions").insert({ section_id: sectionId, question_id: questionId, position }).select("*").single();
    if (error) return noStore({ error: "Could not add the question at that position." }, 400);
    return noStore({ link: data });
  }

  if (action === "set-published") {
    const setId = string(body.setId, 80);
    const isPublished = body.isPublished === true;
    if (!setId) return noStore({ error: "A test set is required." }, 400);
    if (isPublished) {
      const { data: sections } = await database.from("speaking_test_sections").select("id, required_question_count").eq("question_set_id", setId);
      if (!sections?.length) return noStore({ error: "Add at least one section before publishing." }, 400);
      const { data: links } = await database.from("speaking_section_questions").select("section_id").in("section_id", sections.map((section) => section.id));
      const counts = new Map<string, number>();
      links?.forEach((link) => counts.set(link.section_id, (counts.get(link.section_id) ?? 0) + 1));
      if (sections.some((section) => (counts.get(section.id) ?? 0) < section.required_question_count)) {
        return noStore({ error: "Each section needs its required number of questions before publishing." }, 400);
      }
    }
    const { data, error } = await database.from("speaking_question_sets").update({ is_published: isPublished, updated_at: new Date().toISOString() }).eq("id", setId).select("*").single();
    if (error) return noStore({ error: "Could not update the test set." }, 400);
    return noStore({ set: data });
  }

  return noStore({ error: "Unsupported builder action." }, 400);
}
