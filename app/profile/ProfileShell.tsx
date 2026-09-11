"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../lib/contexts/auth_context";
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
      setError("Unable to load your profile. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

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
  const membershipActive =
    summary.hasActiveSubscription || summary.gdgMember || summary.accountStatus === "leader";

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
      const text = `영어 한잔 추천 코드: ${code}\n${url}`;
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
                title: "영어 한잔 추천 코드",
                description: `코드: ${code}`,
                imageUrl: "https://1cupenglish.com/images/logos/1cup_logo_new.svg",
                link: { mobileWebUrl: url, webUrl: url },
              },
              buttons: [
                {
                  title: "바로 사용하기",
                  link: { mobileWebUrl: url, webUrl: url },
                },
              ],
            });
            setNotice(
              copied
                ? "카카오톡 공유 창을 열었습니다. 추천 코드도 클립보드에 복사했습니다."
                : "카카오톡 공유 창을 열었습니다.",
            );
            return;
          }
        } catch (kakaoError) {
          console.error("Kakao share unavailable:", kakaoError);
        }
      }

      if (navigator.share) {
        try {
          await navigator.share({ title: "1 Cup English", text, url });
          setNotice("추천 코드를 공유했습니다.");
          return;
        } catch {
          // Intentional dismissal falls back to clipboard.
        }
      }

      if (copied) setNotice("추천 코드가 클립보드에 복사되었습니다.");
      else setError(`추천 코드: ${code}`);
    } catch (shareError) {
      console.error("Referral share failed:", shareError);
      setError("추천 코드를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setReferralBusy(false);
    }
  }, [currentUser, summary.referralCode]);

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
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center justify-between rounded-[14px] border-0 px-3 py-2 text-left text-[14px] text-[#050505] transition-colors ${
        active
          ? "bg-[#fff0e8] font-extrabold"
          : "bg-transparent font-semibold hover:bg-[#f8f8f8]"
      }`}
    >
      <span>{children}</span>
      <span className="text-[22px] font-normal leading-none text-[#6c757d]">›</span>
    </button>
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
  const name = displayNameOverride ?? data.currentUser?.displayName ?? "Member";
  const avatar = avatarOverride ?? data.currentUser?.photoURL ?? null;

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
        <aside className="sticky top-[92px] self-start rounded-[20px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white p-6 shadow-[0_2px_10px_rgba(5,5,5,0.035)]">
          <ProfileAvatar src={avatar} name={name} completion={data.completion} />

          <div className="mt-7 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <h1 className="m-0 text-[20px]! font-extrabold! leading-tight!">{name}</h1>
              <span className="rounded-full bg-[#050505] px-2.5 py-1 text-[11px] font-extrabold leading-none text-white">
                {data.roleLabel}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-[#6c757d]">
              {data.membershipYear ? `Member since ${data.membershipYear}` : "1 Cup member"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSectionChange("edit")}
            className="mt-8 flex min-h-[68px] w-full items-center justify-between rounded-[16px] border-0 bg-[#fff0e8] px-4 py-3 text-left"
          >
            <span>
              <span className="block text-[12px] font-semibold text-[#6c757d]">Profile strength</span>
              <strong className="mt-1 block text-[17px] font-extrabold text-[#050505]">{data.completion}% complete</strong>
            </span>
            <span className="text-[22px] text-[#6c757d]">›</span>
          </button>

          <div className="mt-2 grid gap-1">
            <SidebarNavItem active={active === "edit"} onClick={() => onSectionChange("edit")}>Edit profile</SidebarNavItem>
            <SidebarNavItem active={active === "connections"} onClick={() => onSectionChange("connections")}>Connections</SidebarNavItem>
            <SidebarNavItem active={active === "account"} onClick={() => onSectionChange("account")}>Account & Membership</SidebarNavItem>
          </div>

          <button
            type="button"
            onClick={() => void data.shareReferral()}
            disabled={data.referralBusy}
            className="mt-6 flex min-h-[72px] w-full items-center justify-between rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4 py-3 text-left transition-[background-color,border-color] hover:border-[rgba(5,5,5,0.22)] hover:bg-[#fffaf6] disabled:opacity-60"
          >
            <span>
              <strong className="block text-[14px] font-extrabold text-[#050505]">Share referral code</strong>
              <span className="mt-1 block text-[12px] text-[#6c757d]">Invite a friend to 1 Cup</span>
            </span>
            <span className="text-[22px] text-[#6c757d]">›</span>
          </button>

          <div className="mt-4 rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-[#fffaf6] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[12px] font-semibold text-[#6c757d]">Membership</span>
                <strong className="mt-1.5 block text-[16px] font-extrabold text-[#050505]">1 Cup Member</strong>
              </div>
              <span className="shrink-0 rounded-full bg-[#f47a4a] px-3 py-1.5 text-[11px] font-extrabold leading-none text-[#050505]">
                {data.membershipActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-2.5 text-[13px] text-[#6c757d]">{data.creditBalance} meetup credits left</p>
            {data.membershipYear && (
              <p className="mt-1 text-[12px] text-[#6c757d]">Member since {data.membershipYear}</p>
            )}
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
  const name = displayNameOverride ?? data.currentUser?.displayName ?? "Member";
  const avatar = avatarOverride ?? data.currentUser?.photoURL ?? null;

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-12 pt-5 text-[#050505] sm:px-6 lg:hidden">
      <h1 className="mb-6">Profile</h1>

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
            {data.membershipYear ? `Member since ${data.membershipYear}` : "1 Cup member"}
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 min-h-10 rounded-full bg-[#f47a4a] px-4 py-2 text-[13px] font-extrabold text-[#050505]"
          >
            Complete profile
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="mt-6 w-full rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white p-4 text-left shadow-[0_1px_0_rgba(5,5,5,0.03)]"
      >
        <span className="text-[12px] font-semibold text-[#6c757d]">Profile strength</span>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <strong className="text-[22px] font-extrabold text-[#050505]">{data.completion}% complete</strong>
          <span className="text-[24px] text-[#6c757d]">›</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ececec]">
          <div className="h-full rounded-full bg-[#f47a4a]" style={{ width: `${data.completion}%` }} />
        </div>
      </button>

      <div className="mt-4 overflow-hidden rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white">
        <button type="button" onClick={onEdit} className="flex min-h-14 w-full items-center justify-between border-0 bg-white px-4 py-3 text-[14px] font-semibold text-[#050505]">
          Edit profile <span className="text-[22px] text-[#6c757d]">›</span>
        </button>
        <div className="mx-4 h-px bg-[rgba(5,5,5,0.1)]" />
        <button type="button" onClick={() => onSectionChange("connections")} className="flex min-h-14 w-full items-center justify-between border-0 bg-white px-4 py-3 text-[14px] font-semibold text-[#050505]">
          Connections <span className="text-[22px] text-[#6c757d]">›</span>
        </button>
      </div>

      <h2 className="mb-3 mt-8">Membership</h2>
      <div className="rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-[#fffaf6] p-4">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-[16px] font-extrabold text-[#050505]">1 Cup Member</strong>
          <span className="rounded-full bg-[#f47a4a] px-3 py-1.5 text-[11px] font-extrabold text-[#050505]">
            {data.membershipActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="mt-3 flex justify-between gap-3 text-[13px] text-[#6c757d]">
          <span>Meetup credits</span>
          <strong className="text-[#050505]">{data.creditBalance} left</strong>
        </div>
      </div>

      <button type="button" onClick={() => void data.shareReferral()} disabled={data.referralBusy} className="mt-4 flex min-h-14 w-full items-center justify-between rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4 py-3 text-[14px] font-semibold text-[#050505]">
        Share referral code <span className="text-[22px] text-[#6c757d]">›</span>
      </button>
      <button type="button" onClick={() => onSectionChange("account")} className="mt-3 flex min-h-14 w-full items-center justify-between rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4 py-3 text-[14px] font-semibold text-[#050505]">
        Account & Membership <span className="text-[22px] text-[#6c757d]">›</span>
      </button>

      {(data.notice || data.error) && (
        <div className={`mt-4 rounded-[14px] border border-[rgba(5,5,5,0.14)] px-4 py-3 text-[13px] font-semibold ${data.error ? "bg-[#fff1f2] text-[#b42331]" : "bg-white text-[#050505]"}`}>
          {data.error || data.notice}
        </div>
      )}
    </main>
  );
}
