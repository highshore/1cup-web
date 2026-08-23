#!/usr/bin/env node

/**
 * Attach Wiktextract inflections and form-of aliases to their canonical
 * dictionary entries. This is safe to re-run and does not create entries or
 * meanings; it only upserts dictionary_entry_forms rows.
 */

import fs from "node:fs";
import readline from "node:readline";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";

import { supabase } from "./_supabase.mjs";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

if (!inputPath) {
  console.error("Usage: node scripts/backfill_wiktionary_entry_forms.mjs <jsonl|jsonl.gz> [--batch 200] [--source-revision value]");
  process.exit(1);
}

const batchSize = Math.max(50, Number(argValue("--batch") || 200));
const sourceRevision = argValue("--source-revision") || null;
const normalize = (term) => String(term || "").trim().replace(/\s+/g, " ").toLowerCase();
const canonicalTerm = (term) => String(term || "").trim().replace(/#English$/i, "");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function withRetry(label, operation) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === 5) break;
      const delay = Math.min(15000, 500 * 2 ** (attempt - 1));
      console.warn(`${label} failed (attempt ${attempt}/5); retrying in ${delay}ms`, error?.message || error);
      await sleep(delay);
    }
  }
  throw lastError;
}

function hasUsableMeaning(record) {
  return (Array.isArray(record.senses) ? record.senses : []).some((sense) => {
    const tags = Array.isArray(sense?.tags) ? sense.tags : [];
    if (tags.includes("form-of") || tags.includes("alt-of")) return false;
    const values = [...(Array.isArray(sense?.glosses) ? sense.glosses : []), ...(Array.isArray(sense?.raw_glosses) ? sense.raw_glosses : [])];
    return values.some((value) => typeof value === "string" && value.trim());
  });
}

let processed = 0;
let importedForms = 0;
let parseErrors = 0;
let candidates = [];

const addCandidate = (targetTerm, form, tags, relation) => {
  const canonical = canonicalTerm(targetTerm);
  const targetNormalized = normalize(canonical);
  const normalizedForm = normalize(form);
  if (!targetNormalized || !normalizedForm || targetNormalized === normalizedForm) return;
  candidates.push({ canonical, targetNormalized, form: String(form).trim(), normalizedForm, tags: [...new Set(tags)], relation });
};

async function flush() {
  if (!candidates.length) return;
  const pending = candidates;
  candidates = [];
  const targetTerms = [...new Set(pending.map((candidate) => candidate.targetNormalized))];
  const entryIds = new Map();

  for (let start = 0; start < targetTerms.length; start += 200) {
    const targetChunk = targetTerms.slice(start, start + 200);
    const rows = await withRetry("canonical form target lookup", async () => {
      const { data, error } = await supabase
        .from("dictionary_entries")
        .select("id,normalized_term")
        .eq("language_code", "en")
        .eq("source", "wiktionary")
        .in("normalized_term", targetChunk);
      if (error) throw error;
      return data || [];
    });
    for (const row of rows) entryIds.set(String(row.normalized_term), String(row.id));
  }

  const formsByKey = new Map();
  for (const candidate of pending) {
    const entryId = entryIds.get(candidate.targetNormalized);
    if (!entryId) continue;
    const key = `${entryId}\u0000${candidate.normalizedForm}`;
    formsByKey.set(key, {
      entry_id: entryId,
      form: candidate.form,
      normalized_form: candidate.normalizedForm,
      language_code: "en",
      form_tags: candidate.tags,
      source: "wiktionary",
      source_metadata: {
        ...(sourceRevision ? { source_revision: sourceRevision } : {}),
        wiktextract_relation: candidate.relation,
      },
      updated_at: new Date().toISOString(),
    });
  }

  const forms = [...formsByKey.values()];
  for (let start = 0; start < forms.length; start += 200) {
    const formChunk = forms.slice(start, start + 200);
    await withRetry("dictionary entry form upsert", async () => {
      const { error } = await supabase
        .from("dictionary_entry_forms")
        .upsert(formChunk, { onConflict: "entry_id,normalized_form" });
      if (error) throw error;
    });
    importedForms += formChunk.length;
  }
}

const isRemoteInput = /^https:\/\//i.test(inputPath);
const sourceStream = isRemoteInput
  ? await (async () => {
      const response = await fetch(inputPath);
      if (!response.ok || !response.body) throw new Error(`Unable to download Wiktextract source: ${response.status} ${response.statusText}`);
      return Readable.fromWeb(response.body);
    })()
  : fs.createReadStream(inputPath);
const inputStream = inputPath.split("?")[0].endsWith(".gz") ? sourceStream.pipe(createGunzip()) : sourceStream;

for await (const line of readline.createInterface({ input: inputStream, crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  let record;
  try { record = JSON.parse(line); } catch { parseErrors += 1; continue; }
  if (record?.lang_code !== "en") continue;
  processed += 1;
  const term = String(record.word || "").trim();
  if (!term) continue;

  if (hasUsableMeaning(record)) {
    for (const form of Array.isArray(record.forms) ? record.forms : []) {
      const formText = typeof form === "string" ? form : form?.form;
      const tags = Array.isArray(form?.tags) ? form.tags.filter((tag) => typeof tag === "string") : [];
      addCandidate(term, formText, tags, "headword-form");
    }
  }

  for (const sense of Array.isArray(record.senses) ? record.senses : []) {
    const tags = Array.isArray(sense?.tags) ? sense.tags.filter((tag) => typeof tag === "string") : [];
    if (!tags.includes("form-of") && !tags.includes("alt-of")) continue;
    for (const target of Array.isArray(sense?.form_of) ? sense.form_of : []) {
      addCandidate(typeof target === "string" ? target : target?.word, term, tags, "form-of");
    }
  }

  if (candidates.length >= batchSize) {
    await flush();
    console.log(`Processed ${processed.toLocaleString()} records; upserted ${importedForms.toLocaleString()} forms`);
  }
}

await flush();
console.log(JSON.stringify({ processed, importedForms, parseErrors, sourceRevision }, null, 2));
