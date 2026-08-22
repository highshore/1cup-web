"use client";

import { useState, useEffect } from "react";
import { supabase } from "../supabase/client";
import type { User } from "@supabase/supabase-js";

export function useDisplayNamePrompt() {
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authGeneration = 0;

    async function refreshDisplayNamePrompt(generation: number) {
      try {
        // Run Supabase work after the auth-state callback has returned. Calling another
        // Supabase method from inside onAuthStateChange can contend with the auth
        // client's session lock, which is especially visible on slower mobile browsers.
        const { data: rows, error } = await supabase.rpc("current_user_row");
        if (!active || generation !== authGeneration) return;

        if (error) {
          console.error("Error checking display name prompt status:", error.message);
          setShouldShowPrompt(false);
          return;
        }

        const userData = Array.isArray(rows) ? rows[0] : rows;
        const hasDisplayName =
          !!userData?.display_name && userData.display_name.trim() !== "";

        setShouldShowPrompt(!hasDisplayName);
      } catch (error) {
        if (!active || generation !== authGeneration) return;
        console.error("Error checking display name prompt status:", error);
        setShouldShowPrompt(false);
      } finally {
        if (active && generation === authGeneration) {
          setLoading(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const generation = ++authGeneration;
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (!sessionUser) {
        setShouldShowPrompt(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      // Keep the auth callback synchronous so sign-in/session refresh can release the
      // internal Supabase lock before the profile RPC starts.
      window.setTimeout(() => void refreshDisplayNamePrompt(generation), 0);
    });

    return () => {
      active = false;
      authGeneration += 1;
      subscription.unsubscribe();
    };
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
