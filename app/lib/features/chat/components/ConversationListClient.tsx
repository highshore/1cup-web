"use client";

import Link from "next/link";

import { useI18n } from "../../../i18n/I18nProvider";
import type { ConversationSummary } from "../types";

function formatConversationTime(value: string, locale: "en" | "ko"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
        month: "short",
        day: "numeric",
      }).format(date);
}

export default function ConversationListClient({
  initialConversations,
}: {
  initialConversations: ConversationSummary[];
}) {
  const { locale, t } = useI18n();

  return (
    <main className="w-full max-w-page mx-auto pt-7 px-gutter pb-16 max-[640px]:pt-[1.2rem] max-[640px]:px-gutter-mobile max-[640px]:pb-12">
      <header className="flex items-end justify-between gap-4 mb-[1.15rem]">
        <div>
          <h1 className="m-0 text-[#0f172a] text-[clamp(1.65rem,4vw,2.1rem)] font-[850] tracking-[-0.04em]">
            {t.chat.title}
          </h1>
          <p className="mt-[0.35rem] mb-0 text-[#64748b] text-[0.94rem]">{t.chat.listSubtitle}</p>
        </div>
      </header>

      <section className="overflow-hidden border border-[#e2e8f0] rounded-[20px] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.07)]">
        {initialConversations.length === 0 ? (
          <div className="py-14 px-[1.2rem] text-[#64748b] text-center">{t.chat.empty}</div>
        ) : (
          initialConversations.map((conversation) => {
            const isSystem = conversation.conversationType === "system";
            const displayName = isSystem
              ? "☕ 1 Cup English"
              : conversation.otherDisplayName || t.chat.memberFallback;
            const preview = conversation.latestMessage?.body || t.chat.noMessages;
            const timestamp = conversation.latestMessage?.createdAt || conversation.conversationUpdatedAt;

            return (
              <Link
                key={conversation.conversationId}
                href={`/messages/${conversation.conversationId}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.85rem] border-b border-[#edf2f7] py-4 px-[1.1rem] text-inherit no-underline [transition:background-color_140ms_ease] last:border-b-0 hover:bg-[#f8fafc] max-[640px]:gap-[0.7rem] max-[640px]:p-[0.9rem]"
              >
                <div
                  className={`grid w-12 h-12 flex-none place-items-center overflow-hidden rounded-full font-extrabold ${
                    isSystem
                      ? "bg-[#fef3c7] text-[#92400e] text-[1.35rem]"
                      : "bg-[#e2e8f0] text-[#334155] text-[1rem]"
                  }`}
                  aria-hidden="true"
                >
                  {isSystem ? (
                    "☕"
                  ) : conversation.otherPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="w-full h-full object-cover"
                      src={conversation.otherPhotoUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="overflow-hidden text-[#0f172a] text-[0.96rem] font-extrabold text-ellipsis whitespace-nowrap">
                    {displayName}
                  </div>
                  <div className="overflow-hidden mt-[0.24rem] text-[#64748b] text-[0.85rem] leading-[1.35] text-ellipsis whitespace-nowrap">
                    {preview}
                  </div>
                </div>
                <time
                  className="self-start pt-[0.15rem] text-[#94a3b8] text-[0.72rem] tabular-nums"
                  dateTime={timestamp}
                >
                  {formatConversationTime(timestamp, locale)}
                </time>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}
