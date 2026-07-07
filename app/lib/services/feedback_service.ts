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

  const { data: userRow } = await supabase
    .from("users")
    .select("uid")
    .eq("auth_id", user.id)
    .maybeSingle();
  const userId = userRow?.uid ?? user.id;

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
