import { supabase } from "../supabase/client";

export interface FeedbackData {
  userId: string;
  category: "cancellation" | "refund";
  reasons: string[];
  otherReason?: string;
  timestamp: any;
}

export const saveFeedback = async (
  category: "cancellation" | "refund",
  reasons: string[],
  otherReason?: string
): Promise<void> => {
  // Resolve the current auth user, then the linked public.users.uid.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Resolve through the auth-identity link table: phone-OTP and Kakao sessions are
  // different auth users for the same person, and the RLS insert CHECK is
  // user_id = current_uid().
  const { data: resolvedUid } = await supabase.rpc("current_uid");
  const userId = (resolvedUid as string | null) ?? user.id;

  const feedbackData: any = {
    id: crypto.randomUUID(),
    kind: category, // survey | cancellation | refund
    user_id: userId,
    category,
    reasons,
    created_at: new Date().toISOString(),
  };

  // Only add other_reason if it exists and is not empty
  if (otherReason && otherReason.trim() !== "") {
    feedbackData.other_reason = otherReason.trim();
  }

  try {
    const { error } = await supabase.from("feedback").insert(feedbackData);
    if (error) throw error;
    console.log("Feedback saved successfully");
  } catch (error) {
    console.error("Error saving feedback:", error);
    throw error;
  }
};
