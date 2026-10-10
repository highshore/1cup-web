"use client";

import { useEffect, useState } from "react";

import { useAuth } from "../../lib/contexts/auth_context";
import { supabase } from "../../lib/supabase/client";

export type MembershipLocation = "yeouido" | "anam";

export interface CompletedMembershipPayment {
  amount: number;
  completedAt: string;
  type: "subscription_initial_payment" | "subscription_recurring";
}

export interface UserData {
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
  hasPurchasedMembership?: boolean;
  hasPurchasedParticipationPack?: boolean;
  purchaseHistoryLoaded?: boolean;
  lastMembershipPayment?: CompletedMembershipPayment;
}

export interface FeedbackData {
  id: string;
  userId: string;
  category: "cancellation" | "refund";
  reasons: string[];
  otherReason?: string;
  timestamp: string;
}

export interface NonKoreanApplication {
  id: string;
  userId: string;
  email: string;
  nationality: string;
  linkedinUrl: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
}

// Completed payment records distinguish purchases from granted or unused credits.
// Older recurring membership orders have no product_id, so identify by payment type.
// Fetch in pages to avoid silently dropping purchases at the PostgREST row cap.
async function fetchPurchasedProducts(): Promise<Map<string, {
  membership: boolean;
  pack: boolean;
  lastMembershipPayment?: CompletedMembershipPayment;
}>> {
  const byUser = new Map<string, {
    membership: boolean;
    pack: boolean;
    lastMembershipPayment?: CompletedMembershipPayment;
  }>();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("payment_orders")
      .select("user_id, type, amount, completed_at")
      .eq("status", "completed")
      .in("type", [
        "subscription_initial_payment",
        "subscription_recurring",
        "participation_pack_purchase",
      ])
      .order("order_number", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const order of data ?? []) {
      if (!order.user_id) continue;
      const current = byUser.get(order.user_id) ?? { membership: false, pack: false };
      if (order.type === "participation_pack_purchase") {
        current.pack = true;
      } else {
        current.membership = true;
        // Only trust completed payment amounts: these include actual discounts.
        // Keep the most recent membership charge, whether initial or renewal.
        const paidAmount = Number(order.amount);
        const paidAt = order.completed_at;
        const paymentTime = typeof paidAt === "string" ? Date.parse(paidAt) : NaN;
        if (Number.isFinite(paidAmount) && paidAmount >= 0 && Number.isFinite(paymentTime)) {
          const previous = current.lastMembershipPayment;
          if (!previous || paymentTime >= Date.parse(previous.completedAt)) {
            current.lastMembershipPayment = {
              amount: paidAmount,
              completedAt: paidAt,
              type: order.type as CompletedMembershipPayment["type"],
            };
          }
        }
      }
      byUser.set(order.user_id, current);
    }
    if ((data ?? []).length < pageSize) break;
  }
  return byUser;
}

export async function fetchUsers(): Promise<UserData[]> {
  try {
    const [{ data, error }, { data: balances, error: balanceError }, purchases] = await Promise.all([
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("participation_credit_balances").select("user_id, balance"),
      fetchPurchasedProducts().catch((error) => {
        // Never mistake an unavailable payment history for a member with no purchases.
        console.error("Error fetching member purchases:", error);
        return null;
      }),
    ]);
    if (error) throw error;
    if (balanceError) throw balanceError;
    const balanceByUser = new Map(
      (balances || []).map((row: any) => [row.user_id, Number(row.balance || 0)]),
    );

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
        hasPurchasedMembership: purchases?.get(row.uid)?.membership ?? false,
        hasPurchasedParticipationPack: purchases?.get(row.uid)?.pack ?? false,
        purchaseHistoryLoaded: purchases !== null,
        lastMembershipPayment: purchases?.get(row.uid)?.lastMembershipPayment,
      }))
      .filter((user) => !user.isPlaceholder);
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

async function fetchFeedback(): Promise<FeedbackData[]> {
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
}

async function fetchApplications(): Promise<NonKoreanApplication[]> {
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
      status: row.status === "approved" || row.status === "declined" ? row.status : "pending",
      createdAt: String(row.created_at ?? ""),
    }));
  } catch (error) {
    console.error("Error fetching non-Korean applications:", error);
    return [];
  }
}

// Members, cancellation feedback and non-Korean applications for the members admin page.
export function useAdminMembersData() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const authId = currentUser?.authId ?? null;
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [feedback, setFeedback] = useState<FeedbackData[]>([]);
  const [applications, setApplications] = useState<NonKoreanApplication[]>([]);

  useEffect(() => {
    // app/admin/layout.tsx has already verified admin access on the server; this only
    // waits for the browser session so RLS sees it. Keyed on the auth id rather than the
    // user object so Supabase re-emitting the same session on tab focus does not reload
    // the whole list.
    if (authLoading || !authId) return;

    // If the identity changes while a load is in flight, the older load must not
    // overwrite the newer one's results when it resolves late.
    let cancelled = false;
    Promise.all([fetchUsers(), fetchFeedback(), fetchApplications()])
      .then(([usersData, feedbackData, applicationsData]) => {
        if (cancelled) return;
        setUsers(usersData);
        setFeedback(feedbackData);
        setApplications(applicationsData);
      })
      .catch((error) => {
        if (!cancelled) console.error("Error loading members data:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authId, authLoading]);

  return { loading, users, setUsers, feedback, applications };
}
