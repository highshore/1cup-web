#!/usr/bin/env node

// Prints the committed state of the shared Wiktextract dictionary. This is
// intentionally service-role only; it is an operational import verification
// tool, not a customer-facing endpoint.
import { supabase } from "./_supabase.mjs";

const { data, error } = await supabase.rpc("get_wiktionary_import_audit");
if (error) throw error;

const metrics = Object.fromEntries(
  (data || []).map((row) => [row.metric, Number(row.value)])
);

if (metrics.duplicate_wiktionary_source_keys !== 0) {
  throw new Error(
    `Duplicate Wiktionary source keys detected: ${metrics.duplicate_wiktionary_source_keys}`
  );
}
if (metrics.legacy_entries_remaining !== 0 || metrics.legacy_meanings_remaining !== 0) {
  throw new Error("Legacy vocabulary remains after the clean-start reset.");
}
if (metrics.saved_vocabulary_records !== 0 || metrics.deck_records !== 0 || metrics.study_card_records !== 0) {
  throw new Error("Personal vocabulary, decks, or study history remains after the reset.");
}

console.log(JSON.stringify(metrics, null, 2));
