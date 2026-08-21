"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  fetchMutualProfileFriends,
  type MutualProfileFriend,
} from "../../lib/features/profile/services/profile_connections";

const Page = styled.main`
  width: min(100%, 860px);
  margin: 0 auto;
  padding: 0 1.25rem 4rem;

  @media (max-width: 640px) {
    padding: 0 1rem 3rem;
  }
`;

const Header = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 0;
  background: transparent;
  padding: 0.2rem 0;
  color: #050505;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 850;
  cursor: pointer;

  svg {
    width: 17px;
    height: 17px;
  }
`;

const Heading = styled.h1`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0.8rem 0 0.35rem;
  color: #050505;
  font-size: clamp(1.65rem, 5vw, 2rem);
  font-weight: 900;

  svg {
    width: 28px;
    height: 28px;
    color: #f47a4a;
  }
`;

const Subtitle = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.94rem;
  font-weight: 600;
  line-height: 1.5;
`;

const List = styled.div`
  display: grid;
  gap: 0.75rem;
  margin-top: 1.35rem;
`;

const FriendCard = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.9rem;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #ffffff;
  padding: 0.85rem;
  color: #050505;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.9);
  text-decoration: none;
  transition: transform 150ms ease, box-shadow 150ms ease;

  &:hover {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0 rgba(5, 5, 5, 0.9);
  }
`;

const Avatar = styled.img`
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border: 1.5px solid #050505;
  border-radius: 50%;
  object-fit: cover;
`;

const FriendName = styled.div`
  font-size: 1rem;
  font-weight: 900;
`;

const FriendMeta = styled.div`
  margin-top: 0.18rem;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.78rem;
  font-weight: 700;
`;

const State = styled.div`
  margin-top: 1.35rem;
  border: 2px solid #050505;
  border-radius: 14px;
  background: #fff8dc;
  padding: 1.3rem;
  color: rgba(5, 5, 5, 0.72);
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.55;
`;

export default function ConnectionsClient() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { locale, t } = useI18n();
  const [friends, setFriends] = useState<MutualProfileFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace(`/auth?redirect=${encodeURIComponent("/profile/connections")}`);
      return;
    }

    let active = true;
    void fetchMutualProfileFriends()
      .then((items) => {
        if (active) setFriends(items);
      })
      .catch(() => {
        if (active) setError(t.profile.connectionsLoadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, currentUser, router, t.profile.connectionsLoadFailed]);

  const networkTitle = locale === "ko" ? "내 네트워크" : t.profile.connectionsTitle;
  const networkSubtitle = locale === "ko"
    ? "서로 좋아요를 누른 멤버가 내 네트워크에 표시됩니다."
    : t.profile.connectionsSubtitle;

  return (
    <Page>
      <Header>
        <div>
          <BackButton type="button" onClick={() => router.push("/profile")}>
            <ArrowLeftIcon />
            {t.profile.aboutYou}
          </BackButton>
          <Heading>
            <UserGroupIcon />
            {networkTitle}
          </Heading>
          <Subtitle>{networkSubtitle}</Subtitle>
        </div>
      </Header>

      {loading ? (
        <State>{t.profile.loading}</State>
      ) : error ? (
        <State role="alert">{error}</State>
      ) : friends.length === 0 ? (
        <State>{t.profile.connectionsEmpty}</State>
      ) : (
        <List>
          {friends.map((friend) => (
            <FriendCard key={friend.uid} href={`/profile/${encodeURIComponent(friend.uid)}`}>
              <Avatar
                src={friend.photoURL || "/images/default_user.jpg"}
                alt=""
              />
              <div>
                <FriendName>{friend.displayName}</FriendName>
                <FriendMeta>
                  {friend.connectedAt
                    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
                        month: "short",
                        year: "numeric",
                      }).format(new Date(friend.connectedAt))
                    : ""}
                </FriendMeta>
              </div>
            </FriendCard>
          ))}
        </List>
      )}
    </Page>
  );
}
