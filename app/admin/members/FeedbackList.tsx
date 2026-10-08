"use client";

import { useI18n } from "../../lib/i18n/I18nProvider";
import { cardHoverLift, emptyStateClass, formatAdminDate } from "./shared";
import type { FeedbackData, UserData } from "./useAdminMembersData";

const feedbackListClass = "flex flex-col gap-3";

const feedbackCardClass = `border-[1.5px] border-[#050505] rounded-[10px] p-5 ${cardHoverLift}`;

const feedbackHeaderClass = "flex justify-between items-start mb-3";

const feedbackCategoryClass = (category: string) =>
  `inline-flex items-center py-1 px-3 border-[1.5px] border-[#050505] rounded-full text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#050505] ${
    category === "cancellation" ? "bg-[#fef3c7]" : "bg-[#f47a4a]"
  }`;

const feedbackDateClass = "text-[rgba(5,5,5,0.6)] text-[12px]";

const feedbackUserClass = "text-[#050505] font-extrabold text-[14px] mb-2";

const reasonsListClass = "list-none p-0 my-2 mx-0";

const reasonItemClass =
  "py-1 px-0 text-[rgba(5,5,5,0.72)] text-[14px] before:content-['•'] before:text-[#f47a4a] before:font-black before:mr-2";

const feedbackOtherClass =
  "bg-[#faf8f4] border-[1.5px] border-[#050505] border-l-4 border-l-[#f47a4a] p-3 mt-2 rounded-lg italic text-[rgba(5,5,5,0.72)]";

// Subscription-cancellation and refund feedback, linked back to the member who sent it.
export default function FeedbackList({
  feedback,
  usersById,
}: {
  feedback: FeedbackData[];
  usersById: Map<string, UserData>;
}) {
  const { t, locale } = useI18n();
  const copy = t.admin.members;

  if (feedback.length === 0) {
    return (
      <div className={feedbackListClass}>
        <div className={emptyStateClass}>{copy.noFeedback}</div>
      </div>
    );
  }

  return (
    <div className={feedbackListClass}>
      {feedback.map((item) => {
        const linkedDisplayName = usersById.get(item.userId)?.displayName;

        return (
          <div className={feedbackCardClass} key={item.id}>
            <div className={feedbackHeaderClass}>
              <div className={feedbackCategoryClass(item.category)}>
                {item.category === "cancellation" ? copy.subscriptionStop : copy.refundRequest}
              </div>
              <div className={feedbackDateClass}>
                {formatAdminDate(item.timestamp, "yyyy.MM.dd HH:mm", locale, t.admin.dashboard.unavailable)}
              </div>
            </div>

            <div className={feedbackUserClass}>
              {linkedDisplayName
                ? `${linkedDisplayName} (${item.userId})`
                : copy.userId.replace("{id}", item.userId)}
            </div>

            <div className="mb-3">
              <strong>{copy.selectedReasons}</strong>
              <ul className={reasonsListClass}>
                {item.reasons.map((reason, index) => (
                  <li className={reasonItemClass} key={index}>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            {item.otherReason && (
              <div className={feedbackOtherClass}>
                <strong>{copy.additionalComments}</strong>
                <br />
                {item.otherReason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
