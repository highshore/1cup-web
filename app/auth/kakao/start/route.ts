import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/auth") || value.startsWith("/kakao_callback")) return "/";
  return value;
}

type PendingCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const redirectUrl = safeRedirect(request.nextUrl.searchParams.get("redirect"));
  const callbackUrl = new URL("/auth/callback", origin);
  if (redirectUrl) callbackUrl.searchParams.set("redirect", redirectUrl);

  const pendingCookies: PendingCookie[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list) {
          pendingCookies.push(...list);
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: "profile_nickname profile_image account_email phone_number",
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("Kakao OAuth start failed:", error?.message ?? "missing provider URL");
    const retry = new URL("/auth", origin);
    retry.searchParams.set("error", "카카오 로그인을 시작하지 못했습니다. 다시 시도해주세요.");
    return NextResponse.redirect(retry, 302);
  }

  // Some iOS browsers refuse to follow the cross-origin OAuth hop when it is
  // triggered by a server redirect, meta refresh, or script after the original
  // click. Render an explicit external link so the Supabase -> Kakao navigation
  // happens from a fresh user gesture, after the PKCE verifier cookie is committed.
  const providerHref = escapeHtml(data.url);
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>카카오 로그인</title>
  </head>
  <body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:grid;place-items:center;min-height:100dvh;margin:0;background:#fff;color:#111;padding:24px;box-sizing:border-box">
    <main style="width:min(100%,420px);text-align:center">
      <div style="font-size:42px;margin-bottom:14px">💬</div>
      <h1 style="font-size:24px;margin:0 0 10px">카카오 로그인을 계속해주세요</h1>
      <p style="font-size:15px;line-height:1.6;color:#666;margin:0 0 28px">iPhone에서는 외부 로그인 화면을 열기 위해 한 번 더 눌러야 할 수 있습니다.</p>
      <a href="${providerHref}" style="display:flex;align-items:center;justify-content:center;width:100%;min-height:58px;box-sizing:border-box;border-radius:16px;background:#FEE500;color:#191919;text-decoration:none;font-size:17px;font-weight:700">카카오 로그인 열기</a>
      <p style="font-size:13px;line-height:1.5;color:#888;margin:18px 0 0">버튼을 누르면 카카오 로그인 화면으로 이동합니다.</p>
    </main>
  </body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  return response;
}
