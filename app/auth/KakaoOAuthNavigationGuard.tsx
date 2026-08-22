"use client";

import { useEffect } from "react";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

// Keep the Kakao CTA independent from the browser-side Supabase auth client.
// On iOS Safari/Chrome the client auth lock can stall before Supabase ever starts
// the provider redirect. Send the browser to a same-origin route synchronously;
// that route creates the PKCE verifier cookie server-side and redirects to Kakao.
export default function KakaoOAuthNavigationGuard() {
  useEffect(() => {
    const handleKakaoClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      const kakaoImage = button?.querySelector<HTMLImageElement>(
        'img[src="/images/kakao_btn.png"]',
      );
      if (!button || !kakaoImage || button.dataset.oauthBusy === "true") return;

      event.preventDefault();
      event.stopPropagation();
      button.dataset.oauthBusy = "true";
      button.setAttribute("aria-busy", "true");

      const current = new URL(window.location.href);
      const redirectUrl = safeRedirect(current.searchParams.get("redirect"));
      const startUrl = new URL("/auth/kakao/start", window.location.origin);
      if (redirectUrl) startUrl.searchParams.set("redirect", redirectUrl);

      // Native same-origin navigation is deliberately synchronous: no Supabase JS,
      // promises, Web Locks, or storage access are allowed to block this click.
      window.location.assign(startUrl.toString());
    };

    document.addEventListener("click", handleKakaoClick, true);
    return () => document.removeEventListener("click", handleKakaoClick, true);
  }, []);

  return null;
}
