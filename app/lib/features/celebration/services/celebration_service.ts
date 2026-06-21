import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { Celebration } from "../types/celebration_types";

const COLLECTION_NAME = "celebrations";

// Convert a Firestore document into a Celebration object.
const docToCelebration = (doc: any): Celebration => {
  const data = doc.data();
  return {
    id: doc.id,
    memberName: data.memberName || "",
    headline: data.headline || "",
    description: data.description || "",
    logoUrl: data.logoUrl || "",
    achievedAt: data.achievedAt
      ? data.achievedAt.toDate
        ? data.achievedAt.toDate().toISOString()
        : String(data.achievedAt)
      : null,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
};

// Sort: most recent achievement first, falling back to most recently created.
const sortCelebrations = (a: Celebration, b: Celebration): number => {
  const aTime = a.achievedAt ? new Date(a.achievedAt).getTime() : 0;
  const bTime = b.achievedAt ? new Date(b.achievedAt).getTime() : 0;
  if (bTime !== aTime) return bTime - aTime;
  return b.createdAt.getTime() - a.createdAt.getTime();
};

// Fetch all celebrations (public).
export const fetchCelebrations = async (): Promise<Celebration[]> => {
  try {
    const celebrationRef = collection(db, COLLECTION_NAME);
    const querySnapshot = await getDocs(celebrationRef);
    return querySnapshot.docs.map(docToCelebration).sort(sortCelebrations);
  } catch (error) {
    console.error("Error fetching celebrations:", error);
    // Return empty array instead of throwing if collection doesn't exist yet.
    return [];
  }
};

// Create a celebration (admin only — enforced by Firestore rules).
export const createCelebration = async (
  data: Partial<Celebration>
): Promise<string> => {
  try {
    const now = new Date();
    const celebration: any = {
      memberName: data.memberName || "",
      headline: data.headline || "",
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    if (data.description) celebration.description = data.description;
    if (data.logoUrl) celebration.logoUrl = data.logoUrl;
    if (data.achievedAt) {
      celebration.achievedAt = Timestamp.fromDate(new Date(data.achievedAt));
    }

    const celebrationRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(celebrationRef, celebration);
    return docRef.id;
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
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: any = { updatedAt: Timestamp.fromDate(new Date()) };

    if (data.memberName !== undefined) updateData.memberName = data.memberName;
    if (data.headline !== undefined) updateData.headline = data.headline;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.achievedAt !== undefined) {
      updateData.achievedAt = data.achievedAt
        ? Timestamp.fromDate(new Date(data.achievedAt))
        : null;
    }

    await updateDoc(docRef, updateData);
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
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting celebration:", error);
    throw new Error("Failed to delete celebration");
  }
};
