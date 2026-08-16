"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "../supabase/client";

// Firebase-User-compatible shape so existing components (currentUser.uid /
// .displayName / .email / .phoneNumber / .photoURL) keep working unchanged.
export interface AppUser {
  uid: string;            // public.users.uid (Firebase uid for migrated users, auth uuid for new)
  authId: string;         // auth.users.id
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
}

interface AuthContextProps {
  currentUser: AppUser | null;
  isLoading: boolean;
  hasActiveSubscription: boolean | null;
  accountStatus: string | null;
  isGdgMember: boolean | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  currentUser: null,
  isLoading: true,
  hasActiveSubscription: null,
  accountStatus: null,
  isGdgMember: null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isGdgMember, setIsGdgMember] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function hydrate(authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) {
      if (!authUser) {
        if (!active) return;
        setCurrentUser(null);
        setHasActiveSubscription(null);
        setAccountStatus(null);
        setIsGdgMember(null);
        setIsLoading(false);
        return;
      }
      // Resolve the public.users row for this session. Goes through
      // current_user_row() rather than `.eq("auth_id", …)`: one person can have several
      // auth users (phone OTP and Kakao each create their own), and only the link table
      // maps every one of them back to the same profile.
      const { data: rows } = await supabase.rpc("current_user_row");
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!active) return;

      const meta = authUser.user_metadata ?? {};
      setCurrentUser({
        uid: row?.uid ?? authUser.id,
        authId: authUser.id,
        email: row?.email ?? authUser.email ?? null,
        displayName: row?.display_name ?? (meta.name as string) ?? (meta.full_name as string) ?? null,
        phoneNumber: row?.phone ?? null,
        photoURL:
          (row?.photo_url ?? (meta.avatar_url as string) ?? (meta.picture as string) ?? "")
            .replace(/^http:\/\//, "https://") || null,
      });
      setHasActiveSubscription(row?.has_active_subscription ?? false);
      setAccountStatus(row?.account_status ?? "user");
      setIsGdgMember(row?.gdg_member === true);
      setIsLoading(false);
    }

    // A stored session can outlive its auth user (deleted or banned server-side). The
    // cached JWT still looks valid to getSession(), so the app would sit there signed in
    // with no profile, and signOut() would fail because the server rejects the token.
    // Validate against the server once at startup and drop the local session if it is
    // no longer real.
    async function start() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return hydrate(null);

      const { data: verified, error } = await supabase.auth.getUser();
      if (error || !verified?.user) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        return hydrate(null);
      }
      return hydrate(verified.user);
    }

    start();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      hydrate(session?.user ?? null);
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Signing out server-side fails when the token's user no longer exists, which used to
  // leave the person stuck in a session they could not clear. Always fall back to
  // dropping the local session.
  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{ currentUser, isLoading, hasActiveSubscription, accountStatus, isGdgMember, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
