import "server-only";

import { GoogleGenAI } from "@google/genai";

import { EXAM_FORMAT_COPY, type ExamInterviewer } from "../types";

const TEXT_MODEL = "gemini-3.1-flash-lite";

type InterviewerProfile = Pick<ExamInterviewer, "name" | "gender" | "occupation" | "attire" | "personality" | "voice_tone">;

type GeneratedText = {
  listenRepeatScenario: string;
  interviewScenario: string;
  listenRepeat: string[];
  interviewQuestions: string[];
};

const themesSchema = {
  type: "object",
  properties: {
    listenRepeatTheme: { type: "string" },
    interviewTheme: { type: "string" },
  },
  required: ["listenRepeatTheme", "interviewTheme"],
  additionalProperties: false,
} as const;

const textSchema = {
  type: "object",
  properties: {
    listenRepeatScenario: { type: "string" },
    interviewScenario: { type: "string" },
    listenRepeat: { type: "array", minItems: 7, maxItems: 7, items: { type: "string" } },
    interviewQuestions: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
  },
  required: ["listenRepeatScenario", "interviewScenario", "listenRepeat", "interviewQuestions"],
  additionalProperties: false,
} as const;

function compact(value: unknown, maximum = 280) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}

function gemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI draft generation is not configured. Add the server-only GEMINI_API_KEY to the production project, then retry.");
  return new GoogleGenAI({ apiKey });
}

function asTheme(value: unknown, label: string) {
  const theme = compact(value, 120);
  const words = theme.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 16 || /\?|\b(you|please|would|could|should|can|do|does|how|what|why|when|where)\b/i.test(theme)) {
    throw new Error(`${label} must be a neutral 2–16 word scenario topic, not a question.`);
  }
  return theme;
}

export function validateExamBriefs(listenRepeatTheme: unknown, interviewTheme: unknown) {
  return {
    listenRepeatTheme: asTheme(listenRepeatTheme, "Listen and Repeat brief"),
    interviewTheme: asTheme(interviewTheme, "Take an Interview brief"),
  };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function sharesFourWordPhrase(left: string, right: string) {
  const phrases = (script: string) => {
    const words = normalize(script).split(" ").filter(Boolean);
    return new Set(words.flatMap((_, index) => index + 4 <= words.length ? [words.slice(index, index + 4).join(" ")] : []));
  };
  const leftPhrases = phrases(left);
  return [...phrases(right)].some((phrase) => leftPhrases.has(phrase));
}

function uniqueScripts(scripts: string[], existingScripts: string[]) {
  return scripts.every((script, index) => scripts.slice(0, index).every((prior) => normalize(prior) !== normalize(script) && !sharesFourWordPhrase(prior, script))
    && existingScripts.every((prior) => normalize(prior) !== normalize(script) && !sharesFourWordPhrase(prior, script)));
}

function words(value: string) {
  return value.split(" ").filter(Boolean).length;
}

function parseText(value: string, existingScripts: string[]): GeneratedText {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw new Error("Gemini returned an invalid exam draft. Please generate again.");
  }
  const listenRepeatScenario = compact(parsed.listenRepeatScenario);
  const interviewScenario = compact(parsed.interviewScenario);
  const listenRepeat = Array.isArray(parsed.listenRepeat) ? parsed.listenRepeat.map((item) => compact(item)).filter(Boolean) : [];
  const interviewQuestions = Array.isArray(parsed.interviewQuestions) ? parsed.interviewQuestions.map((item) => compact(item)).filter(Boolean) : [];

  if (!listenRepeatScenario || !interviewScenario || words(listenRepeatScenario) < 18 || words(listenRepeatScenario) > 42 || words(interviewScenario) < 36 || words(interviewScenario) > 60) {
    throw new Error("The generated candidate setups did not meet the required length. Please generate again.");
  }
  if (!/^You are\b/i.test(listenRepeatScenario) || !/Listen to the speaker and repeat what (he or she|they) says\./i.test(listenRepeatScenario) || !/Repeat only once\.?$/i.test(listenRepeatScenario)) {
    throw new Error("The Listen and Repeat setup did not follow the required test format. Please generate again.");
  }
  if (!/^You have (volunteered|agreed) to participate in a research study about\b/i.test(interviewScenario) || !/You will have a short online interview with a researcher\./i.test(interviewScenario) || !/The researcher will ask you some questions\./i.test(interviewScenario) || !/Please answer the interviewer's questions\.?$/i.test(interviewScenario)) {
    throw new Error("The interview setup did not follow the required test format. Please generate again.");
  }
  if (listenRepeat.length !== 7 || interviewQuestions.length !== 4) throw new Error("Gemini must return exactly 7 sentences and 4 interview questions.");
  if (listenRepeat.some((script) => words(script) < 8 || words(script) > 22)) throw new Error("Listen and Repeat sentences must be 8–22 words.");
  if (interviewQuestions.some((script) => words(script) < 5 || words(script) > 20 || !script.endsWith("?"))) throw new Error("Interview questions must be 5–20 words and end with a question mark.");

  const scripts = [listenRepeatScenario, interviewScenario, ...listenRepeat, ...interviewQuestions];
  if (!uniqueScripts(scripts, existingScripts)) throw new Error("Gemini returned a script too similar to an existing exam. Generate again.");
  return { listenRepeatScenario, interviewScenario, listenRepeat, interviewQuestions };
}

function interviewerDescription(interviewer: InterviewerProfile) {
  return `${interviewer.name}, a ${interviewer.personality} ${interviewer.occupation}`;
}

function themePrompt(title: string, interviewer: InterviewerProfile) {
  return `Return JSON only: {"listenRepeatTheme":"...","interviewTheme":"..."}.

Suggest two distinct, concrete TOEFL-style scenario topics for the named set "${title}". A theme is internal writing context only: it is not candidate-facing text, a test sentence, or a question. Each value must be a neutral 2–16 word noun phrase. Do not use a question mark, second-person language, commands, or test instructions.

The Listen and Repeat topic should name a concrete role and situation that can lead to short factual messages, such as checking out books at a university library. The interview topic should name an accessible research-study topic, such as exercise habits or food preferences, that ${interviewerDescription(interviewer)} could ask about. Keep both specific and non-specialist. Do not use broad themes such as campus life, daily routines, work, or travel.`;
}

function draftPrompt(input: { listenRepeatTheme: string; interviewTheme: string; interviewer: InterviewerProfile; existingScripts: string[] }) {
  const existing = input.existingScripts.length ? input.existingScripts.slice(0, 160).map((script) => `- ${script}`).join("\n") : "- No earlier scripts";
  return `Return JSON only: {"listenRepeatScenario":"...","interviewScenario":"...","listenRepeat":[...],"interviewQuestions":[...]}. Create two candidate-facing scenario setups, exactly 7 original Listen and Repeat sentences, and exactly 4 original interview questions in natural English. Never expose internal theme labels or generation metadata to the candidate.

LISTEN AND REPEAT THEME: ${input.listenRepeatTheme}
Create one 18–42 word candidate-facing scenario setup in this exact structure: (1) "You are" followed by a natural role and situation based on the theme; (2) "Listen to the speaker and repeat what he or she says."; (3) "Repeat only once." Do not call it a task, theme, scenario, or practice item.
Create 7 factual sentences of 8–22 words. They must be easy to hear, repeat, and understand.

INTERVIEW THEME: ${input.interviewTheme}
Create one 36–60 word candidate-facing scenario setup in this exact four-sentence structure: (1) "You have volunteered to participate in a research study about" followed by the topic; (2) "You will have a short online interview with a researcher."; (3) "The researcher will ask you some questions."; (4) "Please answer the interviewer's questions." Do not call it a task, theme, scenario, or practice item.
Create 4 conversational questions of 5–20 words, each ending with a question mark. The interviewer is ${interviewerDescription(input.interviewer)}. The questions must progress in this exact order: (1) personal factual experience, (2) personal reflection or prediction, (3) evaluate two sides and justify a position, and (4) broader policy or societal opinion. Avoid specialist advice, job-interview language, jargon, and repeated question shapes.

Do not reuse, paraphrase closely, or share a distinctive four-word phrase with any prior exam script:
${existing}`;
}

function parseThemes(value: string) {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw new Error("Gemini returned invalid brief suggestions. Please try again.");
  }
  return {
    listenRepeatTheme: asTheme(parsed.listenRepeatTheme, "Listen and Repeat brief"),
    interviewTheme: asTheme(parsed.interviewTheme, "Take an Interview brief"),
  };
}

export async function suggestExamBriefs(title: string, interviewer: InterviewerProfile) {
  const response = await gemini().models.generateContent({
    model: TEXT_MODEL,
    contents: themePrompt(title, interviewer),
    config: { responseMimeType: "application/json", responseJsonSchema: themesSchema, temperature: 1 },
  });
  if (!response.text) throw new Error("Gemini returned no brief suggestions.");
  return { themes: parseThemes(response.text), model: TEXT_MODEL };
}

export async function generateExamDraftContent(input: {
  listenRepeatTheme: string;
  interviewTheme: string;
  interviewer: InterviewerProfile;
  existingScripts: string[];
}) {
  const briefs = validateExamBriefs(input.listenRepeatTheme, input.interviewTheme);
  const response = await gemini().models.generateContent({
    model: TEXT_MODEL,
    contents: draftPrompt({ ...input, ...briefs }),
    config: { responseMimeType: "application/json", responseJsonSchema: textSchema, temperature: 1 },
  });
  if (!response.text) throw new Error("Gemini returned no exam draft.");
  const text = parseText(response.text, input.existingScripts);
  return {
    sceneDescription: `A clear, inclusive generated scene for ${briefs.listenRepeatTheme}.`,
    narration: [
      { cue_key: "section_intro", label: "Speaking section introduction", script: EXAM_FORMAT_COPY.sectionIntro, source: "fixed", position: 1 },
      { cue_key: "listen_repeat_instructions", label: "Listen and Repeat directions", script: EXAM_FORMAT_COPY.listenInstructions, source: "fixed", position: 2 },
      { cue_key: "listen_repeat_scenario", label: "Listen and Repeat scenario", script: text.listenRepeatScenario, source: "generated", position: 3 },
      { cue_key: "interview_instructions", label: "Take an Interview directions", script: EXAM_FORMAT_COPY.interviewInstructions, source: "fixed", position: 4 },
      { cue_key: "interview_scenario", label: "Take an Interview scenario", script: text.interviewScenario, source: "generated", position: 5 },
    ],
    items: [
      ...text.listenRepeat.map((prompt, index) => ({ module: "listen_repeat", position: index + 1, label: `Sentence ${index + 1}`, prompt, response_seconds: 12, visual_target: briefs.listenRepeatTheme, audio_status: "idle", visual_status: "idle", video_status: "idle", media_mode: "generated" })),
      ...text.interviewQuestions.map((prompt, index) => ({ module: "interview", position: index + 1, label: `Question ${index + 1}`, prompt, response_seconds: index < 2 ? 30 : 45, visual_target: "", audio_status: "idle", visual_status: "idle", video_status: "idle", media_mode: "generated" })),
    ],
    model: TEXT_MODEL,
    ...briefs,
  };
}
