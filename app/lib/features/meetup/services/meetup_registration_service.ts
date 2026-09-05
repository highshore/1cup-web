import { supabase } from "../../../supabase/client";

// Meetup participation writes must go through the database RPC. The participation-credit
// migration intentionally removed direct member INSERT/UPDATE/DELETE policies so capacity,
// subscription access, and credit spending stay atomic under one row lock.
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
