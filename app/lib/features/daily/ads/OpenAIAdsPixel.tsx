"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Public client-side ID only. Never expose OPENAI_ADS_CAPI_KEY in Next.js.
const PIXEL_ID = process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID?.trim();
const CONSENT_KEY = "daily_openai_ads_consent";
const CONSENT_COOKIE = "daily_ads_measure_consent";
type Choice = "accepted" | "declined" | "unknown";
type Oaiq = (...args: unknown[]) => void;

declare global {
  interface Window {
    oaiq?: Oaiq & { q?: IArguments[] };
  }
}

function setConsentCookie(enabled: boolean) {
  document.cookie = `${CONSENT_COOKIE}=${enabled ? "yes" : "no"}; Max-Age=${90 * 24 * 3600}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
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

  return (
    <>
      {(choice === "unknown" || showSettings) && (
        <div className="fixed inset-x-3 bottom-3 z-[9999] mx-auto max-w-[560px] rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-900 shadow-xl" role="region" aria-label="광고 성과 측정 동의">
          <p className="font-bold">선택적 광고 성과 측정</p>
          <p className="mt-1 leading-relaxed">
            광고 유입과 유료 결제 성과를 확인하기 위해 OpenAI 측정 도구를 사용해도 될까요?
            거부해도 서비스 이용과 결제에는 영향이 없습니다.{" "}
            <Link href="/daily/privacy" className="underline">개인정보 안내</Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => choose("accepted")} className="rounded-lg bg-black px-4 py-2 font-semibold text-white">허용</button>
            <button type="button" onClick={() => choose("declined")} className="rounded-lg border border-stone-300 px-4 py-2 font-semibold">거부</button>
          </div>
        </div>
      )}
      {choice !== "unknown" && !showSettings && (
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="fixed bottom-2 left-2 z-[9998] rounded-md bg-white/90 px-2 py-1 text-[10px] text-stone-500 shadow-sm"
        >
          광고 측정 설정
        </button>
      )}
    </>
  );
}
