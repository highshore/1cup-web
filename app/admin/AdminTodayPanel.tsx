"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase/client";
import { useI18n } from "../lib/i18n/I18nProvider";

type UpcomingMeetup = {
  id: string;
  title: string;
  dateTime: string;
  participants: number | null;
  maxParticipants: number | null;
};

type MarketingRun = {
  id: string;
  status: string;
  title: string;
  createdAt: string;
  url: string | null;
};

type TodayData = {
  meetups: UpcomingMeetup[];
  newRegistrations: number | null;
  cancellations: number | null;
  runs: MarketingRun[];
  partialFailure: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const panelClass =
  "rounded-2xl border-[3px] border-[#050505] bg-white p-5 shadow-[4px_4px_0_rgba(5,5,5,0.9)]";
const panelTitleClass = "m-0 text-[15px] font-black text-[#050505]";
const mutedClass = "text-[13px] font-semibold text-[rgba(5,5,5,0.6)]";
const linkClass = "mt-3 inline-block text-[13px] font-black text-[#e0602e] no-underline hover:underline";

const RUN_STATUS_TONE: Record<string, string> = {
  completed: "bg-[#e6f2e9] text-[#3f7a50]",
  skipped: "bg-[#f1efec] text-[#706a64]",
  failed: "bg-[#f8e4e2] text-[#b9473f]",
};

// The admin overview's "today" panel: upcoming meetups, recent sign-ups and
// cancellations, and the latest marketing runs. All reads go through RLS
// (`is_admin()` policies), so it only renders data for signed-in admins.
export default function AdminTodayPanel() {
  const { t, locale } = useI18n();
  const copy = t.admin.today;
  const [data, setData] = useState<TodayData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
      const weekAhead = new Date(now.getTime() + 7 * DAY_MS).toISOString();

      const [meetupsResult, registrationsResult, cancellationsResult, runsResult] = await Promise.all([
        supabase
          .from("meetups")
          .select("id, title, date_time, current_participants, max_participants")
          .is("cancelled_at", null)
          .gte("date_time", now.toISOString())
          .lte("date_time", weekAhead)
          .order("date_time", { ascending: true })
          .limit(8),
        supabase
          .from("meetup_participants")
          .select("meetup_id", { count: "exact", head: true })
          .eq("role", "participant")
          .gte("registered_at", weekAgo),
        supabase
          .from("meetup_participants")
          .select("meetup_id", { count: "exact", head: true })
          .gte("cancelled_at", weekAgo),
        supabase
          .from("marketing_cron_runs")
          .select("id, status, post_title, created_at, external_post_url")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (!active) return;
      const partialFailure = Boolean(
        meetupsResult.error || registrationsResult.error || cancellationsResult.error || runsResult.error,
      );
      if (partialFailure) {
        console.error("Error loading admin today panel:", {
          meetups: meetupsResult.error,
          registrations: registrationsResult.error,
          cancellations: cancellationsResult.error,
          runs: runsResult.error,
        });
      }

      setData({
        meetups: (meetupsResult.data ?? []).map((row) => ({
          id: String(row.id),
          title: String(row.title ?? ""),
          dateTime: String(row.date_time ?? ""),
          participants: typeof row.current_participants === "number" ? row.current_participants : null,
          maxParticipants: typeof row.max_participants === "number" ? row.max_participants : null,
        })),
        newRegistrations: registrationsResult.error ? null : registrationsResult.count ?? 0,
        cancellations: cancellationsResult.error ? null : cancellationsResult.count ?? 0,
        runs: (runsResult.data ?? []).map((row) => ({
          id: String(row.id),
          status: String(row.status ?? ""),
          title: String(row.post_title ?? ""),
          createdAt: String(row.created_at ?? ""),
          url: typeof row.external_post_url === "string" && row.external_post_url ? row.external_post_url : null,
        })),
        partialFailure,
      });
    };

    load().catch((error) => {
      console.error("Error loading admin today panel:", error);
      if (active) setData({ meetups: [], newRegistrations: null, cancellations: null, runs: [], partialFailure: true });
    });
    return () => {
      active = false;
    };
  }, []);

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      timeZone: "Asia/Seoul",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const count = (value: number | null | undefined) => (value === null || value === undefined ? "—" : String(value));
  const statusLabel = (status: string) =>
    (copy.runStatus as Record<string, string>)[status] ?? status;

  return (
    <section aria-labelledby="admin-today-title">
      <div className="mb-4">
        <h1 id="admin-today-title" className="m-0 text-[28px] font-black text-[#050505]">
          {copy.title}
        </h1>
        <p className={`m-0 mt-1 ${mutedClass}`}>{copy.subtitle}</p>
        {data?.partialFailure && <p className="m-0 mt-2 text-[13px] font-bold text-[#b9473f]">{copy.loadFailed}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-3">
        <div className={`${panelClass} min-[980px]:col-span-2`}>
          <h2 className={panelTitleClass}>{copy.upcomingMeetups}</h2>
          {!data ? (
            <div className="mt-3 h-20 animate-pulse rounded-xl bg-[#f1f0ed]" />
          ) : data.meetups.length === 0 ? (
            <p className={`mt-3 mb-0 ${mutedClass}`}>{copy.noUpcomingMeetups}</p>
          ) : (
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {data.meetups.map((meetup) => (
                <li key={meetup.id}>
                  <Link
                    href={`/meetup/${meetup.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#e7e3de] px-3 py-2 text-[#050505] no-underline hover:border-[#050505]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-black">{meetup.title}</span>
                      <span className={mutedClass}>{formatDate(meetup.dateTime)}</span>
                    </span>
                    {meetup.participants !== null && (
                      <span className="shrink-0 text-[13px] font-black">
                        {copy.participants.replace(
                          "{count}",
                          meetup.maxParticipants
                            ? `${meetup.participants}/${meetup.maxParticipants}`
                            : String(meetup.participants),
                        )}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 min-[980px]:grid-cols-1">
          <div className={panelClass}>
            <h2 className={panelTitleClass}>{copy.newRegistrations}</h2>
            <div className="mt-2 text-[30px] font-black text-[#050505]">{count(data?.newRegistrations)}</div>
            <Link href="/admin/members" className={linkClass}>
              {copy.viewMembers}
            </Link>
          </div>
          <div className={panelClass}>
            <h2 className={panelTitleClass}>{copy.cancellations}</h2>
            <div className="mt-2 text-[30px] font-black text-[#050505]">{count(data?.cancellations)}</div>
            <Link href="/admin/cancellations" className={linkClass}>
              {copy.reviewCancellations}
            </Link>
          </div>
        </div>

        <div className={`${panelClass} min-[980px]:col-span-3`}>
          <h2 className={panelTitleClass}>{copy.marketingRuns}</h2>
          {!data ? (
            <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#f1f0ed]" />
          ) : data.runs.length === 0 ? (
            <p className={`mt-3 mb-0 ${mutedClass}`}>{copy.noMarketingRuns}</p>
          ) : (
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {data.runs.map((run) => (
                <li key={run.id} className="flex items-center gap-3 text-[13px]">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-black ${
                      RUN_STATUS_TONE[run.status] ?? "bg-[#f1efec] text-[#050505]"
                    }`}
                  >
                    {statusLabel(run.status)}
                  </span>
                  <span className="shrink-0 font-semibold text-[rgba(5,5,5,0.6)]">{formatDate(run.createdAt)}</span>
                  {run.url ? (
                    <a
                      href={run.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate font-bold text-[#050505]"
                    >
                      {run.title}
                    </a>
                  ) : (
                    <span className="min-w-0 truncate font-bold text-[#050505]">{run.title}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/marketing" className={linkClass}>
            {copy.viewMarketing}
          </Link>
        </div>
      </div>
    </section>
  );
}
