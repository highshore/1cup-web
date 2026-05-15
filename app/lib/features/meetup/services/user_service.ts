// User profile interface
export interface UserProfile {
  uid: string;
  displayName?: string;
  photoURL?: string;
  email?: string; // Keep email if you might need it, but it's often not public
  account_status?: string; // Add account_status field
  hasActiveSubscription?: boolean; // Add subscription status field
  gdg_member?: boolean; // GDG membership flag
}

// Cache for user profiles to avoid repeated fetches
const userCache = new Map<string, UserProfile>();

// Fetch a single public-safe user profile by UID.
export const fetchUserProfile = async (
  uid: string
): Promise<UserProfile | null> => {
  // Check cache first
  if (userCache.has(uid)) {
    return userCache.get(uid) || null;
  }

  try {
    const response = await fetch(`/api/public-profile/${encodeURIComponent(uid)}`, {
      cache: "no-store",
    });

    if (response.ok) {
      const userData = await response.json();
      const profile: UserProfile = {
        uid,
        displayName: userData.displayName || `User ${uid.substring(0, 6)}`,
        photoURL: userData.photoURL || undefined,
        account_status: userData.badges?.role || undefined,
        hasActiveSubscription: userData.badges?.activeMember === true,
        gdg_member: userData.badges?.gdgMember === true,
      };
      userCache.set(uid, profile);
      return profile;
    }

    throw new Error(`Public profile fetch failed: ${response.status}`);
  } catch (error) {
    console.error(
      `Error fetching public profile for ${uid}:`,
      error
    );
    // Return minimal profile on error
    const errorProfile: UserProfile = {
      uid,
      displayName: `User ${uid.substring(0, 6)}`,
      photoURL: undefined,
      account_status: undefined,
      hasActiveSubscription: false,
    };
    userCache.set(uid, errorProfile);
    return errorProfile;
  }
};

// Fetch multiple user profiles by UIDs from Firestore
export const fetchUserProfiles = async (
  uids: string[]
): Promise<UserProfile[]> => {
  const uniqueUids = Array.from(new Set(uids));
  const profiles: UserProfile[] = [];

  // Fetch each profile individually (leverages caching from fetchUserProfile)
  for (const uid of uniqueUids) {
    const profile = await fetchUserProfile(uid);
    if (profile) {
      profiles.push(profile);
    }
  }

  return profiles;
};

// Clear user cache (useful for debugging or forced refresh)
export const clearUserCache = (): void => {
  userCache.clear();
  console.log("User profile cache cleared.");
};

// Check if a user has admin status
export const isUserAdmin = async (uid: string): Promise<boolean> => {
  try {
    const profile = await fetchUserProfile(uid);
    return profile?.account_status === "admin";
  } catch (error) {
    console.error(`Error checking admin status for ${uid}:`, error);
    return false;
  }
};

// Check if a user has an active subscription
export const hasActiveSubscription = async (uid: string): Promise<boolean> => {
  try {
    const profile = await fetchUserProfile(uid);
    return profile?.hasActiveSubscription === true;
  } catch (error) {
    console.error(`Error checking subscription status for ${uid}:`, error);
    return false;
  }
};

// Get cached user profile (synchronous)
export const getCachedUserProfile = (uid: string): UserProfile | null => {
  return userCache.get(uid) || null;
};
