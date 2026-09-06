"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "../lib/supabase/client";
import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";

type DashboardStats = {
  totalMembers: number;
  activeSubscriptions: number;
  cancelledBilling: number;
  newMembersThisMonth: number;
  totalEvents: number;
  purchasingMembers: number;
};

type DashboardUser = {
  accountStatus: string | null;
  hasActiveSubscription: boolean;
  billingCancelled: boolean;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  createdAt: string | null;
};

const wrapperClass =
  "flex max-w-[1400px] mx-auto pt-0 px-5 pb-5 flex-col gap-[30px]";

const quickActionsGridClass =
  "grid grid-cols-3 gap-3.5 mb-2.5 max-[980px]:grid-cols-2 max-[560px]:grid-cols-1";

const quickActionClass =
  "min-h-[132px] p-[18px] border-2 border-[#050505] rounded-xl bg-white text-[#050505] cursor-pointer text-left shadow-[3px_3px_0_#f47a4a] transition-[translate,box-shadow] duration-[140ms] ease-[ease] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#f47a4a] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-[3px]";

const quickActionLabelClass = "text-[16px] font-black";

const quickActionDescriptionClass =
  "mx-0 mt-2 mb-0 text-[rgba(5,5,5,0.64)] text-[13px] font-semibold leading-[1.5]";

const headerClass = "mb-5";

const titleClass = "m-0 text-[#050505] text-[28px] font-black";

const statsGridClass =
  "grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 mb-[30px]";

const statCardClass =
  "border-[3px] border-[#050505] rounded-2xl bg-white p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)]";

const statNumberClass = "mb-2 text-[#050505] text-[32px] font-black";

const statLabelClass =
  "text-[rgba(5,5,5,0.6)] text-[14px] font-bold tracking-[0.5px] uppercase";

const statSubtextClass = "mt-1 text-[rgba(5,5,5,0.6)] text-[12px]";

const loadingClass = "p-10 text-[rgba(5,5,5,0.6)] font-bold text-center";

const QUICK_ACTIONS = [
  ["members", "/admin/members"],
  ["articles", "/admin/articles"],
  ["shadow", "/admin/shadow"],
  ["marketing", "/admin/marketing"],
  ["notifications", "/admin/notifications"],
  ["gifts", "/admin/gifts"],
  ["testCenter", "/admin/test-center"],
] as const;

const EMPTY_STATS: DashboardStats = {
  totalMembers: 0,
  activeSubscriptions: 0,
  cancelledBilling: 0,
  newMembersThisMonth: 0,
  totalEvents: 0,
  purchasingMembers: 0,
};

export default function AdminDashboardClient() {
  const router = useRouter();
  const { t } = useI18n();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.replace("/");
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      const [usersResult, eventsResult] = await Promise.all([
        supabase
          .from("users")
          .select("account_status, has_active_subscription, billing_cancelled, subscription_start_date, subscription_end_date, created_at")
          .eq("is_placeholder", false),
        supabase.from("meetups").select("*", { count: "exact", head: true }),
      ]);

      if (!active) return;
      if (usersResult.error) {
        console.error("Error loading admin dashboard users:", usersResult.error);
        setUsers([]);
      } else {
        setUsers(
          (usersResult.data ?? []).map((row) => ({
            accountStatus: row.account_status ?? null,
            hasActiveSubscription: row.has_active_subscription === true,
            billingCancelled: row.billing_cancelled === true,
            subscriptionStartDate: row.subscription_start_date ?? null,
            subscriptionEndDate: row.subscription_end_date ?? null,
            createdAt: row.created_at ?? null,
          })),
        );
      }
      if (eventsResult.error) {
        console.error("Error loading admin dashboard meetup count:", eventsResult.error);
        setTotalEvents(0);
      } else {
        setTotalEvents(eventsResult.count ?? 0);
      }
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [accountStatus, authLoading, currentUser, router]);

  const stats = useMemo<DashboardStats>(() => {
    if (loading) return EMPTY_STATS;
    const members = users.filter((user) => user.accountStatus !== "admin");
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return {
      totalMembers: members.length,
      activeSubscriptions: members.filter((user) => user.hasActiveSubscription).length,
      cancelledBilling: members.filter((user) => user.billingCancelled).length,
      newMembersThisMonth: members.filter((user) => {
        if (!user.createdAt) return false;
        const createdAt = new Date(user.createdAt);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= startOfMonth;
      }).length,
      totalEvents,
      purchasingMembers: members.filter(
        (user) =>
          user.hasActiveSubscription ||
          Boolean(user.subscriptionStartDate) ||
          Boolean(user.subscriptionEndDate),
      ).length,
    };
  }, [loading, totalEvents, users]);

  if (authLoading || loading || !currentUser || accountStatus !== "admin") {
    return <div className={loadingClass}>{t.admin.dashboard.loading}</div>;
  }

  return (
    <main className={wrapperClass}>
      <div className={quickActionsGridClass} aria-label={t.admin.dashboard.title}>
        {QUICK_ACTIONS.map(([id, path]) => (
          <button key={id} type="button" className={quickActionClass} onClick={() => router.push(path)}>
            <div className={quickActionLabelClass}>{t.admin.dashboard.sections[id].label}</div>
            <p className={quickActionDescriptionClass}>{t.admin.dashboard.sections[id].description}</p>
          </button>
        ))}
      </div>

      <div>
        <div className={headerClass}>
          <h1 className={titleClass}>{t.admin.dashboard.title}</h1>
        </div>
        <div className={statsGridClass}>
          <div className={statCardClass}>
            <div className={statNumberClass}>{stats.totalMembers}</div>
            <div className={statLabelClass}>{t.admin.dashboard.stats.totalMembers.label}</div>
            <div className={statSubtextClass}>{t.admin.dashboard.stats.totalMembers.description}</div>
          </div>
          <div className={statCardClass}>
            <div className={statNumberClass}>{stats.activeSubscriptions}</div>
            <div className={statLabelClass}>{t.admin.dashboard.stats.activeSubscriptions.label}</div>
            <div className={statSubtextClass}>{t.admin.dashboard.stats.activeSubscriptions.description}</div>
          </div>
          <div className={statCardClass}>
            <div className={statNumberClass}>{stats.cancelledBilling}</div>
            <div className={statLabelClass}>{t.admin.dashboard.stats.cancelledBilling.label}</div>
            <div className={statSubtextClass}>{t.admin.dashboard.stats.cancelledBilling.description}</div>
          </div>
          <div className={statCardClass}>
            <div className={statNumberClass}>{stats.newMembersThisMonth}</div>
            <div className={statLabelClass}>{t.admin.dashboard.stats.newMembers.label}</div>
            <div className={statSubtextClass}>{t.admin.dashboard.stats.newMembers.description}</div>
          </div>
          <div className={statCardClass}>
            <div className={statNumberClass}>{stats.totalEvents}</div>
            <div className={statLabelClass}>{t.admin.dashboard.stats.totalEvents.label}</div>
            <div className={statSubtextClass}>{t.admin.dashboard.stats.totalEvents.description}</div>
          </div>
          <div className={statCardClass}>
            <div className={statNumberClass}>{stats.purchasingMembers}</div>
            <div className={statLabelClass}>{t.admin.dashboard.stats.payingMembers.label}</div>
            <div className={statSubtextClass}>{t.admin.dashboard.stats.payingMembers.description}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
