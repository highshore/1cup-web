// messaging — Supabase Edge Function (Deno)
//
// Port of the Firebase Cloud Functions messaging surface from
// functions/src/index.ts:
//   - sendMeetupReminder            -> action "meetup-reminder" { eventId }
//   - processAndSendLinks /
//     sendLinksToUsers /
//     testSendLinksToUsers /
//     processCategoryLinks /
//     sendLinksToCategory           -> action "send-links" { category?, testMode? }
//   - listGdgMembers                -> action "gdg-members"
//   - getUserDisplayNames           -> action "user-names" { userIds: string[] }
//
// Firestore is replaced by Supabase Postgres via admin() (service-role, bypasses RLS).
// Firebase Auth getUser/getUsers lookups (phone / displayName) are replaced by reads
// from public.users (phone, display_name), which are now populated.
//
// Kakao Alimtalk template codes are preserved verbatim ("send-article",
// "meetup-reminder"). The article-link + received_articles update logic is preserved.

import { preflight, json } from "../_shared/cors.ts";
import {
  admin,
  callerUid,
  hasServiceRoleAuthorization,
  recordSchedulerHeartbeat,
} from "../_shared/db.ts";
import { sendKakaoMessages, krPhone } from "../_shared/kakao.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Category = "tech" | "business";

interface UserRow {
  uid: string;
  phone: string | null;
  display_name: string | null;
  has_active_subscription: boolean | null;
  cat_tech: boolean | null;
  cat_business: boolean | null;
  gdg_member: boolean | null;
  account_status: string | null;
  received_articles: string[] | null;
}

interface ResolvedLink {
  url: string;
  articleId: string;
  koreanTitle: string;
}

interface KakaoRecipient {
  recipientNo: string;
  templateParameter: Record<string, string | undefined>;
}

// Test-mode recipients (match the original Cloud Functions).
const TEST_PHONE_NUMBERS = ["01068584123", "01045430406"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A normalized 010… phone is valid for Alimtalk. */
function isValidKrPhone(no: string): boolean {
  return !!no && no.startsWith("010") && no.length >= 10;
}

/** Same-day check (Asia/Seoul) used by the daily cron to gate link sending. */
function isToday(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const day = (d: Date) => fmt.format(d);
  return day(new Date(updatedAt)) === day(new Date());
}

/** Last path segment of the article URL is the article id (preserved logic). */
function articleIdFromUrl(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1];
}

/** Resolve a link row + its article Korean title into a ResolvedLink. */
async function resolveLink(
  db: ReturnType<typeof admin>,
  category: Category,
  link: { url: string | null } | null,
): Promise<ResolvedLink | null> {
  if (!link?.url) return null;
  const articleId = articleIdFromUrl(link.url);
  const fallbackTitle = category === "tech" ? "기술 기사" : "비즈니스 기사";

  const { data: article } = await db
    .from("articles")
    .select("title")
    .eq("id", articleId)
    .maybeSingle();

  const koreanTitle =
    (article?.title as { korean?: string } | null)?.korean ?? fallbackTitle;

  return { url: link.url, articleId, koreanTitle };
}

/** displayName -> fallback to "고객님" (matches original customer-name resolution). */
function customerName(u: Pick<UserRow, "display_name">): string {
  const n = (u.display_name ?? "").trim();
  return n !== "" ? n : "고객님";
}

// ---------------------------------------------------------------------------
// Action: send-links  (daily cron; optional { category, testMode })
// ---------------------------------------------------------------------------
async function handleSendLinks(
  body: { category?: Category; testMode?: boolean },
): Promise<unknown> {
  const db = admin();
  const testMode = body.testMode === true;

  // If a single category is requested, mirror processCategoryLinks
  // (testMode defaults to true there, matching sendLinksToCategory).
  if (body.category) {
    if (body.category !== "tech" && body.category !== "business") {
      throw new Error("Invalid category. Must be 'tech' or 'business'.");
    }
    const categoryTestMode = body.testMode === undefined ? true : body.testMode;
    return await processCategoryLinks(db, body.category, categoryTestMode);
  }

  // Otherwise: full daily run across tech + business (processAndSendLinks).
  return await processAndSendLinks(db, testMode);
}

/** Port of processAndSendLinks: process both tech and business links. */
async function processAndSendLinks(
  db: ReturnType<typeof admin>,
  testMode: boolean,
): Promise<{ techCount: number; businessCount: number; expiryCount: number }> {
  // 1. Load tech + business link rows; only process those updated today.
  const { data: linkRows } = await db
    .from("links")
    .select("category, url, updated_at")
    .in("category", ["tech", "business"]);

  const byCat = new Map<string, { url: string | null; updated_at: string | null }>();
  for (const row of linkRows ?? []) {
    byCat.set(row.category, { url: row.url, updated_at: row.updated_at });
  }

  const techRow = byCat.get("tech");
  const businessRow = byCat.get("business");

  const techLink =
    techRow && isToday(techRow.updated_at)
      ? await resolveLink(db, "tech", techRow)
      : null;
  const businessLink =
    businessRow && isToday(businessRow.updated_at)
      ? await resolveLink(db, "business", businessRow)
      : null;

  if (!techLink && !businessLink) {
    return { techCount: 0, businessCount: 0, expiryCount: 0 };
  }

  // 2. Load users. In production mode only active subscribers matter; we filter
  //    in JS to keep parity with the original (test mode ignores subscription).
  const users = await loadUsers(db, testMode);

  const techRecipients: KakaoRecipient[] = [];
  const businessRecipients: KakaoRecipient[] = [];

  for (const u of users) {
    if (!testMode && !u.has_active_subscription) continue;

    const recipientNo = krPhone(u.phone);
    const phoneOk = isValidKrPhone(recipientNo);

    const gotTech = !!(u.cat_tech && techLink) && phoneOk;
    const gotBusiness = !!(u.cat_business && businessLink) && phoneOk;

    if (gotTech && techLink) {
      techRecipients.push({
        recipientNo,
        templateParameter: {
          "korean-title": techLink.koreanTitle,
          "customer-name": customerName(u),
          "article-link": techLink.url,
        },
      });
    }

    if (gotBusiness && businessLink) {
      businessRecipients.push({
        recipientNo,
        templateParameter: {
          "korean-title": businessLink.koreanTitle,
          "customer-name": customerName(u),
          "article-link": businessLink.url,
        },
      });
    }

    // Append received article id(s) + bump last_received if the user got anything.

    if (gotTech || gotBusiness) {
      const ids = new Set<string>(u.received_articles ?? []);
      if (gotTech && techLink) ids.add(techLink.articleId);
      if (gotBusiness && businessLink) ids.add(businessLink.articleId);
      await db
        .from("users")
        .update({
          received_articles: Array.from(ids),
          last_received: new Date().toISOString(),
        })
        .eq("uid", u.uid);
    }
  }

  // 3. Send Kakao messages (template "send-article", preserved).
  if (techRecipients.length > 0) {
    try {
      await sendKakaoMessages(techRecipients, "send-article");
    } catch (e) {
      console.error("Error sending tech Kakao messages:", e);
    }
  }
  if (businessRecipients.length > 0) {
    try {
      await sendKakaoMessages(businessRecipients, "send-article");
    } catch (e) {
      console.error("Error sending business Kakao messages:", e);
    }
  }

  return {
    techCount: techRecipients.length,
    businessCount: businessRecipients.length,
    expiryCount: 0,
  };
}

/** Port of processCategoryLinks: send a single category's link. */
async function processCategoryLinks(
  db: ReturnType<typeof admin>,
  category: Category,
  testMode: boolean,
): Promise<{ recipientCount: number }> {
  const { data: linkRow } = await db
    .from("links")
    .select("url")
    .eq("category", category)
    .maybeSingle();

  if (!linkRow?.url) {
    throw new Error(`No URL found for ${category} category`);
  }

  const link = await resolveLink(db, category, linkRow);
  if (!link) {
    throw new Error(`Could not resolve link for ${category} category`);
  }

  const catColumn = category === "tech" ? "cat_tech" : "cat_business";

  // Users subscribed to this category.
  const { data: catUsers } = await db
    .from("users")
    .select(
      "uid, phone, display_name, has_active_subscription, cat_tech, cat_business, gdg_member, account_status, received_articles",
    )
    .eq(catColumn, true);
  let users = (catUsers ?? []) as UserRow[];

  if (testMode) {
    // Only keep test-phone users (match formatted phone against TEST list).
    users = users.filter((u) => TEST_PHONE_NUMBERS.includes(krPhone(u.phone)));
  } else {
    // Production: active subscribers only.
    users = users.filter((u) => u.has_active_subscription === true);
  }

  if (users.length === 0) return { recipientCount: 0 };

  const recipients: KakaoRecipient[] = [];

  for (const u of users) {
    const recipientNo = krPhone(u.phone);
    if (!isValidKrPhone(recipientNo)) continue;

    recipients.push({
      recipientNo,
      templateParameter: {
        "korean-title": link.koreanTitle,
        "customer-name": customerName(u),
        "article-link": link.url,
      },
    });

    // Append article id + update last_received.
    const ids = new Set<string>(u.received_articles ?? []);
    ids.add(link.articleId);
    await db
      .from("users")
      .update({
        received_articles: Array.from(ids),
        last_received: new Date().toISOString(),
      })
      .eq("uid", u.uid);
  }

  if (recipients.length > 0) {
    await sendKakaoMessages(recipients, "send-article");
  }

  return { recipientCount: recipients.length };
}

/** Load users for the full daily run (replaces Firestore users collection read). */
async function loadUsers(
  db: ReturnType<typeof admin>,
  testMode: boolean,
): Promise<UserRow[]> {
  const { data } = await db
    .from("users")
    .select(
      "uid, phone, display_name, has_active_subscription, cat_tech, cat_business, gdg_member, account_status, received_articles",
    );
  const users = (data ?? []) as UserRow[];
  if (testMode) {
    return users.filter((u) => TEST_PHONE_NUMBERS.includes(krPhone(u.phone)));
  }
  return users;
}

// ---------------------------------------------------------------------------
// Action: meetup-reminder  { eventId }
// ---------------------------------------------------------------------------
async function handleMeetupReminder(
  body: { eventId?: string },
): Promise<unknown> {
  const eventId = body.eventId;
  if (!eventId || typeof eventId !== "string") {
    throw new Error("Invalid or missing eventId parameter");
  }

  const db = admin();

  // Fetch the meetup.
  const { data: meetup } = await db
    .from("meetups")
    .select("id, date_time, location_name, location_address")
    .eq("id", eventId)
    .maybeSingle();

  if (!meetup) {
    throw new Error(`Event with ID ${eventId} not found`);
  }

  // Participants + leaders now come from the meetup_participants junction table,
  // joined to users for phone numbers (replaces leaders[]/participants[] arrays).
  const { data: parts } = await db
    .from("meetup_participants")
    .select("user_id, role, users:user_id (uid, phone)")
    .eq("meetup_id", eventId);

  // PostgREST returns an embedded to-one relationship as an object while the client
  // types it as an array, so this asserted one shape and the checker rejected it. Accept
  // either instead of insisting: were the relationship ever resolved as to-many, the
  // assertion would leave phone undefined and quietly drop that member from the send.
  type EmbeddedUser = { uid: string; phone: string | null };
  const rows = (parts ?? []) as Array<{
    user_id: string;
    role: string;
    users: EmbeddedUser | EmbeddedUser[] | null;
  }>;
  const embeddedUser = (u: EmbeddedUser | EmbeddedUser[] | null): EmbeddedUser | null =>
    Array.isArray(u) ? (u[0] ?? null) : u;

  if (rows.length === 0) {
    return { success: true, messagesSent: 0, message: "No participants to notify" };
  }

  // Dedupe by user_id (someone may be both leader and participant).
  const seen = new Set<string>();
  const uniquePhones: Array<string | null> = [];
  for (const r of rows) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    uniquePhones.push(embeddedUser(r.users)?.phone ?? null);
  }

  // Format the date/time for Korean display (Asia/Seoul).
  const eventDate = meetup.date_time ? new Date(meetup.date_time) : new Date();
  const koreanTime = eventDate.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });

  const templateParams = {
    "meetup-time": koreanTime,
    "meetup-location": `${meetup.location_name} (${meetup.location_address})`,
    "meetup-link": `https://1cupenglish.com/meetup/${eventId}`,
  };

  const recipientList: KakaoRecipient[] = [];
  for (const phone of uniquePhones) {
    const recipientNo = krPhone(phone);
    if (isValidKrPhone(recipientNo)) {
      recipientList.push({ recipientNo, templateParameter: templateParams });
    }
  }

  if (recipientList.length === 0) {
    return {
      success: true,
      messagesSent: 0,
      message: "No participants with valid phone numbers found",
    };
  }

  const result = await sendKakaoMessages(recipientList, "meetup-reminder");

  return {
    success: true,
    messagesSent: recipientList.length,
    kakaoResult: result,
    message: `Successfully sent reminder to ${recipientList.length} participants`,
  };
}

// ---------------------------------------------------------------------------
// Action: gdg-members  (listGdgMembers)
// ---------------------------------------------------------------------------
async function handleGdgMembers(): Promise<unknown> {
  const db = admin();
  const { data } = await db
    .from("users")
    .select("uid, display_name, phone, account_status, has_active_subscription")
    .eq("gdg_member", true);

  const members = ((data ?? []) as Array<
    Pick<
      UserRow,
      "uid" | "display_name" | "phone" | "account_status" | "has_active_subscription"
    >
  >).map((u) => ({
    uid: u.uid,
    displayName: u.display_name ?? "",
    phoneLast4: krPhone(u.phone).slice(-4) || "",
    account_status: u.account_status ?? undefined,
    hasActiveSubscription: u.has_active_subscription === true,
  }));

  return { members };
}

// ---------------------------------------------------------------------------
// Action: user-names  { userIds: string[] }  (getUserDisplayNames)
// ---------------------------------------------------------------------------
async function handleUserNames(
  body: { userIds?: unknown },
): Promise<unknown> {
  const userIds = body.userIds;
  if (!userIds || !Array.isArray(userIds)) {
    throw new Error("Invalid or missing userIds parameter");
  }

  const db = admin();
  const { data } = await db
    .from("users")
    .select("uid, display_name, phone")
    .in("uid", userIds as string[]);

  const found = new Map<string, { display_name: string | null; phone: string | null }>();
  for (const u of (data ?? []) as Array<
    Pick<UserRow, "uid" | "display_name" | "phone">
  >) {
    found.set(u.uid, { display_name: u.display_name, phone: u.phone });
  }

  const displayNames: Record<string, string> = {};
  const phoneNumbers: Record<string, string> = {};
  for (const id of userIds as string[]) {
    const row = found.get(id);
    displayNames[id] = row?.display_name ?? "";
    phoneNumbers[id] = krPhone(row?.phone ?? "");
  }

  return { displayNames, phoneNumbers };
}

async function callerHasStaffRole(req: Request): Promise<boolean> {
  const uid = await callerUid(req);
  if (!uid) return false;

  const { data, error } = await admin()
    .from("users")
    .select("account_status")
    .eq("uid", uid)
    .maybeSingle();
  if (error) {
    console.error("Unable to verify messaging caller:", error.message);
    return false;
  }

  return data?.account_status === "admin" || data?.account_status === "leader";
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== "POST") {
    return json(req, { success: false, error: "Method Not Allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(req, { success: false, error: "Invalid JSON body" }, 400);
  }

  const action = body.action as string | undefined;

  try {
    switch (action) {
      case "meetup-reminder": {
        if (!(await callerHasStaffRole(req))) {
          return json(req, { success: false, error: "Staff access is required" }, 403);
        }
        return json(req, await handleMeetupReminder(body as { eventId?: string }));
      }
      case "send-links": {
        if (!hasServiceRoleAuthorization(req)) {
          return json(req, { success: false, error: "Internal scheduler authorization required" }, 403);
        }
        const sendStats = await handleSendLinks(
          body as { category?: Category; testMode?: boolean },
        );
        // Only the scheduled run reports in. A manual test send should not make a
        // silently broken cron look alive.
        if (!(body as { testMode?: boolean }).testMode) {
          await recordSchedulerHeartbeat("messaging.send-links", { stats: sendStats });
        }
        return json(req, { success: true, stats: sendStats });
      }
      case "gdg-members": {
        if (!(await callerHasStaffRole(req))) {
          return json(req, { success: false, error: "Staff access is required" }, 403);
        }
        return json(req, await handleGdgMembers());
      }
      case "user-names": {
        if (!(await callerHasStaffRole(req))) {
          return json(req, { success: false, error: "Staff access is required" }, 403);
        }
        return json(req, await handleUserNames(body as { userIds?: unknown }));
      }
      default:
        return json(
          req,
          { success: false, error: `Unknown or missing action: ${String(action)}` },
          400,
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error handling action "${action}":`, message);
    return json(req, { success: false, error: message }, 500);
  }
});
