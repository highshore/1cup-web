"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "../../lib/supabase/client";
import type { DiscountCodeRow, RedemptionRow, ReferralCodeRow } from "./shared";

export type Notice = { text: string; error: boolean };
// The load failure is stored as a marker and turned into localized text when rendered.
export type NoticeState = Notice | "loadFailed";

// Managed discount codes, their redemptions, and legacy referral codes, plus the page's
// status banner. `enabled` waits for the browser session; admin access itself is checked
// on the server by app/admin/layout.tsx.
export function useDiscountCodesData(enabled: boolean) {
  const [codes, setCodes] = useState<DiscountCodeRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralCodeRow[]>([]);
  const [memberGeneratedReferralCodes, setMemberGeneratedReferralCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  // Every mutation reloads the lists, so loads can overlap (refresh pressed twice, a
  // toggle right after a save). Only the most recently started load may write state;
  // an older one that resolves late would otherwise put stale rows back on screen.
  const latestLoadRef = useRef(0);

  const reload = useCallback(async () => {
    const loadId = ++latestLoadRef.current;
    const isStale = () => loadId !== latestLoadRef.current;
    setLoading(true);
    setNotice(null);
    try {
      const [codeResult, redemptionResult, referralResult, memberCodeResult] = await Promise.all([
        supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
        supabase.from("discount_code_redemptions").select("discount_code,status"),
        supabase
          .from("referral_codes")
          .select("code,active,discount,type,referrer,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("users").select("referral_code").not("referral_code", "is", null),
      ]);
      if (isStale()) return;

      const firstError =
        codeResult.error || redemptionResult.error || referralResult.error || memberCodeResult.error;
      if (firstError) {
        console.error("discount code admin load failed", firstError);
        setNotice("loadFailed");
      }

      setCodes((codeResult.data ?? []) as DiscountCodeRow[]);
      setRedemptions((redemptionResult.data ?? []) as RedemptionRow[]);
      setReferrals((referralResult.data ?? []) as ReferralCodeRow[]);
      setMemberGeneratedReferralCodes(
        (memberCodeResult.data ?? [])
          .map((row) => String(row.referral_code || "").trim())
          .filter(Boolean),
      );
    } catch (error) {
      if (isStale()) return;
      console.error("discount code admin load failed", error);
      setNotice("loadFailed");
    } finally {
      // A superseded load leaves the spinner to the load that replaced it.
      if (!isStale()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    // Leaving the page (or the session changing) retires the in-flight load.
    return () => {
      latestLoadRef.current += 1;
    };
  }, [enabled, reload]);

  return {
    codes,
    redemptions,
    referrals,
    memberGeneratedReferralCodes,
    loading,
    notice,
    setNotice,
    reload,
  };
}
