"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { supabase } from "../lib/supabase/client";
import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import AdminTodayPanel from "./AdminTodayPanel";

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

const headerClass = "mb-5 flex flex-wrap items-baseline justify-between gap-3";

const titleClass = "m-0 text-[#050505] text-[22px] font-black";

const statsGridClass =
  "grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 mb-[30px]";

const statCardClass =
  "border-[3px] border-[#050505] rounded-2xl bg-white p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)]";

const statNumberClass = "mb-2 text-[#050505] text-[32px] font-black";

const statLabelClass =
  "text-[rgba(5,5,5,0.6)] text-[14px] font-bold tracking-[0.5px] uppercase";

const statSubtextClass = "mt-1 text-[rgba(5,5,5,0.6)] text-[12px]";

const loadingClass = "p-10 text-[rgba(5,5,5,0.6)] font-bold text-center";

const EMPTY_STATS: DashboardStats = {
  totalMembers: 0,
  activeSubscriptions: 0,
  cancelledBilling: 0,
  newMembersThisMonth: 0,
  totalEvents: 0,
  purchasingMembers: 0,
};

export default function AdminDashboardClient() {
  const { t } = useI18n();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);

  useEffect(() => {
    // app/admin/layout.tsx has already redirected anyone who is not an admin, on the
    // server; this only waits for the browser session so RLS sees it.
    if (authLoading || !currentUser || accountStatus !== "admin") return;

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
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
      } catch (error) {
        // A thrown request (offline, aborted) must not leave the dashboard spinning.
        console.error("Error loading admin dashboard:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [accountStatus, authLoading, currentUser]);

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
      <AdminTodayPanel />

      <div>
        <div className={headerClass}>
          <h2 className={titleClass}>{t.admin.today.keyMetrics}</h2>
          <Link href="/admin/analytics" className="text-[13px] font-black text-[#e0602e] no-underline hover:underline">
            {t.admin.today.viewAnalytics}
          </Link>
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
