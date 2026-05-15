import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CopilotRequest = {
  transcriptText?: string;
  recentText?: string;
  participants?: string[];
  articleTitle?: string;
};

const fallbackPayload = {
  summary: "Waiting for enough conversation context.",
  feedback: [],
  followUpQuestions: [],
  facilitationNotes: [],
};

export async function POST(request: Request) {
  const apiKey = process.env.NEXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AI copilot is not configured." },
      { status: 500 }
    );
  }

  let body: CopilotRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(fallbackPayload);
  }

  const transcriptText = (body.transcriptText || "").trim();
  const recentText = (body.recentText || transcriptText).trim();

  if (transcriptText.length < 120 && recentText.length < 120) {
    return NextResponse.json(fallbackPayload);
  }

  const model = process.env.OPENAI_COPILOT_MODEL || "gpt-4o-mini";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a live English meetup copilot. Give concise, constructive coaching for a facilitator and participants while a conversation is happening. Focus on inclusion, sharper follow-up questions, missed ideas, and language feedback. Return only valid JSON.",
          },
          {
            role: "user",
            content: JSON.stringify({
              output_schema: {
                summary: "one short sentence",
                feedback: ["2-4 short coaching bullets"],
                followUpQuestions: ["3 natural follow-up questions"],
                facilitationNotes: ["1-3 notes for balancing participation"],
              },
              articleTitle: body.articleTitle || null,
              participants: body.participants || [],
              recentText,
              transcriptText: transcriptText.slice(-6000),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[Copilot] OpenAI error status:", response.status);
      return NextResponse.json(
        { error: "AI copilot could not generate feedback." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(fallbackPayload);
    }

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    console.error("[Copilot] generation error:", error);
    return NextResponse.json(
      { error: "AI copilot could not generate feedback." },
      { status: 500 }
    );
  }
}
