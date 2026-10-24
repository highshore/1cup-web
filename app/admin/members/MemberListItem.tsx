"use client";

import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { formatAdminDate } from "./shared";
import { getMemberBillingStatus, type MemberBillingStatus } from "./membershipStatus";
import type { UserData } from "./useAdminMembersData";

export function formatPaidAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

function badgeClass(status: MemberBillingStatus): string {
  const common = "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold leading-tight";
  if (status === "ongoing") return common + " bg-[#e7f7ec] text-[#18763e]";
  if (status === "stopped_active" || status === "stopped_ended") {
    return common + " bg-[#fff0df] text-[#a24a1b]";
  }
  return common + " bg-[#f1f2f4] text-[#686b70]";
}

export function MemberStatusBadge({ user }: { user: UserData }) {
  const { t } = useI18n();
  const copy = t.admin.members;
  const status = getMemberBillingStatus(user);
  const label = status === "ongoing" ? copy.membershipOngoing
    : status === "stopped_active" || status === "stopped_ended" ? copy.membershipBillingStopped
    : status === "ended" ? copy.membershipEnded
    : status === "unknown" ? copy.purchaseUnavailable
    : copy.membershipNone;
  return <span className={badgeClass(status)}>{label}</span>;
}

function memberMetric(user: UserData, locale: string, copy: ReturnType<typeof useI18n>["t"]["admin"]["members"]) {
  const status = getMemberBillingStatus(user);
  const date = user.subscriptionEndDate
    ? formatAdminDate(user.subscriptionEndDate, "yyyy.MM.dd", locale, "—") : null;
  if (status === "ongoing") {
    return {
      primary: user.lastMembershipPayment
        ? formatPaidAmount(user.lastMembershipPayment.amount, locale)
        : copy.noCompletedPayment,
      secondary: user.lastMembershipPayment ? copy.lastPaymentLabel : "",
    };
  }
  if (status === "stopped_active") {
    return { primary: date ? copy.endDate.replace("{date}", date) : copy.membershipAccessRemaining, secondary: copy.membershipAccessRemaining };
  }
  if (status === "stopped_ended") {
    return { primary: date ? copy.endDate.replace("{date}", date) : copy.membershipStoppedExpired, secondary: copy.membershipStoppedExpired };
  }
  if ((user.participationCreditBalance ?? 0) > 0) {
    return {
      primary: copy.remainingPassCount.replace("{count}", String(user.participationCreditBalance)),
      secondary: copy.creditBalanceLabel,
    };
  }
  return { primary: "—", secondary: "" };
}

export function MemberMobileCard({
  user,
  onView,
}: {
  user: UserData;
  onView: () => void;
}) {
  const { t, locale } = useI18n();
  const copy = t.admin.members;
  const metric = memberMetric(user, locale, copy);

  return (
    <article className="rounded-xl border border-[#e7e7e7] bg-white px-3.5 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[15px] font-extrabold text-[#181818]">
            {user.displayName || copy.noName}
          </p>
          <p className="m-0 mt-0.5 truncate text-[12px] text-[#7b7b7b]">
            {user.email || "—"}
          </p>
        </div>
        <MemberStatusBadge user={user} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#f0f0f0] pt-3">
        <div className="min-w-0">
          {metric.secondary && (
            <p className="m-0 mb-0.5 text-[11px] font-medium text-[#858585]">{metric.secondary}</p>
          )}
          <p className="m-0 truncate text-[14px] font-bold tabular-nums text-[#202020]">
            {metric.primary}
          </p>
        </div>
        <button
          type="button"
          onClick={onView}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-bold text-[#383838] hover:bg-[#f4f4f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f47a4a]"
          aria-label={copy.viewMember.replace("{name}", user.displayName || copy.noName)}
        >
          {copy.viewDetails}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

export function MemberDesktopRow({
  user,
  onView,
}: {
  user: UserData;
  onView: () => void;
}) {
  const { t, locale } = useI18n();
  const copy = t.admin.members;
  const date = formatAdminDate(user.createdAt, "yyyy.MM.dd", locale, "—");
  const ongoing = getMemberBillingStatus(user) === "ongoing";
  return (
    <tr className="border-b border-[#efefef] transition-colors last:border-b-0 hover:bg-[#fbfbfb]">
      <td className="max-w-[240px] px-4 py-3.5">
        <p className="m-0 truncate text-[13px] font-bold text-[#171717]">
          {user.displayName || copy.noName}
        </p>
        <p className="m-0 mt-0.5 truncate text-[11px] text-[#848484]" title={user.email}>
          {user.email || "—"}
        </p>
      </td>
      <td className="px-4 py-3.5">
        {user.purchaseHistoryLoaded === false ? (
          <span className="text-[11px] text-[#858585]">{copy.purchaseUnavailable}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {user.hasPurchasedMembership && <span className="rounded bg-[#fff0e9] px-2 py-1 text-[11px] font-semibold text-[#985336]">{copy.purchaseMembership}</span>}
            {user.hasPurchasedParticipationPack && <span className="rounded bg-[#eaf3ff] px-2 py-1 text-[11px] font-semibold text-[#3d6f9e]">{copy.purchasePass}</span>}
            {!user.hasPurchasedMembership && !user.hasPurchasedParticipationPack && <span className="text-[11px] text-[#a1a1a1]">—</span>}
          </div>
        )}
      </td>
      <td className="px-4 py-3.5"><MemberStatusBadge user={user} /></td>
      <td className="px-4 py-3.5 text-right">
        {ongoing && user.lastMembershipPayment ? (
          <div>
            <span className="whitespace-nowrap text-[13px] font-bold tabular-nums text-[#202020]">
              {formatPaidAmount(user.lastMembershipPayment.amount, locale)}
            </span>
            <p className="m-0 mt-0.5 whitespace-nowrap text-[11px] text-[#999]">
              {formatAdminDate(user.lastMembershipPayment.completedAt, "yyyy.MM.dd", locale, "—")}
            </p>
          </div>
        ) : (
          <span className="text-[13px] text-[#a1a1a1]">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-right text-[13px] font-semibold tabular-nums text-[#393939]">
        {user.participationCreditBalance ?? 0}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-[12px] text-[#646464]">
        {user.location === "yeouido" ? copy.locationYeouido : copy.locationAnam}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-[12px] tabular-nums text-[#777]">{date}</td>
      <td className="px-3 py-3.5 text-right">
        <button
          type="button"
          onClick={onView}
          aria-label={copy.viewMember.replace("{name}", user.displayName || copy.noName)}
          className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-[#e7e7e7] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#333] hover:border-[#aaa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f47a4a]"
        >
          {copy.viewDetails}
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
