import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "missing_supabase_config" }, { status: 500 });
  }

  const authorizeUrl = new URL("/auth/v1/authorize", supabaseUrl);
  authorizeUrl.searchParams.set("provider", "kakao");
  authorizeUrl.searchParams.set("redirect_to", "https://1cupenglish.com/auth/callback");
  authorizeUrl.searchParams.set("scopes", "openid profile_nickname profile_image account_email phone_number");

  try {
    const response = await fetch(authorizeUrl, {
      method: "GET",
      headers: { apikey: anonKey },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const location = response.headers.get("location");
    if (!location) {
      return NextResponse.json(
        { error: "provider_redirect_missing", upstreamStatus: response.status },
        { status: 502 },
      );
    }

    const providerUrl = new URL(location);
    return NextResponse.json({
      providerHost: providerUrl.hostname,
      clientId: providerUrl.searchParams.get("client_id"),
      redirectUri: providerUrl.searchParams.get("redirect_uri"),
    });
  } catch (error) {
    console.error("Kakao provider config diagnostic failed", error);
    return NextResponse.json({ error: "provider_probe_failed" }, { status: 502 });
  }
}
