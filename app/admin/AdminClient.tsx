"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { supabase } from "../lib/supabase/client";
import { useAuth } from "../lib/contexts/auth_context";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { enUS, ko } from "date-fns/locale";
import { CalendarDaysIcon, TrashIcon } from "@heroicons/react/24/outline";
import GrowthDashboard from "../lib/features/growth/components/GrowthDashboard";
import AdminArticleIngestForm from "../lib/features/article/components/AdminArticleIngestForm";
import { useI18n } from "../lib/i18n/I18nProvider";

export type AdminSection =
  | "dashboard"
  | "members"
  | "articles"
  | "marketing"
  | "notifications";

interface AdminClientProps {
  section?: AdminSection;
}

const ADMIN_SECTIONS: Array<{
  id: Exclude<AdminSection, "dashboard">;
  path: string;
}> = [
  {
    id: "members",
    path: "/admin/members",
  },
  {
    id: "articles",
    path: "/admin/articles",
  },
  {
    id: "marketing",
    path: "/admin/marketing",
  },
  {
    id: "notifications",
    path: "/admin/notifications",
  },
];

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
  margin-bottom: 20px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 900;
  color: #050505;
  margin: 0;
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

const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

const MembersHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  ${SectionTitle} {
    height: 36px;
    margin: 0;
    padding: 0 12px;
    font-size: 14px;
  }

  @media (max-width: 560px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const MembersTabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1.5px solid rgba(5, 5, 5, 0.22);
`;

const MembersTab = styled.button<{ $active: boolean }>`
  border: 0;
  border-bottom: 3px solid ${({ $active }) => ($active ? "#050505" : "transparent")};
  margin-bottom: -1.5px;
  padding: 7px 10px 8px;
  background: transparent;
  color: ${({ $active }) => ($active ? "#050505" : "rgba(5, 5, 5, 0.58)")};
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 2px;
  }
`;

const UsersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const UserCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
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

const CreditInspector = styled.div`
  display: grid;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(5, 5, 5, 0.15);
  font-size: 12px;
`;

const CreditControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  input {
    min-width: 0;
    border: 1px solid #050505;
    border-radius: 6px;
    padding: 6px 8px;
    font: inherit;
  }

  button {
    border: 1px solid #050505;
    border-radius: 6px;
    background: #fff;
    padding: 6px 8px;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }
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

const LocationStatus = styled.div<{ $location: MembershipLocation }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border: 1.5px solid #050505;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  background-color: ${(props) => (props.$location === "yeouido" ? "#dbeafe" : "#ffedd5")};
  color: #050505;
`;

const UserDate = styled.div`
  color: rgba(5, 5, 5, 0.6);
  font-size: 12px;
`;

const ApplicantList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ApplicantCard = styled.article`
  border: 1.5px solid #050505;
  border-radius: 10px;
  padding: 16px;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.85);
  }
`;

const ApplicantHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const ApplicantDetails = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 14px 0 0;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }

  dt {
    margin: 0 0 3px;
    color: rgba(5, 5, 5, 0.58);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    color: #050505;
    font-size: 13px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }
`;

const ApplicantStatus = styled.span<{ $status: NonKoreanApplication["status"] }>`
  display: inline-flex;
  align-items: center;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: ${({ $status }) =>
    $status === "approved" ? "#dcfce7" : $status === "declined" ? "#fee2e2" : "#fef3c7"};
  color: #050505;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 850;
  text-transform: capitalize;
`;

const ExternalProfileLink = styled.a`
  color: #050505;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 0.16em;
`;

const FeedbackList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  gap: 10px;
`;

const ArticleCard = styled.article`
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid #050505;
  background: #ffffff;
  color: #050505;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.9);

  &:hover {
    box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  }
`;

const ArticleOpenButton = styled.button<{ $ready: boolean }>`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 6px;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: ${({ $ready }) => ($ready ? "pointer" : "default")};
  text-align: left;
  transition: transform 0.14s ease;

  &:hover:not(:disabled) {
    transform: translate(-2px, -2px);
  }

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 5px;
  }

  &:disabled {
    opacity: 0.78;
  }
`;

const ArticleStatus = styled.span<{ $tone: "processing" | "published" | "failed" }>`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 4px 8px;
  background: ${({ $tone }) =>
    $tone === "failed" ? "#fee2e2" : $tone === "published" ? "#dcfce7" : "#fff3cd"};
  color: ${({ $tone }) => ($tone === "failed" ? "#991b1b" : "#050505")};
  font-size: 11px;
  font-weight: 900;
`;

const ProgressTrack = styled.div`
  width: 100%;
  height: 8px;
  overflow: hidden;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #fff8f4;
`;

const ProgressFill = styled.div<{ $progress: number; $failed: boolean }>`
  width: ${({ $progress }) => $progress}%;
  height: 100%;
  background: ${({ $failed }) => ($failed ? "#dc2626" : "#f47a4a")};
  transition: width 0.3s ease;
`;

const ProgressHint = styled.span`
  color: rgba(5, 5, 5, 0.6);
  font-size: 12px;
  font-weight: 700;
`;

const ArticleCardFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
`;

const ArticleActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
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
  line-height: 1.35;
`;

const ArticleSubtitle = styled.div`
  font-size: 14px;
  color: rgba(5, 5, 5, 0.6);
`;

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  font-size: 12px;
  color: rgba(5, 5, 5, 0.6);
  text-align: right;
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
  align-items: center;
`;

const MembersActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  height: 36px;
  gap: 6px;
  padding: 0 12px;
  border-radius: 999px;
  border: 2px solid #050505;
  background: #f47a4a;
  color: #050505;
  font-size: 12px;
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
    width: 15px;
    height: 15px;
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
type MembershipLocation = "yeouido" | "anam";

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
  location: MembershipLocation;
  isPlaceholder?: boolean;
  participationCreditBalance?: number;
}

interface FeedbackData {
  id: string;
  userId: string;
  category: "cancellation" | "refund";
  reasons: string[];
  otherReason?: string;
  timestamp: string;
}

interface NonKoreanApplication {
  id: string;
  userId: string;
  email: string;
  nationality: string;
  linkedinUrl: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
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
  publicationStatus?: "processing" | "published" | "failed";
  processing?: {
    state?: string;
    stage?: string;
    progress?: number;
  };
}

const toArticleData = (row: Record<string, unknown>): ArticleData => {
  const data = row || {};
  const rawTimestamp = data.timestamp ?? data.created_at ?? null;

  let publishedAt: Date | undefined;
  if (rawTimestamp instanceof Date) {
    publishedAt = rawTimestamp;
  } else if (typeof rawTimestamp === "string") {
    const parsed = new Date(rawTimestamp);
    if (!Number.isNaN(parsed.getTime())) {
      publishedAt = parsed;
    }
  }

  const rawProcessing =
    data.processing && typeof data.processing === "object"
      ? (data.processing as Record<string, unknown>)
      : undefined;
  const rawStatus = data.publication_status;

  return {
    id: String(data.id ?? ""),
    titleEnglish:
      (data.title as Record<string, unknown> | undefined)?.english as string ??
      (data.titleEnglish as string | undefined) ??
      (typeof data.title === "string" ? data.title : ""),
    titleKorean:
      (data.title as Record<string, unknown> | undefined)?.korean as string ??
      (data.titleKorean as string | undefined) ??
      "",
    publishedAt,
    publicationStatus:
      rawStatus === "processing" || rawStatus === "published" || rawStatus === "failed"
        ? rawStatus
        : undefined,
    processing: rawProcessing
      ? {
          state: typeof rawProcessing.state === "string" ? rawProcessing.state : undefined,
          stage: typeof rawProcessing.stage === "string" ? rawProcessing.stage : undefined,
          progress:
            typeof rawProcessing.progress === "number" ? rawProcessing.progress : undefined,
        }
      : undefined,
  };
};

const sortArticles = (articleData: ArticleData[]): ArticleData[] =>
  [...articleData].sort((a, b) => {
    const aTime = a.publishedAt ? a.publishedAt.getTime() : 0;
    const bTime = b.publishedAt ? b.publishedAt.getTime() : 0;
    return bTime - aTime;
  });

export default function AdminClient({
  section = "dashboard",
}: AdminClientProps) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [feedback, setFeedback] = useState<FeedbackData[]>([]);
  const [applications, setApplications] = useState<NonKoreanApplication[]>([]);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(
    null
  );
  const [membersTab, setMembersTab] = useState<"members" | "feedback" | "applicants">("members");
  const [extendingSubscriptions, setExtendingSubscriptions] = useState(false);
  const [expandedCreditMemberId, setExpandedCreditMemberId] = useState<string | null>(null);
  const [creditHistory, setCreditHistory] = useState<Record<string, Array<Record<string, any>>>>({});
  const [creditAdjustmentAmount, setCreditAdjustmentAmount] = useState("1");
  const [creditAdjustmentReason, setCreditAdjustmentReason] = useState("");
  const [creditAdjusting, setCreditAdjusting] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeSubscriptions: 0,
    cancelledBilling: 0,
    newMembersThisMonth: 0,
    totalEvents: 0,
    purchasingMembers: 0,
  });
  const router = useRouter();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const loadedAuthIdRef = useRef<string | null>(null);

  const usersById = useMemo(() => {
    const entries = new Map<string, UserData>();
    users.forEach((user) => {
      entries.set(user.id, user);
    });
    return entries;
  }, [users]);

  const activeMembersCount = useMemo(() => {
    return users.filter(
      (user) => user.hasActiveSubscription && user.account_status !== "admin",
    ).length;
  }, [users]);

  useEffect(() => {
    // The auth context already resolves the profile through user_auth_identities and
    // exposes account_status, so there is no second round trip here.
    if (authLoading) return;

    if (!currentUser) {
      router.push("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.push("/");
      return;
    }
    setAuthChecking(false);
    // Admin data is session-scoped. Do not reload the whole portal merely because
    // Supabase re-emits the same recovered browser session on tab focus.
    if (loadedAuthIdRef.current === currentUser.authId) return;
    loadedAuthIdRef.current = currentUser.authId;
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, currentUser, accountStatus, authLoading]);

  useEffect(() => {
    if (section !== "articles" || authChecking) {
      return;
    }

    // The ingest flow flips publication_status/processing as it works, so the admin list
    // follows the row rather than polling.
    const reload = () => {
      fetchArticles()
        .then(setArticles)
        .catch((e) => console.error("Error refreshing articles:", e));
    };
    reload();
    const channel = supabase
      .channel("admin-articles")
      .on("postgres_changes", { event: "*", schema: "public", table: "articles" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecking, section]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [usersData, feedbackData, applicationsData, eventsCount, articlesData] =
        await Promise.all([
          fetchUsers(),
          fetchFeedback(),
          fetchApplications(),
          fetchEventsCount(),
          fetchArticles(),
        ]);

      setUsers(usersData);
      setFeedback(feedbackData);
      setApplications(applicationsData);
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
      const [{ data, error }, { data: balances, error: balanceError }] = await Promise.all([
        supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false }),
        supabase.from("participation_credit_balances").select("user_id, balance"),
      ]);
      if (error) throw error;
      if (balanceError) throw balanceError;
      const balanceByUser = new Map((balances || []).map((row: any) => [row.user_id, Number(row.balance || 0)]));

      return (data || [])
        .map((row: any) => ({
          id: row.uid,
          email: row.email ?? undefined,
          displayName: row.display_name ?? undefined,
          createdAt: row.created_at ?? undefined,
          hasActiveSubscription: row.has_active_subscription ?? false,
          billingCancelled: row.billing_cancelled ?? false,
          subscriptionStartDate: row.subscription_start_date ?? undefined,
          subscriptionEndDate: row.subscription_end_date ?? undefined,
          account_status: row.account_status ?? undefined,
          location: (row.location === "yeouido" ? "yeouido" : "anam") as MembershipLocation,
          isPlaceholder: row.is_placeholder === true,
          participationCreditBalance: balanceByUser.get(row.uid) ?? 0,
        }))
        .filter((user) => !user.isPlaceholder);
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

  const fetchApplications = async (): Promise<NonKoreanApplication[]> => {
    try {
      const { data, error } = await supabase
        .from("non_korean_applications")
        .select("id, user_id, email, nationality, linkedin_url, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: String(row.id),
        userId: String(row.user_id),
        email: String(row.email ?? ""),
        nationality: String(row.nationality ?? ""),
        linkedinUrl: String(row.linkedin_url ?? ""),
        status:
          row.status === "approved" || row.status === "declined" ? row.status : "pending",
        createdAt: String(row.created_at ?? ""),
      }));
    } catch (error) {
      console.error("Error fetching non-Korean applications:", error);
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
        .order("timestamp", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return sortArticles((data || []).map((row: any) => toArticleData(row)));
    } catch (error) {
      console.error("Error fetching articles:", error);
      return [];
    }
  };

  const calculateStats = (usersData: UserData[], totalEvents: number) => {
     const now = new Date();
     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
     const memberUsers = usersData.filter((user) => user.account_status !== "admin");
 
    const purchasingMembers = memberUsers.filter((user) =>
      Boolean(
        user.hasActiveSubscription ||
          user.subscriptionStartDate ||
          user.subscriptionEndDate
      )
    ).length;

    const newStats: DashboardStats = {
      totalMembers: memberUsers.length,
      activeSubscriptions: memberUsers.filter((u) => u.hasActiveSubscription)
        .length,
      cancelledBilling: memberUsers.filter((u) => u.billingCancelled).length,
      newMembersThisMonth: memberUsers.filter((u) => {
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
    const activeUsers = users.filter(
      (user) => user.hasActiveSubscription && user.account_status !== "admin",
    );

    if (activeUsers.length === 0) {
      window.alert(t.admin.members.noActiveFound);
      return;
    }

    const confirmed = window.confirm(
      t.admin.members.extendConfirm.replace("{count}", String(activeUsers.length))
    );

    if (!confirmed) {
      return;
    }

    setExtendingSubscriptions(true);

    try {
      // PostgREST has no batch update with per-row values, so each member is updated
      // individually. RLS (is_admin) is enforced per statement either way.
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
      window.alert(t.admin.members.extendSuccess);
    } catch (error) {
      console.error("Error extending active subscriptions:", error);
      window.alert(t.admin.members.extendError);
    } finally {
      setExtendingSubscriptions(false);
    }
  };

  const handleArticleClick = (articleId: string) => {
    router.push(`/article/${articleId}`);
  };

  const loadCreditHistory = async (userId: string) => {
    const { data, error } = await supabase
      .from("participation_credit_transactions")
      .select("id, amount, type, meetup_id, metadata, created_at, meetups(title, date_time)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      window.alert(`참여권 내역을 불러오지 못했습니다. (${error.message})`);
      return;
    }
    setCreditHistory((previous) => ({ ...previous, [userId]: data || [] }));
  };

  const toggleCreditHistory = async (userId: string) => {
    if (expandedCreditMemberId === userId) {
      setExpandedCreditMemberId(null);
      return;
    }
    setExpandedCreditMemberId(userId);
    if (creditHistory[userId]) return;
    await loadCreditHistory(userId);
  };

  const adjustCredits = async (user: UserData) => {
    const amount = Number.parseInt(creditAdjustmentAmount, 10);
    if (!Number.isInteger(amount) || amount === 0) {
      window.alert("0이 아닌 정수 조정 값을 입력하세요.");
      return;
    }
    if (!creditAdjustmentReason.trim()) {
      window.alert("조정 사유를 입력하세요.");
      return;
    }
    setCreditAdjusting(true);
    try {
      const { data, error } = await supabase.rpc("adjust_participation_credits", {
        p_user_id: user.id,
        p_amount: amount,
        p_reason: creditAdjustmentReason.trim(),
      });
      if (error) throw error;
      const balance = Number(data ?? 0);
      setUsers((previous) => previous.map((item) => item.id === user.id
        ? { ...item, participationCreditBalance: balance }
        : item));
      setCreditHistory((previous) => ({ ...previous, [user.id]: [] }));
      setCreditAdjustmentReason("");
      window.alert(`참여권 잔액이 ${balance}회로 조정되었습니다.`);
      await loadCreditHistory(user.id);
    } catch (adjustmentError) {
      const message = adjustmentError instanceof Error ? adjustmentError.message : String(adjustmentError);
      window.alert(`참여권 조정에 실패했습니다. (${message})`);
    } finally {
      setCreditAdjusting(false);
    }
  };

  const handleArticleQueued = ({ articleId, title }: { articleId: string; title: string }) => {
    setArticles((current) =>
      sortArticles([
        {
          id: articleId,
          titleEnglish: title,
          publishedAt: new Date(),
          publicationStatus: "processing",
          processing: { state: "queued", stage: "queued", progress: 5 },
        },
        ...current.filter((article) => article.id !== articleId),
      ])
    );
  };

  const handleDeleteArticle = async (articleId: string) => {
    const shouldDelete = window.confirm(t.admin.articles.deleteConfirm);

    if (!shouldDelete) {
      return;
    }

    setDeletingArticleId(articleId);
    try {
      const { error } = await supabase.from("articles").delete().eq("id", articleId);
      if (error) throw error;
      setArticles((prev) => prev.filter((article) => article.id !== articleId));
    } catch (error) {
      console.error("Error deleting article:", error);
      window.alert(t.admin.articles.deleteError);
    } finally {
      setDeletingArticleId(null);
    }
  };

  const formatDate = (value?: Date | string) => {
    const date = resolveToDate(value);
    if (!date) {
      return t.admin.dashboard.unavailable;
    }

    return format(date, "yyyy.MM.dd", {
      locale: locale === "ko" ? ko : enUS,
    });
  };

  const formatDateTime = (value?: Date | string) => {
    const date = resolveToDate(value);
    if (!date) {
      return t.admin.dashboard.unavailable;
    }

    return format(date, "yyyy.MM.dd HH:mm", {
      locale: locale === "ko" ? ko : enUS,
    });
  };

  const renderDashboard = () => (
    <>
      <QuickActionsGrid aria-label={t.admin.dashboard.title}>
          {ADMIN_SECTIONS.map(({ id, path }) => (
            <QuickAction key={id} type="button" onClick={() => router.push(path)}>
              <QuickActionLabel>{t.admin.dashboard.sections[id].label}</QuickActionLabel>
              <QuickActionDescription>{t.admin.dashboard.sections[id].description}</QuickActionDescription>
            </QuickAction>
          ))}
      </QuickActionsGrid>

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

    </>
  );

  const renderMembers = () => {
    const copy = t.admin.members;
    const withCount = (template: string, count: number) =>
      template.replace("{count}", String(count));
    const extendButtonLabel = extendingSubscriptions
      ? copy.extending
      : activeMembersCount > 0
      ? withCount(copy.extendActive, activeMembersCount)
      : copy.noActiveMembers;

    return (
      <ContentSection>
        <MembersHeader>
          <SectionTitle>{withCount(copy.title, users.length)}</SectionTitle>
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
        </MembersHeader>

        <MembersTabs role="tablist" aria-label={copy.tabListLabel}>
          <MembersTab
            type="button"
            role="tab"
            id="members-tab"
            aria-controls="members-panel"
            aria-selected={membersTab === "members"}
            $active={membersTab === "members"}
            onClick={() => setMembersTab("members")}
          >
            {withCount(copy.tabMembers, users.length)}
          </MembersTab>
          <MembersTab
            type="button"
            role="tab"
            id="feedback-tab"
            aria-controls="feedback-panel"
            aria-selected={membersTab === "feedback"}
            $active={membersTab === "feedback"}
            onClick={() => setMembersTab("feedback")}
          >
            {withCount(copy.tabFeedback, feedback.length)}
          </MembersTab>
          <MembersTab
            type="button"
            role="tab"
            id="applicants-tab"
            aria-controls="applicants-panel"
            aria-selected={membersTab === "applicants"}
            $active={membersTab === "applicants"}
            onClick={() => setMembersTab("applicants")}
          >
            {withCount(copy.tabApplicants, applications.length)}
          </MembersTab>
        </MembersTabs>

        {membersTab === "members" ? (
          <UsersList id="members-panel" role="tabpanel" aria-labelledby="members-tab">
            {users.map((user) => (
              <UserCard key={user.id}>
                <UserInfo>
                  <div>
                    <UserName>{user.displayName || copy.noName}</UserName>
                    <UserEmail>{user.email}</UserEmail>
                  </div>

                  <div>
                    <LocationStatus $location={user.location}>
                      {user.location === "yeouido" ? copy.locationYeouido : copy.locationAnam}
                    </LocationStatus>
                  </div>

                  <UserStatus active={!!user.hasActiveSubscription}>
                    {user.hasActiveSubscription ? copy.active : copy.inactive}
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
                        {copy.billingStopped}
                      </div>
                    )}
                  </div>

                  <UserDate>{formatDate(user.createdAt)}</UserDate>
                </UserInfo>
                <CreditInspector>
                  <strong>회차 참여권: {user.participationCreditBalance ?? 0}회</strong>
                  <CreditControls>
                    <button type="button" onClick={() => void toggleCreditHistory(user.id)}>
                      {expandedCreditMemberId === user.id ? "내역 닫기" : "내역 보기"}
                    </button>
                    {expandedCreditMemberId === user.id && (
                      <>
                        <input
                          value={creditAdjustmentAmount}
                          onChange={(event) => setCreditAdjustmentAmount(event.target.value)}
                          inputMode="numeric"
                          aria-label="참여권 조정 수량"
                          placeholder="예: +1 또는 -1"
                        />
                        <input
                          value={creditAdjustmentReason}
                          onChange={(event) => setCreditAdjustmentReason(event.target.value)}
                          aria-label="참여권 조정 사유"
                          placeholder="조정 사유"
                        />
                        <button type="button" onClick={() => void adjustCredits(user)} disabled={creditAdjusting}>
                          {creditAdjusting ? "조정 중" : "조정 기록"}
                        </button>
                      </>
                    )}
                  </CreditControls>
                  {expandedCreditMemberId === user.id && (creditHistory[user.id] || []).map((entry) => {
                    const meetup = Array.isArray(entry.meetups) ? entry.meetups[0] : entry.meetups;
                    const label = entry.type === "purchase"
                      ? "참여권 구매"
                      : entry.type === "registration"
                        ? `${meetup?.title || "밋업"} 신청`
                        : entry.type === "registration_refund"
                          ? `${meetup?.title || "밋업"} 취소`
                          : entry.type === "payment_refund"
                            ? "참여권 구매 환불"
                            : "관리자 조정";
                    return <div key={entry.id}>{entry.amount > 0 ? `+${entry.amount}` : entry.amount} · {label} · {formatDateTime(entry.created_at)}</div>;
                  })}
                </CreditInspector>
              </UserCard>
            ))}
          </UsersList>
        ) : membersTab === "feedback" ? (
          <div id="feedback-panel" role="tabpanel" aria-labelledby="feedback-tab">
            {renderFeedback()}
          </div>
        ) : (
          <ApplicantList id="applicants-panel" role="tabpanel" aria-labelledby="applicants-tab">
            {applications.length === 0 ? (
              <EmptyState>{copy.noApplicants}</EmptyState>
            ) : (
              applications.map((application) => {
                const member = usersById.get(application.userId);
                return (
                  <ApplicantCard key={application.id}>
                    <ApplicantHeader>
                      <div>
                        <UserName>{member?.displayName || copy.noName}</UserName>
                        <UserEmail>{application.email}</UserEmail>
                      </div>
                      <ApplicantStatus $status={application.status}>
                        {copy.applicationStatuses[application.status]}
                      </ApplicantStatus>
                    </ApplicantHeader>
                    <ApplicantDetails>
                      <div>
                        <dt>{copy.applicantNationality}</dt>
                        <dd>{application.nationality}</dd>
                      </div>
                      <div>
                        <dt>{copy.applicantLinkedIn}</dt>
                        <dd>
                          <ExternalProfileLink
                            href={application.linkedinUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {application.linkedinUrl}
                          </ExternalProfileLink>
                        </dd>
                      </div>
                      <div>
                        <dt>{copy.applicantSubmitted}</dt>
                        <dd>{formatDateTime(application.createdAt)}</dd>
                      </div>
                    </ApplicantDetails>
                  </ApplicantCard>
                );
              })
            )}
          </ApplicantList>
        )}
      </ContentSection>
    );
  };

  const renderFeedback = () => (
       <FeedbackList>
         {feedback.length === 0 ? (
           <EmptyState>{t.admin.members.noFeedback}</EmptyState>
         ) : (
           feedback.map((item) => {
             const linkedUser = usersById.get(item.userId);
             const linkedDisplayName = linkedUser?.displayName;
 
             return (
               <FeedbackCard key={item.id}>
                 <FeedbackHeader>
                   <FeedbackCategory category={item.category}>
                     {item.category === "cancellation"
                       ? t.admin.members.subscriptionStop
                       : t.admin.members.refundRequest}
                   </FeedbackCategory>
                   <FeedbackDate>{formatDateTime(item.timestamp)}</FeedbackDate>
                 </FeedbackHeader>
 
                 <FeedbackUser>
                   {linkedDisplayName
                     ? `${linkedDisplayName} (${item.userId})`
                     : t.admin.members.userId.replace("{id}", item.userId)}
                 </FeedbackUser>
 
                 <FeedbackReasons>
                   <strong>{t.admin.members.selectedReasons}</strong>
                   <ReasonsList>
                     {item.reasons.map((reason, index) => (
                       <ReasonItem key={index}>{reason}</ReasonItem>
                     ))}
                   </ReasonsList>
                 </FeedbackReasons>
 
                 {item.otherReason && (
                   <FeedbackOther>
                     <strong>{t.admin.members.additionalComments}</strong>
                     <br />
                     {item.otherReason}
                   </FeedbackOther>
                 )}
               </FeedbackCard>
             );
           })
         )}
       </FeedbackList>
   );

  const renderArticles = () => {
    const copy = t.admin.articles;

    const processingLabel = (article: ArticleData) => {
      if (article.publicationStatus === "failed") return copy.statusFailed;
      if (!article.publicationStatus || article.publicationStatus === "published") {
        return copy.statusPublished;
      }

      switch (article.processing?.stage) {
        case "refining":
          return copy.statusRefining;
        case "summarizing":
          return copy.statusSummarizing;
        case "extractingVocabulary":
          return copy.statusExtractingVocabulary;
        case "draftingDiscussion":
          return copy.statusDraftingDiscussion;
        case "identifyingTerms":
          return copy.statusIdentifyingTerms;
        case "organizing":
          return copy.statusOrganizing;
        case "translating":
          return copy.statusTranslating;
        case "polishingKorean":
          return copy.statusPolishingKorean;
        case "validating":
          return copy.statusValidating;
        case "placingFigures":
          return copy.statusPlacingFigures;
        case "designingCover":
          return copy.statusDesigningCover;
        case "illustrating":
          return copy.statusIllustrating;
        case "publishing":
          return copy.statusPublishing;
        default:
          return copy.statusQueued;
      }
    };

    return (
      <>
        <AdminArticleIngestForm
          onArticleQueued={handleArticleQueued}
          onArticleCreated={loadDashboardData}
        />
        <ContentSection>
          <SectionTitle>
            {copy.listTitle.replace("{count}", String(articles.length))}
          </SectionTitle>
          {articles.length === 0 ? (
            <EmptyState>{copy.empty}</EmptyState>
          ) : (
            <ArticlesList>
              {articles.map((article) => {
                const primaryTitle =
                  article.titleEnglish || article.titleKorean || copy.untitled;
                const showKoreanSubtitle =
                  article.titleKorean && article.titleKorean !== article.titleEnglish;
                const isReady =
                  !article.publicationStatus || article.publicationStatus === "published";
                const isFailed = article.publicationStatus === "failed";
                const progress = Math.max(
                  0,
                  Math.min(100, article.processing?.progress ?? (isReady ? 100 : 5))
                );
                const statusTone = isFailed
                  ? "failed"
                  : isReady
                  ? "published"
                  : "processing";

                return (
                  <ArticleCard key={article.id}>
                    <ArticleOpenButton
                      type="button"
                      $ready={isReady}
                      disabled={!isReady}
                      onClick={() => handleArticleClick(article.id)}
                      aria-label={isReady ? copy.openReady : copy.availableWhenReady}
                    >
                      <ArticleHeader>
                        <ArticleTitle>{primaryTitle}</ArticleTitle>
                        <ArticleMeta>
                          <span>{formatDateTime(article.publishedAt)}</span>
                          <span>{copy.articleId.replace("{id}", article.id)}</span>
                        </ArticleMeta>
                      </ArticleHeader>

                      {showKoreanSubtitle && (
                        <ArticleSubtitle>{article.titleKorean}</ArticleSubtitle>
                      )}

                      <ArticleCardFooter>
                        <ArticleStatus $tone={statusTone}>
                          {!isReady && !isFailed
                            ? copy.processingProgress
                                .replace("{status}", processingLabel(article))
                                .replace("{progress}", String(progress))
                            : processingLabel(article)}
                        </ArticleStatus>
                        {!isReady && (
                          <>
                            <ProgressTrack>
                              <ProgressFill $progress={progress} $failed={isFailed} />
                            </ProgressTrack>
                            <ProgressHint>{copy.availableWhenReady}</ProgressHint>
                          </>
                        )}
                      </ArticleCardFooter>
                    </ArticleOpenButton>

                    <ArticleActions>
                      <ArticleActionButton
                        type="button"
                        $variant="danger"
                        onClick={() => handleDeleteArticle(article.id)}
                        disabled={deletingArticleId === article.id}
                      >
                        <TrashIcon />
                        {deletingArticleId === article.id
                          ? copy.deleting
                          : copy.delete}
                      </ArticleActionButton>
                    </ArticleActions>
                  </ArticleCard>
                );
              })}
            </ArticlesList>
          )}
        </ContentSection>
      </>
    );
  };

  if (authChecking) {
    return (
      <Wrapper>
        <LoadingSpinner>{t.admin.dashboard.checkingAccess}</LoadingSpinner>
      </Wrapper>
    );
  }

  if (loading) {
    return (
      <Wrapper>
        <LoadingSpinner>{t.admin.dashboard.loading}</LoadingSpinner>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {section === "dashboard" && renderDashboard()}
      {section === "members" && renderMembers()}
      {section === "articles" && renderArticles()}
      {section === "marketing" && <GrowthDashboard />}
    </Wrapper>
  );
}
