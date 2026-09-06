"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  HeartIcon,
  LinkIcon,
  MapPinIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { useAuth } from "../../lib/contexts/auth_context";
import {
  type ProfileConnection,
  toggleProfileLike,
} from "../../lib/features/profile/services/profile_connections";
import { shareMatchedProfileViaKakao } from "../../lib/features/profile/services/kakao_profile_share";

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

const actionButtonClass =
  "cursor-pointer rounded-[10px] border-2 border-[#050505] px-[0.8rem] py-2 text-[0.84rem] font-[900] shadow-[2px_2px_0_rgba(5,5,5,0.9)] hover:enabled:[transform:translate(1px,1px)] hover:enabled:shadow-[1px_1px_0_rgba(5,5,5,0.9)] disabled:cursor-wait disabled:opacity-70";

const cardClass =
  "rounded-[14px] border-2 border-[#050505] bg-white px-[1.2rem] py-[1.15rem] shadow-[4px_4px_0_rgba(5,5,5,0.9)]";

function Pill({
  $variant,
  children,
}: {
  $variant?: "orange" | "dark" | "plain";
  children: React.ReactNode;
}) {
  const variantClass =
    $variant === "dark"
      ? "bg-[#050505] text-white"
      : $variant === "orange"
        ? "bg-[#f47a4a] text-[#050505]"
        : "bg-white text-[#050505]";
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-[#050505] px-[0.6rem] py-[0.18rem] text-[0.66rem] font-[900] uppercase tracking-[0.04em] ${variantClass}`}
    >
      {children}
    </span>
  );
}

function MessageButton({
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${actionButtonClass} bg-[#f47a4a] text-[#050505] ${className}`}
      {...rest}
    />
  );
}

function LikeButton({
  $active,
  $mutual,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  $active?: boolean;
  $mutual?: boolean;
}) {
  const colorClass = $mutual
    ? "bg-[#050505] text-white"
    : $active
      ? "bg-[#fff0e8] text-[#050505]"
      : "bg-white text-[#050505]";
  const fillClass = $active ? "[&_svg]:fill-[currentColor]" : "[&_svg]:fill-none";
  return (
    <button
      className={`${actionButtonClass} ${colorClass} ${fillClass} [&_svg]:h-[17px] [&_svg]:w-[17px] ${className}`}
      {...rest}
    />
  );
}

function KakaoButton({
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${actionButtonClass} bg-[#fee500] text-[#050505] [&_svg]:h-[17px] [&_svg]:w-[17px] ${className}`}
      {...rest}
    />
  );
}

function ConnectionHint({
  children,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className="mx-0 mb-0 mt-[0.1rem] w-full text-[0.78rem] font-[650] leading-[1.45] text-[rgba(5,5,5,0.62)] max-[640px]:text-center"
      {...rest}
    >
      {children}
    </p>
  );
}

function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border-2 border-[#050505] bg-white px-[0.9rem] py-4 text-center shadow-[3px_3px_0_rgba(5,5,5,0.9)]">
      {children}
    </div>
  );
}

function StatValue({
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="text-[1.3rem] font-[900] leading-[1.1] text-[#050505]"
      {...rest}
    >
      {children}
    </div>
  );
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[0.35rem] text-[0.64rem] font-[800] uppercase tracking-[0.05em] text-[rgba(5,5,5,0.55)]">
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mx-0 mb-[0.7rem] mt-0 text-[0.68rem] font-[900] uppercase tracking-[0.07em] text-[rgba(5,5,5,0.55)]">
      {children}
    </h2>
  );
}

function CardHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mx-0 mb-[0.7rem] mt-0 inline-flex items-center gap-[0.4rem] text-[1.05rem] font-[900] text-[#050505] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:text-[#f47a4a]">
      {children}
    </h2>
  );
}

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-[0.92rem] leading-[1.65] text-[rgba(5,5,5,0.78)]">
      {children}
    </p>
  );
}

function Detail({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[0.55rem] flex items-center gap-2 text-[0.9rem] font-semibold text-[#050505] first-of-type:mt-0 [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:flex-none [&_svg]:text-[#f47a4a]">
      {children}
    </div>
  );
}

const toChips = (value?: string): string[] =>
  (value || "")
    .split(/[,/·|]/)
    .map((s) => s.trim())
    .filter(Boolean);

export default function PublicProfileClient({ uid }: { uid: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [likeError, setLikeError] = useState("");
  const [shareMessage, setShareMessage] = useState("");

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

  if (error)
    return (
      <div className="px-4 py-16 text-center font-bold text-[rgba(5,5,5,0.6)]">
        {error}
      </div>
    );
  if (!profile)
    return (
      <div className="px-4 py-16 text-center font-bold text-[rgba(5,5,5,0.6)]">
        {t.profile.loading}
      </div>
    );

  const interestChips = toChips(profile.interests);
  const memberSinceLabel = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString(
        locale === "ko" ? "ko-KR" : "en-US",
        { year: "numeric", month: "short" }
      )
    : "—";
  const hasAbout = profile.work || profile.school || profile.location;

  const handleToggleLike = async () => {
    if (!currentUser) {
      router.push(`/auth?redirect=${encodeURIComponent(`/profile/${profile.uid}`)}`);
      return;
    }

    setIsUpdatingLike(true);
    setLikeError("");
    try {
      const connection = await toggleProfileLike(profile.uid);
      setProfile((current) =>
        current ? { ...current, connection } : current,
      );
      await loadProfile();
    } catch {
      setLikeError(t.profile.likeFailed);
    } finally {
      setIsUpdatingLike(false);
    }
  };

  const handleKakaoShare = async () => {
    setShareMessage("");
    const shareText = `${profile.displayName}\nhttps://1cupenglish.com/profile/${encodeURIComponent(profile.uid)}`;
    try {
      const shared = await shareMatchedProfileViaKakao({
        uid: profile.uid,
        displayName: profile.displayName,
        locale,
      });
      if (shared) {
        setShareMessage(t.profile.kakaoShareOpened);
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setShareMessage(t.profile.kakaoShareCopied);
    } catch {
      setShareMessage(t.profile.kakaoShareFailed);
    }
  };

  const likeLabel = profile.connection.isMutual
    ? t.profile.mutualFriend
    : profile.connection.likesMe
      ? t.profile.likeBack
      : profile.connection.likedByMe
        ? t.profile.likedMember
        : t.profile.likeMember;
  const connectionHint = profile.connection.isMutual
    ? t.profile.mutualConnectionHint
    : profile.connection.likesMe
      ? t.profile.likesYouHint
      : profile.connection.likedByMe
        ? t.profile.likeSentHint
        : "";

  return (
    <main className="mx-auto w-full max-w-[860px] bg-transparent px-5 pb-16 max-[640px]:px-4 max-[640px]:pb-12">
      <section className="mb-5 flex items-center gap-7 max-[640px]:flex-col max-[640px]:gap-4 max-[640px]:text-center">
        <img
          className="h-[132px] w-[132px] flex-none rounded-full border-[3px] border-[#050505] bg-[#f3f3f1] object-cover shadow-[5px_5px_0_rgba(5,5,5,0.9)] max-[640px]:h-[110px] max-[640px]:w-[110px]"
          src={profile.photoURL || "/images/default_user.jpg"}
          alt={profile.displayName}
        />
        <div className="min-w-0">
          <div className="mb-[0.55rem] flex flex-wrap gap-[0.4rem] max-[640px]:justify-center">
            {(profile.badges.activeMember || profile.badges.role) && (
              <Pill $variant="orange">{t.profile.verified}</Pill>
            )}
            {profile.badges.activeMember && (
              <Pill $variant="dark">{t.profile.activeMember}</Pill>
            )}
            {profile.badges.role && <Pill>{profile.badges.role}</Pill>}
          </div>
          <h1 className="m-0 text-[2rem] font-[900] leading-[1.1] text-[#050505] max-[640px]:text-[1.7rem]">
            {profile.displayName}
          </h1>
          <p className="mx-0 mb-0 mt-[0.4rem] text-[1rem] italic leading-[1.4] text-[rgba(5,5,5,0.6)]">
            {profile.bio
              ? `“${profile.bio.split(/(?<=[.!?。])\s/)[0]}”`
              : `“${t.profile.taglineDefault}”`}
          </p>
          {currentUser?.uid !== profile.uid && (
            <div className="mt-[0.9rem] flex flex-wrap gap-[0.55rem] max-[640px]:justify-center">
              <LikeButton
                type="button"
                onClick={() => void handleToggleLike()}
                disabled={isUpdatingLike}
                $active={profile.connection.likedByMe}
                $mutual={profile.connection.isMutual}
                aria-pressed={profile.connection.likedByMe}
              >
                <HeartIcon />
                {isUpdatingLike ? t.profile.likingMember : likeLabel}
              </LikeButton>
              {profile.connection.isMutual && (
                <>
                  <KakaoButton type="button" onClick={() => void handleKakaoShare()}>
                    <LinkIcon />
                    {t.profile.kakaoMessage}
                  </KakaoButton>
                  <MessageButton type="button" onClick={() => router.push("/profile/connections")}>
                    <UserGroupIcon />
                    {t.profile.viewConnections}
                  </MessageButton>
                </>
              )}
              {connectionHint && <ConnectionHint>{connectionHint}</ConnectionHint>}
              {likeError && <ConnectionHint role="alert">{likeError}</ConnectionHint>}
              {shareMessage && <ConnectionHint role="status">{shareMessage}</ConnectionHint>}
            </div>
          )}
        </div>
      </section>

      <div className="mb-[0.85rem] grid grid-cols-4 gap-3 max-[640px]:grid-cols-2">
        <StatCard>
          <StatValue>{profile.stats.meetupCount}</StatValue>
          <StatLabel>{t.profile.meetupsCompleted}</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>
            {profile.stats.averageSpeakingScore != null
              ? profile.stats.averageSpeakingScore.toFixed(1)
              : "—"}
          </StatValue>
          <StatLabel>{t.profile.avgSparkScore}</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{profile.stats.speakingReports}</StatValue>
          <StatLabel>{t.profile.speakingReports}</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue style={{ fontSize: "1rem" }}>{memberSinceLabel}</StatValue>
          <StatLabel>{t.profile.memberSince}</StatLabel>
        </StatCard>
      </div>

      {profile.detailsVisible ? (
      <div className="grid grid-cols-[1.05fr_0.95fr] items-start gap-[0.85rem] max-[720px]:grid-cols-1">
        <div className="flex flex-col gap-[0.85rem]">
          <section className={cardClass}>
            <CardHeading>
              <SparklesIcon /> {t.profile.myStory}
            </CardHeading>
            <BodyText>
              {profile.isPublic === false
                ? t.profile.privateProfile
                : profile.bio || t.profile.storyDefault}
            </BodyText>
          </section>

          {hasAbout && (
            <section className={cardClass}>
              <CardLabel>{t.profile.about}</CardLabel>
              {profile.work && (
                <Detail>
                  <BriefcaseIcon />
                  <span>{profile.work}</span>
                </Detail>
              )}
              {profile.school && (
                <Detail>
                  <AcademicCapIcon />
                  <span>{profile.school}</span>
                </Detail>
              )}
              {profile.location && (
                <Detail>
                  <MapPinIcon />
                  <span>{profile.location}</span>
                </Detail>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-[0.85rem]">
          {interestChips.length > 0 && (
            <section className={cardClass}>
              <CardLabel>{t.profile.interestsTopics}</CardLabel>
              <div className="mx-0 mb-2 mt-[0.9rem] text-[0.82rem] font-[800] text-[#050505] first:mt-0">
                {t.profile.passions}
              </div>
              <div className="flex flex-wrap gap-[0.4rem]">
                {interestChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center rounded-full border-[1.5px] border-[#050505] bg-white px-[0.65rem] py-1 text-[0.8rem] font-bold text-[#050505]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[14px] border-2 border-[#050505] bg-[#102733] px-[1.2rem] py-[1.15rem] text-white shadow-[4px_4px_0_rgba(5,5,5,0.9)]">
            <div className="mb-[0.45rem] text-[0.66rem] font-[800] uppercase tracking-[0.07em] text-[rgba(255,255,255,0.6)]">
              {t.profile.status}
            </div>
            <div className="flex items-center gap-2 text-[1.05rem] font-[900]">
              <span className="h-[9px] w-[9px] rounded-full bg-[#34d27b] shadow-[0_0_0_3px_rgba(52,210,123,0.25)]" />{" "}
              {t.profile.statusMember}
            </div>
            <div className="mt-[0.45rem] text-[0.85rem] leading-[1.5] text-[rgba(255,255,255,0.78)]">
              {t.profile.statusSince.replace("{date}", memberSinceLabel)}
            </div>
          </section>
        </div>
      </div>
      ) : (
        <section className="rounded-[14px] border-2 border-[#050505] bg-[#fff8dc] px-[1.2rem] py-[1.15rem] shadow-[4px_4px_0_rgba(5,5,5,0.9)]">
          <CardHeading>
            <UserGroupIcon /> {t.profile.detailsLockedTitle}
          </CardHeading>
          <BodyText>{t.profile.detailsLockedBody}</BodyText>
        </section>
      )}
    </main>
  );
}
