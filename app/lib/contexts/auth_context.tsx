"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { supabase } from "../supabase/client";

// Firebase-User-compatible shape so existing components (currentUser.uid /
// .displayName / .email / .phoneNumber / .photoURL) keep working unchanged.
export interface AppUser {
  uid: string;
  authId: string;
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
  const hydratedAuthIdRef = useRef<string | null>(null);
  // Set only while logout() is running, so a sign-out the member asked for is not
  // reported as one that happened to them.
  const deliberateSignOutRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function hydrate(
      authUser: {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      } | null,
    ) {
      if (!authUser) {
        if (!active) return;
        hydratedAuthIdRef.current = null;
        setCurrentUser(null);
        setHasActiveSubscription(null);
        setAccountStatus(null);
        setIsGdgMember(null);
        setIsLoading(false);
        return;
      }

      // Resolve the application profile through the auth-identity link. This RPC is
      // protected by the session's RLS identity, so client UI hydration does not need
      // a second network getUser() validation first.
      const { data: rows, error } = await supabase.rpc("current_user_row");
      if (!active) return;

      if (error) {
        console.error("Failed to hydrate current user profile:", error.message);
      }

      const row = Array.isArray(rows) ? rows[0] : rows;
      hydratedAuthIdRef.current = authUser.id;
      const meta = authUser.user_metadata ?? {};

      setCurrentUser({
        uid: row?.uid ?? authUser.id,
        authId: authUser.id,
        email: row?.email ?? authUser.email ?? null,
        displayName:
          row?.display_name ??
          (meta.name as string) ??
          (meta.full_name as string) ??
          null,
        phoneNumber: row?.phone ?? null,
        photoURL:
          (row?.photo_url ??
            (meta.avatar_url as string) ??
            (meta.picture as string) ??
            "")
            .replace(/^http:\/\//, "https://") || null,
      });
      setHasActiveSubscription(row?.has_active_subscription ?? false);
      setAccountStatus(row?.account_status ?? "user");
      setIsGdgMember(row?.gdg_member === true);
      setIsLoading(false);
    }

    // Best-effort and never awaited by anything the member is waiting on.
    function reportSessionEvent(event: string, reason?: string) {
      try {
        void fetch("/api/auth/session-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, reason }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // ignore
      }
    }

    async function start() {
      // On the browser, getSession() reads the session already maintained by the
      // Supabase client. Server-side authorization is validated separately with
      // getClaims(); doing getUser() here as well caused an extra Auth-server request
      // on every mount and amplified simultaneous desktop/mobile login traffic.
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return hydrate(null);
      return hydrate(data.session.user);
    }

    void start();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // The only place that can tell the two apart. Without this, auth.sessions shows
        // a session that stopped refreshing and nothing about why.
        if (!deliberateSignOutRef.current) {
          reportSessionEvent("signed_out_unexpectedly", "onAuthStateChange");
        }
        deliberateSignOutRef.current = false;
        // Defer Supabase work until the auth callback has returned. This keeps the
        // onAuthStateChange handler synchronous and avoids competing with the auth
        // client's internal session lock on slower mobile browsers.
        window.setTimeout(() => void hydrate(null), 0);
        return;
      }

      if (event === "SIGNED_IN" && session?.user.id !== hydratedAuthIdRef.current) {
        window.setTimeout(() => void hydrate(session?.user ?? null), 0);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    deliberateSignOutRef.current = true;
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        hasActiveSubscription,
        accountStatus,
        isGdgMember,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
