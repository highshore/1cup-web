"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PauseCircleIcon, ReceiptRefundIcon } from "@heroicons/react/24/outline";
import { DailyApiError, dailyApi } from "../../lib/features/daily/api";
import { cn, displayClass, Emoji, Pill } from "../../lib/features/daily/components/DailyUI";
import DailyLoading from "../../lib/features/daily/components/DailyLoading";
import KakaoSignIn from "../../lib/features/daily/components/KakaoSignIn";
import {
  DAILY_GUIDE_PATH,
  DAILY_JOB_CATEGORIES,
  DAILY_MONTHLY_PRICE_KRW,
  DAILY_TERMS_PATH,
  DAILY_TRACK_LABEL,
  DAILY_TRIAL_PATH,
  formatKrw,
  type DailyTrack,
} from "../../lib/features/daily/constants";
import { dailyCopy } from "../../lib/features/daily/copy";
import { dailyDisplay } from "../../lib/features/daily/fonts";
import "../../lib/features/daily/daily.css";

type SubscriptionStatus = "trial" | "trial_ended" | "active" | "cancelled";
type RefundStatus = "requested" | "refunding" | "refunded" | "rejected" | "failed";

interface Subscription {
  track: DailyTrack;
  status: SubscriptionStatus;
  plan: string | null;
  paidUntil: string | null;
  autoRenew: boolean;
  deliveryTime: string;
  nextSendAt: string | null;
  canResume: boolean;
  canSwitch: boolean;
}

interface Payment {
  orderNumber: string;
  kind: "checkout" | "renewal";
  productName: string;
  recurring: boolean;
  amount: number;
  track: DailyTrack;
  paidAt: string;
  refund: { status: RefundStatus; amount: number; refundedAt: string | null; note: string | null } | null;
  // basis: why the refund is priced as it is (daily_refund_quote, terms 제7조).
  quote: {
    amount: number;
    daysRefunded: number;
    fullRefund: boolean;
    basis: "window" | "not_started" | "cooling_off" | "penalty" | "prorated";
    // The 위약금 kept, and messages sent/scheduled for a pass (days for a subscription).
    penalty: number;
    used: number;
    total: number;
  } | null;
}

// Explains how daily_refund_quote priced the refund (terms 제7조).
function refundBasisText(payment: Payment) {
  const r = dailyCopy.account.refund;
  const q = payment.quote!;
  const fill = (text: string) =>
    text
      .replace("{days}", String(q.daysRefunded))
      .replace("{used}", String(q.used))
      .replace("{left}", String(Math.max(q.total - q.used, 0)))
      .replace("{penalty}", formatKrw(q.penalty));
  switch (q.basis) {
    case "window":
      // Passes reach this only when sold under terms before 2026-10-28.1.
      return payment.recurring ? r.full : r.legacyWindow;
    case "not_started":
      return r.notStarted;
    case "cooling_off":
      return fill(r.passCoolingOff);
    case "penalty":
      return fill(payment.recurring ? r.subscriptionPenalty : r.passPenalty);
    default:
      return fill(r.partial);
  }
}

interface AccountInfo {
  phone: string;
  verified: boolean;
  name: string | null;
  workplace: string | null;
  jobCategory: string | null;
  marketing: boolean;
  subscriptions: Subscription[];
  payments: Payment[];
}

const copy = dailyCopy.account;
const TRACK_TITLE = DAILY_TRACK_LABEL;

// 06:00–22:00 on the hour: the range daily_subscriptions.delivery_time allows.
const TIMES = Array.from({ length: 17 }, (_, i) => `${String(6 + i).padStart(2, "0")}:00`);

function timeLabel(value: string) {
  const [h, m] = value.split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
}

function fullDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
}

function errorMessage(e: unknown) {
  if (e instanceof DailyApiError) {
    if (e.code === "verify-required") return copy.errors["verify-required"];
    if (e.message) return e.message;
  }
  return copy.errors.generic;
}

const cardFrame = "rounded-[24px] p-5 min-[900px]:p-6";
const card = `${cardFrame} bg-white`;
const sectionTitle = "text-center text-[1.15rem] font-black min-[900px]:text-left";
const smallButton =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-xl px-4 text-[0.88rem] font-black transition-opacity disabled:opacity-35";

// Only the latest subscription per track: an old cancelled one next to a live one is noise.
// The live subscription for each level, else the latest. A level switch can leave an
// older live row behind a newer ended one on the same level.
function latestPerTrack(subscriptions: Subscription[]) {
  const isLive = (s: Subscription) => s.status === "trial" || s.status === "active";
  const ordered = [...subscriptions.filter(isLive), ...subscriptions.filter((s) => !isLive(s))];
  const seen = new Set<string>();
  return ordered.filter((s) => (seen.has(s.track) ? false : (seen.add(s.track), true)));
}

// 내 구독 shows one card: the level can be switched on the card itself, so an ended row
// for the other level is noise. The live subscription(s), else the latest one.
function shownSubscriptions(subscriptions: Subscription[]) {
  const latest = latestPerTrack(subscriptions);
  const live = latest.filter((s) => s.status === "trial" || s.status === "active");
  return live.length > 0 ? live : latest.slice(0, 1);
}

// 내 정보: the phone number and name come from Kakao Login and are shown as they are; 소속
// and 직종 are the reader's to fill in (the review page asks for them too).
function Profile({ info, onChanged }: { info: AccountInfo; onChanged: () => Promise<void> }) {
  const pr = copy.profile;
  const [workplace, setWorkplace] = useState(info.workplace ?? "");
  const [jobCategory, setJobCategory] = useState(info.jobCategory ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await dailyApi("account-update", patch);
      setMessage(copy.profile.saved);
      await onChanged();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await dailyApi("logout").catch(() => undefined);
    router.push("/daily");
  };

  return (
    <section className={card}>
      <h2 className={sectionTitle}>{copy.profile.title}</h2>
      <dl className="m-0 mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[0.9rem] font-bold text-[#64748b]">{pr.phone}</dt>
          <dd className="m-0 text-[1rem] font-black">{info.phone}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[0.9rem] font-bold text-[#64748b]">{pr.name}</dt>
          <dd className={cn("m-0 text-[1rem] font-black", !info.name && "text-[#94a3b8]")}>{info.name ?? pr.noName}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[0.8rem] font-semibold leading-relaxed text-[#94a3b8]">{pr.fixed}</p>

      <div className="mt-4 flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <span className="w-[3.5rem] shrink-0 text-[0.9rem] font-bold text-[#64748b]">{pr.workplace}</span>
          <input
            value={workplace}
            disabled={!info.verified || busy}
            onChange={(event) => setWorkplace(event.target.value.slice(0, 60))}
            placeholder={pr.workplacePlaceholder}
            className="h-12 min-w-0 flex-1 rounded-xl bg-[#f5f5f4] px-3 text-[0.98rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505] disabled:opacity-60"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-[3.5rem] shrink-0 text-[0.9rem] font-bold text-[#64748b]">{pr.jobCategory}</span>
          <select
            value={jobCategory}
            disabled={!info.verified || busy}
            onChange={(event) => setJobCategory(event.target.value)}
            className={cn(
              "h-12 min-w-0 flex-1 cursor-pointer rounded-xl bg-[#f5f5f4] px-3 text-[0.98rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505] disabled:opacity-60",
              jobCategory === "" && "text-[#94a3b8]",
            )}
          >
            <option value="">{pr.jobPick}</option>
            {DAILY_JOB_CATEGORIES.map((item) => (
              <option key={item} value={item} className="text-[#050505]">
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!info.verified || busy || (workplace.trim() === (info.workplace ?? "") && jobCategory === (info.jobCategory ?? ""))}
          onClick={() => save({ workplace, jobCategory })}
          className={cn(smallButton, "h-12 w-full bg-[#050505] text-white")}
        >
          {pr.save}
        </button>
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-3 text-[0.95rem] font-bold">
        <input
          type="checkbox"
          checked={info.marketing}
          disabled={!info.verified || busy}
          onChange={(event) => save({ marketing: event.target.checked })}
          className="size-5 accent-[#f47a4a]"
        />
        {copy.profile.marketing}
      </label>
      {message && (
        <p role="status" className="mt-3 text-[0.86rem] font-semibold text-[#475569]">
          {message}
        </p>
      )}
      <button type="button" onClick={logout} className="mt-5 text-[0.85rem] font-bold text-[#64748b] underline underline-offset-2">
        {copy.profile.logout}
      </button>
    </section>
  );
}

function SubscriptionCard({
  sub,
  verified,
  notice,
  onNotice,
  onChanged,
}: {
  sub: Subscription;
  verified: boolean;
  // A save re-keys the card, so its confirmation is kept by the page.
  notice: string;
  onNotice: (track: DailyTrack, text: string) => void;
  onChanged: () => Promise<void>;
}) {
  const s = copy.subscriptions;
  const [time, setTime] = useState(sub.deliveryTime);
  const [message, setMessage] = useState(notice);
  const [busy, setBusy] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const live = sub.status === "trial" || sub.status === "active";
  const otherTrack: DailyTrack = sub.track === "basic" ? "advanced" : "basic";
  const otherLabel = TRACK_TITLE[otherTrack];

  const run = async (action: string, body: Record<string, unknown>, done?: string, doneTrack: DailyTrack = sub.track) => {
    setBusy(true);
    setMessage("");
    try {
      await dailyApi(action, body);
      if (done) {
        setMessage(done);
        onNotice(doneTrack, done);
      }
      await onChanged();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={card}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[1.1rem] font-black">{TRACK_TITLE[sub.track]}</p>
        <Pill className={cn("px-2.5 py-1 text-[0.75rem]", live ? "bg-[#f47a4a] text-[#050505]" : "bg-[#f1f5f9] text-[#475569]")}>
          {s.status[sub.status]}
        </Pill>
      </div>

      {sub.status === "active" && sub.paidUntil && (
        <p className="mt-2 text-[0.92rem] font-semibold text-[#475569]">
          {sub.autoRenew
            ? s.nextCharge.replace("{date}", dateLabel(sub.paidUntil)).replace("{price}", formatKrw(DAILY_MONTHLY_PRICE_KRW))
            : `${s.paidUntil.replace("{date}", dateLabel(sub.paidUntil))} · ${s.autoRenewOff}`}
        </p>
      )}
      {sub.status === "trial" && sub.nextSendAt && (
        <p className="mt-2 text-[0.92rem] font-semibold text-[#475569]">{s.trialNext.replace("{date}", dateLabel(sub.nextSendAt))}</p>
      )}

      {live && (
        <label className="mt-4 flex items-center gap-2">
          <span className="w-[4.5rem] shrink-0 text-[0.9rem] font-bold text-[#64748b]">{s.time}</span>
          <select
            value={time}
            disabled={!verified || busy}
            onChange={(event) => setTime(event.target.value)}
            className="h-12 min-w-0 flex-1 cursor-pointer rounded-xl bg-[#f5f5f4] px-3 text-[0.98rem] font-black outline-none focus-visible:ring-2 focus-visible:ring-[#050505] disabled:opacity-60"
          >
            {TIMES.map((value) => (
              <option key={value} value={value}>
                {timeLabel(value)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!verified || busy || time === sub.deliveryTime}
            onClick={() => run("account-update", { track: sub.track, time }, s.timeSaved)}
            className={cn(smallButton, "bg-[#050505] text-white")}
          >
            {copy.profile.save}
          </button>
        </label>
      )}

      {sub.canSwitch && (
        <div className="mt-3 flex items-center gap-2">
          <span className="w-[4.5rem] shrink-0 text-[0.9rem] font-bold text-[#64748b]">{s.level}</span>
          <span className="min-w-0 flex-1 text-[0.98rem] font-black">{TRACK_TITLE[sub.track]}</span>
          <button
            type="button"
            disabled={!verified || busy || confirmSwitch}
            onClick={() => setConfirmSwitch(true)}
            className={cn(smallButton, "bg-[#f5f5f4] text-[#050505]")}
          >
            {s.switchTo.replace("{level}", otherLabel)}
          </button>
        </div>
      )}
      {confirmSwitch && (
        <div className="mt-3 rounded-2xl bg-[#fff8dc] p-4">
          <p className="text-[0.9rem] font-semibold text-[#475569]">{s.switchConfirm.replace("{level}", otherLabel)}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run("switch-level", { track: sub.track, to: otherTrack }, s.switchSaved.replace("{level}", otherLabel), otherTrack)
                  .then(() => setConfirmSwitch(false))
              }
              className={cn(smallButton, "bg-[#050505] text-white")}
            >
              {s.switchConfirmButton}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmSwitch(false)}
              className={cn(smallButton, "bg-white text-[#050505]")}
            >
              {s.switchCancel}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {sub.canResume && (
          <button
            type="button"
            disabled={!verified || busy}
            onClick={() => run("resume-renewal", { track: sub.track })}
            className={cn(smallButton, "bg-[#f5f5f4] text-[#050505]")}
          >
            {s.resume}
          </button>
        )}
        {/* Only when nothing is paid for: a pass or a subscription with auto-renew off is
            still paid until its end date. */}
        {sub.status !== "active" && (
          <Link href="/daily/subscribe" className={cn(smallButton, "bg-[#f47a4a] text-[#050505]")}>
            {s.subscribe}
          </Link>
        )}
      </div>
      {message && (
        <p role="status" className="mt-3 text-[0.86rem] font-semibold text-[#475569]">
          {message}
        </p>
      )}
    </li>
  );
}

type StopChoice = { kind: "cancel"; sub: Subscription } | { kind: "refund"; payment: Payment };

// 서비스 중단하기, as on 1cup's membership page: pick turning off auto-renew (recommended)
// or a refund, then say why. The reasons go with the request: a refund keeps them on the
// refund itself, a cancellation in daily_cancel_feedback.
function StopServiceSheet({
  cancellable,
  refundable,
  onClose,
  onDone,
}: {
  cancellable: Subscription[];
  refundable: Payment[];
  onClose: () => void;
  onDone: (notice: string) => Promise<void>;
}) {
  const t = copy.stop;
  const r = copy.refund;
  const [choice, setChoice] = useState<StopChoice | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !busy && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [busy, onClose]);

  const pick = (next: StopChoice | null) => {
    setChoice(next);
    setSelected([]);
    setOther("");
    setMessage("");
  };

  const reasons = choice?.kind === "refund" ? [...t.refundLeadReasons, ...t.reasons] : t.reasons;
  const ready = selected.length > 0 || other.trim() !== "";

  const submit = async () => {
    if (!choice) return;
    setBusy(true);
    setMessage("");
    try {
      if (choice.kind === "cancel") {
        await dailyApi("cancel-renewal", { track: choice.sub.track, reasons: selected, other: other.trim() });
        await onDone(
          t.cancelled
            .replace("{track}", TRACK_TITLE[choice.sub.track])
            .replace("{date}", dateLabel(choice.sub.paidUntil ?? new Date().toISOString())),
        );
      } else {
        // Stored as one line on the refund: the picked reasons, then what they wrote.
        const reason = [...selected, other.trim() && `${t.otherLabel}: ${other.trim()}`].filter(Boolean).join(" / ").slice(0, 500);
        const { refund } = await dailyApi<{ refund: { amount: number; status: "refunded" | "failed" | "unknown" } }>("refund-request", {
          orderNumber: choice.payment.orderNumber,
          reason,
        });
        await onDone(refund.status === "refunded" ? r.done.replace("{amount}", formatKrw(refund.amount)) : r.pending);
      }
    } catch (e) {
      setMessage(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 min-[600px]:items-center min-[600px]:p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-stop-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-[460px] overflow-y-auto rounded-t-[28px] bg-white p-6 text-[#050505] [word-break:keep-all] min-[600px]:rounded-[28px]"
      >
        {!choice ? (
          <>
            <h2 id="daily-stop-title" className="text-[1.3rem] font-black">
              {t.title}
            </h2>
            <p className="mt-1 text-[0.92rem] font-semibold text-[#64748b]">{t.detail}</p>
            <div className="mt-5 flex flex-col gap-2">
              {cancellable.map((sub) => (
                <button
                  key={sub.track}
                  type="button"
                  onClick={() => pick({ kind: "cancel", sub })}
                  className="flex w-full items-start gap-3 rounded-2xl bg-[#fff0e8] p-4 text-left ring-2 ring-[#f47a4a] transition-colors hover:bg-[#ffe6d9]"
                >
                  <PauseCircleIcon className="mt-0.5 size-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-[1rem] font-black">
                      {t.cancelTitle.replace("{track}", TRACK_TITLE[sub.track])}
                      <span className="rounded-full bg-[#f47a4a] px-2 py-0.5 text-[0.72rem] font-black">{t.recommended}</span>
                    </span>
                    <span className="mt-1 block text-[0.86rem] font-semibold leading-relaxed text-[#64748b]">
                      {t.cancelDetail.replace("{date}", dateLabel(sub.paidUntil ?? new Date().toISOString()))}
                    </span>
                  </span>
                </button>
              ))}
              {refundable.map((payment) => (
                <button
                  key={payment.orderNumber}
                  type="button"
                  onClick={() => pick({ kind: "refund", payment })}
                  className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left text-[#475569] transition-colors hover:bg-[#f5f5f4]"
                >
                  <ReceiptRefundIcon className="mt-0.5 size-5 shrink-0 text-[#94a3b8]" />
                  <span className="min-w-0">
                    <span className="block text-[0.92rem] font-bold">
                      {t.refundTitle} · ₩{formatKrw(payment.quote!.amount)}
                    </span>
                    <span className="mt-0.5 block text-[0.82rem] font-semibold leading-relaxed text-[#94a3b8]">
                      {t.refundDetail
                        .replace("{product}", payment.productName.replace("영어 한잔 Daily ", ""))
                        .replace("{track}", TRACK_TITLE[payment.track])}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} className="mt-4 h-12 w-full rounded-xl text-[0.95rem] font-bold text-[#64748b]">
              {t.close}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => pick(null)}
                aria-label={t.back}
                className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-[#f5f5f5]"
              >
                <ArrowLeftIcon className="size-5" />
              </button>
              <h2 id="daily-stop-title" className="text-[1.2rem] font-black">
                {choice.kind === "cancel" ? t.cancelTitle.replace("{track}", TRACK_TITLE[choice.sub.track]) : t.refundTitle}
              </h2>
            </div>

            {choice.kind === "refund" && (
              <div className="mt-3">
                <p className="text-[0.82rem] font-extrabold text-[#78716c]">{r.amountLabel}</p>
                <p className="text-[1.5rem] font-black">₩{formatKrw(choice.payment.quote!.amount)}</p>
                <p className="mt-1 text-[0.9rem] font-semibold text-[#57534e]">
                  {refundBasisText(choice.payment)}
                </p>
                <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-5 text-[0.84rem] font-semibold leading-relaxed text-[#57534e]">
                  {(choice.payment.recurring ? [...r.effects, r.recurringEffect] : r.effects).map((effect) => (
                    <li key={effect}>{effect}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-4 text-[0.9rem] font-bold text-[#334155]">{t.surveyPrompt}</p>
            <div className="mt-3 flex flex-col gap-2">
              {reasons.map((reason) => {
                const active = selected.includes(reason);
                return (
                  <label
                    key={reason}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.92rem] font-bold transition-colors",
                      active ? "bg-[#fff0e8] ring-2 ring-[#f47a4a]" : "bg-[#f5f5f4]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      disabled={busy}
                      onChange={(event) =>
                        setSelected((current) => (event.target.checked ? [...current, reason] : current.filter((item) => item !== reason)))
                      }
                      className="size-[18px] shrink-0 accent-[#f47a4a]"
                    />
                    {reason}
                  </label>
                );
              })}
            </div>
            <textarea
              value={other}
              disabled={busy}
              onChange={(event) => setOther(event.target.value.slice(0, 480))}
              placeholder={t.anythingElse}
              aria-label={t.anythingElse}
              rows={3}
              className="mt-3 w-full resize-none rounded-xl bg-[#f5f5f4] p-3.5 text-[0.92rem] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]"
            />
            {message && (
              <p role="alert" className="mt-2 text-[0.86rem] font-semibold text-[#b91c1c]">
                {message}
              </p>
            )}
            <button
              type="button"
              disabled={busy || !ready}
              onClick={submit}
              className={cn(
                "mt-4 h-[54px] w-full rounded-2xl text-[1rem] font-black transition-opacity disabled:opacity-35",
                // A refund is offered, not pushed: its button stays plain.
                choice.kind === "refund" ? "bg-[#e7e5e4] text-[#050505]" : "bg-[#050505] text-white",
              )}
            >
              {busy
                ? t.working
                : choice.kind === "cancel"
                  ? t.confirmCancel
                  : t.confirmRefund.replace("{amount}", formatKrw(choice.payment.quote!.amount))}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => pick(null)}
              className="mt-2 h-12 w-full rounded-xl text-[0.95rem] font-bold text-[#64748b]"
            >
              {t.back}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Payments({ info, onChanged }: { info: AccountInfo; onChanged: () => Promise<void> }) {
  const p = copy.payments;
  const [stopOpen, setStopOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const cancellable = latestPerTrack(info.subscriptions).filter((s) => s.status === "active" && s.autoRenew);
  const refundable = info.payments.filter((payment) => payment.quote && (!payment.refund || payment.refund.status === "rejected"));
  const closeStop = useCallback(() => setStopOpen(false), []);

  return (
    <section className={card}>
      <h2 className={sectionTitle}>{p.title}</h2>
      {info.payments.length > 0 && (
        <p className="mt-1 text-center text-[0.82rem] font-semibold text-[#64748b] min-[900px]:text-left">{p.billingName}</p>
      )}
      {notice && (
        <p role="status" className="mt-3 rounded-2xl bg-[#fff8dc] px-4 py-3 text-[0.9rem] font-bold">
          {notice}
        </p>
      )}
      {info.payments.length === 0 ? (
        <p className="mt-3 text-center text-[0.92rem] font-semibold text-[#64748b] min-[900px]:text-left">{p.empty}</p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col p-0">
          {info.payments.map((payment) => {
            const refund = payment.refund;
            return (
              <li key={payment.orderNumber} className="border-t border-[#f1f5f9] py-4 first:border-t-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.98rem] font-black">
                      {payment.productName.replace("영어 한잔 Daily ", "")}
                      {payment.kind === "renewal" && <span className="ml-1.5 text-[0.8rem] font-bold text-[#64748b]">{p.renewal}</span>}
                    </p>
                    <p className="text-[0.84rem] font-semibold text-[#64748b]">
                      {fullDateLabel(payment.paidAt)} · {TRACK_TITLE[payment.track]}
                    </p>
                  </div>
                  <p className="shrink-0 text-[1rem] font-black">₩{formatKrw(payment.amount)}</p>
                </div>
                {refund && (
                  <p className="mt-1.5 text-[0.86rem] font-bold text-[#b45309]">
                    {p.status[refund.status].replace("{amount}", formatKrw(refund.amount))}
                    {refund.status === "rejected" && refund.note ? ` · ${refund.note}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(cancellable.length > 0 || refundable.length > 0) && (
        <button
          type="button"
          disabled={!info.verified}
          onClick={() => {
            setNotice("");
            setStopOpen(true);
          }}
          className="mt-2 h-12 w-full rounded-xl bg-[#f5f5f4] text-[0.95rem] font-black transition-opacity disabled:opacity-35"
        >
          {copy.stop.button}
        </button>
      )}
      {stopOpen && (
        <StopServiceSheet
          cancellable={cancellable}
          refundable={refundable}
          onClose={closeStop}
          onDone={async (message) => {
            setStopOpen(false);
            setNotice(message);
            await onChanged();
          }}
        />
      )}
    </section>
  );
}

interface InviteInfo {
  code: string | null;
  joined: number;
  rewardedDays: number;
  pendingDays: number;
}

// 친구 초대 (terms 제5조의2): the reader makes their code, then shares a link that fills
// it in on a friend's signup and subscribe pages. Shows what it has earned so far.
function InviteCard() {
  const i = dailyCopy.invite;
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    dailyApi<InviteInfo>("invite-info").then(setInfo).catch(() => setInfo(null));
  }, []);

  if (!info) return null;
  const create = async () => {
    setCreating(true);
    setMessage("");
    try {
      setInfo(await dailyApi<InviteInfo>("invite-create"));
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setCreating(false);
    }
  };
  const link = info.code ? `${window.location.origin}/daily?invite=${info.code}` : "";
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "영어 한잔 Daily", text: i.shareText, url: link });
        return;
      } catch {
        // Closed the share sheet: fall back to copying.
      }
    }
    await navigator.clipboard?.writeText(`${i.shareText}\n${link}`);
    setCopied(true);
  };

  return (
    <section className={card}>
      <h2 className={cn(sectionTitle, "flex items-center justify-center gap-2 min-[900px]:justify-start")}>
        <Emoji className="text-[1.4rem]">💌</Emoji>
        {i.title}
      </h2>
      <p className="mt-2 text-[0.9rem] font-semibold leading-relaxed text-[#475569]">{i.body}</p>
      {!info.code ? (
        <button
          type="button"
          disabled={creating}
          onClick={create}
          className="mt-4 h-12 w-full rounded-xl bg-[#050505] text-[0.95rem] font-black text-white disabled:opacity-60"
        >
          {creating ? i.creating : i.create}
        </button>
      ) : (
        <>
          <p className="mt-4 text-center text-[0.82rem] font-bold text-[#64748b] min-[900px]:text-left">{i.codeLabel}</p>
          <p className="text-center text-[1.9rem] font-black leading-tight tracking-[0.12em] min-[900px]:text-left">{info.code}</p>
          <div className="mt-3 flex gap-2">
            <span className="flex h-12 min-w-0 flex-1 items-center truncate rounded-xl bg-[#f5f5f4] px-3 text-[0.88rem] font-bold">{link.replace(/^https?:\/\//, "")}</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(link);
                setCopied(true);
              }}
              className={cn(smallButton, "h-12 bg-[#f5f5f4] text-[#050505]")}
            >
              {copied ? i.copied : i.copy}
            </button>
            <button type="button" onClick={share} className={cn(smallButton, "h-12 bg-[#050505] text-white")}>
              {i.share}
            </button>
          </div>
          <p className="mt-2 text-[0.84rem] font-semibold text-[#64748b]">{i.linkNote}</p>
        </>
      )}
      {message && (
        <p role="alert" className="mt-2 text-[0.86rem] font-semibold text-[#b91c1c]">
          {message}
        </p>
      )}
      {info.joined > 0 && (
        <p className="mt-3 text-[0.86rem] font-bold text-[#475569]">
          {i.joined.replace("{count}", String(info.joined))}
          {info.rewardedDays > 0 && ` · ${i.rewarded.replace("{days}", String(info.rewardedDays))}`}
          {info.pendingDays > 0 && ` · ${i.pending.replace("{days}", String(info.pendingDays))}`}
        </p>
      )}
    </section>
  );
}

function DeleteAccount({ info }: { info: AccountInfo }) {
  const d = copy.delete;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const billing = info.subscriptions.some((s) => s.status === "active" && s.autoRenew);
  const refundOpen = info.payments.some((p) => p.refund && (p.refund.status === "requested" || p.refund.status === "refunding"));
  const blocked = billing ? d.billingFirst : refundOpen ? d.refundOpen : "";
  // What deleting refunds on the spot: each payment's amount still refundable under the terms.
  const refundTotal = info.payments.reduce((sum, p) => sum + (p.quote?.amount ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !busy && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  const remove = async () => {
    setBusy(true);
    setMessage("");
    try {
      await dailyApi("account-delete", { confirmation: typed });
      router.push("/daily");
    } catch (e) {
      setMessage(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={!info.verified}
        onClick={() => {
          setTyped("");
          setMessage("");
          setOpen(true);
        }}
        className="mx-auto mt-2 block text-[0.85rem] font-bold text-[#b91c1c] underline underline-offset-2 disabled:text-[#94a3b8] disabled:no-underline"
      >
        {d.button}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 min-[600px]:items-center" onClick={() => !busy && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-delete-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[440px] rounded-[28px] bg-white p-6 text-[#050505]"
          >
            <h2 id="daily-delete-title" className="text-[1.25rem] font-black">
              {d.title}
            </h2>
            <p className="mt-3 text-[0.92rem] font-semibold leading-relaxed text-[#334155]">{d.body}</p>
            <p className="mt-2 text-[0.86rem] font-semibold leading-relaxed text-[#64748b]">{d.remaining}</p>
            {refundTotal > 0 && !blocked && (
              <p className="mt-2 rounded-xl bg-[#fff8dc] px-3 py-2 text-[0.9rem] font-black">
                {d.refundTotal.replace("{amount}", formatKrw(refundTotal))}
              </p>
            )}
            <p className="mt-2 text-[0.86rem] font-semibold leading-relaxed text-[#64748b]">{d.kept}</p>
            {blocked ? (
              <p role="alert" className="mt-4 rounded-2xl bg-[#fef2f2] px-4 py-3 text-[0.9rem] font-bold text-[#b91c1c]">
                {blocked}
              </p>
            ) : (
              <label className="mt-4 block">
                <span className="text-[0.86rem] font-bold">{d.prompt.replace("{phrase}", `'${d.phrase}'`)}</span>
                <input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoFocus
                  placeholder={d.phrase}
                  className="mt-1.5 h-12 w-full rounded-xl bg-[#f5f5f4] px-3 text-[1rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c]"
                />
              </label>
            )}
            {message && (
              <p role="alert" className="mt-2 text-[0.86rem] font-semibold text-[#b91c1c]">
                {message}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-12 flex-1 rounded-xl bg-[#f5f5f4] text-[0.95rem] font-black"
              >
                {d.cancel}
              </button>
              {!blocked && (
                <button
                  type="button"
                  disabled={busy || typed.trim() !== d.phrase}
                  onClick={remove}
                  className="h-12 flex-1 rounded-xl bg-[#b91c1c] text-[0.95rem] font-black text-white disabled:opacity-35"
                >
                  {busy ? d.deleting : d.confirm}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AccountClient() {
  // undefined: loading; null: not signed in.
  const [info, setInfo] = useState<AccountInfo | null | undefined>(undefined);
  const [cardNotice, setCardNotice] = useState<{ track: DailyTrack; text: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setInfo(await dailyApi<AccountInfo>("account-info"));
      setError("");
    } catch (e) {
      if (e instanceof DailyApiError && e.status === 401) setInfo(null);
      else setError(copy.errors.generic);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subscriptions = info ? shownSubscriptions(info.subscriptions) : [];

  return (
    <div className={cn("daily-page min-h-[80vh] bg-[#fff8dc] px-4 pb-20 pt-10 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
        <h1 className={cn(displayClass, "text-center text-[2.3rem] leading-tight min-[900px]:text-left")}>{copy.title}</h1>

        {error && (
          <p role="alert" className="rounded-2xl bg-[#fef2f2] px-4 py-3 text-[0.9rem] font-semibold text-[#b91c1c]">
            {error}
          </p>
        )}

        {info === undefined && !error && <DailyLoading label="계정 정보를 불러오고 있어요" />}

        {info === null && (
          <section className={card}>
            <h2 className={sectionTitle}>{copy.signInTitle}</h2>
            <p className="mb-4 mt-1 text-center text-[0.92rem] font-semibold text-[#475569] min-[900px]:text-left">{copy.signInDetail}</p>
            <KakaoSignIn bare detail={null} />
          </section>
        )}

        {info && !info.verified && (
          <section className={cn(cardFrame, "bg-[#050505] text-white")}>
            <h2 className={sectionTitle}>{copy.verifyTitle}</h2>
            <p className="mb-4 mt-1 text-center text-[0.9rem] font-semibold text-white/70 min-[900px]:text-left">{copy.verifyDetail}</p>
            <KakaoSignIn bare confirm detail={null} />
          </section>
        )}

        {info && (
          <>
            <section className="flex flex-col gap-3">
              <h2 className={cn(sectionTitle, "mt-2")}>{copy.subscriptions.title}</h2>
              {subscriptions.length === 0 ? (
                <div className={cn(card, "text-center")}>
                  <p className="text-[0.95rem] font-semibold text-[#475569]">{copy.subscriptions.empty}</p>
                  <Link
                    href={DAILY_TRIAL_PATH}
                    className="mt-4 inline-flex h-[54px] items-center rounded-2xl bg-[#f47a4a] px-6 text-[0.95rem] font-black text-[#050505]"
                  >
                    {copy.subscriptions.start}
                  </Link>
                </div>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {subscriptions.map((sub) => (
                    // Keyed on what the server says, so a save resets local edits.
                    <SubscriptionCard
                      key={`${sub.track}-${sub.deliveryTime}-${sub.status}`}
                      sub={sub}
                      verified={info.verified}
                      notice={cardNotice?.track === sub.track ? cardNotice.text : ""}
                      onNotice={(track, text) => setCardNotice({ track, text })}
                      onChanged={load}
                    />
                  ))}
                </ul>
              )}
            </section>
            <Link href="/daily/book" className={cn(card, "flex items-center justify-between gap-3")}>
              <span className="flex items-center gap-2 text-[1.05rem] font-black">
                <Emoji className="text-[1.4rem]" motion="none">
                  📚
                </Emoji>
                {dailyCopy.book.title}
              </span>
              <span aria-hidden className="text-[1.2rem] font-black">›</span>
            </Link>
            <InviteCard />
            <Payments info={info} onChanged={load} />
            <Profile key={`${info.marketing}-${info.workplace}-${info.jobCategory}`} info={info} onChanged={load} />
            <DeleteAccount info={info} />
          </>
        )}

        <p className="mt-4 text-center text-[0.85rem] font-semibold text-[rgba(5,5,5,0.72)]">
          {copy.help}{" "}
          <Link href={DAILY_GUIDE_PATH} className="underline underline-offset-2">
            {dailyCopy.pricing.guide}
          </Link>
          {" · "}
          <Link href={DAILY_TERMS_PATH} className="underline underline-offset-2">
            {dailyCopy.pricing.terms}
          </Link>
        </p>
      </div>
    </div>
  );
}
