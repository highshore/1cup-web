// Server-only: what each day's post is about, the material it is written from, and the
// GPT Luna call that drafts it.
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
  HOOK_LIMIT,
  HOOK_STYLES,
  type HookOption,
  type HookStyle,
  NARRATION_LINE_LIMIT,
  REEL_MAX_SLIDES,
  type ReelContent,
  type SocialPostFormat,
  type SocialChannel,
  THREAD_MAX_CARDS,
  THREAD_MAX_REPLIES,
  THREAD_REPLY_LIMIT,
  THREAD_TEXT_LIMIT,
  THREAD_VIDEO_MAX_SCENES,
  type ThreadContent,
  type ThreadMedia,
  type ThreadStructure,
} from "../types";

// OpenAI GPT Luna through the Responses API, like One Cup Daily's hook writer
// (supabase/functions/daily/hooks.ts). SOCIAL_DRAFT_MODEL overrides the model.
const MODEL = process.env.SOCIAL_DRAFT_MODEL || "gpt-6-luna";

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
1) HOOK — the chosen opening, aimed at one specific reader and situation. Pick the reader from: office workers in English meetings, people writing English emails, client or partner calls, foreign-company job seekers, people whose test scores are high but who freeze when speaking.
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
Audience: Korean office workers and job seekers in their 20s and 30s who freeze in English meetings, emails and calls. Voice: warm, smart, a little playful; Korean first with English where it teaches. The opening decides everything (see the opening rules in the prompt); after it, make the payoff concrete: what they will be able to say tomorrow. Do not promote the offline meetup. Never invent facts, testimonials, statistics, numbers, dates, people or guarantees beyond the material and the facts above. No URLs anywhere (the system adds tracking links). No Markdown. No more than one emoji per paragraph.`;

// The opening is what people see before deciding to stop scrolling: a Threads post's
// first line, card 1's title, a reel's first scene and first spoken words. Every draft
// writes one opening per style, uses the day's assigned style, and the admin can swap
// in another. Styles are scored by 24-hour views (server/variants.ts).
export const HOOK_GUIDE: Record<HookStyle, string> = {
  callout:
    'Call out one specific reader in one specific moment so they think "that is me". e.g. 영어 회의에서 "I think..."만 외치는 당신에게 / 영어 메일 한 줄에 10분 쓰고 있다면',
  mistake:
    "Point at something many Koreans say at work that lands differently than they think, and hold back the fix. Only claim what the lesson's meaning and nuance support. e.g. 상사한테 \"Please check it\" 보내기 전에 잠깐만요 / 회의에서 \"I have a question\"으로 시작하면 생기는 일",
  contrast:
    "Two ways to say the same thing, one plain and one that sounds like a pro, with the gap made obvious. e.g. 같은 '확인해볼게요'인데 하나는 신입, 하나는 팀장처럼 들려요 / '바빠요'를 이렇게 말하면 일 잘하는 사람 같아요",
  quiz:
    "A three-second challenge the reader tries in their head before reading on. e.g. '그건 회의 끝나고 따로 얘기해요' 영어로 3초 안에 말해보세요 / 빈칸 하나만 채우면 원어민 메일이 됩니다",
  curiosity:
    "Show an English phrase people hear at work but would misread, and ask what it means. e.g. 외국인 팀장이 \"Let's take this offline\"이라고 하면 회의실을 나가야 할까요? / \"Ping me\"는 핑퐁이 아닙니다",
  confession:
    "A moment everyone has had, told as a shared experience (never as a real customer's story or testimonial). e.g. 회의 끝나고 샤워하다가 '아 그 말 할걸' 했던 적 있다면 / 토익 900인데 스몰토크에서 웃기만 했던 날",
};

const HOOK_RULES = `Opening rules (the first line of a post, the first card's title and a reel's first scene):
- It must stand alone and stop the scroll in under two seconds: at most 34 Korean characters, one idea, ideally a concrete work moment (meeting, email, 1:1, call, interview) or the English phrase itself.
- Open a loop and pay it off later in the post, never in the first line: the reader must feel "I need to see the answer" or "this is about me".
- Write all six openings below, one per style, each built from today's material (not the examples, which only show the style; never copy them):
${HOOK_STYLES.map((style) => `  ${style}: ${HOOK_GUIDE[style]}`).join("\n")}
- Never open with: a greeting, the brand or product name, "오늘의 표현", "여러분", a generic question ("영어 공부 힘드시죠?"), hype words (충격, 대박, 인생이 바뀌는), or a promise the post does not keep.
- The second line or second card keeps them reading (a teaser of the answer, or the stakes), not the CTA.`;

const REEL_FORMAT = `Return JSON {"caption": string, "slides": [{"eyebrow": string, "title": string, "body": string, "highlight": string}], "narration": string[]} plus "hooks": [{"style": string, "text": string}] and "hookStyle": string for a 20 to 45 second Instagram Reel. Make 4 to ${REEL_MAX_SLIDES} slides shown one after another, each on screen while its narration line is read aloud; "narration" has exactly one line per slide. Slide 1 is the opening: its title is the chosen opening (max 34 characters), its body a short teaser or "", and narration line 1 says the opening within the first two seconds (no greeting, no introduction). Slide titles max 30 characters, body max 90 characters (keep frames uncluttered), "highlight" an English sentence or term (max 90 characters) or "". Each narration line (max ${NARRATION_LINE_LIMIT} characters) is natural spoken Korean that a narrator reads in about 3 to 7 seconds; include the English expression itself where it teaches, written plainly so text-to-speech pronounces it well (no emoji, no hashtags, no brackets). The last slide and line invite people to get One Cup Daily free for the first day and say the link is in the profile. "caption" (max ${CAROUSEL_CAPTION_LIMIT} characters) opens with the chosen opening (or a close variant of it) as its first line, recaps the reel, says the link is in the profile, and ends with 3 to 5 relevant hashtags.`;

const LINK_NOTE = `Do not write a link line yourself: the system adds "☕ 원컵데일리 하루 무료로 받아보기 👉 <link>" to the end of "text". Use at most one topic hashtag in total, placed in "text".`;

const SLIDE_SHAPE = `{"eyebrow": string, "title": string, "body": string, "highlight": string}`;

// A Threads post is one of six shapes: text only, with cards, or with a short video,
// either self-contained or continued in replies.
export function threadFormat(structure: ThreadStructure, media: ThreadMedia): string {
  const fields = [
    `"text": string`,
    `"replies": string[]`,
    ...(media === "text" ? [] : [`"slides": [${SLIDE_SHAPE}]`]),
    ...(media === "video" ? [`"narration": string[]`] : []),
  ];
  const body =
    structure === "single"
      ? `"text" (max ${THREAD_TEXT_LIMIT} characters) is the whole post and must work on its own: the opening as line 1, then the payoff in a few short lines (the expression, what it means, one example), then a one-line invitation to get One Cup Daily free for the first day. Use short lines and blank lines; no wall of text. "replies" is [].`
      : `"text" (max ${THREAD_TEXT_LIMIT} characters) is the opening post: line 1 is the opening, then one or two lines that make people want the answer (it is fine to end with "👇" or a question). "replies" (1 to 3 items, each max ${THREAD_REPLY_LIMIT} characters) pay it off: the explanation, the answer, examples. The last reply ends with a one-line invitation to get One Cup Daily free for the first day.`;
  const visual =
    media === "image"
      ? ` "slides" (1 to ${THREAD_MAX_CARDS} cards, 4:5 images attached to the first post) make the picture itself stop the scroll: card 1's title is the opening or its visual twin (max 34 characters) with body "" or a one-line teaser; any further cards each show one point (title max 30 characters, body max 100, "highlight" an English sentence max 90 characters or ""). Quiz posts put the question on card 1 and keep the answer for a later card or reply. The cards add to the text; do not paste the text into them.`
      : media === "video"
        ? ` "slides" (3 to ${THREAD_VIDEO_MAX_SCENES} scenes of a 15 to 30 second vertical video attached to the first post) with "narration" (exactly one spoken line per scene, max ${NARRATION_LINE_LIMIT} characters, natural Korean read in 3 to 6 seconds, the English expression written plainly for text-to-speech; no emoji, hashtags or brackets). Scene 1's title is the opening (max 34 characters) and narration line 1 says it within the first two seconds. Scene titles max 30 characters, body max 90, "highlight" an English sentence or "". The last scene invites people to get One Cup Daily free for the first day and says the link is in the post.`
        : "";
  return `Return JSON {${fields.join(", ")}, "hooks": [{"style": string, "text": string}], "hookStyle": string} for a Threads post. ${body}${visual} ${LINK_NOTE}`;
}

const FORMAT: Record<"instagram", string> = {
  instagram: `Return JSON {"caption": string, "slides": [{"eyebrow": string, "title": string, "body": string, "highlight": string}]} plus "hooks": [{"style": string, "text": string}] and "hookStyle": string for an Instagram card-news carousel. Make ${CAROUSEL_MIN_SLIDES + 2} to ${CAROUSEL_MAX_SLIDES - 1} slides. Slide 1 is the cover: a short eyebrow label, the chosen opening as its title (max 34 characters), body a one-line teaser. Middle slides teach one point each: title max 30 characters, body max 120 characters, "highlight" an English sentence or term (max 90 characters) or "". The last slide invites people to get One Cup Daily free for the first day and says the link is in the profile. "caption" (max ${CAROUSEL_CAPTION_LIMIT} characters) opens with the chosen opening (or a close variant of it) as its first line, recaps the post, says the link is in the profile, and ends with 3 to 5 relevant hashtags.`,
};

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

async function callModel(prompt: string): Promise<Json> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      instructions: BRAND,
      input: prompt,
      // JSON mode: the prompts spell out each format's exact JSON shape.
      text: { format: { type: "json_object" } },
    }),
    signal: AbortSignal.timeout(150_000),
  });
  const payload = (await response.json().catch(() => ({}))) as ResponsesPayload;
  if (!response.ok) throw new Error(`Draft model failed (${response.status}): ${payload.error?.message ?? "request failed"}`);
  const text = (
    payload.output_text ??
    (payload.output ?? [])
      .flatMap((item) => (item.type === "message" ? item.content ?? [] : []))
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("")
  ).trim();
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

const normalizeSlides = (raw: unknown, max: number): CardSlide[] =>
  (Array.isArray(raw) ? raw : [])
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
    .slice(0, max);

// One line per slide; a missing line leaves that slide silent rather than shifting the rest.
const normalizeNarration = (raw: unknown, slides: CardSlide[]) => {
  const lines = Array.isArray(raw) ? raw : [];
  const narration = slides.map((_, index) => str(lines[index], NARRATION_LINE_LIMIT));
  if (narration.every((line) => !line)) throw new Error("The video has no narration.");
  return narration;
};

const isHookStyle = (value: unknown): value is HookStyle => HOOK_STYLES.includes(value as HookStyle);

// Openings arrive as [{style, text}]; keep one per known style, in the guide's order.
const normalizeHooks = (raw: Json): Pick<ThreadContent, "hooks" | "hookStyle"> => {
  const hooks: HookOption[] = [];
  for (const item of Array.isArray(raw.hooks) ? raw.hooks : []) {
    const value = (item ?? {}) as Json;
    const text = str(value.text, HOOK_LIMIT).split("\n")[0].trim();
    if (isHookStyle(value.style) && text && !hooks.some((hook) => hook.style === value.style)) {
      hooks.push({ style: value.style, text });
    }
  }
  hooks.sort((a, b) => HOOK_STYLES.indexOf(a.style) - HOOK_STYLES.indexOf(b.style));
  return { hooks, hookStyle: isHookStyle(raw.hookStyle) ? raw.hookStyle : "" };
};

export const normalizeThread = (raw: Json, media: ThreadMedia = "text", structure?: ThreadStructure): ThreadContent => {
  const text = str(raw.text, THREAD_TEXT_LIMIT);
  if (!text) throw new Error("Thread text is empty.");
  const replies =
    structure === "single"
      ? []
      : (Array.isArray(raw.replies) ? raw.replies : [])
          .map((reply) => str(reply, THREAD_REPLY_LIMIT))
          .filter(Boolean)
          .slice(0, THREAD_MAX_REPLIES);
  const content: ThreadContent = { text, replies, ...normalizeHooks(raw) };
  if (media === "image") {
    content.slides = normalizeSlides(raw.slides, THREAD_MAX_CARDS);
    if (content.slides.length === 0) throw new Error("The post needs at least one card.");
  } else if (media === "video") {
    content.slides = normalizeSlides(raw.slides, THREAD_VIDEO_MAX_SCENES);
    if (content.slides.length < 2) throw new Error("The video needs at least two scenes.");
    content.narration = normalizeNarration(raw.narration, content.slides);
  }
  return content;
};

export const normalizeReel = (raw: Json): ReelContent => {
  const carousel = normalizeCarousel({ ...raw, slides: Array.isArray(raw.slides) ? raw.slides.slice(0, REEL_MAX_SLIDES) : [] });
  return { ...carousel, narration: normalizeNarration(raw.narration, carousel.slides) };
};

export const normalizeCarousel = (raw: Json): CarouselContent => {
  const slides = normalizeSlides(raw.slides, CAROUSEL_MAX_SLIDES);
  if (slides.length < CAROUSEL_MIN_SLIDES) throw new Error("The carousel needs at least three slides.");
  const caption = str(raw.caption, CAROUSEL_CAPTION_LIMIT);
  if (!caption) throw new Error("Instagram caption is empty.");
  return { caption, slides, ...normalizeHooks(raw) };
};

export interface DraftOptions {
  format: SocialPostFormat;
  hookStyle: HookStyle;
  /** Threads only. */
  threadMedia?: ThreadMedia;
  threadStructure?: ThreadStructure;
  /** First lines of recent posts, so the new one does not repeat them. */
  recentPosts: string[];
  /** Our own best and worst openers by 24-hour views (server/variants.ts). */
  lessons?: { strong: string[]; weak: string[] };
}

export async function draftPost(
  channel: SocialChannel,
  postDate: string,
  pillar: Pillar,
  material: Material,
  options: DraftOptions,
): Promise<ThreadContent | CarouselContent | ReelContent> {
  const { format, hookStyle, recentPosts, lessons } = options;
  const media = options.threadMedia ?? "text";
  const structure = options.threadStructure ?? "chain";
  const prompt = [
    `Post date (KST): ${postDate}. Theme: ${pillar.label} — ${pillar.brief}`,
    channel === "threads" ? threadFormat(structure, media) : format === "reel" ? REEL_FORMAT : FORMAT.instagram,
    HOOK_RULES,
    `Today's assigned opening style is "${hookStyle}": set "hookStyle" to "${hookStyle}" and open the post with that style's opening from "hooks". Make it the strongest of the six.`,
    lessons?.strong.length
      ? `How our own audience reacted (views 24 hours after posting). Learn what made the strong ones work (specificity, situation, tension) without copying them:\nStrong:\n${lessons.strong.map((line) => `- ${line}`).join("\n")}\nWeak:\n${lessons.weak.map((line) => `- ${line}`).join("\n")}`
      : "",
    recentPosts.length
      ? `Do not repeat these recent posts' angles or wording:\n${recentPosts.map((post) => `- ${clip(post, 160)}`).join("\n")}`
      : "",
    `Material (the only source of facts):\n${JSON.stringify(material)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callModel(prompt);
  const content =
    channel === "threads" ? normalizeThread(raw, media, structure) : format === "reel" ? normalizeReel(raw) : normalizeCarousel(raw);
  // The model sometimes forgets the field; the assigned style is what the post was asked for.
  if (!content.hookStyle) content.hookStyle = hookStyle;
  return content;
}
