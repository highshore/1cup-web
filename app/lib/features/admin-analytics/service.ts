import { admin } from "../../supabase/server";
import type { AdminAnalyticsData, AnalyticsRange, MonthlyAnalytics, RetentionCohort } from "./types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;
const PURCHASE_TYPES = new Set([
  "subscription_initial_payment",
  "subscription_recurring",
  "participation_pack_purchase",
]);

type DbRow = Record<string, unknown>;
type Purchase = {
  userId: string | null;
  kind: string;
  amount: number;
  time: number;
};
type Refund = { amount: number; time: number };
type Meetup = { id: string; time: number; capacity: number };

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberField(value: unknown): number {
  const valueAsNumber = Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : 0;
}

function timeField(value: unknown): number {
  const parsed = Date.parse(stringField(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function kstMonth(time: number): string {
  const date = new Date(time + KST_OFFSET_MS);
  return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0");
}

function monthKey(year: number, zeroBasedMonth: number): string {
  const date = new Date(Date.UTC(year, zeroBasedMonth, 1));
  return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0");
}

function monthStart(year: number, zeroBasedMonth: number): number {
  return Date.UTC(year, zeroBasedMonth, 1) - KST_OFFSET_MS;
}

function monthSerial(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return year * 12 + month - 1;
}

function isInRange(time: number, start: number, end: number): boolean {
  return Number.isFinite(time) && time >= start && time < end;
}

function roundPercent(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

// Read pages with a stable ordering. PostgREST's default 1,000-row cap otherwise
// silently truncates historical totals as the business grows.
async function readAll(
  table: string,
  columns: string,
  orderColumn: string,
  secondaryOrder?: string,
): Promise<DbRow[]> {
  const client = admin();
  const collected: DbRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from(table).select(columns).order(orderColumn, { ascending: true });
    if (secondaryOrder) query = query.order(secondaryOrder, { ascending: true });
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Admin analytics query failed for " + table + ": " + error.message);
    collected.push(...((data ?? []) as unknown as DbRow[]));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return collected;
}

export async function getAdminAnalytics(range: AnalyticsRange): Promise<AdminAnalyticsData> {
  const now = Date.now();
  const localNow = new Date(now + KST_OFFSET_MS);
  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();

  const from = range === "lastMonth"
    ? monthStart(year, month - 1)
    : monthStart(year, month - (range === "3m" ? 2 : range === "12m" ? 11 : 0));
  const until = range === "lastMonth" ? monthStart(year, month) : now;
  const previousFrom = range === "lastMonth"
    ? monthStart(year, month - 2)
    : monthStart(year, month - (range === "3m" ? 5 : range === "12m" ? 23 : 1));
  const previousUntil = from;

  // Service-role reads are never called before the route verifies the logged-in
  // administrator against the server-owned users.account_status field.
  const [orderRows, refundRows, userRows, meetupRows, participantRows] = await Promise.all([
    readAll("payment_orders", "user_id,type,amount,status,completed_at,order_number", "order_number"),
    readAll("payment_cancellations", "id,status,refund_amount_processed,requested_at", "id"),
    readAll("users", "uid,account_status,is_placeholder,deleted_at,has_active_subscription,billing_cancelled,subscription_end_date", "uid"),
    readAll("meetups", "id,date_time,max_participants,cancelled_at", "id"),
    readAll("meetup_participants", "meetup_id,user_id,registration_status", "meetup_id", "user_id"),
  ]);

  const purchases: Purchase[] = orderRows
    .filter((row) => row.status === "completed" && PURCHASE_TYPES.has(stringField(row.type)))
    .map((row) => ({
      userId: stringField(row.user_id) || null,
      kind: stringField(row.type),
      amount: Math.max(0, numberField(row.amount)),
      time: timeField(row.completed_at),
    }))
    .filter((row) => Number.isFinite(row.time))
    .sort((a, b) => a.time - b.time);

  const refunds: Refund[] = refundRows
    .filter((row) => row.status === "completed")
    .map((row) => ({
      amount: Math.max(0, numberField(row.refund_amount_processed)),
      // A processed_at column is not in the existing schema: use the recorded
      // request timestamp for completed refunds, and label this in the UI.
      time: timeField(row.requested_at),
    }))
    .filter((row) => Number.isFinite(row.time) && row.amount > 0);

  const firstPaymentByUser = new Map<string, number>();
  const firstPassByUser = new Map<string, number>();
  const paidByMonth = new Map<string, Set<string>>();
  for (const payment of purchases) {
    if (!payment.userId) continue;
    if (!firstPaymentByUser.has(payment.userId)) firstPaymentByUser.set(payment.userId, payment.time);
    if (payment.kind === "participation_pack_purchase" && !firstPassByUser.has(payment.userId)) {
      firstPassByUser.set(payment.userId, payment.time);
    }
    const key = kstMonth(payment.time);
    if (!paidByMonth.has(key)) paidByMonth.set(key, new Set());
    paidByMonth.get(key)!.add(payment.userId);
  }

  const getWindowPayments = (start: number, end: number) =>
    purchases.filter((payment) => isInRange(payment.time, start, end));
  const getWindowRefunds = (start: number, end: number) =>
    refunds.filter((refund) => isInRange(refund.time, start, end));

  const currentPayments = getWindowPayments(from, until);
  const currentRefunds = getWindowRefunds(from, until);
  const previousPayments = getWindowPayments(previousFrom, previousUntil);
  const previousRefunds = getWindowRefunds(previousFrom, previousUntil);

  const total = (rows: Array<{ amount: number }>) =>
    rows.reduce((sum, row) => sum + row.amount, 0);

  const grossRevenue = total(currentPayments);
  const refundTotal = total(currentRefunds);
  const netRevenue = grossRevenue - refundTotal;
  const previousNetRevenue = total(previousPayments) - total(previousRefunds);
  const growthPercent = previousNetRevenue > 0
    ? Math.round(((netRevenue - previousNetRevenue) / previousNetRevenue) * 1000) / 10
    : null;

  const payers = new Set(currentPayments.map((payment) => payment.userId).filter((id): id is string => Boolean(id)));
  const newPayers = [...payers].filter((id) => isInRange(firstPaymentByUser.get(id) ?? NaN, from, until)).length;
  const returningPayers = payers.size - newPayers;

  const currentPassPayers = new Set(currentPayments
    .filter((payment) => payment.kind === "participation_pack_purchase")
    .map((payment) => payment.userId)
    .filter((id): id is string => Boolean(id)));
  const returningPassPayers = [...currentPassPayers]
    .filter((id) => (purchases.filter((payment) => payment.userId === id && payment.kind === "participation_pack_purchase"
      && payment.time < until).length) >= 2).length;

  const qualifiedUsers = userRows.filter((row) =>
    row.is_placeholder !== true && row.deleted_at == null && row.account_status !== "admin");
  const activeSubscribers = qualifiedUsers.filter((row) =>
    row.has_active_subscription === true && timeField(row.subscription_end_date) > now);
  const renewingSubscriptions = activeSubscribers.filter((row) => row.billing_cancelled !== true).length;
  const stoppedActiveSubscriptions = activeSubscribers.filter((row) => row.billing_cancelled === true).length;
  const stoppedEndedSubscriptions = qualifiedUsers.filter((row) =>
    row.billing_cancelled === true && timeField(row.subscription_end_date) <= now).length;

  const meetups = new Map<string, Meetup>();
  for (const row of meetupRows) {
    if (row.cancelled_at) continue;
    const time = timeField(row.date_time);
    if (!Number.isFinite(time)) continue;
    const id = stringField(row.id);
    if (!id) continue;
    meetups.set(id, { id, time, capacity: Math.max(0, numberField(row.max_participants)) });
  }

  // Participation has registered/cancelled states, but no reliable attendance
  // check-in status. These are bookings, not verified physical attendance.
  const registrations = participantRows.map((row) => ({
    meetup: meetups.get(stringField(row.meetup_id)),
    userId: stringField(row.user_id),
    status: stringField(row.registration_status),
  })).filter((row) => row.meetup && row.userId);

  const windowMeetups = [...meetups.values()].filter((meetup) => isInRange(meetup.time, from, until));
  const windowMeetupIds = new Set(windowMeetups.map((meetup) => meetup.id));
  const windowRegs = registrations.filter((row) => windowMeetupIds.has(row.meetup!.id));
  const booked = windowRegs.filter((row) => row.status === "registered");
  const cancelled = windowRegs.filter((row) => row.status === "cancelled");
  const capacity = windowMeetups.reduce((sum, meetup) => sum + meetup.capacity, 0);
  const activeBookers30d = new Set(registrations
    .filter((row) => row.status === "registered" && row.meetup!.time >= now - 30 * DAY_MS
      && row.meetup!.time <= now)
    .map((row) => row.userId)).size;

  const months: MonthlyAnalytics[] = [];
  for (let offset = 11; offset >= 0; offset--) {
    const key = monthKey(year, month - offset);
    const payments = purchases.filter((payment) => kstMonth(payment.time) === key);
    const monthlyRefunds = refunds.filter((refund) => kstMonth(refund.time) === key);
    const meetupIds = new Set([...meetups.values()]
      .filter((meetup) => kstMonth(meetup.time) === key && meetup.time <= now)
      .map((meetup) => meetup.id));
    const monthMeetups = [...meetupIds].map((id) => meetups.get(id)!);
    const monthPayers = paidByMonth.get(key) ?? new Set<string>();
    const monthlyNew = [...monthPayers].filter((id) => kstMonth(firstPaymentByUser.get(id)!) === key).length;
    const membershipRevenue = total(payments.filter((payment) => payment.kind !== "participation_pack_purchase"));
    const passRevenue = total(payments.filter((payment) => payment.kind === "participation_pack_purchase"));
    const monthlyRefundAmount = total(monthlyRefunds);
    months.push({
      month: key,
      membershipRevenue,
      passRevenue,
      refunds: monthlyRefundAmount,
      netRevenue: membershipRevenue + passRevenue - monthlyRefundAmount,
      newPayers: monthlyNew,
      returningPayers: monthPayers.size - monthlyNew,
      meetups: monthMeetups.length,
      reservations: registrations.filter((row) =>
        row.status === "registered" && meetupIds.has(row.meetup!.id)).length,
      capacity: monthMeetups.reduce((sum, meetup) => sum + meetup.capacity, 0),
    });
  }

  const cohorts: RetentionCohort[] = [];
  const nowSerial = monthSerial(kstMonth(now));
  for (let offset = 5; offset >= 0; offset--) {
    const key = monthKey(year, month - offset);
    const cohortMembers = [...firstPaymentByUser.entries()]
      .filter(([, time]) => kstMonth(time) === key).map(([id]) => id);
    const serial = monthSerial(key);
    const retention = Array.from({ length: 6 }, (_, index) => {
      if (serial + index > nowSerial || cohortMembers.length === 0) return null;
      const target = monthKey(year, month - offset + index);
      const buyers = paidByMonth.get(target) ?? new Set<string>();
      return roundPercent(cohortMembers.filter((id) => buyers.has(id)).length, cohortMembers.length);
    });
    cohorts.push({ cohort: key, size: cohortMembers.length, retention });
  }

  return {
    range: {
      id: range,
      from: new Date(from).toISOString(),
      to: new Date(until).toISOString(),
      partial: range !== "lastMonth",
    },
    summary: {
      grossRevenue,
      netRevenue,
      refunds: refundTotal,
      refundCount: currentRefunds.length,
      previousNetRevenue,
      growthPercent,
      payingMembers: payers.size,
      newPayers,
      returningPayers,
      repeatPayerPercent: roundPercent(returningPayers, payers.size) ?? 0,
      averageRevenuePerPayer: payers.size > 0 ? Math.round(netRevenue / payers.size) : 0,
      membershipRevenue: total(currentPayments.filter((payment) => payment.kind !== "participation_pack_purchase")),
      passRevenue: total(currentPayments.filter((payment) => payment.kind === "participation_pack_purchase")),
      recurringPayments: currentPayments.filter((payment) => payment.kind === "subscription_recurring").length,
      packRepurchasePercent: roundPercent(returningPassPayers, currentPassPayers.size),
      activeBookers30d,
      activeSubscriptions: activeSubscribers.length,
      renewingSubscriptions,
      stoppedActiveSubscriptions,
      stoppedEndedSubscriptions,
    },
    operations: {
      meetupCount: windowMeetups.length,
      reservations: booked.length,
      cancelledRegistrations: cancelled.length,
      uniqueBookers: new Set(booked.map((row) => row.userId)).size,
      capacity,
      occupancyPercent: roundPercent(booked.length, capacity),
      cancellationPercent: roundPercent(cancelled.length, booked.length + cancelled.length),
    },
    months,
    cohorts,
  };
}
