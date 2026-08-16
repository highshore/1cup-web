import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { randomUUID } from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const CONFIG_REF = db.collection("growth_config").doc("settings");
const RUNS = "marketing_cron_runs";
const POSTS = "growth_posts";
const TEMPLATES = "marketing_templates";
const TRACKING_DOMAIN = "https://1cupenglish.com";
const KOREAPAS_CHANNEL = "koreapas";
const GOPAS_FREE_AD_URL = "https://www.koreapas.com/bbs/zboard.php?id=freead";
const RUN_LEASE_MS = 10 * 60 * 1000;
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const ORIGINAL_TEMPLATE_ID = "gopas_original_meetup";

type CronSchedule = {
  minute: number;
  hour: number;
  daysOfWeek: number[];
};

type TemplatePhoto = {
  url: string;
  alt: string;
};

type CronSettings = {
  enabled: boolean;
  nextRunAt: admin.firestore.Timestamp | null;
  schedule: CronSchedule;
  templateId: string;
  templateAssignments: Record<string, string>;
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: TemplatePhoto[];
  timeZone: string;
};

type Metrics = {
  impressions: number;
  clicks: number;
  signups: number;
  likes: number;
  comments: number;
};

type PerformanceSnapshot = Metrics & { trackedPosts: number };

const emptyMetrics = (): Metrics => ({
  impressions: 0,
  clicks: 0,
  signups: 0,
  likes: 0,
  comments: 0,
});

const ORIGINAL_GOPAS_TEMPLATE = {
  name: "기존 고파스 홍보글",
  destinationUrl: "https://1cupenglish.com/meetup",
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
- 웹사이트에서 결제 및 신청 (1개월 4,700원, 7일 내 전체 환불 가능)
- 모임비는 11월 13일 부로 9,700원으로 인상 예정이니 서두르세요

* 참고: 저희는 컴포트존을 벗어날 때 가장 큰 성장을 할 수 있다는 철학 하에 즉흥적으로 어려운 질문을 던지는 것을 좋아하고, 서로 이의 제기하는 것을 매우 장려합니다.

☕️ 시간 및 장소:
- 시간: 매주 일요일 오전 11시 15분, 2시간 진행
- 장소: 카페 안암동 (https://naver.me/FbONl0Hl), 상황에 따라 변동 가능

💳 참가 비용
- '영어 한잔' 웹사이트(https://1cupenglish.com/meetup)에서 결제 및 밋업 신청 필수 (1개월 4,700원. 11월 인상 예정)
- 결제는 수익이 아니라, 멤버의 책임감 있는 참여와 모임 퀄리티를 보장하기 위한 장치입니다.
- 결제 후 취소 및 환불은 자유입니다 (7일 내 전체 환불 사유 불문 가능, 이후 환불 시점에 따라 부분 환불)

📌 유의사항
- 지각·노쇼 ❌ => 무관용 정책 적용 중
- 아티클 미리 읽기 필수!
- 모임 장소에서 음료는 각자 시키셔야 합니다
- 비매너 시 즉시 퇴장될 수 있어요 🙅‍♂️

🔥 궁금한 점이 있으시면 아래 카톡으로 연락주세요 (모임장과 일대일 오픈챗)
https://open.kakao.com/o/s8f84nvh`,
  callToAction: "✅ 웹사이트\nhttps://1cupenglish.com/meetup",
  photos: [
    {
      url: "https://i.ibb.co/7JmSmDc2/meetup.jpg",
      alt: "1Cup English meetup",
    },
  ] satisfies TemplatePhoto[],
};

const requireAdmin = async (uid: string | undefined) => {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to manage marketing automation.");
  }

  const user = await db.collection("users").doc(uid).get();
  if (user.data()?.account_status !== "admin") {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
};

const textField = (value: unknown, field: string, maxLength: number) => {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", field + " is required.");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", field + " is invalid.");
  }
  return trimmed;
};

const validDestinationUrl = (value: unknown) => {
  const destination = textField(value, "destinationUrl", 1_500);
  try {
    const url = new URL(destination);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw new HttpsError("invalid-argument", "destinationUrl must be a valid URL.");
  }
};

const validPhotos = (value: unknown): TemplatePhoto[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 6) {
    throw new HttpsError("invalid-argument", "photos are invalid.");
  }
  return value.map((photo) => {
    if (!photo || typeof photo !== "object" || Array.isArray(photo)) {
      throw new HttpsError("invalid-argument", "photo is invalid.");
    }
    const data = photo as Record<string, unknown>;
    const url = validDestinationUrl(data.url);
    const alt =
      typeof data.alt === "string" && data.alt.trim().length <= 180
        ? data.alt.trim()
        : "";
    return { url, alt };
  });
};

const validSchedule = (value: unknown): CronSchedule => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "schedule is required.");
  }
  const data = value as Record<string, unknown>;
  if (
    typeof data.minute !== "number" ||
    !Number.isInteger(data.minute) ||
    data.minute < 0 ||
    data.minute > 55 ||
    data.minute % 5 !== 0 ||
    typeof data.hour !== "number" ||
    !Number.isInteger(data.hour) ||
    data.hour < 0 ||
    data.hour > 23 ||
    !Array.isArray(data.daysOfWeek)
  ) {
    throw new HttpsError("invalid-argument", "schedule is invalid.");
  }

  const daysOfWeek = [...new Set(data.daysOfWeek)].sort((a, b) => a - b);
  if (
    daysOfWeek.some(
      (day) => typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6
    )
  ) {
    throw new HttpsError("invalid-argument", "schedule days are invalid.");
  }
  return { minute: data.minute, hour: data.hour, daysOfWeek: daysOfWeek as number[] };
};

const timestampOrNull = (value: unknown): admin.firestore.Timestamp | null =>
  value instanceof admin.firestore.Timestamp ? value : null;

const numberOr = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const scheduleFromData = (value: unknown): CronSchedule => {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const minute = numberOr(data.minute, 0);
  const hour = numberOr(data.hour, 19);
  const savedDays = Array.isArray(data.daysOfWeek) ? data.daysOfWeek : null;
  const days = savedDays
    ? [...new Set(savedDays.filter((day): day is number =>
        typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6
      ))].sort((a, b) => a - b)
    : [];
  return {
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 55 && minute % 5 === 0 ? minute : 0,
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 19,
    // An explicitly empty saved list means that automatic posting is disabled.
    // Only legacy documents with no schedule field receive the original weekday default.
    daysOfWeek: savedDays ? days : [1, 2, 3, 4, 5],
  };
};

const templateAssignmentsFromData = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (assignments, [day, templateId]) => {
      if (/^[0-6]$/.test(day) && typeof templateId === "string" && templateId) {
        assignments[day] = templateId;
      }
      return assignments;
    },
    {}
  );
};

const validTemplateId = (value: unknown, field = "templateId") => {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(value)
  ) {
    throw new HttpsError("invalid-argument", field + " is invalid.");
  }
  return value;
};

const validTemplateAssignments = (value: unknown, schedule: CronSchedule) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "templateAssignments are required.");
  }
  const data = value as Record<string, unknown>;
  return schedule.daysOfWeek.reduce<Record<string, string>>((assignments, day) => {
    assignments[String(day)] = validTemplateId(data[String(day)], "templateAssignments");
    return assignments;
  }, {});
};

const koreaWeekday = (millis: number) =>
  new Date(millis + KOREA_OFFSET_MS).getUTCDay();

const nextScheduledAt = (schedule: CronSchedule, afterMillis: number) => {
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
        schedule.minute
      ) - KOREA_OFFSET_MS;
    if (candidate > afterMillis) {
      return admin.firestore.Timestamp.fromMillis(candidate);
    }
  }

  throw new Error("Unable to calculate the next Gopas schedule.");
};

const configFromData = (data?: admin.firestore.DocumentData): CronSettings => ({
  enabled: Boolean(data?.enabled),
  nextRunAt: timestampOrNull(data?.nextRunAt),
  schedule: scheduleFromData(data?.schedule),
  templateId: typeof data?.templateId === "string" ? data.templateId : "",
  templateAssignments: templateAssignmentsFromData(data?.templateAssignments),
  destinationUrl:
    typeof data?.destinationUrl === "string" ? data.destinationUrl : "",
  title: typeof data?.title === "string" ? data.title : "",
  copy: typeof data?.copy === "string" ? data.copy : "",
  callToAction: typeof data?.callToAction === "string" ? data.callToAction : "",
  photos: Array.isArray(data?.photos)
    ? data.photos.flatMap((photo: unknown) => {
        if (!photo || typeof photo !== "object" || Array.isArray(photo)) return [];
        const entry = photo as Record<string, unknown>;
        return typeof entry.url === "string" && entry.url
          ? [{ url: entry.url, alt: typeof entry.alt === "string" ? entry.alt : "" }]
          : [];
      })
    : [],
  timeZone: typeof data?.timeZone === "string" ? data.timeZone : "Asia/Seoul",
});

const configIsRunnable = (config: CronSettings) =>
  Boolean(
    config.templateId &&
    config.schedule.daysOfWeek.length &&
    config.schedule.daysOfWeek.every(
      (day) => Boolean(config.templateAssignments[String(day)])
    )
  );

const configCanRunManually = (config: CronSettings) => Boolean(config.templateId);

const templateContentFromData = (data?: admin.firestore.DocumentData) => {
  const destinationUrl = typeof data?.destinationUrl === "string" ? data.destinationUrl.trim() : "";
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const copy = typeof data?.copy === "string" ? data.copy.trim() : "";
  const callToAction = typeof data?.callToAction === "string" ? data.callToAction.trim() : "";
  const photos = Array.isArray(data?.photos)
    ? data.photos.flatMap((photo: unknown) => {
        if (!photo || typeof photo !== "object" || Array.isArray(photo)) return [];
        const entry = photo as Record<string, unknown>;
        return typeof entry.url === "string" && entry.url
          ? [{ url: entry.url, alt: typeof entry.alt === "string" ? entry.alt : "" }]
          : [];
      })
    : [];
  if (!destinationUrl || !title || !copy || !callToAction) return null;
  try {
    const url = new URL(destinationUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return { destinationUrl: url.toString(), title, copy, callToAction, photos };
  } catch {
    return null;
  }
};

const trackingCode = () =>
  "kp_" + randomUUID().replace(/-/g, "").slice(0, 16);

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
        `<p><a href="${htmlAttribute(destinationUrl)}"><img src="${htmlAttribute(photo.url)}" alt="${htmlAttribute(photo.alt)}" width="500"></a></p>`
    )
    .join("\n");

const buildPostCopy = (config: CronSettings) =>
  [photoMarkup(config.photos, config.destinationUrl), config.copy, config.callToAction]
    .filter(Boolean)
    .join("\n\n");

const resolveTemplateVariables = (
  value: string,
  scheduledFor: admin.firestore.Timestamp
) => {
  const weekday = koreaWeekday(scheduledFor.toMillis());
  const daysUntilSunday = (7 - weekday) % 7;
  return value.replace(/\{\{daysUntilSunday\}\}|\{daysUntilSunday\}/g, String(daysUntilSunday));
};

const coreAdvertTitle = (title: string) =>
  title
    .replace(/^\s*\[D-(?:\{\{daysUntilSunday\}\}|\{daysUntilSunday\}|\d+)\]\s*/i, "")
    .trim();

const hasAdvertOnGopasFirstPage = async (title: string) => {
  const coreTitle = coreAdvertTitle(title);
  if (!coreTitle) return false;
  try {
    const response = await fetch(GOPAS_FREE_AD_URL, {
      headers: { "User-Agent": "1CupEnglish Marketing Scheduler" },
    });
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes(coreTitle);
  } catch (error) {
    logger.warn("Unable to check the Gopas first page for a duplicate advert.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
};

const publisherEndpoint = () => process.env.KOREAPAS_PUBLISHER_URL?.trim() || "";

const publisherHeaders = () => {
  const token = process.env.KOREAPAS_PUBLISHER_TOKEN?.trim();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
};

const callKoreapasPublisher = async (
  action: "publish" | "performance",
  payload: Record<string, unknown>
): Promise<Record<string, unknown> | null> => {
  const endpoint = publisherEndpoint();
  if (!endpoint) return null;

  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("Publisher must use HTTPS");
  } catch {
    throw new Error("Gopas publisher endpoint is invalid.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: publisherHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  if (!response.ok) {
    throw new Error("Gopas publisher responded with " + response.status + ".");
  }

  const body = (await response.json()) as unknown;
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
};

const readMetrics = (value: unknown): Metrics => {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    impressions: numberOr(data.impressions),
    clicks: numberOr(data.clicks),
    signups: numberOr(data.signups),
    likes: numberOr(data.likes),
    comments: numberOr(data.comments),
  };
};

const normalizePublisherMetrics = (value: unknown): Metrics | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const metrics = readMetrics(data);
  const hasMetric = [
    data.impressions,
    data.likes,
    data.comments,
  ].some((metric) => typeof metric === "number" && Number.isFinite(metric));
  return hasMetric ? metrics : null;
};

const refreshPriorPostPerformance = async (): Promise<PerformanceSnapshot> => {
  const snapshot = await db
    .collection(POSTS)
    .where("channel", "==", KOREAPAS_CHANNEL)
    .get();
  const posts = snapshot.docs;
  const externalPosts = posts
    .map((post) => ({
      id: post.id,
      externalPostUrl: String(post.data().externalUrl || ""),
    }))
    .filter((post) => post.externalPostUrl);

  let publisherMetrics = new Map<string, Metrics>();
  const remote = externalPosts.length
    ? await callKoreapasPublisher("performance", { posts: externalPosts })
    : null;
  const remotePosts = Array.isArray(remote?.posts) ? remote.posts : [];
  remotePosts.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const data = entry as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id : "";
    const metrics = normalizePublisherMetrics(data.metrics ?? data);
    if (id && metrics) publisherMetrics.set(id, metrics);
  });

  const now = admin.firestore.Timestamp.now();
  const totals: PerformanceSnapshot = { trackedPosts: posts.length, ...emptyMetrics() };
  const updates: Array<{ ref: admin.firestore.DocumentReference; metrics?: Metrics }> = [];

  posts.forEach((post) => {
    const storedMetrics = readMetrics(post.data().metrics);
    const externalMetrics = publisherMetrics.get(post.id);
    const metrics = externalMetrics
      ? {
          ...storedMetrics,
          impressions: externalMetrics.impressions,
          likes: externalMetrics.likes,
          comments: externalMetrics.comments,
        }
      : storedMetrics;

    totals.impressions += metrics.impressions;
    totals.clicks += metrics.clicks;
    totals.signups += metrics.signups;
    totals.likes += metrics.likes;
    totals.comments += metrics.comments;

    updates.push({ ref: post.ref, ...(externalMetrics ? { metrics } : {}) });
  });

  for (let index = 0; index < updates.length; index += 400) {
    const batch = db.batch();
    updates.slice(index, index + 400).forEach((update) => {
      batch.set(
        update.ref,
        {
          ...(update.metrics ? { metrics: update.metrics } : {}),
          performanceCheckedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    });
    await batch.commit();
  }
  return totals;
};

const clearRunLease = async (runId: string, patch: Record<string, unknown>) => {
  await db.runTransaction(async (transaction) => {
    const currentConfig = await transaction.get(CONFIG_REF);
    const activeRunId = currentConfig.data()?.activeRunId;
    if (activeRunId === runId) {
      transaction.set(
        CONFIG_REF,
        {
          activeRunId: admin.firestore.FieldValue.delete(),
          activeRunLeaseUntil: admin.firestore.FieldValue.delete(),
          ...patch,
        },
        { merge: true }
      );
    }
  });
};

const executeRun = async (runRef: admin.firestore.DocumentReference) => {
  const run = await runRef.get();
  const data = run.data();
  const config = configFromData(data?.settings);
  const scheduledFor = timestampOrNull(data?.scheduledFor) || admin.firestore.Timestamp.now();
  const startedAt = admin.firestore.Timestamp.now();

  await runRef.set({ status: "running", startedAt, error: "" }, { merge: true });

  try {
    const performance = await refreshPriorPostPerformance();
    const postTitle = resolveTemplateVariables(config.title, scheduledFor);
    const postCopy = buildPostCopy({
      ...config,
      copy: resolveTemplateVariables(config.copy, scheduledFor),
      callToAction: resolveTemplateVariables(config.callToAction, scheduledFor),
    });

    // Match the original workflow: look through the current first page immediately
    // before publishing, and skip rather than duplicating the same Gopas advert.
    if (await hasAdvertOnGopasFirstPage(postTitle)) {
      const completedAt = admin.firestore.Timestamp.now();
      await runRef.set(
        {
          status: "skipped",
          postTitle,
          postCopy,
          photos: config.photos,
          performance,
          performanceCheckedAt: completedAt,
          completedAt,
          error: "A matching advert is already on the first Gopas free-ad page.",
        },
        { merge: true }
      );
      await clearRunLease(runRef.id, { lastRunAt: completedAt });
      return;
    }

    const code = trackingCode();
    const postRef = db.collection(POSTS).doc();
    const trackingUrl = TRACKING_DOMAIN + "/r/" + code;
    const marker = hiddenPostId(code);

    await postRef.set({
      channel: KOREAPAS_CHANNEL,
      title: postTitle,
      content: postCopy,
      destinationUrl: config.destinationUrl,
      trackingCode: code,
      hiddenPostId: marker,
      photos: config.photos,
      status: "posting",
      runId: runRef.id,
      metrics: emptyMetrics(),
      createdAt: startedAt,
      updatedAt: startedAt,
    });

    const published = await callKoreapasPublisher("publish", {
      title: postTitle,
      content: postCopy,
      trackingUrl,
      hiddenPostId: marker,
      destinationUrl: config.destinationUrl,
      photos: config.photos,
      useHtml: config.photos.length > 0,
    });
    const externalPostUrl =
      typeof published?.postUrl === "string" ? published.postUrl : "";
    const completedAt = admin.firestore.Timestamp.now();

    if (!published) {
      await postRef.set(
        {
          status: "prepared",
          publisherStatus: "not_configured",
          updatedAt: completedAt,
        },
        { merge: true }
      );
      await runRef.set(
        {
          status: "awaitingPublisher",
          postId: postRef.id,
          postTitle,
          postCopy,
          trackingCode: code,
          trackingUrl,
          hiddenPostId: marker,
          externalPostUrl: "",
          photos: config.photos,
          performance,
          performanceCheckedAt: completedAt,
          completedAt,
          error: "Gopas publisher is not configured.",
        },
        { merge: true }
      );
    } else {
      if (!externalPostUrl) {
        throw new Error("Gopas publisher response did not include postUrl.");
      }
      await postRef.set(
        {
          status: "posted",
          externalUrl: externalPostUrl,
          postedAt: completedAt,
          publisherStatus: "posted",
          updatedAt: completedAt,
        },
        { merge: true }
      );
      await runRef.set(
        {
          status: "completed",
          postId: postRef.id,
          postTitle,
          postCopy,
          trackingCode: code,
          trackingUrl,
          hiddenPostId: marker,
          externalPostUrl,
          photos: config.photos,
          performance,
          performanceCheckedAt: completedAt,
          completedAt,
          error: "",
        },
        { merge: true }
      );
    }

    await clearRunLease(runRef.id, { lastRunAt: completedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    const completedAt = admin.firestore.Timestamp.now();
    logger.error("Marketing cron run failed:", { runId: runRef.id, message });
    await runRef.set({ status: "failed", completedAt, error: message }, { merge: true });
    await clearRunLease(runRef.id, { lastRunAt: completedAt });
  }
};

const claimRun = async (trigger: "schedule" | "manual") => {
  const now = admin.firestore.Timestamp.now();
  const nowMillis = now.toMillis();
  const runRef = db.collection(RUNS).doc();
  let claimed = false;

  await db.runTransaction(async (transaction) => {
    const configSnapshot = await transaction.get(CONFIG_REF);
    if (!configSnapshot.exists) return;

    const config = configFromData(configSnapshot.data());
    const nextRunMillis = config.nextRunAt?.toMillis() ?? 0;
    const activeLease = timestampOrNull(configSnapshot.data()?.activeRunLeaseUntil)?.toMillis() ?? 0;
    const isDue = nextRunMillis <= nowMillis;

    if (
      !(trigger === "manual" ? configCanRunManually(config) : configIsRunnable(config)) ||
      activeLease > nowMillis ||
      (trigger === "schedule" && (!config.enabled || !isDue))
    ) {
      return;
    }

    const scheduledFor = trigger === "schedule" ? config.nextRunAt || now : now;
    const templateId =
      trigger === "schedule"
        ? config.templateAssignments[String(koreaWeekday(scheduledFor.toMillis()))]
        : config.templateId;
    const templateSnapshot = await transaction.get(db.collection(TEMPLATES).doc(templateId));
    const template = templateContentFromData(templateSnapshot.data());
    if (!template) return;

    const nextRunAt =
      trigger === "schedule"
        ? nextScheduledAt(config.schedule, nowMillis)
        : config.nextRunAt;
    const runSettings: CronSettings = {
      ...config,
      templateId,
      ...template,
    };

    transaction.set(runRef, {
      channel: KOREAPAS_CHANNEL,
      trigger,
      status: "queued",
      scheduledFor,
      settings: runSettings,
      postId: "",
      postTitle: "",
      postCopy: "",
      trackingCode: "",
      trackingUrl: "",
      hiddenPostId: "",
      externalPostUrl: "",
      performance: { trackedPosts: 0, ...emptyMetrics() },
      error: "",
      createdAt: now,
    });
    transaction.set(
      CONFIG_REF,
      {
        activeRunId: runRef.id,
        activeRunLeaseUntil: admin.firestore.Timestamp.fromMillis(nowMillis + RUN_LEASE_MS),
        ...(trigger === "schedule" ? { nextRunAt } : {}),
        updatedAt: now,
      },
      { merge: true }
    );
    claimed = true;
  });

  return claimed ? runRef : null;
};

export const saveMarketingCronSettings = onCall(
  { region: "asia-northeast3", timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const data = request.data || {};
    if (typeof data.enabled !== "boolean") {
      throw new HttpsError("invalid-argument", "enabled must be a boolean.");
    }

    const schedule = validSchedule(data.schedule);
    const templateId = validTemplateId(data.templateId);
    const templateAssignments = validTemplateAssignments(data.templateAssignments, schedule);
    const templateIds = [...new Set([templateId, ...Object.values(templateAssignments)])];
    const templateSnapshots = await db.getAll(
      ...templateIds.map((id) => db.collection(TEMPLATES).doc(id))
    );
    if (templateSnapshots.some((snapshot) => !templateContentFromData(snapshot.data()))) {
      throw new HttpsError("failed-precondition", "Every selected template must be saved first.");
    }
    const settings: CronSettings = {
      enabled: data.enabled && schedule.daysOfWeek.length > 0,
      nextRunAt:
        schedule.daysOfWeek.length > 0
          ? nextScheduledAt(schedule, Date.now())
          : null,
      schedule,
      templateId,
      templateAssignments,
      destinationUrl: "",
      title: "",
      copy: "",
      callToAction: "",
      photos: [],
      timeZone: "Asia/Seoul",
    };

    await CONFIG_REF.set(
      {
        ...settings,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: request.auth!.uid,
      },
      { merge: true }
    );

    return { ok: true };
  }
);

export const createMarketingTemplate = onCall(
  { region: "asia-northeast3", timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const data = request.data || {};
    const now = admin.firestore.Timestamp.now();
    const templateRef = db.collection(TEMPLATES).doc();
    await templateRef.set({
      name: textField(data.name, "name", 100),
      destinationUrl: validDestinationUrl(data.destinationUrl),
      title: textField(data.title, "title", 180),
      copy: textField(data.copy, "copy", 8_000),
      callToAction: textField(data.callToAction, "callToAction", 1_000),
      photos: validPhotos(data.photos),
      createdAt: now,
      updatedAt: now,
      createdBy: request.auth!.uid,
    });
    return { templateId: templateRef.id };
  }
);

export const ensureDefaultMarketingTemplate = onCall(
  { region: "asia-northeast3", timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const templateRef = db.collection(TEMPLATES).doc(ORIGINAL_TEMPLATE_ID);
    const existing = await templateRef.get();
    if (!existing.exists) {
      const now = admin.firestore.Timestamp.now();
      await templateRef.set({
        ...ORIGINAL_GOPAS_TEMPLATE,
        createdAt: now,
        updatedAt: now,
        createdBy: "system",
      });
    }
    return { templateId: templateRef.id };
  }
);

export const deleteMarketingTemplate = onCall(
  { region: "asia-northeast3", timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const templateId = textField(request.data?.templateId, "templateId", 200);
    const config = configFromData((await CONFIG_REF.get()).data());
    if (
      config.templateId === templateId ||
      Object.values(config.templateAssignments).includes(templateId)
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Assign another template in the schedule before deleting this template."
      );
    }
    await db.collection(TEMPLATES).doc(templateId).delete();
    return { ok: true };
  }
);

export const runMarketingCronNow = onCall(
  { region: "asia-northeast3", timeoutSeconds: 120, memory: "256MiB" },
  async (request) => {
    await requireAdmin(request.auth?.uid);
    const run = await claimRun("manual");
    if (!run) {
      throw new HttpsError(
        "failed-precondition",
        "Save a complete configuration first, or wait for the current run to finish."
      );
    }

    await executeRun(run);
    return { runId: run.id };
  }
);

export const runMarketingCron = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Seoul",
    region: "asia-northeast3",
    timeoutSeconds: 120,
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    const run = await claimRun("schedule");
    if (!run) return;
    await executeRun(run);
  }
);
