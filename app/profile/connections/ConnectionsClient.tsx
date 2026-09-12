"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

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

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
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
  const { locale, t } = useI18n();
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
        if (active) setError(t.profile.connectionLoadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale, shell.currentUser?.uid, t.profile.connectionLoadFailed]);

  return (
    <div className={mobile ? "px-4 pb-10 pt-5 sm:px-6" : "p-8"}>
      <div className="flex items-start gap-3">
        {mobile && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-[-2px] inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-[#050505] bg-white"
            aria-label={t.profile.backToProfile}
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="m-0">{t.profile.connections}</h1>
          <p className="mt-1.5 text-[13px] text-[#64748b]">{t.profile.connectionsHelp}</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white p-5 text-[13px] font-medium text-[#64748b]">
          {t.profile.loadingConnections}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-[16px] border-[1.5px] border-[#f2c7cc] bg-[#fff1f2] p-5 text-[13px] font-semibold text-[#b42331]">
          {error}
        </div>
      ) : friends.length === 0 ? (
        <div className="mt-6 rounded-[16px] border-[1.5px] border-[rgba(5,5,5,0.12)] bg-white p-5 text-[13px] text-[#64748b]">
          {t.profile.noConnections}
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {friends.map((friend) => {
            const connectedDate = friend.connectedAt
              ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
                  month: "short",
                  year: "numeric",
                }).format(new Date(friend.connectedAt))
              : null;
            return (
              <Link
                key={friend.uid}
                href={`/profile/${encodeURIComponent(friend.uid)}`}
                className="flex min-h-[88px] items-center gap-4 rounded-[16px] border-2 border-[#050505] bg-white px-4 py-3 text-[#050505] no-underline shadow-[3px_3px_0_rgba(5,5,5,0.92)] transition-[transform,box-shadow,background-color] hover:-translate-x-px hover:-translate-y-px hover:bg-[#fffaf6] hover:shadow-[4px_4px_0_#f47a4a] hover:no-underline"
              >
                <div className="flex h-[60px] w-[60px] flex-none items-center justify-center overflow-hidden rounded-full border-2 border-[#f47a4a] bg-[#fff8dc] text-[18px] font-extrabold text-[#f47a4a]">
                  {friend.photoURL ? (
                    <img src={friend.photoURL} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(friend.displayName)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-extrabold text-[#050505]">{friend.displayName}</div>
                  <div className="mt-1 text-[13px] text-[#64748b]">
                    {connectedDate
                      ? interpolate(t.profile.connectedMonth, { date: connectedDate })
                      : t.profile.memberFallback}
                  </div>
                </div>
                <span className="hidden whitespace-nowrap text-[13px] font-extrabold text-[#e0602e] sm:inline">
                  {t.profile.viewProfile}
                </span>
                <ChevronRightIcon className="h-[18px] w-[18px] flex-none text-[#f47a4a]" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ConnectionsPanel;
