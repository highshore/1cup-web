// Finds today's expression inside an English sentence, so the lesson can mark it:
// "push back (on)" also matches "pushed back on", "loop in" matches "loop me in".
// Parenthesised parts ("(on)", "(sth)", "(sb's)") are optional or stand for other words,
// so they are left out of the match; common irregular forms ("got", "came") are listed.

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Past and -ing forms the endings below cannot make.
const IRREGULAR: Record<string, string[]> = {
  bring: ["brought"],
  come: ["came"],
  drive: ["drove", "driven"],
  get: ["got", "gotten", "getting"],
  give: ["gave", "given"],
  go: ["went", "gone", "goes", "going"],
  in: ["into"],
  keep: ["kept"],
  lay: ["laid"],
  make: ["made"],
  run: ["ran", "running"],
  set: ["setting"],
  take: ["took", "taken"],
};

function wordForms(word: string) {
  const extra = IRREGULAR[word.toLowerCase()] ?? [];
  let forms: string;
  if (!/^[a-z]+$/i.test(word) || word.length <= 2) forms = escape(word);
  else if (/e$/i.test(word)) forms = `${word.slice(0, -1)}(?:e|es|ed|ing)`;
  else if (/[^aeiou]y$/i.test(word)) forms = `${word.slice(0, -1)}(?:y|ies|ied|ying)`;
  // "ship" → "shipped", "push" → "pushes": the last letter may double before an ending.
  else forms = `${word}(?:${word.slice(-1)})?(?:s|es|ed|ing)?`;
  return extra.length > 0 ? `(?:${[forms, ...extra].join("|")})` : forms;
}

export function expressionPattern(expression: string): RegExp | null {
  // A placeholder ("(sth)", "(sb)") stands for whole phrases ("the new packaging concept"),
  // so the words around it may sit further apart; "(on)"-style optional words just drop.
  const slots = expression.split(/\s*\([^)]*\)\s*/);
  const placeholder = /\((?:sb|sth|someone|something|one)(?:'s)?\)/i.test(expression);
  const words = slots.join(" ").split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return null;
  // Words may come between the expression's words ("loop me in", "pick it back up"),
  // and a hyphen counts as a space ("lock-in", "end to end").
  const gap = String.raw`(?:[\s-]+[\w'’]+){0,${placeholder ? 4 : 2}}?[\s-]+`;
  return new RegExp(String.raw`\b${words.map(wordForms).join(gap)}\b`, "gi");
}

export type MarkedPart = { text: string; marked: boolean };

/** The text cut into plain and marked parts: every match of the pattern, or every
 *  occurrence of the phrase when one is given as a string. */
export function markParts(text: string, mark: RegExp | string | null | undefined): MarkedPart[] {
  if (!mark) return [{ text, marked: false }];
  const pattern = typeof mark === "string" ? new RegExp(escape(mark), "g") : new RegExp(mark.source, mark.flags);
  const parts: MarkedPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (!match[0]) continue;
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), marked: false });
    parts.push({ text: match[0], marked: true });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), marked: false });
  return parts.length > 0 ? parts : [{ text, marked: false }];
}
