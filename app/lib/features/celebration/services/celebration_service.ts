import { supabase } from "../../../supabase/client";
import { Celebration } from "../types/celebration_types";

const TABLE_NAME = "celebrations";

// Convert a Supabase row (snake_case) into a Celebration object.
// NOTE: the celebrations table has no created_at/updated_at columns (see
// supabase_schema.sql). The Celebration type still requires them, so we
// synthesize them from achieved_at (falling back to now) to keep sort/UI stable.
const rowToCelebration = (data: any): Celebration => {
  const achieved = data.achieved_at ? new Date(data.achieved_at) : null;
  return {
    id: data.id,
    memberName: data.member_name || "",
    headline: data.headline || "",
    description: data.description || "",
    logoUrl: data.logo_url || "",
    achievedAt: achieved ? achieved.toISOString() : null,
    order: typeof data.order === "number" ? data.order : null,
    createdAt: achieved || new Date(),
    updatedAt: achieved || new Date(),
  };
};

// Sort: admin-defined `order` first (ascending); items without an explicit
// order fall back to most-recent achievement, then most recently created.
const sortCelebrations = (a: Celebration, b: Celebration): number => {
  const ao = typeof a.order === "number" ? a.order : Number.POSITIVE_INFINITY;
  const bo = typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;

  const aTime = a.achievedAt ? new Date(a.achievedAt).getTime() : 0;
  const bTime = b.achievedAt ? new Date(b.achievedAt).getTime() : 0;
  if (bTime !== aTime) return bTime - aTime;
  return b.createdAt.getTime() - a.createdAt.getTime();
};

// Fetch all celebrations (public).
export const fetchCelebrations = async (): Promise<Celebration[]> => {
  try {
    const { data, error } = await supabase.from(TABLE_NAME).select("*");
    if (error) throw error;
    return (data || []).map(rowToCelebration).sort(sortCelebrations);
  } catch (error) {
    console.error("Error fetching celebrations:", error);
    // Return empty array instead of throwing if collection doesn't exist yet.
    return [];
  }
};

// Create a celebration (admin only — enforced by RLS).
export const createCelebration = async (
  data: Partial<Celebration>
): Promise<string> => {
  try {
    // celebrations.id is TEXT (was a Firestore doc id) — generate one.
    const id = crypto.randomUUID();
    const celebration: any = {
      id,
      member_name: data.memberName || "",
      headline: data.headline || "",
    };

    if (data.description) celebration.description = data.description;
    if (data.logoUrl) celebration.logo_url = data.logoUrl;
    if (data.achievedAt) {
      celebration.achieved_at = new Date(data.achievedAt).toISOString();
    }

    const { data: inserted, error } = await supabase
      .from(TABLE_NAME)
      .insert(celebration)
      .select()
      .single();
    if (error) throw error;
    return inserted.id;
  } catch (error) {
    console.error("Error creating celebration:", error);
    throw new Error(
      "Failed to create celebration: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
};

// Update a celebration (admin only).
export const updateCelebration = async (
  id: string,
  data: Partial<Celebration>
): Promise<void> => {
  try {
    const updateData: any = {};

    if (data.memberName !== undefined) updateData.member_name = data.memberName;
    if (data.headline !== undefined) updateData.headline = data.headline;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.logoUrl !== undefined) updateData.logo_url = data.logoUrl;
    if (data.achievedAt !== undefined) {
      updateData.achieved_at = data.achievedAt
        ? new Date(data.achievedAt).toISOString()
        : null;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error updating celebration:", error);
    throw new Error(
      "Failed to update celebration: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
};

// Delete a celebration (admin only).
export const deleteCelebration = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting celebration:", error);
    throw new Error("Failed to delete celebration");
  }
};

// Persist a new display order (admin only). Writes `order` = position index for
// each id, so the whole list gets explicit, stable ordering.
export const reorderCelebrations = async (
  orderedIds: string[]
): Promise<void> => {
  try {
    // supabase-js has no batch primitive; issue the updates in parallel.
    const results = await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from(TABLE_NAME).update({ order: index }).eq("id", id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
  } catch (error) {
    console.error("Error reordering celebrations:", error);
    throw new Error("Failed to reorder celebrations");
  }
};
