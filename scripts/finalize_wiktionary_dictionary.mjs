#!/usr/bin/env node

/**
 * Safely retire one_cup_legacy meanings after a Wiktionary import.
 *
 * Policy:
 *   - Dry-run is the default. Pass --apply to write.
 *   - Abort unless Wiktionary covers at least --min-coverage of legacy entries.
 *   - A referenced legacy meaning is remapped automatically ONLY when its lexical
 *     entry has exactly one Wiktionary meaning. We never guess among multiple senses.
 *   - Ambiguous referenced legacy meanings are kept and reported.
 *   - Unreferenced legacy meanings may be removed once their entry has Wiktionary
 *     coverage, regardless of how many Wiktionary senses exist.
 *   - dictionary_entries and user study/review history are never deleted.
 *
 * Usage:
 *   node scripts/finalize_wiktionary_dictionary.mjs
 *   node scripts/finalize_wiktionary_dictionary.mjs --min-coverage 0.98
 *   node scripts/finalize_wiktionary_dictionary.mjs --apply --min-coverage 0.98
 */

import { supabase } from "./_supabase.mjs";

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const apply = args.includes("--apply");
const minCoverage = Math.max(
  0,
  Math.min(1, Number(argValue("--min-coverage") || 0.95)),
);

const REFERENCE_TABLES = [
  "user_vocabulary",
  "vocabulary_deck_items",
  "vocabulary_study_cards",
  "vocabulary_review_events",
];

const { data: legacyRows, error: legacyError } = await supabase
  .from("dictionary_meanings")
  .select("id,entry_id,source_meaning_id,grammar_type,definition_en")
  .eq("source", "one_cup_legacy");
if (legacyError) throw legacyError;

if (!legacyRows?.length) {
  console.log("No legacy dictionary meanings remain.");
  process.exit(0);
}

const legacyEntryIds = [...new Set(legacyRows.map((row) => String(row.entry_id)))];
const wiktionaryByEntry = new Map();

for (let start = 0; start < legacyEntryIds.length; start += 400) {
  const chunk = legacyEntryIds.slice(start, start + 400);
  const { data, error } = await supabase
    .from("dictionary_meanings")
    .select("id,entry_id,source_meaning_id,grammar_type,definition_en,meaning_order")
    .eq("source", "wiktionary")
    .in("entry_id", chunk)
    .order("meaning_order", { ascending: true });
  if (error) throw error;

  for (const row of data || []) {
    const entryId = String(row.entry_id);
    if (!wiktionaryByEntry.has(entryId)) wiktionaryByEntry.set(entryId, []);
    wiktionaryByEntry.get(entryId).push(row);
  }
}

const coveredEntries = legacyEntryIds.filter((entryId) =>
  (wiktionaryByEntry.get(entryId) || []).length > 0,
);
const coverage = coveredEntries.length / legacyEntryIds.length;

const legacyIds = legacyRows.map((row) => String(row.id));
const refsByMeaning = new Map(
  legacyIds.map((id) => [id, Object.fromEntries([
    ...REFERENCE_TABLES.map((table) => [table, 0]),
    ["article_vocabulary", 0],
  ])]),
);

for (const table of REFERENCE_TABLES) {
  for (let start = 0; start < legacyIds.length; start += 400) {
    const chunk = legacyIds.slice(start, start + 400);
    const { data, error } = await supabase
      .from(table)
      .select("meaning_id")
      .in("meaning_id", chunk);
    if (error) throw error;
    for (const row of data || []) {
      if (!row.meaning_id) continue;
      const counts = refsByMeaning.get(String(row.meaning_id));
      if (counts) counts[table] += 1;
    }
  }
}

// article_vocabulary has a non-null meaning FK and meaning_id is part of its primary
// key. Do not auto-update it here: a replacement could collide with an existing
// article/sense pair. Any such reference keeps the legacy sense for editorial review.
for (let start = 0; start < legacyIds.length; start += 400) {
  const chunk = legacyIds.slice(start, start + 400);
  const { data, error } = await supabase
    .from("article_vocabulary")
    .select("meaning_id")
    .in("meaning_id", chunk);
  if (error) throw error;
  for (const row of data || []) {
    const counts = refsByMeaning.get(String(row.meaning_id));
    if (counts) counts.article_vocabulary += 1;
  }
}

const plan = {
  remap: [],
  deleteUnreferenced: [],
  ambiguousReferenced: [],
  uncovered: [],
  articleReferenced: [],
};

for (const legacy of legacyRows) {
  const legacyId = String(legacy.id);
  const entryId = String(legacy.entry_id);
  const candidates = wiktionaryByEntry.get(entryId) || [];
  const refs = refsByMeaning.get(legacyId) || {};
  const totalRefs = Object.values(refs).reduce((sum, count) => sum + Number(count || 0), 0);

  if (candidates.length === 0) {
    plan.uncovered.push({ legacy, refs });
    continue;
  }

  if ((refs.article_vocabulary || 0) > 0) {
    plan.articleReferenced.push({ legacy, refs, candidates });
    continue;
  }

  if (totalRefs === 0) {
    plan.deleteUnreferenced.push({ legacy, candidates });
    continue;
  }

  if (candidates.length === 1) {
    plan.remap.push({ legacy, target: candidates[0], refs });
    continue;
  }

  plan.ambiguousReferenced.push({ legacy, refs, candidates });
}

const summary = {
  legacyMeanings: legacyRows.length,
  legacyEntries: legacyEntryIds.length,
  wiktionaryCoveredLegacyEntries: coveredEntries.length,
  coverage,
  minCoverage,
  apply,
  safeReferencedRemaps: plan.remap.length,
  safeUnreferencedDeletes: plan.deleteUnreferenced.length,
  ambiguousReferencedKept: plan.ambiguousReferenced.length,
  articleReferencedKept: plan.articleReferenced.length,
  uncoveredKept: plan.uncovered.length,
  referenceCounts: Object.fromEntries(
    [...REFERENCE_TABLES, "article_vocabulary"].map((table) => [
      table,
      [...refsByMeaning.values()].reduce((sum, counts) => sum + (counts[table] || 0), 0),
    ]),
  ),
};

console.log(JSON.stringify(summary, null, 2));

if (plan.ambiguousReferenced.length) {
  console.log("\nAmbiguous referenced legacy meanings kept for review:");
  for (const item of plan.ambiguousReferenced.slice(0, 50)) {
    console.log(JSON.stringify({
      legacyMeaningId: item.legacy.id,
      entryId: item.legacy.entry_id,
      definition: item.legacy.definition_en,
      refs: item.refs,
      candidates: item.candidates.map((candidate) => ({
        id: candidate.id,
        grammarType: candidate.grammar_type,
        definition: candidate.definition_en,
      })),
    }));
  }
}

if (coverage < minCoverage) {
  console.error(
    `Aborting cleanup: Wiktionary coverage ${(coverage * 100).toFixed(1)}% is below required ${(minCoverage * 100).toFixed(1)}%.`,
  );
  process.exit(2);
}

if (!apply) {
  console.log("\nDry run complete. Re-run with --apply only after reviewing this report.");
  process.exit(0);
}

let remappedRows = 0;
for (const item of plan.remap) {
  const legacyId = String(item.legacy.id);
  const targetId = String(item.target.id);

  // Updates happen before deletion. If any unique constraint or unexpected schema
  // condition rejects the remap, the script throws and leaves the legacy meaning in
  // place; re-running after correction is safe.
  for (const table of REFERENCE_TABLES) {
    if (!(item.refs[table] > 0)) continue;
    const { data, error } = await supabase
      .from(table)
      .update({ meaning_id: targetId })
      .eq("meaning_id", legacyId)
      .select("meaning_id");
    if (error) throw error;
    remappedRows += (data || []).length;
  }
}

const deletableIds = [
  ...plan.remap.map((item) => String(item.legacy.id)),
  ...plan.deleteUnreferenced.map((item) => String(item.legacy.id)),
];

let deletedMeanings = 0;
for (let start = 0; start < deletableIds.length; start += 250) {
  const chunk = deletableIds.slice(start, start + 250);
  const { data, error } = await supabase
    .from("dictionary_meanings")
    .delete()
    .eq("source", "one_cup_legacy")
    .in("id", chunk)
    .select("id");
  if (error) throw error;
  deletedMeanings += (data || []).length;
}

console.log(JSON.stringify({ remappedRows, deletedMeanings }, null, 2));
console.log(
  "Cleanup complete. Ambiguous/article-linked legacy meanings and all uncovered entries were preserved.",
);
