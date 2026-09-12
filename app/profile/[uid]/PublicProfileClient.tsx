"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { useAuth } from "../../lib/contexts/auth_context";
import {
  type ProfileConnection,
  toggleProfileLike,
} from "../../lib/features/profile/services/profile_connections";

interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  isPublic?: boolean;
  detailsVisible: boolean;
  connection: ProfileConnection;
  bio?: string;
  work?: string;
  school?: string;
  location?: string;
  interests?: string;
  profileDetails?: {
    nationality?: string;
    languages?: string[];
    englishLevel?: string;
    discussionTopics?: string[];
    meetupPreferences?: string;
  };
  badges: {
    gdgMember: boolean;
    activeMember: boolean;
    role: string | null;
  };
  stats: {
    meetupCount: number;
    speakingReports: number;
    averageSpeakingScore: number | null;
  };
  memberSince?: string | null;
}

type PillTone = "white" | "warm" | "muted" | "dark";

function Pill({
  children,
  tone = "white",
}: {
  children: React.ReactNode;
  tone?: PillTone;
}) {
  const toneClass = {
    white: "bg-white text-[#050505]",
    warm: "bg-[#fff0e8] text-[#050505]",
    muted: "border-[#e0e0e0] bg-[#f6f6f4] text-[#050505]",
    dark: "bg-[#050505] text-white",
  }[tone];

  return (
    <span
      className={`inline-flex min-h-[30px] items-center rounded-full border-[1.5px] border-[#050505] px-[0.7rem] py-[0.2rem] text-[0.72rem] font-[800] leading-none ${toneClass}`}
    >
      {children}
    </span>
  );
}

function MetricCard({
  value,
  label,
  description,
  tone = "white",
}: {
  value: string | number;
  label: string;
  description?: string;
  tone?: "white" | "warm" | "green" | "muted";
}) {
  const toneClass = {
    white: "bg-white",
    warm: "bg-[#fff0e8]",
    green: "bg-[#e0f5e5]",
    muted: "bg-[#f6f6f4]",
  }[tone];

  return (
    <div
      className={`rounded-[18px] border-[1.5px] border-[#050505] p-4 shadow-[3px_3px_0_rgba(5,5,5,0.9)] ${toneClass}`}
    >
      <div className="text-[1.75rem] font-[900] leading-none text-[#050505] max-[640px]:text-[1.45rem]">
        {value}
      </div>
      <div className="mt-2 text-[0.72rem] font-[850] text-[#050505]">
        {label}
      </div>
      {description && (
        <div className="mt-1 text-[0.66rem] leading-[1.35] text-[#64748b]">
          {description}
        </div>
      )}
    </div>
  );
}

const toChips = (value?: string): string[] =>
  (value || "")
    .split(/[,/·|]/)
    .map((item) => item.trim())
    .filter(Boolean);

function firstSentence(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.split(/(?<=[.!?。])\s/)[0] || trimmed;
}

export default function PublicProfileClient({ uid }: { uid: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const copy =
    locale === "ko"
      ? {
          activeMember: "활동 멤버",
          member: "1 Cup 멤버",
          meetups: "회 밋업",
          connect: "연결하기",
          connectBack: "연결하기",
          requestSent: "연결 요청 보냄",
          connected: "연결됨",
          editProfile: "프로필 편집",
          share: "프로필 공유",
          copied: "프로필 링크를 복사했어요.",
          shareFailed: "프로필을 공유하지 못했습니다.",
          detailsRicher: "연결하면 더 많은 프로필 정보가 보여요",
          defaultTagline: "1 Cup에서 좋은 대화를 나누고 싶은 멤버입니다.",
          conversationFuel: "대화 시작점",
          askMeAbout: "이런 얘기 좋아해요…",
          conversationBody: "관심 있는 주제 하나를 골라 바로 대화를 시작해 보세요.",
          conversationPrompt: "하나 골라서 제 생각에 반박해 보세요.",
          unlockTitle: "연결하면 대화 주제를 볼 수 있어요",
          unlockBody: "서로 연결되면 이 멤버가 공개한 관심사와 자기소개를 확인할 수 있어요.",
          atOneCup: "1 Cup에서",
          atOneCupTitle: "빈 프로필 이상의 정보",
          atOneCupBody: "누구를 만나게 될지 감을 잡을 정도의 활동 정보만 보여드려요.",
          meetupLabel: "밋업",
          meetupDescription: "참여",
          sparkLabel: "Spark 평균",
          sparkDescription: "대화 점수",
          reportsLabel: "리포트",
          reportsDescription: "말하기 리포트",
          memberSince: "가입",
          moreContext: "조금 더 알아보기",
          aboutTitle: "이력서가 아니라, 알아볼 만큼만.",
          work: "직장",
          education: "학교",
          languagePlace: "언어 · 활동 지역",
          noDetails: "연결 후 직장, 학교, 언어, 지역 등 프로필 상세 정보가 표시됩니다.",
          ownerContext: "내 공개 프로필",
        }
      : {
          activeMember: "ACTIVE MEMBER",
          member: "1 CUP MEMBER",
          meetups: "MEETUPS",
          connect: "Connect",
          connectBack: "Connect back",
          requestSent: "Request sent",
          connected: "Connected",
          editProfile: "Edit profile",
          share: "Share profile",
          copied: "Profile link copied.",
          shareFailed: "Could not share this profile.",
          detailsRicher: "details become richer once you connect",
          defaultTagline: "A 1 Cup member who is here for thoughtful conversations.",
          conversationFuel: "CONVERSATION FUEL",
          askMeAbout: "Ask me about…",
          conversationBody:
            "Topics this member chose because they actually enjoy talking about them.",
          conversationPrompt:
            "The fastest way to start: pick one topic and challenge my take.",
          unlockTitle: "Connect to unlock conversation starters",
          unlockBody:
            "Mutual connections can see the interests and profile details this member chose to share.",
          atOneCup: "AT 1 CUP",
          atOneCupTitle: "Not just a blank profile.",
          atOneCupBody:
            "A little activity context helps people know who they are meeting.",
          meetupLabel: "Meetups",
          meetupDescription: "attended",
          sparkLabel: "Spark avg",
          sparkDescription: "conversation score",
          reportsLabel: "Reports",
          reportsDescription: "speaking reports",
          memberSince: "Member since",
          moreContext: "A LITTLE MORE CONTEXT",
          aboutTitle: "Enough to recognize the person — not a résumé.",
          work: "WORK",
          education: "EDUCATION",
          languagePlace: "LANGUAGE & PLACE",
          noDetails:
            "Work, education, language, and location context appears after you connect.",
          ownerContext: "Your public profile",
        };

  const loadProfile = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/public-profile/${encodeURIComponent(uid)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || t.profile.loadError);
      }
      setProfile(payload);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.profile.loadError);
    }
  }, [t.profile.loadError, uid]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (error) {
    return (
      <div className="px-4 py-16 text-center font-bold text-[rgba(5,5,5,0.6)]">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="px-4 py-16 text-center font-bold text-[rgba(5,5,5,0.6)]">
        {t.profile.loading}
      </div>
    );
  }

  const isOwner = currentUser?.uid === profile.uid;
  const structuredTopics = profile.profileDetails?.discussionTopics || [];
  const interestChips = (
    structuredTopics.length > 0 ? structuredTopics : toChips(profile.interests)
  ).slice(0, 5);
  const languages = profile.profileDetails?.languages || [];
  const englishLevel = profile.profileDetails?.englishLevel?.trim() || "";
  const languageSummary = languages
    .map((language) =>
      language === "English" && englishLevel
        ? `${language} (${englishLevel})`
        : language,
    )
    .join(" · ");
  const nationality = profile.profileDetails?.nationality?.trim() || "";
  const memberSince = profile.memberSince ? new Date(profile.memberSince) : null;
  const memberSinceLabel = memberSince
    ? memberSince.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
        year: "numeric",
        month: "short",
      })
    : "—";
  const memberSinceYear = memberSince ? memberSince.getFullYear() : null;
  const heroTagline =
    profile.detailsVisible && profile.bio
      ? firstSentence(profile.bio)
      : copy.defaultTagline;
  const heroMeta = profile.detailsVisible
    ? [profile.work, profile.school, profile.location].filter(Boolean)
    : [];
  const hasAbout = Boolean(
    profile.work || profile.school || profile.location || languageSummary,
  );
  const averageScore =
    profile.stats.averageSpeakingScore != null
      ? profile.stats.averageSpeakingScore.toFixed(1)
      : "—";

  const connectLabel = isOwner
    ? copy.editProfile
    : profile.connection.isMutual
      ? copy.connected
      : profile.connection.likesMe
        ? copy.connectBack
        : profile.connection.likedByMe
          ? copy.requestSent
          : copy.connect;

  const handleToggleLike = async () => {
    if (!currentUser) {
      router.push(`/auth?redirect=${encodeURIComponent(`/profile/${profile.uid}`)}`);
      return;
    }

    setIsUpdatingLike(true);
    setActionMessage("");
    try {
      const connection = await toggleProfileLike(profile.uid);
      setProfile((current) =>
        current ? { ...current, connection } : current,
      );
      await loadProfile();
    } catch {
      setActionMessage(t.profile.likeFailed);
    } finally {
      setIsUpdatingLike(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (isOwner) {
      router.push("/profile");
      return;
    }
    if (profile.connection.isMutual) {
      router.push("/profile/connections");
      return;
    }
    await handleToggleLike();
  };

  const handleShare = async () => {
    setActionMessage("");
    const url = `${window.location.origin}/profile/${encodeURIComponent(profile.uid)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile.displayName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setActionMessage(copy.copied);
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return;
      }
      setActionMessage(copy.shareFailed);
    }
  };

  const contextSummary = profile.detailsVisible
    ? locale === "ko"
      ? [
          profile.work ? `${profile.work}에서 일하고 있습니다` : "",
          profile.school ? `${profile.school}에서 공부했습니다` : "",
          profile.location ? `${profile.location}을 기반으로 활동합니다` : "",
          languageSummary ? `${languageSummary}로 대화할 수 있습니다` : "",
        ]
          .filter(Boolean)
          .join(". ") + (hasAbout ? "." : "")
      : [
          profile.work ? `Works at ${profile.work}` : "",
          profile.school ? `Studied at ${profile.school}` : "",
          profile.location ? `Based in ${profile.location}` : "",
          languageSummary ? `Speaks ${languageSummary}` : "",
        ]
          .filter(Boolean)
          .join(". ") + (hasAbout ? "." : "")
    : copy.noDetails;

  return (
    <main className="mx-auto w-full max-w-[1040px] px-4 pb-28 pt-5 text-[#050505] md:px-5 md:pb-16 md:pt-10">
      <section className="grid overflow-hidden rounded-[26px] border-2 border-[#050505] bg-white shadow-[6px_6px_0_rgba(5,5,5,0.16)] md:grid-cols-[36.8%_1fr]">
        <div className="relative bg-[#f47a4a] p-3 md:p-5">
          <div className="relative aspect-[330/236] overflow-hidden rounded-[18px] border-[1.5px] border-[#050505] bg-[#c7c7c7] md:aspect-auto md:h-[366px] md:rounded-[20px] md:border-2">
            <img
              className="h-full w-full object-cover"
              src={profile.photoURL || "/images/default_user.jpg"}
              alt={profile.displayName}
            />
            <div className="absolute bottom-3 left-3 right-3 hidden rounded-[16px] bg-[rgba(5,5,5,0.94)] px-4 py-2.5 text-white md:block">
              <div className="text-[0.72rem] font-[900] uppercase tracking-[0.04em]">
                {locale === "ko" ? `${profile.displayName} 만나기` : `Meet ${profile.displayName}`}
              </div>
              <div className="mt-0.5 text-[0.72rem] font-medium text-[#ebebeb]">
                {copy.member}
                {profile.detailsVisible && profile.location
                  ? ` · ${profile.location}`
                  : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#f47a4a] px-5 pb-5 md:bg-white md:px-8 md:py-8">
          <div className="flex flex-wrap gap-2">
            {profile.badges.activeMember && (
              <Pill tone="warm">{copy.activeMember}</Pill>
            )}
            <Pill>{`${profile.stats.meetupCount} ${copy.meetups}`}</Pill>
            {profile.badges.role && (
              <Pill tone="dark">{profile.badges.role.toUpperCase()}</Pill>
            )}
          </div>

          <h1 className="mt-3 text-[2rem] font-[900] leading-[1.05] md:mt-5 md:text-[3rem] md:leading-[1.08]">
            {profile.displayName}
          </h1>
          <p className="mt-1.5 max-w-[34rem] text-[0.82rem] font-medium leading-[1.45] md:mt-2 md:text-[1.18rem] md:leading-[1.45]">
            {heroTagline}
          </p>

          {heroMeta.length > 0 && (
            <p className="mt-5 hidden text-[0.86rem] font-[700] text-[#64748b] md:block">
              {heroMeta.join("  ·  ")}
            </p>
          )}

          <div className="mt-4 hidden flex-wrap gap-2 md:flex">
            {profile.detailsVisible && nationality && (
              <Pill tone="muted">{nationality.toUpperCase()}</Pill>
            )}
            {profile.detailsVisible && languageSummary && (
              <Pill tone="muted">{languageSummary.toUpperCase()}</Pill>
            )}
            {memberSinceYear && (
              <Pill tone="muted">
                {locale === "ko"
                  ? `${memberSinceYear}년 가입`
                  : `MEMBER SINCE ${memberSinceYear}`}
              </Pill>
            )}
            {profile.badges.gdgMember && <Pill tone="muted">GDG</Pill>}
          </div>

          <div className="mt-6 hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={() => void handlePrimaryAction()}
              disabled={isUpdatingLike}
              className="min-w-[214px] cursor-pointer rounded-full border-2 border-[#050505] bg-[#050505] px-7 py-3 text-[0.94rem] font-[900] text-white shadow-[4px_4px_0_#f47a4a] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] disabled:cursor-wait disabled:opacity-60"
            >
              {isUpdatingLike ? t.profile.likingMember : connectLabel}
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="cursor-pointer rounded-full border-2 border-[#050505] bg-white px-7 py-3 text-[0.88rem] font-[800] text-[#050505] transition-colors hover:bg-[#f6f6f4]"
            >
              {copy.share}
            </button>
          </div>

          <div className="mt-3 hidden text-[0.74rem] text-[#64748b] md:block">
            {isOwner
              ? copy.ownerContext
              : profile.connection.isMutual
                ? copy.connected
                : copy.detailsRicher}
          </div>
        </div>
      </section>

      <div className="mt-4 md:hidden">
        <button
          type="button"
          onClick={() => void handlePrimaryAction()}
          disabled={isUpdatingLike}
          className="w-full cursor-pointer rounded-full border-2 border-[#050505] bg-[#050505] px-6 py-3.5 text-[0.94rem] font-[900] text-white shadow-[4px_4px_0_#f47a4a] disabled:cursor-wait disabled:opacity-60"
        >
          {isUpdatingLike ? t.profile.likingMember : connectLabel}
        </button>
        <div className="mt-3 text-center text-[0.72rem] font-medium text-[#64748b]">
          {profile.connection.isMutual
            ? copy.connected
            : `${copy.detailsRicher}${memberSince ? ` · ${copy.memberSince} ${memberSinceLabel}` : ""}`}
        </div>
      </div>

      {actionMessage && (
        <p
          aria-live="polite"
          className="mt-3 text-center text-[0.76rem] font-[650] text-[#64748b]"
        >
          {actionMessage}
        </p>
      )}

      <div className="mt-8 grid gap-6 md:mt-9 md:grid-cols-[minmax(0,1.77fr)_minmax(300px,1fr)] md:gap-[30px]">
        <section className="rounded-[24px] border-2 border-[#050505] bg-[#f47a4a] p-5 shadow-[5px_5px_0_rgba(5,5,5,0.9)] md:p-[26px]">
          <div className="text-[0.7rem] font-[900] uppercase tracking-[0.03em]">
            {copy.conversationFuel}
          </div>
          <h2 className="mt-2 text-[1.75rem] font-[900] leading-[1.15] md:text-[2.15rem]">
            {profile.detailsVisible ? copy.askMeAbout : copy.unlockTitle}
          </h2>
          <p className="mt-2 max-w-[35rem] text-[0.82rem] font-medium leading-[1.45] md:text-[0.9rem]">
            {profile.detailsVisible ? copy.conversationBody : copy.unlockBody}
          </p>

          {profile.detailsVisible && interestChips.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {interestChips.map((chip, index) => (
                <Pill key={chip} tone={index % 2 === 1 ? "warm" : "white"}>
                  {chip}
                </Pill>
              ))}
            </div>
          ) : profile.detailsVisible ? (
            <div className="mt-5 text-[0.78rem] font-[700] text-[rgba(5,5,5,0.7)]">
              {locale === "ko"
                ? "아직 대화 주제를 추가하지 않았어요."
                : "No conversation topics added yet."}
            </div>
          ) : null}

          <div className="mt-6 rounded-[16px] border-[1.5px] border-[#050505] bg-white px-4 py-3.5 text-[0.84rem] font-[800] leading-[1.45] md:px-5 md:text-[0.88rem]">
            <span className="mr-2 text-[1.7rem] font-[900] leading-none text-[#f47a4a]">
              “
            </span>
            {profile.detailsVisible ? copy.conversationPrompt : copy.unlockBody}
          </div>
        </section>

        <section className="rounded-[24px] border-2 border-[#050505] bg-white p-0 shadow-none md:p-[22px] md:shadow-[5px_5px_0_rgba(5,5,5,0.15)] max-md:border-0 max-md:bg-transparent">
          <div className="text-[0.7rem] font-[900] uppercase tracking-[0.03em] text-[#f47a4a]">
            {copy.atOneCup}
          </div>
          <h2 className="mt-2 text-[1.35rem] font-[900] leading-[1.2] md:text-[1.5rem]">
            {copy.atOneCupTitle}
          </h2>
          <p className="mt-2 text-[0.78rem] leading-[1.45] text-[#64748b] md:text-[0.82rem]">
            {copy.atOneCupBody}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCard
              value={profile.stats.meetupCount}
              label={copy.meetupLabel}
              description={copy.meetupDescription}
              tone="warm"
            />
            <MetricCard
              value={averageScore}
              label={copy.sparkLabel}
              description={copy.sparkDescription}
              tone="green"
            />
            <MetricCard
              value={profile.stats.speakingReports}
              label={copy.reportsLabel}
              description={copy.reportsDescription}
              tone="muted"
            />
            <MetricCard
              value={memberSinceLabel.toUpperCase()}
              label={copy.memberSince}
              tone="white"
            />
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-[24px] border-2 border-[#050505] bg-white p-5 shadow-[5px_5px_0_rgba(5,5,5,0.14)] md:mt-9 md:p-6">
        <div className="text-[0.68rem] font-[900] uppercase tracking-[0.03em] text-[#f47a4a]">
          {copy.moreContext}
        </div>
        <h2 className="mt-2 max-w-[40rem] text-[1.45rem] font-[900] leading-[1.2] md:text-[1.65rem]">
          {copy.aboutTitle}
        </h2>
        <p className="mt-3 max-w-[42rem] text-[0.84rem] leading-[1.55] text-[#2b2b2b] md:text-[0.94rem]">
          {contextSummary || copy.noDetails}
        </p>

        {profile.detailsVisible && hasAbout && (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {profile.work && (
              <div className="rounded-[16px] bg-[#fff0e8] px-4 py-3.5">
                <div className="text-[0.62rem] font-[900] text-[#64748b]">
                  {copy.work}
                </div>
                <div className="mt-1 text-[0.84rem] font-[800]">
                  {profile.work}
                </div>
              </div>
            )}
            {profile.school && (
              <div className="rounded-[16px] bg-[#f6f6f4] px-4 py-3.5">
                <div className="text-[0.62rem] font-[900] text-[#64748b]">
                  {copy.education}
                </div>
                <div className="mt-1 text-[0.84rem] font-[800]">
                  {profile.school}
                </div>
              </div>
            )}
            {(languageSummary || profile.location) && (
              <div className="rounded-[16px] bg-[#e0f5e5] px-4 py-3.5">
                <div className="text-[0.62rem] font-[900] text-[#64748b]">
                  {copy.languagePlace}
                </div>
                <div className="mt-1 text-[0.84rem] font-[800]">
                  {[languageSummary, profile.location].filter(Boolean).join(" · ")}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 z-[80] border-t border-[#e0e0e0] bg-white px-4 pb-[calc(0.45rem_+_env(safe-area-inset-bottom))] pt-2 md:hidden">
          <button
            type="button"
            onClick={() => void handlePrimaryAction()}
            disabled={isUpdatingLike}
            className="w-full rounded-full bg-[#050505] px-5 py-3 text-[0.82rem] font-[900] text-white disabled:opacity-60"
          >
            {isUpdatingLike
              ? t.profile.likingMember
              : profile.connection.isMutual
                ? copy.connected
                : `${copy.connect} ${profile.displayName}`}
          </button>
        </div>
      )}
    </main>
  );
}
