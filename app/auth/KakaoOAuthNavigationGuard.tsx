"use client";

import { useEffect } from "react";

import { supabase } from "../lib/supabase/client";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

// iOS browsers can occasionally leave Supabase's automatic OAuth navigation in the
// current tab after the promise resolves. Capture the Kakao CTA and make the final
// navigation explicit while still letting Supabase generate/store the PKCE verifier.
// Keeping this in the auth segment also makes the workaround easy to remove once the
// upstream browser behavior is no longer relevant.
export default function KakaoOAuthNavigationGuard() {
  useEffect(() => {
    const handleKakaoClick = async (event: MouseEvent) => {
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
      try {
        if (redirectUrl) {
          try {
            window.localStorage.setItem("returnUrl", redirectUrl);
          } catch {
            // OAuth can still complete when storage is restricted; the callback query
            // carries the same return path independently.
          }
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "kakao",
          options: {
            redirectTo: `${window.location.origin}/auth/callback${
              redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""
            }`,
            scopes: "profile_nickname profile_image account_email phone_number",
            skipBrowserRedirect: true,
          },
        });

        if (error) throw error;
        if (!data.url) throw new Error("카카오 로그인 주소를 만들지 못했습니다.");

        window.location.assign(data.url);
      } catch (error) {
        button.dataset.oauthBusy = "false";
        button.removeAttribute("aria-busy");
        const message =
          error instanceof Error ? error.message : "카카오 로그인을 시작하지 못했습니다.";
        const retryUrl = new URL("/auth", window.location.origin);
        if (redirectUrl) retryUrl.searchParams.set("redirect", redirectUrl);
        retryUrl.searchParams.set("error", message);
        window.location.assign(retryUrl.toString());
      }
    };

    document.addEventListener("click", handleKakaoClick, true);
    return () => document.removeEventListener("click", handleKakaoClick, true);
  }, []);

  return null;
}
