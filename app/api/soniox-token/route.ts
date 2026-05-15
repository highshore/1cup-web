import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.SONIOX_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Soniox API key is not configured." },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      "https://api.soniox.com/v1/auth/temporary-api-key",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usage_type: "transcribe_websocket",
          expires_in_seconds: 60,
          single_use: true,
          max_session_duration_seconds: 60 * 60 * 5,
          client_reference_id: "one-cup-eng-transcript",
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to create Soniox temporary key." },
        { status: response.status }
      );
    }

    const data = await response.json();
    const temporaryKey = data.api_key || data.key || data.temporary_api_key;

    if (!temporaryKey) {
      return NextResponse.json(
        { error: "Soniox temporary key response was invalid." },
        { status: 502 }
      );
    }

    return NextResponse.json({ apiKey: temporaryKey });
  } catch (error) {
    console.error("[Soniox] temporary key error:", error);
    return NextResponse.json(
      { error: "Unable to create Soniox temporary key." },
      { status: 500 }
    );
  }
}
