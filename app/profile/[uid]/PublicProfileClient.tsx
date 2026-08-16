"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  MapPinIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";

interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  isPublic?: boolean;
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

const Page = styled.main`
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 0 1.25rem 4rem;
  background: transparent;

  @media (max-width: 640px) {
    padding: 0 1rem 3rem;
  }
`;

const Hero = styled.section`
  display: flex;
  align-items: center;
  gap: 1.75rem;
  margin-bottom: 1.25rem;

  @media (max-width: 640px) {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }
`;

const Avatar = styled.img`
  width: 132px;
  height: 132px;
  flex: 0 0 auto;
  border-radius: 50%;
  object-fit: cover;
  background: #f3f3f1;
  border: 3px solid #050505;
  box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.9);

  @media (max-width: 640px) {
    width: 110px;
    height: 110px;
  }
`;

const HeroText = styled.div`
  min-width: 0;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.55rem;

  @media (max-width: 640px) {
    justify-content: center;
  }
`;

const Pill = styled.span<{ $variant?: "orange" | "dark" | "plain" }>`
  display: inline-flex;
  align-items: center;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 0.18rem 0.6rem;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: ${({ $variant }) =>
    $variant === "dark" ? "#050505" : $variant === "orange" ? "#f47a4a" : "#ffffff"};
  color: ${({ $variant }) => ($variant === "dark" ? "#ffffff" : "#050505")};
`;

const Name = styled.h1`
  margin: 0;
  color: #050505;
  font-size: 2rem;
  font-weight: 900;
  line-height: 1.1;

  @media (max-width: 640px) {
    font-size: 1.7rem;
  }
`;

const Tagline = styled.p`
  margin: 0.4rem 0 0;
  color: rgba(5, 5, 5, 0.6);
  font-size: 1rem;
  font-style: italic;
  line-height: 1.4;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.85rem;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const StatCard = styled.div`
  border: 2px solid #050505;
  border-radius: 14px;
  background: #ffffff;
  padding: 1rem 0.9rem;
  text-align: center;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.9);
`;

const StatValue = styled.div`
  color: #050505;
  font-size: 1.3rem;
  font-weight: 900;
  line-height: 1.1;
`;

const StatLabel = styled.div`
  color: rgba(5, 5, 5, 0.55);
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-top: 0.35rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 0.85rem;
  align-items: start;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Col = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const Card = styled.section<{ $tint?: boolean }>`
  border: 2px solid #050505;
  border-radius: 14px;
  background: ${({ $tint }) => ($tint ? "#fff0e8" : "#ffffff")};
  padding: 1.15rem 1.2rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
`;

const CardLabel = styled.h2`
  margin: 0 0 0.7rem;
  color: rgba(5, 5, 5, 0.55);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.07em;
  text-transform: uppercase;
`;

const CardHeading = styled.h2`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.7rem;
  color: #050505;
  font-size: 1.05rem;
  font-weight: 900;

  svg {
    width: 18px;
    height: 18px;
    color: #f47a4a;
  }
`;

const BodyText = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.78);
  font-size: 0.92rem;
  line-height: 1.65;
`;

const QuoteText = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.72);
  font-size: 0.9rem;
  font-style: italic;
  line-height: 1.55;
`;

const ChipGroupLabel = styled.div`
  margin: 0.9rem 0 0.5rem;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 800;

  &:first-child {
    margin-top: 0;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.25rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #050505;
`;

const Detail = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: #050505;
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 0.55rem;

  &:first-of-type {
    margin-top: 0;
  }

  svg {
    width: 18px;
    height: 18px;
    color: #f47a4a;
    flex: 0 0 auto;
  }
`;

const InfoCard = styled.section`
  border: 2px solid #050505;
  border-radius: 14px;
  background: #102733;
  color: #ffffff;
  padding: 1.15rem 1.2rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
`;

const InfoLabel = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin-bottom: 0.45rem;
`;

const InfoTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 900;
`;

const Dot = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #34d27b;
  box-shadow: 0 0 0 3px rgba(52, 210, 123, 0.25);
`;

const InfoSub = styled.div`
  margin-top: 0.45rem;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.85rem;
  line-height: 1.5;
`;

const Centered = styled.div`
  text-align: center;
  padding: 4rem 1rem;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 700;
`;

const toChips = (value?: string): string[] =>
  (value || "")
    .split(/[,/·|]/)
    .map((s) => s.trim())
    .filter(Boolean);

export default function PublicProfileClient({ uid }: { uid: string }) {
  const { locale, t } = useI18n();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadProfile = async () => {
      try {
        const response = await fetch(
          `/api/public-profile/${encodeURIComponent(uid)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "프로필을 불러오지 못했습니다.");
        }
        if (!ignore) setProfile(payload);
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "프로필을 불러오지 못했습니다."
          );
        }
      }
    };

    loadProfile();
    return () => {
      ignore = true;
    };
  }, [uid]);

  if (error) return <Centered>{error}</Centered>;
  if (!profile) return <Centered>{t.profile.loading}</Centered>;

  const interestChips = toChips(profile.interests);
  const memberSinceLabel = profile.memberSince
    ? new Date(profile.memberSince).toLocaleDateString(
        locale === "ko" ? "ko-KR" : "en-US",
        { year: "numeric", month: "short" }
      )
    : "—";
  const hasAbout = profile.work || profile.school || profile.location;

  return (
    <Page>
      <Hero>
        <Avatar
          src={profile.photoURL || "/images/default_user.jpg"}
          alt={profile.displayName}
        />
        <HeroText>
          <BadgeRow>
            {(profile.badges.activeMember || profile.badges.role) && (
              <Pill $variant="orange">{t.profile.verified}</Pill>
            )}
            {profile.badges.activeMember && (
              <Pill $variant="dark">{t.profile.activeMember}</Pill>
            )}
            {profile.badges.role && <Pill>{profile.badges.role}</Pill>}
          </BadgeRow>
          <Name>{profile.displayName}</Name>
          <Tagline>
            {profile.bio
              ? `“${profile.bio.split(/(?<=[.!?。])\s/)[0]}”`
              : `“${t.profile.taglineDefault}”`}
          </Tagline>
        </HeroText>
      </Hero>

      <StatsGrid>
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
      </StatsGrid>

      <Grid>
        <Col>
          <Card>
            <CardHeading>
              <SparklesIcon /> {t.profile.myStory}
            </CardHeading>
            <BodyText>
              {profile.isPublic === false
                ? t.profile.privateProfile
                : profile.bio || t.profile.storyDefault}
            </BodyText>
          </Card>

          {hasAbout && (
            <Card>
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
            </Card>
          )}
        </Col>

        <Col>
          {interestChips.length > 0 && (
            <Card>
              <CardLabel>{t.profile.interestsTopics}</CardLabel>
              <ChipGroupLabel>{t.profile.passions}</ChipGroupLabel>
              <Chips>
                {interestChips.map((chip) => (
                  <Chip key={chip}>{chip}</Chip>
                ))}
              </Chips>
            </Card>
          )}

          <InfoCard>
            <InfoLabel>{t.profile.status}</InfoLabel>
            <InfoTitle>
              <Dot /> {t.profile.statusMember}
            </InfoTitle>
            <InfoSub>
              {t.profile.statusSince.replace("{date}", memberSinceLabel)}
            </InfoSub>
          </InfoCard>
        </Col>
      </Grid>
    </Page>
  );
}
