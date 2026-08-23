"use client";

import { useEffect } from "react";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

// Keep the browser away from the project's *.supabase.co Auth hostname. That host
// is currently failing certificate validation on affected clients. The same-origin
// start route handles state and redirects straight to Kakao instead.
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

      window.location.assign(startUrl.toString());
    };

    document.addEventListener("click", handleKakaoClick, true);
    return () => document.removeEventListener("click", handleKakaoClick, true);
  }, []);

  return null;
}
