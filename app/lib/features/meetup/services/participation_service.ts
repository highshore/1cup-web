import { supabase } from "../../../supabase/client";

export type MeetupEntitlement = {
  canJoin: boolean;
  source: "subscription" | "credit" | "complimentary" | "none";
  creditBalance: number;
};

export type MeetupRegistrationResult = {
  access_type: "subscription" | "credit" | "complimentary" | "legacy";
  registration_status: "registered";
  credit_balance: number;
  credit_transaction_id: string | null;
};

export type MeetupCancellationQuote = {
  cancellation_allowed: boolean;
  credit_will_be_refunded: boolean;
  access_type: "subscription" | "credit" | "complimentary" | "legacy";
  message: string;
};

export type MeetupCancellationResult = {
  access_type: "subscription" | "credit" | "complimentary" | "legacy";
  credit_refunded: boolean;
  credit_balance: number;
};

function firstRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getParticipationCreditBalance(): Promise<number> {
  const { data, error } = await supabase
    .from("participation_credit_balances")
    .select("balance")
    .maybeSingle();
  if (error) throw error;
  return Number(data?.balance ?? 0);
}

export async function getMeetupEntitlement(input: {
  hasActiveSubscription: boolean;
  isComplimentary: boolean;
}): Promise<MeetupEntitlement> {
  const creditBalance = await getParticipationCreditBalance();
  if (input.isComplimentary) {
    return { canJoin: true, source: "complimentary", creditBalance };
  }
  if (input.hasActiveSubscription) {
    return { canJoin: true, source: "subscription", creditBalance };
  }
  if (creditBalance > 0) {
    return { canJoin: true, source: "credit", creditBalance };
  }
  return { canJoin: false, source: "none", creditBalance };
}

export async function registerForMeetup(
  meetupId: string,
  role: "participant" | "leader" = "participant",
): Promise<MeetupRegistrationResult> {
  const { data, error } = await supabase.rpc("register_for_meetup", {
    p_meetup_id: meetupId,
    p_role: role,
  });
  if (error) throw error;
  const row = firstRow(data) as MeetupRegistrationResult | null;
  if (!row) throw new Error("밋업 신청 결과를 확인할 수 없습니다.");
  return row;
}

export async function getMeetupCancellationQuote(
  meetupId: string,
): Promise<MeetupCancellationQuote> {
  const { data, error } = await supabase.rpc("meetup_cancellation_quote", {
    p_meetup_id: meetupId,
  });
  if (error) throw error;
  const row = firstRow(data) as MeetupCancellationQuote | null;
  if (!row) throw new Error("취소 정책을 확인할 수 없습니다.");
  return row;
}

export async function cancelMeetupRegistration(
  meetupId: string,
): Promise<MeetupCancellationResult> {
  const { data, error } = await supabase.rpc("cancel_meetup_registration", {
    p_meetup_id: meetupId,
  });
  if (error) throw error;
  const row = firstRow(data) as MeetupCancellationResult | null;
  if (!row) throw new Error("밋업 취소 결과를 확인할 수 없습니다.");
  return row;
}

export async function getParticipationCreditHistory(limit = 8) {
  const { data, error } = await supabase
    .from("participation_credit_transactions")
    .select("id, amount, type, meetup_id, payment_order_id, expires_at, metadata, created_at, meetups(title, date_time)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
