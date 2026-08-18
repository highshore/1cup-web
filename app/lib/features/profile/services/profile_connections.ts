import { supabase } from "../../../supabase/client";

export interface ProfileConnection {
  likedByMe: boolean;
  likesMe: boolean;
  isMutual: boolean;
}
export interface MutualProfileFriend {
  uid: string;
  displayName: string;
  photoURL: string | null;
  connectedAt: string;
}

const emptyConnection: ProfileConnection = {
  likedByMe: false,
  likesMe: false,
  isMutual: false,
};

function toConnection(value: unknown): ProfileConnection {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return emptyConnection;
  const data = row as Record<string, unknown>;
  const likedByMe = data.liked_by_me === true;
  const likesMe = data.likes_me === true;
  return {
    likedByMe,
    likesMe,
    isMutual: data.mutual === true || (likedByMe && likesMe),
  };
}

export async function toggleProfileLike(profileUserId: string): Promise<ProfileConnection> {
  const { data, error } = await supabase.rpc("toggle_profile_like", {
    p_profile_user_id: profileUserId,
  });
  if (error) throw error;
  return toConnection(data);
}

export async function fetchMutualProfileFriends(): Promise<MutualProfileFriend[]> {
  const { data, error } = await supabase.rpc("mutual_profile_friends");
  if (error) throw error;

  return (Array.isArray(data) ? data : []).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const uid = typeof item.uid === "string" ? item.uid : "";
    if (!uid) return [];
    return [{
      uid,
      displayName:
        typeof item.display_name === "string" && item.display_name.trim()
          ? item.display_name
          : `Member ${uid.slice(0, 6)}`,
      photoURL: typeof item.photo_url === "string" ? item.photo_url.replace(/^http:\/\//, "https://") : null,
      connectedAt: typeof item.connected_at === "string" ? item.connected_at : "",
    }];
  });
}
