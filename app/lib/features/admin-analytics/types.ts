export type AnalyticsRange = "day" | "week" | "month" | "year" | "custom";
export type AnalyticsComparison = "previous" | "yearAgo" | "none";

export type MonthlyAnalytics = {
  month: string;
  membershipRevenue: number;
  passRevenue: number;
  refunds: number;
  netRevenue: number;
  newPayers: number;
  returningPayers: number;
  meetups: number;
  reservations: number;
  capacity: number;
};

export type RetentionCohort = {
  cohort: string;
  size: number;
  retention: Array<number | null>;
};

export type AdminAnalyticsData = {
  range: {
    id: AnalyticsRange;
    comparison: AnalyticsComparison;
    comparisonFrom: string | null;
    comparisonTo: string | null;
    from: string;
    to: string;
    partial: boolean;
  };
  summary: {
    grossRevenue: number;
    netRevenue: number;
    refunds: number;
    refundCount: number;
    previousNetRevenue: number;
    growthPercent: number | null;
    payingMembers: number;
    newPayers: number;
    returningPayers: number;
    repeatPayerPercent: number;
    averageRevenuePerPayer: number;
    membershipRevenue: number;
    passRevenue: number;
    recurringPayments: number;
    packRepurchasePercent: number | null;
    activeBookers30d: number;
    activeSubscriptions: number;
    renewingSubscriptions: number;
    stoppedActiveSubscriptions: number;
    stoppedEndedSubscriptions: number;
  };
  operations: {
    meetupCount: number;
    reservations: number;
    cancelledRegistrations: number;
    uniqueBookers: number;
    capacity: number;
    occupancyPercent: number | null;
    cancellationPercent: number | null;
  };
  freshness?: { source: "live" | "historical-cache" | "recent-cache"; fetchedAt: string; ttlSeconds: number };
  months: MonthlyAnalytics[];
  cohorts: RetentionCohort[];
};
