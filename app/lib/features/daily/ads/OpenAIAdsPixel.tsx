"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Public client-side ID only. Never expose OPENAI_ADS_CAPI_KEY in Next.js.
const PIXEL_ID = process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID?.trim();
// New matching disclosure requires an explicit fresh opt-in; prior choices do not carry over.
const CONSENT_KEY = "daily_openai_ads_consent_v2";
const CONSENT_COOKIE = "daily_ads_measure_consent";
type Choice = "accepted" | "declined" | "unknown";
type Oaiq = (...args: unknown[]) => void;

declare global {
  interface Window {
    oaiq?: Oaiq & { q?: IArguments[] };
  }
}

// The footer's 쿠키 설정 link reopens the banner below, which is where consent is withdrawn.
const OPEN_SETTINGS_EVENT = "daily:cookie-settings";
export const DAILY_COOKIE_SETTINGS_ENABLED = Boolean(PIXEL_ID);

export function openDailyCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

function setConsentCookie(enabled: boolean) {
  document.cookie = `${CONSENT_COOKIE}=${enabled ? "yes_v2" : "no"}; Max-Age=${90 * 24 * 3600}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

// Only called after the server has confirmed the relevant trial or checkout action.
// The final purchase event is sent by the backend after Payple settlement.
export function measureDailyAdEvent(
  name: "trial_started" | "checkout_started",
  data: Record<string, unknown>,
) {
  if (!PIXEL_ID || typeof window === "undefined") return;
  if (window.localStorage.getItem(CONSENT_KEY) !== "accepted") return;
  window.oaiq?.("measure", name, data);
}

function initializePixel() {
  if (!PIXEL_ID) return;
  if (!window.oaiq) {
    const queue: IArguments[] = [];
    const queued: Oaiq & { q?: IArguments[] } = function () {
      queue.push(arguments);
    };
    queued.q = queue;
    window.oaiq = queued;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
    document.head.appendChild(script);
  }
  window.oaiq?.("consent", true);
  window.oaiq?.("init", { pixelId: PIXEL_ID });
}

export default function OpenAIAdsPixel() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<Choice>("unknown");
  const [checked, setChecked] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!PIXEL_ID) return;
    const saved = window.localStorage.getItem(CONSENT_KEY);
    const next: Choice = saved === "accepted" || saved === "declined" ? saved : "unknown";
    setChoice(next);
    setChecked(true);
    const open = () => setShowSettings(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  useEffect(() => {
    if (choice !== "accepted" || !PIXEL_ID) return;
    setConsentCookie(true);
    initializePixel();
    setInitialized(true);
    // The SDK script is global to the current tab. Explicitly disable measurement
    // when navigating away from /daily so unrelated 1 Cup pages cannot be tracked.
    return () => {
      window.oaiq?.("consent", false);
    };
  }, [choice]);

  useEffect(() => {
    if (!initialized || !pathname) return;
    window.oaiq?.("measure", "page_viewed", {
      type: "contents",
      contents: [{ id: pathname, name: "Daily", content_type: "page" }],
    });
  }, [initialized, pathname]);

  if (!PIXEL_ID || !checked) return null;

  const choose = (value: "accepted" | "declined") => {
    window.localStorage.setItem(CONSENT_KEY, value);
    setConsentCookie(value === "accepted");
    setChoice(value);
    setShowSettings(false);
    if (value === "declined") {
      // Stop any SDK already loaded during this browser session.
      window.oaiq?.("consent", false);
      document.cookie = "__oppref=; Max-Age=0; Path=/; SameSite=Lax";
      document.cookie = "__obref=; Max-Age=0; Path=/; SameSite=Lax";
      setInitialized(false);
    }
  };

  if (choice !== "unknown" && !showSettings) return null;

  // Worded for measurement tools in general, not one vendor: the privacy notice names them.
  return (
    <div className="fixed inset-x-3 bottom-3 z-[9999] mx-auto max-w-[560px] rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-900 shadow-xl" role="region" aria-label="쿠키 설정">
      <p className="font-bold">쿠키 사용 안내</p>
      <p className="mt-1 leading-relaxed">
        서비스 이용 현황을 분석하고 광고 성과를 측정하기 위해 쿠키와 일부 이용정보를 사용해도 될까요?
        동의하지 않아도 서비스 이용에 제한이 없어요.{" "}
        <Link href="/daily/privacy" className="underline">개인정보 안내</Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => choose("accepted")} className="rounded-lg bg-black px-4 py-2 font-semibold text-white">허용</button>
        <button type="button" onClick={() => choose("declined")} className="rounded-lg border border-stone-300 px-4 py-2 font-semibold">거부</button>
      </div>
    </div>
  );
}
