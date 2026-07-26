"use client";

import { useState, useEffect, useMemo } from "react";
import styled from "styled-components";
import { supabase, invokeFunction } from "../lib/supabase/client";
import { useAuth } from "../lib/contexts/auth_context";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import { CalendarDaysIcon, TrashIcon } from "@heroicons/react/24/outline";
import GrowthDashboard from "../lib/features/growth/components/GrowthDashboard";

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 20px 20px;
  max-width: 1400px;
  margin: 0 auto;
  gap: 30px;
  background: transparent;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 900;
  color: #050505;
  margin: 0;
`;

const RefreshButton = styled.button`
  background: #ffffff;
  color: #050505;
  padding: 11px 20px;
  border: 2px solid #050505;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 3px 3px 0 #f47a4a;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #f47a4a;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  border: 3px solid #050505;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0 rgba(5, 5, 5, 0.9);
  }
`;

const StatNumber = styled.div`
  font-size: 32px;
  font-weight: 900;
  color: #050505;
  margin-bottom: 8px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatSubtext = styled.div`
  font-size: 12px;
  color: rgba(5, 5, 5, 0.6);
  margin-top: 4px;
`;

const TabContainer = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.35rem;
  margin-bottom: 24px;
  box-shadow: 3px 3px 0 #f47a4a;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 9px 20px;
  border: 0;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  background: ${(props) => (props.active ? "#050505" : "transparent")};
  color: ${(props) => (props.active ? "#ffffff" : "#475569")};
  transition: background 0.16s ease, color 0.16s ease, transform 0.16s ease;

  &:hover {
    color: ${(props) => (props.active ? "#ffffff" : "#050505")};
    transform: translateY(-1px);
  }
`;

const ContentSection = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  border: 3px solid #050505;
`;

const SectionTitle = styled.h2`
  display: inline-flex;
  align-items: center;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.3rem 0.7rem;
  font-size: 16px;
  font-weight: 900;
  margin-bottom: 20px;
`;

const UsersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const UserCard = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 16px;
  border: 1.5px solid #050505;
  border-radius: 10px;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.85);
  }
`;

const UserInfo = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  gap: 16px;
  align-items: center;
`;

const UserName = styled.div`
  font-weight: 800;
  color: #050505;
  font-size: 14px;
`;

const UserEmail = styled.div`
  color: rgba(5, 5, 5, 0.6);
  font-size: 13px;
`;

const UserStatus = styled.div<{ active: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1.5px solid #050505;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  background-color: ${(props) => (props.active ? "#dcfce7" : "#fee2e2")};
  color: #050505;
`;

const GdgStatus = styled.div<{ $isMember: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1.5px solid #050505;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  background-color: ${(props) => (props.$isMember ? "#f47a4a" : "#ffffff")};
  color: #050505;
`;

const UserDate = styled.div`
  color: rgba(5, 5, 5, 0.6);
  font-size: 12px;
`;

const FeedbackList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FeedbackCard = styled.div`
  border: 1.5px solid #050505;
  border-radius: 10px;
  padding: 20px;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.85);
  }
`;

const FeedbackHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const FeedbackCategory = styled.div<{ category: string }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1.5px solid #050505;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: ${(props) =>
    props.category === "cancellation" ? "#fef3c7" : "#f47a4a"};
  color: #050505;
`;

const FeedbackDate = styled.div`
  color: rgba(5, 5, 5, 0.6);
  font-size: 12px;
`;

const FeedbackUser = styled.div`
  color: #050505;
  font-weight: 800;
  font-size: 14px;
  margin-bottom: 8px;
`;

const FeedbackReasons = styled.div`
  margin-bottom: 12px;
`;

const ReasonsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 8px 0;
`;

const ReasonItem = styled.li`
  padding: 4px 0;
  color: rgba(5, 5, 5, 0.72);
  font-size: 14px;

  &:before {
    content: "•";
    color: #f47a4a;
    font-weight: 900;
    margin-right: 8px;
  }
`;

const FeedbackOther = styled.div`
  background-color: #faf8f4;
  border: 1.5px solid #050505;
  border-left: 4px solid #f47a4a;
  padding: 12px;
  margin-top: 8px;
  border-radius: 8px;
  font-style: italic;
  color: rgba(5, 5, 5, 0.72);
`;

const ArticlesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ArticleCard = styled.button`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 20px;
  border-radius: 12px;
  border: 2px solid #050505;
  background: #ffffff;
  color: #050505;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
  cursor: pointer;
  text-align: left;

  &:hover {
    box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
    transform: translate(-2px, -2px);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 4px 4px 0 #f47a4a;
  }
`;

const ArticleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
`;

const ArticleTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: #050505;
`;

const ArticleSubtitle = styled.div`
  font-size: 14px;
  color: rgba(5, 5, 5, 0.6);
`;

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: rgba(5, 5, 5, 0.6);
`;

const ArticleActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
`;

const ArticleActionButton = styled.button<{ $variant?: "danger" }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 2px solid #050505;
  background: ${(props) => (props.$variant === "danger" ? "#fee2e2" : "#ffffff")};
  color: ${(props) => (props.$variant === "danger" ? "#991b1b" : "#050505")};
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
  box-shadow: 2px 2px 0 ${(props) => (props.$variant === "danger" ? "#991b1b" : "#050505")};

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 ${(props) => (props.$variant === "danger" ? "#991b1b" : "#050505")};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
    box-shadow: none;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const MembersToolbar = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 18px;
  gap: 12px;
`;

const MembersActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 22px;
  border-radius: 999px;
  border: 2px solid #050505;
  background: #f47a4a;
  color: #050505;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
  box-shadow: 3px 3px 0 #050505;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #050505;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
    box-shadow: none;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 700;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 700;
`;

// Interfaces
interface UserData {
  id: string;
  email?: string;
  displayName?: string;
  createdAt?: Date | string;
  hasActiveSubscription?: boolean;
  billingCancelled?: boolean;
  subscriptionStartDate?: Date | string;
  subscriptionEndDate?: Date | string;
  account_status?: string;
  gdg_member?: boolean;
}

interface FeedbackData {
  id: string;
  userId: string;
  category: "cancellation" | "refund";
  reasons: string[];
  otherReason?: string;
  timestamp: Date | string;
}

interface DashboardStats {
  totalMembers: number;
  activeSubscriptions: number;
  cancelledBilling: number;
  newMembersThisMonth: number;
  totalEvents: number;
  purchasingMembers: number;
}

interface ArticleData {
  id: string;
  titleEnglish?: string;
  titleKorean?: string;
  publishedAt?: Date;
}

export default function AdminClient() {
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "members" | "feedback" | "articles" | "growth"
  >("dashboard");
  const [users, setUsers] = useState<UserData[]>([]);
  const [feedback, setFeedback] = useState<FeedbackData[]>([]);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(
    null
  );
  const [extendingSubscriptions, setExtendingSubscriptions] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeSubscriptions: 0,
    cancelledBilling: 0,
    newMembersThisMonth: 0,
    totalEvents: 0,
    purchasingMembers: 0,
  });
  const router = useRouter();
  const { currentUser, accountStatus } = useAuth();

  const usersById = useMemo(() => {
    const entries = new Map<string, UserData>();
    users.forEach((user) => {
      entries.set(user.id, user);
    });
    return entries;
  }, [users]);

  const activeMembersCount = useMemo(() => {
    return users.filter((user) => user.hasActiveSubscription).length;
  }, [users]);

  useEffect(() => {
    const checkAdminAccess = () => {
      console.log("Admin access check starting...");

      if (!currentUser) {
        console.log("No user found, redirecting to auth");
        router.push("/auth");
        return;
      }

      console.log("User found:", currentUser.email, "UID:", currentUser.uid);
      console.log("Account status:", accountStatus);

      if (accountStatus !== "admin") {
        console.log("User is not admin, redirecting to home");
        router.push("/");
        return;
      }

      console.log("User is admin, loading dashboard data");
      setAuthChecking(false);
      // User is admin, load dashboard data
      loadDashboardData();
    };

    // Wait for the auth context to resolve the session before gating.
    if (currentUser === null && accountStatus === null) {
      return;
    }

    checkAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, currentUser, accountStatus]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [usersData, feedbackData, eventsCount, articlesData] =
        await Promise.all([
          fetchUsers(),
          fetchFeedback(),
          fetchEventsCount(),
          fetchArticles(),
        ]);

      setUsers(usersData);
      setFeedback(feedbackData);
      setArticles(articlesData);
      calculateStats(usersData, eventsCount);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (): Promise<UserData[]> => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.uid,
        email: row.email ?? undefined,
        displayName: row.display_name ?? undefined,
        createdAt: row.created_at ?? undefined,
        hasActiveSubscription: row.has_active_subscription ?? false,
        billingCancelled: row.billing_cancelled ?? false,
        subscriptionStartDate: row.subscription_start_date ?? undefined,
        subscriptionEndDate: row.subscription_end_date ?? undefined,
        account_status: row.account_status ?? undefined,
        gdg_member: row.gdg_member ?? false,
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  };

  const fetchFeedback = async (): Promise<FeedbackData[]> => {
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .neq("kind", "survey") // this view shows cancellation/refund feedback; surveys have no category
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id ?? "",
        category: row.category,
        reasons: row.reasons ?? [],
        otherReason: row.other_reason ?? undefined,
        timestamp: row.created_at,
      }));
    } catch (error) {
      console.error("Error fetching feedback:", error);
      return [];
    }
  };

  const fetchEventsCount = async (): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from("meetups")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    } catch (error) {
      console.error("Error fetching events count:", error);
      return 0;
    }
  };

  const fetchArticles = async (): Promise<ArticleData[]> => {
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("timestamp", { ascending: false });
      if (error) throw error;

      const articlesData: ArticleData[] = (data || []).map((row: any) => {
        const rawTimestamp = row.timestamp ?? row.created_at ?? null;

        let publishedAt: Date | undefined;
        if (typeof rawTimestamp === "string") {
          const parsed = new Date(rawTimestamp);
          if (!Number.isNaN(parsed.getTime())) {
            publishedAt = parsed;
          }
        } else if (rawTimestamp instanceof Date) {
          publishedAt = rawTimestamp;
        }

        return {
          id: row.id,
          titleEnglish: row.title?.english ?? "",
          titleKorean: row.title?.korean ?? "",
          publishedAt,
        };
      });

      return articlesData.sort((a, b) => {
        const aTime = a.publishedAt ? a.publishedAt.getTime() : 0;
        const bTime = b.publishedAt ? b.publishedAt.getTime() : 0;
        return bTime - aTime;
      });
    } catch (error) {
      console.error("Error fetching articles:", error);
      return [];
    }
  };

  const calculateStats = (usersData: UserData[], totalEvents: number) => {
     const now = new Date();
     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
 
    const purchasingMembers = usersData.filter((user) =>
      Boolean(
        user.hasActiveSubscription ||
          user.subscriptionStartDate ||
          user.subscriptionEndDate
      )
    ).length;

    const newStats: DashboardStats = {
      totalMembers: usersData.length,
      activeSubscriptions: usersData.filter((u) => u.hasActiveSubscription)
        .length,
      cancelledBilling: usersData.filter((u) => u.billingCancelled).length,
      newMembersThisMonth: usersData.filter((u) => {
        const createdAtDate = resolveToDate(u.createdAt);
        if (!createdAtDate) {
          return false;
        }
        return createdAtDate >= startOfMonth;
      }).length,
      totalEvents,
      purchasingMembers,
    };
 
     setStats(newStats);
   };
 
  const resolveToDate = (value?: Date | string): Date | null => {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  };

  const handleExtendActiveMembers = async () => {
    const activeUsers = users.filter((user) => user.hasActiveSubscription);

    if (activeUsers.length === 0) {
      window.alert("No active members found to extend.");
      return;
    }

    const confirmed = window.confirm(
      `Extend the subscription end date by 14 days for ${activeUsers.length} active ${
        activeUsers.length === 1 ? "member" : "members"
      }?`
    );

    if (!confirmed) {
      return;
    }

    setExtendingSubscriptions(true);

    try {
      // No client-side multi-row batch in Supabase; update each active user's
      // subscription_end_date individually (RLS admin policy on public.users allows it).
      for (const user of activeUsers) {
        const baseDate =
          resolveToDate(user.subscriptionEndDate) ||
          resolveToDate(user.subscriptionStartDate) ||
          new Date();
        const extendedDate = new Date(baseDate);
        extendedDate.setDate(extendedDate.getDate() + 14);

        const { error } = await supabase
          .from("users")
          .update({ subscription_end_date: extendedDate.toISOString() })
          .eq("uid", user.id);
        if (error) throw error;
      }

      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
      calculateStats(updatedUsers, stats.totalEvents);
      window.alert("Extended all active subscriptions by 14 days.");
    } catch (error) {
      console.error("Error extending active subscriptions:", error);
      window.alert("Failed to extend active subscriptions. Please try again.");
    } finally {
      setExtendingSubscriptions(false);
    }
  };

  const handleArticleClick = (articleId: string) => {
    router.push(`/article/${articleId}`);
  };

  const handleDeleteArticle = async (articleId: string) => {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this article? This action cannot be undone."
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingArticleId(articleId);
    try {
      const { error } = await supabase
        .from("articles")
        .delete()
        .eq("id", articleId);
      if (error) throw error;
      setArticles((prev) => prev.filter((article) => article.id !== articleId));
    } catch (error) {
      console.error("Error deleting article:", error);
      window.alert("Failed to delete article. Please try again.");
    } finally {
      setDeletingArticleId(null);
    }
  };

  const formatDate = (value?: Date | string) => {
    const date = resolveToDate(value);
    if (!date) {
      return "-";
    }

    return format(date, "yyyy.MM.dd", { locale: ko });
  };

  const formatDateTime = (value?: Date | string) => {
    const date = resolveToDate(value);
    if (!date) {
      return "-";
    }

    return format(date, "yyyy.MM.dd HH:mm", { locale: ko });
  };

  const renderDashboard = () => (
    <>
      <StatsGrid>
        <StatCard>
          <StatNumber>{stats.totalMembers}</StatNumber>
          <StatLabel>Total Members</StatLabel>
          <StatSubtext>All registered users</StatSubtext>
        </StatCard>

        <StatCard>
          <StatNumber>{stats.activeSubscriptions}</StatNumber>
          <StatLabel>Active Subscriptions</StatLabel>
          <StatSubtext>Currently subscribed members</StatSubtext>
        </StatCard>

        <StatCard>
          <StatNumber>{stats.cancelledBilling}</StatNumber>
          <StatLabel>Cancelled Billing</StatLabel>
          <StatSubtext>Members who stopped billing</StatSubtext>
        </StatCard>

        <StatCard>
          <StatNumber>{stats.newMembersThisMonth}</StatNumber>
          <StatLabel>New This Month</StatLabel>
          <StatSubtext>New members this month</StatSubtext>
        </StatCard>

        <StatCard>
          <StatNumber>{stats.totalEvents}</StatNumber>
          <StatLabel>Total Events</StatLabel>
          <StatSubtext>Events hosted overall</StatSubtext>
        </StatCard>

        <StatCard>
          <StatNumber>{stats.purchasingMembers}</StatNumber>
          <StatLabel>Paying Members</StatLabel>
          <StatSubtext>Users with purchase history</StatSubtext>
        </StatCard>
      </StatsGrid>
    </>
  );

  const renderMembers = () => {
    const extendButtonLabel = extendingSubscriptions
      ? "Extending..."
      : activeMembersCount > 0
      ? `Extend ${activeMembersCount} Active ${
          activeMembersCount === 1 ? "Member" : "Members"
        } (+14 days)`
      : "No Active Members to Extend";

    return (
      <ContentSection>
        <SectionTitle>Member Management ({users.length} members)</SectionTitle>
        <MembersToolbar>
          <MembersActionButton
            type="button"
            onClick={handleExtendActiveMembers}
            disabled={extendingSubscriptions || activeMembersCount === 0}
          >
            <CalendarDaysIcon />
            {extendButtonLabel}
          </MembersActionButton>
        </MembersToolbar>
        <UsersList>
          {users.map((user) => (
            <UserCard key={user.id}>
              <UserInfo>
                <div>
                  <UserName>{user.displayName || "No Name"}</UserName>
                  <UserEmail>{user.email}</UserEmail>
                </div>

                <div>
                  <GdgStatus $isMember={user.gdg_member === true}>
                    {user.gdg_member ? "GDG Member" : "Non-GDG"}
                  </GdgStatus>
                </div>

                <UserStatus active={!!user.hasActiveSubscription}>
                  {user.hasActiveSubscription ? "Active" : "Inactive"}
                </UserStatus>

                <div>
                  {user.billingCancelled && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#dc2626",
                        fontWeight: "500",
                      }}
                    >
                      Billing Stopped
                    </div>
                  )}
                </div>

                <UserDate>{formatDate(user.createdAt)}</UserDate>
              </UserInfo>
            </UserCard>
          ))}
        </UsersList>
      </ContentSection>
    );
  };

  const renderFeedback = () => (
     <ContentSection>
       <SectionTitle>User Feedback ({feedback.length} items)</SectionTitle>
       <FeedbackList>
         {feedback.length === 0 ? (
           <EmptyState>No feedback yet.</EmptyState>
         ) : (
           feedback.map((item) => {
             const linkedUser = usersById.get(item.userId);
             const linkedDisplayName = linkedUser?.displayName;
 
             return (
               <FeedbackCard key={item.id}>
                 <FeedbackHeader>
                   <FeedbackCategory category={item.category}>
                     {item.category === "cancellation"
                       ? "Subscription Stop"
                       : "Refund Request"}
                   </FeedbackCategory>
                   <FeedbackDate>{formatDateTime(item.timestamp)}</FeedbackDate>
                 </FeedbackHeader>
 
                 <FeedbackUser>
                   {linkedDisplayName
                     ? `${linkedDisplayName} (${item.userId})`
                     : `User ID: ${item.userId}`}
                 </FeedbackUser>
 
                 <FeedbackReasons>
                   <strong>Selected Reasons:</strong>
                   <ReasonsList>
                     {item.reasons.map((reason, index) => (
                       <ReasonItem key={index}>{reason}</ReasonItem>
                     ))}
                   </ReasonsList>
                 </FeedbackReasons>
 
                 {item.otherReason && (
                   <FeedbackOther>
                     <strong>Additional Comments:</strong>
                     <br />
                     {item.otherReason}
                   </FeedbackOther>
                 )}
               </FeedbackCard>
             );
           })
         )}
       </FeedbackList>
     </ContentSection>
   );

  const renderArticles = () => (
    <ContentSection>
      <SectionTitle>Articles ({articles.length})</SectionTitle>
      {articles.length === 0 ? (
        <EmptyState>No articles available.</EmptyState>
      ) : (
        <ArticlesList>
          {articles.map((article) => {
            const primaryTitle =
              article.titleEnglish || article.titleKorean || "Untitled Article";
            const showKoreanSubtitle =
              article.titleKorean && article.titleKorean !== article.titleEnglish;

            return (
              <ArticleCard
                key={article.id}
                type="button"
                onClick={() => handleArticleClick(article.id)}
              >
                <ArticleHeader>
                  <ArticleTitle>{primaryTitle}</ArticleTitle>
                  <ArticleMeta>
                    <span>{formatDateTime(article.publishedAt)}</span>
                  </ArticleMeta>
                </ArticleHeader>

                {showKoreanSubtitle && (
                  <ArticleSubtitle>{article.titleKorean}</ArticleSubtitle>
                )}

                <ArticleMeta>
                  <span>ID: {article.id}</span>
                </ArticleMeta>

                <ArticleActions>
                  <ArticleActionButton
                    type="button"
                    $variant="danger"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleDeleteArticle(article.id);
                    }}
                    disabled={deletingArticleId === article.id}
                  >
                    <TrashIcon />
                    {deletingArticleId === article.id ? "Deleting..." : "Delete"}
                  </ArticleActionButton>
                </ArticleActions>
              </ArticleCard>
            );
          })}
        </ArticlesList>
      )}
    </ContentSection>
  );

  if (authChecking) {
    return (
      <Wrapper>
        <LoadingSpinner>Checking admin privileges...</LoadingSpinner>
      </Wrapper>
    );
  }

  if (loading) {
    return (
      <Wrapper>
        <LoadingSpinner>Loading data...</LoadingSpinner>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <Header>
        <Title>Admin Dashboard</Title>
        <RefreshButton onClick={loadDashboardData}>Refresh</RefreshButton>
      </Header>

      <TabContainer>
        <Tab
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </Tab>
        <Tab
          active={activeTab === "members"}
          onClick={() => setActiveTab("members")}
        >
          Members
        </Tab>
        <Tab
          active={activeTab === "feedback"}
          onClick={() => setActiveTab("feedback")}
        >
          Feedback
        </Tab>
        <Tab
          active={activeTab === "articles"}
          onClick={() => setActiveTab("articles")}
        >
          Articles
        </Tab>
        <Tab
          active={activeTab === "growth"}
          onClick={() => setActiveTab("growth")}
        >
          Growth
        </Tab>
      </TabContainer>

      {activeTab === "dashboard" && renderDashboard()}
      {activeTab === "members" && renderMembers()}
      {activeTab === "feedback" && renderFeedback()}
      {activeTab === "articles" && renderArticles()}
      {activeTab === "growth" && <GrowthDashboard />}
    </Wrapper>
  );
}
