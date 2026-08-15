"use client";

import { useState, useEffect, useMemo } from "react";
import styled from "styled-components";
import { auth, db } from "../lib/firebase/firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  getCountFromServer,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
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
  | "marketing";

interface AdminClientProps {
  section?: AdminSection;
}

const ADMIN_SECTIONS: Array<{
  id: AdminSection;
  label: string;
  path: string;
  description: string;
}> = [
  {
    id: "members",
    label: "Members",
    path: "/admin/members",
    description: "Manage members and active subscriptions.",
  },
  {
    id: "articles",
    label: "Articles",
    path: "/admin/articles",
    description: "Review and manage published learning articles.",
  },
  {
    id: "marketing",
    label: "Marketing",
    path: "/admin/marketing",
    description: "Review Growth Agent posts, approvals, and results.",
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

const QuickActionsSection = styled.section`
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  border: 3px solid #050505;
`;

const QuickActionsTitle = styled.h2`
  margin: 0 0 18px;
  font-size: 20px;
  font-weight: 900;
  color: #050505;
`;

const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
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

const ArticleCard = styled.article`
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  border-radius: 12px;
  border: 2px solid #050505;
  background: #ffffff;
  color: #050505;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);

  &:hover {
    box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  }
`;

const ArticleOpenButton = styled.button<{ $ready: boolean }>`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 10px;
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
  gap: 8px;
  margin-top: 12px;
`;

const ArticleActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
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
  createdAt?: Timestamp | Date | string;
  hasActiveSubscription?: boolean;
  billingCancelled?: boolean;
  subscriptionStartDate?: Timestamp | Date | string;
  subscriptionEndDate?: Timestamp | Date | string;
  account_status?: string;
  gdg_member?: boolean;
}

interface FeedbackData {
  id: string;
  userId: string;
  category: "cancellation" | "refund";
  reasons: string[];
  otherReason?: string;
  timestamp: Timestamp;
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

const toArticleData = (docSnap: {
  id: string;
  data: () => Record<string, unknown>;
}): ArticleData => {
  const data = docSnap.data() || {};
  const rawTimestamp =
    data.timestamp ?? data.publishedAt ?? data.createdAt ?? null;

  let publishedAt: Date | undefined;
  if (
    rawTimestamp &&
    typeof rawTimestamp === "object" &&
    "toDate" in rawTimestamp &&
    typeof rawTimestamp.toDate === "function"
  ) {
    publishedAt = rawTimestamp.toDate() as Date;
  } else if (rawTimestamp instanceof Date) {
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
  const rawStatus = data.publicationStatus;

  return {
    id: docSnap.id,
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

export default function AdminClient({ section = "dashboard" }: AdminClientProps) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
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
    const checkAdminAccess = async () => {
      console.log("Admin access check starting...");

      // Wait for Firebase Auth to initialize
      const user = auth.currentUser;
      if (!user) {
        console.log("No user found, redirecting to auth");
        router.push("/auth");
        return;
      }

      console.log("User found:", user.email, "UID:", user.uid);

      try {
        // Check user's account_status in Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.log("User document does not exist in Firestore");
          router.push("/");
          return;
        }

        const userData = userDoc.data();
        console.log("User data from Firestore:", userData);
        console.log("Account status:", userData.account_status);

        if (userData.account_status !== "admin") {
          console.log("User is not admin, redirecting to home");
          router.push("/");
          return;
        }

        console.log("User is admin, loading dashboard data");
        setAuthChecking(false);
        // User is admin, load dashboard data
        loadDashboardData();
      } catch (error) {
        console.error("Error checking admin access:", error);
        router.push("/");
      }
    };

    // Add a small delay to ensure Firebase Auth is ready
    const timer = setTimeout(() => {
      checkAdminAccess();
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (section !== "articles" || authChecking) {
      return;
    }

    const articlesQuery = query(
      collection(db, "articles"),
      orderBy("timestamp", "desc")
    );

    return onSnapshot(
      articlesQuery,
      (snapshot) => {
        setArticles(sortArticles(snapshot.docs.map((docSnap) => toArticleData(docSnap))));
      },
      (error) => {
        console.error("Error listening for article processing updates:", error);
      }
    );
  }, [authChecking, section]);

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
      const usersQuery = query(
        collection(db, "users"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(usersQuery);

      const usersData: UserData[] = [];
      snapshot.forEach((doc) => {
        usersData.push({
          id: doc.id,
          ...doc.data(),
        } as UserData);
      });

      return usersData;
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  };

  const fetchFeedback = async (): Promise<FeedbackData[]> => {
    try {
      const feedbackQuery = query(
        collection(db, "feedback"),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(feedbackQuery);

      const feedbackData: FeedbackData[] = [];
      snapshot.forEach((doc) => {
        feedbackData.push({
          id: doc.id,
          ...doc.data(),
        } as FeedbackData);
      });

      return feedbackData;
    } catch (error) {
      console.error("Error fetching feedback:", error);
      return [];
    }
  };

  const fetchEventsCount = async (): Promise<number> => {
    const collectionCandidates = ["events", "meetups", "meetup"];

    for (const name of collectionCandidates) {
      try {
        const eventsRef = collection(db, name);
        const countSnapshot = await getCountFromServer(eventsRef);
        const count = countSnapshot.data().count ?? 0;
        if (
          count > 0 ||
          name === collectionCandidates[collectionCandidates.length - 1]
        ) {
          return count;
        }
      } catch (countError) {
        console.warn(
          `Count fetch failed for ${name}, falling back to doc fetch.`,
          countError
        );
        try {
          const snapshot = await getDocs(collection(db, name));
          if (!snapshot.empty) {
            return snapshot.size;
          }
        } catch (docError) {
          console.error(`Fallback doc fetch failed for ${name}:`, docError);
        }
      }
    }

    return 0;
  };

  const fetchArticles = async (): Promise<ArticleData[]> => {
    try {
      const baseRef = collection(db, "articles");
      let snapshot;

      try {
        snapshot = await getDocs(query(baseRef, orderBy("timestamp", "desc")));
      } catch (orderError) {
        console.warn(
          "Primary articles query failed, using unordered fetch.",
          orderError
        );
        snapshot = await getDocs(baseRef);
      }

      return sortArticles(snapshot.docs.map((docSnap) => toArticleData(docSnap)));
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
 
  const resolveToDate = (value?: Timestamp | Date | string): Date | null => {
    if (!value) {
      return null;
    }

    if (value instanceof Timestamp) {
      return value.toDate();
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
      const batchSize = 400;

      for (let index = 0; index < activeUsers.length; index += batchSize) {
        const slice = activeUsers.slice(index, index + batchSize);
        const batch = writeBatch(db);

        slice.forEach((user) => {
          const userRef = doc(db, "users", user.id);
          const baseDate =
            resolveToDate(user.subscriptionEndDate) ||
            resolveToDate(user.subscriptionStartDate) ||
            new Date();
          const extendedDate = new Date(baseDate);
          extendedDate.setDate(extendedDate.getDate() + 14);

          batch.update(userRef, {
            subscriptionEndDate: Timestamp.fromDate(extendedDate),
          });
        });

        await batch.commit();
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
      await deleteDoc(doc(db, "articles", articleId));
      setArticles((prev) => prev.filter((article) => article.id !== articleId));
    } catch (error) {
      console.error("Error deleting article:", error);
      window.alert(t.admin.articles.deleteError);
    } finally {
      setDeletingArticleId(null);
    }
  };

  const formatDate = (value?: Timestamp | Date | string) => {
    const date = resolveToDate(value);
    if (!date) {
      return "-";
    }

    return format(date, "yyyy.MM.dd", {
      locale: locale === "ko" ? ko : enUS,
    });
  };

  const formatDateTime = (value?: Timestamp | Date | string) => {
    const date = resolveToDate(value);
    if (!date) {
      return "-";
    }

    return format(date, "yyyy.MM.dd HH:mm", {
      locale: locale === "ko" ? ko : enUS,
    });
  };

  const renderDashboard = () => (
    <>
      <QuickActionsSection>
        <QuickActionsTitle>Manage 1Cup English</QuickActionsTitle>
        <QuickActionsGrid>
          {ADMIN_SECTIONS.map(({ id, label, path, description }) => (
            <QuickAction key={id} type="button" onClick={() => router.push(path)}>
              <QuickActionLabel>{label}</QuickActionLabel>
              <QuickActionDescription>{description}</QuickActionDescription>
            </QuickAction>
          ))}
        </QuickActionsGrid>
      </QuickActionsSection>

      <Header>
        <Title>Welcome to the Admin Portal</Title>
      </Header>

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
      <>
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
        {renderFeedback()}
      </>
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
                        </ArticleMeta>
                      </ArticleHeader>

                      {showKoreanSubtitle && (
                        <ArticleSubtitle>{article.titleKorean}</ArticleSubtitle>
                      )}

                      <ArticleMeta>
                        <span>ID: {article.id}</span>
                      </ArticleMeta>

                      <ArticleCardFooter>
                        <ArticleStatus $tone={statusTone}>
                          {processingLabel(article)}
                          {!isReady && !isFailed ? " · " + progress + "%" : ""}
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
      {section !== "dashboard" && (
        <Header>
          <Title>
            {section === "articles"
              ? t.admin.articles.pageTitle
              : ADMIN_SECTIONS.find(({ id }) => id === section)?.label || "Admin"}
          </Title>
        </Header>
      )}

      {section === "dashboard" && renderDashboard()}
      {section === "members" && renderMembers()}
      {section === "articles" && renderArticles()}
      {section === "marketing" && <GrowthDashboard />}
    </Wrapper>
  );
}
