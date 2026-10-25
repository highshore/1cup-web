"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ClockIcon,
  NoSymbolIcon,
  UserMinusIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";

type Range = "days30" | "days90" | "year" | "all";
type Outcome = "rejoined" | "joinedOther" | "noJoin" | "upcoming" | "meetupCancelled";

type CancellationRow = {
  event_id: string;
  cancelled_at: string;
  registered_at: string | null;
  source: "member" | "operator" | "admin";
  role: string;
  access_type: string;
  credit_refunded: boolean;
  backfilled: boolean;
  user_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  meetup_id: string;
  meetup_title: string | null;
  meetup_location: string | null;
  meetup_starts_at: string | null;
  meetup_cancelled: boolean;
  rejoined_same_meetup: boolean;
  same_week_meetups: { id: string; title: string | null; starts_at: string }[];
};

type MemberSummary = {
  userId: string;
  name: string;
  contact: string;
  count: number;
  late: number;
  noJoin: number;
  last: string;
};

// Matches the 24-hour credit refund window in cancel_meetup_registration.
const LATE_HOURS = 24;
const HOUR = 3600000;
const RANGE_DAYS: Record<Range, number | null> = { days30: 30, days90: 90, year: 365, all: null };
const ranges: Range[] = ["days30", "days90", "year", "all"];

const panelClass = "min-w-0 rounded-2xl border border-[#e9e8e5] bg-white p-4 shadow-[0_3px_18px_rgba(0,0,0,0.035)] sm:p-6";
const eyebrowClass = "text-[10px] font-black uppercase tracking-[0.15em] text-[#f47a4a]";
const mutedClass = "text-[12px] font-medium leading-relaxed text-[#737373]";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 text-[12px] font-bold text-[#343434] transition hover:border-[#f47a4a] hover:bg-[#fff9f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f47a4a]";
const thClass = "px-3 py-3 first:pl-0 last:pr-0";
const tdClass = "px-3 py-3 align-top first:pl-0 last:pr-0";

const outcomeClass: Record<Outcome, string> = {
  rejoined: "bg-[#eef7ee] text-[#2f7a3a]",
  joinedOther: "bg-[#eef7ee] text-[#2f7a3a]",
  noJoin: "bg-[#fdeceb] text-[#c2412d]",
  upcoming: "bg-[#f3f3f3] text-[#666]",
  meetupCancelled: "bg-[#f3f3f3] text-[#666]",
};

function outcomeOf(row: CancellationRow, now: number): Outcome {
  if (row.meetup_cancelled) return "meetupCancelled";
  if (row.rejoined_same_meetup) return "rejoined";
  if (row.same_week_meetups.length > 0) return "joinedOther";
  if (row.meetup_starts_at && new Date(row.meetup_starts_at).getTime() > now) return "upcoming";
  return "noJoin";
}

function leadHours(row: CancellationRow) {
  if (!row.meetup_starts_at) return null;
  return (new Date(row.meetup_starts_at).getTime() - new Date(row.cancelled_at).getTime()) / HOUR;
}

function heldHours(row: CancellationRow) {
  if (!row.registered_at) return null;
  return (new Date(row.cancelled_at).getTime() - new Date(row.registered_at).getTime()) / HOUR;
}

function MetricCard({ label, value, note, icon }: {
  label: string;
  value: number;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={panelClass + " flex flex-col justify-between"}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-extrabold text-[#4a4a4a]">{label}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff2e9] text-[#e77143]">{icon}</span>
      </div>
      <div className="mt-3 text-[26px] font-black tracking-[-0.045em] text-[#171717] tabular-nums sm:text-[30px]">{value}</div>
      <div className="mt-1 text-[11px] leading-5 text-[#8a8a8a]">{note}</div>
    </div>
  );
}

export default function AdminCancellationsClient() {
  const { t, locale } = useI18n();
  const copy = t.admin.cancellations;
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const [range, setRange] = useState<Range>("days90");
  const [memberOnly, setMemberOnly] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [rows, setRows] = useState<CancellationRow[]>([]);
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // app/admin/layout.tsx already gates the route; wait for the browser session so
    // the RPC's is_admin() check sees it.
    if (authLoading || !currentUser || accountStatus !== "admin") return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(false);
      const days = RANGE_DAYS[range];
      const from = days === null ? new Date(0) : new Date(Date.now() - days * 24 * HOUR);
      const { data, error: rpcError } = await supabase.rpc("admin_meetup_cancellation_report", {
        p_from: from.toISOString(),
        p_to: new Date(Date.now() + HOUR).toISOString(),
      });
      if (!active) return;
      if (rpcError) {
        console.error("Error loading meetup cancellations:", rpcError);
        setError(true);
        setRows([]);
      } else {
        setRows((data ?? []) as CancellationRow[]);
        setLoadedAt(Date.now());
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [authLoading, currentUser, accountStatus, range, refreshToken]);

  const visibleRows = useMemo(
    () => (memberOnly ? rows.filter((row) => row.source === "member") : rows),
    [rows, memberOnly],
  );

  const members = useMemo(() => {
    const byUser = new Map<string, MemberSummary>();
    for (const row of visibleRows) {
      const lead = leadHours(row);
      const summary = byUser.get(row.user_id) ?? {
        userId: row.user_id,
        name: row.display_name || copy.unknownMember,
        contact: row.phone || row.email || "",
        count: 0,
        late: 0,
        noJoin: 0,
        last: row.cancelled_at,
      };
      summary.count += 1;
      if (lead !== null && lead < LATE_HOURS) summary.late += 1;
      if (outcomeOf(row, loadedAt) === "noJoin") summary.noJoin += 1;
      if (row.cancelled_at > summary.last) summary.last = row.cancelled_at;
      byUser.set(row.user_id, summary);
    }
    return [...byUser.values()].sort((a, b) => b.count - a.count || b.late - a.late || b.last.localeCompare(a.last));
  }, [visibleRows, loadedAt, copy.unknownMember]);

  const metrics = useMemo(() => ({
    total: visibleRows.length,
    late: visibleRows.filter((row) => {
      const lead = leadHours(row);
      return lead !== null && lead < LATE_HOURS;
    }).length,
    noJoin: visibleRows.filter((row) => outcomeOf(row, loadedAt) === "noJoin").length,
    repeat: members.filter((member) => member.count >= 2).length,
  }), [visibleRows, members, loadedAt]);

  const logRows = selectedUser ? visibleRows.filter((row) => row.user_id === selectedUser) : visibleRows;
  const hasBackfilled = visibleRows.some((row) => row.backfilled);

  const dateTime = useMemo(
    () => new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      timeZone: "Asia/Seoul",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    [locale],
  );
  const formatDate = (value: string | null) => (value ? dateTime.format(new Date(value)) : copy.unknown);
  const formatDuration = (hours: number | null) => {
    if (hours === null) return copy.unknown;
    const value = Math.max(0, hours);
    if (value < 1) return copy.duration.minutes.replace("{n}", String(Math.round(value * 60)));
    if (value < 48) return copy.duration.hours.replace("{n}", String(Math.round(value)));
    return copy.duration.days.replace("{n}", String(Math.round(value / 24)));
  };

  if (authLoading || !currentUser || accountStatus !== "admin") {
    return <p className="p-10 text-center text-[12px] font-semibold text-[#888]">{copy.loading}</p>;
  }

  return (
    <main className="mx-auto w-full max-w-[1380px] px-3 pb-16 pt-4 sm:px-6 sm:pt-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#777] transition hover:text-[#f47a4a]">
        <ArrowLeftIcon className="h-3.5 w-3.5" />{copy.back}
      </Link>
      <header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <span className={eyebrowClass}>ONE CUP ENGLISH / CANCELLATIONS</span>
          <h1 className="m-0 mt-2 text-[27px] font-black tracking-[-0.04em] text-[#171717] sm:text-[36px]">{copy.title}</h1>
          <p className={"m-0 mt-2 " + mutedClass}>{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl bg-[#f5f5f5] p-1">
            {ranges.map((option) => (
              <button key={option} type="button" onClick={() => setRange(option)}
                className={"rounded-lg px-3 py-2 text-[12px] font-bold " + (range === option ? "bg-white text-[#171717] shadow-sm" : "text-[#777]")}>
                {copy.ranges[option]}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-[12px] font-bold text-[#555]">
            <input type="checkbox" checked={memberOnly} onChange={(e) => setMemberOnly(e.target.checked)} className="h-4 w-4 accent-[#f47a4a]" />
            {copy.memberOnly}
          </label>
          <button type="button" onClick={() => setRefreshToken((token) => token + 1)} disabled={loading} className={buttonClass}>
            <ArrowPathIcon className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />{copy.refresh}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-[#f1f0ed]" />)}
          <p className="col-span-full mt-3 text-center text-[12px] font-semibold text-[#888]" role="status">{copy.loading}</p>
        </div>
      ) : error ? (
        <div className={panelClass + " mt-7 flex flex-col items-center gap-4 py-16 text-center"} role="alert">
          <p className="m-0 text-[14px] font-bold text-[#555]">{copy.error}</p>
          <button type="button" className={buttonClass} onClick={() => setRefreshToken((token) => token + 1)}>{copy.retry}</button>
        </div>
      ) : (
        <div className="mt-7 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label={copy.metrics.total} value={metrics.total} note={copy.metrics.totalHelp} icon={<XCircleIcon className="h-5 w-5" />} />
            <MetricCard label={copy.metrics.late} value={metrics.late} note={copy.metrics.lateHelp.replace("{hours}", String(LATE_HOURS))} icon={<ClockIcon className="h-5 w-5" />} />
            <MetricCard label={copy.metrics.noJoin} value={metrics.noJoin} note={copy.metrics.noJoinHelp} icon={<NoSymbolIcon className="h-5 w-5" />} />
            <MetricCard label={copy.metrics.repeat} value={metrics.repeat} note={copy.metrics.repeatHelp} icon={<UserMinusIcon className="h-5 w-5" />} />
          </div>

          {visibleRows.length === 0 ? (
            <div className={panelClass + " py-16 text-center text-[13px] font-bold text-[#777]"}>{copy.empty}</div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              <section className={panelClass}>
                <h2 className="m-0 text-[15px] font-extrabold text-[#202020]">{copy.membersTitle}</h2>
                <p className={"m-0 mt-1 " + mutedClass}>{copy.membersSubtitle}</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[340px] border-collapse text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-[#eaeaea] text-[11px] font-bold text-[#777]">
                        <th className={thClass}>{copy.columns.member}</th>
                        <th className={thClass + " text-right"}>{copy.columns.count}</th>
                        <th className={thClass + " text-right"}>{copy.columns.late}</th>
                        <th className={thClass + " text-right"}>{copy.columns.noJoin}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.userId}
                          className={"cursor-pointer border-b border-[#f2f2f2] last:border-b-0 hover:bg-[#fff9f5] " + (selectedUser === member.userId ? "bg-[#fff2e9]" : "")}
                          onClick={() => setSelectedUser(selectedUser === member.userId ? null : member.userId)}>
                          <td className={tdClass}>
                            <button type="button" className="text-left font-bold text-[#222]" aria-pressed={selectedUser === member.userId}>{member.name}</button>
                            <div className="text-[11px] text-[#8a8a8a]">{member.contact}</div>
                            <div className="text-[11px] text-[#8a8a8a]">{copy.columns.last}: {formatDate(member.last)}</div>
                          </td>
                          <td className={tdClass + " text-right font-black tabular-nums"}>{member.count}</td>
                          <td className={tdClass + " text-right tabular-nums " + (member.late ? "font-black text-[#e77143]" : "text-[#555]")}>{member.late}</td>
                          <td className={tdClass + " text-right tabular-nums " + (member.noJoin ? "font-black text-[#c2412d]" : "text-[#555]")}>{member.noJoin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="m-0 text-[15px] font-extrabold text-[#202020]">{copy.eventsTitle}</h2>
                  {selectedUser && (
                    <button type="button" className={buttonClass} onClick={() => setSelectedUser(null)}>{copy.clearFilter}</button>
                  )}
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-[#eaeaea] text-[11px] font-bold text-[#777]">
                        <th className={thClass}>{copy.columns.cancelledAt}</th>
                        <th className={thClass}>{copy.columns.member}</th>
                        <th className={thClass}>{copy.columns.meetup}</th>
                        <th className={thClass + " text-right"}>{copy.columns.leadTime}</th>
                        <th className={thClass + " text-right"}>{copy.columns.heldFor}</th>
                        <th className={thClass}>{copy.columns.outcome}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logRows.map((row) => {
                        const lead = leadHours(row);
                        const outcome = outcomeOf(row, loadedAt);
                        return (
                          <tr key={row.event_id} className="border-b border-[#f2f2f2] last:border-b-0">
                            <td className={tdClass + " whitespace-nowrap font-semibold text-[#343434]"}>
                              {formatDate(row.cancelled_at)}
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.source !== "member" && <span className="rounded-md bg-[#f3f3f3] px-1.5 py-0.5 text-[10px] font-bold text-[#666]">{copy.source[row.source]}</span>}
                                {row.credit_refunded && <span className="rounded-md bg-[#fff2e9] px-1.5 py-0.5 text-[10px] font-bold text-[#e77143]">{copy.refunded}</span>}
                                {row.backfilled && <span className="rounded-md bg-[#f3f3f3] px-1.5 py-0.5 text-[10px] font-bold text-[#888]">{copy.backfilled}</span>}
                              </div>
                            </td>
                            <td className={tdClass}>
                              <div className="font-bold text-[#222]">{row.display_name || copy.unknownMember}</div>
                              <div className="text-[11px] text-[#8a8a8a]">{row.phone || row.email || ""}</div>
                            </td>
                            <td className={tdClass}>
                              <Link href={`/meetup/${row.meetup_id}`} className="font-bold text-[#222] hover:text-[#f47a4a]">{row.meetup_title || row.meetup_id}</Link>
                              <div className="text-[11px] text-[#8a8a8a]">{formatDate(row.meetup_starts_at)}{row.meetup_location ? ` · ${row.meetup_location}` : ""}</div>
                            </td>
                            <td className={tdClass + " text-right tabular-nums " + (lead !== null && lead < LATE_HOURS ? "font-black text-[#e77143]" : "text-[#555]")}>{formatDuration(lead)}</td>
                            <td className={tdClass + " text-right tabular-nums text-[#555]"}>{formatDuration(heldHours(row))}</td>
                            <td className={tdClass}>
                              <span className={"inline-block whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-bold " + outcomeClass[outcome]}>{copy.outcome[outcome]}</span>
                              {outcome === "joinedOther" && row.same_week_meetups.map((meetup) => (
                                <Link key={meetup.id} href={`/meetup/${meetup.id}`} className="mt-1 block text-[11px] text-[#8a8a8a] hover:text-[#f47a4a]">
                                  {meetup.title || meetup.id} · {formatDate(meetup.starts_at)}
                                </Link>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          <div className="space-y-1">
            <p className={"m-0 " + mutedClass}>{copy.allTimesKst}</p>
            <p className={"m-0 " + mutedClass}>{copy.attendanceNote}</p>
            {hasBackfilled && <p className={"m-0 " + mutedClass}>{copy.backfillNote}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
