// Server-only: what each day's post is about, the material it is written from, and the
// Gemini call that drafts it.
//
// Every daily post sells One Cup Daily (the KakaoTalk morning expression): the goal is
// to get people to take the free first day. A weekday "pillar" fixes the kind of post
// (Daily expression, expression comparison, workplace scene, quiz, benefit-led insight,
// news expression, weekly recap) so the feed has a rhythm, while the words come fresh
// every day from Daily's own lessons and the newest article. The model is told to use
// only facts in that material and in the Daily product facts below.
import { admin } from "../../../supabase/server";
import { DAILY_PRICE_PER_DAY_KRW, DAILY_TRACK_LABEL, type DailyTrack } from "../../daily/constants";
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
  expression: {
    key: "expression",
    label: "오늘의 표현",
    brief:
      "Teach today's Daily expression as a free taste of the product: what it means, the nuance (when a native speaker at work uses it), and one natural example from the lesson. Make the reader feel they could use it in a meeting or email tomorrow, then say a new expression like this arrives on KakaoTalk every weekday morning.",
  },
  compare: {
    key: "compare",
    label: "표현 비교",
    brief:
      "Compare today's Daily expression with a plainer or commonly confused alternative (use the lesson's similar_expressions and nuance): 'A vs B, what's the difference?'. Show when each fits, with one example each. Close by saying Daily explains this kind of nuance every morning.",
  },
  scene: {
    key: "scene",
    label: "실무 장면",
    brief:
      "Turn the Daily lesson's dialogue or examples into a short workplace scene (meeting, 1:1, email, call): set the situation in Korean, show the English line that saves the moment, then explain why it works. Close with Daily's promise: one expression a day you can use at work right away.",
  },
  quiz: {
    key: "quiz",
    label: "영어 퀴즈",
    brief:
      "Make a short quiz from today's Daily lesson quiz (or its expression): ask first, reveal the answer and a one-line explanation later (in a reply or a later slide). Close by mentioning that Daily ends every lesson with a one-minute quiz.",
  },
  insight: {
    key: "insight",
    label: "고객 인사이트",
    brief: `Benefit-led post that sells One Cup Daily. Structure:
1) HOOK — open with a pain-point line that calls out one specific reader and situation, in the style of these examples (write a new one each time; never copy them verbatim):
   - 영어 회의에서 "I think..."만 외치는 당신에게
   - 회의 끝나고 '아, 그 말 할걸' 하는 사람들
   - 영어 메일 한 줄에 10분 쓰고 있다면
   - 토익 900인데 왜 회의에선 한마디도 못 할까
   - 외국계 공고, 영어 면접 때문에 망설이고 있다면
   Pick the reader from: office workers in English meetings, people writing English emails, client or partner calls, foreign-company job seekers, people whose test scores are high but who freeze when speaking.
2) WHY — name the real gap in one or two lines (no ready-made phrases for real work situations; textbook English).
3) UPGRADE — show 2 or 3 concrete before → after lines using this week's Daily expressions from the material.
4) WHAT DAILY GIVES — only facts from the Daily product description (interpreter-picked business expression every weekday at 8 AM on KakaoTalk, meaning + nuance + examples + dialogue + native audio + one-minute quiz, Saturday review, two levels, no app). No testimonials, success numbers, or promises of results.
5) CTA — the first day is free; the link is in the profile.`,
  },
  news: {
    key: "news",
    label: "뉴스 속 표현",
    brief:
      "Pick one or two business-useful expressions from the newest article's vocabulary, explain them with the article's context in a sentence or two, and show how to reuse them at work. Frame it as 'expressions like this, picked by an interpreter, come to KakaoTalk every morning with One Cup Daily'.",
  },
  weekly: {
    key: "weekly",
    label: "주간 복습",
    brief:
      "Recap this week's Daily expressions (from the material's week list) as a quick review: each expression with its short meaning, maybe one quiz-style prompt. Mention that Daily sends a Saturday review like this to subscribers, and that starting now means a new expression on Monday morning.",
  },
} satisfies Record<string, Pillar>;

// Sunday = 0. Every theme promotes One Cup Daily; Threads leans on conversation and
// quizzes, Instagram on saveable explainers.
const WEEKLY: Record<SocialChannel, Pillar[]> = {
  threads: [P.insight, P.expression, P.quiz, P.compare, P.insight, P.scene, P.weekly],
  instagram: [P.insight, P.compare, P.expression, P.news, P.insight, P.scene, P.weekly],
};

export const PILLARS: Record<string, Pillar> = P;

// Instagram alternates card news with reels: the expression of the day (heard aloud, on
// Tuesday) and Thursday's benefit-led insight post become reels; the rest are carousels.
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
  /** The lesson Daily subscribers get on the post date (or the latest one before it). */
  lesson: Json | null;
  /** This week's lessons, for recaps and before → after examples. */
  week: Json[];
  articles: Json[];
}

const DAY_MS = 86_400_000;
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export async function loadMaterial(postDate: string): Promise<Material> {
  const db = admin();
  const weekStart = isoDate(new Date(new Date(`${postDate}T00:00:00Z`).getTime() - 6 * DAY_MS));
  const [lessons, articles] = await Promise.all([
    db
      .from("daily_lessons")
      .select("id, track, publish_on, field, expression, meaning, nuance, examples, dialogue, quiz, similar_expressions")
      .eq("status", "ready")
      .lte("publish_on", postDate)
      .gte("publish_on", isoDate(new Date(new Date(`${postDate}T00:00:00Z`).getTime() - 13 * DAY_MS)))
      .order("publish_on", { ascending: false })
      .limit(20),
    db
      .from("articles")
      .select("id, title, summary, advanced_vocabulary, keywords, created_at")
      .eq("publication_status", "published")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const rows = (lessons.data ?? []) as Array<Record<string, unknown>>;
  // Weekends have no lesson; fall back to the latest weekday's. Alternate the level by
  // date so both 초·중급 and 고급 subscribers see themselves in the feed.
  const latestDate = rows[0]?.publish_on;
  const sameDay = rows.filter((row) => row.publish_on === latestDate);
  const preferred: DailyTrack = new Date(`${postDate}T12:00:00Z`).getUTCDate() % 2 ? "advanced" : "basic";
  const today = sameDay.find((row) => row.track === preferred) ?? sameDay[0] ?? null;
  const track = (row: Record<string, unknown>) =>
    DAILY_TRACK_LABEL[(row.track as DailyTrack) ?? "basic"] ?? String(row.track ?? "");

  return {
    lesson: today
      ? {
          id: today.id,
          level: track(today),
          field: today.field,
          expression: today.expression,
          meaning: today.meaning,
          nuance: clip(today.nuance, 600),
          examples: clip(today.examples, 1200),
          dialogue: clip(today.dialogue, 1200),
          quiz: clip(today.quiz, 800),
          similar_expressions: today.similar_expressions,
        }
      : null,
    week: rows
      .filter((row) => String(row.publish_on) >= weekStart)
      .map((row) => ({ date: row.publish_on, level: track(row), expression: row.expression, meaning: row.meaning })),
    articles: (articles.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      summary: clip(row.summary, 1000),
      advanced_vocabulary: clip(row.advanced_vocabulary, 1500),
      keywords: clip(row.keywords, 300),
    })),
  };
}

export const materialSource = (material: Material, pillar: Pillar) => ({
  pillar: pillar.key,
  lessonId: material.lesson?.id ?? null,
  articleIds: material.articles.map((article) => article.id),
});

// --------------------------------------------------------------------- draft
const BRAND = `You write social posts whose single goal is to get people to start "One Cup Daily" (원컵 데일리, by 영어 한잔): the first day is free, and the link is in the profile.
One Cup Daily facts (the only product claims you may make): a business English expression picked by an interpreter who works with global executives, sent every weekday at 8 AM on KakaoTalk (no app to install); each lesson has the meaning, nuance, example sentences, a short dialogue from real work situations (meetings, 1:1s, emails), native-speaker audio, and a one-minute quiz; a review arrives on Saturdays; two levels (초·중급, 고급); about 20 expressions a month; the first day is free, then about ₩${DAILY_PRICE_PER_DAY_KRW} a day, cancel anytime.
Audience: Korean office workers and job seekers in their 20s and 30s who freeze in English meetings, emails and calls. Voice: warm, smart, a little playful; Korean first with English where it teaches. Lead with a hook that names a real situation the reader struggles with whenever the theme allows, and make the payoff concrete: what they will be able to say tomorrow. Do not promote the offline meetup. Never invent facts, testimonials, statistics, numbers, dates, people or guarantees beyond the material and the facts above. No URLs anywhere (the system adds tracking links). No Markdown. No more than one emoji per paragraph.`;

const REEL_FORMAT = `Return JSON {"caption": string, "slides": [{"eyebrow": string, "title": string, "body": string, "highlight": string}], "narration": string[]} for a 20 to 45 second Instagram Reel. Make 4 to ${REEL_MAX_SLIDES} slides shown one after another, each on screen while its narration line is read aloud; "narration" has exactly one line per slide. Slide 1 is the hook: an eyebrow label and a Korean title (max 32 characters) that stops the scroll. Slide titles max 30 characters, body max 90 characters (keep frames uncluttered), "highlight" an English sentence or term (max 90 characters) or "". Each narration line (max ${NARRATION_LINE_LIMIT} characters) is natural spoken Korean that a narrator reads in about 3 to 7 seconds; include the English expression itself where it teaches, written plainly so text-to-speech pronounces it well (no emoji, no hashtags, no brackets). The last slide and line invite people to get One Cup Daily free for the first day and say the link is in the profile. "caption" (max ${CAROUSEL_CAPTION_LIMIT} characters) opens with a strong first line, recaps the reel, says the link is in the profile, and ends with 3 to 5 relevant hashtags.`;

const FORMAT: Record<SocialChannel, string> = {
  threads: `Return JSON {"text": string, "replies": string[]} for a Threads thread. "text" (max ${THREAD_TEXT_LIMIT} characters) is the hook: a question or surprising point that makes people reply. "replies" (1 to 3 items, each max ${THREAD_REPLY_LIMIT} characters) continue it: the explanation, the answer, examples. The last reply ends with a one-line invitation to get One Cup Daily free for the first day (the system appends the link after it). Use at most one topic hashtag in total, placed in "text".`,
  instagram: `Return JSON {"caption": string, "slides": [{"eyebrow": string, "title": string, "body": string, "highlight": string}]} for an Instagram card-news carousel. Make ${CAROUSEL_MIN_SLIDES + 2} to ${CAROUSEL_MAX_SLIDES - 1} slides. Slide 1 is the cover: a short eyebrow label and a punchy Korean title (max 32 characters; for benefit-led posts this is the pain-point hook), body as a one-line teaser. Middle slides teach one point each: title max 30 characters, body max 120 characters, "highlight" an English sentence or term (max 90 characters) or "". The last slide invites people to get One Cup Daily free for the first day and says the link is in the profile. "caption" (max ${CAROUSEL_CAPTION_LIMIT} characters) opens with a strong first line, recaps the post, says the link is in the profile, and ends with 3 to 5 relevant hashtags.`,
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

// Model output sometimes ignores the prompt: strip URLs (tracking links are added at
// publish time) and Markdown emphasis, which Threads and Instagram show literally.
export const cleanText = (text: string) =>
  text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const str = (value: unknown, max: number) => (typeof value === "string" ? cleanText(value).slice(0, max) : "");

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
