// Read-only data for the Daily admin (/daily/admin). Server-only: the service-role
// client reads every customer, so callers must have passed requireAdmin() first.
import { admin } from "../../../supabase/server";
import type { DailyField, DailyTrack } from "../constants";
import { LESSON_COLUMNS, toContent, type DailyLessonContent, type LessonRow } from "./lessons";

export interface DailyAdminSubscription {
  track: DailyTrack;
  status: "trial" | "trial_ended" | "active" | "cancelled";
  plan: string | null;
  paidUntil: string | null;
  autoRenew: boolean;
  deliveryTime: string;
  createdAt: string;
}

export interface DailyAdminMember {
  id: string;
  name: string | null;
  phone: string | null;
  workplace: string | null;
  jobCategory: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  marketing: boolean;
  subscriptions: DailyAdminSubscription[];
  paidTotal: number;
  paidCount: number;
  refundedTotal: number;
  lastPaidAt: string | null;
}

export interface DailyAdminOverview {
  customers: number;
  paying: number;
  autoRenew: number;
  trials: number;
  openRefunds: number;
  revenue30d: number;
}

type SubRow = {
  customer_id: string;
  track: DailyTrack;
  status: DailyAdminSubscription["status"];
  plan: string | null;
  paid_until: string | null;
  auto_renew: boolean;
  delivery_time: string;
  marketing_consent_at: string | null;
  created_at: string;
};

export async function loadDailyMembers(): Promise<DailyAdminMember[]> {
  const db = admin();
  const [customers, subs, orders, refunds] = await Promise.all([
    db
      .from("daily_customers")
      .select("id, name, phone, workplace, job_category, created_at, last_login_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    db
      .from("daily_subscriptions")
      .select("customer_id, track, status, plan, paid_until, auto_renew, delivery_time, marketing_consent_at, created_at")
      .order("created_at", { ascending: false }),
    db.from("daily_orders").select("customer_id, amount, completed_at").eq("status", "completed"),
    db.from("daily_refunds").select("customer_id, amount").eq("status", "refunded"),
  ]);
  for (const r of [customers, subs, orders, refunds]) if (r.error) throw new Error(r.error.message);

  const subsBy = new Map<string, SubRow[]>();
  for (const s of (subs.data ?? []) as SubRow[]) {
    if (!subsBy.has(s.customer_id)) subsBy.set(s.customer_id, []);
    subsBy.get(s.customer_id)!.push(s);
  }
  const paid = new Map<string, { total: number; count: number; last: string | null }>();
  for (const o of orders.data ?? []) {
    const p = paid.get(o.customer_id) ?? { total: 0, count: 0, last: null };
    p.total += o.amount;
    p.count += 1;
    if (!p.last || (o.completed_at && o.completed_at > p.last)) p.last = o.completed_at;
    paid.set(o.customer_id, p);
  }
  const refunded = new Map<string, number>();
  for (const r of refunds.data ?? []) refunded.set(r.customer_id, (refunded.get(r.customer_id) ?? 0) + r.amount);

  return (customers.data ?? []).map((c) => {
    const own = subsBy.get(c.id) ?? [];
    const p = paid.get(c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      workplace: c.workplace,
      jobCategory: c.job_category,
      createdAt: c.created_at,
      lastLoginAt: c.last_login_at,
      marketing: own.some((s) => s.marketing_consent_at),
      subscriptions: own.map((s) => ({
        track: s.track,
        status: s.status,
        plan: s.plan,
        paidUntil: s.paid_until,
        autoRenew: s.auto_renew,
        deliveryTime: s.delivery_time,
        createdAt: s.created_at,
      })),
      paidTotal: p?.total ?? 0,
      paidCount: p?.count ?? 0,
      refundedTotal: refunded.get(c.id) ?? 0,
      lastPaidAt: p?.last ?? null,
    };
  });
}

export async function loadDailyOverview(): Promise<DailyAdminOverview> {
  const db = admin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const [customers, paying, autoRenew, trials, openRefunds, orders, refunds] = await Promise.all([
    db.from("daily_customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    db.from("daily_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").gt("paid_until", now),
    db.from("daily_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").eq("auto_renew", true),
    db.from("daily_subscriptions").select("id", { count: "exact", head: true }).eq("status", "trial"),
    db.from("daily_refunds").select("id", { count: "exact", head: true }).in("status", ["requested", "refunding", "failed"]),
    db.from("daily_orders").select("amount").eq("status", "completed").gte("completed_at", since),
    db.from("daily_refunds").select("amount").eq("status", "refunded").gte("refunded_at", since),
  ]);
  const sum = (rows: { amount: number }[] | null) => (rows ?? []).reduce((total, r) => total + r.amount, 0);
  return {
    customers: customers.count ?? 0,
    paying: paying.count ?? 0,
    autoRenew: autoRenew.count ?? 0,
    trials: trials.count ?? 0,
    openRefunds: openRefunds.count ?? 0,
    revenue30d: sum(orders.data) - sum(refunds.data),
  };
}

// ------------------------------------------------------------------ lessons (콘텐츠)

export interface DailyAdminLessonRow {
  id: string;
  track: DailyTrack;
  publishOn: string;
  field: DailyField | null;
  expression: string;
  meaning: string;
  status: "draft" | "ready";
}

/** Every lesson of both levels, newest date first. Drafts included: only staff see this. */
export async function loadDailyLessons(): Promise<DailyAdminLessonRow[]> {
  const { data } = await admin()
    .from("daily_lessons")
    .select("id, track, publish_on, field, expression, meaning, status")
    .order("publish_on", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id as string,
    track: row.track as DailyTrack,
    publishOn: row.publish_on as string,
    field: (row.field as DailyField | null) ?? null,
    expression: row.expression as string,
    meaning: row.meaning as string,
    status: row.status as DailyAdminLessonRow["status"],
  }));
}

/**
 * One lesson as a subscriber would read it, found by its id rather than by a message's
 * access token, so staff can open any lesson (drafts too) without someone's link.
 */
export async function loadDailyLesson(
  id: string,
): Promise<{ lesson: DailyLessonContent; status: DailyAdminLessonRow["status"] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin().from("daily_lessons").select(`${LESSON_COLUMNS}, status`).eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as unknown as LessonRow & { status: DailyAdminLessonRow["status"] };
  return { lesson: toContent(row), status: row.status };
}
