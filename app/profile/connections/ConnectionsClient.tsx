"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  fetchMutualProfileFriends,
  type MutualProfileFriend,
} from "../../lib/features/profile/services/profile_connections";
import type { ProfileShellData } from "../ProfileShell";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "M"
  );
}

export function ConnectionsPanel({
  shell,
  mobile = false,
  onBack,
}: {
  shell: ProfileShellData;
  mobile?: boolean;
  onBack?: () => void;
}) {
  const { locale } = useI18n();
  const [friends, setFriends] = useState<MutualProfileFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shell.currentUser) return;
    let active = true;
    setLoading(true);
    setError("");
    void fetchMutualProfileFriends()
      .then((items) => {
        if (active) setFriends(items);
      })
      .catch((loadError) => {
        console.error("Unable to load connections:", loadError);
        if (active) {
          setError(
            locale === "ko"
              ? "연결된 멤버를 불러오지 못했습니다."
              : "Unable to load your connections.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale, shell.currentUser?.uid]);

  return (
    <div className={mobile ? "px-4 pb-10 pt-5 sm:px-6" : "p-8"}>
      <div className="flex items-start gap-3">
        {mobile && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-[-3px] border-0 bg-transparent p-0 text-[28px] leading-none text-[#050505]"
            aria-label="Back to profile"
          >
            ‹
          </button>
        )}
        <div className="min-w-0">
          <h1 className="m-0">Connections</h1>
          <p className="mt-1.5 text-[13px] text-[#6c757d]">
            Members you’ve connected with through 1 Cup.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white p-5 text-[13px] font-medium text-[#6c757d]">
          Loading connections…
        </div>
      ) : error ? (
        <div className="mt-6 rounded-[16px] border-[1.5px] border-[#f2c7cc] bg-[#fff1f2] p-5 text-[13px] font-semibold text-[#b42331]">
          {error}
        </div>
      ) : friends.length === 0 ? (
        <div className="mt-6 rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white p-5 text-[13px] text-[#6c757d]">
          No mutual connections yet. When you and another member both connect, they’ll appear here.
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {friends.map((friend) => (
            <Link
              key={friend.uid}
              href={`/profile/${encodeURIComponent(friend.uid)}`}
              className="flex min-h-[88px] items-center gap-4 rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white px-4 py-3 text-[#050505] no-underline transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-[rgba(5,5,5,0.24)] hover:bg-[#fffaf6] hover:no-underline"
            >
              <div className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-full bg-[#fff0e8] text-[18px] font-extrabold text-[#f47a4a]">
                {friend.photoURL ? (
                  <img src={friend.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(friend.displayName)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-extrabold text-[#050505]">{friend.displayName}</div>
                <div className="mt-1 text-[13px] text-[#6c757d]">
                  {friend.connectedAt
                    ? `Connected ${new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
                        month: "short",
                        year: "numeric",
                      }).format(new Date(friend.connectedAt))}`
                    : "1 Cup member"}
                </div>
              </div>
              <span className="whitespace-nowrap text-[13px] font-semibold text-[#f47a4a]">
                View profile
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ConnectionsPanel;
