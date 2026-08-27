import { NextResponse } from "next/server";
import { createServerClientRSC } from "../../../lib/supabase/server";

export const runtime = "nodejs";

const OPENAI_URL = "https://api.openai.com/v1";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const supabase = await createServerClientRSC();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return error("Please sign in to use AI practice tools.", 401);

  let body: { action?: unknown; word?: unknown; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return error("Invalid practice request.", 400);
  }

  const apiKey = process.env.NEXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return error("AI practice is temporarily unavailable.", 503);

  try {
    if (body.action === "definition") {
      const word = typeof body.word === "string" ? body.word.trim() : "";
      const context = typeof body.context === "string" ? body.context.trim() : "";
      if (!/^[A-Za-z][A-Za-z'’-]{0,63}$/.test(word) || !context || context.length > 800) {
        return error("Invalid definition request.", 400);
      }

      const response = await fetch(`${OPENAI_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `다음 문장에서 '${word}'의 정의를 한국어로 제공해주세요. 단어의 의미를 문장의 맥락에 맞게 설명하고 반드시 존대말로 작성해주세요.\n\n문장: "${context}"\n\n결과 형식:\n뜻풀이: [문장 문맥에 맞는 단어 정의]`,
            },
          ],
        }),
      });
      if (!response.ok) {
        console.error("[shadow] definition provider returned", response.status);
        return error("AI practice is temporarily unavailable.", 502);
      }

      const payload = await response.json();
      const definition = payload.choices?.[0]?.message?.content;
      if (typeof definition !== "string" || !definition.trim()) {
        return error("AI practice is temporarily unavailable.", 502);
      }
      return NextResponse.json({ definition: definition.trim() });
    }

    if (body.action === "transcription-token") {
      const response = await fetch(`${OPENAI_URL}/realtime/transcription_sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        console.error("[shadow] transcription provider returned", response.status);
        return error("AI practice is temporarily unavailable.", 502);
      }

      const payload = await response.json();
      const clientSecret =
        typeof payload.client_secret === "string"
          ? payload.client_secret
          : payload.client_secret?.value || payload.session?.client_secret?.value;
      if (typeof clientSecret !== "string" || !clientSecret) {
        return error("AI practice is temporarily unavailable.", 502);
      }
      return NextResponse.json({ client_secret: clientSecret });
    }

    return error("Unsupported practice request.", 400);
  } catch (caught) {
    console.error("[shadow] OpenAI request failed", caught instanceof Error ? caught.message : "unknown error");
    return error("AI practice is temporarily unavailable.", 502);
  }
}
