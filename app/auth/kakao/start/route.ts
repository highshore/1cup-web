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

  const response = NextResponse.redirect(data.url, 302);
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
