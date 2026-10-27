"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DailyApiError, dailyApi } from "../../lib/features/daily/api";
import { cn, displayClass, Emoji, Pill } from "../../lib/features/daily/components/DailyUI";
import DailyLoading from "../../lib/features/daily/components/DailyLoading";
import KakaoSignIn from "../../lib/features/daily/components/KakaoSignIn";
import {
  DAILY_GUIDE_PATH,
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
  quote: { amount: number; daysRefunded: number; fullRefund: boolean } | null;
}

interface AccountInfo {
  phone: string;
  verified: boolean;
  name: string | null;
  marketing: boolean;
  subscriptions: Subscription[];
  payments: Payment[];
}

const copy = dailyCopy.account;
const TRACK_TITLE = DAILY_TRACK_LABEL;

const TIMES = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

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
function latestPerTrack(subscriptions: Subscription[]) {
  const seen = new Set<string>();
  return subscriptions.filter((s) => (seen.has(s.track) ? false : (seen.add(s.track), true)));
}

function Profile({ info, onChanged }: { info: AccountInfo; onChanged: () => Promise<void> }) {
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
      <dl className="m-0 mt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[0.9rem] font-bold text-[#64748b]">{copy.profile.phone}</dt>
          <dd className="m-0 text-[1rem] font-black">{info.phone}</dd>
        </div>
      </dl>
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

function SubscriptionCard({ sub, verified, onChanged }: { sub: Subscription; verified: boolean; onChanged: () => Promise<void> }) {
  const s = copy.subscriptions;
  const [time, setTime] = useState(sub.deliveryTime);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const live = sub.status === "trial" || sub.status === "active";

  const run = async (action: string, body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    setMessage("");
    try {
      await dailyApi(action, body);
      if (done) setMessage(done);
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

      <div className="mt-4 flex flex-wrap gap-2">
        {sub.status === "active" && sub.autoRenew && (
          <button
            type="button"
            disabled={!verified || busy}
            onClick={() => window.confirm(s.cancelConfirm) && run("cancel-renewal", { track: sub.track })}
            className={cn(smallButton, "bg-[#f5f5f4] text-[#050505]")}
          >
            {s.cancel}
          </button>
        )}
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
        {(sub.status === "trial" || sub.status === "trial_ended" || sub.status === "cancelled" || !sub.autoRenew) && (
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

// The select's value for "기타"; never stored as is.
const OTHER = "__other__";

function RefundForm({
  payment,
  onDone,
  onClose,
}: {
  payment: Payment;
  onDone: (result: { amount: number; status: "refunded" | "failed" | "unknown" }) => Promise<void>;
  onClose: () => void;
}) {
  const r = copy.refund;
  const quote = payment.quote!;
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isOther = choice === OTHER;
  const reason = isOther ? `${r.otherLabel}: ${other.trim()}` : choice;
  const ready = choice !== "" && (!isOther || other.trim().length >= 2);

  const submit = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { refund } = await dailyApi<{ refund: { amount: number; status: "refunded" | "failed" | "unknown" } }>("refund-request", {
        orderNumber: payment.orderNumber,
        reason,
      });
      await onDone(refund);
    } catch (e) {
      setMessage(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    // Flat inside the payments card: a box here would put the inputs three boxes deep.
    <div className="mt-3 border-t border-[#e7e5e4] pt-4">
      <p className="text-[0.82rem] font-extrabold text-[#78716c]">{r.amountLabel}</p>
      <p className="text-[1.5rem] font-black">₩{formatKrw(quote.amount)}</p>
      <p className="mt-1 text-[0.9rem] font-semibold text-[#57534e]">
        {quote.fullRefund ? r.full : r.partial.replace("{days}", String(quote.daysRefunded))}
      </p>
      <ul className="m-0 mt-3 flex list-disc flex-col gap-1 pl-5 text-[0.85rem] font-semibold leading-relaxed text-[#57534e]">
        {(payment.recurring ? [...r.effects, r.recurringEffect] : r.effects).map((effect) => (
          <li key={effect}>{effect}</li>
        ))}
      </ul>
      <label className="mt-4 block">
        <span className="text-[0.85rem] font-bold text-[#64748b]">{r.reason}</span>
        <select
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className="mt-1 h-12 w-full cursor-pointer rounded-xl bg-[#f5f5f4] px-3 text-[0.95rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]"
        >
          <option value="" disabled>
            {r.reasonPick}
          </option>
          {r.reasons.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
          <option value={OTHER}>{r.other}</option>
        </select>
      </label>
      {isOther && (
        <textarea
          value={other}
          onChange={(event) => setOther(event.target.value.slice(0, 480))}
          placeholder={r.otherPlaceholder}
          aria-label={r.other}
          rows={2}
          autoFocus
          className="mt-2 w-full resize-none rounded-xl bg-[#f5f5f4] p-3 text-[0.95rem] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]"
        />
      )}
      {message && (
        <p role="alert" className="mt-2 text-[0.86rem] font-semibold text-[#b91c1c]">
          {message}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy || !ready}
          onClick={submit}
          className="h-12 flex-1 rounded-xl bg-[#050505] text-[0.95rem] font-black text-white disabled:opacity-35"
        >
          {busy ? "보내는 중…" : r.submit.replace("{amount}", formatKrw(quote.amount))}
        </button>
        <button type="button" onClick={onClose} className="h-12 rounded-xl bg-[#f5f5f4] px-4 text-[0.95rem] font-black">
          {r.cancel}
        </button>
      </div>
    </div>
  );
}

function Payments({ info, onChanged }: { info: AccountInfo; onChanged: () => Promise<void> }) {
  const p = copy.payments;
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  return (
    <section className={card}>
      <h2 className={sectionTitle}>{p.title}</h2>
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
            const canRequest = payment.quote && (!refund || refund.status === "rejected");
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
                {canRequest && open !== payment.orderNumber && (
                  <button
                    type="button"
                    disabled={!info.verified}
                    onClick={() => {
                      setNotice("");
                      setOpen(payment.orderNumber);
                    }}
                    className="mt-2 text-[0.86rem] font-bold text-[#050505] underline underline-offset-2 disabled:text-[#94a3b8] disabled:no-underline"
                  >
                    {p.refundButton}
                  </button>
                )}
                {open === payment.orderNumber && payment.quote && (
                  <RefundForm
                    payment={payment}
                    onClose={() => setOpen(null)}
                    onDone={async (result) => {
                      setOpen(null);
                      setNotice(
                        result.status === "refunded"
                          ? copy.refund.done.replace("{amount}", formatKrw(result.amount))
                          : copy.refund.pending,
                      );
                      await onChanged();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
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

  const subscriptions = info ? latestPerTrack(info.subscriptions) : [];

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
                    <SubscriptionCard key={`${sub.track}-${sub.deliveryTime}-${sub.status}`} sub={sub} verified={info.verified} onChanged={load} />
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
            <Profile key={String(info.marketing)} info={info} onChanged={load} />
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
