import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/naver-local?query=...&display=5&start=1&sort=random
// Server-side proxy to the Naver Local Search API (keeps the search credentials off the
// client). Replaces the old Firebase Cloud Run function `searchnaverlocal`.
// Requires env: NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET (from the old function's config).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  const id = process.env.NAVER_SEARCH_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!id || !secret) {
    return NextResponse.json({ error: "Naver search is not configured" }, { status: 500 });
  }

  const display = searchParams.get("display") ?? "5";
  const start = searchParams.get("start") ?? "1";
  const sort = searchParams.get("sort") ?? "random";
  const url =
    `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}` +
    `&display=${display}&start=${start}&sort=${sort}`;

  try {
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("naver-local:", err);
    return NextResponse.json({ error: "search failed" }, { status: 502 });
  }
}
