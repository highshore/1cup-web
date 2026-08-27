"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/auth_context";
import { supabase } from "../supabase/client";

export function useOnboarding() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkOnboarding() {
      if (authLoading) return;

      if (!currentUser) {
        if (!active) return;
        setShouldShow(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase.rpc("current_user_row");
      if (!active) return;

      if (error) {
        console.error("Unable to check member onboarding:", error.message);
        // Never block a member from the app when this optional presentation layer
        // cannot read its status.
        setShouldShow(false);
      } else {
        const profile = Array.isArray(data) ? data[0] : data;
        setShouldShow(!profile?.onboarding_completed_at);
      }
      setIsLoading(false);
    }

    void checkOnboarding();
    return () => {
      active = false;
    };
  }, [authLoading, currentUser]);

  return {
    isLoading,
    shouldShow,
    completeOnboarding: () => setShouldShow(false),
  };
}
