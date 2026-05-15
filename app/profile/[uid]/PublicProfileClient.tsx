"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  MapPinIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

interface PublicProfile {
  uid: string;
  displayName: string;
  photoURL?: string | null;
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
  max-width: 680px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;

  @media (max-width: 640px) {
    padding: 1.25rem 1rem 3rem;
  }
`;

const ProfileCard = styled.section`
  border: 1px solid #dddddd;
  border-radius: 24px;
  background: #ffffff;
  padding: 2rem;
  text-align: center;

  @media (max-width: 560px) {
    padding: 1.5rem 1.25rem;
    border-radius: 20px;
  }
`;

const AvatarWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
`;

const Avatar = styled.img`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  background: #f7f7f5;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
`;

const Name = styled.h1`
  margin: 0;
  color: #222222;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
`;

const SubTitle = styled.p`
  margin: 0.35rem 0 0;
  color: #717171;
  font-size: 0.875rem;
  line-height: 1.4;
`;

const Bio = styled.p`
  margin: 0.85rem auto 0;
  color: #484848;
  font-size: 0.95rem;
  line-height: 1.65;
  max-width: 480px;
`;

const StatsStrip = styled.div`
  display: flex;
  justify-content: center;
  border-top: 1px solid #eeeeec;
  border-bottom: 1px solid #eeeeec;
  margin: 1.25rem 0;
`;

const StatCell = styled.div`
  padding: 0.85rem 1.5rem;
  min-width: 90px;

  & + & {
    border-left: 1px solid #dddddd;
  }

  @media (max-width: 420px) {
    padding: 0.7rem 1rem;
    min-width: 70px;
  }
`;

const StatValue = styled.div`
  color: #222222;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
`;

const StatLabel = styled.div`
  color: #717171;
  font-size: 0.72rem;
  margin-top: 0.2rem;
  white-space: nowrap;
`;

const BadgeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
  text-align: left;
  border-top: 1px solid #eeeeec;
  padding-top: 1rem;
`;

const BadgeItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;

  svg {
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
    color: #717171;
    margin-top: 1px;
  }
`;

const BadgeItemTitle = styled.div`
  color: #222222;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
`;

const BadgeItemSub = styled.div`
  color: #717171;
  font-size: 0.78rem;
  margin-top: 0.1rem;
`;

const TileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const Tile = styled.section`
  border: 1px solid #dddddd;
  border-radius: 20px;
  background: #ffffff;
  padding: 1.25rem;
`;

const TileTitle = styled.h2`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.75rem;
  color: #717171;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;

  svg {
    width: 15px;
    height: 15px;
  }
`;

const Detail = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  color: #222222;
  font-size: 0.875rem;
  line-height: 1.45;
  margin-top: 0.6rem;

  svg {
    width: 18px;
    height: 18px;
    color: #717171;
    flex: 0 0 auto;
    margin-top: 1px;
  }
`;

const StatRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid #f1f5f9;
  padding-top: 0.65rem;
  margin-top: 0.65rem;
  color: #717171;
  font-size: 0.85rem;

  strong {
    color: #222222;
    font-size: 1.1rem;
    font-weight: 700;
  }
`;

export default function PublicProfileClient({ uid }: { uid: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/public-profile/${encodeURIComponent(uid)}`, {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "프로필을 불러오지 못했습니다.");
        }

        if (!ignore) {
          setProfile(payload);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "프로필을 불러오지 못했습니다.");
        }
      }
    };

    loadProfile();
    return () => {
      ignore = true;
    };
  }, [uid]);

  if (error) {
    return <Page>{error}</Page>;
  }

  if (!profile) {
    return <Page>프로필을 불러오는 중...</Page>;
  }

  const hasBadges =
    profile.badges.activeMember || profile.badges.gdgMember || profile.badges.role;

  return (
    <Page>
      <ProfileCard>
        <AvatarWrap>
          <Avatar
            src={profile.photoURL || "/images/default_user.jpg"}
            alt={profile.displayName}
          />
        </AvatarWrap>

        <Name>{profile.displayName}</Name>
        <SubTitle>
          {profile.location ? `${profile.location}에서 활동 중` : "영어 한잔 멤버"}
        </SubTitle>
        <Bio>{profile.bio || "영어 한잔에서 꾸준히 영어 루틴을 쌓고 있습니다."}</Bio>

        <StatsStrip>
          <StatCell>
            <StatValue>{profile.stats.meetupCount}</StatValue>
            <StatLabel>참여 밋업</StatLabel>
          </StatCell>
          <StatCell>
            <StatValue>
              {profile.stats.averageSpeakingScore != null
                ? `★${profile.stats.averageSpeakingScore.toFixed(1)}`
                : "-"}
            </StatValue>
            <StatLabel>평균 점수</StatLabel>
          </StatCell>
          <StatCell>
            <StatValue>{profile.stats.speakingReports}</StatValue>
            <StatLabel>스피킹 리포트</StatLabel>
          </StatCell>
        </StatsStrip>

        {hasBadges && (
          <BadgeList>
            {profile.badges.activeMember && (
              <BadgeItem>
                <CheckBadgeIcon />
                <div>
                  <BadgeItemTitle>Active Member</BadgeItemTitle>
                  <BadgeItemSub>영어 한잔 구독 멤버십 이용 중</BadgeItemSub>
                </div>
              </BadgeItem>
            )}
            {profile.badges.gdgMember && (
              <BadgeItem>
                <SparklesIcon />
                <div>
                  <BadgeItemTitle>GDG Member</BadgeItemTitle>
                  <BadgeItemSub>Google Developer Groups 멤버</BadgeItemSub>
                </div>
              </BadgeItem>
            )}
            {profile.badges.role && (
              <BadgeItem>
                <CheckBadgeIcon />
                <div>
                  <BadgeItemTitle>{profile.badges.role}</BadgeItemTitle>
                  <BadgeItemSub>영어 한잔 멤버 역할</BadgeItemSub>
                </div>
              </BadgeItem>
            )}
          </BadgeList>
        )}
      </ProfileCard>

      <TileGrid>
        <Tile>
          <TileTitle><SparklesIcon /> About</TileTitle>
          {profile.work && (
            <Detail><BriefcaseIcon /><span>{profile.work}</span></Detail>
          )}
          {profile.school && (
            <Detail><AcademicCapIcon /><span>{profile.school}</span></Detail>
          )}
          {profile.location && (
            <Detail><MapPinIcon /><span>{profile.location}</span></Detail>
          )}
          {!profile.work && !profile.school && !profile.location && (
            <Detail><SparklesIcon /><span style={{ color: "#717171" }}>아직 정보가 없습니다</span></Detail>
          )}
        </Tile>

        <Tile>
          <TileTitle><ChartBarIcon /> Insights</TileTitle>
          <StatRow>
            <span>참여 밋업</span>
            <strong>{profile.stats.meetupCount}</strong>
          </StatRow>
          <StatRow>
            <span>스피킹 리포트</span>
            <strong>{profile.stats.speakingReports}</strong>
          </StatRow>
          <StatRow>
            <span>평균 점수</span>
            <strong>{profile.stats.averageSpeakingScore ?? "-"}</strong>
          </StatRow>
          <StatRow>
            <span>가입일</span>
            <strong>
              {profile.memberSince
                ? new Date(profile.memberSince).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "short",
                  })
                : "-"}
            </strong>
          </StatRow>
        </Tile>
      </TileGrid>
    </Page>
  );
}
