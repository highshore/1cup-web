import { supabase } from "../../../supabase/client";

// Meetup participation writes must go through the database RPCs. The participation-credit
// migration intentionally removed direct member INSERT/UPDATE/DELETE policies so capacity,
// subscription access, credit spending, and credit refunds stay atomic under row locks.
export const joinEventAsRole = async (
  eventId: string,
  _userId: string,
  role: "participant" | "leader",
): Promise<void> => {
  const { error } = await supabase.rpc("register_for_meetup", {
    p_meetup_id: eventId,
    p_role: role,
  });

  if (error) {
    throw new Error(error.message || "Meetup registration failed");
  }
};

export const cancelParticipation = async (
  eventId: string,
  _userId: string,
): Promise<void> => {
  const { error } = await supabase.rpc("cancel_meetup_registration", {
    p_meetup_id: eventId,
  });

  if (error) {
    throw new Error(error.message || "Meetup cancellation failed");
  }
};
