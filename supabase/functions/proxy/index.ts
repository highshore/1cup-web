// Proxies — ports searchNaverLocal + fetchYouTubeTranscriptProxy (functions/src/index.ts).
// Route by JSON body / query `target`: "naver" (GET-style search) | "youtube" (transcript).
import { preflight, json } from "../_shared/cors.ts";
import { env } from "../_shared/db.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const target = body.target ?? url.searchParams.get("target");

  try {
    // ---- Naver Local Search ------------------------------------------------
    if (target === "naver") {
      const query = body.query ?? url.searchParams.get("query");
      if (!query) return json(req, { error: "query required" }, 400);
      const display = body.display ?? url.searchParams.get("display") ?? "5";
      const start = body.start ?? url.searchParams.get("start") ?? "1";
      const sort = body.sort ?? url.searchParams.get("sort") ?? "random";
      const api = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&start=${start}&sort=${sort}`;
      const res = await fetch(api, {
        headers: {
          "X-Naver-Client-Id": env("NAVER_CLIENT_ID"),
          "X-Naver-Client-Secret": env("NAVER_CLIENT_SECRET"),
        },
      });
      const data = await res.json();
      return json(req, data, res.status);
    }

    // ---- YouTube transcript ------------------------------------------------
    if (target === "youtube") {
      const videoId = body.videoId ?? url.searchParams.get("videoId");
      if (!videoId) return json(req, { error: "videoId required" }, 400);
      // youtube-transcript as an npm import under Deno
      const { YoutubeTranscript } = await import("npm:youtube-transcript");
      const t = await YoutubeTranscript.fetchTranscript(videoId);
      if (!t?.length) return json(req, { error: "no transcript" }, 404);
      const text = t.map((i: { text: string }) => i.text).join(" \n");
      return new Response(text, {
        status: 200,
        headers: { ...json(req, "").headers, "Content-Type": "text/plain" },
      });
    }

    return json(req, { error: "unknown target (naver|youtube)" }, 400);
  } catch (e) {
    return json(req, { error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
