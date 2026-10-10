"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowsUpDownIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";
import ApplicantsList from "./ApplicantsList";
import FeedbackList from "./FeedbackList";
import MemberDetailsDrawer from "./MemberDetailsDrawer";
import MemberFiltersDialog from "./MemberFiltersDialog";
import { MemberDesktopRow, MemberMobileCard } from "./MemberListItem";
import { getMemberBillingStatus } from "./membershipStatus";
import {
  DEFAULT_MEMBER_FILTERS,
  matchesMemberFilters,
  sortMembers,
  type MemberFilters,
  type MemberSort,
} from "./memberListFilters";
import { fetchUsers, useAdminMembersData, type UserData } from "./useAdminMembersData";

const PAGE_SIZE = 30;
type MembersTab = "members" | "feedback" | "applicants";

const wrapperClass = "mx-auto w-full max-w-[1280px] px-3 pb-10 pt-4 sm:px-6 sm:pt-6";
const sectionClass = "min-w-0 rounded-2xl border border-[#e8e8e8] bg-white p-3.5 shadow-[0_2px_14px_rgba(0,0,0,0.035)] sm:p-6";
const lightButtonClass = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#dedede] bg-white px-3 text-[12px] font-bold text-[#393939] transition-colors hover:bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f47a4a]";

function TableSortHeader({
  label,
  active,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th scope="col" className={"px-4 py-3 text-[11px] font-bold text-[#767676] " + (align === "right" ? "text-right" : "text-left")}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={"inline-flex items-center gap-1 whitespace-nowrap hover:text-[#111] " + (align === "right" ? "justify-end" : "")}
      >
        {label}
        <ArrowsUpDownIcon className={"h-3.5 w-3.5 " + (active ? "text-[#f47a4a]" : "text-[#b7b7b7]")} />
      </button>
    </th>
  );
}

export default function AdminMembersClient() {
  const { t } = useI18n();
  const copy = t.admin.members;
  const { loading, users, setUsers, feedback, applications } = useAdminMembersData();
  const [tab, setTab] = useState<MembersTab>("members");
  const [filters, setFilters] = useState<MemberFilters>(DEFAULT_MEMBER_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<MemberSort>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const activeUsers = useMemo(() =>
    users.filter((user) => !!user.hasActiveSubscription && user.account_status !== "admin"),
    [users],
  );
  const purchaseDataAvailable = users.every((user) => user.purchaseHistoryLoaded !== false);

  const stats = useMemo(() => ({
    ongoing: users.filter((user) => getMemberBillingStatus(user) === "ongoing").length,
    stopped: users.filter((user) => {
      const status = getMemberBillingStatus(user);
      return status === "stopped_active" || status === "stopped_ended";
    }).length,
    pass: users.filter((user) => user.hasPurchasedParticipationPack).length,
  }), [users]);

  const matchesQuery = useCallback((user: UserData) => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return !query || [user.displayName, user.email, user.id].some(
      (part) => part?.toLocaleLowerCase().includes(query),
    );
  }, [searchQuery]);

  const countMatches = useCallback((next: MemberFilters) =>
    users.filter((user) =>
      matchesMemberFilters(user, next, purchaseDataAvailable) && matchesQuery(user),
    ).length,
  [users, purchaseDataAvailable, matchesQuery]);

  const filteredUsers = useMemo(() => sortMembers(
    users.filter((user) =>
      matchesMemberFilters(user, filters, purchaseDataAvailable) && matchesQuery(user),
    ), sortBy),
  [users, filters, purchaseDataAvailable, matchesQuery, sortBy]);

  const shownUsers = filteredUsers.slice(0, visibleCount);
  const selectedUser = selectedMemberId ? usersById.get(selectedMemberId) ?? null : null;
  const hiddenFilterCount =
    Number(filters.purchase !== "all") + Number(filters.location !== "all");

  const closeDetails = useCallback(() => setSelectedMemberId(null), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const setStatusFilter = (status: MemberFilters["status"]) => {
    setFilters((current) => ({ ...current, status }));
    setVisibleCount(PAGE_SIZE);
  };
  const setSummaryFilter = (next: MemberFilters) => {
    setFilters(next);
    setVisibleCount(PAGE_SIZE);
  };
  const applyAdvancedFilters = (next: MemberFilters) => {
    setFilters(next);
    setVisibleCount(PAGE_SIZE);
    setFiltersOpen(false);
  };

  const changeSort = (next: MemberSort) => {
    setSortBy(next);
    setVisibleCount(PAGE_SIZE);
  };

  useEffect(() => {
    if (!actionsOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActionsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionsOpen]);

  const handleExtendActiveMembers = async () => {
    if (activeUsers.length === 0) {
      window.alert(copy.noActiveFound);
      return;
    }
    if (!window.confirm(copy.extendConfirm.replace("{count}", String(activeUsers.length)))) return;
    setExtending(true);
    try {
      // Existing server-guarded RPC; never run without an explicit confirmation.
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
    setUsers((current) =>
      current.map((user) => user.id === userId
        ? { ...user, participationCreditBalance: balance } : user),
    );
  };

  const tabs: Array<{ id: MembersTab; label: string; count: number }> = [
    { id: "members", label: copy.membersTabShort, count: users.length },
    { id: "feedback", label: copy.feedbackTabShort, count: feedback.length },
    { id: "applicants", label: copy.applicantsTabShort, count: applications.length },
  ];

  if (loading) {
    return (
      <main className={wrapperClass} aria-busy="true">
        <div className={sectionClass}>
          <h1 className="m-0 text-[20px] font-extrabold text-[#191919]">{copy.membersPageTitle}</h1>
          <p className="mt-3 text-[13px] text-[#777]">{t.admin.dashboard.loading}</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((key) =>
              <div key={key} className="h-[82px] animate-pulse rounded-xl bg-[#f1f1f1]" />)}
          </div>
          <div className="mt-5 h-11 animate-pulse rounded-xl bg-[#f1f1f1]" />
          <div className="mt-5 h-28 animate-pulse rounded-xl bg-[#f1f1f1]" />
        </div>
      </main>
    );
  }

  return (
    <main className={wrapperClass}>
      <div className={sectionClass}>
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 text-[21px] font-extrabold leading-tight tracking-[-0.03em] text-[#171717] sm:text-[25px]">
              {copy.membersPageTitle}
            </h1>
            <p className="m-0 mt-1 text-[12px] text-[#777]">
              {copy.totalMemberCount.replace("{count}", String(users.length))}
            </p>
          </div>
          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              aria-label={copy.moreActions}
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e3e3e3] text-[#3d3d3d] hover:bg-[#f6f6f6] focus-visible:outline-2 focus-visible:outline-[#f47a4a]"
            >
              <EllipsisHorizontalIcon className="h-5 w-5" />
            </button>
            {actionsOpen && (
              <div role="menu" className="absolute right-0 top-11 z-20 w-[min(285px,85vw)] rounded-xl border border-[#e5e5e5] bg-white p-1.5 shadow-lg">
                <button
                  type="button"
                  role="menuitem"
                  disabled={extending || activeUsers.length === 0}
                  onClick={() => {
                    setActionsOpen(false);
                    void handleExtendActiveMembers();
                  }}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold text-[#343434] hover:bg-[#f6f6f6] disabled:cursor-not-allowed disabled:text-[#aaa]"
                >
                  {extending ? copy.extending
                    : activeUsers.length ? copy.extendActive.replace("{count}", String(activeUsers.length))
                      : copy.noActiveMembers}
                </button>
                <p className="m-0 px-3 pb-1 pt-1 text-[11px] leading-relaxed text-[#888]">
                  {copy.bulkActionHint}
                </p>
              </div>
            )}
          </div>
        </header>

        <nav role="tablist" aria-label={copy.tabListLabel} className="mt-4 flex gap-5 overflow-x-auto border-b border-[#e9e9e9] sm:mt-5">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={id + "-tab"}
              aria-selected={tab === id}
              aria-controls={id + "-panel"}
              onClick={() => setTab(id)}
              className={
                "min-h-10 shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-2 pt-1 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[#f47a4a] " +
                (tab === id
                  ? "border-[#1e1e1e] text-[#202020]"
                  : "border-transparent text-[#8d8d8d] hover:text-[#454545]")
              }
            >
              {label}
              <span className={"ml-1.5 tabular-nums " + (tab === id ? "text-[#222]" : "text-[#aaa]")}>
                {count}
              </span>
            </button>
          ))}
        </nav>

        {tab === "members" && (
          <div id="members-panel" role="tabpanel" aria-labelledby="members-tab" className="pt-4">
            <section aria-label={copy.memberOverviewLabel} className="grid grid-cols-3 gap-2 sm:gap-3">
              {([
                {
                  id: "ongoing", label: copy.summaryOngoing, count: stats.ongoing,
                  tone: "border-[#e3f1e7] bg-[#f2faf4] text-[#17743e]",
                  onClick: () => setSummaryFilter({ ...DEFAULT_MEMBER_FILTERS, status: "ongoing" }),
                  active: filters.status === "ongoing" && filters.purchase === "all" && filters.location === "all",
                },
                {
                  id: "stopped", label: copy.summaryStopped, count: stats.stopped,
                  tone: "border-[#f8ebdb] bg-[#fff8f0] text-[#a45122]",
                  onClick: () => setSummaryFilter({ ...DEFAULT_MEMBER_FILTERS, status: "cancelled" }),
                  active: filters.status === "cancelled" && filters.purchase === "all" && filters.location === "all",
                },
                {
                  id: "pass", label: copy.summaryPass, count: stats.pass,
                  tone: "border-[#e9edf1] bg-[#f7f8fa] text-[#424b5c]",
                  onClick: () => setSummaryFilter({ ...DEFAULT_MEMBER_FILTERS, purchase: "pass" }),
                  active: filters.purchase === "pass" && filters.status === "all" && filters.location === "all",
                },
              ]).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  disabled={item.id === "pass" && !purchaseDataAvailable}
                  aria-pressed={item.active}
                  className={
                    "min-w-0 rounded-xl border p-2.5 text-left transition-colors hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f47a4a] disabled:cursor-not-allowed disabled:opacity-50 sm:p-4 " +
                    item.tone + (item.active ? " ring-1 ring-current" : "")
                  }
                >
                  <span className="block truncate text-[10px] font-bold sm:text-[12px]">{item.label}</span>
                  <strong className="mt-1 block text-[21px] leading-none font-extrabold tabular-nums sm:text-[26px]">{item.count}</strong>
                </button>
              ))}
            </section>

            <div className="mt-4 sm:mt-5">
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#dcdcdc] bg-white px-3 focus-within:border-[#f47a4a] focus-within:ring-2 focus-within:ring-[#f47a4a]/15">
                <MagnifyingGlassIcon className="h-[18px] w-[18px] shrink-0 text-[#888]" />
                <span className="sr-only">{copy.searchMembers}</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => { setSearchQuery(event.target.value); setVisibleCount(PAGE_SIZE); }}
                  placeholder={copy.searchMembers}
                  className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[14px] text-[#252525] outline-none placeholder:text-[#aaa]"
                />
              </label>
              <div className="mt-3 flex min-w-0 items-center gap-2">
                <div className="-mr-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1">
                  {([
                    ["all", copy.quickFilterAll],
                    ["ongoing", copy.summaryOngoing],
                    ["cancelled", copy.summaryStopped],
                  ] as const).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={filters.status === status}
                      onClick={() => setStatusFilter(status)}
                      className={
                        "min-h-9 shrink-0 rounded-full border px-3 text-[12px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[#f47a4a] " +
                        (filters.status === status
                          ? "border-[#232323] bg-[#232323] text-white"
                          : "border-[#dedede] bg-white text-[#545454] hover:border-[#aaa]")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className={lightButtonClass + " shrink-0"}
                  aria-label={copy.advancedFilters}
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  <span>{copy.advancedFilters}</span>
                  {hiddenFilterCount > 0 && (
                    <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#f47a4a] px-1 text-[10px] font-black text-[#1b1b1b]">
                      {hiddenFilterCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="m-0 text-[12px] text-[#777]">
                    {copy.displayCount
                      .replace("{shown}", String(filteredUsers.length))
                      .replace("{total}", String(users.length))}
                  </p>
                  {(filters.status !== "all" || hiddenFilterCount > 0) && (
                    <button type="button" onClick={() => setSummaryFilter(DEFAULT_MEMBER_FILTERS)}
                      className="text-[11px] font-semibold text-[#b45b36] underline underline-offset-2">
                      {copy.resetFilters}
                    </button>
                  )}
                </div>
                <label className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#727272]">
                  <span className="sr-only">{copy.sortLabel}</span>
                  <select
                    value={sortBy}
                    onChange={(event) => changeSort(event.target.value as MemberSort)}
                    className="max-w-[150px] cursor-pointer appearance-none bg-transparent py-1 pl-1 pr-1 text-right text-[12px] font-semibold text-[#535353] outline-none"
                    aria-label={copy.sortLabel}
                  >
                    <option value="newest">{copy.sortNewest}</option>
                    <option value="oldest">{copy.sortOldest}</option>
                    <option value="name">{copy.sortName}</option>
                    <option value="payment_desc">{copy.sortPaymentHigh}</option>
                    <option value="payment_asc">{copy.sortPaymentLow}</option>
                    <option value="credits_desc">{copy.sortCreditsHigh}</option>
                  </select>
                  <ChevronDownIcon className="h-3 w-3" />
                </label>
              </div>

              {!purchaseDataAvailable && (
                <p role="alert" className="m-0 mt-2 rounded-lg bg-[#fff4e7] p-3 text-[12px] text-[#8c4e18]">
                  {copy.purchaseLoadError}
                </p>
              )}
            </div>

            {filteredUsers.length === 0 ? (
              <div className="mt-5 rounded-xl border border-[#ededed] bg-[#fafafa] px-4 py-12 text-center">
                <p className="m-0 text-[13px] font-semibold text-[#6c6c6c]">{copy.noMembersMatch}</p>
                <button type="button" onClick={() => {
                  setFilters(DEFAULT_MEMBER_FILTERS);
                  setSearchQuery("");
                  setVisibleCount(PAGE_SIZE);
                }} className="mt-3 text-[12px] font-semibold text-[#b45b36] underline underline-offset-2">
                  {copy.resetSearchAndFilters}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:hidden">
                  {shownUsers.map((user) => (
                    <MemberMobileCard
                      key={user.id}
                      user={user}
                      onView={() => setSelectedMemberId(user.id)}
                    />
                  ))}
                </div>
                <div className="mt-3 hidden overflow-x-auto rounded-xl border border-[#e7e7e7] lg:block">
                  <table className="w-full min-w-[1050px] border-collapse">
                    <thead className="border-b border-[#ededed] bg-[#f9f9f9]">
                      <tr>
                        <TableSortHeader
                          label={copy.tableMember}
                          active={sortBy === "name"}
                          onClick={() => changeSort("name")}
                        />
                        <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold text-[#767676]">{copy.tableProduct}</th>
                        <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold text-[#767676]">{copy.tableStatus}</th>
                        <TableSortHeader
                          label={copy.tablePayment}
                          active={sortBy === "payment_desc" || sortBy === "payment_asc"}
                          align="right"
                          onClick={() => changeSort(sortBy === "payment_desc" ? "payment_asc" : "payment_desc")}
                        />
                        <TableSortHeader
                          label={copy.tableCredits}
                          active={sortBy === "credits_desc"}
                          align="right"
                          onClick={() => changeSort("credits_desc")}
                        />
                        <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold text-[#767676]">{copy.tableLocation}</th>
                        <TableSortHeader
                          label={copy.tableJoined}
                          active={sortBy === "newest" || sortBy === "oldest"}
                          onClick={() => changeSort(sortBy === "newest" ? "oldest" : "newest")}
                        />
                        <th scope="col" className="px-3 py-3 text-right text-[11px] font-bold text-[#767676]">{copy.tableDetails}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownUsers.map((user) => (
                        <MemberDesktopRow
                          key={user.id}
                          user={user}
                          onView={() => setSelectedMemberId(user.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleCount < filteredUsers.length && (
                  <div className="mt-5 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                      className={lightButtonClass + " min-h-10 px-5"}
                    >
                      {copy.loadMore.replace("{count}", String(filteredUsers.length - shownUsers.length))}
                      <ChevronDownIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "feedback" && (
          <div id="feedback-panel" role="tabpanel" aria-labelledby="feedback-tab" className="pt-4">
            <FeedbackList feedback={feedback} usersById={usersById} />
          </div>
        )}
        {tab === "applicants" && (
          <div id="applicants-panel" role="tabpanel" aria-labelledby="applicants-tab" className="pt-4">
            <ApplicantsList applications={applications} usersById={usersById} />
          </div>
        )}
      </div>

      {filtersOpen && (
        <MemberFiltersDialog
          initialFilters={filters}
          purchaseDataAvailable={purchaseDataAvailable}
          countMatches={countMatches}
          onApply={applyAdvancedFilters}
          onClose={closeFilters}
        />
      )}
      {selectedUser && (
        <MemberDetailsDrawer
          user={selectedUser}
          onClose={closeDetails}
          onBalanceChange={handleBalanceChange}
        />
      )}
    </main>
  );
}
