"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { useRouter } from "next/navigation";
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CreditCardIcon,
  PencilSquareIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase, invokeFunction } from "../lib/supabase/client";
import { getParticipationCreditBalance } from "../lib/features/meetup/services/participation_service";

export type ProfileSection = "edit" | "connections" | "account";

export interface ProfileDetailsJson {
  nationality?: string;
  languages?: string[];
  english_level?: string;
  meetup_preferences?: string;
}

export interface ProfileSummary {
  createdAt: Date | null;
  hasActiveSubscription: boolean;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  billingKey: string | null;
  billingCancelled: boolean;
  accountStatus: string;
  gdgMember: boolean;
  referralCode: string | null;
  bio: string;
  work: string;
  school: string;
  location: string;
  interests: string;
  profilePublic: boolean;
  profileDetails: ProfileDetailsJson;
}

const emptySummary: ProfileSummary = {
  createdAt: null,
  hasActiveSubscription: false,
  subscriptionStartDate: null,
  subscriptionEndDate: null,
  billingKey: null,
  billingCancelled: false,
  accountStatus: "user",
  gdgMember: false,
  referralCode: null,
  bio: "",
  work: "",
  school: "",
  location: "",
  interests: "",
  profilePublic: true,
  profileDetails: {},
};

function parseProfileDetails(value: unknown): ProfileDetailsJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  return {
    nationality: typeof row.nationality === "string" ? row.nationality : "",
    languages: Array.isArray(row.languages)
      ? row.languages.filter((item): item is string => typeof item === "string")
      : [],
    english_level: typeof row.english_level === "string" ? row.english_level : "",
    meetup_preferences:
      typeof row.meetup_preferences === "string" ? row.meetup_preferences : "",
  };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function paidPeriodEnd(summary: ProfileSummary) {
  if (!summary.hasActiveSubscription) return null;
  if (summary.subscriptionEndDate && summary.subscriptionEndDate.getTime() > Date.now()) {
    return summary.subscriptionEndDate;
  }
  if (!summary.subscriptionStartDate) return null;
  const next = new Date(summary.subscriptionStartDate);
  next.setMonth(next.getMonth() + 1);
  while (next.getTime() <= Date.now()) next.setMonth(next.getMonth() + 1);
  return next;
}

function daysUntil(date: Date | null) {
  if (!date) return 0;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

function metricColor(remaining: number, ratio: number) {
  if (remaining <= 1) return "#dc2626";
  if (ratio > 0.7) return "#22c55e";
  if (ratio > 0.3) return "#eab308";
  return "#f47a4a";
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

async function loadKakaoSdk(): Promise<void> {
  if (typeof window === "undefined" || (window as any).Kakao) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://developers.kakao.com/sdk/js/kakao.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Kakao SDK"));
    document.head.appendChild(script);
  });
}

export function useProfileShellData() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { currentUser, isLoading: authLoading } = useAuth();
  const [summary, setSummary] = useState<ProfileSummary>(emptySummary);
  const [creditBalance, setCreditBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [{ data, error: profileError }, credits] = await Promise.all([
        supabase.from("users").select("*").eq("uid", currentUser.uid).maybeSingle(),
        getParticipationCreditBalance().catch(() => 0),
      ]);
      if (profileError) throw profileError;
      if (!data) throw new Error("Profile not found");

      setSummary({
        createdAt: parseDate(data.created_at),
        hasActiveSubscription: data.has_active_subscription === true,
        subscriptionStartDate: parseDate(data.subscription_start_date),
        subscriptionEndDate: parseDate(data.subscription_end_date),
        billingKey: typeof data.billing_key === "string" ? data.billing_key : null,
        billingCancelled: data.billing_cancelled === true,
        accountStatus:
          typeof data.account_status === "string" && data.account_status
            ? data.account_status
            : "user",
        gdgMember: data.gdg_member === true,
        referralCode:
          typeof data.referral_code === "string" && data.referral_code
            ? data.referral_code
            : null,
        bio: typeof data.bio === "string" ? data.bio : "",
        work: typeof data.work === "string" ? data.work : "",
        school: typeof data.school === "string" ? data.school : "",
        location: typeof data.location === "string" ? data.location : "",
        interests: typeof data.interests === "string" ? data.interests : "",
        profilePublic: data.profile_public !== false,
        profileDetails: parseProfileDetails(data.profile_details),
      });
      setCreditBalance(typeof credits === "number" ? credits : 0);
      setError(null);
    } catch (loadError) {
      console.error("Unable to load profile summary:", loadError);
      setError(t.profile.profileLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [currentUser, t.profile.profileLoadFailed]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace(`/auth?redirect=${encodeURIComponent("/profile")}`);
      return;
    }
    void refresh();
  }, [authLoading, currentUser, refresh, router]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const completion = useMemo(() => {
    if (!currentUser) return 0;
    const values = [
      currentUser.displayName,
      currentUser.photoURL,
      summary.bio,
      summary.work,
      summary.school,
      summary.location,
      summary.interests,
      summary.profileDetails.nationality,
      summary.profileDetails.languages?.length ? "languages" : "",
      summary.profileDetails.english_level,
    ];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [currentUser, summary]);

  const membershipYear = summary.createdAt?.getFullYear() ?? null;
  const roleLabel =
    summary.accountStatus === "admin"
      ? "ADMIN"
      : summary.accountStatus === "leader"
        ? "LEADER"
        : "MEMBER";
  // GDG is no longer a special billing state. Admins use the same paid membership controls as members.
  const membershipActive = summary.hasActiveSubscription || summary.accountStatus === "leader";

  const shareReferral = useCallback(async () => {
    if (!currentUser) return;
    setReferralBusy(true);
    setError(null);
    try {
      let code = summary.referralCode;
      if (!code) {
        const result = await invokeFunction("payment", { action: "generate-referral" });
        code = typeof (result as any)?.referralCode === "string" ? (result as any).referralCode : null;
        if (!code) throw new Error("Unable to generate referral code");
        setSummary((prev) => ({ ...prev, referralCode: code }));
      }

      const url = `https://1cupenglish.com/payment?ref=${code}`;
      const title = t.profile.referralShareTitle;
      const codeLabel = interpolate(t.profile.referralCodeLabel, { code });
      const text = `${title}: ${code}\n${url}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }

      const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
      if (kakaoKey) {
        try {
          await loadKakaoSdk();
          const Kakao = (window as any).Kakao;
          if (Kakao && !Kakao.isInitialized?.()) Kakao.init?.(kakaoKey);
          if (Kakao?.Share?.sendDefault) {
            Kakao.Share.sendDefault({
              objectType: "feed",
              content: {
                title,
                description: codeLabel,
                imageUrl: "https://1cupenglish.com/images/logos/1cup_logo_new.svg",
                link: { mobileWebUrl: url, webUrl: url },
              },
              buttons: [
                {
                  title: t.profile.referralUseNow,
                  link: { mobileWebUrl: url, webUrl: url },
                },
              ],
            });
            setNotice(copied ? t.profile.referralKakaoCopied : t.profile.referralKakaoOpened);
            return;
          }
        } catch (kakaoError) {
          console.error("Kakao share unavailable:", kakaoError);
        }
      }

      if (navigator.share) {
        try {
          await navigator.share({ title: "1 Cup English", text, url });
          setNotice(t.profile.referralShared);
          return;
        } catch {
          // Intentional dismissal falls back to clipboard.
        }
      }

      if (copied) setNotice(t.profile.referralCopied);
      else setError(codeLabel);
    } catch (shareError) {
      console.error("Referral share failed:", shareError);
      setError(t.profile.referralFailed);
    } finally {
      setReferralBusy(false);
    }
  }, [currentUser, summary.referralCode, locale, t.profile]);

  return {
    currentUser,
    authLoading,
    summary,
    setSummary,
    creditBalance,
    setCreditBalance,
    loading,
    refresh,
    completion,
    membershipYear,
    roleLabel,
    membershipActive,
    shareReferral,
    referralBusy,
    notice,
    setNotice,
    error,
    setError,
  };
}

export type ProfileShellData = ReturnType<typeof useProfileShellData>;

function ProfileAvatar({
  src,
  name,
  completion,
}: {
  src?: string | null;
  name?: string | null;
  completion: number;
}) {
  const initials =
    (name || "Member")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "M";

  return (
    <div className="relative mx-auto h-[124px] w-[124px]">
      <div
        className="absolute inset-0 rounded-full p-[6px]"
        style={{
          background: `conic-gradient(#f47a4a 0deg ${completion * 3.6}deg, #e5e5e5 ${completion * 3.6}deg 360deg)`,
        }}
      >
        <div className="h-full w-full overflow-hidden rounded-full bg-[#d1d1d1] ring-[3px] ring-white">
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[28px] font-extrabold text-white">
              {initials}
            </div>
          )}
        </div>
      </div>
      <span className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 rounded-full bg-[#050505] px-3 py-1 text-[11px] font-extrabold leading-none text-white">
        {completion}%
      </span>
    </div>
  );
}

function SidebarNavItem({
  active,
  icon: Icon,
  children,
  onClick,
}: {
  active?: boolean;
  icon: ElementType;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-[12px] border-0 px-4 py-2 text-left text-[14px] text-[#050505] transition-colors ${
        active
          ? "bg-[#fff0e8] font-extrabold"
          : "bg-transparent font-semibold hover:bg-[#f8f8f8]"
      }`}
    >
      <Icon className={`h-[18px] w-[18px] flex-none ${active ? "text-[#f47a4a]" : "text-[#64748b]"}`} />
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRightIcon className={`h-[18px] w-[18px] flex-none ${active ? "text-[#f47a4a]" : "text-[#64748b]"}`} />
    </button>
  );
}

function MetricRing({
  value,
  unit,
  label,
  remaining,
  ratio,
}: {
  value: string | number;
  unit: string;
  label: string;
  remaining: number;
  ratio: number;
}) {
  const normalized = Math.max(0, Math.min(1, ratio));
  const color = metricColor(remaining, normalized);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div
        className="relative h-[78px] w-[78px] rounded-full p-[7px]"
        style={{
          background: `conic-gradient(${color} 0deg ${normalized * 360}deg, #e8e8e5 ${normalized * 360}deg 360deg)`,
        }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
          <strong className="text-[21px] font-extrabold leading-none text-[#050505]">{value}</strong>
          <span className="mt-1 text-[9px] font-medium text-[#64748b]">{unit}</span>
        </div>
      </div>
      <span className="text-center text-[11px] font-semibold text-[#050505]">{label}</span>
    </div>
  );
}

export function DesktopProfileShell({
  active,
  data,
  onSectionChange,
  avatarOverride,
  displayNameOverride,
  children,
}: {
  active: ProfileSection;
  data: ProfileShellData;
  onSectionChange: (section: ProfileSection) => void;
  avatarOverride?: string | null;
  displayNameOverride?: string | null;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const name = displayNameOverride ?? data.currentUser?.displayName ?? t.profile.memberFallback;
  const avatar = avatarOverride ?? data.currentUser?.photoURL ?? null;
  const paidEnd = paidPeriodEnd(data.summary);
  const subscriptionDays = data.summary.accountStatus === "leader" ? 0 : daysUntil(paidEnd);
  const subscriptionRatio = data.summary.accountStatus === "leader"
    ? 1
    : data.summary.hasActiveSubscription
      ? Math.min(1, subscriptionDays / 30)
      : 0;
  const subscriptionValue = data.summary.accountStatus === "leader" || !data.summary.hasActiveSubscription
    ? "—"
    : subscriptionDays;
  const subscriptionUnit = data.summary.accountStatus === "leader"
    ? t.profile.managed
    : data.summary.hasActiveSubscription
      ? t.profile.daysLeft
      : t.profile.inactive;
  const subscriptionRemaining = data.summary.accountStatus === "leader" || !data.summary.hasActiveSubscription
    ? 99
    : subscriptionDays;
  const creditRatio = Math.min(1, Math.max(0, data.creditBalance) / 5);

  return (
    <>
      {(data.notice || data.error) && (
        <div className="fixed left-1/2 top-[86px] z-[100] w-[min(92vw,520px)] -translate-x-1/2">
          <div
            className={`rounded-[14px] border border-[rgba(5,5,5,0.14)] px-4 py-3 text-[13px] font-semibold shadow-[0_6px_20px_rgba(5,5,5,0.08)] ${
              data.error ? "bg-[#fff1f2] text-[#b42331]" : "bg-white text-[#050505]"
            }`}
          >
            {data.error || data.notice}
          </div>
        </div>
      )}

      <div className="mx-auto hidden w-full max-w-page grid-cols-[288px_minmax(0,1fr)] items-start gap-6 px-gutter pb-16 pt-8 text-[#050505] lg:grid">
        <aside className="sticky top-[92px] self-start rounded-[20px] border-[1.5px] border-[#e6e6e6] bg-white p-[14px] shadow-[3px_3px_0_rgba(5,5,5,0.14)]">
          <div className="px-2 pt-3">
            <ProfileAvatar src={avatar} name={name} completion={data.completion} />
            <div className="mt-7 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <h1 className="m-0 text-[20px]! font-extrabold! leading-tight!">{name}</h1>
                <span className="rounded-full bg-[#050505] px-2.5 py-1 text-[10px] font-extrabold leading-none text-white">
                  {data.roleLabel}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSectionChange("edit")}
            className="mt-5 flex min-h-[72px] w-full items-center gap-3 rounded-[16px] border-2 border-[#050505] bg-white px-4 py-3 text-left shadow-[3px_3px_0_rgba(5,5,5,0.92)]"
          >
            <CheckCircleIcon className="h-[18px] w-[18px] flex-none text-[#050505]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-[#64748b]">{t.profile.profileStrength}</span>
              <strong className="mt-1 block text-[17px] font-extrabold text-[#050505]">{data.completion}% {t.profile.complete}</strong>
            </span>
            <ChevronRightIcon className="h-[18px] w-[18px] flex-none text-[#64748b]" />
          </button>

          <button
            type="button"
            onClick={() => void data.shareReferral()}
            disabled={data.referralBusy}
            className="mt-3 flex min-h-[72px] w-full items-center gap-3 rounded-[16px] border-2 border-[#050505] bg-white px-4 py-3 text-left shadow-[3px_3px_0_rgba(5,5,5,0.92)] transition-transform hover:-translate-y-px disabled:opacity-60"
          >
            <TicketIcon className="h-[18px] w-[18px] flex-none text-[#f47a4a]" />
            <span className="min-w-0 flex-1">
              <strong className="block text-[14px] font-extrabold text-[#050505]">{t.profile.shareReferralCode}</strong>
              <span className="mt-1 block text-[12px] text-[#2f2f2f]">{t.profile.inviteFriend}</span>
            </span>
            <ChevronRightIcon className="h-[18px] w-[18px] flex-none text-[#64748b]" />
          </button>

          <div className="mt-4 grid gap-1">
            <SidebarNavItem active={active === "edit"} icon={PencilSquareIcon} onClick={() => onSectionChange("edit")}>{t.profile.editProfile}</SidebarNavItem>
            <SidebarNavItem active={active === "connections"} icon={ChatBubbleLeftRightIcon} onClick={() => onSectionChange("connections")}>{t.profile.connections}</SidebarNavItem>
            <SidebarNavItem active={active === "account"} icon={CreditCardIcon} onClick={() => onSectionChange("account")}>{t.profile.accountMembership}</SidebarNavItem>
          </div>

          <div className="mt-7 px-1 pb-2">
            <p className="mb-3 text-[12px] font-semibold text-[#64748b]">{t.profile.membershipBalance}</p>
            <div className="flex items-start justify-between gap-3">
              <MetricRing
                value={subscriptionValue}
                unit={subscriptionUnit}
                label={t.profile.subscription}
                remaining={subscriptionRemaining}
                ratio={subscriptionRatio}
              />
              <MetricRing
                value={data.creditBalance}
                unit={t.profile.creditUnit}
                label={t.profile.credits}
                remaining={data.creditBalance}
                ratio={creditRatio}
              />
            </div>
          </div>
        </aside>

        <section className="self-start overflow-hidden rounded-[20px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white shadow-[0_2px_10px_rgba(5,5,5,0.035)]">
          {children}
        </section>
      </div>
    </>
  );
}

export function MobileProfileHub({
  data,
  onEdit,
  onSectionChange,
  avatarOverride,
  displayNameOverride,
}: {
  data: ProfileShellData;
  onEdit: () => void;
  onSectionChange: (section: ProfileSection) => void;
  avatarOverride?: string | null;
  displayNameOverride?: string | null;
}) {
  const { t } = useI18n();
  const name = displayNameOverride ?? data.currentUser?.displayName ?? t.profile.memberFallback;
  const avatar = avatarOverride ?? data.currentUser?.photoURL ?? null;

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-12 pt-5 text-[#050505] sm:px-6 lg:hidden">
      <h1 className="mb-6">{t.profile.profileTitle}</h1>

      <div className="flex items-center gap-4">
        <div className="origin-left scale-[0.76]">
          <ProfileAvatar src={avatar} name={name} completion={data.completion} />
        </div>
        <div className="ml-[-28px] min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 truncate text-[22px]! font-extrabold!">{name}</h2>
            <span className="rounded-full bg-[#050505] px-2.5 py-1 text-[10px] font-extrabold leading-none text-white">
              {data.roleLabel}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[#6c757d]">
            {data.membershipYear ? interpolate(t.profile.memberSince, { year: data.membershipYear }) : t.profile.memberFallback}
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 min-h-10 rounded-full bg-[#f47a4a] px-4 py-2 text-[13px] font-extrabold text-[#050505]"
          >
            {t.profile.completeProfile}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="mt-6 w-full rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white p-4 text-left shadow-[0_1px_0_rgba(5,5,5,0.03)]"
      >
        <span className="text-[12px] font-semibold text-[#6c757d]">{t.profile.profileStrength}</span>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <strong className="text-[22px] font-extrabold text-[#050505]">{data.completion}% {t.profile.complete}</strong>
          <ChevronRightIcon className="h-5 w-5 text-[#6c757d]" />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ececec]">
          <div className="h-full rounded-full bg-[#f47a4a]" style={{ width: `${data.completion}%` }} />
        </div>
      </button>

      <div className="mt-4 overflow-hidden rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white">
        <button type="button" onClick={onEdit} className="flex min-h-14 w-full items-center justify-between border-0 bg-white px-4 py-3 text-[14px] font-semibold text-[#050505]">
          {t.profile.editProfile} <ChevronRightIcon className="h-5 w-5 text-[#6c757d]" />
        </button>
        <div className="mx-4 h-px bg-[rgba(5,5,5,0.1)]" />
        <button type="button" onClick={() => onSectionChange("connections")} className="flex min-h-14 w-full items-center justify-between border-0 bg-white px-4 py-3 text-[14px] font-semibold text-[#050505]">
          {t.profile.connections} <ChevronRightIcon className="h-5 w-5 text-[#6c757d]" />
        </button>
      </div>

      <h2 className="mb-3 mt-8">{t.profile.membership}</h2>
      <div className="rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-[#fffaf6] p-4">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-[16px] font-extrabold text-[#050505]">{t.profile.oneCupMember}</strong>
          <span className="rounded-full bg-[#f47a4a] px-3 py-1.5 text-[11px] font-extrabold text-[#050505]">
            {data.membershipActive ? t.profile.active : t.profile.inactive}
          </span>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-[13px] text-[#6c757d]">
          <span>{t.profile.meetupCredits}</span>
          <strong className="text-[#050505]">{interpolate(t.profile.left, { count: data.creditBalance })}</strong>
        </div>
      </div>

      <button type="button" onClick={() => void data.shareReferral()} disabled={data.referralBusy} className="mt-4 flex min-h-14 w-full items-center justify-between rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4 py-3 text-[14px] font-semibold text-[#050505]">
        {t.profile.shareReferralCode} <ChevronRightIcon className="h-5 w-5 text-[#6c757d]" />
      </button>
      <button type="button" onClick={() => onSectionChange("account")} className="mt-3 flex min-h-14 w-full items-center justify-between rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4 py-3 text-[14px] font-semibold text-[#050505]">
        {t.profile.accountMembership} <ChevronRightIcon className="h-5 w-5 text-[#6c757d]" />
      </button>

      {(data.notice || data.error) && (
        <div className={`mt-4 rounded-[14px] border border-[rgba(5,5,5,0.14)] px-4 py-3 text-[13px] font-semibold ${data.error ? "bg-[#fff1f2] text-[#b42331]" : "bg-white text-[#050505]"}`}>
          {data.error || data.notice}
        </div>
      )}
    </main>
  );
}
