// The first line of a lesson or review message ("#{name}님, #{hook}" in the approved
// DAILY_LESSON_HOOK / DAILY_REVIEW_HOOK templates). A model writes it from what the
// reader has done so far, the way Duolingo's reminders do; when the model is slow, off
// or writes something that breaks the rules below, a fixed line from POOL goes instead.
//
// Alimtalk only carries information: the line may not sell (no 구독, 결제, 할인…), may
// not invent facts, and the template already puts the name in front of it. What the
// model is told is only the level, 직종, the lesson and the reader's counts, never a
// name, phone number or workplace.
//
// The line is written once per delivery and kept on the row (daily_deliveries.hook), so
// a retried send says the same thing.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const MODEL = Deno.env.get("DAILY_HOOK_MODEL") || "gpt-6-luna";
const CALL_TIMEOUT_MS = 10_000;
// A tick with many due deliveries stops asking the model after this long; the rest get
// pool lines, so a slow API cannot hold up a morning's sends.
const BUDGET_MS = 60_000;
const CONCURRENCY = 8;
const MAX_LENGTH = 60;

export type HookKind = "lesson" | "review";

export interface HookTarget {
  id: string; // delivery id
  kind: HookKind;
  forDate: string; // KST YYYY-MM-DD
  subscriptionId: string;
  customerId: string;
  levelLabel: string;
  lesson?: { expression: string; meaning: string };
  reviewExpressions?: string[];
  // Given instead of looked up, for previews.
  progress?: Partial<Progress>;
}

export interface HookResult {
  hook: string;
  source: "ai" | "pool";
}

// ---------------------------------------------------------------------------
// Fixed lines (also the founder-approved examples the model is shown)
// ---------------------------------------------------------------------------

const FIRST = "첫 영어 한잔이에요. 5분이면 충분해요 ☕";
const MILESTONES = new Set([5, 10, 20, 50, 100]);
const STREAK = "벌써 {n}번째 표현이에요. 이 정도면 습관이에요 🔥";
const WEEKDAY: Record<number, string> = {
  1: "월요일 회의 전에 이 한 마디는 챙겨가세요 💼",
  2: "어제 표현 기억나요? 오늘 것도 금방 끝나요 ⏱️",
  3: "한 주의 반이 지났어요. 표현 하나만 더!",
  4: "내일 회의에서 바로 써먹을 표현이 왔어요",
  5: "금요일 퇴근 전 마지막 한 마디예요 🍻",
};
const LESSON_POOL = [
  "오늘의 영어 한잔 나왔어요. 따뜻할 때 드세요 ☕",
  "커피 식기 전에 끝나는 오늘의 표현이에요",
  "지하철 두 정거장이면 끝나는 오늘의 레슨 🚇",
  "외국인 동료가 진짜 쓰는 표현, 오늘 하나 들고 왔어요",
  "이 표현 모르면 회의에서 고개만 끄덕이게 돼요 😅",
  "\"I think...\" 다음에 할 말, 오늘 하나 생겨요",
  "통역사가 회의에서 실제로 들은 표현이에요",
  "오늘 안 보면 내일 회의에서 아쉬울 거예요 👀",
  "어제보다 한 마디 더! 오늘의 표현이에요",
  "5분 투자로 회의 한 장면이 바뀌어요",
];
const REVIEW_POOL = [
  "이번 주 표현 {count}개, 아직 기억나나요? 🧠",
  "복습 안 하면 다음 주엔 절반만 남아요 😱",
  "이번 주 {count}개, 1분 퀴즈로 확인해볼까요?",
  "한 주 수고했어요. 이번 주 표현 모아왔어요 🎁",
  "월요일 회의 전에 이번 주 표현 한 번만 다시 봐요",
  "주말 5분이면 이번 주 표현이 내 것이 돼요",
];

function isoDow(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function dayNumber(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000);
}

// Rotates by date, offset per subscription so one morning's readers don't all get the
// same line, and consecutive days never repeat for the same reader.
function rotate<T>(list: T[], forDate: string, subscriptionId: string): T {
  let offset = 0;
  for (const ch of subscriptionId) offset = (offset * 31 + ch.charCodeAt(0)) % 1009;
  return list[(dayNumber(forDate) + offset) % list.length];
}

function poolHook(t: HookTarget, ctx: Progress): string {
  if (t.kind === "review") {
    return rotate(REVIEW_POOL, t.forDate, t.subscriptionId).replace("{count}", String(t.reviewExpressions?.length ?? 0));
  }
  const n = ctx.lessonsReceived + 1;
  if (n === 1) return FIRST;
  if (MILESTONES.has(n)) return STREAK.replace("{n}", String(n));
  const weekday = WEEKDAY[isoDow(t.forDate)];
  return rotate(weekday ? [weekday, ...LESSON_POOL] : LESSON_POOL, t.forDate, t.subscriptionId);
}

// ---------------------------------------------------------------------------
// What the reader has done so far
// ---------------------------------------------------------------------------

export interface Progress {
  lessonsReceived: number; // lessons sent on this subscription before this one
  daysSinceLastOpen: number | null; // since a lesson or review link was last opened
  quizAnswered: number;
  quizCorrect: number;
  quizThisWeek: number;
  sentencesWritten: number;
  sentencesPicked: number;
  lastExpression: string | null; // the lesson before this one
  jobCategory: string | null;
}

async function progressOf(db: SupabaseClient, t: HookTarget): Promise<Progress> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [lessons, last, opened, quiz, quizWeek, sentences, picked, customer] = await Promise.all([
    db.from("daily_deliveries").select("id", { count: "exact", head: true })
      .eq("subscription_id", t.subscriptionId).eq("kind", "lesson").eq("status", "sent").neq("id", t.id),
    db.from("daily_deliveries").select("lesson:daily_lessons(expression)")
      .eq("subscription_id", t.subscriptionId).eq("kind", "lesson").eq("status", "sent").neq("id", t.id)
      .order("for_date", { ascending: false }).limit(1),
    db.from("daily_sessions").select("last_seen_at")
      .eq("customer_id", t.customerId).not("delivery_id", "is", null)
      .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1),
    db.from("daily_quiz_answers").select("correct").eq("subscription_id", t.subscriptionId).limit(1000),
    db.from("daily_quiz_answers").select("lesson_id", { count: "exact", head: true })
      .eq("subscription_id", t.subscriptionId).gte("answered_at", weekAgo),
    db.from("daily_sentences").select("id", { count: "exact", head: true }).eq("customer_id", t.customerId),
    db.from("daily_sentences").select("id", { count: "exact", head: true })
      .eq("customer_id", t.customerId).not("picked_at", "is", null),
    db.from("daily_customers").select("job_category").eq("id", t.customerId).maybeSingle(),
  ]);
  const lastSeen = (opened.data?.[0] as { last_seen_at?: string | null } | undefined)?.last_seen_at;
  const answers = (quiz.data ?? []) as Array<{ correct: boolean }>;
  const lastLesson = (last.data?.[0] as unknown as { lesson: { expression: string } | null } | undefined)?.lesson;
  return {
    lessonsReceived: lessons.count ?? 0,
    daysSinceLastOpen: lastSeen ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86_400_000) : null,
    quizAnswered: answers.length,
    quizCorrect: answers.filter((a) => a.correct).length,
    quizThisWeek: quizWeek.count ?? 0,
    sentencesWritten: sentences.count ?? 0,
    sentencesPicked: picked.count ?? 0,
    lastExpression: lastLesson?.expression ?? null,
    jobCategory: (customer.data as { job_category?: string | null } | null)?.job_category ?? null,
  };
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

const WEEKDAY_NAME = ["", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];

const INSTRUCTIONS = `너는 비즈니스 영어 서비스 '영어 한잔 Daily'의 카카오톡 알림 첫 문장을 쓰는 카피라이터야.
듀오링고 알림처럼 짧고, 재치 있고, 지금 바로 열어보고 싶게 만들어.
이 문장 앞에는 이미 "OO님, "이 붙어서 나가.

먼저 데이터에서 이 사람에게 가장 특별한 사실 하나를 골라. 그 사실이 문장의 중심이야.
우선순위
1. 통역사가 이 사람이 쓴 문장을 골라줬다면 그걸 축하해.
2. 마지막으로 레슨을 연 지 3일 이상이면, 탓하지 말고 가볍게 다시 부르듯 써.
3. 이번이 5, 10, 20, 50, 100번째 레슨이면 그 숫자를 축하해.
4. 퀴즈를 많이 맞혔거나 이번 주에 퀴즈를 꾸준히 풀었으면 그걸 짚어줘.
5. 첫 레슨이면 시작을 반겨줘.
6. 위에 해당하는 게 없으면 요일, 직종, 오늘 표현 중 하나로 호기심을 자극해.
오늘의 표현은 뒤에 이어지는 본문에 나오니까, 첫 문장에 꼭 넣을 필요는 없어.
토요일 주간 복습이면 위 순서 대신 이번 주 이야기를 해. 이번 주 표현 수, 이번 주에 푼 퀴즈 수, 다음 주 회의에 대비하기 중 하나로 써. 레슨 몇 번째인지는 말하지 마.

규칙
- 한 문장, 공백 포함 40자 이내. 해요체.
- 이름, 호칭, "님"을 쓰지 마.
- 이모지는 0~1개.
- 주어진 데이터에 있는 사실만 써. 숫자, 기록, 표현을 지어내지 마.
- 구독, 결제, 할인, 무료, 이벤트, 쿠폰, 가격, 혜택처럼 구매나 가입을 권하는 말은 쓰지 마.
- 링크, 전화번호, 따옴표로 감싼 문장 전체는 쓰지 마.
- 상대를 탓하거나 겁주지 마. 오래 안 봤다면 가볍게 돌아오게 해.
- 오늘 표현의 영어 원문은 그대로 써도 돼.
- 문장만 출력해. 설명이나 다른 말은 붙이지 마.

이런 톤이야
- 이 표현 모르면 회의에서 고개만 끄덕이게 돼요 😅
- "I think..." 다음에 할 말, 오늘 하나 생겨요
- 벌써 10번째 표현이에요. 이 정도면 습관이에요 🔥
- 복습 안 하면 다음 주엔 절반만 남아요 😱`;

function promptFor(t: HookTarget, p: Progress): string {
  const facts: Record<string, unknown> = {
    메시지: t.kind === "lesson" ? "평일 레슨" : "토요일 주간 복습",
    요일: WEEKDAY_NAME[isoDow(t.forDate)],
    레벨: t.levelLabel,
    직종: p.jobCategory ?? "모름",
    지금까지_받은_레슨_수: p.lessonsReceived,
    마지막으로_레슨을_연_지_며칠: p.daysSinceLastOpen ?? "기록 없음",
    푼_퀴즈_수: p.quizAnswered,
    맞힌_퀴즈_수: p.quizCorrect,
    이번_주_푼_퀴즈_수: p.quizThisWeek,
    직접_쓴_문장_수: p.sentencesWritten,
    통역사가_골라준_문장_수: p.sentencesPicked,
  };
  if (t.kind === "lesson" && t.lesson) {
    facts.오늘의_표현 = t.lesson.expression;
    facts.뜻 = t.lesson.meaning;
    facts.이번이_몇_번째_레슨 = p.lessonsReceived + 1;
    if (p.lastExpression) facts.지난_레슨_표현 = p.lastExpression;
  }
  if (t.kind === "review") {
    facts.이번_주_표현 = t.reviewExpressions ?? [];
  }
  return JSON.stringify(facts, null, 2);
}

const BANNED = /(구독|결제|할인|무료|이벤트|쿠폰|가격|혜택|https?:|www\.|\.com|\d{2,3}-\d{3,4}-\d{4}|님)/;

/** The model's line, cleaned, or null when it breaks a rule. */
export function cleanHook(raw: string): string | null {
  let line = raw.trim().split("\n")[0]?.trim() ?? "";
  line = line.replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, "").trim();
  if (line.length < 4 || line.length > MAX_LENGTH) return null;
  if (BANNED.test(line)) return null;
  return line;
}

async function askModel(t: HookTarget, p: Progress, apiKey: string): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, instructions: INSTRUCTIONS, input: promptFor(t, p) }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.warn(`daily hook: model ${MODEL} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  const data = await res.json() as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  const text = data.output_text ??
    (data.output ?? []).flatMap((o) => o.type === "message" ? o.content ?? [] : [])
      .filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
  return cleanHook(text);
}

/** One line per target: the model's when it writes a usable one in time, else the pool's. */
export async function writeHooks(db: SupabaseClient, targets: HookTarget[]): Promise<Map<string, HookResult>> {
  const results = new Map<string, HookResult>();
  if (targets.length === 0) return results;
  const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("NEXT_OPENAI_API_KEY");
  const deadline = Date.now() + BUDGET_MS;
  let next = 0;

  const worker = async () => {
    while (next < targets.length) {
      const t = targets[next++];
      const empty: Progress = {
        lessonsReceived: 0, daysSinceLastOpen: null, quizAnswered: 0, quizCorrect: 0, quizThisWeek: 0,
        sentencesWritten: 0, sentencesPicked: 0, lastExpression: null, jobCategory: null,
      };
      let p: Progress = empty;
      if (t.progress) p = { ...empty, ...t.progress };
      else {
        try {
          p = await progressOf(db, t);
        } catch (e) {
          console.warn("daily hook: progress lookup failed:", e instanceof Error ? e.message : e);
        }
      }
      let hook: string | null = null;
      if (apiKey && Date.now() < deadline) {
        try {
          hook = await askModel(t, p, apiKey);
        } catch (e) {
          console.warn("daily hook: model call failed:", e instanceof Error ? e.message : e);
        }
      }
      results.set(t.id, hook ? { hook, source: "ai" } : { hook: poolHook(t, p), source: "pool" });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  return results;
}
