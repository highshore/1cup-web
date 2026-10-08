"use client";

import { useMemo, useState } from "react";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";
import ApplicantsList from "./ApplicantsList";
import FeedbackList from "./FeedbackList";
import MemberCard from "./MemberCard";
import SectionTitle from "./SectionTitle";
import { hoverLiftTransition } from "./shared";
import { fetchUsers, useAdminMembersData, type UserData } from "./useAdminMembersData";

const wrapperClass =
  "flex flex-col pt-0 px-5 pb-5 max-w-[1400px] mx-auto gap-[30px] bg-transparent";

const contentSectionClass =
  "bg-white rounded-2xl p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)] border-[3px] border-[#050505]";

const membersHeaderClass =
  "flex items-center justify-between gap-3 mb-4 max-[560px]:items-start max-[560px]:flex-col";

const membersTabsClass = "flex gap-2 mb-4 border-b-[1.5px] border-b-[rgba(5,5,5,0.22)]";

const membersTabClass = (active: boolean) =>
  `border-0 border-b-[3px] mb-[-1.5px] pt-[7px] px-2.5 pb-2 bg-transparent text-[13px] font-extrabold cursor-pointer focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2 ${
    active ? "border-b-[#050505] text-[#050505]" : "border-b-transparent text-[rgba(5,5,5,0.58)]"
  }`;

const membersActionButtonClass = `inline-flex items-center h-9 gap-1.5 py-0 px-3 rounded-full border-2 border-[#050505] bg-[#f47a4a] text-[#050505] text-[12px] font-extrabold cursor-pointer ${hoverLiftTransition} shadow-[3px_3px_0_#050505] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#050505] disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-none disabled:shadow-none [&_svg]:w-[15px] [&_svg]:h-[15px]`;

const loadingSpinnerClass = "flex justify-center items-center p-10 text-[rgba(5,5,5,0.6)] font-bold";

type MembersTab = "members" | "feedback" | "applicants";

const isActiveMember = (user: UserData) =>
  Boolean(user.hasActiveSubscription) && user.account_status !== "admin";

// /admin/members: the member list (with participation credits), cancellation/refund
// feedback, and non-Korean applications. Admin access is enforced by app/admin/layout.tsx.
export default function AdminMembersClient() {
  const { t } = useI18n();
  const copy = t.admin.members;
  const { loading, users, setUsers, feedback, applications } = useAdminMembersData();
  const [tab, setTab] = useState<MembersTab>("members");
  const [extending, setExtending] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const activeMembersCount = useMemo(() => users.filter(isActiveMember).length, [users]);

  const withCount = (template: string, count: number) =>
    template.replace("{count}", String(count));

  const handleExtendActiveMembers = async () => {
    const activeUsers = users.filter(isActiveMember);
    if (activeUsers.length === 0) {
      window.alert(copy.noActiveFound);
      return;
    }
    if (!window.confirm(withCount(copy.extendConfirm, activeUsers.length))) return;

    setExtending(true);
    try {
      // PostgREST has no batch update with per-row values, so each member is updated
      // individually. RLS (is_admin) is enforced per statement either way.
      for (const user of activeUsers) {
        const { error } = await supabase.rpc("admin_extend_member_subscription", {
          p_user_id: user.id,
          p_days: 14,
        });
        if (error) throw error;
      }
      setUsers(await fetchUsers());
      window.alert(copy.extendSuccess);
    } catch (error) {
      console.error("Error extending active subscriptions:", error);
      window.alert(copy.extendError);
    } finally {
      setExtending(false);
    }
  };

  const handleBalanceChange = (userId: string, balance: number) => {
    setUsers((previous) =>
      previous.map((item) =>
        item.id === userId ? { ...item, participationCreditBalance: balance } : item,
      ),
    );
  };

  if (loading) {
    return (
      <div className={wrapperClass}>
        <div className={loadingSpinnerClass}>{t.admin.dashboard.loading}</div>
      </div>
    );
  }

  const tabs: Array<{ id: MembersTab; label: string }> = [
    { id: "members", label: withCount(copy.tabMembers, users.length) },
    { id: "feedback", label: withCount(copy.tabFeedback, feedback.length) },
    { id: "applicants", label: withCount(copy.tabApplicants, applications.length) },
  ];

  return (
    <div className={wrapperClass}>
      <div className={contentSectionClass}>
        <div className={membersHeaderClass}>
          <SectionTitle compact>{withCount(copy.title, users.length)}</SectionTitle>
          <div className="flex items-center">
            <button
              type="button"
              className={membersActionButtonClass}
              onClick={handleExtendActiveMembers}
              disabled={extending || activeMembersCount === 0}
            >
              <CalendarDaysIcon />
              {extending
                ? copy.extending
                : activeMembersCount > 0
                  ? withCount(copy.extendActive, activeMembersCount)
                  : copy.noActiveMembers}
            </button>
          </div>
        </div>

        <div className={membersTabsClass} role="tablist" aria-label={copy.tabListLabel}>
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${id}-tab`}
              aria-controls={`${id}-panel`}
              aria-selected={tab === id}
              className={membersTabClass(tab === id)}
              onClick={() => {
                // Member cards unmount with the tab and drop their loaded credit history,
                // so none should come back already expanded.
                setExpandedMemberId(null);
                setTab(id);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className={tab === "feedback" ? undefined : "flex flex-col gap-3"}
          id={`${tab}-panel`}
          role="tabpanel"
          aria-labelledby={`${tab}-tab`}
        >
          {tab === "members" &&
            users.map((user) => (
              <MemberCard
                key={user.id}
                user={user}
                expanded={expandedMemberId === user.id}
                onToggleExpanded={() =>
                  setExpandedMemberId((current) => (current === user.id ? null : user.id))
                }
                onBalanceChange={handleBalanceChange}
              />
            ))}
          {tab === "feedback" && <FeedbackList feedback={feedback} usersById={usersById} />}
          {tab === "applicants" && (
            <ApplicantsList applications={applications} usersById={usersById} />
          )}
        </div>
      </div>
    </div>
  );
}
