"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import { useI18n } from "../../../i18n/I18nProvider";
import {
  fetchMarketingChannelConnections,
  fetchMarketingChannelRecentRuns,
  fetchMarketingChannelRuns,
  MARKETING_CHANNEL_RUN_PAGE_SIZE,
} from "../services/growth_service";
import {
  MarketingChannelConnection,
  MarketingCronRun,
  MarketingRunStatus,
  SocialMarketingChannel,
} from "../types/growth_types";
import DailyPostsPanel from "../../social/components/DailyPostsPanel";
import ChannelConnections from "./ChannelConnections";

const DAY_MS = 24 * 60 * 60 * 1000;

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);

const cardClass =
  "rounded-2xl border-[3px] border-[#050505] bg-white p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)] max-[620px]:p-4";
const sectionTitleClass = "m-0 text-[20px] font-black text-[#050505]";
const mutedClass = "text-[13px] font-semibold text-[rgba(5,5,5,0.62)]";
const smallButtonClass =
  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[#050505] bg-white px-2.5 py-1 text-[12px] font-black text-[#050505] no-underline hover:bg-[#f7f6f2] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a]";

const STATUS_TONE: Record<MarketingRunStatus, string> = {
  queued: "bg-[#f1efec] text-[#050505]",
  running: "bg-[#fff1e9] text-[#b6531f]",
  completed: "bg-[#e6f2e9] text-[#3f7a50]",
  skipped: "bg-[#f1efec] text-[#706a64]",
  awaitingPublisher: "bg-[#f1efec] text-[#706a64]",
  failed: "bg-[#f8e4e2] text-[#b9473f]",
};

// One admin page per social channel (/admin/threads, /admin/instagram): the daily post
// approval panel, account connection, 30-day totals, and every post attempt, 20 per page.
export default function SocialChannelAdmin({ channel }: { channel: SocialMarketingChannel }) {
  const { locale, t } = useI18n();
  const copy = t.admin.social;
  const marketing = t.admin.marketing;
  const channelName = marketing.channels.names[channel];

  const [connections, setConnections] = useState<MarketingChannelConnection[]>([]);
  const [connectionsError, setConnectionsError] = useState(false);
  const [runs, setRuns] = useState<MarketingCronRun[]>([]);
  const [recentRuns, setRecentRuns] = useState<MarketingCronRun[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      setConnections(await fetchMarketingChannelConnections());
      setConnectionsError(false);
    } catch (error) {
      console.error(`Unable to load ${channel} connection:`, error);
      setConnectionsError(true);
    }
  }, [channel]);

  const load = useCallback(
    async (pageNumber = page) => {
      setLoading(true);
      const [, pageResult, recentResult] = await Promise.allSettled([
        loadConnections(),
        fetchMarketingChannelRuns(channel, pageNumber),
        fetchMarketingChannelRecentRuns(channel),
      ]);
      if (pageResult.status === "fulfilled") {
        setRuns(pageResult.value.runs);
        setTotal(pageResult.value.total);
      }
      if (recentResult.status === "fulfilled") setRecentRuns(recentResult.value);
      const failed = pageResult.status === "rejected" || recentResult.status === "rejected";
      if (failed) console.error(`Unable to load ${channel} admin data`, pageResult, recentResult);
      setLoadError(failed);
      setLoading(false);
    },
    [channel, loadConnections, page],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const pageCount = Math.max(1, Math.ceil(total / MARKETING_CHANNEL_RUN_PAGE_SIZE));
  const goToPage = (next: number) => {
    setPage(Math.min(pageCount, Math.max(1, next)));
    document.getElementById(`${channel}-posts`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Up to seven numbered buttons around the current page.
  const pageNumbers = (() => {
    const start = Math.max(1, Math.min(page - 3, pageCount - 6));
    return Array.from({ length: Math.min(7, pageCount) }, (_, index) => start + index);
  })();

  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }),
    [locale],
  );

  const summary = useMemo(() => {
    const since = Date.now() - 30 * DAY_MS;
    const recent = recentRuns.filter((run) => {
      const at = run.completedAt || run.startedAt || run.scheduledFor;
      return at ? at.getTime() >= since : false;
    });
    const posted = recent.filter((run) => run.status === "completed");
    const sum = (key: "impressions" | "likes" | "comments" | "clicks") =>
      posted.reduce((total, run) => total + run.performance[key], 0);
    const views = sum("impressions");
    const clicks = sum("clicks");
    return {
      posts: posted.length,
      views,
      likes: sum("likes"),
      comments: sum("comments"),
      clicks,
      ctr: views > 0 ? `${((clicks / views) * 100).toFixed(1)}%` : "—",
      failed: recent.filter((run) => run.status === "failed").length,
    };
  }, [recentRuns]);

  const commentsLabel = channel === "threads" ? copy.replies : copy.comments;
  const count = (value: number) => value.toLocaleString(locale === "ko" ? "ko-KR" : "en-US");

  const copyTrackingLink = async (run: MarketingCronRun) => {
    try {
      await navigator.clipboard.writeText(run.trackingUrl);
      setCopiedRunId(run.id);
      window.setTimeout(() => setCopiedRunId(null), 1800);
    } catch (error) {
      console.error("Unable to copy tracking link:", error);
    }
  };

  const latestTrackingUrl = recentRuns.find((run) => run.status === "completed" && run.trackingUrl)?.trackingUrl;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-[30px] px-5 pt-0 pb-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-[28px] font-black text-[#050505]">{fill(copy.title, { channel: channelName })}</h1>
          <p className={`mx-0 mt-1.5 mb-0 max-w-[720px] leading-[1.6] ${mutedClass}`}>
            {fill(copy.subtitle, { channel: channelName })}
          </p>
          {loadError && <p className="m-0 mt-2 text-[13px] font-bold text-[#b9473f]">{copy.loadError}</p>}
        </div>
        <button type="button" className={smallButtonClass} disabled={loading} onClick={() => void load(page)}>
          <ArrowPathIcon width={15} className={loading ? "animate-spin" : ""} /> {copy.refresh}
        </button>
      </header>

      <DailyPostsPanel channel={channel} />

      <ChannelConnections
        connections={connections}
        loadError={connectionsError}
        onChanged={loadConnections}
        channels={[channel]}
      />

      <section className={cardClass} aria-labelledby={`${channel}-summary`}>
        <h2 id={`${channel}-summary`} className={sectionTitleClass}>
          {copy.summaryTitle}
        </h2>
        <dl className="m-0 mt-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
          {[
            [copy.posts, count(summary.posts)],
            [copy.views, count(summary.views)],
            [copy.likes, count(summary.likes)],
            [commentsLabel, count(summary.comments)],
            [copy.clicks, count(summary.clicks)],
            [copy.ctr, summary.ctr],
            [copy.failed, count(summary.failed)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border-2 border-[#050505] p-3">
              <dt className="text-[12px] font-bold text-[rgba(5,5,5,0.6)]">{label}</dt>
              <dd className="m-0 mt-1 text-[24px] font-black text-[#050505]">{loading ? "…" : value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={cardClass} aria-labelledby={`${channel}-posts`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${channel}-posts`} className={sectionTitleClass}>
            {copy.postsTitle}
          </h2>
          {total > 0 && (
            <span className={mutedClass}>
              {fill(copy.pageStatus, { page: String(page), pages: String(pageCount), total: String(total) })}
            </span>
          )}
        </div>
        {channel === "instagram" && (
          <div className="mt-3 grid gap-2 rounded-xl bg-[#fff1e9] p-3">
            <p className="m-0 text-[13px] font-semibold leading-[1.6] text-[#050505]">{copy.instagramLinkHint}</p>
            {latestTrackingUrl && (
              <code className="w-fit max-w-full break-all rounded-md bg-white px-2 py-1 text-[12px] text-[#050505]">
                {latestTrackingUrl}
              </code>
            )}
          </div>
        )}
        {!loading && runs.length === 0 ? (
          <p className={`mt-3 mb-0 ${mutedClass}`}>{copy.postsEmpty}</p>
        ) : (
          <ul className="m-0 mt-4 grid list-none gap-3 p-0">
            {runs.map((run) => {
              const at = run.completedAt || run.startedAt || run.scheduledFor;
              const showsMetrics = run.status === "completed";
              return (
                <li key={run.id} className="grid gap-2.5 rounded-xl border-2 border-[#050505] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-black ${STATUS_TONE[run.status]}`}>
                      {copy.status[run.status]}
                    </span>
                    <span className="text-[12px] font-bold text-[rgba(5,5,5,0.6)]">{at ? dateTime.format(at) : "—"}</span>
                    <span className="text-[12px] font-bold text-[rgba(5,5,5,0.6)]">
                      ·{" "}
                      {run.trigger === "manual"
                        ? marketing.triggerManual
                        : run.trigger === "daily"
                          ? marketing.channels.triggerDaily
                          : marketing.triggerScheduled}
                    </span>
                  </div>
                  {run.postTitle && <strong className="text-[15px] font-black text-[#050505]">{run.postTitle}</strong>}
                  {run.photos.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto">
                      {run.photos.map((photo, index) => (
                        <img
                          key={`${photo.url}_${index}`}
                          src={photo.url}
                          alt={photo.alt || marketing.photoDefaultAlt}
                          className="h-16 w-16 flex-none rounded-lg bg-[#f5f5f5] object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {run.postCopy && (
                    <p className="m-0 line-clamp-4 text-[14px] leading-[1.6] whitespace-pre-wrap text-[#252525]">
                      {run.postCopy}
                    </p>
                  )}
                  {run.error && run.status !== "completed" && (
                    <p className="m-0 flex items-start gap-1.5 text-[13px] font-bold text-[#b9473f]">
                      <ExclamationTriangleIcon width={16} className="mt-0.5 flex-none" /> {run.error}
                    </p>
                  )}
                  {showsMetrics && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-bold text-[#050505]">
                      <span>
                        {copy.views} {count(run.performance.impressions)}
                      </span>
                      <span>
                        {copy.likes} {count(run.performance.likes)}
                      </span>
                      <span>
                        {commentsLabel} {count(run.performance.comments)}
                      </span>
                      <span>
                        {copy.clicks} {count(run.performance.clicks)}
                      </span>
                      {run.performanceCheckedAt && (
                        <span className="font-semibold text-[rgba(5,5,5,0.55)]">
                          {fill(copy.metricsUpdated, { date: dateTime.format(run.performanceCheckedAt) })}
                        </span>
                      )}
                    </div>
                  )}
                  {(run.externalPostUrl || run.trackingUrl) && (
                    <div className="flex flex-wrap gap-2">
                      {run.externalPostUrl && (
                        <a href={run.externalPostUrl} target="_blank" rel="noopener noreferrer" className={smallButtonClass}>
                          <ArrowTopRightOnSquareIcon width={15} /> {copy.viewPost}
                        </a>
                      )}
                      {run.trackingUrl && (
                        <button type="button" className={smallButtonClass} onClick={() => void copyTrackingLink(run)}>
                          <ClipboardDocumentIcon width={15} />
                          {copiedRunId === run.id ? copy.copied : copy.copyTrackingLink}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {pageCount > 1 && (
          <nav aria-label={copy.pagination} className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              className={smallButtonClass}
              disabled={page <= 1 || loading}
              aria-label={copy.previousPage}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeftIcon width={14} />
            </button>
            {pageNumbers.map((number) => (
              <button
                key={number}
                type="button"
                aria-current={number === page ? "page" : undefined}
                disabled={loading}
                onClick={() => goToPage(number)}
                className={`${smallButtonClass} min-w-8 justify-center ${number === page ? "!bg-[#050505] !text-white" : ""}`}
              >
                {number}
              </button>
            ))}
            <button
              type="button"
              className={smallButtonClass}
              disabled={page >= pageCount || loading}
              aria-label={copy.nextPage}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRightIcon width={14} />
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
