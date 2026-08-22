#!/usr/bin/env node

/**
 * Stream English Wiktionary data exported by Wiktextract/Kaikki into Supabase.
 *
 * The importer is intentionally idempotent. It upserts dictionary entries by
 * normalized term and meanings by (source, source_meaning_id). It also imports
 * IPA, pronunciation audio and short editor-style examples when available.
 * External quotation examples are skipped because their copyright/license may
 * differ from Wiktionary's own text.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/import_wiktionary_dictionary.mjs ./kaikki.jsonl.gz
 *   node scripts/import_wiktionary_dictionary.mjs ./kaikki.jsonl.gz --terms "discreet,overtly"
 *   node scripts/import_wiktionary_dictionary.mjs ./kaikki.jsonl.gz --terms-file ./terms.txt
 */

import fs from "node:fs";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

if (!inputPath) {
  console.error("Usage: node scripts/import_wiktionary_dictionary.mjs <jsonl|jsonl.gz> [--terms a,b] [--terms-file path] [--batch 200] [--source-revision value]");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const batchSize = Math.max(25, Number(argValue("--batch") || 200));
const sourceRevision = argValue("--source-revision") || null;
const normalize = (term) => String(term || "").trim().replace(/\s+/g, " ").toLowerCase();

const requestedTerms = new Set();
const inlineTerms = argValue("--terms");
if (inlineTerms) inlineTerms.split(",").map(normalize).filter(Boolean).forEach((term) => requestedTerms.add(term));
const termsFile = argValue("--terms-file");
if (termsFile) fs.readFileSync(termsFile, "utf8").split(/\r?\n/).map(normalize).filter(Boolean).forEach((term) => requestedTerms.add(term));

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

async function flushBatch() {
  if (!batch.length) return;
  const records = batch;
  batch = [];

  const entriesByNormalized = new Map();
  for (const record of records) {
    const term = String(record.word || "").trim();
    const normalized = normalize(term);
    if (!term || !normalized) continue;
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
  const { error: entryError } = await supabase.from("dictionary_entries").upsert(entries, { onConflict: "language_code,normalized_term" });
  if (entryError) throw entryError;

  const { data: entryRows, error: lookupError } = await supabase.from("dictionary_entries")
    .select("id,normalized_term").eq("language_code", "en").in("normalized_term", entries.map((entry) => entry.normalized_term));
  if (lookupError) throw lookupError;
  const entryIds = new Map((entryRows || []).map((row) => [row.normalized_term, row.id]));
  importedEntries += entries.length;

  const meanings = [];
  for (const record of records) {
    const term = String(record.word || "").trim();
    const entryId = entryIds.get(normalize(term));
    if (!entryId) continue;
    const { ipa, audioUrl, audioFilename } = firstPronunciation(record.sounds);
    const senses = Array.isArray(record.senses) ? record.senses : [];

    senses.forEach((sense, order) => {
      const tags = Array.isArray(sense?.tags) ? sense.tags.filter((tag) => typeof tag === "string") : [];
      if (tags.includes("form-of") || tags.includes("alt-of")) return;
      const gloss = (Array.isArray(sense?.glosses) ? sense.glosses : []).find((value) => typeof value === "string" && value.trim())
        || (Array.isArray(sense?.raw_glosses) ? sense.raw_glosses : []).find((value) => typeof value === "string" && value.trim());
      if (!gloss) return;
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
    });
  }

  if (meanings.length) {
    const { error: meaningError } = await supabase.from("dictionary_meanings").upsert(meanings, { onConflict: "source,source_meaning_id" });
    if (meaningError) throw meaningError;
    importedMeanings += meanings.length;
  }

  console.log(`Processed ${processedRecords.toLocaleString()} records; upserted ${importedEntries.toLocaleString()} entries / ${importedMeanings.toLocaleString()} meanings`);
}

const fileStream = fs.createReadStream(inputPath);
const inputStream = inputPath.endsWith(".gz") ? fileStream.pipe(createGunzip()) : fileStream;
const lines = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

for await (const line of lines) {
  if (!line.trim()) continue;
  let record;
  try { record = JSON.parse(line); } catch { parseErrors += 1; continue; }
  if (record?.lang_code !== "en") { skippedRecords += 1; continue; }
  const normalized = normalize(record.word);
  if (!normalized || (requestedTerms.size && !requestedTerms.has(normalized))) { skippedRecords += 1; continue; }
  processedRecords += 1;
  batch.push(record);
  if (batch.length >= batchSize) await flushBatch();
}

await flushBatch();
console.log(JSON.stringify({ processedRecords, importedEntries, importedMeanings, skippedRecords, parseErrors, requestedTerms: requestedTerms.size }, null, 2));
