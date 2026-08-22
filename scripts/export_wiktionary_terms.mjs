#!/usr/bin/env node

/**
 * Export the lexical terms already used by One Cup English so the large Kaikki /
 * Wiktextract dump can be imported selectively with --terms-file.
 *
 * This script is read-only. Generated term files should stay local and are not
 * committed to the repository.
 *
 * Usage:
 *   node scripts/export_wiktionary_terms.mjs
 *   node scripts/export_wiktionary_terms.mjs --out /tmp/one-cup-terms.txt
 *
 * Then:
 *   node scripts/import_wiktionary_dictionary.mjs ./kaikki.jsonl.gz \
 *     --terms-file /tmp/one-cup-terms.txt --source-revision 2026-08
 */

import fs from "node:fs";
import { supabase } from "./_supabase.mjs";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;

const terms = [];
let from = 0;
const pageSize = 1000;

while (true) {
  const { data, error } = await supabase
    .from("dictionary_entries")
    .select("term,normalized_term")
    .eq("language_code", "en")
    .order("normalized_term", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  if (!data?.length) break;

  for (const row of data) {
    const term = String(row.term || "").trim();
    if (term) terms.push(term);
  }

  if (data.length < pageSize) break;
  from += pageSize;
}

const uniqueTerms = [...new Map(
  terms.map((term) => [term.trim().replace(/\s+/g, " ").toLowerCase(), term.trim()]),
).values()];
const payload = `${uniqueTerms.join("\n")}\n`;

if (outPath) {
  fs.writeFileSync(outPath, payload, "utf8");
  console.error(`Wrote ${uniqueTerms.length.toLocaleString()} terms to ${outPath}`);
} else {
  process.stdout.write(payload);
  console.error(`Exported ${uniqueTerms.length.toLocaleString()} terms.`);
}
