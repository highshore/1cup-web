// Server-only: what each day's post is about, the material it is written from, and the
// Gemini call that drafts it.
//
// A weekday "pillar" fixes the kind of post (debate question, expression, vocabulary,
// quiz, meetup invite) so the feed has a rhythm, while the words come fresh every day
// from the newest articles, that day's Daily lesson and the next meetup. The model is
// told to use only facts in that material.
import { admin } from "../../../supabase/server";
import {
  CAROUSEL_CAPTION_LIMIT,
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_MIN_SLIDES,
  type CarouselContent,
  type CardSlide,
  NARRATION_LINE_LIMIT,
  REEL_MAX_SLIDES,
  type ReelContent,
  type SocialPostFormat,
  type SocialChannel,
  THREAD_MAX_REPLIES,
  THREAD_REPLY_LIMIT,
  THREAD_TEXT_LIMIT,
  type ThreadContent,
} from "../types";

const MODEL = process.env.SOCIAL_DRAFT_MODEL || "gemini-3.7-flash";

export interface Pillar {
  key: string;
  label: string; // Korean, shown in the admin
  brief: string; // instruction for the model
}

const P = {
  debate: {
    key: "debate",
    label: "토론 질문",
    brief:
      "Pick one discussion question from the newest article and turn it into an opinion prompt that invites people to reply in Korean or English. Give just enough context from the article summary.",
  },
  expression: {
    key: "expression",
    label: "오늘의 표현",
    brief:
      "Teach today's Daily lesson expression: meaning, nuance and one or two natural example sentences from the lesson.",
  },
  vocabulary: {
    key: "vocabulary",
    label: "고급 어휘",
    brief:
      "Teach 3 to 5 advanced words from the newest article's vocabulary list with short Korean meanings and an example in the article's context.",
  },
  quiz: {
    key: "quiz",
    label: "영어 퀴즈",
    brief:
      "Make a short quiz from today's Daily lesson quiz or the article vocabulary. Ask first; reveal the answer and explanation later (in a reply or a later slide).",
  },
  summary: {
    key: "summary",
    label: "아티클 요약",
    brief:
      "Summarize the newest article in Korean in a few clear points, include one key English sentence or term, and end with the discussion question for this week's meetup.",
  },
  insight: {
    key: "insight",
    label: "고객 인사이트",
    brief: `Benefit-led marketing post built on the newest article. Structure:
1) HOOK — open with a pain-point line that calls out one specific reader and situation, in the style of these examples (write a new one each time; never copy them verbatim):
   - 영어 회의에서 "I think..."만 외치는 당신에게
   - 해외 클라이언트 콜, 할 말은 있는데 문장이 안 나온다면
   - 스몰토크 다음에 할 말이 없어 웃기만 했던 적 있나요?
   - 토익 900인데 왜 회의에선 한마디도 못 할까
   - "Good point"로 대화를 끝내버리는 사람들의 공통점
   Pick the reader from: people in English meetings at work, client/partner calls, foreign-company interviews, MBA/study-abroad prep, people whose test scores are high but who freeze when speaking, people stuck at small talk.
2) WHY — name the real gap in one or two lines (opinions without structure, no practice defending a view, only textbook phrases).
3) UPGRADE — show concrete before → after English the reader can use tomorrow, using the article's topic and its vocabulary as the example context (e.g. "I think AI is dangerous" → "The way I see it, the bigger risk is..."). 2 or 3 upgrades.
4) WHAT YOU GET — what changes after joining 영어 한잔, stated only with facts from the brand description (interpreter-led small tables, two current articles discussed for two hours each Sunday, being asked to defend your view, One Cup Daily expressions). No testimonials, success numbers, or promises of results.
5) CTA — invite them to this Sunday's meetup.`,
  },
  invite: {
    key: "invite",
    label: "모임 안내",
    brief:
      "Invite people to the next meetup: when and where it is, this week's article topic, and how the meetup runs (small tables, interpreter-led, two articles in two hours). Only state details that appear in the material.",
  },
} satisfies Record<string, Pillar>;

// Sunday = 0. Threads leans on conversation; Instagram on saveable explainers.
const WEEKLY: Record<SocialChannel, Pillar[]> = {
  threads: [P.insight, P.debate, P.expression, P.insight, P.quiz, P.invite, P.debate],
  instagram: [P.insight, P.summary, P.expression, P.vocabulary, P.insight, P.invite, P.summary],
};

export const PILLARS: Record<string, Pillar> = P;

// Instagram alternates card news with reels: the expression of the day (heard aloud) and
// one benefit-led insight post become reels; everything else stays a carousel.
const INSTAGRAM_FORMAT: SocialPostFormat[] = ["carousel", "carousel", "reel", "carousel", "reel", "carousel", "carousel"];

export const formatFor = (channel: SocialChannel, postDate: string, override?: string): SocialPostFormat => {
  if (channel === "threads") return "thread";
  if (override === "carousel" || override === "reel") return override;
  return INSTAGRAM_FORMAT[weekdayOf(postDate)];
};

export const weekdayOf = (postDate: string) => new Date(`${postDate}T12:00:00Z`).getUTCDay();
// An admin can ask for a different theme for a day; otherwise the weekday decides.
export const pillarFor = (channel: SocialChannel, postDate: string, override?: string): Pillar =>
  (override && PILLARS[override]) || WEEKLY[channel][weekdayOf(postDate)];

// ------------------------------------------------------------------ material
type Json = Record<string, unknown>;

const clip = (value: unknown, max: number) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

export interface Material {
  articles: Json[];
  lesson: Json | null;
  meetup: Json | null;
}

export async function loadMaterial(postDate: string): Promise<Material> {
  const db = admin();
  const [articles, lesson, meetup] = await Promise.all([
    db
      .from("articles")
      .select("id, title, subtitle, summary, discussion_topics, advanced_vocabulary, keywords, created_at")
      .eq("publication_status", "published")
      .order("created_at", { ascending: false })
      .limit(2),
    db
      .from("daily_lessons")
      .select("id, track, expression, meaning, nuance, examples, quiz, similar_expressions")
      .eq("publish_on", postDate)
      .eq("status", "ready")
      .order("track", { ascending: true }) // "advanced" before "basic"
      .limit(1)
      .maybeSingle(),
    db
      .from("meetups")
      .select("id, title, date_time, location_name, max_participants, current_participants")
      .is("cancelled_at", null)
      .gte("date_time", new Date().toISOString())
      .order("date_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    // Trim long fields so the prompt stays small; the model needs gist, not full text.
    articles: (articles.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: clip(row.subtitle, 400),
      summary: clip(row.summary, 1500),
      discussion_topics: clip(row.discussion_topics, 1200),
      advanced_vocabulary: clip(row.advanced_vocabulary, 1500),
      keywords: clip(row.keywords, 300),
    })),
    lesson: lesson.data
      ? {
          id: lesson.data.id,
          expression: lesson.data.expression,
          meaning: lesson.data.meaning,
          nuance: clip(lesson.data.nuance, 500),
          examples: clip(lesson.data.examples, 1200),
          quiz: clip(lesson.data.quiz, 800),
          similar_expressions: lesson.data.similar_expressions,
        }
      : null,
    meetup: meetup.data
      ? {
          title: meetup.data.title,
          starts_at_kst: new Intl.DateTimeFormat("ko-KR", {
            timeZone: "Asia/Seoul",
            dateStyle: "full",
            timeStyle: "short",
          }).format(new Date(meetup.data.date_time)),
          location: meetup.data.location_name,
          seats_left:
            typeof meetup.data.max_participants === "number" && typeof meetup.data.current_participants === "number"
              ? Math.max(0, meetup.data.max_participants - meetup.data.current_participants)
              : null,
        }
      : null,
  };
}

export const materialSource = (material: Material, pillar: Pillar) => ({
  pillar: pillar.key,
  articleIds: material.articles.map((article) => article.id),
  lessonId: material.lesson?.id ?? null,
});

// --------------------------------------------------------------------- draft
const BRAND = `You write social posts for "영어 한잔 (1 Cup English)", a Seoul English discussion community: small-table meetups led by a professional interpreter, two WSJ/FT-style articles discussed over two hours every Sunday, plus "One Cup Daily", a daily English expression lesson sent by KakaoTalk. Audience: Korean office workers and students in their 20s and 30s who want real, intelligent English conversation. Voice: warm, smart, a little playful; Korean first with English where it teaches. Lead with a hook that names a real situation the reader struggles with in English (meetings, calls, interviews, small talk) whenever the theme allows, and make the payoff concrete: what they will be able to say afterwards. Never invent facts, testimonials, statistics, prices, numbers, dates, people or guarantees beyond the material. No URLs anywhere (the system adds tracking links). No more than one emoji per paragraph.`;

const REEL_FORMAT = `Return JSON {"caption": string, "slides": [{"eyebrow": string, "title": string, "body": string, "highlight": string}], "narration": string[]} for a 20 to 45 second Instagram Reel. Make 4 to ${REEL_MAX_SLIDES} slides shown one after another, each on screen while its narration line is read aloud; "narration" has exactly one line per slide. Slide 1 is the hook: an eyebrow label and a Korean title (max 32 characters) that stops the scroll. Slide titles max 30 characters, body max 90 characters (keep frames uncluttered), "highlight" an English sentence or term (max 90 characters) or "". Each narration line (max ${NARRATION_LINE_LIMIT} characters) is natural spoken Korean that a narrator reads in about 3 to 7 seconds; include the English expression itself where it teaches, written plainly so text-to-speech pronounces it well (no emoji, no hashtags, no brackets). The last slide and line invite people to the Sunday meetup and say the link is in the profile. "caption" (max ${CAROUSEL_CAPTION_LIMIT} characters) opens with a strong first line, recaps the reel, says the link is in the profile, and ends with 3 to 5 relevant hashtags.`;

const FORMAT: Record<SocialChannel, string> = {
  threads: `Return JSON {"text": string, "replies": string[]} for a Threads thread. "text" (max ${THREAD_TEXT_LIMIT} characters) is the hook: a question or surprising point that makes people reply. "replies" (1 to 3 items, each max ${THREAD_REPLY_LIMIT} characters) continue it: the explanation, the answer, examples. Use at most one topic hashtag in total, placed in "text".`,
  instagram: `Return JSON {"caption": string, "slides": [{"eyebrow": string, "title": string, "body": string, "highlight": string}]} for an Instagram card-news carousel. Make ${CAROUSEL_MIN_SLIDES + 2} to ${CAROUSEL_MAX_SLIDES - 1} slides. Slide 1 is the cover: a short eyebrow label and a punchy Korean title (max 32 characters; for benefit-led posts this is the pain-point hook), body as a one-line teaser. Middle slides teach one point each: title max 30 characters, body max 120 characters, "highlight" an English sentence or term (max 90 characters) or "". The last slide invites people to the Sunday meetup and says the link is in the profile. "caption" (max ${CAROUSEL_CAPTION_LIMIT} characters) opens with a strong first line, recaps the post, says the link is in the profile, and ends with 3 to 5 relevant hashtags.`,
};

async function callGemini(prompt: string): Promise<Json> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: BRAND }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8, maxOutputTokens: 6000 },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(`Draft model failed (${response.status}): ${payload.error?.message ?? "request failed"}`);
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Draft model returned nothing.");
  try {
    return JSON.parse(text) as Json;
  } catch {
    throw new Error("Draft model returned invalid JSON.");
  }
}

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export const normalizeThread = (raw: Json): ThreadContent => {
  const text = str(raw.text, THREAD_TEXT_LIMIT);
  if (!text) throw new Error("Thread text is empty.");
  const replies = (Array.isArray(raw.replies) ? raw.replies : [])
    .map((reply) => str(reply, THREAD_REPLY_LIMIT))
    .filter(Boolean)
    .slice(0, THREAD_MAX_REPLIES);
  return { text, replies };
};

export const normalizeReel = (raw: Json): ReelContent => {
  const carousel = normalizeCarousel({ ...raw, slides: Array.isArray(raw.slides) ? raw.slides.slice(0, REEL_MAX_SLIDES) : [] });
  const lines = Array.isArray(raw.narration) ? raw.narration : [];
  // One line per slide; a missing line leaves that slide silent rather than shifting the rest.
  const narration = carousel.slides.map((_, index) => str(lines[index], NARRATION_LINE_LIMIT));
  if (narration.every((line) => !line)) throw new Error("The reel has no narration.");
  return { ...carousel, narration };
};

export const normalizeCarousel = (raw: Json): CarouselContent => {
  const slides: CardSlide[] = (Array.isArray(raw.slides) ? raw.slides : [])
    .map((slide) => {
      const value = (slide ?? {}) as Json;
      return {
        eyebrow: str(value.eyebrow, 30),
        title: str(value.title, 60),
        body: str(value.body, 220),
        highlight: str(value.highlight, 140),
      };
    })
    .filter((slide) => slide.title)
    .slice(0, CAROUSEL_MAX_SLIDES);
  if (slides.length < CAROUSEL_MIN_SLIDES) throw new Error("The carousel needs at least three slides.");
  const caption = str(raw.caption, CAROUSEL_CAPTION_LIMIT);
  if (!caption) throw new Error("Instagram caption is empty.");
  return { caption, slides };
};

export async function draftPost(
  channel: SocialChannel,
  postDate: string,
  pillar: Pillar,
  material: Material,
  recentPosts: string[],
  format: SocialPostFormat = channel === "threads" ? "thread" : "carousel",
): Promise<ThreadContent | CarouselContent | ReelContent> {
  const prompt = [
    `Post date (KST): ${postDate}. Theme: ${pillar.label} — ${pillar.brief}`,
    format === "reel" ? REEL_FORMAT : FORMAT[channel],
    recentPosts.length
      ? `Do not repeat these recent posts' angles or wording:\n${recentPosts.map((post) => `- ${clip(post, 160)}`).join("\n")}`
      : "",
    `Material (the only source of facts):\n${JSON.stringify(material)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callGemini(prompt);
  if (channel === "threads") return normalizeThread(raw);
  return format === "reel" ? normalizeReel(raw) : normalizeCarousel(raw);
}
