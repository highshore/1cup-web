#!/usr/bin/env node

/**
 * Stream English Wiktionary data exported by Wiktextract/Kaikki into Supabase.
 *
 * The importer is intentionally idempotent. It upserts dictionary entries by
 * normalized term and meanings by (source, source_meaning_id). It stores
 * inflected spellings (for example, ached -> ache) as entry forms instead of
 * creating empty entries for Wiktionary's form-of records. It also imports
 * IPA, pronunciation audio and short editor-style examples when available.
 * External quotation examples are skipped because their copyright/license may
 * differ from Wiktionary's own text.
 *
 * Required env in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/import_wiktionary_dictionary.mjs ./kaikki.jsonl.gz
 *   node scripts/import_wiktionary_dictionary.mjs https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
 *   node scripts/import_wiktionary_dictionary.mjs ./kaikki.jsonl.gz --terms "discreet,overtly"
 *   node scripts/import_wiktionary_dictionary.mjs ./kaikki.jsonl.gz --terms-file ./terms.txt
 */

import fs from "node:fs";
import readline from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { createHash } from "node:crypto";
import { supabase } from "./_supabase.mjs";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

if (!inputPath) {
  console.error("Usage: node scripts/import_wiktionary_dictionary.mjs <jsonl|jsonl.gz> [--terms a,b] [--terms-file path] [--batch 200] [--source-revision value] [--skip-records n] [--max-records n]");
  process.exit(1);
}

const batchSize = Math.max(25, Number(argValue("--batch") || 200));
const sourceRevision = argValue("--source-revision") || null;
const skipRecords = Math.max(0, Number(argValue("--skip-records") || 0));
const maxRecords = Math.max(0, Number(argValue("--max-records") || 0));
const normalize = (term) => String(term || "").trim().replace(/\s+/g, " ").toLowerCase();

const requestedTerms = new Set();
const inlineTerms = argValue("--terms");
if (inlineTerms) inlineTerms.split(",").map(normalize).filter(Boolean).forEach((term) => requestedTerms.add(term));
const termsFile = argValue("--terms-file");
if (termsFile) fs.readFileSync(termsFile, "utf8").split(/\r?\n/).map(normalize).filter(Boolean).forEach((term) => requestedTerms.add(term));

const grammarName = (pos) => ({
  adj: "adjective", adv: "adverb", noun: "noun", verb: "verb", pron: "pronoun",
  prep: "preposition", conj: "conjunction", interj: "interjection", det: "determiner",
  num: "numeral", particle: "particle", phrase: "phrase", name: "proper noun",
  prefix: "prefix", suffix: "suffix", abbrev: "abbreviation", symbol: "symbol",
})[pos] || String(pos || "unknown").replaceAll("_", " ");

const relationWords = (items) => [...new Set((Array.isArray(items) ? items : [])
  .map((item) => typeof item === "string" ? item : item?.word)
  .filter((word) => typeof word === "string" && word.trim())
  .map((word) => word.trim()))];

const stableFallbackId = (word, pos, order, gloss) => `wiktextract:${createHash("sha1")
  .update(`${normalize(word)}|${pos || "unknown"}|${order}|${gloss}`).digest("hex")}`;

const wiktionaryUrl = (term) => `https://en.wiktionary.org/wiki/${encodeURIComponent(term.replaceAll(" ", "_"))}`;
const commonsRedirect = (filename) => filename ? `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}` : null;

function firstPronunciation(sounds) {
  const values = Array.isArray(sounds) ? sounds : [];
  const ipa = values.find((sound) => typeof sound?.ipa === "string" && sound.ipa.trim())?.ipa || null;
  const audioSource = values.find((sound) => sound && (sound.mp3_url || sound.ogg_url || sound.audio));
  const audioUrl = audioSource?.mp3_url || audioSource?.ogg_url || commonsRedirect(audioSource?.audio) || null;
  return { ipa, audioUrl, audioFilename: audioSource?.audio || null };
}

function firstEditorExample(sense) {
  const examples = Array.isArray(sense?.examples) ? sense.examples : [];
  for (const example of examples) {
    if (typeof example === "string" && example.trim()) return example.trim();
    if (!example || typeof example !== "object") continue;
    // Quotation/citation records often carry ref/title/author/year. Skip those.
    if (example.ref || example.title || example.author || example.year || example.type === "quotation") continue;
    if (typeof example.text === "string" && example.text.trim()) return example.text.trim();
  }
  return null;
}

function firstImage(record, sense) {
  const candidates = [
    ...(Array.isArray(sense?.images) ? sense.images : []),
    ...(Array.isArray(record?.images) ? record.images : []),
  ];
  for (const image of candidates) {
    if (typeof image === "string") {
      if (/^https?:\/\//i.test(image)) return { url: image, metadata: { source_value: image } };
      return { url: commonsRedirect(image), metadata: { filename: image } };
    }
    if (!image || typeof image !== "object") continue;
    const url = image.url || image.image_url || image.commons_url || (image.filename ? commonsRedirect(image.filename) : null);
    if (url) return { url, metadata: image };
  }
  return { url: null, metadata: null };
}

let processedRecords = 0;
let importedEntries = 0;
let importedMeanings = 0;
let skippedRecords = 0;
let parseErrors = 0;
let batch = [];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function withRetry(label, operation) {
  const maxAttempts = 5;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delay = Math.min(15000, 500 * 2 ** (attempt - 1));
      console.warn(`${label} failed (attempt ${attempt}/${maxAttempts}); retrying in ${delay}ms`, error?.message || error);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function flushBatch() {
  if (!batch.length) return;
  const records = batch;
  batch = [];

  const recordsWithMeanings = [];
  for (const record of records) {
    const term = String(record.word || "").trim();
    const normalized = normalize(term);
    if (!term || !normalized) continue;
    const usableSenses = (Array.isArray(record.senses) ? record.senses : []).flatMap((sense, order) => {
      const tags = Array.isArray(sense?.tags) ? sense.tags.filter((tag) => typeof tag === "string") : [];
      if (tags.includes("form-of") || tags.includes("alt-of")) return [];
      const gloss = (Array.isArray(sense?.glosses) ? sense.glosses : []).find((value) => typeof value === "string" && value.trim())
        || (Array.isArray(sense?.raw_glosses) ? sense.raw_glosses : []).find((value) => typeof value === "string" && value.trim());
      return gloss ? [{ sense, order, tags, gloss: gloss.trim() }] : [];
    });
    if (usableSenses.length) recordsWithMeanings.push({ record, term, normalized, usableSenses });
  }

  const entriesByNormalized = new Map();
  for (const { term, normalized } of recordsWithMeanings) {
    entriesByNormalized.set(normalized, {
      term,
      normalized_term: normalized,
      entry_type: /\s/.test(term) ? "expression" : "word",
      language_code: "en",
      source: "wiktionary",
      source_url: wiktionaryUrl(term),
      source_license: "CC BY-SA 4.0 / GFDL",
      source_dataset: "wiktextract/kaikki",
      source_metadata: sourceRevision ? { source_revision: sourceRevision } : {},
      updated_at: new Date().toISOString(),
    });
  }

  const entries = [...entriesByNormalized.values()];
  if (!entries.length) return;
  await withRetry("dictionary entry upsert", async () => {
    const { error } = await supabase
      .from("dictionary_entries")
      .upsert(entries, { onConflict: "language_code,normalized_term" });
    if (error) throw error;
  });

  const entryRows = await withRetry("dictionary entry lookup", async () => {
    const { data, error } = await supabase
      .from("dictionary_entries")
      .select("id,normalized_term")
      .eq("language_code", "en")
      .in("normalized_term", entries.map((entry) => entry.normalized_term));
    if (error) throw error;
    return data || [];
  });
  const entryIds = new Map((entryRows || []).map((row) => [row.normalized_term, row.id]));
  importedEntries += entries.length;

  const meanings = [];
  const formsByEntryKey = new Map();
  const addForm = (entryId, canonicalNormalized, form, tags, metadata) => {
    const normalizedForm = normalize(form);
    if (!entryId || !normalizedForm || normalizedForm === canonicalNormalized) return;
    const key = `${entryId}\u0000${normalizedForm}`;
    formsByEntryKey.set(key, {
      entry_id: entryId,
      form: String(form).trim(),
      normalized_form: normalizedForm,
      language_code: "en",
      form_tags: [...new Set(tags)],
      source: "wiktionary",
      source_metadata: {
        ...(sourceRevision ? { source_revision: sourceRevision } : {}),
        ...metadata,
      },
      updated_at: new Date().toISOString(),
    });
  };

  for (const { record, term, normalized, usableSenses } of recordsWithMeanings) {
    const entryId = entryIds.get(normalized);
    if (!entryId) continue;
    const { ipa, audioUrl, audioFilename } = firstPronunciation(record.sounds);
    for (const { sense, order, tags, gloss } of usableSenses) {
      const exampleEn = firstEditorExample(sense);
      const image = firstImage(record, sense);

      meanings.push({
        entry_id: entryId,
        source_meaning_id: typeof sense.id === "string" && sense.id.trim() ? sense.id.trim() : stableFallbackId(term, record.pos, order, gloss),
        grammar_type: grammarName(record.pos),
        definition_en: gloss.trim(),
        definition_ko: null,
        usage_labels: tags,
        synonyms: relationWords(sense.synonyms),
        antonyms: relationWords(sense.antonyms),
        pronunciation_ipa: ipa,
        example_en: exampleEn,
        example_ko: null,
        audio_url: audioUrl,
        image_url: image.url,
        media_attribution: {
          ...(audioFilename ? { audio: { filename: audioFilename, source: "Wikimedia Commons via Wiktionary" } } : {}),
          ...(image.metadata ? { image: image.metadata } : {}),
        },
        meaning_order: order,
        source: "wiktionary",
        source_url: wiktionaryUrl(term),
        source_license: "CC BY-SA 4.0 / GFDL",
        source_dataset: "wiktextract/kaikki",
        source_metadata: {
          ...(sourceRevision ? { source_revision: sourceRevision } : {}),
          wiktextract_pos: record.pos || null,
        },
        is_verified: false,
        updated_at: new Date().toISOString(),
      });
    }

    for (const form of Array.isArray(record.forms) ? record.forms : []) {
      const formText = typeof form === "string" ? form : form?.form;
      const formTags = Array.isArray(form?.tags) ? form.tags.filter((tag) => typeof tag === "string") : [];
      addForm(entryId, normalized, formText, formTags, { wiktextract_relation: "headword-form" });
    }
  }

  // Form-of rows have no standalone meaning, but usually identify a canonical
  // term explicitly. Attach them when the canonical entry has already been
  // imported; a later full pass can safely fill any forward references.
  const formOfAliases = [];
  for (const record of records) {
    const form = String(record.word || "").trim();
    if (!form) continue;
    for (const sense of Array.isArray(record.senses) ? record.senses : []) {
      const tags = Array.isArray(sense?.tags) ? sense.tags.filter((tag) => typeof tag === "string") : [];
      if (!tags.includes("form-of") && !tags.includes("alt-of")) continue;
      for (const target of Array.isArray(sense?.form_of) ? sense.form_of : []) {
        const targetTerm = typeof target === "string" ? target : target?.word;
        const targetNormalized = normalize(targetTerm);
        if (targetNormalized) formOfAliases.push({ form, tags, targetNormalized });
      }
    }
  }
  const aliasTargets = [...new Set(formOfAliases.map((alias) => alias.targetNormalized))];
  if (aliasTargets.length) {
    const { data: targetRows, error: targetError } = await withRetry("form target lookup", async () => {
      const result = await supabase
        .from("dictionary_entries")
        .select("id,normalized_term")
        .eq("language_code", "en")
        .in("normalized_term", aliasTargets);
      if (result.error) throw result.error;
      return result;
    });
    if (targetError) throw targetError;
    const targetIds = new Map((targetRows || []).map((row) => [row.normalized_term, row.id]));
    for (const alias of formOfAliases) {
      addForm(targetIds.get(alias.targetNormalized), alias.targetNormalized, alias.form, alias.tags, { wiktextract_relation: "form-of" });
    }
  }

  // Kaikki occasionally repeats a sense key within adjacent source records.
  // Postgres cannot apply ON CONFLICT twice to the same key in one INSERT, but
  // the import remains idempotent when the final occurrence is upserted once.
  const meaningsBySourceKey = new Map(
    meanings.map((meaning) => [`${meaning.source}\u0000${meaning.source_meaning_id}`, meaning])
  );
  const uniqueMeanings = [...meaningsBySourceKey.values()];

  if (uniqueMeanings.length) {
    await withRetry("dictionary meaning upsert", async () => {
      const { error } = await supabase
        .from("dictionary_meanings")
        .upsert(uniqueMeanings, { onConflict: "source,source_meaning_id" });
      if (error) throw error;
    });
    importedMeanings += uniqueMeanings.length;
  }

  const forms = [...formsByEntryKey.values()];
  if (forms.length) {
    await withRetry("dictionary entry forms upsert", async () => {
      const { error } = await supabase
        .from("dictionary_entry_forms")
        .upsert(forms, { onConflict: "entry_id,normalized_form" });
      if (error) throw error;
    });
  }

  console.log(`Processed ${processedRecords.toLocaleString()} records; upserted ${importedEntries.toLocaleString()} entries / ${importedMeanings.toLocaleString()} meanings`);
}

const isRemoteInput = /^https:\/\//i.test(inputPath);
const sourceStream = isRemoteInput
  ? await (async () => {
      const response = await fetch(inputPath);
      if (!response.ok || !response.body) {
        throw new Error(`Unable to download Wiktextract source: ${response.status} ${response.statusText}`);
      }
      return Readable.fromWeb(response.body);
    })()
  : fs.createReadStream(inputPath);
const inputStream = inputPath.split("?")[0].endsWith(".gz")
  ? sourceStream.pipe(createGunzip())
  : sourceStream;
const lines = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

for await (const line of lines) {
  if (!line.trim()) continue;
  let record;
  try { record = JSON.parse(line); } catch { parseErrors += 1; continue; }
  if (record?.lang_code !== "en") { skippedRecords += 1; continue; }
  const normalized = normalize(record.word);
  if (!normalized || (requestedTerms.size && !requestedTerms.has(normalized))) { skippedRecords += 1; continue; }
  if (processedRecords < skipRecords) {
    processedRecords += 1;
    continue;
  }
  processedRecords += 1;
  batch.push(record);
  if (batch.length >= batchSize) await flushBatch();
  if (maxRecords && processedRecords - skipRecords >= maxRecords) {
    inputStream.destroy();
    break;
  }
}

await flushBatch();
console.log(JSON.stringify({
  processedRecords,
  importedEntries,
  importedMeanings,
  skippedRecords,
  parseErrors,
  requestedTerms: requestedTerms.size,
  skipRecords,
  maxRecords,
  sourceRevision,
}, null, 2));
