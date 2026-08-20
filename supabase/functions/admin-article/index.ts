// admin-article — port of functions/src/createAdminArticle.ts.
//
// The Cloud Function split the work in two: a callable enqueued the article, and a
// Firestore onCreate trigger ran the Gemini pipeline. The Supabase port persists the
// source in a server-only queue and a private pg_net/pg_cron worker invokes process-next.
// This retains the quick browser response without tying article processing to the lifetime
// of a single Edge Function request.
//
// Three seams differ from the original and nothing else does; the Gemini prompts and the
// refine → summarize → topics → vocabulary → translate → polish → cover-image sequence
// are carried over verbatim:
//   * Vertex AI auth. Cloud Functions get application default credentials for free; here
//     a service-account key (GCP_SERVICE_ACCOUNT_JSON) is signed into a JWT and exchanged
//     for an access token, cached until just before it expires.
//   * The generated cover image goes to the Supabase `assets` bucket rather than Firebase
//     Storage. Existing article images stay where they are — only new ones land here.
//   * Progress writes go to public.articles / public.article_processing_jobs.
import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid } from "../_shared/db.ts";

const MAX_BODY_LENGTH = 30_000;
const MAX_PHOTOS = 6;
const VERTEX_LOCATION = "global";
const GEMINI_TEXT_MODEL = "gemini-3.6-flash";
const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const GOOGLE_CLOUD_PROJECT = Deno.env.get("GOOGLE_CLOUD_PROJECT") || "one-cup-eng";
const GENERATED_IMAGE_BUCKET = "assets";

// ------------------------------------------------------- Vertex AI access token
// Deno has no metadata server, so mint the token from a service-account key the way
// google-auth-library would: sign a JWT with the key and swap it at the token endpoint.
let cachedToken: { value: string; expiresAt: number } | null = null;

const base64url = (input: ArrayBuffer | string): string => {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const pemToPkcs8 = (pem: string): ArrayBuffer => {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
};

const vertexAccessToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Vertex AI credentials are unavailable.");
  const key = JSON.parse(raw) as { client_email: string; private_key: string };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned =
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    base64url(JSON.stringify(claim));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(key.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );
  const assertion = unsigned + "." + base64url(signature);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error("Vertex AI token exchange failed: " + response.status);
  }
  const token = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  return cachedToken.value;
};

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
  article_id?: unknown;
  title?: unknown;
  source_url?: unknown;
  source_body?: unknown;
  image_urls?: unknown;
  attempt_count?: unknown;
};

const textValue = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string") {
    throw new Error(field + " is required.");
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new Error(field + " is invalid.");
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
    throw new Error(field + " must be a valid URL.");
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
    throw new Error("The " + field + " output was missing.");
  }
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > maxLength) {
    throw new Error("The " + field + " output was invalid.");
  }
  return text;
};

const modelMultilineText = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string") {
    throw new Error("The " + field + " output was missing.");
  }
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (!text || text.length > maxLength) {
    throw new Error("The " + field + " output was invalid.");
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
    throw new Error("The " + field + " output was missing.");
  }
  const items = value.map((item, index) => modelText(item, field + " item " + (index + 1), itemMaxLength));
  if (
    items.length < minimum ||
    items.length > maximum ||
    (exactCount !== undefined && items.length !== exactCount)
  ) {
    throw new Error("The " + field + " output had an invalid item count.");
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

  throw new Error("The " + step + " step returned invalid JSON.");
};

const splitRefinedParagraphs = (article: string): string[] => {
  const paragraphs = article
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length < 3 || paragraphs.length > 12) {
    throw new Error("The refined article must contain between 3 and 12 coherent paragraphs."
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
  const accessToken = await vertexAccessToken();
  if (!accessToken) {
    throw new Error("Vertex AI credentials are unavailable.");
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
    throw new Error("The " + step + " step returned no content.");
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
    throw new Error("The advanced vocabulary output must contain 5 to 12 items.");
  }
  return output.c1_vocab.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("An advanced vocabulary item was invalid.");
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
    if (validationError) throw new Error(validationError);
    return topics;
  } catch (error) {
    const feedback = error instanceof Error ? error.message.slice(0, 300) : "Return eight valid discussion prompts.";
    const retry = await createTopics(feedback);
    const topics = modelStringList(retry.discussion_topics, "discussion topics", 8, 8, 420, 8);
    const validationError = validateTopics(topics);
    if (validationError) throw new Error(validationError);
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
    throw new Error("The atypical terms output was missing.");
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
      throw new Error("An atypical term was invalid.");
    }
    const candidate = item as Record<string, unknown>;
    const category = modelText(candidate.category, "atypical term category " + (index + 1), 40);
    if (!allowedCategories.has(category as AtypicalTerm["category"])) {
      throw new Error("An atypical term category was invalid.");
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
  refinedTitle: string,
  summary: string[],
): Promise<string> => {
  const imagePrompt = await buildImagePrompt(refinedTitle, summary);
  const response = await vertexGenerateContent(GEMINI_IMAGE_MODEL, {
    contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });

  const generatedImage = response.candidates?.[0]?.content?.parts?.find(
    (part) => part.inlineData?.data,
  )?.inlineData;
  if (!generatedImage?.data) {
    throw new Error("Gemini returned no generated cover image.");
  }

  const contentType = generatedImage.mimeType || "image/png";
  const extension = contentType === "image/jpeg" ? "jpg" : "png";
  const path = `articles/generated/${articleId}-${Date.now()}.${extension}`;

  const binary = atob(generatedImage.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const db = admin();
  const { error } = await db.storage
    .from(GENERATED_IMAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error("Unable to store the generated cover image: " + error.message);

  const {
    data: { publicUrl },
  } = db.storage.from(GENERATED_IMAGE_BUCKET).getPublicUrl(path);
  return publicUrl;
};

const processorErrorDetails = (error: unknown) => {
  const candidate =
    error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode:
      error instanceof Error
        ? error.code
        : typeof candidate.code === "string"
        ? candidate.code
        : "internal",
    errorStatus: typeof candidate.status === "number" ? candidate.status : undefined,
    processorError: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
  };
};


const updateArticleProgress = async (
  articleId: string,
  stage: ProcessingStage,
  progress: number,
) => {
  const db = admin();
  const processing = {
    state: "processing",
    stage,
    progress,
    provider: "vertex-ai",
    model: GEMINI_TEXT_MODEL,
    workflow: "admin-article-ingest-v4",
  };
  const now = new Date().toISOString();
  const [articleResult, jobResult] = await Promise.all([
    db
      .from("articles")
      .update({ publication_status: "processing", processing, updated_at: now })
      .eq("id", articleId),
    db
      .from("article_processing_jobs")
      .update({ status: "processing", stage, progress, updated_at: now })
      .eq("article_id", articleId),
  ]);
  if (articleResult.error) throw new Error(articleResult.error.message);
  if (jobResult.error) throw new Error(jobResult.error.message);
};

const markArticleFailed = async (articleId: string, error: unknown) => {
  const db = admin();
  const message = error instanceof Error ? error.message : "Unknown error";
  const failedAt = new Date().toISOString();
  const [articleResult, jobResult] = await Promise.all([
    db
      .from("articles")
      .update({
        publication_status: "failed",
        processing: { state: "failed", stage: "failed", progress: 100 },
        updated_at: failedAt,
      })
      .eq("id", articleId),
    db
      .from("article_processing_jobs")
      .update({
        status: "failed",
        stage: "failed",
        progress: 100,
        error: message.slice(0, 500),
        updated_at: failedAt,
      })
      .eq("article_id", articleId),
  ]);

  if (articleResult.error) console.error("Unable to mark article as failed:", articleResult.error.message);
  if (jobResult.error) console.error("Unable to mark article job as failed:", jobResult.error.message);
};

// The Gemini pipeline, previously the onDocumentCreated trigger.
const processArticle = async (articleId: string, input: {
  title: string;
  sourceUrl: string;
  body: string;
  imageUrls: string[];
}) => {
  const db = admin();
  try {
    await updateArticleProgress(articleId, "refining", 15);
    const refined = await refineArticle(input.title, input.sourceUrl, input.body);
    const paragraphs = splitRefinedParagraphs(refined.article);

    await updateArticleProgress(articleId, "summarizing", 35);
    const summary = await summarizeArticle(refined.title, paragraphs);

    await updateArticleProgress(articleId, "extractingVocabulary", 45);
    const advancedVocabulary = await extractC1Vocabulary(refined.title, paragraphs);

    await updateArticleProgress(articleId, "draftingDiscussion", 55);
    const topics = await extractDiscussionTopics(refined.title, paragraphs);

    await updateArticleProgress(articleId, "identifyingTerms", 63);
    const terms = await extractAtypicalTerms(refined.title, paragraphs);

    await updateArticleProgress(articleId, "translating", 75);
    const subtitle = summary[0];
    const korean = await translateArticleToKorean(refined.title, subtitle, paragraphs, summary);

    await updateArticleProgress(articleId, "polishingKorean", 82);
    const polished = await polishKoreanArticle(refined.title, subtitle, paragraphs, summary, korean);

    if (input.imageUrls.length) await updateArticleProgress(articleId, "placingFigures", 86);
    const figures = articleFiguresFor(input.imageUrls, paragraphs.length);

    await updateArticleProgress(articleId, "illustrating", 92);
    // Pasted figures remain inline. Every completed article receives a separate,
    // generated cover image so the article contract is consistent.
    const imageUrl = await generateArticleHeroImage(articleId, refined.title, summary);

    const completedAt = new Date().toISOString();
    const articleResult = await db
      .from("articles")
      .update({
        title: { english: refined.title, korean: polished.title },
        subtitle: { english: subtitle, korean: polished.subtitle },
        content: { english: paragraphs, korean: polished.paragraphs },
        keywords: advancedVocabulary.map((item) => item.term),
        advanced_vocabulary: advancedVocabulary,
        atypical_terms: terms,
        discussion_topics: topics,
        discussion_topic_ids: topics.map(() => crypto.randomUUID()),
        pronunciation_keywords: [],
        summary: { english: summary, korean: polished.summary },
        url: input.sourceUrl,
        source_url: input.sourceUrl,
        image_url: imageUrl,
        cover_image: { provider: "vertex-ai", model: GEMINI_IMAGE_MODEL },
        figures,
        publication_status: "published",
        processing: {
          state: "completed",
          stage: "completed",
          progress: 100,
          provider: "vertex-ai",
          model: GEMINI_TEXT_MODEL,
          workflow: "admin-article-ingest-v4",
        },
        updated_at: completedAt,
      })
      .eq("id", articleId);
    if (articleResult.error) throw new Error(articleResult.error.message);

    const jobResult = await db
      .from("article_processing_jobs")
      .update({
        status: "completed",
        stage: "completed",
        progress: 100,
        updated_at: completedAt,
      })
      .eq("article_id", articleId);
    if (jobResult.error) throw new Error(jobResult.error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Admin article processing failed:", message);
    await markArticleFailed(articleId, error);
  }
};

const validSchedulerRequest = async (req: Request, db: ReturnType<typeof admin>) => {
  const { data: schedulerSecret, error } = await db.rpc("article_processing_scheduler_secret");
  return (
    !error &&
    typeof schedulerSecret === "string" &&
    schedulerSecret.length > 0 &&
    req.headers.get("x-article-processing-scheduler-secret") === schedulerSecret
  );
};

const processNextArticle = async () => {
  const db = admin();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 20 * 60 * 1000).toISOString();

  // A platform interruption can leave a job marked as processing. Requeue only jobs
  // with no progress heartbeat for 20 minutes; normal processing updates updated_at
  // after every stage.
  const { error: requeueError } = await db
    .from("article_processing_jobs")
    .update({ status: "queued", stage: "queued", progress: 5, updated_at: now.toISOString() })
    .eq("status", "processing")
    .lt("updated_at", staleBefore);
  if (requeueError) throw new Error(requeueError.message);

  const { data: queued, error: queuedError } = await db
    .from("article_processing_jobs")
    .select("article_id, title, source_url, source_body, image_urls, attempt_count")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (queuedError) throw new Error(queuedError.message);
  if (!queued) return null;

  const queuedJob = queued as ArticleProcessingJob;
  const attemptCount =
    typeof queuedJob.attempt_count === "number" && Number.isFinite(queuedJob.attempt_count)
      ? queuedJob.attempt_count
      : 0;
  const { data: claimed, error: claimError } = await db
    .from("article_processing_jobs")
    .update({
      status: "processing",
      stage: "queued",
      progress: 5,
      attempt_count: attemptCount + 1,
      updated_at: now.toISOString(),
    })
    .eq("article_id", queuedJob.article_id as string)
    .eq("status", "queued")
    .select("article_id, title, source_url, source_body, image_urls")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return null;

  const claimedJob = claimed as ArticleProcessingJob;
  const articleId = textValue(claimedJob.article_id, "Article ID", 240);
  try {
    const input = {
      title: textValue(claimedJob.title, "Title", 200),
      sourceUrl: validHttpUrl(textValue(claimedJob.source_url, "Source URL", 2_000), "Source URL"),
      body: textValue(claimedJob.source_body, "Article body", MAX_BODY_LENGTH),
      imageUrls: normalizeStringList(claimedJob.image_urls, MAX_PHOTOS, 2_000).map((url) =>
        validHttpUrl(url, "Photo URL"),
      ),
    };
    await processArticle(articleId, input);
  } catch (error) {
    console.error("Unable to prepare queued article:", error);
    await markArticleFailed(articleId, error);
  } finally {
    // The article row carries all user-visible status. Remove the short-lived job so
    // its copied source text is never exposed or retained after processing.
    const { error } = await db.from("article_processing_jobs").delete().eq("article_id", articleId);
    if (error) console.error("Unable to clear article processing job:", error.message);
  }

  return articleId;
};

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof data.action === "string" ? data.action : "create";
  const db = admin();

  if (action === "process-next") {
    if (!(await validSchedulerRequest(req, db))) {
      return json(req, { error: "permission-denied" }, 403);
    }
    const work = processNextArticle().catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Unable to process the article queue:", message);
    });
    // The scheduler only needs to dispatch a durable queued job, not wait for the
    // Vertex pipeline. The job's progress heartbeat makes an interrupted worker eligible
    // for a later retry, while waitUntil keeps a healthy worker running after this fast
    // response has been returned.
    const runtime = (globalThis as {
      EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
    }).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(work);
      return json(req, { accepted: true });
    }

    await work;
    return json(req, { accepted: true });
  }

  if (action !== "create") {
    return json(req, { error: "invalid-argument", message: "Unknown action." }, 400);
  }

  const uid = await callerUid(req);
  if (!uid) return json(req, { error: "unauthenticated", message: "Sign in is required." }, 401);

  const { data: user } = await db
    .from("users")
    .select("account_status")
    .eq("uid", uid)
    .maybeSingle();
  if (user?.account_status !== "admin") {
    return json(req, { error: "permission-denied", message: "Admin access is required." }, 403);
  }

  try {
    const title = requiredText(data.title, "Title", 200);
    const sourceUrl = validHttpUrl(data.sourceUrl, "Source URL");
    const body = requiredText(data.body, "Article body", MAX_BODY_LENGTH);
    const imageUrls = normalizeStringList(data.imageUrls, MAX_PHOTOS, 2_000).map((url) =>
      validHttpUrl(url, "Photo URL"),
    );

    // Visible placeholder first, exactly as the callable did, so the admin list shows the
    // article as processing straight away.
    const articleId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error: articleError } = await db.from("articles").insert({
      id: articleId,
      title: { english: title, korean: "" },
      url: sourceUrl,
      source_url: sourceUrl,
      timestamp: now,
      created_at: now,
      updated_at: now,
      created_by: uid,
      publication_status: "processing",
      processing: {
        state: "queued",
        stage: "queued",
        progress: 5,
        provider: "vertex-ai",
        model: GEMINI_TEXT_MODEL,
        workflow: "admin-article-ingest-v4",
      },
    });
    if (articleError) throw new Error(articleError.message);

    const { error: jobError } = await db.from("article_processing_jobs").insert({
      article_id: articleId,
      title,
      source_url: sourceUrl,
      source_body: body,
      image_urls: imageUrls,
      status: "queued",
      stage: "queued",
      progress: 5,
      provider: "vertex-ai",
      model: GEMINI_TEXT_MODEL,
      workflow: "admin-article-ingest-v4",
      created_by: uid,
    });
    if (jobError) throw new Error(jobError.message);

    return json(req, { articleId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json(req, { error: "invalid-argument", message }, 400);
  }
});
