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

  // iOS Safari/Chrome was reaching this route and receiving the external 302,
  // but never issuing the subsequent request to Supabase /authorize. Commit the
  // same-origin response (and PKCE verifier cookie) first, then perform a normal
  // browser navigation. Meta refresh and the link are fallbacks if JS is restricted.
  const providerUrl = data.url;
  const safeProviderHref = escapeHtml(providerUrl);
  const providerUrlForScript = JSON.stringify(providerUrl).replaceAll("<", "\\u003c");
  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="1;url=${safeProviderHref}" />
    <title>카카오 로그인으로 이동 중</title>
  </head>
  <body style="font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fff;color:#111">
    <main style="text-align:center;padding:24px">
      <p>카카오 로그인으로 이동 중입니다…</p>
      <p><a href="${safeProviderHref}">계속하기</a></p>
    </main>
    <script>window.location.replace(${providerUrlForScript});</script>
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
