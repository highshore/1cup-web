import type { UserData } from "./useAdminMembersData";

// Membership access and recurring billing are separate. A member who stopped
// renewals can still use their purchased period until it expires.
export type MemberBillingStatus =
  | "ongoing"
  | "stopped_active"
  | "stopped_ended"
  | "ended"
  | "none"
  | "unknown";

export type MemberStatusFilter =
  | "all"
  | "ongoing"
  | "cancelled"
  | "active"
  | "ended"
  | "none";

export function getMemberBillingStatus(user: UserData): MemberBillingStatus {
  // Check the renewal flag before the access flag: stopping billing does not
  // automatically revoke an already-paid membership.
  if (user.billingCancelled) {
    return user.hasActiveSubscription ? "stopped_active" : "stopped_ended";
  }
  if (user.hasActiveSubscription) return "ongoing";
  if (user.hasPurchasedMembership || user.subscriptionStartDate || user.subscriptionEndDate) {
    return "ended";
  }
  return user.purchaseHistoryLoaded === false ? "unknown" : "none";
}

export function matchesMemberStatus(user: UserData, filter: MemberStatusFilter): boolean {
  if (filter === "all") return true;
  const status = getMemberBillingStatus(user);
  if (filter === "ongoing") return status === "ongoing";
  if (filter === "cancelled") return status === "stopped_active" || status === "stopped_ended";
  if (filter === "active") return !!user.hasActiveSubscription;
  if (filter === "ended") return status === "stopped_ended" || status === "ended";
  return status === "none";
}
