import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { GoogleAuth } from "google-auth-library";
import { jsonrepair } from "jsonrepair";
import { randomUUID } from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const MAX_BODY_LENGTH = 30_000;
const MAX_PHOTOS = 6;
const VERTEX_LOCATION = "global";
const GEMINI_TEXT_MODEL = "gemini-3.7-flash";
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const GOOGLE_CLOUD_PROJECT =
  process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "one-cup-eng";
const vertexAuth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

type ProcessingStage =
  | "queued"
  | "refining"
  | "summarizing"
  | "extractingVocabulary"
  | "draftingDiscussion"
  | "identifyingTerms"
  | "translating"
  | "polishingKorean"
  | "placingFigures"
  | "designingCover"
  | "illustrating"
  | "publishing"
  | "completed"
  | "failed";

type RefinedArticle = {
  title: string;
  article: string;
  paragraphs: string[];
};

type AdvancedVocabularyItem = {
  term: string;
  meaning_en: string;
  reason: string;
  example_from_article: string;
};

type AtypicalTerm = {
  term: string;
  category: "acronym" | "proper_noun" | "organization" | "place" | "technical_term" | "other";
  explanation_en: string;
};

type KoreanArticle = {
  title: string;
  subtitle: string;
  paragraphs: string[];
  summary: string[];
};

type CreateArticleInput = {
  title?: unknown;
  sourceUrl?: unknown;
  body?: unknown;
  imageUrls?: unknown;
};

type ArticleProcessingJob = {
  articleId?: unknown;
  title?: unknown;
  sourceUrl?: unknown;
  body?: unknown;
  imageUrls?: unknown;
};

const textValue = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", field + " is required.");
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", field + " is invalid.");
  }

  return trimmed;
};

const validHttpUrl = (value: string, field: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new HttpsError("invalid-argument", field + " must be a valid URL.");
  }
};

const normalizeStringList = (
  value: unknown,
  maxItems: number,
  maxLength: number
): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
};

const cleanSourceBody = (body: string): string => {
  const unwantedLine = /^(subscribe|sign up|follow us|all rights reserved|copyright|©)/i;

  return body
    .replace(/\r\n?/g, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph && !unwantedLine.test(paragraph))
    .join("\n\n")
    .trim();
};

const modelText = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string") {
    throw new HttpsError("internal", "The " + field + " output was missing.");
  }
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > maxLength) {
    throw new HttpsError("internal", "The " + field + " output was invalid.");
  }
  return text;
};

const modelMultilineText = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string") {
    throw new HttpsError("internal", "The " + field + " output was missing.");
  }
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (!text || text.length > maxLength) {
    throw new HttpsError("internal", "The " + field + " output was invalid.");
  }
  return text;
};

const modelStringList = (
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  itemMaxLength: number,
  exactCount?: number
): string[] => {
  if (!Array.isArray(value)) {
    throw new HttpsError("internal", "The " + field + " output was missing.");
  }
  const items = value.map((item, index) => modelText(item, field + " item " + (index + 1), itemMaxLength));
  if (
    items.length < minimum ||
    items.length > maximum ||
    (exactCount !== undefined && items.length !== exactCount)
  ) {
    throw new HttpsError("internal", "The " + field + " output had an invalid item count.");
  }
  return items;
};

const parseModelJson = (content: string, step: string): Record<string, unknown> => {
  const stripped = content.trim();
  const fenced = stripped.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i)?.[1];
  const outerObject = stripped.match(/\{[\s\S]*\}/)?.[0];
  const candidates = [stripped, fenced, outerObject].filter(
    (candidate): candidate is string => Boolean(candidate)
  );

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      try {
        const repaired = JSON.parse(jsonrepair(candidate));
        if (repaired && typeof repaired === "object" && !Array.isArray(repaired)) {
          return repaired as Record<string, unknown>;
        }
      } catch {
        // Try the next candidate before reporting a processor failure.
      }
    }
  }

  throw new HttpsError("internal", "The " + step + " step returned invalid JSON.");
};

const splitRefinedParagraphs = (article: string): string[] => {
  const paragraphs = article
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length < 3 || paragraphs.length > 12) {
    throw new HttpsError(
      "internal",
      "The refined article must contain between 3 and 12 coherent paragraphs."
    );
  }
  return paragraphs.map((paragraph) => paragraph.slice(0, 1_200));
};

type VertexPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
};

type VertexGenerateContentResponse = {
  candidates?: Array<{ content?: { parts?: VertexPart[] } }>;
};

const vertexGenerateContent = async (
  model: string,
  body: Record<string, unknown>
): Promise<VertexGenerateContentResponse> => {
  const accessToken = await vertexAuth.getAccessToken();
  if (!accessToken) {
    throw new HttpsError("failed-precondition", "Vertex AI credentials are unavailable.");
  }

  const response = await fetch(
    "https://aiplatform.googleapis.com/v1/projects/" +
      GOOGLE_CLOUD_PROJECT +
      "/locations/" +
      VERTEX_LOCATION +
      "/publishers/google/models/" +
      model +
      ":generateContent",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
  } & VertexGenerateContentResponse;

  if (!response.ok) {
    const error = new Error(
      "Vertex AI " +
        response.status +
        ": " +
        (payload.error?.message || payload.error?.status || "request failed")
    ) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = "vertex-ai";
    throw error;
  }

  return payload;
};

const geminiText = (response: VertexGenerateContentResponse): string =>
  response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim() || "";

const generateJson = async (
  step: string,
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 4_000
): Promise<Record<string, unknown>> => {
  const response = await vertexGenerateContent(GEMINI_TEXT_MODEL, {
    systemInstruction: {
      parts: [
        {
          text:
            systemPrompt.trim() +
            "\n\nRespond with ONLY the JSON object. No explanation, no markdown fences, and no extra text.",
        },
      ],
    },
    contents: [{ role: "user", parts: [{ text: userPrompt.trim() }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens,
      responseMimeType: "application/json",
    },
  });
  const content = geminiText(response);
  if (!content) {
    throw new HttpsError("internal", "The " + step + " step returned no content.");
  }
  return parseModelJson(content, step);
};

const refineArticle = async (
  title: string,
  sourceUrl: string,
  rawArticle: string
): Promise<RefinedArticle> => {
  const output = await generateJson(
    "refinement",
    `You are an expert editor for English-learning news content.
Refine the article while preserving meaning and factual content.

Requirements:
- Clean grammar, awkward phrasing, and redundancy.
- Keep the tone natural and readable.
- Do not invent facts.
- Keep the article suitable for upper-intermediate to advanced learners.
- Preserve or create 3 to 12 coherent paragraphs separated by blank lines.
- Return JSON with: { "refined_title": "...", "refined_article": "..." }`,
    `Title:\n${title}\n\nURL:\n${sourceUrl}\n\nArticle:\n${rawArticle}`,
    6_000
  );
  const refinedTitle = modelText(output.refined_title, "refined title", 240);
  const refinedArticle = modelMultilineText(output.refined_article, "refined article", MAX_BODY_LENGTH);
  return {
    title: refinedTitle,
    article: refinedArticle,
    paragraphs: splitRefinedParagraphs(refinedArticle),
  };
};

const summarizeArticle = async (
  refinedTitle: string,
  paragraphs: string[]
): Promise<string[]> => {
  const createSummary = async (validationFeedback?: string) => {
    const feedback = validationFeedback
      ? `\nAdditional validation feedback from the previous attempt:\n- ${validationFeedback}\n- Correct the output and follow the schema exactly.\n`
      : "";
    return generateJson(
      "summary",
      `You are creating a concise learner-friendly summary.

Requirements:
- Write exactly 3 bullet points.
- Each bullet must capture a meaningful point from the article.
- Keep the bullets informative but concise.
- Return JSON: { "summary_en": ["bullet 1", "bullet 2", "bullet 3"] }${feedback}`,
      `Title:\n${refinedTitle}\n\nParagraphs:\n${JSON.stringify(paragraphs)}`
    );
  };

  try {
    const first = await createSummary();
    return modelStringList(first.summary_en, "English summary", 3, 3, 360, 3);
  } catch (error) {
    const feedback = error instanceof Error ? error.message.slice(0, 300) : "Return exactly three concise bullets.";
    const retry = await createSummary(feedback);
    return modelStringList(retry.summary_en, "English summary", 3, 3, 360, 3);
  }
};

const extractC1Vocabulary = async (
  refinedTitle: string,
  paragraphs: string[]
): Promise<AdvancedVocabularyItem[]> => {
  const output = await generateJson(
    "advanced vocabulary extraction",
    `You are selecting advanced English expressions for Korean learners.

Requirements:
- Extract vocabulary and expressions that are CEFR C1 or C2 or above.
- Include only items that are genuinely useful or notable.
- Avoid trivial words.
- Return 5 to 12 items.
- The "term" must be normalized to its dictionary or base form, not the inflected surface form from the article.
- Prefer the canonical original expression without tense or aspect inflection.
- For verbs and verbal phrases, remove past tense and -ing forms when possible.
- Keep multi-word expressions and phrasal verbs together.
- If the article uses an inflected form like "levelling-off", normalize it to "level-off".
- Return JSON: { "c1_vocab": [{ "term": "...", "meaning_en": "...", "reason": "Why this is advanced or notable", "example_from_article": "..." }] }`,
    `Title:\n${refinedTitle}\n\nParagraphs:\n${JSON.stringify(paragraphs)}`
  );
  if (!Array.isArray(output.c1_vocab) || output.c1_vocab.length < 5 || output.c1_vocab.length > 12) {
    throw new HttpsError("internal", "The advanced vocabulary output must contain 5 to 12 items.");
  }
  return output.c1_vocab.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpsError("internal", "An advanced vocabulary item was invalid.");
    }
    const candidate = item as Record<string, unknown>;
    return {
      term: modelText(candidate.term, "vocabulary term " + (index + 1), 120),
      meaning_en: modelText(candidate.meaning_en, "vocabulary meaning " + (index + 1), 360),
      reason: modelText(candidate.reason, "vocabulary reason " + (index + 1), 360),
      example_from_article: modelText(candidate.example_from_article, "vocabulary example " + (index + 1), 700),
    };
  });
};

const extractDiscussionTopics = async (
  refinedTitle: string,
  summary: string[]
): Promise<string[]> => {
  const validateTopics = (topics: string[]): string | undefined => {
    if (topics.some((topic) => !topic.endsWith("?"))) {
      return "Every discussion prompt must end with a question mark.";
    }

    const normalized = topics.join(" ").toLowerCase();
    const hasKoreaContext = /\bkorea\b|south korea|korean society|korean companies|korean workers|korean policy|korean market/.test(
      normalized
    );
    const hasCounterargument = /counterargument|counter-argument|opposing view|opposite view|criticism|downside|drawback|disadvantage/.test(
      normalized
    );
    const hasActionOrPolicy = /\bpolicy\b|\bpolicies\b|government action|regulat|recommend|should .* do|what .* do/.test(
      normalized
    );

    if (!hasKoreaContext) {
      return "Include a specific Korea-localized prompt in natural English.";
    }
    if (!hasCounterargument) {
      return "Include a prompt that explicitly asks about a counterargument, opposing view, criticism, or downside.";
    }
    if (!hasActionOrPolicy) {
      return "Include a concrete policy or practical-action prompt.";
    }
    if (topics.some((topic) => topic.trim().split(/\s+/).length > 22)) {
      return "Make every prompt direct and no longer than 22 words.";
    }
    return undefined;
  };

  const createTopics = async (validationFeedback?: string) => {
    const feedback = validationFeedback
      ? `\nAdditional validation feedback from the previous attempt:\n- ${validationFeedback}\n- Correct the output and follow the schema exactly.\n`
      : "";
    return generateJson(
      "discussion topic creation",
      `You are writing discussion prompts for advanced Korean learners based on a news article.

Ground-truth style:
- Write mostly question-form prompts.
- Make every prompt open-ended and debate-ready, not factual quiz questions.
- Favor these frames across the set: agree/disagree stance, stakeholder impact, counterargument, Korea-localized implications, long-term consequences, policy or practical recommendation, and personal or observed parallel case.

Requirements:
- Return exactly 8 discussion prompts.
- Write every prompt in natural English.
- Every prompt must end with a question mark.
- Include at least one Korea-localized prompt.
- Korea-localized means applying the article's situation or perspective to Korea, South Korea, Korean society, Korean companies, Korean workers, Korean policy, or the Korean market.
- Do not switch the prompt language to Korean.
- Include at least one prompt that explicitly asks for the strongest counterargument, opposing view, criticism, or downside.
- Include at least one action or policy prompt.
- Keep each prompt specific to the article, concise, and natural.
- Make each prompt direct and straight to the point: use one concrete issue per question, avoid introductory framing and multi-part clauses, and use no more than 22 words.
- Return JSON: { "discussion_topics": ["...?", "...?"] }${feedback}`,
      `Title:\n${refinedTitle}\n\nSummary:\n${JSON.stringify(summary)}`
    );
  };

  try {
    const first = await createTopics();
    const topics = modelStringList(first.discussion_topics, "discussion topics", 8, 8, 420, 8);
    const validationError = validateTopics(topics);
    if (validationError) throw new HttpsError("internal", validationError);
    return topics;
  } catch (error) {
    const feedback = error instanceof Error ? error.message.slice(0, 300) : "Return eight valid discussion prompts.";
    const retry = await createTopics(feedback);
    const topics = modelStringList(retry.discussion_topics, "discussion topics", 8, 8, 420, 8);
    const validationError = validateTopics(topics);
    if (validationError) throw new HttpsError("internal", validationError);
    return topics;
  }
};

const extractAtypicalTerms = async (
  refinedTitle: string,
  paragraphs: string[]
): Promise<AtypicalTerm[]> => {
  const output = await generateJson(
    "atypical term extraction",
    `You are extracting atypical terms from an English article.

Include:
- acronyms
- abbreviations
- proper nouns
- organization names
- policy names
- product names
- place names
- unusual technical terms

Return JSON: { "atypical_terms": [{ "term": "...", "category": "acronym|proper_noun|organization|place|technical_term|other", "explanation_en": "..." }] }`,
    `Title:\n${refinedTitle}\n\nParagraphs:\n${JSON.stringify(paragraphs)}`
  );
  if (!Array.isArray(output.atypical_terms)) {
    throw new HttpsError("internal", "The atypical terms output was missing.");
  }
  const allowedCategories = new Set<AtypicalTerm["category"]>([
    "acronym",
    "proper_noun",
    "organization",
    "place",
    "technical_term",
    "other",
  ]);
  return output.atypical_terms.slice(0, 30).map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new HttpsError("internal", "An atypical term was invalid.");
    }
    const candidate = item as Record<string, unknown>;
    const category = modelText(candidate.category, "atypical term category " + (index + 1), 40);
    if (!allowedCategories.has(category as AtypicalTerm["category"])) {
      throw new HttpsError("internal", "An atypical term category was invalid.");
    }
    return {
      term: modelText(candidate.term, "atypical term " + (index + 1), 180),
      category: category as AtypicalTerm["category"],
      explanation_en: modelText(candidate.explanation_en, "atypical term explanation " + (index + 1), 420),
    };
  });
};

const buildImagePrompt = async (refinedTitle: string, summary: string[]): Promise<string> => {
  const output = await generateJson(
    "cover prompt creation",
    `You are writing a photorealistic editorial news image prompt.

Requirements:
- Base the image on the article title and the 3 bullet summary.
- Create a realistic documentary-style news photo prompt.
- The image must look photographic, not illustrated, not 3D rendered, and not stylized.
- Use natural lighting, realistic materials, candid composition, and believable human/environment details.
- Avoid text in the image.
- Avoid logos and copyrighted character references.
- Output one strong prompt string.
- Return JSON: { "image_prompt": "..." }`,
    `Title:\n${refinedTitle}\n\nSummary:\n${JSON.stringify(summary)}`
  );
  return modelText(output.image_prompt, "cover image prompt", 2_000);
};

const translateArticleToKorean = async (
  title: string,
  subtitle: string,
  paragraphs: string[],
  summary: string[]
): Promise<KoreanArticle> => {
  const output = await generateJson(
    "Korean translation",
    `You are translating English news-learning content for Korean learners.

Requirements:
- Keep the meaning faithful to the English source and do not add facts.
- Translate the title, subtitle, every paragraph, and all three summary bullets into natural Korean.
- Keep the paragraph count and summary bullet count exactly unchanged.
- Keep named entities and product names in English when that is natural and readable.
- Return JSON: { "title_ko": "...", "subtitle_ko": "...", "paragraphs_ko": ["..."], "summary_ko": ["...", "...", "..."] }`,
    `English title:\n${title}\n\nEnglish subtitle:\n${subtitle}\n\nEnglish paragraphs:\n${JSON.stringify(paragraphs)}\n\nEnglish summary:\n${JSON.stringify(summary)}`,
    6_000
  );
  return {
    title: modelText(output.title_ko, "Korean title", 240),
    subtitle: modelText(output.subtitle_ko, "Korean subtitle", 420),
    paragraphs: modelStringList(output.paragraphs_ko, "Korean paragraphs", paragraphs.length, paragraphs.length, 1_500, paragraphs.length),
    summary: modelStringList(output.summary_ko, "Korean summary", 3, 3, 480, 3),
  };
};

const polishKoreanArticle = async (
  titleEn: string,
  subtitleEn: string,
  paragraphsEn: string[],
  summaryEn: string[],
  draft: KoreanArticle
): Promise<KoreanArticle> => {
  const output = await generateJson(
    "Korean post-editing",
    `You are editing Korean news-learning content for style consistency and term consistency.

Goals:
- Rewrite the Korean title into a natural Korean news headline style.
- Korean news headlines should not end in polite or fully conjugated sentence endings such as "~합니다", "~입니다", "~하고 있습니다", "~되고 있습니다".
- Prefer concise headline endings such as noun phrases or plain dictionary-style endings like "~확대", "~급증", "~부상", "~좁히다", "~늘리다", "~되다" when natural.
- Apply headline style to title_ko only.
- Keep subtitle_ko, paragraphs_ko, and summary_ko in normal natural Korean prose.
- Do not convert paragraphs or summary bullets into headline fragments, noun-only phrases, or overly compressed note style.
- Paragraphs should read like article/body prose.
- Summary bullets should read like concise explanatory sentences for learners, not headlines.
- Keep the meaning faithful to the English source.
- Normalize named entities, product names, and key terms so the same item is written consistently across the title, subtitle, paragraphs, and summary.
- Keep people names, company names, organization names, and product names in English when that is natural and readable in Korean news text.
- Prefer forms like "Anthropic", "OpenAI", "Claude Code", "Ramp", "ChatGPT" instead of transliterating them into Korean when possible.
- Preserve product names as exact English strings when possible.
- Do not create mixed Korean-English hybrids such as "클로드 Code" or "ChatGPT 도구명".
- If a source uses "Claude Code", keep it exactly as "Claude Code".
- If a named entity must be rendered in Korean, choose one form and use it consistently everywhere.
- Keep paragraph count and summary bullet count exactly unchanged.
- Keep the Korean text natural and fluent. Do not add new facts.

Return JSON: { "title_ko": "...", "subtitle_ko": "...", "paragraphs_ko": ["..."], "summary_ko": ["...", "...", "..."] }`,
    `English title:\n${titleEn}\n\nEnglish subtitle:\n${subtitleEn}\n\nEnglish paragraphs:\n${JSON.stringify(paragraphsEn)}\n\nEnglish summary:\n${JSON.stringify(summaryEn)}\n\nCurrent Korean title:\n${draft.title}\n\nCurrent Korean subtitle:\n${draft.subtitle}\n\nCurrent Korean paragraphs:\n${JSON.stringify(draft.paragraphs)}\n\nCurrent Korean summary:\n${JSON.stringify(draft.summary)}`,
    6_000
  );
  return {
    title: modelText(output.title_ko, "polished Korean title", 240),
    subtitle: modelText(output.subtitle_ko, "polished Korean subtitle", 420),
    paragraphs: modelStringList(output.paragraphs_ko, "polished Korean paragraphs", paragraphsEn.length, paragraphsEn.length, 1_500, paragraphsEn.length),
    summary: modelStringList(output.summary_ko, "polished Korean summary", 3, 3, 480, 3),
  };
};

const defaultFigureParagraph = (figureIndex: number, figureCount: number, paragraphCount: number) =>
  Math.max(
    0,
    Math.min(
      paragraphCount - 1,
      Math.round(((figureIndex + 1) * paragraphCount) / (figureCount + 1)) - 1
    )
  );

const articleFiguresFor = (
  imageUrls: string[],
  paragraphCount: number
) =>
  imageUrls.map((url, index) => {
    return {
      kind: "figure",
      display_url: url,
      original_url: url,
      is_hero: false,
      // Figures follow the editor-selected order and are spaced through the
      // article. They are intentionally never sent to an AI model for OCR or
      // visual analysis.
      after_paragraph: defaultFigureParagraph(index, imageUrls.length, paragraphCount),
    };
  });

const generateArticleHeroImage = async (
  articleId: string,
  imagePrompt: string
): Promise<string> => {
  const response = await vertexGenerateContent(GEMINI_IMAGE_MODEL, {
    contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
    generationConfig: {
      candidateCount: 1,
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "3:2",
        imageSize: "1K",
      },
    },
  });
  const generatedImage = response.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data
  )?.inlineData;
  if (!generatedImage?.data) {
    throw new Error("Gemini returned no generated cover image.");
  }

  const bucket = admin.storage().bucket();
  const contentType = generatedImage.mimeType || "image/png";
  const extension = contentType === "image/jpeg" ? "jpg" : "png";
  const imagePath =
    "articles/generated/" + articleId + "-" + Date.now() + "." + extension;
  const downloadToken = randomUUID();
  await bucket.file(imagePath).save(Buffer.from(generatedImage.data, "base64"), {
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    bucket.name +
    "/o/" +
    encodeURIComponent(imagePath) +
    "?alt=media&token=" +
    downloadToken
  );
};

const processorErrorDetails = (error: unknown) => {
  const candidate =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode:
      error instanceof HttpsError
        ? error.code
        : typeof candidate.code === "string"
        ? candidate.code
        : "internal",
    errorStatus: typeof candidate.status === "number" ? candidate.status : undefined,
    processorError: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
  };
};

const updateArticleProgress = async (
  articleRef: admin.firestore.DocumentReference,
  stage: ProcessingStage,
  progress: number
) => {
  await articleRef.set(
    {
      publicationStatus: "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      processing: {
        state: "processing",
        stage,
        progress,
        provider: "vertex-ai",
        model: GEMINI_TEXT_MODEL,
        workflow: "admin-article-ingest-v4",
      },
    },
    { merge: true }
  );
};

/**
 * Creates a visible processing record first, then lets the Firestore trigger do
 * the Gemini work. The raw source body only lives in the short-lived job document.
 */
export const createAdminArticle = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in is required.");
    }

    const user = await db.collection("users").doc(request.auth.uid).get();
    if (user.data()?.account_status !== "admin") {
      throw new HttpsError("permission-denied", "Admin access is required.");
    }

    const data = (request.data || {}) as CreateArticleInput;
    const title = textValue(data.title, "Title", 240);
    const sourceUrl = validHttpUrl(textValue(data.sourceUrl, "Source URL", 2_000), "Source URL");
    const rawBody = textValue(data.body, "Article body", MAX_BODY_LENGTH);
    const body = cleanSourceBody(rawBody);

    if (body.length < 120) {
      throw new HttpsError("invalid-argument", "Article body is too short after cleaning.");
    }

    const imageUrls = normalizeStringList(data.imageUrls, MAX_PHOTOS, 2_000).map((url) =>
      validHttpUrl(url, "Photo URL")
    );
    const articleRef = db.collection("articles").doc();
    const jobRef = db.collection("article_processing_jobs").doc(articleRef.id);
    const batch = db.batch();

    batch.set(articleRef, {
      title: { english: title, korean: "" },
      url: sourceUrl,
      source_url: sourceUrl,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      publicationStatus: "processing",
      processing: {
        state: "queued",
        stage: "queued",
        progress: 5,
        provider: "vertex-ai",
        model: GEMINI_TEXT_MODEL,
        workflow: "admin-article-ingest-v4",
      },
    });

    batch.set(jobRef, {
      articleId: articleRef.id,
      title,
      sourceUrl,
      body,
      imageUrls,
      createdBy: request.auth.uid,
      status: "queued",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    logger.info("Admin article queued", {
      articleId: articleRef.id,
      uid: request.auth.uid,
      bodyLength: body.length,
      photoCount: imageUrls.length,
    });

    return { articleId: articleRef.id };
  }
);

export const processAdminArticle = onDocumentCreated(
  {
    document: "article_processing_jobs/{jobId}",
    region: "asia-northeast3",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (event) => {
    const jobSnapshot = event.data;
    if (!jobSnapshot) return;

    const jobRef = jobSnapshot.ref;
    const job = jobSnapshot.data() as ArticleProcessingJob;
    let claimed = false;

    await db.runTransaction(async (transaction) => {
      const currentJob = await transaction.get(jobRef);
      if (!currentJob.exists || currentJob.data()?.status !== "queued") return;

      transaction.update(jobRef, {
        status: "processing",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      claimed = true;
    });

    if (!claimed) return;

    const articleId = textValue(job.articleId, "Article ID", 240);
    const articleRef = db.collection("articles").doc(articleId);

    try {
      const title = textValue(job.title, "Title", 240);
      const sourceUrl = validHttpUrl(textValue(job.sourceUrl, "Source URL", 2_000), "Source URL");
      const body = textValue(job.body, "Article body", MAX_BODY_LENGTH);
      const imageUrls = normalizeStringList(job.imageUrls, MAX_PHOTOS, 2_000).map((url) =>
        validHttpUrl(url, "Photo URL")
      );
      await updateArticleProgress(articleRef, "refining", 15);
      const refined = await refineArticle(title, sourceUrl, body);

      await updateArticleProgress(articleRef, "summarizing", 30);
      const summaryEn = await summarizeArticle(refined.title, refined.paragraphs);

      await updateArticleProgress(articleRef, "extractingVocabulary", 45);
      const advancedVocabulary = await extractC1Vocabulary(
        refined.title,
        refined.paragraphs
      );

      await updateArticleProgress(articleRef, "draftingDiscussion", 55);
      const discussionTopics = await extractDiscussionTopics(refined.title, summaryEn);
      const discussionTopicIds = discussionTopics.map(() => randomUUID());

      await updateArticleProgress(articleRef, "identifyingTerms", 63);
      const atypicalTerms = await extractAtypicalTerms(refined.title, refined.paragraphs);

      const subtitleEn = summaryEn[0];
      await updateArticleProgress(articleRef, "translating", 70);
      const KoreanDraft = await translateArticleToKorean(
        refined.title,
        subtitleEn,
        refined.paragraphs,
        summaryEn
      );

      await updateArticleProgress(articleRef, "polishingKorean", 78);
      const koreanArticle = await polishKoreanArticle(
        refined.title,
        subtitleEn,
        refined.paragraphs,
        summaryEn,
        KoreanDraft
      );

      if (imageUrls.length) {
        await updateArticleProgress(articleRef, "placingFigures", 84);
      }

      await updateArticleProgress(articleRef, "designingCover", 87);
      const imagePrompt = await buildImagePrompt(refined.title, summaryEn);
      await updateArticleProgress(articleRef, "illustrating", 92);
      const heroImageUrl = await generateArticleHeroImage(articleId, imagePrompt);

      await updateArticleProgress(articleRef, "publishing", 97);
      const figures = articleFiguresFor(
        imageUrls,
        refined.paragraphs.length
      );

      await articleRef.set(
        {
          title: { english: refined.title, korean: koreanArticle.title },
          subtitle: { english: subtitleEn, korean: koreanArticle.subtitle },
          content: {
            english: refined.paragraphs,
            korean: koreanArticle.paragraphs,
          },
          keywords: advancedVocabulary.map((item) => item.term),
          advanced_vocabulary: advancedVocabulary,
          atypical_terms: atypicalTerms,
          pronunciation_keywords: [],
          discussion_topics: discussionTopics,
          discussion_topic_ids: discussionTopicIds,
          summary: { english: summaryEn, korean: koreanArticle.summary },
          url: sourceUrl,
          source_url: sourceUrl,
          image_url: heroImageUrl,
          cover_image: {
            provider: "vertex-ai",
            model: GEMINI_IMAGE_MODEL,
          },
          ...(figures.length ? { figures } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          publicationStatus: "published",
          processing: {
            state: "completed",
            stage: "completed",
            progress: 100,
            provider: "vertex-ai",
            model: GEMINI_TEXT_MODEL,
            workflow: "admin-article-ingest-v4",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

      logger.info("Admin article published", { articleId });
    } catch (error) {
      logger.error("Admin article processing failed", {
        articleId,
        ...processorErrorDetails(error),
      });

      try {
        await articleRef.set(
          {
            publicationStatus: "failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            processing: {
              state: "failed",
              stage: "failed",
              progress: 100,
              provider: "vertex-ai",
              model: GEMINI_TEXT_MODEL,
              workflow: "admin-article-ingest-v4",
              error: (() => {
                const details = processorErrorDetails(error);
                return {
                  errorName: details.errorName,
                  errorCode: details.errorCode,
                  errorStatus: details.errorStatus,
                };
              })(),
            },
          },
          { merge: true }
        );
      } catch (updateError) {
        logger.error("Unable to mark the admin article as failed", {
          articleId,
          message: updateError instanceof Error ? updateError.message : String(updateError),
        });
      }
    } finally {
      try {
        await jobRef.delete();
      } catch (deleteError) {
        logger.error("Unable to clear article processing job", {
          articleId,
          message: deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      }
    }
  }
);
