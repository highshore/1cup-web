#!/usr/bin/env node

/**
 * Safely retire legacy dictionary meanings after a Wiktionary bulk import.
 *
 * This script is intentionally conservative:
 *   1. Measures legacy-entry Wiktionary coverage.
 *   2. Aborts unless coverage is at least --min-coverage (default 0.95).
 *   3. Deletes only one_cup_legacy meanings for entries that already have at
 *      least one Wiktionary meaning. Existing foreign keys use ON DELETE SET
 *      NULL, so user/deck/study records remain attached to the lexical entry.
 *   4. Never deletes dictionary_entries or user study history.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/finalize_wiktionary_dictionary.mjs --dry-run
 *   node scripts/finalize_wiktionary_dictionary.mjs --min-coverage 0.98
 */

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
const minCoverage = Math.max(0, Math.min(1, Number(argValue("--min-coverage") || 0.95)));

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: legacyRows, error: legacyError } = await supabase
  .from("dictionary_meanings")
  .select("entry_id")
  .eq("source", "one_cup_legacy");
if (legacyError) throw legacyError;

const legacyEntryIds = [...new Set((legacyRows || []).map((row) => String(row.entry_id)))];
if (legacyEntryIds.length === 0) {
  console.log("No legacy dictionary meanings remain.");
  process.exit(0);
}

const covered = new Set();
for (let start = 0; start < legacyEntryIds.length; start += 500) {
  const chunk = legacyEntryIds.slice(start, start + 500);
  const { data, error } = await supabase
    .from("dictionary_meanings")
    .select("entry_id")
    .eq("source", "wiktionary")
    .in("entry_id", chunk);
  if (error) throw error;
  (data || []).forEach((row) => covered.add(String(row.entry_id)));
}

const coverage = covered.size / legacyEntryIds.length;
console.log(JSON.stringify({
  legacyEntries: legacyEntryIds.length,
  wiktionaryCoveredLegacyEntries: covered.size,
  coverage,
  minCoverage,
  dryRun,
}, null, 2));

if (coverage < minCoverage) {
  console.error(`Aborting cleanup: Wiktionary coverage ${(coverage * 100).toFixed(1)}% is below required ${(minCoverage * 100).toFixed(1)}%.`);
  process.exit(2);
}

if (dryRun) {
  console.log("Dry run complete; no legacy meanings were deleted.");
  process.exit(0);
}

let deleted = 0;
const coveredIds = [...covered];
for (let start = 0; start < coveredIds.length; start += 250) {
  const chunk = coveredIds.slice(start, start + 250);
  const { data, error } = await supabase
    .from("dictionary_meanings")
    .delete()
    .eq("source", "one_cup_legacy")
    .in("entry_id", chunk)
    .select("id");
  if (error) throw error;
  deleted += (data || []).length;
}

console.log(`Deleted ${deleted.toLocaleString()} legacy meanings from Wiktionary-covered entries.`);
console.log("Dictionary entries and all user/deck/study records were preserved.");
