import type { DailyLessonContent } from "./server/lessons";

// "(sb)", "(sth)", "(sb's)" and the like mark where a word goes in an expression such as
// "run (sth) by (sb)". The voice reads them as the words they stand for ("run something
// by someone") instead of spelling out "sth" and "sb".
const PLACEHOLDER = /\((sb|sth|someone|something|one)('s)?\)/gi;
const PLACEHOLDER_WORD: Record<string, string> = { sb: "someone", sth: "something", someone: "someone", something: "something", one: "one" };

export function spokenText(text: string) {
  return text
    .replace(PLACEHOLDER, (_, word: string, possessive: string | undefined) => `${PLACEHOLDER_WORD[word.toLowerCase()]}${possessive ?? ""}`)
    .replace(/\s+/g, " ")
    .trim();
}

// A lesson's audio comes in clips: the expression, each example by its position, and
// the whole dialogue. The browser asks for one by name (GET /api/daily/audio).
export type DailyAudioClip = "expression" | "dialogue" | `example-${number}`;

export function isAudioClip(value: string): value is DailyAudioClip {
  return value === "expression" || value === "dialogue" || /^example-\d{1,2}$/.test(value);
}

export function lessonClips(lesson: Pick<DailyLessonContent, "examples" | "dialogue">): DailyAudioClip[] {
  return [
    "expression",
    ...lesson.examples.map((_, index) => `example-${index}` as const),
    ...(lesson.dialogue.length > 0 ? (["dialogue"] as const) : []),
  ];
}
