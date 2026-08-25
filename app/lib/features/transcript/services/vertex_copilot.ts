import { GoogleAuth } from "google-auth-library";
import { fetchWithRetry } from "../../../utils/retry";

export type TranscriptCopilotRequest = {
  transcriptText?: string;
  recentText?: string;
  participants?: string[];
  articleTitle?: string;
  turn?: {
    speaker?: string;
    text?: string;
    startTime?: number;
    endTime?: number;
    wordCount?: number;
  };
  recentTurns?: Array<{
    speaker?: string;
    text?: string;
    startTime?: number;
    endTime?: number;
    wordCount?: number;
  }>;
};

export type TranscriptCopilotResponse = {
  summary: string;
  action: {
    type: "speech_correction" | "feedback" | "follow_up_question" | "none";
    label: string;
    message: string;
    targetSpeaker: string;
    replacement: string;
  };
  feedback: string[];
  followUpQuestions: string[];
  facilitationNotes: string[];
};

const actionTypes = new Set<TranscriptCopilotResponse["action"]["type"]>([
  "speech_correction",
  "feedback",
  "follow_up_question",
  "none",
]);

const fallbackPayload: TranscriptCopilotResponse = {
  summary: "Waiting for enough conversation context.",
  action: {
    type: "none",
    label: "No intervention",
    message: "",
    targetSpeaker: "",
    replacement: "",
  },
  feedback: [],
  followUpQuestions: [],
  facilitationNotes: [],
};

const vertexResponseSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    action: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          enum: ["speech_correction", "feedback", "follow_up_question", "none"],
        },
        label: { type: "STRING" },
        message: { type: "STRING" },
        targetSpeaker: { type: "STRING" },
        replacement: { type: "STRING" },
      },
      required: ["type", "label", "message", "targetSpeaker", "replacement"],
    },
    feedback: { type: "ARRAY", items: { type: "STRING" } },
    followUpQuestions: { type: "ARRAY", items: { type: "STRING" } },
    facilitationNotes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "action", "feedback", "followUpQuestions", "facilitationNotes"],
};

const vertexProject =
  process.env.VERTEX_AI_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID;
const vertexLocation = process.env.VERTEX_AI_LOCATION || "global";
const vertexModel = process.env.VERTEX_AI_COPILOT_MODEL || "gemini-2.5-flash";

const serviceAccountEmail = process.env.VERTEX_AI_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
const serviceAccountKey = process.env.VERTEX_AI_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;

const normalizePrivateKey = (value: string) =>
  value
    .trim()
    .replace(/^(?:"|')|(?:"|')$/g, "")
    .replace(/\\n/g, "\n");

const vertexAuth =
  serviceAccountEmail && serviceAccountKey
    ? new GoogleAuth({
        projectId: vertexProject,
        credentials: {
          client_email: serviceAccountEmail,
          private_key: normalizePrivateKey(serviceAccountKey),
        },
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      })
    : null;

const cleanTurns = (turns: TranscriptCopilotRequest["recentTurns"]) =>
  (turns || [])
    .map((turn) => ({
      speaker: (turn.speaker || "Unknown speaker").slice(0, 80),
      text: (turn.text || "").trim().slice(0, 1000),
      startTime: typeof turn.startTime === "number" ? turn.startTime : null,
      endTime: typeof turn.endTime === "number" ? turn.endTime : null,
    }))
    .filter((turn) => turn.text)
    .slice(-8);

const cleanStringList = (values: unknown): string[] =>
  Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 400))
    : [];

const parseResponse = (content: string): TranscriptCopilotResponse => {
  const parsed = JSON.parse(
    content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()
  ) as Partial<TranscriptCopilotResponse>;
  const action = parsed.action;

  if (
    typeof parsed.summary !== "string" ||
    !action ||
    !actionTypes.has(action.type as TranscriptCopilotResponse["action"]["type"])
  ) {
    throw new Error("Vertex AI returned an invalid copilot response.");
  }

  return {
    // The copilot is an in-conversation coach, not a live meeting summarizer.
    // Keep this field empty for compatibility with existing clients.
    summary: "",
    action: {
      type: action.type as TranscriptCopilotResponse["action"]["type"],
      label: typeof action.label === "string" ? action.label.slice(0, 80) : "No intervention",
      message: typeof action.message === "string" ? action.message.slice(0, 500) : "",
      targetSpeaker: typeof action.targetSpeaker === "string" ? action.targetSpeaker.slice(0, 80) : "",
      replacement: typeof action.replacement === "string" ? action.replacement.slice(0, 500) : "",
    },
    feedback: action.type === "none" ? [] : cleanStringList(parsed.feedback).slice(0, 1),
    followUpQuestions:
      action.type === "none" ? [] : cleanStringList(parsed.followUpQuestions).slice(0, 1),
    facilitationNotes:
      action.type === "none" ? [] : cleanStringList(parsed.facilitationNotes).slice(0, 1),
  };
};

export const transcriptCopilotFallback = fallbackPayload;

export const generateTranscriptCopilot = async (
  body: TranscriptCopilotRequest
): Promise<TranscriptCopilotResponse> => {
  const transcriptText = (body.transcriptText || "").trim();
  const recentText = (body.recentText || transcriptText).trim();

  if (transcriptText.length < 80 && recentText.length < 80) {
    return fallbackPayload;
  }

  if (!vertexProject || !vertexAuth) {
    throw new Error("Vertex AI credentials are not configured.");
  }

  const completedTurn = body.turn?.text
    ? {
        speaker: (body.turn.speaker || "Unknown speaker").slice(0, 80),
        text: body.turn.text.trim().slice(0, 1000),
        startTime: typeof body.turn.startTime === "number" ? body.turn.startTime : null,
        endTime: typeof body.turn.endTime === "number" ? body.turn.endTime : null,
      }
    : null;

  const accessToken = await vertexAuth.getAccessToken();
  if (!accessToken) {
    throw new Error("Vertex AI access token is unavailable.");
  }

  const response = await fetchWithRetry(
    "https://aiplatform.googleapis.com/v1/projects/" +
      encodeURIComponent(vertexProject) +
      "/locations/" +
      encodeURIComponent(vertexLocation) +
      "/publishers/google/models/" +
      encodeURIComponent(vertexModel) +
      ":generateContent",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are a quiet live English meetup coach. You are called only after a verified speaker handoff, so evaluate the completed turn—not the current speaker's words. Do not summarize, restate, narrate, or recap what anyone said. Do not provide routine encouragement, commentary, or a list of observations. Return action.type 'none' with empty message and empty arrays unless one concise intervention is clearly helpful. When intervening, choose exactly one of speech_correction, feedback, or follow_up_question and provide one short, directly useful message (maximum two sentences). Use speech correction only for a clear, meaningful English issue in the completed turn; never correct likely speech-to-text errors, minor punctuation, or accent. A follow-up must be a single natural question that advances the conversation. Set summary to an empty string. Keep feedback, followUpQuestions, and facilitationNotes empty. Do not invent speaker identities.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  articleTitle: body.articleTitle || null,
                  participants: (body.participants || []).slice(0, 20),
                  completedTurn,
                  recentSpeakerTurns: cleanTurns(body.recentTurns),
                  recentText: recentText.slice(-1800),
                  transcriptText: transcriptText.slice(-6000),
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 300,
          responseMimeType: "application/json",
          responseSchema: vertexResponseSchema,
        },
      }),
    }
  );

  const payload = (await response.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { code?: number; status?: string; message?: string };
  };

  if (!response.ok) {
    console.error("[Copilot] Vertex AI error status:", response.status, payload.error?.status);
    throw new Error("Vertex AI could not generate feedback.");
  }

  const content = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!content) {
    console.warn("[Copilot] Vertex returned no content; skipping intervention.");
    return fallbackPayload;
  }

  try {
    return parseResponse(content);
  } catch (error) {
    // A structured response can occasionally be truncated by the provider. A
    // quiet fallback is preferable to showing a facilitator a misleading error.
    console.warn("[Copilot] Invalid Vertex response; skipping intervention.", error);
    return fallbackPayload;
  }
};
