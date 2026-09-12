"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CreditCardIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  StopCircleIcon,
  TicketIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { saveFeedback } from "../../lib/services/feedback_service";
import { invokeFunction, supabase } from "../../lib/supabase/client";
import {
  getParticipationCreditBalance,
  getParticipationCreditHistory,
} from "../../lib/features/meetup/services/participation_service";
import type { ProfileShellData } from "../ProfileShell";

interface CreditHistoryItem {
  id: string;
  amount: number;
  type: string;
  meetup_id: string | null;
  expires_at: string | null;
  created_at: string;
  meetups?: { title?: string | null; date_time?: string | null } | null;
}

const cancellationReasons = {
  en: [
    "The meetup times didn’t work for me",
    "The meetup location was inconvenient",
    "I didn’t get as much value as I expected",
    "I want a more structured learning program",
    "I prefer studying on my own",
    "Personal circumstances make it hard to attend",
    "I achieved my short-term goal",
    "The price became difficult to maintain",
    "The meetup atmosphere or member mix wasn’t a good fit",
  ],
  ko: [
    "모임 시간이 저와 맞지 않았어요",
    "모임 장소가 불편했어요",
    "기대했던 만큼의 가치를 느끼지 못했어요",
    "좀 더 체계적인 학습을 원했어요",
    "혼자 공부하는 걸 더 선호해요",
    "개인 사정으로 참여가 어려워졌어요",
    "단기 목표를 달성했어요",
    "가격이 지속적으로 부담되었어요",
    "모임 분위기나 멤버 구성과 잘 맞지 않았어요",
  ],
};

const refundLeadReason = {
  en: "I changed my mind after payment",
  ko: "결제 후 마음이 바뀌었어요 (단순 변심)",
};

const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-[#050505] bg-[#050505] px-4 text-[13px] font-extrabold text-white shadow-[3px_3px_0_#f47a4a] transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#f47a4a] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4";

const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-[#050505] bg-white px-4 text-[13px] font-extrabold text-[#050505] transition-[background-color,transform] hover:-translate-y-px hover:bg-[#fff8dc] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4";

const modalClass =
  "w-full max-w-[540px] border-2 border-[#050505] bg-white p-5 shadow-[6px_6px_0_rgba(5,5,5,0.92)] min-[640px]:rounded-[18px] min-[640px]:p-6";

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function nextBillingDate(startDate: Date | null, billingCancelled: boolean) {
  if (!startDate || billingCancelled) return null;
  const next = new Date(startDate);
  next.setMonth(next.getMonth() + 1);
  while (next.getTime() <= Date.now()) next.setMonth(next.getMonth() + 1);
  return next;
}

function dateLabel(date: Date | null, locale: string) {
  if (!date) return "-";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border-2 border-[#050505] bg-white p-4 shadow-[3px_3px_0_rgba(5,5,5,0.92)] sm:p-5">
      {children}
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon?: ElementType;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className="grid min-h-[48px] w-full grid-cols-[20px_1fr_minmax(110px,180px)_18px] items-center gap-2 border-0 border-b border-[rgba(5,5,5,0.14)] bg-transparent px-0 text-left last:border-b-0"
    >
      <span className="text-[#475569]">{Icon ? <Icon className="h-[18px] w-[18px]" /> : null}</span>
      <span className="text-[14px] font-bold text-[#050505]">{label}</span>
      <span className="truncate text-right text-[13px] font-medium text-[#64748b]">{value || ""}</span>
      <span className={onClick ? "text-[#475569]" : "opacity-0"}>
        <ChevronRightIcon className="h-[18px] w-[18px]" />
      </span>
    </Tag>
  );
}

function ModalClose({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#050505] bg-white text-[#050505] hover:bg-[#fff8dc] [&_svg]:h-5 [&_svg]:w-5"
      aria-label={t.profile.close}
    >
      <XMarkIcon />
    </button>
  );
}

function SurveyModal({
  title,
  reasons,
  submitLabel,
  danger,
  onClose,
  onSubmit,
}: {
  title: string;
  reasons: string[];
  submitLabel: string;
  danger?: boolean;
  onClose: () => void;
  onSubmit: (reasons: string[], other: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/45 min-[640px]:items-center min-[640px]:p-5" onMouseDown={onClose}>
      <div className={`${modalClass} max-h-[88vh] overflow-y-auto rounded-t-[18px]`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0">{title}</h2>
          <ModalClose onClick={onClose} />
        </div>
        <p className="mt-2 text-[13px] text-[#64748b]">{t.profile.surveyPrompt}</p>
        <div className="mt-5 grid gap-2">
          {reasons.map((reason) => {
            const active = selected.includes(reason);
            return (
              <label key={reason} className={`flex cursor-pointer items-start gap-3 rounded-[12px] border-2 p-3 text-[13px] leading-[1.45] ${active ? "border-[#050505] bg-[#fff0e8] shadow-[2px_2px_0_#f47a4a]" : "border-[rgba(5,5,5,0.16)] bg-white"}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setSelected((current) => event.target.checked ? [...current, reason] : current.filter((item) => item !== reason))}
                  className="mt-0.5 accent-[#f47a4a]"
                />
                <span className="font-medium text-[#050505]">{reason}</span>
              </label>
            );
          })}
        </div>
        <textarea
          value={other}
          onChange={(event) => setOther(event.target.value)}
          placeholder={t.profile.anythingElse}
          className="mt-4 min-h-[96px] w-full rounded-[12px] border-2 border-[rgba(5,5,5,0.18)] p-3 text-[13px] outline-none focus:border-[#050505] focus:shadow-[2px_2px_0_#f47a4a]"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>{t.profile.cancel}</button>
          <button
            type="button"
            disabled={saving || (selected.length === 0 && !other.trim())}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit(selected, other.trim());
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className={danger ? `${secondaryButtonClass} text-[#b42331]` : primaryButtonClass}
          >
            {saving ? t.profile.working : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageMembershipModal({
  status,
  nextBilling,
  billingCancelled,
  onClose,
  onStop,
  onReactivate,
  onRefund,
}: {
  status: string;
  nextBilling: string;
  billingCancelled: boolean;
  onClose: () => void;
  onStop: () => void;
  onReactivate: () => void;
  onRefund: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[1250] flex items-end justify-center bg-black/45 min-[640px]:items-center min-[640px]:p-5" onMouseDown={onClose}>
      <div className={`${modalClass} rounded-t-[18px] bg-[#fffdf8]`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="m-0">{t.profile.manageMembership}</h2>
            <p className="mt-1.5 text-[13px] text-[#64748b]">{interpolate(t.profile.currentStatus, { status, date: nextBilling })}</p>
          </div>
          <ModalClose onClick={onClose} />
        </div>

        {billingCancelled ? (
          <button type="button" onClick={onReactivate} className="mt-6 flex w-full items-start gap-3 rounded-[14px] border-2 border-[#050505] bg-[#fff8dc] p-4 text-left shadow-[3px_3px_0_#f47a4a]">
            <ArrowPathIcon className="mt-0.5 h-5 w-5 flex-none" />
            <span>
              <strong className="block text-[16px] font-extrabold text-[#050505]">{t.profile.reactivateBilling}</strong>
              <span className="mt-1.5 block text-[13px] leading-[1.5] text-[#64748b]">{t.profile.reactivateHelp}</span>
            </span>
          </button>
        ) : (
          <button type="button" onClick={onStop} className="mt-6 flex w-full items-start gap-3 rounded-[14px] border-2 border-[#050505] bg-[#fff8dc] p-4 text-left shadow-[3px_3px_0_#f47a4a]">
            <StopCircleIcon className="mt-0.5 h-5 w-5 flex-none" />
            <span>
              <strong className="block text-[16px] font-extrabold text-[#050505]">{t.profile.stopNextBilling}</strong>
              <span className="mt-1.5 block text-[13px] leading-[1.5] text-[#64748b]">{t.profile.stopBillingHelp}</span>
              <span className="mt-3 inline-flex rounded-full border-2 border-[#050505] bg-[#f47a4a] px-3 py-1 text-[11px] font-extrabold text-[#050505]">{t.profile.recommended}</span>
            </span>
          </button>
        )}

        <button type="button" onClick={onRefund} className="mt-3 flex w-full items-start gap-3 rounded-[14px] border-2 border-[#050505] bg-white p-4 text-left transition-colors hover:bg-[#fff1f2]">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none text-[#b42331]" />
          <span>
            <strong className="block text-[16px] font-extrabold text-[#b42331]">{t.profile.cancelRefund}</strong>
            <span className="mt-1.5 block text-[13px] leading-[1.5] text-[#64748b]">{t.profile.cancelRefundHelp}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function DeleteAccountModal({
  phrase,
  requiresBillingStop,
  onClose,
  onConfirm,
}: {
  phrase: string;
  requiresBillingStop: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [working, setWorking] = useState(false);

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/45 p-5" onMouseDown={onClose}>
      <div className={`${modalClass} rounded-[18px]`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="m-0 text-[#b42331]!">{t.profile.deleteAccountTitle}</h2>
            <p className="mt-1.5 text-[13px] text-[#64748b]">{t.profile.deleteAccountLead}</p>
          </div>
          <ModalClose onClick={onClose} />
        </div>
        {requiresBillingStop ? (
          <div className="mt-5 flex gap-3 rounded-[12px] border-2 border-[#050505] bg-[#fff8dc] p-4">
            <ExclamationTriangleIcon className="h-5 w-5 flex-none" />
            <p className="m-0 text-[13px] text-[#050505]">{t.profile.stopBillingBeforeDelete}</p>
          </div>
        ) : (
          <>
            <p className="mt-5 text-[13px] text-[#64748b]">{interpolate(t.profile.typeToConfirm, { phrase })}</p>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="off"
              className="mt-3 h-12 w-full rounded-[12px] border-2 border-[rgba(5,5,5,0.18)] px-4 text-[14px] outline-none focus:border-[#b42331]"
            />
          </>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>{t.profile.cancel}</button>
          {!requiresBillingStop && (
            <button
              type="button"
              disabled={working || value !== phrase}
              onClick={async () => {
                setWorking(true);
                try {
                  await onConfirm();
                } finally {
                  setWorking(false);
                }
              }}
              className={`${secondaryButtonClass} text-[#b42331]`}
            >
              <TrashIcon />
              {working ? t.profile.deleting : t.profile.deleteAccountTitle}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountMembershipPanel({
  shell,
  mobile = false,
  onBack,
}: {
  shell: ProfileShellData;
  mobile?: boolean;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { logout } = useAuth();
  const { locale, t } = useI18n();
  const [identities, setIdentities] = useState<{ id: string; provider: string }[]>([]);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [linkingIdentity, setLinkingIdentity] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [survey, setSurvey] = useState<"stop" | "refund" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!shell.currentUser) return;
    void supabase.auth.getUserIdentities().then(({ data }) => {
      setIdentities(
        (data?.identities ?? []).map((identity) => ({
          id: identity.identity_id ?? identity.id,
          provider: identity.provider,
        })),
      );
    });

    let active = true;
    setLoadingHistory(true);
    void Promise.all([
      getParticipationCreditBalance(),
      getParticipationCreditHistory(6),
    ])
      .then(([balance, rows]) => {
        if (!active) return;
        shell.setCreditBalance(balance);
        setHistory(rows as CreditHistoryItem[]);
      })
      .catch((creditError) => {
        console.error("Unable to load credit history:", creditError);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });

    return () => {
      active = false;
    };
  }, [shell.currentUser?.uid]);

  const nextBilling = useMemo(
    () => nextBillingDate(shell.summary.subscriptionStartDate, shell.summary.billingCancelled),
    [shell.summary.subscriptionStartDate, shell.summary.billingCancelled],
  );
  const daysLeft = nextBilling
    ? Math.max(0, Math.ceil((nextBilling.getTime() - Date.now()) / 86400000))
    : null;

  // Only leaders have a separately managed membership. Admins use normal paid membership and credit controls.
  const managedMembership = shell.summary.accountStatus === "leader";
  const membershipStatus = shell.membershipActive ? t.profile.active : t.profile.inactive;
  const membershipBadge = managedMembership
    ? t.profile.managed
    : shell.summary.billingCancelled
      ? t.profile.billingStopped
      : daysLeft !== null
        ? (locale === "ko" ? `${daysLeft}일 남음` : `${daysLeft} Days Left`)
        : membershipStatus;
  const membershipNote = managedMembership
    ? t.profile.leaderManagedNote
    : !shell.summary.hasActiveSubscription
      ? t.profile.noPaidMembership
      : shell.summary.billingCancelled
        ? t.profile.billingStoppedNote
        : t.profile.autoRenewNote;

  const reasons = cancellationReasons[locale];
  const refundReasons = [refundLeadReason[locale], ...reasons];

  const historyLabel = (entry: CreditHistoryItem) => {
    const meetupTitle = entry.meetups?.title || t.profile.sundayMeetup;
    if (entry.type === "purchase") return t.profile.creditPackPurchase;
    if (entry.type === "registration") return meetupTitle;
    if (entry.type === "registration_refund") return t.profile.meetupCancellation;
    if (entry.type === "payment_refund") return t.profile.creditPackRefund;
    return t.profile.creditAdjustment;
  };

  const handleIdentity = async (provider: string) => {
    if (provider !== "kakao" || identities.some((item) => item.provider === "kakao")) return;
    setLinkingIdentity(true);
    shell.setError(null);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "kakao",
        options: { redirectTo: `${window.location.origin}/profile?section=account` },
      });
      if (error) throw error;
    } catch (linkError) {
      console.error("Identity linking failed:", linkError);
      shell.setError(locale === "ko" ? "카카오 계정 연결에 실패했습니다. 잠시 후 다시 시도해주세요." : "We couldn’t connect your Kakao account. Please try again shortly.");
      setLinkingIdentity(false);
    }
  };

  const stopBilling = async (selectedReasons: string[], other: string) => {
    shell.setError(null);
    try {
      await saveFeedback("cancellation", selectedReasons, other);
      const result = await invokeFunction("payment", {
        action: "stop",
        reason: "User requested stop billing",
      });
      if (!(result as any)?.success) throw new Error((result as any)?.message || "Billing stop failed");
      await supabase.from("users").update({ billing_cancelled: true }).eq("uid", shell.currentUser!.uid);
      await shell.refresh();
      shell.setNotice((result as any)?.message || t.profile.stopBillingSuccess);
    } catch (stopError) {
      console.error("Stop billing failed:", stopError);
      shell.setError(t.profile.stopBillingFailed);
      throw stopError;
    }
  };

  const cancelAndRefund = async (selectedReasons: string[], other: string) => {
    if (!shell.summary.billingKey) {
      shell.setError(t.profile.missingSubscription);
      throw new Error("Missing billing key");
    }
    try {
      await saveFeedback("refund", selectedReasons, other);
      const result = await invokeFunction("payment", {
        action: "cancel",
        userId: shell.currentUser!.uid,
        billingKey: shell.summary.billingKey,
      });
      if (!(result as any)?.success) throw new Error((result as any)?.message || "Cancellation failed");
      await supabase
        .from("users")
        .update({
          has_active_subscription: false,
          subscription_end_date: new Date().toISOString(),
          billing_cancelled: false,
        })
        .eq("uid", shell.currentUser!.uid);
      await shell.refresh();
      shell.setNotice(t.profile.refundSuccess);
    } catch (refundError) {
      console.error("Cancel/refund failed:", refundError);
      shell.setError(t.profile.refundFailed);
      throw refundError;
    }
  };

  const reactivateBilling = async () => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ billing_cancelled: false })
        .eq("uid", shell.currentUser!.uid);
      if (error) throw error;
      await shell.refresh();
      shell.setNotice(t.profile.reactivateSuccess);
    } catch (reactivateError) {
      console.error("Billing reactivation failed:", reactivateError);
      shell.setError(t.profile.reactivateFailed);
    }
  };

  const manageMembership = () => {
    if (managedMembership) return;
    if (!shell.summary.hasActiveSubscription) {
      router.push("/payment");
      return;
    }
    setManageOpen(true);
  };

  const deleteAccount = async () => {
    try {
      await invokeFunction("account-delete", { confirmation: t.profile.deleteAccountPhrase });
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      router.replace("/");
      router.refresh();
    } catch (deleteError) {
      console.error("Delete account failed:", deleteError);
      shell.setError(t.profile.deleteAccountFailed);
      throw deleteError;
    }
  };

  const loginMethods = [
    { provider: "kakao", label: "Kakao", icon: ChatBubbleLeftRightIcon },
    { provider: "phone", label: locale === "ko" ? "휴대폰" : "Phone", icon: PhoneIcon },
    { provider: "email", label: locale === "ko" ? "이메일" : "Email", icon: EnvelopeIcon },
  ] as const;

  return (
    <>
      <div className={mobile ? "px-4 pb-10 pt-5 sm:px-6" : "p-8"}>
        <div className="flex items-start gap-3">
          {mobile && onBack && (
            <button type="button" onClick={onBack} className="mt-[-2px] inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-[#050505] bg-white" aria-label={t.profile.backToProfile}>
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="m-0">{t.profile.accountMembership}</h1>
            <p className="mt-1.5 text-[13px] text-[#64748b]">{t.profile.accountHelp}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5">
          <Card>
            <h2 className="mb-2 mt-0">{t.profile.loginMethods}</h2>
            {loginMethods.map(({ provider, label, icon }) => {
              const connected =
                identities.some((identity) => identity.provider === provider) ||
                (provider === "email" && Boolean(shell.currentUser?.email)) ||
                (provider === "phone" && Boolean(shell.currentUser?.phoneNumber));
              return (
                <Row
                  key={provider}
                  icon={icon}
                  label={label}
                  value={connected ? t.profile.connected : linkingIdentity && provider === "kakao" ? t.profile.connecting : t.profile.notConnected}
                  onClick={provider === "kakao" && !connected ? () => void handleIdentity("kakao") : undefined}
                />
              );
            })}
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="m-0">{t.profile.membership}</h2>
              <span className="shrink-0 rounded-full border-2 border-[#050505] bg-[#f47a4a] px-3 py-1 text-[11px] font-extrabold leading-none text-[#050505]">
                {membershipBadge}
              </span>
            </div>
            <Row icon={CheckCircleIcon} label={t.profile.memberStatus} value={membershipStatus} />
            <Row icon={CreditCardIcon} label={t.profile.lastPayment} value={dateLabel(shell.summary.subscriptionStartDate, locale)} />
            <Row icon={CreditCardIcon} label={t.profile.nextBilling} value={managedMembership ? t.profile.notApplicable : shell.summary.billingCancelled ? t.profile.stopped : dateLabel(nextBilling, locale)} />

            <div className={`mt-4 rounded-[12px] border-2 border-[#050505] px-4 py-3 text-[13px] leading-[1.55] ${shell.summary.billingCancelled ? "bg-[#fff8dc]" : "bg-[#fffaf6]"}`}>
              {membershipNote}
            </div>

            {!managedMembership && (
              <button type="button" onClick={manageMembership} className={`${primaryButtonClass} mt-4`}>
                <CreditCardIcon />
                {!shell.summary.hasActiveSubscription ? t.profile.startMembership : t.profile.manageMembership}
              </button>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="m-0">{t.profile.participationCredits}</h2>
              <span className="shrink-0 rounded-full border-2 border-[#050505] bg-[#f47a4a] px-3 py-1 text-[11px] font-extrabold leading-none text-[#050505]">{interpolate(t.profile.creditsLeft, { count: shell.creditBalance })}</span>
            </div>
            {loadingHistory ? (
              <p className="text-[13px] text-[#64748b]">{t.profile.loadingCreditHistory}</p>
            ) : history.length ? (
              history.map((entry) => (
                <Row
                  key={entry.id}
                  icon={TicketIcon}
                  label={`${entry.amount > 0 ? `+${entry.amount}` : entry.amount} · ${historyLabel(entry)}`}
                  value={new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" }).format(new Date(entry.created_at))}
                />
              ))
            ) : (
              <p className="py-2 text-[13px] text-[#64748b]">{t.profile.noCreditHistory}</p>
            )}
            <button type="button" onClick={() => router.push("/payment?product=participation_pack_5")} className={`${primaryButtonClass} mt-4`}>
              <TicketIcon />
              {t.profile.buyFiveCredits}
            </button>
          </Card>

          <Card>
            <h2 className="m-0">{t.profile.accountActions}</h2>
            <p className="mb-4 mt-1 text-[12px] font-bold text-[#b42331]">{t.profile.dangerZone}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={async () => { await logout(); router.push("/"); }} className={secondaryButtonClass}>
                <ArrowRightOnRectangleIcon />
                {t.profile.logOut}
              </button>
              <button type="button" onClick={() => setDeleteOpen(true)} className={`${secondaryButtonClass} text-[#b42331]`}>
                <TrashIcon />
                {t.profile.deleteAccountTitle}
              </button>
            </div>
          </Card>
        </div>

        {(shell.notice || shell.error) && mobile && (
          <div className={`mt-5 rounded-[12px] border-2 border-[#050505] px-4 py-3 text-[13px] font-bold shadow-[2px_2px_0_rgba(5,5,5,0.92)] ${shell.error ? "bg-[#fff1f2] text-[#b42331]" : "bg-[#fff8dc] text-[#050505]"}`}>
            {shell.error || shell.notice}
          </div>
        )}
      </div>

      {manageOpen && (
        <ManageMembershipModal
          status={membershipStatus}
          nextBilling={managedMembership ? t.profile.notApplicable : shell.summary.billingCancelled ? t.profile.stopped : dateLabel(nextBilling, locale)}
          billingCancelled={shell.summary.billingCancelled}
          onClose={() => setManageOpen(false)}
          onStop={() => { setManageOpen(false); setSurvey("stop"); }}
          onReactivate={() => { setManageOpen(false); void reactivateBilling(); }}
          onRefund={() => { setManageOpen(false); setSurvey("refund"); }}
        />
      )}

      {survey === "stop" && (
        <SurveyModal title={t.profile.stopNextBilling} reasons={reasons} submitLabel={t.profile.stopNextBilling} onClose={() => setSurvey(null)} onSubmit={stopBilling} />
      )}
      {survey === "refund" && (
        <SurveyModal title={t.profile.cancelRefund} reasons={refundReasons} submitLabel={t.profile.cancelRequestRefund} danger onClose={() => setSurvey(null)} onSubmit={cancelAndRefund} />
      )}
      {deleteOpen && (
        <DeleteAccountModal
          phrase={t.profile.deleteAccountPhrase}
          requiresBillingStop={shell.summary.hasActiveSubscription && !shell.summary.billingCancelled}
          onClose={() => setDeleteOpen(false)}
          onConfirm={deleteAccount}
        />
      )}
    </>
  );
}

export default AccountMembershipPanel;
