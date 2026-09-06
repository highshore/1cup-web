"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  fetchMutualProfileFriends,
  type MutualProfileFriend,
} from "../../lib/features/profile/services/profile_connections";

function State({
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="mt-[1.35rem] rounded-[14px] border-2 border-[#050505] bg-[#fff8dc] p-[1.3rem] text-[0.92rem] font-bold leading-[1.55] text-[rgba(5,5,5,0.72)]"
      {...rest}
    >
      {children}
    </div>
  );
}

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
    <main className="mx-auto w-[min(100%,860px)] px-5 pb-16 max-[640px]:px-4 max-[640px]:pb-12">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="inline-flex cursor-pointer items-center gap-[0.4rem] border-0 bg-transparent px-0 py-[0.2rem] text-[0.85rem] font-[850] text-[#050505] [&_svg]:h-[17px] [&_svg]:w-[17px]"
          >
            <ArrowLeftIcon />
            {t.profile.aboutYou}
          </button>
          <h1 className="mx-0 mb-[0.35rem] mt-[0.8rem] flex items-center gap-[0.55rem] text-[clamp(1.65rem,5vw,2rem)] font-[900] text-[#050505] [&_svg]:h-7 [&_svg]:w-7 [&_svg]:text-[#f47a4a]">
            <UserGroupIcon />
            {networkTitle}
          </h1>
          <p className="m-0 text-[0.94rem] font-semibold leading-[1.5] text-[rgba(5,5,5,0.62)]">
            {networkSubtitle}
          </p>
        </div>
      </header>

      {loading ? (
        <State>{t.profile.loading}</State>
      ) : error ? (
        <State role="alert">{error}</State>
      ) : friends.length === 0 ? (
        <State>{t.profile.connectionsEmpty}</State>
      ) : (
        <div className="mt-[1.35rem] grid gap-3">
          {friends.map((friend) => (
            <Link
              key={friend.uid}
              href={`/profile/${encodeURIComponent(friend.uid)}`}
              className="flex items-center gap-[0.9rem] rounded-[14px] border-2 border-[#050505] bg-white p-[0.85rem] text-[#050505] no-underline shadow-[3px_3px_0_rgba(5,5,5,0.9)] transition-[transform,box-shadow] duration-150 ease-[ease] hover:[transform:translate(1px,1px)] hover:shadow-[2px_2px_0_rgba(5,5,5,0.9)]"
            >
              <img
                className="h-[52px] w-[52px] flex-none rounded-full border-[1.5px] border-[#050505] object-cover"
                src={friend.photoURL || "/images/default_user.jpg"}
                alt=""
              />
              <div>
                <div className="text-[1rem] font-[900]">{friend.displayName}</div>
                <div className="mt-[0.18rem] text-[0.78rem] font-bold text-[rgba(5,5,5,0.58)]">
                  {friend.connectedAt
                    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
                        month: "short",
                        year: "numeric",
                      }).format(new Date(friend.connectedAt))
                    : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
