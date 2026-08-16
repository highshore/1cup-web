"use client";

import { useState, useEffect } from "react";
import { supabase } from "../supabase/client";
import type { User } from "@supabase/supabase-js";

export function useDisplayNamePrompt() {
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (!sessionUser) {
        setShouldShowPrompt(false);
        setLoading(false);
        return;
      }

      try {
        // Check whether the user already has a display_name set.
        // current_user_row() resolves through the auth-identity link table, so it works
        // for whichever login method this session used.
        const { data: rows } = await supabase.rpc("current_user_row");
        const userData = Array.isArray(rows) ? rows[0] : rows;

        const hasDisplayName =
          !!userData?.display_name && userData.display_name.trim() !== "";

        if (hasDisplayName) {
          setShouldShowPrompt(false);
          setLoading(false);
          return;
        }

        // Show prompt if user has no display_name.
        setShouldShowPrompt(true);
      } catch (error) {
        console.error("Error checking display name prompt status:", error);
        setShouldShowPrompt(false);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const hidePrompt = () => {
    setShouldShowPrompt(false);
  };

  return {
    shouldShowPrompt,
    hidePrompt,
    user,
    loading,
  };
}
