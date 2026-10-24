import { matchesMemberStatus, type MemberStatusFilter } from "./membershipStatus";
import type { MembershipLocation, UserData } from "./useAdminMembersData";

export type PurchaseFilter = "all" | "membership" | "pass" | "both" | "none";
export type LocationFilter = "all" | MembershipLocation;
export type MemberSort = "newest" | "oldest" | "name" | "payment_desc" | "payment_asc" | "credits_desc";

export type MemberFilters = {
  status: MemberStatusFilter;
  purchase: PurchaseFilter;
  location: LocationFilter;
};

export const DEFAULT_MEMBER_FILTERS: MemberFilters = {
  status: "all",
  purchase: "all",
  location: "all",
};

export function matchesMemberFilters(
  user: UserData,
  filters: MemberFilters,
  purchaseDataAvailable: boolean,
): boolean {
  if (filters.location !== "all" && user.location !== filters.location) return false;
  if (!matchesMemberStatus(user, filters.status)) {
    // Avoid classifying unknown purchase data as "never subscribed".
    if (purchaseDataAvailable || (filters.status !== "ended" && filters.status !== "none")) {
      return false;
    }
  }
  if (!purchaseDataAvailable || filters.purchase === "all") return true;
  const membership = !!user.hasPurchasedMembership;
  const pass = !!user.hasPurchasedParticipationPack;
  if (filters.purchase === "membership") return membership;
  if (filters.purchase === "pass") return pass;
  if (filters.purchase === "both") return membership && pass;
  return !membership && !pass;
}

function timestamp(input: Date | string | undefined): number {
  if (!input) return -Infinity;
  const time = new Date(input).getTime();
  return Number.isFinite(time) ? time : -Infinity;
}

export function sortMembers(users: UserData[], sort: MemberSort): UserData[] {
  const collator = new Intl.Collator("ko", { sensitivity: "base", numeric: true });
  return [...users].sort((a, b) => {
    let difference = 0;
    if (sort === "newest") difference = timestamp(b.createdAt) - timestamp(a.createdAt);
    if (sort === "oldest") difference = timestamp(a.createdAt) - timestamp(b.createdAt);
    if (sort === "name") {
      difference = collator.compare(a.displayName || a.email || "", b.displayName || b.email || "");
    }
    if (sort === "credits_desc") {
      difference = (b.participationCreditBalance ?? 0) - (a.participationCreditBalance ?? 0);
    }
    if (sort === "payment_desc" || sort === "payment_asc") {
      const priceA = a.hasActiveSubscription && !a.billingCancelled
        ? a.lastMembershipPayment?.amount : undefined;
      const priceB = b.hasActiveSubscription && !b.billingCancelled
        ? b.lastMembershipPayment?.amount : undefined;
      if (priceA === undefined && priceB !== undefined) return 1;
      if (priceB === undefined && priceA !== undefined) return -1;
      if (priceA !== undefined && priceB !== undefined) {
        difference = sort === "payment_desc" ? priceB - priceA : priceA - priceB;
      }
    }
    if (Number.isNaN(difference)) difference = 0;
    return difference || (timestamp(b.createdAt) - timestamp(a.createdAt)) ||
      collator.compare(a.id, b.id);
  });
}
