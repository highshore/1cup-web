"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase/client";

// True while this session's profile was created without matching an existing member —
// handle_new_user could not tell whether they are new or returning, and only they can.
export function useIdentityLinkPrompt() {
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async (signedIn: boolean) => {
    if (!signedIn) {
      setShouldShowPrompt(false);
      setLoading(false);
      return;
    }
    try {
      // Resolves through the auth-identity link table, so it answers for whichever
      // login method this session used.
      const { data: rows } = await supabase.rpc("current_user_row");
      const row = Array.isArray(rows) ? rows[0] : rows;
      setShouldShowPrompt(Boolean(row?.identity_unmatched));
    } catch (error) {
      // Never block someone from using the app because we could not read a hint.
      console.error("Error checking identity link prompt:", error);
      setShouldShowPrompt(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => check(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      check(Boolean(session))
    );
    return () => sub.subscription.unsubscribe();
  }, [check]);

  const hidePrompt = useCallback(() => setShouldShowPrompt(false), []);

  return { shouldShowPrompt, hidePrompt, loading };
}
