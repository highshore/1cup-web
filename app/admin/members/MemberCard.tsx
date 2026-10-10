"use client";

import { useState } from "react";

import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";
import {
  cardHoverLift,
  formatAdminDate,
  statusPillClass,
  userEmailClass,
  userNameClass,
} from "./shared";
import type { MembershipLocation, UserData } from "./useAdminMembersData";

const userCardClass = `flex flex-col items-stretch p-4 border-[1.5px] border-[#050505] rounded-[10px] ${cardHoverLift}`;

const userInfoClass = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1.6fr)_minmax(90px,.6fr)_minmax(155px,1fr)_minmax(110px,.8fr)_minmax(88px,.6fr)] lg:items-center";

const creditInspectorClass =
  "grid gap-2 w-full mt-3 pt-3 border-t border-t-[rgba(5,5,5,0.15)] text-[12px]";

const creditControlsClass =
  "flex flex-wrap gap-2 " +
  "[&_input]:min-w-0 [&_input]:border [&_input]:border-[#050505] [&_input]:rounded-[6px] [&_input]:py-1.5 [&_input]:px-2 [&_input]:[font:inherit] " +
  "[&_button]:border [&_button]:border-[#050505] [&_button]:rounded-[6px] [&_button]:bg-white [&_button]:py-1.5 [&_button]:px-2 [&_button]:[font:inherit] [&_button]:font-extrabold [&_button]:cursor-pointer";

const userStatusClass = (active: boolean, purchasedMembership: boolean) =>
  [
    statusPillClass,
    active ? "bg-[#dcfce7]" : purchasedMembership ? "bg-[#fff0d8]" : "bg-[#f3f4f6]",
  ].join(" ");

const locationStatusClass = (location: MembershipLocation) =>
  `${statusPillClass} ${location === "yeouido" ? "bg-[#dbeafe]" : "bg-[#ffedd5]"}`;

const userDateClass = "text-[rgba(5,5,5,0.6)] text-[12px]";

type CreditEntry = Record<string, any>;

const creditEntryLabel = (entry: CreditEntry) => {
  const meetup = Array.isArray(entry.meetups) ? entry.meetups[0] : entry.meetups;
  switch (entry.type) {
    case "purchase":
      return "참여권 구매";
    case "registration":
      return `${meetup?.title || "밋업"} 신청`;
    case "registration_refund":
      return `${meetup?.title || "밋업"} 취소`;
    case "payment_refund":
      return "참여권 구매 환불";
    default:
      return "관리자 조정";
  }
};

interface MemberCardProps {
  user: UserData;
  expanded: boolean;
  onToggleExpanded: () => void;
  onBalanceChange: (userId: string, balance: number) => void;
}

// One member row plus its participation-credit inspector (history and manual adjustment).
export default function MemberCard({
  user,
  expanded,
  onToggleExpanded,
  onBalanceChange,
}: MemberCardProps) {
  const { t, locale } = useI18n();
  const copy = t.admin.members;
  const [history, setHistory] = useState<CreditEntry[] | null>(null);
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const formatDate = (value?: Date | string, pattern: "yyyy.MM.dd" | "yyyy.MM.dd HH:mm" = "yyyy.MM.dd") =>
    formatAdminDate(value, pattern, locale, t.admin.dashboard.unavailable);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from("participation_credit_transactions")
      .select("id, amount, type, meetup_id, metadata, created_at, meetups(title, date_time)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      window.alert(`참여권 내역을 불러오지 못했습니다. (${error.message})`);
      return;
    }
    setHistory(data || []);
  };

  const toggle = () => {
    const opening = !expanded;
    onToggleExpanded();
    if (opening && !history) void loadHistory();
  };

  const adjust = async () => {
    const parsed = Number.parseInt(amount, 10);
    if (!Number.isInteger(parsed) || parsed === 0) {
      window.alert("0이 아닌 정수 조정 값을 입력하세요.");
      return;
    }
    if (!reason.trim()) {
      window.alert("조정 사유를 입력하세요.");
      return;
    }
    setAdjusting(true);
    try {
      const { data, error } = await supabase.rpc("adjust_participation_credits", {
        p_user_id: user.id,
        p_amount: parsed,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      const balance = Number(data ?? 0);
      onBalanceChange(user.id, balance);
      setHistory([]);
      setReason("");
      window.alert(`참여권 잔액이 ${balance}회로 조정되었습니다.`);
      await loadHistory();
    } catch (adjustmentError) {
      const message =
        adjustmentError instanceof Error ? adjustmentError.message : String(adjustmentError);
      window.alert(`참여권 조정에 실패했습니다. (${message})`);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className={userCardClass}>
      <div className={userInfoClass}>
        <div>
          <div className={userNameClass}>{user.displayName || copy.noName}</div>
          <div className={"break-all " + userEmailClass}>{user.email}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.purchaseHistoryLoaded === false ? (
              <span className={userStatusClass(false, false)}>{copy.purchaseUnavailable}</span>
            ) : (
              <>
                {user.hasPurchasedMembership && (
                  <span className={statusPillClass + " bg-[#ffe8dd]"}>{copy.purchasedMembership}</span>
                )}
                {user.hasPurchasedParticipationPack && (
                  <span className={statusPillClass + " bg-[#e1f3ff]"}>{copy.purchasedPass}</span>
                )}
                {!user.hasPurchasedMembership && !user.hasPurchasedParticipationPack && (
                  <span className={statusPillClass + " bg-[#f3f4f6]"}>{copy.noPurchases}</span>
                )}
              </>
            )}
          </div>
        </div>

        <div>
          <div className={locationStatusClass(user.location)}>
            {user.location === "yeouido" ? copy.locationYeouido : copy.locationAnam}
          </div>
        </div>

        <div className="flex flex-col items-start gap-1">
          <span className="text-[11px] font-bold text-[#050505]/55">{copy.membershipStatusLabel}</span>
          <div className={userStatusClass(!!user.hasActiveSubscription, !!user.hasPurchasedMembership)}>
            {user.hasActiveSubscription
              ? copy.membershipActive
              : user.purchaseHistoryLoaded === false ? copy.purchaseUnavailable
                : user.hasPurchasedMembership ? copy.membershipEnded : copy.membershipNone}
          </div>
          {user.subscriptionEndDate && (user.hasActiveSubscription || user.hasPurchasedMembership) && (
            <span className={userDateClass}>
              {copy.endDate.replace("{date}", formatDate(user.subscriptionEndDate))}
            </span>
          )}
        </div>

        <div>
          <div className="text-[11px] font-bold text-[#050505]/55">{copy.creditBalanceLabel}</div>
          <div className="mt-1 text-[18px] font-black text-[#050505]">
            {user.participationCreditBalance ?? 0}<span className="ml-1 text-[12px] font-bold">{copy.creditUnit}</span>
          </div>
          {user.hasActiveSubscription && user.billingCancelled && (
            <div className="text-[11px] font-semibold text-[#b45309]">{copy.billingStopped}</div>
          )}
        </div>

        <div className={userDateClass}>{formatDate(user.createdAt)}</div>
      </div>
      <div className={creditInspectorClass}>
        <div className={creditControlsClass}>
          <button type="button" onClick={toggle}>
            {expanded ? copy.creditHideHistory : copy.creditShowHistory}
          </button>
          {expanded && (
            <>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="numeric"
                aria-label="참여권 조정 수량"
                placeholder="예: +1 또는 -1"
              />
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-label="참여권 조정 사유"
                placeholder="조정 사유"
              />
              <button type="button" onClick={() => void adjust()} disabled={adjusting}>
                {adjusting ? "조정 중" : "조정 기록"}
              </button>
            </>
          )}
        </div>
        {expanded &&
          (history || []).map((entry) => (
            <div key={entry.id}>
              {entry.amount > 0 ? `+${entry.amount}` : entry.amount} · {creditEntryLabel(entry)} ·{" "}
              {formatDate(entry.created_at, "yyyy.MM.dd HH:mm")}
            </div>
          ))}
      </div>
    </div>
  );
}
