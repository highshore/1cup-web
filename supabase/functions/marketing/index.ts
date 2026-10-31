// marketing — port of functions/src/marketingCron.ts (Gopas advert scheduler).
//
// Admin actions (save-template-schedule / create-template / ensure-default-template /
// channel-status / connect-channel / disconnect-channel /
// delete-template / delete-run / generate-template / run-now) plus the scheduled tick, which pg_cron calls with the
// a private scheduler header as { action: "tick" }.
//
// Two things changed shape in the move off Firestore:
//   * The run lease was a transaction on the config document. Here it is a conditional
//     UPDATE ... RETURNING on growth_config, which is atomic on its own — if two ticks
//     race, exactly one gets a row back and the other does nothing.
//   * Post metrics were incremented per document; the refresh now writes each post's
//     metrics blob directly, same as the Firestore version did after reading them.
//
// Publishing is delegated to a browser-capable service. Edge Functions own the
// schedule, duplicate check, tracking records, and audit trail; the publisher
// owns only the authenticated Chromium interaction with Koreapas.
//
// Templates can also post to Threads and Instagram (./social.ts, official Graph APIs).
// A due template creates one queued run per selected channel; the first runs right
// away and each later tick publishes the next queued run, so one slow channel cannot
// time out the others. Admins connect each channel by pasting a long-lived token
// (connect-channel); refresh-performance pulls insights and extends tokens.
import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid } from "../_shared/db.ts";
import Encoding from "npm:encoding-japanese@2.2.0";
import {
  type ChannelAccount,
  fetchMediaMetrics,
  INSTAGRAM_CAPTION_LIMIT,
  publishToInstagram,
  publishInstagramReel,
  publishThreadsReplies,
  publishToThreads,
  refreshAccessToken,
  type SocialChannel,
  THREADS_TEXT_LIMIT,
  verifyAccessToken,
} from "./social.ts";

const CONFIG_ROW = "settings";
const RUN_LEASE_MS = 10 * 60 * 1000;
const KOREAPAS_MIN_POST_INTERVAL_MS = 24 * 60 * 60 * 1000;
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const ORIGINAL_TEMPLATE_ID = "gopas_original_meetup";
const TRACKING_DOMAIN = "https://1cupenglish.com";
const KOREAPAS_CHANNEL = "koreapas";
const CHANNELS = ["koreapas", "threads", "instagram"] as const;
type Channel = (typeof CHANNELS)[number];
const SOCIAL_CHANNELS: SocialChannel[] = ["threads", "instagram"];
// Guards against double posts from retries or overlapping schedules.
const CHANNEL_MIN_POST_INTERVAL_MS: Record<Channel, number> = {
  koreapas: KOREAPAS_MIN_POST_INTERVAL_MS,
  threads: 60 * 60 * 1000,
  instagram: 60 * 60 * 1000,
};
const TRACKING_PREFIX: Record<Channel, string> = { koreapas: "kp_", threads: "th_", instagram: "ig_" };
const QUEUED_RUN_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const TOKEN_REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;
const SOCIAL_METRICS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SOCIAL_METRICS_MIN_INTERVAL_MS = 60 * 60 * 1000;
// AI template drafts use OpenAI GPT Luna through the Responses API, like the daily
// function's hook writer. MARKETING_DRAFT_MODEL overrides the model.
const TEMPLATE_DRAFT_MODEL = Deno.env.get("MARKETING_DRAFT_MODEL") || "gpt-6-luna";
const GOPAS_FREE_AD_URL = "https://www.koreapas.com/bbs/zboard.php?id=freead";
const GOPAS_LOGIN_URL = "https://www.koreapas.com/m/fast_menu_index.php";
const GOPAS_LOGIN_SUBMIT_URL = "https://www.koreapas.com/bbs/login_check.php";
const GOPAS_WRITE_URL = "https://www.koreapas.com/bbs/write.php?id=freead&category=";
const GOPAS_BROWSER_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type TemplatePhoto = { url: string; alt: string };
type CronSchedule = { minute: number; hour: number; daysOfWeek: number[] };
type Metrics = {
  impressions: number;
  clicks: number;
  signups: number;
  likes: number;
  comments: number;
};

const emptyMetrics = (): Metrics => ({
  impressions: 0,
  clicks: 0,
  signups: 0,
  likes: 0,
  comments: 0,
});

// Seed content for the default Gopas advert, copied verbatim from the Cloud Function.
const ORIGINAL_GOPAS_TEMPLATE = {
  name: "기존 고파스 홍보글",
  destination_url: "https://1cupenglish.com/meetup",
  title: "[D-{{daysUntilSunday}}] 🇺🇸 자연스럽게 영어 실력을 올리고 싶나요? 저희 소모임으로 오세요",
  copy: `저희는 'Hi, how are you?'이나 자기소개를 앵무새처럼 반복하는 모임이 아닙니다. 의견을 논리적으로 주장하고, 진짜 '무기'가 되는 영어를 익히는 곳입니다. 저 역시 서울에 수많은 영어 모임에 참여해봤습니다. 저희만큼 인적, 운영적 측면에서 퀄리티가 뛰어난 영어 모임은 거의 없다고 자부하고 있으며, 현재에 만족하지 않고 어떻게 더 좋은 모임이 될 수 있을까 끊임없이 고민 중입니다.

본 소모임은 고려대 교내 Google Developers Group와 연계하여 (소속은 아님) 운영 중입니다. IT 백그라운드를 가지신 분들도 대환영합니다. 물론 모임에 다른 백그라운드를 가지신 분들도 많아서 IT 백그라운드가 아니어도 환영합니다.

🙇🏻‍♂️ 모임장 소개
안녕하세요, 대기업과 IT 유니콘에서 약 5년 통역사로 근무한 후 복학한 재학생입니다. 통번역 일을 하면서 다양한 국적의 경영진, 실무팀을 가리지 않고 미팅만 수천번 들어갔습니다. (단순 계산으로도 1년 근무일 250일 x 4년 x 하루 미팅 2회 = 미팅 2천 회). 하지만 일을 그만두고 나니 영어 감각이 빠르게 떨어지는 것이 느껴져서, 다양한 IT 기술을 통해 멤버들과 영어 감각을 향상시키고자 본 모임을 만들었습니다. 제 이력은 https://www.linkedin.com/in/sk-kyle-kim/ 에서 확인 가능합니다.

🎯 모집 대상
- 토익 900 / 오픽 AL / 토플 105 / 영미권 거주 1년 이상에 준하는 실력 선호
- 위보다 조금 부족해도, 열심히 할 의지가 있으신지 여부를 더 중요하게 봄
- 스몰토크만 반복하는 것을 넘어, 지적인 주제로 토의하고 싶은 분
- 유학, 이민, 글로벌 커리어가 목표이신 분
- 좋은 사람들과 네트워킹하고 싶으신 분
- 국제 정세 / 경제 / IT / 의학 토픽에 관심 많은 분 (슈카월드 애청자 대환영)

🤔 진행 방식
- 대기업 & 유니콘 5년 경력 통역사가 직접 스터디 리딩 (리딩을 도와주시는 다른 분들도 계심)
- 아티클 2개로 2시간 집중 토론 (아티클 당 1시간)
- 아티클 및 질문 목록은 웹사이트로 전달 (WSJ, FT 적극 이용 중)
- 스피킹 시간을 보장하기 위해 테이블 인원은 5인 이하로 유지
- 웹사이트에서 결제 및 신청 (요금은 결제 화면에서 확인, 결제 후 7일 이내 전액 환불 가능)
- 30일 멤버십 또는 5회 참여권 중 일정에 맞는 상품을 선택할 수 있습니다

* 참고: 저희는 컴포트존을 벗어날 때 가장 큰 성장을 할 수 있다는 철학 하에 즉흥적으로 어려운 질문을 던지는 것을 좋아하고, 서로 이의 제기하는 것을 매우 장려합니다.

☕️ 시간 및 장소:
- 시간: 매주 일요일 오전 11시 15분, 2시간 진행
- 장소: 카페 안암동 (https://naver.me/FbONl0Hl), 상황에 따라 변동 가능

💳 참가 비용
- '영어 한잔' 웹사이트(https://1cupenglish.com/meetup)에서 결제 및 밋업 신청 필수 (30일 멤버십 또는 5회 참여권 중 선택, 금액은 결제 화면에서 확인)
- 결제는 수익이 아니라, 멤버의 책임감 있는 참여와 모임 퀄리티를 보장하기 위한 장치입니다.
- 결제 후 취소 및 환불은 자유입니다 (7일 내 전체 환불 사유 불문 가능, 이후 환불 시점에 따라 부분 환불)

📌 유의사항
- 지각·노쇼 ❌ => 무관용 정책 적용 중
- 아티클 미리 읽기 필수!
- 모임 장소에서 음료는 각자 시키셔야 합니다
- 비매너 시 즉시 퇴장될 수 있어요 🙅‍♂️

🔥 궁금한 점이 있으시면 아래 카톡으로 연락주세요 (모임장과 일대일 오픈챗)
https://open.kakao.com/o/s8f84nvh`,
  call_to_action: "✅ 웹사이트\nhttps://1cupenglish.com/meetup",
  photos: [
    {
      url: "https://i.ibb.co/7JmSmDc2/meetup.jpg",
      alt: "1Cup English meetup",
    },
  ] satisfies TemplatePhoto[],
};

// ---------------------------------------------------------------- validation
const textField = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  if (trimmed.length > maxLength) throw new Error(`${field} is too long.`);
  return trimmed;
};

const validDestinationUrl = (value: unknown): string => {
  const raw = textField(value, "Destination URL", 2000);
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Destination URL must be http(s).");
  }
  return url.toString();
};

const validPhotos = (value: unknown): TemplatePhoto[] => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 10)
    .map((entry) => {
      const photo = (entry ?? {}) as Record<string, unknown>;
      const url = typeof photo.url === "string" ? photo.url.trim() : "";
      if (!url) return null;
      new URL(url); // throws on nonsense
      return { url, alt: typeof photo.alt === "string" ? photo.alt.trim().slice(0, 200) : "" };
    })
    .filter((p): p is TemplatePhoto => !!p);
};

const isChannel = (value: unknown): value is Channel =>
  typeof value === "string" && (CHANNELS as readonly string[]).includes(value);

const isSocialChannel = (value: unknown): value is SocialChannel =>
  value === "threads" || value === "instagram";

// Stored in a fixed order so Gopas (the slowest publisher) keeps running first.
const validChannels = (value: unknown): Channel[] => {
  const selected = new Set(Array.isArray(value) ? value.filter(isChannel) : []);
  const channels = CHANNELS.filter((channel) => selected.has(channel));
  if (channels.length === 0) throw new Error("Select at least one channel.");
  return channels;
};

const optionalText = (value: unknown, field: string, maxLength: number): string => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field} is too long.`);
  return trimmed;
};

const validSchedule = (value: unknown): CronSchedule => {
  const data = (value ?? {}) as Record<string, unknown>;
  const minute = Number(data.minute);
  const hour = Number(data.hour);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("Schedule minute must be between 0 and 59.");
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Schedule hour must be between 0 and 23.");
  }
  const days = Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [];
  const daysOfWeek = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return { minute, hour, daysOfWeek: daysOfWeek.sort() };
};

const validTemplateId = (value: unknown, field = "templateId"): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
    throw new Error(`${field} is invalid.`);
  }
  return value;
};

const validRunId = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error("runId is invalid.");
  }
  return value;
};

type GeneratedTemplate = {
  name: string;
  title: string;
  copy: string;
  callToAction: string;
  threadsText: string;
  instagramCaption: string;
  schedule: CronSchedule;
};

const generateWithOpenAI = async (brief: string, destinationUrl: string): Promise<string> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("NEXT_OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TEMPLATE_DRAFT_MODEL,
      instructions: `You write accurate Korean marketing drafts for a Koreapas Free Ads post plus matching Threads and Instagram versions. Return only valid JSON with exactly this shape: {"name":"string","title":"string","copy":"string","callToAction":"string","threadsText":"string","instagramCaption":"string","schedule":{"hour":number,"minute":number,"daysOfWeek":[number]}}. threadsText is a short, conversational Threads post of at most 400 characters (a question or hook that invites replies; at most one topic hashtag). instagramCaption is an Instagram caption of at most 1500 characters that opens with a strong first line, says the link is in the profile, and ends with 3 to 5 relevant hashtags. Do not make up facts, prices, credentials, partnerships, availability, or guarantees. Use only claims the operator supplies. The destination URL is operator-controlled context (${destinationUrl}); do not put any URL in title, copy, callToAction, threadsText, or instagramCaption because the system injects one tracking link. Do not generate image URLs. Keep callToAction short. If using {{daysUntilSunday}}, leave it literal for the scheduler. Choose a conservative KST schedule; daysOfWeek uses Sunday=0 through Saturday=6, and use [] only if the brief explicitly requests no automatic scheduling.`,
      input: `Campaign brief:\n${brief}`,
      text: { format: { type: "json_object" } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${payload.error?.message || "request failed"}`);
  }
  const text = (
    payload.output_text ??
    (payload.output ?? [])
      .flatMap((item) => (item.type === "message" ? item.content ?? [] : []))
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("")
  ).trim();
  if (!text) throw new Error("The model returned no template draft.");
  return text;
};

const generateTemplateDraft = async (body: Record<string, unknown>): Promise<GeneratedTemplate> => {
  const brief = textField(body.brief, "Campaign brief", 2000);
  const destinationUrl = validDestinationUrl(body.destinationUrl);

  const rawDraft = await generateWithOpenAI(brief, destinationUrl);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawDraft) as Record<string, unknown>;
  } catch {
    throw new Error("The model returned an invalid template draft.");
  }

  return {
    name: textField(parsed.name, "Template name", 120),
    title: textField(parsed.title, "Title", 200),
    copy: textField(parsed.copy, "Copy", 20000),
    callToAction: textField(parsed.callToAction, "Call to action", 1000),
    // Model output is a draft for the admin to edit, so trim rather than reject.
    threadsText: typeof parsed.threadsText === "string" ? parsed.threadsText.trim().slice(0, 450) : "",
    instagramCaption:
      typeof parsed.instagramCaption === "string"
        ? parsed.instagramCaption.trim().slice(0, INSTAGRAM_CAPTION_LIMIT)
        : "",
    schedule: validSchedule(parsed.schedule),
  };
};

// ------------------------------------------------------------------ schedule
const koreaWeekday = (millis: number) => new Date(millis + KOREA_OFFSET_MS).getUTCDay();

const nextScheduledAt = (schedule: CronSchedule, afterMillis: number): Date => {
  const koreaDate = new Date(afterMillis + KOREA_OFFSET_MS);
  const year = koreaDate.getUTCFullYear();
  const month = koreaDate.getUTCMonth();
  const day = koreaDate.getUTCDate();

  for (let offset = 0; offset <= 370; offset += 1) {
    const localDate = new Date(Date.UTC(year, month, day + offset));
    if (!schedule.daysOfWeek.includes(localDate.getUTCDay())) continue;
    const candidate =
      Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth(),
        localDate.getUTCDate(),
        schedule.hour,
        schedule.minute,
      ) - KOREA_OFFSET_MS;
    if (candidate > afterMillis) return new Date(candidate);
  }
  throw new Error("Unable to calculate the next Gopas schedule.");
};

// -------------------------------------------------------------- post content
const trackingCode = (channel: Channel = KOREAPAS_CHANNEL) =>
  TRACKING_PREFIX[channel] + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const hiddenPostId = (code: string) => "kp-" + code;

const htmlAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const photoMarkup = (photos: TemplatePhoto[], destinationUrl: string) =>
  photos
    .map(
      (photo) =>
        `<p><a href="${htmlAttribute(destinationUrl)}"><img src="${htmlAttribute(photo.url)}" alt="${htmlAttribute(photo.alt)}" width="500"></a></p>`,
    )
    .join("\n");

const buildPostCopy = (photos: TemplatePhoto[], destinationUrl: string, copy: string, cta: string) =>
  [photoMarkup(photos, destinationUrl), copy, cta].filter(Boolean).join("\n\n");

const zeroWidthMarker = (marker: string) =>
  marker
    .split("")
    .map((character) =>
      character
        .charCodeAt(0)
        .toString(2)
        .padStart(8, "0")
        .replaceAll("0", "\u200B")
        .replaceAll("1", "\u200C"),
    )
    .join("\u200D");

const trackingLinkMarkup = (trackingUrl: string) =>
  `<a href="${htmlAttribute(trackingUrl)}">${htmlAttribute(trackingUrl)}</a>`;

const replaceDestinationWithTrackingLink = (
  copy: string,
  destinationUrl: string,
  trackingUrl: string,
) => copy.replaceAll(destinationUrl, trackingLinkMarkup(trackingUrl));

const contentForKoreapas = (copy: string, trackingUrl: string, marker: string) =>
  `${copy}${copy.includes(trackingUrl) ? "" : `\n\n${trackingLinkMarkup(trackingUrl)}`}\u2063${zeroWidthMarker(marker)}`;

const resolveTemplateVariables = (value: string, scheduledForMillis: number) => {
  const weekday = koreaWeekday(scheduledForMillis);
  const daysUntilSunday = (7 - weekday) % 7;
  return value.replace(/\{\{daysUntilSunday\}\}|\{daysUntilSunday\}/g, String(daysUntilSunday));
};

const coreAdvertTitle = (title: string) =>
  title.replace(/^\s*\[D-(?:\{\{daysUntilSunday\}\}|\{daysUntilSunday\}|\d+)\]\s*/i, "").trim();

// Look at the live first page right before publishing, so a repeat advert is skipped
// rather than duplicated.
const hasAdvertOnGopasFirstPage = async (title: string): Promise<boolean> => {
  const coreTitle = coreAdvertTitle(title);
  if (!coreTitle) return false;
  try {
    const response = await fetch(GOPAS_FREE_AD_URL, {
      headers: { "User-Agent": GOPAS_BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return false;
    const body = new Uint8Array(await response.arrayBuffer());
    const html = Encoding.convert(body, { from: "EUC-KR", to: "UNICODE", type: "string" }) as string;
    return html.includes(coreTitle);
  } catch (error) {
    console.warn("Unable to check the Gopas first page for a duplicate advert.", error);
    return false;
  }
};

type KoreapasRequestInit = Omit<RequestInit, "headers" | "redirect"> & { headers?: HeadersInit };

const encodeEucKrForm = (fields: Record<string, string>) => {
  const encodeBytes = (bytes: number[]) =>
    bytes
      .map((byte) => {
        const safe =
          (byte >= 0x30 && byte <= 0x39) ||
          (byte >= 0x41 && byte <= 0x5a) ||
          (byte >= 0x61 && byte <= 0x7a) ||
          byte === 0x2d || byte === 0x2e || byte === 0x5f || byte === 0x7e;
        return safe ? String.fromCharCode(byte) : `%${byte.toString(16).padStart(2, "0").toUpperCase()}`;
      })
      .join("");
  return Object.entries(fields)
    .map(([key, value]) => {
      const valueBytes = Encoding.convert(value, { to: "EUC-KR", type: "array" }) as number[];
      return `${encodeBytes([...new TextEncoder().encode(key)])}=${encodeBytes(valueBytes)}`;
    })
    .join("&");
};

const formAttribute = (tag: string, attribute: string) => {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
};

const saveCookies = (jar: Map<string, string>, headers: Headers) => {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = getSetCookie
    ? getSetCookie.call(headers)
    : headers
        .get("set-cookie")
        ?.split(/,(?=[^;,]+=)/)
        .map((cookie) => cookie.trim()) ?? [];
  for (const cookie of cookies) {
    const [pair] = cookie.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
};

const fetchKoreapas = async (
  jar: Map<string, string>,
  input: string,
  init: KoreapasRequestInit = {},
): Promise<Response> => {
  let url = input;
  let request = init;
  for (let redirects = 0; redirects < 6; redirects += 1) {
    const headers = new Headers(request.headers);
    headers.set("User-Agent", GOPAS_BROWSER_USER_AGENT);
    headers.set("Cookie", [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; "));
    const response = await fetch(url, {
      ...request,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    saveCookies(jar, response.headers);
    const location = response.headers.get("location");
    if (!location || response.status < 300 || response.status >= 400) return response;
    url = new URL(location, url).toString();
    request = { method: "GET", headers: { Referer: input } };
  }
  throw new Error("Koreapas redirected too many times.");
};

const writeForm = (html: string) => {
  const matched = html.match(/<form\b[^>]*\b(?:id|name)=["']?write2["']?[^>]*>([\s\S]*?)<\/form>/i);
  if (!matched) throw new Error("Koreapas write form was not available after login.");
  const form = matched[0];
  const action = formAttribute(form.slice(0, form.indexOf(">") + 1), "action");
  if (!action) throw new Error("Koreapas write form action was not available.");
  const hidden = [...matched[1].matchAll(/<input\b[^>]*>/gi)].reduce<Record<string, string>>((fields, match) => {
    const input = match[0];
    if (formAttribute(input, "type").toLowerCase() !== "hidden") return fields;
    const name = formAttribute(input, "name");
    if (name) fields[name] = formAttribute(input, "value");
    return fields;
  }, {});
  return { action, hidden };
};

const publishToKoreapas = async (title: string, content: string): Promise<string> => {
  const userId = Deno.env.get("KOREAPAS_USER_ID")?.trim();
  const password = Deno.env.get("KOREAPAS_PASSWORD")?.trim();
  if (!userId || !password) throw new Error("Koreapas credentials are not configured.");

  const jar = new Map<string, string>();
  const loginPage = await fetchKoreapas(jar, GOPAS_LOGIN_URL);
  if (!loginPage.ok) throw new Error(`Koreapas login page returned ${loginPage.status}.`);
  const login = await fetchKoreapas(jar, GOPAS_LOGIN_SUBMIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: GOPAS_LOGIN_URL, Origin: "https://www.koreapas.com" },
    body: encodeEucKrForm({ s_url: "/m/fast_menu_index.php", auto_login: "1", user_id: userId, password, group_no: "1" }),
  });
  if (!login.ok) throw new Error(`Koreapas login returned ${login.status}.`);

  const writePage = await fetchKoreapas(jar, GOPAS_WRITE_URL, { headers: { Referer: GOPAS_LOGIN_URL } });
  if (!writePage.ok) throw new Error(`Koreapas write page returned ${writePage.status}.`);
  const writeHtml = await writePage.text();
  if (/name=["']?zb_login/i.test(writeHtml)) {
    throw new Error("Koreapas login did not create an authenticated write session.");
  }
  const { action, hidden } = writeForm(writeHtml);
  const submit = await fetchKoreapas(jar, new URL(action, GOPAS_WRITE_URL).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: GOPAS_WRITE_URL, Origin: "https://www.koreapas.com" },
    body: encodeEucKrForm({ ...hidden, subject: title, sitelink1: "", use_html: "1", memo: content, agreement: "1" }),
  });
  if (!submit.ok) throw new Error(`Koreapas post submission returned ${submit.status}.`);
  const resultBytes = new Uint8Array(await submit.arrayBuffer());
  const result = Encoding.convert(resultBytes, { from: "EUC-KR", to: "UNICODE", type: "string" }) as string;
  if (/write2|name=["']?subject/i.test(result)) throw new Error("Koreapas did not accept the advert submission.");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await hasAdvertOnGopasFirstPage(title)) return GOPAS_FREE_AD_URL;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Koreapas did not show the submitted advert on the first free-ad page.");
};

const callKoreapasPublisher = async (
  action: "publish" | "performance",
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> => {
  const endpoint = Deno.env.get("KOREAPAS_PUBLISHER_URL")?.trim() || "";
  if (!endpoint) return null;

  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("Publisher must use HTTPS");
  } catch {
    throw new Error("Gopas publisher endpoint is invalid.");
  }

  const token = Deno.env.get("KOREAPAS_PUBLISHER_TOKEN")?.trim();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Gopas publisher responded with ${response.status}.`);

  const body = (await response.json()) as unknown;
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
};

const readMetrics = (value: unknown): Metrics => {
  const data = (value ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    impressions: num(data.impressions),
    clicks: num(data.clicks),
    signups: num(data.signups),
    likes: num(data.likes),
    comments: num(data.comments),
  };
};

// Pull fresh numbers for everything we have already posted, and roll them into a
// snapshot stored on the run.
const refreshPriorPostPerformance = async (): Promise<Metrics & { trackedPosts: number }> => {
  const a = admin();
  const { data: posts } = await a
    .from("growth_posts")
    .select("id, run_id, external_url, metrics")
    .eq("channel", KOREAPAS_CHANNEL)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = posts ?? [];
  const externalPosts = rows
    .filter((post: Record<string, unknown>) => typeof post.external_url === "string" && post.external_url)
    .map((post: Record<string, unknown>) => ({ id: post.id, externalPostUrl: post.external_url }));

  let remotePosts: unknown[] = [];
  if (externalPosts.length) {
    try {
      const remote = await callKoreapasPublisher("performance", { posts: externalPosts });
      remotePosts = Array.isArray(remote?.posts) ? (remote.posts as unknown[]) : [];
    } catch (error) {
      console.warn("Publisher performance lookup failed; keeping stored metrics.", error);
    }
  }

  const publisherMetrics = new Map<string, Metrics>();
  remotePosts.forEach((entry) => {
    const data = (entry ?? {}) as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id : "";
    if (id) publisherMetrics.set(id, readMetrics(data.metrics ?? data));
  });

  const totals: Metrics & { trackedPosts: number } = { trackedPosts: rows.length, ...emptyMetrics() };
  for (const post of rows as Array<Record<string, unknown>>) {
    const stored = readMetrics(post.metrics);
    const external = publisherMetrics.get(String(post.id));
    // Clicks are counted by our /r redirect and signups are attributed server-side;
    // other metrics, if supplied, come from Koreapas.
    const metrics: Metrics = external
      ? { ...external, clicks: stored.clicks, signups: stored.signups }
      : stored;

    totals.impressions += metrics.impressions;
    totals.clicks += metrics.clicks;
    totals.signups += metrics.signups;
    totals.likes += metrics.likes;
    totals.comments += metrics.comments;

    if (external) {
      const updatedAt = new Date().toISOString();
      await a
        .from("growth_posts")
        .update({ metrics, updated_at: updatedAt })
        .eq("id", post.id);
      if (typeof post.run_id === "string" && post.run_id) {
        await a
          .from("marketing_cron_runs")
          .update({
            performance: { trackedPosts: 1, ...metrics },
            performance_checked_at: updatedAt,
          })
          .eq("id", post.run_id);
      }
    }
  }
  return totals;
};

// A request can reach a channel before a timeout or verification error is reported.
// Treat every recent attempt as a publish for cooldown purposes, so manual retries
// and overlapping schedules cannot create successive posts.
const recentChannelAttempt = async (channel: Channel, startedAt: string): Promise<string | null> => {
  const cutoff = new Date(new Date(startedAt).getTime() - CHANNEL_MIN_POST_INTERVAL_MS[channel]).toISOString();
  const { data, error } = await admin()
    .from("growth_posts")
    .select("created_at")
    .eq("channel", channel)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.created_at === "string" ? data.created_at : null;
};

// ------------------------------------------------------------------- run flow
type RunSettings = {
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: TemplatePhoto[];
  // Absent on runs created before Threads/Instagram support.
  threadsText?: string;
  instagramCaption?: string;
};

const clearRunLease = async (runId: string, templateId: string | null, completedAt: string) => {
  const { error: leaseError } = await admin()
    .from("growth_config")
    .update({
      active_run_id: null,
      active_run_lease_until: null,
      updated_at: completedAt,
    })
    .eq("id", CONFIG_ROW)
    .eq("active_run_id", runId);
  if (leaseError) throw new Error(leaseError.message);
  if (templateId) {
    const { error: templateError } = await admin()
      .from("marketing_templates")
      .update({ last_run_at: completedAt, updated_at: completedAt })
      .eq("id", templateId);
    if (templateError) throw new Error(templateError.message);
  }
};

// ------------------------------------------------------- Threads / Instagram
const ACCOUNTS = "marketing_channel_accounts";
const channelLabel = (channel: Channel) =>
  channel === "threads" ? "Threads" : channel === "instagram" ? "Instagram" : "Gopas";

const loadChannelAccount = async (channel: SocialChannel): Promise<ChannelAccount | null> => {
  const { data, error } = await admin()
    .from(ACCOUNTS)
    .select("account_id, username, access_token")
    .eq("channel", channel)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.access_token || !data?.account_id) return null;
  return {
    channel,
    accountId: String(data.account_id),
    username: String(data.username ?? ""),
    accessToken: String(data.access_token),
  };
};

// Builds the exact text a channel receives. Threads gets the tracking link (it is
// clickable there); Instagram captions cannot hold clickable links, so the admin puts
// the run's tracking URL in the profile link instead.
const socialPostContent = (
  channel: SocialChannel,
  settings: RunSettings,
  trackingUrl: string,
  scheduledForMillis: number,
): string => {
  if (channel === "threads") {
    const text = resolveTemplateVariables(settings.threadsText ?? "", scheduledForMillis).trim();
    if (!text) throw new Error("This template has no Threads text.");
    const linked = settings.destinationUrl ? text.replaceAll(settings.destinationUrl, trackingUrl) : text;
    const content = linked.includes(trackingUrl) ? linked : `${linked}\n\n${trackingUrl}`;
    if (content.length > THREADS_TEXT_LIMIT) {
      throw new Error(
        `Threads text is ${content.length} characters including the tracking link; the limit is ${THREADS_TEXT_LIMIT}.`,
      );
    }
    return content;
  }
  const caption = resolveTemplateVariables(settings.instagramCaption ?? "", scheduledForMillis).trim();
  if (!caption) throw new Error("This template has no Instagram caption.");
  if (caption.length > INSTAGRAM_CAPTION_LIMIT) {
    throw new Error(`Instagram caption is longer than ${INSTAGRAM_CAPTION_LIMIT} characters.`);
  }
  if ((settings.photos ?? []).length === 0) throw new Error("Instagram posts need at least one photo.");
  return caption;
};

const executeSocialRun = async (input: {
  runId: string;
  channel: SocialChannel;
  settings: RunSettings;
  templateId: string | null;
  scheduledForMillis: number;
  startedAt: string;
  options: { bypassCooldown?: boolean };
}) => {
  const { runId, channel, settings, templateId, scheduledForMillis, startedAt, options } = input;
  const a = admin();
  const performance = { trackedPosts: 0, ...emptyMetrics() };
  const photos = settings.photos ?? [];
  let postId = "";

  try {
    const account = await loadChannelAccount(channel);
    if (!account) {
      throw new Error(`${channelLabel(channel)} is not connected. Connect it in the marketing admin first.`);
    }
    const postTitle = resolveTemplateVariables(settings.title ?? "", scheduledForMillis);
    const code = trackingCode(channel);
    const trackingUrl = `${TRACKING_DOMAIN}/r/${code}`;
    const content = socialPostContent(channel, settings, trackingUrl, scheduledForMillis);

    const previousAttemptAt = await recentChannelAttempt(channel, startedAt);
    if (previousAttemptAt && !options.bypassCooldown) {
      const completedAt = new Date().toISOString();
      await a
        .from("marketing_cron_runs")
        .update({
          status: "skipped",
          post_title: postTitle,
          post_copy: content,
          photos,
          performance,
          completed_at: completedAt,
          error: `${channelLabel(channel)} posting cooldown is active after the ${previousAttemptAt} attempt.`,
        })
        .eq("id", runId);
      await clearRunLease(runId, templateId, completedAt);
      return;
    }

    postId = crypto.randomUUID();
    const { error: postInsertError } = await a.from("growth_posts").insert({
      id: postId,
      channel,
      title: postTitle,
      content,
      destination_url: settings.destinationUrl,
      tracking_code: code,
      hidden_post_id: "",
      photos,
      status: "posting",
      run_id: runId,
      metrics: emptyMetrics(),
      created_at: startedAt,
      updated_at: startedAt,
    });
    if (postInsertError) throw new Error(postInsertError.message);

    const imageUrls = photos.map((photo) => photo.url);
    const published =
      channel === "threads"
        ? await publishToThreads(account, content, imageUrls)
        : await publishToInstagram(account, content, imageUrls);

    const completedAt = new Date().toISOString();
    await a
      .from("growth_posts")
      .update({
        status: "posted",
        external_url: published.permalink,
        external_id: published.mediaId,
        publisher_status: "graph_api",
        posted_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", postId);
    await a
      .from("marketing_cron_runs")
      .update({
        status: "completed",
        post_id: postId,
        post_title: postTitle,
        post_copy: content,
        tracking_code: code,
        tracking_url: trackingUrl,
        hidden_post_id: "",
        external_post_url: published.permalink,
        photos,
        performance,
        performance_checked_at: completedAt,
        completed_at: completedAt,
        error: "",
      })
      .eq("id", runId);
    await clearRunLease(runId, templateId, completedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const completedAt = new Date().toISOString();
    await a
      .from("marketing_cron_runs")
      .update({ status: "failed", completed_at: completedAt, error: message })
      .eq("id", runId);
    if (postId) {
      await a
        .from("growth_posts")
        .update({ status: "failed", publisher_status: "publisher_failed", updated_at: completedAt })
        .eq("id", postId);
    }
    await clearRunLease(runId, templateId, completedAt);
  }
};

// Pull Threads/Instagram insights for recent posts. Clicks (our /r redirect) and
// signups stay server-owned; only views, likes and comments come from Meta.
const refreshSocialPerformance = async () => {
  const a = admin();
  const since = new Date(Date.now() - SOCIAL_METRICS_WINDOW_MS).toISOString();
  for (const channel of SOCIAL_CHANNELS) {
    const account = await loadChannelAccount(channel).catch(() => null);
    if (!account) continue;
    const { data: posts } = await a
      .from("growth_posts")
      .select("id, run_id, external_id, metrics, metrics_24h, posted_at, updated_at")
      .eq("channel", channel)
      .eq("status", "posted")
      .neq("external_id", "")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30);
    for (const post of (posts ?? []) as Array<Record<string, unknown>>) {
      // refresh-performance runs every 10 minutes; hourly per post keeps well inside
      // Meta's per-account API limits.
      const lastUpdated = new Date(String(post.updated_at ?? 0)).getTime();
      if (Number.isFinite(lastUpdated) && Date.now() - lastUpdated < SOCIAL_METRICS_MIN_INTERVAL_MS) continue;
      try {
        const social = await fetchMediaMetrics(account, String(post.external_id));
        const metrics: Metrics = { ...readMetrics(post.metrics), ...social };
        const updatedAt = new Date().toISOString();
        // The first reading after a day becomes the post's 24-hour score, which the
        // daily-post time optimizer compares across slots.
        const postedAt = new Date(String(post.posted_at ?? "")).getTime();
        const snapshot =
          !post.metrics_24h && Number.isFinite(postedAt) && Date.now() - postedAt >= 24 * 60 * 60 * 1000
            ? { metrics_24h: metrics }
            : {};
        await a.from("growth_posts").update({ metrics, ...snapshot, updated_at: updatedAt }).eq("id", post.id);
        if (typeof post.run_id === "string" && post.run_id) {
          await a
            .from("marketing_cron_runs")
            .update({ performance: { trackedPosts: 1, ...metrics }, performance_checked_at: updatedAt })
            .eq("id", post.run_id);
        }
      } catch (error) {
        console.warn(`${channel} insights lookup failed for ${post.id}:`, error instanceof Error ? error.message : error);
      }
    }
  }
};

// Long-lived tokens expire after ~60 days. Refresh each one weekly; after a failure
// wait six hours before trying again so a revoked token does not hammer the API.
const refreshChannelTokens = async () => {
  const a = admin();
  const { data } = await a
    .from(ACCOUNTS)
    .select("channel, access_token, token_refreshed_at, connected_at, last_error, updated_at");
  const now = Date.now();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const channel = row.channel;
    if (!isSocialChannel(channel) || typeof row.access_token !== "string" || !row.access_token) continue;
    const lastRefresh = new Date(String(row.token_refreshed_at ?? row.connected_at ?? 0)).getTime();
    if (Number.isFinite(lastRefresh) && now - lastRefresh < TOKEN_REFRESH_AFTER_MS) continue;
    const lastAttempt = new Date(String(row.updated_at ?? 0)).getTime();
    if (row.last_error && Number.isFinite(lastAttempt) && now - lastAttempt < 6 * 60 * 60 * 1000) continue;
    const updatedAt = new Date().toISOString();
    try {
      const refreshed = await refreshAccessToken(channel, row.access_token);
      await a
        .from(ACCOUNTS)
        .update({
          access_token: refreshed.accessToken,
          token_expires_at: refreshed.expiresAt.toISOString(),
          token_refreshed_at: updatedAt,
          last_error: "",
          updated_at: updatedAt,
        })
        .eq("channel", channel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token refresh failed.";
      await a.from(ACCOUNTS).update({ last_error: message, updated_at: updatedAt }).eq("channel", channel);
    }
  }
};

const executeRun = async (runId: string, options: { bypassCooldown?: boolean } = {}) => {
  const a = admin();
  const { data: run } = await a
    .from("marketing_cron_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return;

  const settings = (run.settings ?? {}) as RunSettings;
  const templateId = typeof run.template_id === "string" ? run.template_id : null;
  const scheduledForMillis = run.scheduled_for ? new Date(run.scheduled_for).getTime() : Date.now();
  const startedAt = new Date().toISOString();
  let postId = "";

  await a
    .from("marketing_cron_runs")
    .update({ status: "running", started_at: startedAt, error: "" })
    .eq("id", runId);

  const channel: Channel = isChannel(run.channel) ? run.channel : KOREAPAS_CHANNEL;
  if (isSocialChannel(channel)) {
    await executeSocialRun({ runId, channel, settings, templateId, scheduledForMillis, startedAt, options });
    return;
  }

  try {
    const performance = await refreshPriorPostPerformance();
    const postTitle = resolveTemplateVariables(settings.title ?? "", scheduledForMillis);
    const code = trackingCode();
    const trackingUrl = `${TRACKING_DOMAIN}/r/${code}`;
    const marker = hiddenPostId(code);
    const postCopy = replaceDestinationWithTrackingLink(buildPostCopy(
      settings.photos ?? [],
      trackingUrl,
      resolveTemplateVariables(settings.copy ?? "", scheduledForMillis),
      resolveTemplateVariables(settings.callToAction ?? "", scheduledForMillis),
    ), settings.destinationUrl ?? "", trackingUrl);

    if (await hasAdvertOnGopasFirstPage(postTitle)) {
      const completedAt = new Date().toISOString();
      await a
        .from("marketing_cron_runs")
        .update({
          status: "skipped",
          post_title: postTitle,
          post_copy: postCopy,
          photos: settings.photos ?? [],
          performance,
          performance_checked_at: completedAt,
          completed_at: completedAt,
          error: "A matching advert is already on the first Gopas free-ad page.",
        })
        .eq("id", runId);
      await clearRunLease(runId, templateId, completedAt);
      return;
    }

    const previousAttemptAt = await recentChannelAttempt(KOREAPAS_CHANNEL, startedAt);
    if (previousAttemptAt && !options.bypassCooldown) {
      const completedAt = new Date().toISOString();
      await a
        .from("marketing_cron_runs")
        .update({
          status: "skipped",
          post_title: postTitle,
          post_copy: postCopy,
          photos: settings.photos ?? [],
          performance,
          performance_checked_at: completedAt,
          completed_at: completedAt,
          error: `Koreapas posting cooldown is active after the ${previousAttemptAt} attempt.`,
        })
        .eq("id", runId);
      await clearRunLease(runId, templateId, completedAt);
      return;
    }

    postId = crypto.randomUUID();
    const submittedCopy = contentForKoreapas(postCopy, trackingUrl, marker);

    const { error: postInsertError } = await a.from("growth_posts").insert({
      id: postId,
      channel: KOREAPAS_CHANNEL,
      title: postTitle,
      content: submittedCopy,
      destination_url: settings.destinationUrl,
      tracking_code: code,
      hidden_post_id: marker,
      photos: settings.photos ?? [],
      status: "posting",
      run_id: runId,
      metrics: emptyMetrics(),
      created_at: startedAt,
      updated_at: startedAt,
    });
    if (postInsertError) throw new Error(postInsertError.message);

    const completedAt = new Date().toISOString();
    const published = await callKoreapasPublisher("publish", {
      title: postTitle,
      content: submittedCopy,
      trackingUrl,
      hiddenPostId: marker,
      destinationUrl: settings.destinationUrl,
      photos: settings.photos ?? [],
      useHtml: true,
    });

    if (!published) {
      // The scheduler remains auditable while the browser service is not configured.
      await a
        .from("growth_posts")
        .update({ status: "prepared", publisher_status: "not_configured", updated_at: completedAt })
        .eq("id", postId);
      await a
        .from("marketing_cron_runs")
        .update({
          status: "awaitingPublisher",
          post_id: postId,
          post_title: postTitle,
          post_copy: postCopy,
          tracking_code: code,
          tracking_url: trackingUrl,
          hidden_post_id: marker,
          photos: settings.photos ?? [],
          performance,
          performance_checked_at: completedAt,
          completed_at: completedAt,
          error: "Gopas publisher is not configured.",
        })
        .eq("id", runId);
      await clearRunLease(runId, templateId, completedAt);
      return;
    }

    const externalPostUrl = typeof published.postUrl === "string" ? published.postUrl : "";
    if (!externalPostUrl) throw new Error("Gopas publisher did not return a verified post URL.");
    await a
      .from("growth_posts")
      .update({
        status: "posted",
        external_url: externalPostUrl,
        publisher_status: "cloud_run",
        posted_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", postId);
    await a
      .from("marketing_cron_runs")
      .update({
        status: "completed",
        post_id: postId,
        post_title: postTitle,
        post_copy: postCopy,
        tracking_code: code,
        tracking_url: trackingUrl,
        hidden_post_id: marker,
        external_post_url: externalPostUrl,
        photos: settings.photos ?? [],
        performance,
        performance_checked_at: completedAt,
        completed_at: completedAt,
        error: "",
      })
      .eq("id", runId);
    await clearRunLease(runId, templateId, completedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const completedAt = new Date().toISOString();
    await a
      .from("marketing_cron_runs")
      .update({ status: "failed", completed_at: completedAt, error: message })
      .eq("id", runId);
    if (postId) {
      await a
        .from("growth_posts")
        .update({ status: "failed", publisher_status: "publisher_failed", updated_at: completedAt })
        .eq("id", postId);
    }
    await clearRunLease(runId, templateId, completedAt);
  }
};

// Claim the right to run. The lease check and the write happen in one statement, so a
// scheduled tick and a manual run cannot both win.
const claimRun = async (
  trigger: "schedule" | "manual",
  requestedTemplateId?: string,
): Promise<string | null> => {
  const a = admin();
  const now = new Date();
  const nowIso = now.toISOString();

  let template: Record<string, unknown> | null = null;
  let scheduledFor = now;

  if (trigger === "schedule") {
    const { data } = await a
      .from("marketing_templates")
      .select("*")
      .eq("schedule_enabled", true)
      .not("next_run_at", "is", null)
      .lte("next_run_at", nowIso)
      .order("next_run_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    template = data as Record<string, unknown>;
    scheduledFor = new Date(String(template.next_run_at));
  } else {
    const templateId = validTemplateId(requestedTemplateId);
    const { data } = await a
      .from("marketing_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();
    if (!data) return null;
    template = data as Record<string, unknown>;
  }

  const templateId = String(template.id ?? "");
  const schedule = validSchedule(template.schedule);

  // All templates share one publisher, so this short global lease prevents two
  // independent template schedules from posting concurrently.
  const leaseUntil = new Date(now.getTime() + RUN_LEASE_MS).toISOString();
  const runId = crypto.randomUUID();
  const { data: leased } = await a
    .from("growth_config")
    .update({
      active_run_id: runId,
      active_run_lease_until: leaseUntil,
      updated_at: nowIso,
    })
    .eq("id", CONFIG_ROW)
    .or(`active_run_lease_until.is.null,active_run_lease_until.lt.${nowIso}`)
    .select("active_run_id");
  if (!leased || leased.length === 0) return null;

  try {
    if (trigger === "schedule") {
      const nextRunAt = nextScheduledAt(schedule, now.getTime()).toISOString();
      const { error } = await a
        .from("marketing_templates")
        .update({ next_run_at: nextRunAt, updated_at: nowIso })
        .eq("id", templateId)
        .eq("next_run_at", template.next_run_at);
      if (error) throw new Error(error.message);
    }

    // Validated after the schedule advanced, so a broken template fails once per
    // slot instead of blocking every later tick.
    const channels = validChannels(template.channels ?? [KOREAPAS_CHANNEL]);
    const runSettings: RunSettings = {
      destinationUrl: validDestinationUrl(template.destination_url),
      title: textField(template.title, "Title", 200),
      copy: channels.includes(KOREAPAS_CHANNEL)
        ? textField(template.copy, "Copy", 20000)
        : String(template.copy ?? ""),
      callToAction: String(template.call_to_action ?? ""),
      photos: validPhotos(template.photos),
      threadsText: String(template.threads_text ?? ""),
      instagramCaption: String(template.instagram_caption ?? ""),
    };

    // One run per channel. The first holds the lease and runs now; the rest stay
    // queued for the next ticks (claimQueuedRun). created_at is staggered by a
    // millisecond so the queue keeps the channel order.
    const { error: insertError } = await a.from("marketing_cron_runs").insert(
      channels.map((channel, index) => ({
        id: index === 0 ? runId : crypto.randomUUID(),
        template_id: templateId,
        channel,
        trigger,
        status: "queued",
        scheduled_for: scheduledFor.toISOString(),
        settings: runSettings,
        performance: { trackedPosts: 0, ...emptyMetrics() },
        created_at: new Date(now.getTime() + index).toISOString(),
      })),
    );
    if (insertError) throw new Error(insertError.message);

    return runId;
  } catch (error) {
    await clearRunLease(runId, null, nowIso).catch((leaseError) =>
      console.error("Unable to clear the failed marketing run lease.", leaseError),
    );
    throw error;
  }
};

// ------------------------------------------------------------- daily posts
// Admin-approved daily posts (social_daily_posts, drafted by the web app's nightly
// cron). Each publish is recorded as a marketing_cron_runs row (trigger 'daily') and a
// growth_posts row, so run history, tracking links and insights work as for templates.
const DAILY_POSTS = "social_daily_posts";
// Daily posts promote One Cup Daily, so their tracking links land on its page.
const DAILY_DESTINATION = "https://1cupenglish.com/daily";

type DailyPostRow = {
  id: string;
  channel: SocialChannel;
  format: string;
  pillar: string;
  scheduled_for: string | null;
  content: Record<string, unknown>;
  media: Array<{ url?: string; kind?: string }>;
};

// Expire drafts nobody approved in time, then claim the oldest approved post that is due.
const claimDailyPost = async (): Promise<{ post: DailyPostRow; runId: string } | null> => {
  const a = admin();
  const now = new Date();
  const nowIso = now.toISOString();
  await a
    .from(DAILY_POSTS)
    .update({ status: "expired", error: "Not approved before its posting time.", updated_at: nowIso })
    .eq("status", "draft")
    .lt("scheduled_for", nowIso);
  // A publish that never finished (e.g. the function hit its time limit while Instagram
  // was still processing a reel) must not stay "publishing" forever.
  await a
    .from(DAILY_POSTS)
    .update({
      status: "failed",
      error: "Publishing did not finish. Check the account before approving it again.",
      updated_at: nowIso,
    })
    .eq("status", "publishing")
    .lt("updated_at", new Date(now.getTime() - 15 * 60 * 1000).toISOString());

  const { data: due } = await a
    .from(DAILY_POSTS)
    .select("id, channel, format, pillar, scheduled_for, content, media")
    .eq("status", "approved")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!due || !isSocialChannel(due.channel)) return null;

  const runId = crypto.randomUUID();
  const { data: leased } = await a
    .from("growth_config")
    .update({
      active_run_id: runId,
      active_run_lease_until: new Date(now.getTime() + RUN_LEASE_MS).toISOString(),
      updated_at: nowIso,
    })
    .eq("id", CONFIG_ROW)
    .or(`active_run_lease_until.is.null,active_run_lease_until.lt.${nowIso}`)
    .select("active_run_id");
  if (!leased || leased.length === 0) return null;

  // Only one claimer can move it out of 'approved'.
  const { data: claimed } = await a
    .from(DAILY_POSTS)
    .update({ status: "publishing", run_id: runId, updated_at: nowIso })
    .eq("id", due.id)
    .eq("status", "approved")
    .select("id");
  if (!claimed || claimed.length === 0) {
    await clearRunLease(runId, null, nowIso);
    return null;
  }
  return { post: due as DailyPostRow, runId };
};

const stringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];

// The tracking link rides on the last part of a thread; if it does not fit there it
// becomes its own short reply.
// Every daily post carries the One Cup Daily link as text. Threads makes the tracking
// link clickable, so it goes at the end of the first post (falling back to the last
// reply, then to a reply of its own, if 500 characters would be exceeded). Instagram
// captions cannot hold clickable links, so they get the short, typeable address.
const DAILY_LINK_LABEL = "☕ 원컵데일리 하루 무료로 받아보기 👉";
const DAILY_LINK_TEXT = "1cupenglish.com/daily";

const threadParts = (content: Record<string, unknown>, trackingUrl: string): string[] => {
  const parts = [String(content.text ?? "").trim(), ...stringList(content.replies).map((reply) => reply.trim())].filter(Boolean);
  if (parts.length === 0) throw new Error("This daily post has no Threads text.");
  const linkLine = `${DAILY_LINK_LABEL} ${trackingUrl}`;
  const first = `${parts[0]}\n\n${linkLine}`;
  const last = `${parts[parts.length - 1]}\n\n${linkLine}`;
  if (first.length <= THREADS_TEXT_LIMIT) parts[0] = first;
  else if (last.length <= THREADS_TEXT_LIMIT) parts[parts.length - 1] = last;
  else parts.push(linkLine);
  const tooLong = parts.find((part) => part.length > THREADS_TEXT_LIMIT);
  if (tooLong) throw new Error(`A Threads part is ${tooLong.length} characters; the limit is ${THREADS_TEXT_LIMIT}.`);
  return parts;
};

// Put the link line before the closing hashtags, where people read it.
const captionWithDailyLink = (caption: string): string => {
  if (!caption) return caption;
  const linkLine = `${DAILY_LINK_LABEL} ${DAILY_LINK_TEXT}`;
  if (caption.includes(DAILY_LINK_TEXT)) return caption;
  const lines = caption.split("\n");
  let tagStart = lines.length;
  while (tagStart > 0 && /^\s*(#\S+\s*)+$/.test(lines[tagStart - 1])) tagStart -= 1;
  while (tagStart > 0 && lines[tagStart - 1].trim() === "") tagStart -= 1;
  const body = lines.slice(0, tagStart).join("\n").trimEnd();
  const tags = lines.slice(tagStart).join("\n").trim();
  return [body, linkLine, tags].filter(Boolean).join("\n\n").slice(0, INSTAGRAM_CAPTION_LIMIT);
};

const executeDailyPost = async (post: DailyPostRow, runId: string) => {
  const a = admin();
  const channel = post.channel;
  const startedAt = new Date().toISOString();
  const isReel = post.format === "reel";
  const video = (post.media ?? []).find((item) => item?.kind === "video" && typeof item?.url === "string");
  const images = (post.media ?? []).filter((item) => item?.kind !== "video" && typeof item?.url === "string");
  const photos = images.map((item, index) => ({ url: String(item.url), alt: `daily card ${index + 1}` }));
  const code = trackingCode(channel);
  const trackingUrl = `${TRACKING_DOMAIN}/r/${code}`;
  const title =
    channel === "threads"
      ? String(post.content.text ?? "").split("\n")[0].slice(0, 120)
      : String((post.content.slides as Array<Record<string, unknown>> | undefined)?.[0]?.title ?? "").slice(0, 120);
  let postId = "";

  await a.from("marketing_cron_runs").insert({
    id: runId,
    template_id: null,
    channel,
    trigger: "daily",
    status: "running",
    scheduled_for: post.scheduled_for ?? startedAt,
    started_at: startedAt,
    settings: { dailyPostId: post.id, pillar: post.pillar },
    performance: { trackedPosts: 0, ...emptyMetrics() },
    created_at: startedAt,
  });

  try {
    const account = await loadChannelAccount(channel);
    if (!account) throw new Error(`${channelLabel(channel)} is not connected.`);

    const parts = channel === "threads" ? threadParts(post.content, trackingUrl) : [];
    const caption = channel === "instagram" ? captionWithDailyLink(String(post.content.caption ?? "").trim()) : "";
    if (channel === "instagram") {
      if (!caption) throw new Error("This daily post has no Instagram caption.");
      if (isReel && !video) throw new Error("This daily reel has no video.");
      if (!isReel && photos.length === 0) throw new Error("This daily post has no card images.");
    }
    const content = channel === "threads" ? parts.join("\n\n—\n\n") : caption;

    postId = crypto.randomUUID();
    const { error: postInsertError } = await a.from("growth_posts").insert({
      id: postId,
      channel,
      title,
      content,
      destination_url: DAILY_DESTINATION,
      tracking_code: code,
      hidden_post_id: "",
      photos,
      status: "posting",
      run_id: runId,
      metrics: emptyMetrics(),
      created_at: startedAt,
      updated_at: startedAt,
    });
    if (postInsertError) throw new Error(postInsertError.message);

    let published: { mediaId: string; permalink: string };
    let replyError = "";
    if (channel === "threads") {
      // The first post carries the media: a video, or the card images (none for a text post).
      published = await publishToThreads(account, parts[0], video ? [] : photos.map((photo) => photo.url), video ? String(video.url) : undefined);
      // The first post is live from here on. Record it before posting the replies, so a
      // reply failure can never make the post look unpublished (and invite a duplicate).
      await a
        .from("growth_posts")
        .update({ external_url: published.permalink, external_id: published.mediaId, updated_at: new Date().toISOString() })
        .eq("id", postId);
      try {
        await publishThreadsReplies(account, published.mediaId, parts.slice(1));
      } catch (error) {
        replyError = `The first post is live but its replies failed: ${error instanceof Error ? error.message : "unknown error"}`;
      }
    } else if (isReel && video) {
      published = await publishInstagramReel(account, String(video.url), caption, photos[0]?.url);
    } else {
      published = await publishToInstagram(account, caption, photos.map((photo) => photo.url));
    }

    const completedAt = new Date().toISOString();
    await a
      .from("growth_posts")
      .update({
        status: "posted",
        external_url: published.permalink,
        external_id: published.mediaId,
        publisher_status: "graph_api",
        posted_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", postId);
    await a
      .from("marketing_cron_runs")
      .update({
        status: "completed",
        post_id: postId,
        post_title: title,
        post_copy: content,
        tracking_code: code,
        tracking_url: trackingUrl,
        external_post_url: published.permalink,
        photos,
        completed_at: completedAt,
        performance_checked_at: completedAt,
        error: replyError,
      })
      .eq("id", runId);
    await a
      .from(DAILY_POSTS)
      .update({
        status: "published",
        growth_post_id: postId,
        external_url: published.permalink,
        published_at: completedAt,
        error: replyError,
        updated_at: completedAt,
      })
      .eq("id", post.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const completedAt = new Date().toISOString();
    await a.from("marketing_cron_runs").update({ status: "failed", completed_at: completedAt, error: message }).eq("id", runId);
    await a.from(DAILY_POSTS).update({ status: "failed", error: message, updated_at: completedAt }).eq("id", post.id);
    if (postId) {
      await a
        .from("growth_posts")
        .update({ status: "failed", publisher_status: "publisher_failed", updated_at: completedAt })
        .eq("id", postId);
    }
  } finally {
    await clearRunLease(runId, null, new Date().toISOString());
  }
};

// Publish the oldest queued channel run (left by a multi-channel template). Runs that
// waited longer than QUEUED_RUN_MAX_AGE_MS are failed instead of posting stale copy.
const claimQueuedRun = async (): Promise<string | null> => {
  const a = admin();
  const now = new Date();
  const nowIso = now.toISOString();
  await a
    .from("marketing_cron_runs")
    .update({ status: "failed", completed_at: nowIso, error: "Expired in the queue before it could be published." })
    .eq("status", "queued")
    .lt("created_at", new Date(now.getTime() - QUEUED_RUN_MAX_AGE_MS).toISOString());

  const { data: queued } = await a
    .from("marketing_cron_runs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!queued?.id) return null;

  const runId = String(queued.id);
  const { data: leased } = await a
    .from("growth_config")
    .update({
      active_run_id: runId,
      active_run_lease_until: new Date(now.getTime() + RUN_LEASE_MS).toISOString(),
      updated_at: nowIso,
    })
    .eq("id", CONFIG_ROW)
    .or(`active_run_lease_until.is.null,active_run_lease_until.lt.${nowIso}`)
    .select("active_run_id");
  if (!leased || leased.length === 0) return null;
  return runId;
};

const requireAdmin = async (req: Request): Promise<string> => {
  const uid = await callerUid(req);
  if (!uid) throw new Error("unauthenticated");
  const { data } = await admin().from("users").select("account_status").eq("uid", uid).maybeSingle();
  if (data?.account_status !== "admin") throw new Error("permission-denied");
  return uid;
};

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const a = admin();

  try {
    // pg_cron calls these with the private scheduler header and no user session.
    if (action === "tick" || action === "refresh-performance") {
      const { data: schedulerSecret, error: schedulerSecretError } = await a.rpc(
        "marketing_scheduler_secret",
      );
      if (
        schedulerSecretError ||
        typeof schedulerSecret !== "string" ||
        !schedulerSecret ||
        req.headers.get("x-marketing-scheduler-secret") !== schedulerSecret
      ) {
        return json(req, { error: "permission-denied" }, 403);
      }
      if (action === "refresh-performance") {
        const performance = await refreshPriorPostPerformance();
        await refreshSocialPerformance().catch((error) =>
          console.warn("Social performance refresh failed:", error instanceof Error ? error.message : error),
        );
        await refreshChannelTokens().catch((error) =>
          console.warn("Channel token refresh failed:", error instanceof Error ? error.message : error),
        );
        return json(req, { refreshed: true, performance });
      }
      const queuedRunId = await claimQueuedRun();
      if (!queuedRunId) {
        const daily = await claimDailyPost();
        if (daily) {
          await executeDailyPost(daily.post, daily.runId);
          return json(req, { ran: true, runId: daily.runId, dailyPostId: daily.post.id });
        }
      }
      const runId = queuedRunId ?? (await claimRun("schedule"));
      if (!runId) return json(req, { ran: false });
      // This is only reachable with the private scheduler secret. It is used
      // for an explicitly authorized operational test; pg_cron never sets it.
      await executeRun(runId, { bypassCooldown: body.force === true });
      return json(req, { ran: true, runId });
    }

    await requireAdmin(req);

    if (action === "save-template-schedule") {
      const s = (body.settings ?? {}) as Record<string, unknown>;
      const templateId = validTemplateId(s.templateId);
      const schedule = validSchedule(s.schedule);
      const scheduleEnabled = schedule.daysOfWeek.length > 0;
      const nextRunAt = scheduleEnabled
        ? nextScheduledAt(schedule, Date.now()).toISOString()
        : null;

      const { error } = await a
        .from("marketing_templates")
        .update({
          schedule_enabled: scheduleEnabled,
          schedule,
          next_run_at: nextRunAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", templateId);
      if (error) throw new Error(error.message);
      return json(req, { ok: true, nextRunAt });
    }

    if (action === "create-template") {
      const t = (body.template ?? {}) as Record<string, unknown>;
      const templateId = crypto.randomUUID();
      const now = new Date().toISOString();
      const schedule = validSchedule(t.schedule);
      const scheduleEnabled = schedule.daysOfWeek.length > 0;
      const channels = validChannels(t.channels ?? [KOREAPAS_CHANNEL]);
      const photos = validPhotos(t.photos);
      const threadsText = optionalText(t.threadsText, "Threads text", THREADS_TEXT_LIMIT);
      const instagramCaption = optionalText(t.instagramCaption, "Instagram caption", INSTAGRAM_CAPTION_LIMIT);
      if (channels.includes("threads") && !threadsText) throw new Error("Threads text is required.");
      if (channels.includes("instagram") && !instagramCaption) throw new Error("Instagram caption is required.");
      if (channels.includes("instagram") && photos.length === 0) {
        throw new Error("Instagram posts need at least one photo.");
      }
      const { error } = await a.from("marketing_templates").insert({
        id: templateId,
        name: textField(t.name, "Template name", 120),
        destination_url: validDestinationUrl(t.destinationUrl),
        title: textField(t.title, "Title", 200),
        copy: channels.includes(KOREAPAS_CHANNEL)
          ? textField(t.copy, "Copy", 20000)
          : optionalText(t.copy, "Copy", 20000),
        call_to_action: typeof t.callToAction === "string" ? t.callToAction.trim() : "",
        photos,
        channels,
        threads_text: threadsText,
        instagram_caption: instagramCaption,
        schedule_enabled: scheduleEnabled,
        schedule,
        next_run_at: scheduleEnabled ? nextScheduledAt(schedule, Date.now()).toISOString() : null,
        created_at: now,
        updated_at: now,
      });
      if (error) throw new Error(error.message);
      return json(req, { templateId });
    }

    if (action === "ensure-default-template") {
      const { data: existing } = await a
        .from("marketing_templates")
        .select("id")
        .eq("id", ORIGINAL_TEMPLATE_ID)
        .maybeSingle();
      if (!existing) {
        const now = new Date().toISOString();
        await a.from("marketing_templates").insert({
          id: ORIGINAL_TEMPLATE_ID,
          ...ORIGINAL_GOPAS_TEMPLATE,
          schedule_enabled: false,
          schedule: { minute: 0, hour: 19, daysOfWeek: [] },
          created_at: now,
          updated_at: now,
        });
      }
      return json(req, { templateId: ORIGINAL_TEMPLATE_ID });
    }

    if (action === "delete-template") {
      const templateId = validTemplateId(body.templateId);
      const { error } = await a.from("marketing_templates").delete().eq("id", templateId);
      if (error) throw new Error(error.message);
      return json(req, { ok: true });
    }

    if (action === "delete-run") {
      const runId = validRunId(body.runId);
      // This removes only the dashboard history snapshot. The associated growth_posts
      // row stays in place so an already-published post keeps its redirect, clicks,
      // and first-payment attribution intact.
      const { error } = await a.from("marketing_cron_runs").delete().eq("id", runId);
      if (error) throw new Error(error.message);
      return json(req, { ok: true });
    }

    if (action === "generate-template") {
      const template = await generateTemplateDraft(body);
      return json(req, template);
    }

    if (action === "channel-status") {
      const { data, error } = await a
        .from(ACCOUNTS)
        .select("channel, account_id, username, token_expires_at, last_error, connected_at");
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return json(req, {
        channels: SOCIAL_CHANNELS.map((channel) => {
          const row = rows.find((candidate) => candidate.channel === channel);
          return {
            channel,
            connected: Boolean(row),
            username: row ? String(row.username ?? "") : "",
            accountId: row ? String(row.account_id ?? "") : "",
            tokenExpiresAt: row?.token_expires_at ?? null,
            connectedAt: row?.connected_at ?? null,
            lastError: row ? String(row.last_error ?? "") : "",
          };
        }),
      });
    }

    if (action === "connect-channel") {
      const channel = body.channel;
      if (!isSocialChannel(channel)) throw new Error("channel is invalid.");
      const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
      if (!accessToken || accessToken.length > 2048 || /\s/.test(accessToken)) {
        return json(req, { error: "invalid-argument", message: "Access token is invalid." }, 400);
      }
      let account: { accountId: string; username: string };
      try {
        account = await verifyAccessToken(channel, accessToken);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Token verification failed.";
        return json(req, { error: "invalid-argument", message }, 400);
      }
      const now = new Date();
      const { error } = await a.from(ACCOUNTS).upsert({
        channel,
        account_id: account.accountId,
        username: account.username,
        access_token: accessToken,
        // Pasted tokens are long-lived (~60 days); the weekly refresh replaces this
        // estimate with Meta's own expiry.
        token_expires_at: new Date(now.getTime() + TOKEN_LIFETIME_MS).toISOString(),
        token_refreshed_at: null,
        last_error: "",
        connected_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
      if (error) throw new Error(error.message);
      return json(req, { channel, username: account.username, accountId: account.accountId });
    }

    if (action === "disconnect-channel") {
      const channel = body.channel;
      if (!isSocialChannel(channel)) throw new Error("channel is invalid.");
      const { error } = await a.from(ACCOUNTS).delete().eq("channel", channel);
      if (error) throw new Error(error.message);
      return json(req, { ok: true });
    }

    if (action === "run-now") {
      const runId = await claimRun("manual", validTemplateId(body.templateId));
      if (!runId) {
        return json(req, { ran: false, message: "Another run is already in progress." });
      }
      await executeRun(runId);
      return json(req, { ran: true, runId });
    }

    return json(req, { error: "invalid-argument", message: `Unknown action: ${action}` }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "unauthenticated") return json(req, { error: message }, 401);
    if (message === "permission-denied") return json(req, { error: message }, 403);
    console.error("marketing function failed:", message);
    return json(req, { error: "internal", message }, 500);
  }
});
