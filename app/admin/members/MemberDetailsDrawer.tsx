"use client";

import { useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";
import { formatAdminDate } from "./shared";
import { getMemberBillingStatus } from "./membershipStatus";
import { formatPaidAmount, MemberStatusBadge } from "./MemberListItem";
import type { UserData } from "./useAdminMembersData";

type CreditEntry = {
  id: string;
  amount: number;
  type: string;
  created_at: string;
  meetups: { title?: string | null } | { title?: string | null }[] | null;
};

export default function MemberDetailsDrawer({
  user,
  onClose,
  onBalanceChange,
}: {
  user: UserData;
  onClose: () => void;
  onBalanceChange: (userId: string, balance: number) => void;
}) {
  const { t, locale } = useI18n();
  const copy = t.admin.members;
  const [history, setHistory] = useState<CreditEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const status = getMemberBillingStatus(user);

  const formatDate = (value?: Date | string, pattern: "yyyy.MM.dd" | "yyyy.MM.dd HH:mm" = "yyyy.MM.dd") =>
    formatAdminDate(value, pattern, locale, t.admin.dashboard.unavailable);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])",
        )];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (focusable.length && event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (focusable.length && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("participation_credit_transactions")
        .select("id, amount, type, created_at, meetups(title)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) {
        console.error("Could not load participation history:", error);
        setHistoryError(true);
        setHistory([]);
      } else {
        setHistory((data || []) as CreditEntry[]);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const reloadHistory = async () => {
    const { data, error } = await supabase
      .from("participation_credit_transactions")
      .select("id, amount, type, created_at, meetups(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setHistoryError(true);
      console.error("Could not refresh participation history:", error);
    } else {
      setHistoryError(false);
      setHistory((data || []) as CreditEntry[]);
    }
  };

  const adjust = async () => {
    const value = amount.trim();
    const parsed = Number(value);
    if (!/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed === 0) {
      window.alert(copy.creditInvalidAmount);
      return;
    }
    if (!reason.trim()) {
      window.alert(copy.creditReasonRequired);
      return;
    }
    if (!window.confirm(copy.creditAdjustConfirm
      .replace("{amount}", String(parsed))
      .replace("{name}", user.displayName || copy.noName))) return;
    setAdjusting(true);
    try {
      const { data, error } = await supabase.rpc("adjust_participation_credits", {
        p_user_id: user.id,
        p_amount: parsed,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      const balance = Number(data);
      if (Number.isFinite(balance)) onBalanceChange(user.id, balance);
      setAmount("1");
      setReason("");
      window.alert(copy.creditAdjustSuccess.replace("{count}", String(balance)));
      await reloadHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(copy.creditAdjustFailed.replace("{message}", message));
    } finally {
      setAdjusting(false);
    }
  };

  const creditLabel = (entry: CreditEntry) => {
    const meetup = Array.isArray(entry.meetups) ? entry.meetups[0] : entry.meetups;
    switch (entry.type) {
      case "purchase": return copy.creditEventPurchase;
      case "registration": return copy.creditEventRegistration.replace("{name}", meetup?.title || copy.creditEventMeetup);
      case "registration_refund": return copy.creditEventRefund.replace("{name}", meetup?.title || copy.creditEventMeetup);
      case "payment_refund": return copy.creditEventPaymentRefund;
      default: return copy.creditEventAdjustment;
    }
  };
  const metaLabelClass = "text-[11px] font-semibold text-[#929292]";
  const metaValueClass = "mt-1 text-[13px] font-bold text-[#292929]";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-end sm:items-stretch" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/40"
        aria-label={copy.closeDetails}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-details-title"
        className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-full sm:max-h-full sm:max-w-[480px] sm:rounded-none sm:rounded-l-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[#dedede] sm:hidden" />
        <div className="flex shrink-0 items-center justify-between border-b border-[#ededed] px-5 py-4 sm:px-6">
          <h2 id="member-details-title" className="m-0 text-[17px] font-extrabold text-[#171717]">{copy.memberDetailsTitle}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={copy.closeDetails}
            onClick={onClose}
            className="rounded-lg p-2 text-[#555] hover:bg-[#f3f3f3] focus-visible:outline-2 focus-visible:outline-[#f47a4a]"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-[20px] font-extrabold text-[#1c1c1c]">{user.displayName || copy.noName}</h3>
              <MemberStatusBadge user={user} />
            </div>
            <p className="m-0 mt-1 break-all text-[13px] text-[#777]">{user.email || "—"}</p>
            {(status === "stopped_active" || status === "stopped_ended") && (
              <p className="m-0 mt-2 rounded-lg bg-[#fff4e8] px-3 py-2 text-[12px] font-semibold text-[#9a4c19]">
                {status === "stopped_active" ? copy.membershipAccessRemaining : copy.membershipStoppedExpired}
              </p>
            )}
          </section>

          <section className="rounded-xl bg-[#f8f8f8] p-4">
            <h3 className="m-0 mb-3 text-[13px] font-extrabold text-[#303030]">{copy.paymentAndAccess}</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <p className={metaLabelClass}>{copy.lastPaymentLabel}</p>
                <p className={metaValueClass + " tabular-nums"}>
                  {user.purchaseHistoryLoaded === false ? copy.purchaseUnavailable
                    : user.lastMembershipPayment ? formatPaidAmount(user.lastMembershipPayment.amount, locale) : "—"}
                </p>
                {user.lastMembershipPayment && (
                  <p className="m-0 mt-1 text-[11px] text-[#858585]">
                    {user.lastMembershipPayment.type === "subscription_recurring" ? copy.paymentRecurring : copy.paymentInitial}
                    {" / "}
                    {formatDate(user.lastMembershipPayment.completedAt)}
                  </p>
                )}
              </div>
              <div>
                <p className={metaLabelClass}>{copy.creditBalanceLabel}</p>
                <p className={metaValueClass}>{copy.remainingPassCount.replace("{count}", String(user.participationCreditBalance ?? 0))}</p>
              </div>
              <div>
                <p className={metaLabelClass}>{copy.purchaseFilterLabel}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {user.purchaseHistoryLoaded === false ? (
                    <span className={metaValueClass}>{copy.purchaseUnavailable}</span>
                  ) : (
                    <>
                      {user.hasPurchasedMembership && <span className="rounded bg-[#fff0e9] px-2 py-1 text-[11px] font-semibold text-[#985336]">{copy.purchaseMembership}</span>}
                      {user.hasPurchasedParticipationPack && <span className="rounded bg-[#eaf3ff] px-2 py-1 text-[11px] font-semibold text-[#3d6f9e]">{copy.purchasePass}</span>}
                      {!user.hasPurchasedMembership && !user.hasPurchasedParticipationPack && <span className={metaValueClass}>—</span>}
                    </>
                  )}
                </div>
              </div>
              <div>
                <p className={metaLabelClass}>{copy.locationFilterLabel}</p>
                <p className={metaValueClass}>{user.location === "yeouido" ? copy.locationYeouido : copy.locationAnam}</p>
              </div>
              <div>
                <p className={metaLabelClass}>{copy.membershipStartLabel}</p>
                <p className={metaValueClass}>{formatDate(user.subscriptionStartDate)}</p>
              </div>
              <div>
                <p className={metaLabelClass}>{copy.membershipEndLabel}</p>
                <p className={metaValueClass}>{formatDate(user.subscriptionEndDate)}</p>
              </div>
              <div>
                <p className={metaLabelClass}>{copy.joinedAtLabel}</p>
                <p className={metaValueClass}>{formatDate(user.createdAt)}</p>
              </div>
              <div>
                <p className={metaLabelClass}>{copy.memberIdLabel}</p>
                <p className="m-0 mt-1 break-all text-[11px] text-[#606060]">{user.id}</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-[14px] font-extrabold text-[#282828]">{copy.creditHistoryTitle}</h3>
              <span className="text-[11px] font-semibold text-[#999]">{copy.creditHistoryLimit}</span>
            </div>
            {history === null ? (
              <p className="m-0 rounded-lg bg-[#fafafa] p-4 text-[12px] text-[#777]">{copy.creditHistoryLoading}</p>
            ) : historyError ? (
              <p role="alert" className="m-0 rounded-lg bg-[#fff2e8] p-4 text-[12px] text-[#9a3412]">
                {copy.creditHistoryLoadFailed}
              </p>
            ) : history.length === 0 ? (
              <p className="m-0 rounded-lg bg-[#fafafa] p-4 text-[12px] text-[#777]">{copy.creditHistoryEmpty}</p>
            ) : (
              <ul className="m-0 divide-y divide-[#efefef] rounded-lg border border-[#efefef] px-3">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 py-3 text-[12px]">
                    <span className="min-w-0 break-words text-[#525252]">{creditLabel(entry)}</span>
                    <div className="shrink-0 text-right">
                      <p className="m-0 font-bold tabular-nums text-[#202020]">{entry.amount > 0 ? "+" : ""}{entry.amount}</p>
                      <p className="m-0 mt-0.5 text-[10px] text-[#999]">{formatDate(entry.created_at, "yyyy.MM.dd HH:mm")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 border-t border-[#ececec] pt-5">
            <h3 className="m-0 text-[14px] font-extrabold text-[#282828]">{copy.creditAdjustTitle}</h3>
            <p className="m-0 text-[12px] leading-relaxed text-[#777]">{copy.creditAdjustHint}</p>
            <label className="block text-[12px] font-bold text-[#414141]">
              {copy.creditAdjustAmount}
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="+1 / -1"
                className="mt-1 block min-h-10 w-full rounded-lg border border-[#d9d9d9] px-3 text-[13px] outline-none focus:border-[#f47a4a]"
              />
            </label>
            <label className="block text-[12px] font-bold text-[#414141]">
              {copy.creditAdjustReason}
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={copy.creditReasonPlaceholder}
                className="mt-1 block min-h-10 w-full rounded-lg border border-[#d9d9d9] px-3 text-[13px] outline-none focus:border-[#f47a4a]"
              />
            </label>
            <button
              type="button"
              onClick={() => void adjust()}
              disabled={adjusting}
              className="min-h-10 rounded-lg border border-[#dedede] bg-[#f5f5f5] px-4 text-[13px] font-bold text-[#282828] hover:bg-[#ececec] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adjusting ? copy.creditAdjusting : copy.creditAdjustSave}
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}
