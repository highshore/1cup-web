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
type PurchaseFilter = "all" | "membership" | "pass" | "both" | "none";
type SubscriptionFilter = "all" | "active" | "cancelled" | "ended" | "none";

function matchesPurchase(user: UserData, filter: PurchaseFilter): boolean {
  if (filter === "all") return true;
  if (filter === "membership") return !!user.hasPurchasedMembership;
  if (filter === "pass") return !!user.hasPurchasedParticipationPack;
  if (filter === "both") return !!user.hasPurchasedMembership && !!user.hasPurchasedParticipationPack;
  return !user.hasPurchasedMembership && !user.hasPurchasedParticipationPack;
}

function matchesSubscription(user: UserData, filter: SubscriptionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return !!user.hasActiveSubscription;
  if (filter === "cancelled") return !!user.hasActiveSubscription && !!user.billingCancelled;
  if (filter === "ended") return !user.hasActiveSubscription && !!user.hasPurchasedMembership;
  return !user.hasActiveSubscription && !user.hasPurchasedMembership;
}

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
  const [purchaseFilter, setPurchaseFilter] = useState<PurchaseFilter>("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const activeMembersCount = useMemo(() => users.filter(isActiveMember).length, [users]);
  const hasPurchaseData = users.every((user) => user.purchaseHistoryLoaded !== false);
  const purchaseCounts = useMemo(() => ({
    all: users.length,
    membership: users.filter((user) => user.hasPurchasedMembership).length,
    pass: users.filter((user) => user.hasPurchasedParticipationPack).length,
    both: users.filter((user) => user.hasPurchasedMembership && user.hasPurchasedParticipationPack).length,
    none: users.filter((user) => !user.hasPurchasedMembership && !user.hasPurchasedParticipationPack).length,
  }), [users]);
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return users.filter((user) =>
      (!hasPurchaseData || matchesPurchase(user, purchaseFilter)) &&
      (!hasPurchaseData && (subscriptionFilter === "ended" || subscriptionFilter === "none") ||
        matchesSubscription(user, subscriptionFilter)) &&
      (!query || [user.displayName, user.email, user.id].some(
        (value) => value?.toLocaleLowerCase().includes(query),
      )),
    );
  }, [users, hasPurchaseData, purchaseFilter, subscriptionFilter, searchQuery]);
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

        {tab === "members" && (
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[12px] font-extrabold text-[#050505]/65">
                {copy.purchaseFilterLabel}
              </span>
              {([
                ["all", copy.purchaseAll],
                ["membership", copy.purchaseMembership],
                ["pass", copy.purchasePass],
                ["both", copy.purchaseBoth],
                ["none", copy.purchaseNone],
              ] as Array<[PurchaseFilter, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={purchaseFilter === id}
                  disabled={!hasPurchaseData && id !== "all"}
                  onClick={() => { setPurchaseFilter(id); setExpandedMemberId(null); }}
                  className={[
                    "inline-flex min-h-9 items-center gap-2 rounded-full border-[1.5px] px-3 py-1.5 text-[12px] font-bold transition-colors",
                    purchaseFilter === id
                      ? "border-[#050505] bg-[#050505] text-white"
                      : "border-[#050505]/20 bg-[#f8f8f6] text-[#050505] hover:border-[#050505]/65",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                  ].join(" ")}
                >
                  {label}
                  <span className={purchaseFilter === id ? "text-white/70" : "text-[#050505]/50"}>
                    {purchaseCounts[id]}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                aria-label={copy.searchMembers}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={copy.searchMembers}
                className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#050505]/20 bg-white px-3 text-[13px] outline-none focus:border-[#050505]"
              />
              <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[#050505]/20 bg-white px-3">
                <span className="whitespace-nowrap text-[12px] font-bold text-[#050505]/60">
                  {copy.subscriptionFilterLabel}
                </span>
                <select
                  value={subscriptionFilter}
                  onChange={(event) => { setSubscriptionFilter(event.target.value as SubscriptionFilter); setExpandedMemberId(null); }}
                  className="min-w-0 bg-transparent py-2 text-[13px] font-bold text-[#050505] outline-none"
                >
                  <option value="all">{copy.subscriptionAll}</option>
                  <option value="active">{copy.subscriptionActive}</option>
                  <option value="cancelled">{copy.subscriptionCancelled}</option>
                  <option value="ended" disabled={!hasPurchaseData}>{copy.subscriptionEnded}</option>
                  <option value="none" disabled={!hasPurchaseData}>{copy.subscriptionNone}</option>
                </select>
              </label>
              <span className="text-right text-[12px] font-bold text-[#050505]/55">
                {copy.displayCount
                  .replace("{shown}", String(filteredUsers.length))
                  .replace("{total}", String(users.length))}
              </span>
            </div>
            {!hasPurchaseData && (
              <p role="alert" className="m-0 rounded-lg bg-[#fff3d6] px-3 py-2 text-[12px] font-semibold text-[#674b0b]">
                {copy.purchaseLoadError}
              </p>
            )}
          </div>
        )}

        <div
          className={tab === "feedback" ? undefined : "flex flex-col gap-3"}
          id={`${tab}-panel`}
          role="tabpanel"
          aria-labelledby={`${tab}-tab`}
        >
          {tab === "members" && filteredUsers.length === 0 && (
            <p className="rounded-lg bg-[#f8f8f6] p-7 text-center text-[13px] font-bold text-[#050505]/60">
              {copy.noMembersMatch}
            </p>
          )}
          {tab === "members" &&
            filteredUsers.map((user) => (
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
