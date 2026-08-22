"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";

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

const Wrapper = styled.main`
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px 20px;
  flex-direction: column;
  gap: 30px;
`;

const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 10px;

  @media (max-width: 980px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const QuickAction = styled.button`
  min-height: 132px;
  padding: 18px;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  color: #050505;
  cursor: pointer;
  text-align: left;
  box-shadow: 3px 3px 0 #f47a4a;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0 #f47a4a;
  }

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 3px;
  }
`;

const QuickActionLabel = styled.div`
  font-size: 16px;
  font-weight: 900;
`;

const QuickActionDescription = styled.p`
  margin: 8px 0 0;
  color: rgba(5, 5, 5, 0.64);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
`;

const Header = styled.div`
  margin-bottom: 20px;
`;

const Title = styled.h1`
  margin: 0;
  color: #050505;
  font-size: 28px;
  font-weight: 900;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled.div`
  border: 3px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  padding: 24px;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
`;

const StatNumber = styled.div`
  margin-bottom: 8px;
  color: #050505;
  font-size: 32px;
  font-weight: 900;
`;

const StatLabel = styled.div`
  color: rgba(5, 5, 5, 0.6);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
`;

const StatSubtext = styled.div`
  margin-top: 4px;
  color: rgba(5, 5, 5, 0.6);
  font-size: 12px;
`;

const Loading = styled.div`
  padding: 40px;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 700;
  text-align: center;
`;

const QUICK_ACTIONS = [
  ["members", "/admin/members"],
  ["articles", "/admin/articles"],
  ["marketing", "/admin/marketing"],
  ["notifications", "/admin/notifications"],
  ["gifts", "/admin/gifts"],
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
    return <Loading>{t.admin.dashboard.loading}</Loading>;
  }

  return (
    <Wrapper>
      <QuickActionsGrid aria-label={t.admin.dashboard.title}>
        {QUICK_ACTIONS.map(([id, path]) => (
          <QuickAction key={id} type="button" onClick={() => router.push(path)}>
            <QuickActionLabel>{t.admin.dashboard.sections[id].label}</QuickActionLabel>
            <QuickActionDescription>{t.admin.dashboard.sections[id].description}</QuickActionDescription>
          </QuickAction>
        ))}
      </QuickActionsGrid>

      <div>
        <Header>
          <Title>{t.admin.dashboard.title}</Title>
        </Header>
        <StatsGrid>
          <StatCard>
            <StatNumber>{stats.totalMembers}</StatNumber>
            <StatLabel>{t.admin.dashboard.stats.totalMembers.label}</StatLabel>
            <StatSubtext>{t.admin.dashboard.stats.totalMembers.description}</StatSubtext>
          </StatCard>
          <StatCard>
            <StatNumber>{stats.activeSubscriptions}</StatNumber>
            <StatLabel>{t.admin.dashboard.stats.activeSubscriptions.label}</StatLabel>
            <StatSubtext>{t.admin.dashboard.stats.activeSubscriptions.description}</StatSubtext>
          </StatCard>
          <StatCard>
            <StatNumber>{stats.cancelledBilling}</StatNumber>
            <StatLabel>{t.admin.dashboard.stats.cancelledBilling.label}</StatLabel>
            <StatSubtext>{t.admin.dashboard.stats.cancelledBilling.description}</StatSubtext>
          </StatCard>
          <StatCard>
            <StatNumber>{stats.newMembersThisMonth}</StatNumber>
            <StatLabel>{t.admin.dashboard.stats.newMembers.label}</StatLabel>
            <StatSubtext>{t.admin.dashboard.stats.newMembers.description}</StatSubtext>
          </StatCard>
          <StatCard>
            <StatNumber>{stats.totalEvents}</StatNumber>
            <StatLabel>{t.admin.dashboard.stats.totalEvents.label}</StatLabel>
            <StatSubtext>{t.admin.dashboard.stats.totalEvents.description}</StatSubtext>
          </StatCard>
          <StatCard>
            <StatNumber>{stats.purchasingMembers}</StatNumber>
            <StatLabel>{t.admin.dashboard.stats.payingMembers.label}</StatLabel>
            <StatSubtext>{t.admin.dashboard.stats.payingMembers.description}</StatSubtext>
          </StatCard>
        </StatsGrid>
      </div>
    </Wrapper>
  );
}
