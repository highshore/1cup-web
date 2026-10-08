"use client";

import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  cardHoverLift,
  emptyStateClass,
  formatAdminDate,
  userEmailClass,
  userNameClass,
} from "./shared";
import type { NonKoreanApplication, UserData } from "./useAdminMembersData";

const applicantCardClass = `border-[1.5px] border-[#050505] rounded-[10px] p-4 ${cardHoverLift}`;

const applicantHeaderClass = "flex items-start justify-between gap-3";

const applicantDetailsClass =
  "grid grid-cols-3 gap-3 mx-0 mt-3.5 mb-0 max-[640px]:grid-cols-1 " +
  "[&_dt]:mx-0 [&_dt]:mt-0 [&_dt]:mb-[3px] [&_dt]:text-[rgba(5,5,5,0.58)] [&_dt]:text-[11px] [&_dt]:font-extrabold [&_dt]:uppercase " +
  "[&_dd]:m-0 [&_dd]:text-[#050505] [&_dd]:text-[13px] [&_dd]:font-bold [&_dd]:[overflow-wrap:anywhere]";

const applicantStatusClass = (status: NonKoreanApplication["status"]) =>
  `inline-flex items-center border-[1.5px] border-[#050505] rounded-full text-[#050505] py-1 px-2.5 text-[11px] [font-weight:850] capitalize ${
    status === "approved" ? "bg-[#dcfce7]" : status === "declined" ? "bg-[#fee2e2]" : "bg-[#fef3c7]"
  }`;

const externalProfileLinkClass =
  "text-[#050505] font-extrabold underline underline-offset-[0.16em]";

// Non-Korean membership applications with the applicant's LinkedIn and nationality.
export default function ApplicantsList({
  applications,
  usersById,
}: {
  applications: NonKoreanApplication[];
  usersById: Map<string, UserData>;
}) {
  const { t, locale } = useI18n();
  const copy = t.admin.members;

  if (applications.length === 0) {
    return <div className={emptyStateClass}>{copy.noApplicants}</div>;
  }

  return applications.map((application) => {
    const member = usersById.get(application.userId);
    return (
      <article className={applicantCardClass} key={application.id}>
        <div className={applicantHeaderClass}>
          <div>
            <div className={userNameClass}>{member?.displayName || copy.noName}</div>
            <div className={userEmailClass}>{application.email}</div>
          </div>
          <span className={applicantStatusClass(application.status)}>
            {copy.applicationStatuses[application.status]}
          </span>
        </div>
        <dl className={applicantDetailsClass}>
          <div>
            <dt>{copy.applicantNationality}</dt>
            <dd>{application.nationality}</dd>
          </div>
          <div>
            <dt>{copy.applicantLinkedIn}</dt>
            <dd>
              <a
                className={externalProfileLinkClass}
                href={application.linkedinUrl}
                target="_blank"
                rel="noreferrer"
              >
                {application.linkedinUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt>{copy.applicantSubmitted}</dt>
            <dd>
              {formatAdminDate(application.createdAt, "yyyy.MM.dd HH:mm", locale, t.admin.dashboard.unavailable)}
            </dd>
          </div>
        </dl>
      </article>
    );
  });
}
