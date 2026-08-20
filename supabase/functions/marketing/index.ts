// marketing — port of functions/src/marketingCron.ts (Gopas advert scheduler).
//
// Admin actions (save-template-schedule / create-template / ensure-default-template /
// delete-template / run-now) plus the scheduled tick, which pg_cron calls with the
// a private scheduler header as { action: "tick" }.
//
// Two things changed shape in the move off Firestore:
//   * The run lease was a transaction on the config document. Here it is a conditional
//     UPDATE ... RETURNING on growth_config, which is atomic on its own — if two ticks
//     race, exactly one gets a row back and the other does nothing.
//   * Post metrics were incremented per document; the refresh now writes each post's
//     metrics blob directly, same as the Firestore version did after reading them.
//
// Publishing itself is unchanged: it POSTs to KOREAPAS_PUBLISHER_URL, which owns the
// browser automation. Without that env var the run still records everything and stops
// at "prepared", exactly like the original.
import { preflight, json } from "../_shared/cors.ts";
import { admin, callerUid } from "../_shared/db.ts";

const CONFIG_ROW = "settings";
const RUN_LEASE_MS = 10 * 60 * 1000;
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;
const ORIGINAL_TEMPLATE_ID = "gopas_original_meetup";
const TRACKING_DOMAIN = "https://1cupenglish.com";
const KOREAPAS_CHANNEL = "koreapas";
const GOPAS_FREE_AD_URL = "https://www.koreapas.com/bbs/zboard.php?id=freead";

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
const trackingCode = () => "kp_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
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
      headers: { "User-Agent": "1CupEnglish Marketing Scheduler" },
    });
    if (!response.ok) return false;
    return (await response.text()).includes(coreTitle);
  } catch (error) {
    console.warn("Unable to check the Gopas first page for a duplicate advert.", error);
    return false;
  }
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
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
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
    .select("id, external_url, metrics")
    .eq("channel", KOREAPAS_CHANNEL)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = posts ?? [];
  const externalPosts = rows
    .filter((p: Record<string, unknown>) => typeof p.external_url === "string" && p.external_url)
    .map((p: Record<string, unknown>) => ({ id: p.id, externalPostUrl: p.external_url }));

  let remotePosts: unknown[] = [];
  if (externalPosts.length) {
    try {
      const remote = await callKoreapasPublisher("performance", { posts: externalPosts });
      remotePosts = Array.isArray(remote?.posts) ? (remote!.posts as unknown[]) : [];
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
    // Clicks are ours (the /r redirect counts them); everything else comes from Gopas.
    const metrics: Metrics = external ? { ...external, clicks: stored.clicks } : stored;

    totals.impressions += metrics.impressions;
    totals.clicks += metrics.clicks;
    totals.signups += metrics.signups;
    totals.likes += metrics.likes;
    totals.comments += metrics.comments;

    if (external) {
      await a
        .from("growth_posts")
        .update({ metrics, updated_at: new Date().toISOString() })
        .eq("id", post.id);
    }
  }
  return totals;
};

// ------------------------------------------------------------------- run flow
type RunSettings = {
  destinationUrl: string;
  title: string;
  copy: string;
  callToAction: string;
  photos: TemplatePhoto[];
};

const clearRunLease = async (templateId: string | null, completedAt: string) => {
  await admin()
    .from("growth_config")
    .update({
      active_run_id: null,
      active_run_lease_until: null,
      updated_at: completedAt,
    })
    .eq("id", CONFIG_ROW);
  if (templateId) {
    await admin()
      .from("marketing_templates")
      .update({ last_run_at: completedAt, updated_at: completedAt })
      .eq("id", templateId);
  }
};

const executeRun = async (runId: string) => {
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

  await a
    .from("marketing_cron_runs")
    .update({ status: "running", started_at: startedAt, error: "" })
    .eq("id", runId);

  try {
    const performance = await refreshPriorPostPerformance();
    const postTitle = resolveTemplateVariables(settings.title ?? "", scheduledForMillis);
    const postCopy = buildPostCopy(
      settings.photos ?? [],
      settings.destinationUrl ?? "",
      resolveTemplateVariables(settings.copy ?? "", scheduledForMillis),
      resolveTemplateVariables(settings.callToAction ?? "", scheduledForMillis),
    );

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
      await clearRunLease(templateId, completedAt);
      return;
    }

    const code = trackingCode();
    const postId = crypto.randomUUID();
    const trackingUrl = `${TRACKING_DOMAIN}/r/${code}`;
    const marker = hiddenPostId(code);

    await a.from("growth_posts").insert({
      id: postId,
      channel: KOREAPAS_CHANNEL,
      title: postTitle,
      content: postCopy,
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

    const published = await callKoreapasPublisher("publish", {
      title: postTitle,
      content: postCopy,
      trackingUrl,
      hiddenPostId: marker,
      destinationUrl: settings.destinationUrl,
      photos: settings.photos ?? [],
      useHtml: (settings.photos ?? []).length > 0,
    });
    const completedAt = new Date().toISOString();

    if (!published) {
      // No publisher configured: everything is recorded, nothing was posted.
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
      await clearRunLease(templateId, completedAt);
      return;
    }

    const externalPostUrl = typeof published.postUrl === "string" ? published.postUrl : "";
    await a
      .from("growth_posts")
      .update({
        status: "posted",
        external_url: externalPostUrl,
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
    await clearRunLease(templateId, completedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const completedAt = new Date().toISOString();
    await a
      .from("marketing_cron_runs")
      .update({ status: "failed", completed_at: completedAt, error: message })
      .eq("id", runId);
    await clearRunLease(templateId, completedAt);
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

  if (trigger === "schedule") {
    const nextRunAt = nextScheduledAt(schedule, now.getTime()).toISOString();
    const { error } = await a
      .from("marketing_templates")
      .update({ next_run_at: nextRunAt, updated_at: nowIso })
      .eq("id", templateId)
      .eq("next_run_at", template.next_run_at);
    if (error) {
      await clearRunLease(null, nowIso);
      throw new Error(error.message);
    }
  }

  const runSettings: RunSettings = {
    destinationUrl: String(template.destination_url ?? ""),
    title: String(template.title ?? ""),
    copy: String(template.copy ?? ""),
    callToAction: String(template.call_to_action ?? ""),
    photos: (template.photos ?? []) as TemplatePhoto[],
  };

  const { error: insertError } = await a.from("marketing_cron_runs").insert({
    id: runId,
    template_id: templateId,
    channel: KOREAPAS_CHANNEL,
    trigger,
    status: "queued",
    scheduled_for: scheduledFor.toISOString(),
    settings: runSettings,
    performance: { trackedPosts: 0, ...emptyMetrics() },
    created_at: nowIso,
  });
  if (insertError) {
    await clearRunLease(null, nowIso);
    throw new Error(insertError.message);
  }

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
    // pg_cron calls this with the private scheduler header and no user session.
    if (action === "tick") {
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
      const runId = await claimRun("schedule");
      if (!runId) return json(req, { ran: false });
      await executeRun(runId);
      return json(req, { ran: true, runId });
    }

    await requireAdmin(req);

    if (action === "save-template-schedule") {
      const s = (body.settings ?? {}) as Record<string, unknown>;
      if (typeof s.scheduleEnabled !== "boolean") {
        throw new Error("scheduleEnabled must be a boolean.");
      }
      const templateId = validTemplateId(s.templateId);
      const schedule = validSchedule(s.schedule);
      const isScheduled = schedule.daysOfWeek.length > 0;
      const scheduleEnabled = s.scheduleEnabled && isScheduled;
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
      const scheduleEnabled = t.scheduleEnabled === true && schedule.daysOfWeek.length > 0;
      const { error } = await a.from("marketing_templates").insert({
        id: templateId,
        name: textField(t.name, "Template name", 120),
        destination_url: validDestinationUrl(t.destinationUrl),
        title: textField(t.title, "Title", 200),
        copy: textField(t.copy, "Copy", 20000),
        call_to_action: typeof t.callToAction === "string" ? t.callToAction.trim() : "",
        photos: validPhotos(t.photos),
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
