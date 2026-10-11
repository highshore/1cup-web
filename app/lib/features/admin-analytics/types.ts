export type AnalyticsRange = "month" | "lastMonth" | "3m" | "12m";

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
  months: MonthlyAnalytics[];
  cohorts: RetentionCohort[];
};
