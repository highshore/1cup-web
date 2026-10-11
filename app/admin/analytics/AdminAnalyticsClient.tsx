"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CreditCardIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import type { ChartOptions } from "chart.js";
import { Bar, Line } from "react-chartjs-2";

import { useI18n } from "../../lib/i18n/I18nProvider";
import type { AdminAnalyticsData, AnalyticsRange, AnalyticsComparison } from "../../lib/features/admin-analytics/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

type Tab = "overview" | "revenue" | "customers" | "operations";

const rangeOptions: AnalyticsRange[] = ["day", "week", "month", "year", "custom"];
const KST = 9 * 3600000;
function kstToday() { return new Date(Date.now() + KST).toISOString().slice(0, 10); }
function formatDate(d: Date) { return d.toISOString().slice(0, 10); }
function dateWindow(mode: AnalyticsRange, anchor: string) {
  const d = new Date(anchor + "T00:00:00Z");
  if (mode === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (mode === "month") d.setUTCDate(1);
  if (mode === "year") { d.setUTCMonth(0); d.setUTCDate(1); }
  const start = formatDate(d);
  if (mode === "week") d.setUTCDate(d.getUTCDate() + 6);
  if (mode === "month") { d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); }
  if (mode === "year") { d.setUTCFullYear(d.getUTCFullYear() + 1); d.setUTCDate(0); }
  return { from: start, to: formatDate(d) };
}
function shiftAnchor(anchor: string, mode: AnalyticsRange, amount: number) {
  const d = new Date(anchor + "T00:00:00Z");
  if (mode === "day") d.setUTCDate(d.getUTCDate() + amount);
  if (mode === "week") d.setUTCDate(d.getUTCDate() + amount * 7);
  if (mode === "month") d.setUTCMonth(d.getUTCMonth() + amount);
  if (mode === "year") d.setUTCFullYear(d.getUTCFullYear() + amount);
  return formatDate(d);
}
const tabs: Tab[] = ["overview", "revenue", "customers", "operations"];
const panelClass = "min-w-0 rounded-2xl border border-[#e9e8e5] bg-white p-4 shadow-[0_3px_18px_rgba(0,0,0,0.035)] sm:p-6";
const eyebrowClass = "text-[10px] font-black uppercase tracking-[0.15em] text-[#f47a4a]";
const numberClass = "mt-3 text-[26px] font-black tracking-[-0.045em] text-[#171717] sm:text-[30px]";
const mutedClass = "text-[12px] font-medium leading-relaxed text-[#737373]";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e5e5e5] bg-white px-3 text-[12px] font-bold text-[#343434] transition hover:border-[#f47a4a] hover:bg-[#fff9f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f47a4a]";

function MetricCard({ label, value, note, icon }: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={panelClass + " flex flex-col justify-between"}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-extrabold text-[#4a4a4a]">{label}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff2e9] text-[#e77143]">{icon}</span>
      </div>
      <div className={numberClass}>{value}</div>
      <div className="mt-1 text-[11px] leading-5 text-[#8a8a8a]">{note}</div>
    </div>
  );
}

function Breakdown({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-b border-[#f0f0f0] py-3 last:border-b-0">
      <span className="text-[12px] font-semibold text-[#6e6e6e]">{label}</span>
      <span className={"text-right text-[14px] font-black tabular-nums " + (accent ? "text-[#e77143]" : "text-[#222]")}>{value}</span>
    </div>
  );
}

export default function AdminAnalyticsClient() {
  const { t, locale } = useI18n();
  const copy = t.admin.analytics;
  const [range, setRange] = useState<AnalyticsRange>("month");
  const [anchor, setAnchor] = useState(kstToday);
  const [customFrom, setCustomFrom] = useState(kstToday);
  const [customTo, setCustomTo] = useState(kstToday);
  const [comparison, setComparison] = useState<AnalyticsComparison>("previous");
  const selectedWindow = range === "custom" ? { from: customFrom, to: customTo } : dateWindow(range, anchor);
  const invalidWindow = selectedWindow.from > selectedWindow.to || selectedWindow.from > kstToday();
  const changeRange = (next: AnalyticsRange) => {
    if (next === "custom" && range !== "custom") { setCustomFrom(selectedWindow.from); setCustomTo(selectedWindow.to); }
    setRange(next);
  };
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshToken, setRefreshToken] = useState(0);
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    if (invalidWindow) { setLoading(false); setError(true); return () => abortController.abort(); }
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({ range, from: selectedWindow.from, to: selectedWindow.to, compare: comparison });
    if (refreshToken > 0) query.set("refresh", "1");
    fetch("/api/admin/analytics?" + query.toString(), {
      cache: "no-store",
      signal: abortController.signal,
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Analytics request failed: " + response.status);
        return response.json() as Promise<AdminAnalyticsData>;
      })
      .then((response) => {
        if (!abortController.signal.aborted) setData(response);
      })
      .catch((fetchError) => {
        if (!abortController.signal.aborted) {
          console.error("Could not load business analytics", fetchError);
          setData(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false);
      });

    return () => abortController.abort();
  }, [range, selectedWindow.from, selectedWindow.to, comparison, invalidWindow, refreshToken]);

  const currency = useCallback((amount: number) =>
    new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(amount), [locale]);
  const count = useCallback((amount: number) =>
    new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US").format(amount), [locale]);
  const percent = (amount: number | null) => amount == null ? "—" : amount.toFixed(1) + "%";
  const monthLabel = useCallback((month: string) => {
    const [year, number] = month.split("-").map(Number);
    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      month: "short", year: "2-digit", timeZone: "UTC",
    }).format(new Date(Date.UTC(year, number - 1, 1)));
  }, [locale]);

  const revenueChart = useMemo(() => ({
    labels: (data?.months ?? []).map((month) => monthLabel(month.month)),
    datasets: [
      {
        label: copy.membership,
        data: (data?.months ?? []).map((month) => month.membershipRevenue),
        backgroundColor: "#f47a4a",
        borderRadius: 5,
        maxBarThickness: 26,
        stack: "gross",
      },
      {
        label: copy.passes,
        data: (data?.months ?? []).map((month) => month.passRevenue),
        backgroundColor: "#2c333a",
        borderRadius: 5,
        maxBarThickness: 26,
        stack: "gross",
      },
    ],
  }), [data, monthLabel, copy.membership, copy.passes]);

  const payerChart = useMemo(() => ({
    labels: (data?.months ?? []).map((month) => monthLabel(month.month)),
    datasets: [
      {
        label: copy.newPayers,
        data: (data?.months ?? []).map((month) => month.newPayers),
        borderColor: "#f47a4a",
        backgroundColor: "#f47a4a",
        pointRadius: 3,
        tension: 0.35,
      },
      {
        label: copy.returningPayers,
        data: (data?.months ?? []).map((month) => month.returningPayers),
        borderColor: "#424a54",
        backgroundColor: "#424a54",
        pointRadius: 3,
        tension: 0.35,
      },
    ],
  }), [data, monthLabel, copy.newPayers, copy.returningPayers]);

  const operationsChart = useMemo(() => ({
    labels: (data?.months ?? []).map((month) => monthLabel(month.month)),
    datasets: [
      {
        label: copy.reservations,
        data: (data?.months ?? []).map((month) => month.reservations),
        yAxisID: "y",
        borderColor: "#f47a4a",
        backgroundColor: "#f47a4a",
        pointRadius: 3,
        tension: 0.35,
      },
      {
        label: copy.meetupCount,
        data: (data?.months ?? []).map((month) => month.meetups),
        yAxisID: "y1",
        borderColor: "#333b45",
        backgroundColor: "#333b45",
        pointRadius: 3,
        tension: 0.35,
      },
    ],
  }), [data, monthLabel, copy.reservations, copy.meetupCount]);

  const barOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 18 } },
      tooltip: { callbacks: { label: (context) => " " + context.dataset.label + ": " + currency(context.parsed.y ?? 0) } },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { stacked: true, beginAtZero: true, border: { display: false }, grid: { color: "#f3f3f3" }, ticks: { callback: (value) => count(Number(value)) } },
    },
  };
  const lineOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 18 } } },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, maxTicksLimit: 8 } },
      y: { beginAtZero: true, border: { display: false }, ticks: { precision: 0 }, grid: { color: "#f3f3f3" } },
    },
  };
  const operationsOptions: ChartOptions<"line"> = {
    ...lineOptions,
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, maxTicksLimit: 8 } },
      y: { type: "linear", position: "left", beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f3f3f3" } },
      y1: { type: "linear", position: "right", beginAtZero: true, ticks: { precision: 0 }, grid: { drawOnChartArea: false } },
    },
  };

  const exportCsv = () => {
    if (!data) return;
    const rows: Array<Array<string | number>> = [
      ["month", "membership_krw", "ticket_pack_krw", "refund_krw", "net_krw", "new_payers", "returning_payers", "meetups", "reservations", "seat_capacity"],
      ...data.months.map((month) => [
        month.month, month.membershipRevenue, month.passRevenue, month.refunds,
        month.netRevenue, month.newPayers, month.returningPayers, month.meetups,
        month.reservations, month.capacity,
      ]),
    ];
    const content = "\uFEFF" + rows.map((row) => row.join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = copy.exportFilename + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const refresh = () => setRefreshToken((token) => token + 1);

  const metricList = data ? [
    { label: copy.metrics.netRevenue, value: currency(data.summary.netRevenue), note: copy.metrics.netRevenueHelp, icon: <BanknotesIcon className="h-5 w-5" /> },
    { label: copy.metrics.growth, value: percent(data.summary.growthPercent), note: copy.metrics.growthHelp, icon: <ArrowTrendingUpIcon className="h-5 w-5" /> },
    { label: copy.metrics.payingMembers, value: count(data.summary.payingMembers), note: copy.metrics.payingMembersHelp, icon: <CreditCardIcon className="h-5 w-5" /> },
    { label: copy.metrics.repeatPayerPercent, value: percent(data.summary.repeatPayerPercent), note: copy.metrics.repeatPayerHelp, icon: <ArrowPathIcon className="h-5 w-5" /> },
    { label: copy.metrics.activeBookers, value: count(data.summary.activeBookers30d), note: copy.metrics.activeBookersHelp, icon: <UsersIcon className="h-5 w-5" /> },
    { label: copy.metrics.activeSubscriptions, value: count(data.summary.activeSubscriptions), note: copy.metrics.activeSubscriptionsHelp, icon: <CalendarDaysIcon className="h-5 w-5" /> },
  ] : [];

  const chartCard = (title: string, description: string, children: React.ReactNode) => (
    <section className={panelClass}>
      <h2 className="m-0 text-[15px] font-extrabold tracking-tight text-[#202020]">{title}</h2>
      <p className={"m-0 mt-1 " + mutedClass}>{description}</p>
      <div className="mt-5 h-[260px] sm:h-[310px]">{children}</div>
    </section>
  );

  const revenueDetails = data && (
    <section className={panelClass}>
      <h2 className="m-0 text-[15px] font-extrabold text-[#202020]">{copy.revenueTable}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[590px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#eaeaea] text-[11px] font-bold text-[#777]">
              <th className="py-3 pr-3">{copy.cohortMonth}</th>
              <th className="px-3 py-3 text-right">{copy.membership}</th>
              <th className="px-3 py-3 text-right">{copy.passes}</th>
              <th className="px-3 py-3 text-right">{copy.refunds}</th>
              <th className="py-3 pl-3 text-right">{copy.net}</th>
            </tr>
          </thead>
          <tbody>
            {[...data.months].reverse().map((month) => (
              <tr key={month.month} className="border-b border-[#f2f2f2] last:border-b-0">
                <th className="py-3 pr-3 font-bold text-[#343434]">{monthLabel(month.month)}</th>
                <td className="px-3 py-3 text-right tabular-nums">{currency(month.membershipRevenue)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(month.passRevenue)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(month.refunds)}</td>
                <td className="py-3 pl-3 text-right font-black tabular-nums text-[#171717]">{currency(month.netRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <main className="mx-auto w-full max-w-[1380px] px-3 pb-16 pt-4 sm:px-6 sm:pt-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#777] transition hover:text-[#f47a4a]">
        <ArrowLeftIcon className="h-3.5 w-3.5" />{copy.back}
      </Link>
      <header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <span className={eyebrowClass}>ONE CUP ENGLISH / ANALYTICS</span>
          <h1 className="m-0 mt-2 text-[27px] font-black tracking-[-0.04em] text-[#171717] sm:text-[36px]">{copy.title}</h1>
          <p className={"m-0 mt-2 " + mutedClass}>{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-full space-y-2 sm:w-auto">
            <div className="flex flex-wrap gap-1 rounded-xl bg-[#f5f5f5] p-1">
              {rangeOptions.map((option) => (
                <button key={option} type="button" onClick={() => changeRange(option)}
                  className={"rounded-lg px-3 py-2 text-[12px] font-bold " + (range === option ? "bg-white text-[#171717] shadow-sm" : "text-[#777]")}>
                  {copy.periodModes[option]}
                </button>
              ))}
            </div>
            {range === "custom" ? (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <input type="date" aria-label={copy.startDate} value={customFrom} max={kstToday()} onChange={(e) => setCustomFrom(e.target.value)} className={buttonClass}/>
                <span>–</span>
                <input type="date" aria-label={copy.endDate} value={customTo} min={customFrom} max={kstToday()} onChange={(e) => setCustomTo(e.target.value)} className={buttonClass}/>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#e9e9e9] bg-white px-2">
                <button type="button" aria-label={copy.previous} onClick={() => setAnchor((v) => shiftAnchor(v, range, -1))} className="p-2"><ChevronLeftIcon className="h-4 w-4"/></button>
                <span className="text-[12px] font-bold">{selectedWindow.from} ~ {selectedWindow.to}</span>
                <button type="button" aria-label={copy.next} disabled={selectedWindow.to >= kstToday()} onClick={() => setAnchor((v) => shiftAnchor(v, range, 1))} className="p-2 disabled:opacity-25"><ChevronRightIcon className="h-4 w-4"/></button>
              </div>
            )}
            <label className="flex items-center justify-between gap-2 text-[12px] font-semibold text-[#777]">
              {copy.compareLabel}
              <select value={comparison} onChange={(e) => setComparison(e.target.value as AnalyticsComparison)} className={buttonClass}>
                <option value="previous">{copy.comparePrevious}</option>
                <option value="yearAgo">{copy.compareYearAgo}</option>
                <option value="none">{copy.compareNone}</option>
              </select>
            </label>
          </div>
          {data?.freshness && !loading && (
            <span className="self-center text-[11px] font-semibold text-[#888]">
              {locale === "ko" ? "조회 시각" : "Retrieved"}: {new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(data.freshness.fetchedAt))} KST
            </span>
          )}
          <button type="button" onClick={refresh} disabled={loading} className={buttonClass} aria-label={copy.refresh}>
            <ArrowPathIcon className={"h-4 w-4 " + (loading ? "animate-spin" : "")}/>{copy.refresh}
          </button>
          <button type="button" onClick={exportCsv} disabled={!data || loading} className={buttonClass}>
            <ArrowDownTrayIcon className="h-4 w-4" />{copy.export}
          </button>
        </div>
      </header>

      <div className="mt-7 flex flex-wrap gap-1 rounded-xl border border-[#ececec] bg-[#f8f7f5] p-1" role="tablist" aria-label={copy.title}>
        {tabs.map((nextTab) => (
          <button
            key={nextTab}
            type="button"
            role="tab"
            aria-selected={tab === nextTab}
            onClick={() => setTab(nextTab)}
            className={"flex-1 rounded-lg px-4 py-2.5 text-[12px] font-extrabold transition sm:flex-none " +
              (tab === nextTab ? "bg-white text-[#161616] shadow-[0_1px_6px_rgba(0,0,0,.09)]" : "text-[#888] hover:text-[#333]")}
          >
            {copy.tabs[nextTab]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-[#f1f0ed]" />)}
          <p className="col-span-full mt-3 text-center text-[12px] font-semibold text-[#888]" role="status">{copy.loading}</p>
        </div>
      ) : error || !data ? (
        <div className={panelClass + " mt-5 flex flex-col items-center gap-4 py-16 text-center"} role="alert">
          <p className="m-0 text-[14px] font-bold text-[#555]">{copy.error}</p>
          <button type="button" className={buttonClass} onClick={refresh}>{copy.retry}</button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {tab === "overview" && (
            <>
              <div>
                <h2 className="m-0 text-[17px] font-black text-[#202020]">{copy.overviewTitle}</h2>
                <p className={"mt-1 " + mutedClass}>{copy.overviewSubtitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {metricList.map((metric) => <MetricCard key={metric.label} {...metric}/>)}
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {chartCard(copy.revenueTrend, copy.monthsNote, <Bar data={revenueChart} options={barOptions}/>)}
                {chartCard(copy.payerTrend, copy.monthsNote, <Line data={payerChart} options={lineOptions}/>)}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <section className={panelClass}>
                  <span className={eyebrowClass}>{copy.revenueTitle}</span>
                  <Breakdown label={copy.gross} value={currency(data.summary.grossRevenue)}/>
                  <Breakdown label={copy.refunds} value={currency(data.summary.refunds)}/>
                  <Breakdown label={copy.avgPaying} value={currency(data.summary.averageRevenuePerPayer)} accent/>
                </section>
                <section className={panelClass}>
                  <span className={eyebrowClass}>{copy.memberStatuses}</span>
                  <Breakdown label={copy.renewing} value={count(data.summary.renewingSubscriptions)}/>
                  <Breakdown label={copy.stoppedActive} value={count(data.summary.stoppedActiveSubscriptions)}/>
                  <Breakdown label={copy.stoppedEnded} value={count(data.summary.stoppedEndedSubscriptions)}/>
                </section>
              </div>
            </>
          )}

          {tab === "revenue" && (
            <>
              <div><h2 className="m-0 text-[17px] font-black">{copy.revenueTitle}</h2><p className={mutedClass}>{copy.revenueSubtitle}</p></div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard label={copy.gross} value={currency(data.summary.grossRevenue)} note={copy.metrics.netRevenueHelp} icon={<BanknotesIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.refunds} value={currency(data.summary.refunds)} note={count(data.summary.refundCount)} icon={<ArrowPathIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.membership} value={currency(data.summary.membershipRevenue)} note={copy.recurring + ": " + count(data.summary.recurringPayments)} icon={<CreditCardIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.passes} value={currency(data.summary.passRevenue)} note={copy.avgPaying + ": " + currency(data.summary.averageRevenuePerPayer)} icon={<BanknotesIcon className="h-5 w-5"/>}/>
              </div>
              {chartCard(copy.revenueTrend, copy.monthsNote, <Bar data={revenueChart} options={barOptions}/>)}
              {revenueDetails}
              <p className={"m-0 " + mutedClass}>{copy.accountingNote}</p>
            </>
          )}

          {tab === "customers" && (
            <>
              <div><h2 className="m-0 text-[17px] font-black">{copy.customerTitle}</h2><p className={mutedClass}>{copy.customerSubtitle}</p></div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard label={copy.metrics.payingMembers} value={count(data.summary.payingMembers)} note={copy.metrics.payingMembersHelp} icon={<CreditCardIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.newPayers} value={count(data.summary.newPayers)} note={copy.metrics.repeatPayerHelp} icon={<UsersIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.returningPayers} value={count(data.summary.returningPayers)} note={copy.metrics.repeatPayerHelp} icon={<ArrowPathIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.packRepurchase} value={percent(data.summary.packRepurchasePercent)} note={data.summary.packRepurchasePercent == null ? copy.noPackData : copy.passes} icon={<ChartBarIcon className="h-5 w-5"/>}/>
              </div>
              {chartCard(copy.payerTrend, copy.monthsNote, <Line data={payerChart} options={lineOptions}/>)}
              <section className={panelClass}>
                <h3 className="m-0 text-[16px] font-black">{copy.cohortTitle}</h3>
                <p className={"m-0 mt-1 " + mutedClass}>{copy.cohortHelp}</p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] border-separate border-spacing-[4px] text-[12px]">
                    <thead>
                      <tr className="text-[#777]">
                        <th className="px-2 py-2 text-left">{copy.cohortMonth}</th>
                        <th className="px-2 py-2 text-center">{copy.cohortSize}</th>
                        {Array.from({ length: 6 }, (_, i) => <th key={i} className="px-2 py-2 text-center">{i + 1} {copy.monthUnit}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.cohorts.map((cohort) => (
                        <tr key={cohort.cohort}>
                          <th className="px-2 py-2 text-left font-extrabold">{monthLabel(cohort.cohort)}</th>
                          <td className="px-2 py-2 text-center font-bold">{count(cohort.size)}</td>
                          {cohort.retention.map((value, index) => (
                            <td
                              key={index}
                              className="rounded-md px-2 py-3 text-center font-extrabold tabular-nums text-[#2f2926]"
                              style={{ backgroundColor: value === null ? "#f6f6f6" : "rgba(244,122,74," + (0.08 + value / 180) + ")" }}
                            >
                              {percent(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={mutedClass}>{copy.retentionNote}</p>
                <Link href="/admin/members" className={buttonClass}>{copy.membersLink}</Link>
              </div>
            </>
          )}

          {tab === "operations" && (
            <>
              <div><h2 className="m-0 text-[17px] font-black">{copy.operationsTitle}</h2><p className={mutedClass}>{copy.operationsSubtitle}</p></div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <MetricCard label={copy.meetupCount} value={count(data.operations.meetupCount)} note={copy.operationsSubtitle} icon={<CalendarDaysIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.reservations} value={count(data.operations.reservations)} note={copy.operationsSubtitle} icon={<UsersIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.uniqueBookers} value={count(data.operations.uniqueBookers)} note={copy.operationsSubtitle} icon={<UsersIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.occupancy} value={percent(data.operations.occupancyPercent)} note={copy.capacity + ": " + count(data.operations.capacity)} icon={<ChartBarIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.cancellations} value={count(data.operations.cancelledRegistrations)} note={copy.cancellationRate + ": " + percent(data.operations.cancellationPercent)} icon={<ArrowPathIcon className="h-5 w-5"/>}/>
                <MetricCard label={copy.metrics.activeBookers} value={count(data.summary.activeBookers30d)} note={copy.metrics.activeBookersHelp} icon={<UsersIcon className="h-5 w-5"/>}/>
              </div>
              {chartCard(copy.meetupsTrend, copy.monthsNote, <Line data={operationsChart} options={operationsOptions}/>)}
              <p className={mutedClass}>{copy.bookingsNote}</p>
            </>
          )}
          <div className="border-t border-[#ececec] pt-3">
            <p className="text-[11px] leading-relaxed text-[#999]">{copy.allTimesKst} {copy.monthsNote} {data.range.partial ? copy.partialNote : ""}</p>
          </div>
        </div>
      )}
    </main>
  );
}
