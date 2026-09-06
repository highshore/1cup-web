"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
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

// Shared Tailwind class fragments
const hoverLiftTransition =
  "transition-[translate,box-shadow] duration-[140ms] ease-[ease]";
const cardHoverLift = `${hoverLiftTransition} hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_rgba(5,5,5,0.85)]`;

const wrapperClass =
  "flex flex-col pt-0 px-5 pb-5 max-w-[1400px] mx-auto gap-[30px] bg-transparent";

const headerClass = "mb-5";

const titleClass = "text-[28px] font-black text-[#050505] m-0";

const statsGridClass =
  "grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 mb-[30px]";

const statCardClass = `bg-white rounded-2xl p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)] border-[3px] border-[#050505] ${hoverLiftTransition} hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_rgba(5,5,5,0.9)]`;

const statNumberClass = "text-[32px] font-black text-[#050505] mb-2";

const statLabelClass =
  "text-[14px] text-[rgba(5,5,5,0.6)] font-bold uppercase tracking-[0.5px]";

const statSubtextClass = "text-[12px] text-[rgba(5,5,5,0.6)] mt-1";

const quickActionsGridClass =
  "grid grid-cols-4 gap-3.5 mb-2.5 max-[980px]:grid-cols-2 max-[560px]:grid-cols-1";

const quickActionClass = `min-h-[132px] p-[18px] border-2 border-[#050505] rounded-xl bg-white text-[#050505] cursor-pointer text-left shadow-[3px_3px_0_#f47a4a] ${hoverLiftTransition} hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#f47a4a] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-[3px]`;

const quickActionLabelClass = "text-[16px] font-black";

const quickActionDescriptionClass =
  "mx-0 mt-2 mb-0 text-[rgba(5,5,5,0.64)] text-[13px] font-semibold leading-[1.5]";

const contentSectionClass =
  "bg-white rounded-2xl p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)] border-[3px] border-[#050505]";

// Replaces the styled SectionTitle plus the `${SectionTitle}` override that
// MembersHeader applied to it (the `compact` variant).
function SectionTitle({
  compact = false,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <h2
      className={`inline-flex items-center border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] font-black ${
        compact
          ? "h-9 m-0 py-0 px-3 text-[14px]"
          : "mb-5 py-[0.3rem] px-[0.7rem] text-[16px]"
      }`}
    >
      {children}
    </h2>
  );
}

const membersHeaderClass =
  "flex items-center justify-between gap-3 mb-4 max-[560px]:items-start max-[560px]:flex-col";

const membersTabsClass =
  "flex gap-2 mb-4 border-b-[1.5px] border-b-[rgba(5,5,5,0.22)]";

const membersTabClass = (active: boolean) =>
  `border-0 border-b-[3px] mb-[-1.5px] pt-[7px] px-2.5 pb-2 bg-transparent text-[13px] font-extrabold cursor-pointer focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2 ${
    active
      ? "border-b-[#050505] text-[#050505]"
      : "border-b-transparent text-[rgba(5,5,5,0.58)]"
  }`;

const usersListClass = "flex flex-col gap-3";

const userCardClass = `flex flex-col items-stretch p-4 border-[1.5px] border-[#050505] rounded-[10px] ${cardHoverLift}`;

const userInfoClass =
  "flex-1 grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center";

const creditInspectorClass =
  "grid gap-2 w-full mt-3 pt-3 border-t border-t-[rgba(5,5,5,0.15)] text-[12px]";

const creditControlsClass =
  "flex flex-wrap gap-2 " +
  "[&_input]:min-w-0 [&_input]:border [&_input]:border-[#050505] [&_input]:rounded-[6px] [&_input]:py-1.5 [&_input]:px-2 [&_input]:[font:inherit] " +
  "[&_button]:border [&_button]:border-[#050505] [&_button]:rounded-[6px] [&_button]:bg-white [&_button]:py-1.5 [&_button]:px-2 [&_button]:[font:inherit] [&_button]:font-extrabold [&_button]:cursor-pointer";

const userNameClass = "font-extrabold text-[#050505] text-[14px]";

const userEmailClass = "text-[rgba(5,5,5,0.6)] text-[13px]";

const statusPillClass =
  "inline-flex items-center py-1 px-2.5 border-[1.5px] border-[#050505] rounded-full text-[12px] font-extrabold text-[#050505]";

const userStatusClass = (active: boolean) =>
  `${statusPillClass} ${active ? "bg-[#dcfce7]" : "bg-[#fee2e2]"}`;

const locationStatusClass = (location: MembershipLocation) =>
  `${statusPillClass} ${location === "yeouido" ? "bg-[#dbeafe]" : "bg-[#ffedd5]"}`;

const userDateClass = "text-[rgba(5,5,5,0.6)] text-[12px]";

const applicantListClass = "flex flex-col gap-3";

const applicantCardClass = `border-[1.5px] border-[#050505] rounded-[10px] p-4 ${cardHoverLift}`;

const applicantHeaderClass = "flex items-start justify-between gap-3";

const applicantDetailsClass =
  "grid grid-cols-3 gap-3 mx-0 mt-3.5 mb-0 max-[640px]:grid-cols-1 " +
  "[&_dt]:mx-0 [&_dt]:mt-0 [&_dt]:mb-[3px] [&_dt]:text-[rgba(5,5,5,0.58)] [&_dt]:text-[11px] [&_dt]:font-extrabold [&_dt]:uppercase " +
  "[&_dd]:m-0 [&_dd]:text-[#050505] [&_dd]:text-[13px] [&_dd]:font-bold [&_dd]:[overflow-wrap:anywhere]";

const applicantStatusClass = (status: NonKoreanApplication["status"]) =>
  `inline-flex items-center border-[1.5px] border-[#050505] rounded-full text-[#050505] py-1 px-2.5 text-[11px] [font-weight:850] capitalize ${
    status === "approved"
      ? "bg-[#dcfce7]"
      : status === "declined"
      ? "bg-[#fee2e2]"
      : "bg-[#fef3c7]"
  }`;

const externalProfileLinkClass =
  "text-[#050505] font-extrabold underline underline-offset-[0.16em]";

const feedbackListClass = "flex flex-col gap-3";

const feedbackCardClass = `border-[1.5px] border-[#050505] rounded-[10px] p-5 ${cardHoverLift}`;

const feedbackHeaderClass = "flex justify-between items-start mb-3";

const feedbackCategoryClass = (category: string) =>
  `inline-flex items-center py-1 px-3 border-[1.5px] border-[#050505] rounded-full text-[12px] font-extrabold uppercase tracking-[0.5px] text-[#050505] ${
    category === "cancellation" ? "bg-[#fef3c7]" : "bg-[#f47a4a]"
  }`;

const feedbackDateClass = "text-[rgba(5,5,5,0.6)] text-[12px]";

const feedbackUserClass = "text-[#050505] font-extrabold text-[14px] mb-2";

const feedbackReasonsClass = "mb-3";

const reasonsListClass = "list-none p-0 my-2 mx-0";

const reasonItemClass =
  "py-1 px-0 text-[rgba(5,5,5,0.72)] text-[14px] before:content-['•'] before:text-[#f47a4a] before:font-black before:mr-2";

const feedbackOtherClass =
  "bg-[#faf8f4] border-[1.5px] border-[#050505] border-l-4 border-l-[#f47a4a] p-3 mt-2 rounded-lg italic text-[rgba(5,5,5,0.72)]";

const articlesListClass = "flex flex-col gap-2.5";

const articleCardClass =
  "w-full flex flex-col py-3 px-3.5 rounded-[10px] border-[1.5px] border-[#050505] bg-white text-[#050505] shadow-[3px_3px_0_rgba(5,5,5,0.9)] hover:shadow-[4px_4px_0_rgba(5,5,5,0.9)]";

const articleOpenButtonClass = (ready: boolean) =>
  `flex w-full flex-col gap-1.5 border-0 p-0 bg-transparent text-inherit text-left transition-[translate] duration-[140ms] ease-[ease] hover:enabled:-translate-x-0.5 hover:enabled:-translate-y-0.5 focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-[5px] disabled:opacity-[0.78] ${
    ready ? "cursor-pointer" : "cursor-default"
  }`;

const articleStatusClass = (tone: "processing" | "published" | "failed") =>
  `inline-flex items-center w-fit border-[1.5px] border-[#050505] rounded-full py-1 px-2 text-[11px] font-black ${
    tone === "failed"
      ? "bg-[#fee2e2] text-[#991b1b]"
      : tone === "published"
      ? "bg-[#dcfce7] text-[#050505]"
      : "bg-[#fff3cd] text-[#050505]"
  }`;

const progressTrackClass =
  "w-full h-2 overflow-hidden border-[1.5px] border-[#050505] rounded-full bg-[#fff8f4]";

const progressFillClass = (failed: boolean) =>
  `h-full transition-[width] duration-300 ease-[ease] ${
    failed ? "bg-[#dc2626]" : "bg-[#f47a4a]"
  }`;

const progressHintClass = "text-[rgba(5,5,5,0.6)] text-[12px] font-bold";

const articleCardFooterClass = "flex flex-col gap-1.5 mt-1.5";

const articleActionsClass = "flex justify-end gap-2.5 mt-2";

const articleHeaderClass = "flex justify-between items-start gap-3";

const articleTitleClass =
  "text-[16px] font-extrabold text-[#050505] leading-[1.35]";

const articleSubtitleClass = "text-[14px] text-[rgba(5,5,5,0.6)]";

const articleMetaClass =
  "flex flex-wrap justify-end gap-2 text-[12px] text-[rgba(5,5,5,0.6)] text-right";

const articleActionButtonClass = (variant?: "danger") =>
  `inline-flex items-center gap-1.5 py-2 px-3.5 rounded-full border-2 border-[#050505] text-[13px] font-extrabold cursor-pointer ${hoverLiftTransition} hover:-translate-x-px hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-none disabled:shadow-none [&_svg]:w-4 [&_svg]:h-4 ${
    variant === "danger"
      ? "bg-[#fee2e2] text-[#991b1b] shadow-[2px_2px_0_#991b1b] hover:shadow-[3px_3px_0_#991b1b]"
      : "bg-white text-[#050505] shadow-[2px_2px_0_#050505] hover:shadow-[3px_3px_0_#050505]"
  }`;

const membersToolbarClass = "flex items-center";

const membersActionButtonClass = `inline-flex items-center h-9 gap-1.5 py-0 px-3 rounded-full border-2 border-[#050505] bg-[#f47a4a] text-[#050505] text-[12px] font-extrabold cursor-pointer ${hoverLiftTransition} shadow-[3px_3px_0_#050505] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#050505] disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-none disabled:shadow-none [&_svg]:w-[15px] [&_svg]:h-[15px]`;

const loadingSpinnerClass =
  "flex justify-center items-center p-10 text-[rgba(5,5,5,0.6)] font-bold";

const emptyStateClass = "text-center p-10 text-[rgba(5,5,5,0.6)] font-bold";

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
      <div className={quickActionsGridClass} aria-label={t.admin.dashboard.title}>
          {ADMIN_SECTIONS.map(({ id, path }) => (
            <button key={id} type="button" className={quickActionClass} onClick={() => router.push(path)}>
              <div className={quickActionLabelClass}>{t.admin.dashboard.sections[id].label}</div>
              <p className={quickActionDescriptionClass}>{t.admin.dashboard.sections[id].description}</p>
            </button>
          ))}
      </div>

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
      <div className={contentSectionClass}>
        <div className={membersHeaderClass}>
          <SectionTitle compact>{withCount(copy.title, users.length)}</SectionTitle>
          <div className={membersToolbarClass}>
            <button
              type="button"
              className={membersActionButtonClass}
              onClick={handleExtendActiveMembers}
              disabled={extendingSubscriptions || activeMembersCount === 0}
            >
              <CalendarDaysIcon />
              {extendButtonLabel}
            </button>
          </div>
        </div>

        <div className={membersTabsClass} role="tablist" aria-label={copy.tabListLabel}>
          <button
            type="button"
            role="tab"
            id="members-tab"
            aria-controls="members-panel"
            aria-selected={membersTab === "members"}
            className={membersTabClass(membersTab === "members")}
            onClick={() => setMembersTab("members")}
          >
            {withCount(copy.tabMembers, users.length)}
          </button>
          <button
            type="button"
            role="tab"
            id="feedback-tab"
            aria-controls="feedback-panel"
            aria-selected={membersTab === "feedback"}
            className={membersTabClass(membersTab === "feedback")}
            onClick={() => setMembersTab("feedback")}
          >
            {withCount(copy.tabFeedback, feedback.length)}
          </button>
          <button
            type="button"
            role="tab"
            id="applicants-tab"
            aria-controls="applicants-panel"
            aria-selected={membersTab === "applicants"}
            className={membersTabClass(membersTab === "applicants")}
            onClick={() => setMembersTab("applicants")}
          >
            {withCount(copy.tabApplicants, applications.length)}
          </button>
        </div>

        {membersTab === "members" ? (
          <div className={usersListClass} id="members-panel" role="tabpanel" aria-labelledby="members-tab">
            {users.map((user) => (
              <div className={userCardClass} key={user.id}>
                <div className={userInfoClass}>
                  <div>
                    <div className={userNameClass}>{user.displayName || copy.noName}</div>
                    <div className={userEmailClass}>{user.email}</div>
                  </div>

                  <div>
                    <div className={locationStatusClass(user.location)}>
                      {user.location === "yeouido" ? copy.locationYeouido : copy.locationAnam}
                    </div>
                  </div>

                  <div className={userStatusClass(!!user.hasActiveSubscription)}>
                    {user.hasActiveSubscription ? copy.active : copy.inactive}
                  </div>

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

                  <div className={userDateClass}>{formatDate(user.createdAt)}</div>
                </div>
                <div className={creditInspectorClass}>
                  <strong>회차 참여권: {user.participationCreditBalance ?? 0}회</strong>
                  <div className={creditControlsClass}>
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
                  </div>
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
                </div>
              </div>
            ))}
          </div>
        ) : membersTab === "feedback" ? (
          <div id="feedback-panel" role="tabpanel" aria-labelledby="feedback-tab">
            {renderFeedback()}
          </div>
        ) : (
          <div className={applicantListClass} id="applicants-panel" role="tabpanel" aria-labelledby="applicants-tab">
            {applications.length === 0 ? (
              <div className={emptyStateClass}>{copy.noApplicants}</div>
            ) : (
              applications.map((application) => {
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
                        <dd>{formatDateTime(application.createdAt)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFeedback = () => (
       <div className={feedbackListClass}>
         {feedback.length === 0 ? (
           <div className={emptyStateClass}>{t.admin.members.noFeedback}</div>
         ) : (
           feedback.map((item) => {
             const linkedUser = usersById.get(item.userId);
             const linkedDisplayName = linkedUser?.displayName;

             return (
               <div className={feedbackCardClass} key={item.id}>
                 <div className={feedbackHeaderClass}>
                   <div className={feedbackCategoryClass(item.category)}>
                     {item.category === "cancellation"
                       ? t.admin.members.subscriptionStop
                       : t.admin.members.refundRequest}
                   </div>
                   <div className={feedbackDateClass}>{formatDateTime(item.timestamp)}</div>
                 </div>

                 <div className={feedbackUserClass}>
                   {linkedDisplayName
                     ? `${linkedDisplayName} (${item.userId})`
                     : t.admin.members.userId.replace("{id}", item.userId)}
                 </div>

                 <div className={feedbackReasonsClass}>
                   <strong>{t.admin.members.selectedReasons}</strong>
                   <ul className={reasonsListClass}>
                     {item.reasons.map((reason, index) => (
                       <li className={reasonItemClass} key={index}>{reason}</li>
                     ))}
                   </ul>
                 </div>

                 {item.otherReason && (
                   <div className={feedbackOtherClass}>
                     <strong>{t.admin.members.additionalComments}</strong>
                     <br />
                     {item.otherReason}
                   </div>
                 )}
               </div>
             );
           })
         )}
       </div>
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
        <div className={contentSectionClass}>
          <SectionTitle>
            {copy.listTitle.replace("{count}", String(articles.length))}
          </SectionTitle>
          {articles.length === 0 ? (
            <div className={emptyStateClass}>{copy.empty}</div>
          ) : (
            <div className={articlesListClass}>
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
                  <article className={articleCardClass} key={article.id}>
                    <button
                      type="button"
                      className={articleOpenButtonClass(isReady)}
                      disabled={!isReady}
                      onClick={() => handleArticleClick(article.id)}
                      aria-label={isReady ? copy.openReady : copy.availableWhenReady}
                    >
                      <div className={articleHeaderClass}>
                        <div className={articleTitleClass}>{primaryTitle}</div>
                        <div className={articleMetaClass}>
                          <span>{formatDateTime(article.publishedAt)}</span>
                          <span>{copy.articleId.replace("{id}", article.id)}</span>
                        </div>
                      </div>

                      {showKoreanSubtitle && (
                        <div className={articleSubtitleClass}>{article.titleKorean}</div>
                      )}

                      <div className={articleCardFooterClass}>
                        <span className={articleStatusClass(statusTone)}>
                          {!isReady && !isFailed
                            ? copy.processingProgress
                                .replace("{status}", processingLabel(article))
                                .replace("{progress}", String(progress))
                            : processingLabel(article)}
                        </span>
                        {!isReady && (
                          <>
                            <div className={progressTrackClass}>
                              <div
                                className={progressFillClass(isFailed)}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className={progressHintClass}>{copy.availableWhenReady}</span>
                          </>
                        )}
                      </div>
                    </button>

                    <div className={articleActionsClass}>
                      <button
                        type="button"
                        className={articleActionButtonClass("danger")}
                        onClick={() => handleDeleteArticle(article.id)}
                        disabled={deletingArticleId === article.id}
                      >
                        <TrashIcon />
                        {deletingArticleId === article.id
                          ? copy.deleting
                          : copy.delete}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };

  if (authChecking) {
    return (
      <div className={wrapperClass}>
        <div className={loadingSpinnerClass}>{t.admin.dashboard.checkingAccess}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={wrapperClass}>
        <div className={loadingSpinnerClass}>{t.admin.dashboard.loading}</div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      {section === "dashboard" && renderDashboard()}
      {section === "members" && renderMembers()}
      {section === "articles" && renderArticles()}
      {section === "marketing" && <GrowthDashboard />}
    </div>
  );
}
