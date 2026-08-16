// Supabase Edge Function: cefr
// Port of the Firebase Cloud Functions `startCefrBatch` (HTTP) and
// `pollCefrBatches` (scheduled) from functions/src/cefr.ts.
//
// Routed by POST body { action: "start" | "poll" }:
//   - "start": accept text OR a compact words[] payload, dedup+normalize, split
//     into acronyms (auto A1) / already-known (cache hit) / to-classify, write
//     the cefr table, and either finish immediately or create an OpenAI batch.
//   - "poll": retrieve in_progress/queued cefr_runs batches, persist completed
//     classifications into cefr, and roll up the run for the UI.
//
// Firestore -> Postgres notes:
//   * `cefr` (PK word): FieldValue.increment(freq) is emulated by reading the
//     current freq and writing the sum (service-role client bypasses RLS).
//   * `cefr_runs` (PK id): stored as jsonb columns matching supabase_schema.sql.
//   * inputPath / gs:// storage reads are dropped (no Firebase Storage); callers
//     pass `text` or `words[]` directly.
//   * OpenAI key: NEXT_OPENAI_API_KEY. Model override: CEFR_MODEL_ID.

import { preflight, json } from "../_shared/cors.ts";
import { admin, env } from "../_shared/db.ts";
import OpenAI, { toFile } from "npm:openai";

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const DEFAULT_CEFR_MODEL =
  "ft:gpt-4.1-nano-2025-04-14:native-pt:full-dataset:CFH7oyMj";

// Reference `env` so the shared import is exercised (throws only if misused).
const _envRef = env;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^a-z]+/g, "")
    .replace(/[^a-z]+$/g, "");
}

function stripPuncPreserveCase(raw: string): string {
  return raw.replace(/^[^A-Za-z]+/g, "").replace(/[^A-Za-z]+$/g, "");
}

function extractLevel(text: string): CefrLevel | null {
  const m = String(text || "").toUpperCase().match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  return (m?.[1] as CefrLevel) || null;
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

// -----------------------------------------------------------------------------
// cefr table writers (emulate FieldValue.increment via read-then-write)
// -----------------------------------------------------------------------------
type CefrWrite = {
  word: string;
  level?: CefrLevel;
  source?: string;
  freqDelta: number;
  setFirstSeen: boolean;
};

async function upsertCefrWords(
  db: ReturnType<typeof admin>,
  writes: CefrWrite[],
): Promise<void> {
  if (!writes.length) return;
  const words = writes.map((w) => w.word);

  // Read existing freq/first_seen_at for these words (chunk to keep IN() sane).
  const existing = new Map<string, { freq: number | null; first_seen_at: string | null }>();
  const chunk = 200;
  for (let i = 0; i < words.length; i += chunk) {
    const slice = words.slice(i, i + chunk);
    const { data, error } = await db
      .from("cefr")
      .select("word, freq, first_seen_at")
      .in("word", slice);
    if (error) throw error;
    for (const row of data ?? []) {
      existing.set(row.word, { freq: row.freq, first_seen_at: row.first_seen_at });
    }
  }

  const ts = nowIso();
  const rows = writes.map((w) => {
    const prev = existing.get(w.word);
    const prevFreq = prev?.freq ?? 0;
    const row: Record<string, unknown> = {
      word: w.word,
      freq: prevFreq + w.freqDelta,
      updated_at: ts,
    };
    if (w.level) row.level = w.level;
    if (w.source) row.source = w.source;
    // Preserve first_seen_at if present; otherwise set it when requested.
    if (prev?.first_seen_at) {
      row.first_seen_at = prev.first_seen_at;
    } else if (w.setFirstSeen) {
      row.first_seen_at = ts;
    }
    return row;
  });

  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const { error } = await db.from("cefr").upsert(slice, { onConflict: "word" });
    if (error) throw error;
  }
}

// -----------------------------------------------------------------------------
// action: start
// -----------------------------------------------------------------------------
async function handleStart(req: Request, body: any): Promise<Response> {
  const wordsPayloadIn = Array.isArray(body?.words)
    ? (body.words as Array<{ word: string; freq?: number; hasCapital?: boolean }>)
    : null;
  const text = typeof body?.text === "string" ? String(body.text) : "";

  if (!wordsPayloadIn && !text.trim()) {
    return json(req, { error: "Missing text or words" }, 400);
  }

  if (!wordsPayloadIn) {
    const textSizeBytes = byteLength(text);
    const wordCount = text.trim().split(/\s+/).length;
    if (textSizeBytes > 500 * 1024) {
      return json(
        req,
        { error: `Text too large (${Math.round(textSizeBytes / 1024)}KB). Maximum size is 500KB.` },
        413,
      );
    }
    if (wordCount > 10000) {
      return json(
        req,
        { error: `Text has too many words (${wordCount}). Maximum is 10,000 words.` },
        413,
      );
    }
  } else {
    if (wordsPayloadIn.length > 20000) {
      return json(
        req,
        { error: `Too many tokens (${wordsPayloadIn.length}). Maximum is 20,000 tokens.` },
        413,
      );
    }
  }

  const apiKey = Deno.env.get("NEXT_OPENAI_API_KEY");
  if (!apiKey) {
    return json(req, { error: "Missing OpenAI key. Set NEXT_OPENAI_API_KEY." }, 500);
  }

  const db = admin();

  // Build frequency map.
  const freqMap = new Map<string, { freq: number; hasCapital: boolean }>();
  if (wordsPayloadIn) {
    for (const item of wordsPayloadIn) {
      if (!item || typeof item.word !== "string") continue;
      const core = item.word;
      const w = normalizeWord(core);
      if (!w) continue;
      if (!/^[a-z]+$/.test(w)) continue;
      const hasCap =
        typeof item.hasCapital === "boolean" ? item.hasCapital : /[A-Z]/.test(core);
      const addFreq = Number.isFinite(item.freq as number) ? Number(item.freq) : 1;
      const prev = freqMap.get(w);
      if (prev) freqMap.set(w, { freq: prev.freq + addFreq, hasCapital: prev.hasCapital || hasCap });
      else freqMap.set(w, { freq: addFreq, hasCapital: hasCap });
    }
  } else {
    const tokens = text.split(/\s+/g);
    for (const t of tokens) {
      const core = stripPuncPreserveCase(t);
      const w = normalizeWord(core);
      if (!w) continue;
      if (!/^[a-z]+$/.test(w)) continue;
      const hasCap = /[A-Z]/.test(core);
      const prev = freqMap.get(w);
      if (prev) freqMap.set(w, { freq: prev.freq + 1, hasCapital: prev.hasCapital || hasCap });
      else freqMap.set(w, { freq: 1, hasCapital: hasCap });
    }
  }

  if (freqMap.size === 0) {
    return json(req, { error: "No valid words" }, 400);
  }

  const entries = Array.from(freqMap.entries())
    .sort((a, b) => b[1].freq - a[1].freq)
    .slice(0, 5000);
  const candidateIds = entries.map(([w]) => w);

  // Existing check (chunked IN queries).
  const existing = new Set<string>();
  const existingDocs = new Map<string, { level: CefrLevel; source?: string }>();
  const chunkSize = 200;
  for (let i = 0; i < candidateIds.length; i += chunkSize) {
    const slice = candidateIds.slice(i, i + chunkSize);
    if (!slice.length) continue;
    const { data, error } = await db
      .from("cefr")
      .select("word, level, source")
      .in("word", slice);
    if (error) throw error;
    for (const row of data ?? []) {
      const lvl = String(row.level || "").toUpperCase();
      if (LEVELS.includes(lvl as CefrLevel)) {
        existing.add(row.word);
        existingDocs.set(row.word, { level: lvl as CefrLevel, source: row.source ?? undefined });
      }
    }
  }

  const acronyms: Array<{ word: string; level: CefrLevel; freq: number; source: string }> = [];
  const toClassify: Array<{ word: string; freq: number }> = [];
  for (const [w, info] of entries) {
    if (existing.has(w)) continue;
    if (info.hasCapital) acronyms.push({ word: w, level: "A1", freq: info.freq, source: "acronym" });
    else toClassify.push({ word: w, freq: info.freq });
  }

  // Write acronyms now (level A1, source "acronym", increment freq).
  if (acronyms.length) {
    await upsertCefrWords(
      db,
      acronyms.map((a) => ({
        word: a.word,
        level: a.level,
        source: a.source,
        freqDelta: a.freq,
        setFirstSeen: true,
      })),
    );
  }

  // Build existing labeled list, then bump freq/updated_at on cache hits.
  const existingLabeled: Array<{ word: string; level: CefrLevel; freq: number; source?: string }> = [];
  for (const [word, info] of entries) {
    const cached = existingDocs.get(word);
    if (!cached) continue;
    existingLabeled.push({ word, level: cached.level, freq: info.freq, source: cached.source });
  }
  if (existingLabeled.length) {
    await upsertCefrWords(
      db,
      existingLabeled.map((item) => ({
        word: item.word,
        freqDelta: item.freq,
        setFirstSeen: false,
      })),
    );
  }

  // If nothing to classify, persist a completed run doc immediately.
  if (toClassify.length === 0) {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const wordsByLevel: Record<CefrLevel, { word: string; freq: number; source?: string }[]> = {
      A1: [], A2: [], B1: [], B2: [], C1: [], C2: [],
    };
    const counts: Record<CefrLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
    let total = 0;
    const add = (arr: any[], src: string) => {
      for (const it of arr || []) {
        const lvl = (it.level || "").toUpperCase();
        if (!(lvl in counts)) continue;
        counts[lvl as CefrLevel] += it.freq || 0;
        total += it.freq || 0;
        wordsByLevel[lvl as CefrLevel].push({ word: it.word, freq: it.freq || 0, source: it.source || src });
      }
    };
    add(existingLabeled, "db");
    add(acronyms, "acronym");
    const uniqueCounts: Record<CefrLevel, number> = {
      A1: wordsByLevel.A1.length, A2: wordsByLevel.A2.length, B1: wordsByLevel.B1.length,
      B2: wordsByLevel.B2.length, C1: wordsByLevel.C1.length, C2: wordsByLevel.C2.length,
    };

    const { error } = await db.from("cefr_runs").upsert(
      {
        id: runId,
        status: "completed",
        counts,
        total,
        unique_counts: uniqueCounts,
        words_by_level: wordsByLevel,
        existing: existingLabeled,
        acronyms,
        created_at: nowIso(),
      },
      { onConflict: "id" },
    );
    if (error) throw error;

    return json(req, {
      batchId: null,
      runId,
      addedAcronyms: acronyms.length,
      alreadyKnown: existing.size,
    });
  }

  // Build Batch JSONL with a byte-size guard to avoid OpenAI 413.
  const openai = new OpenAI({ apiKey });
  const model =
    (Deno.env.get("CEFR_MODEL_ID") && Deno.env.get("CEFR_MODEL_ID")!.trim()) ||
    DEFAULT_CEFR_MODEL;

  const makeLine = (word: string, freq: number) =>
    JSON.stringify({
      custom_id: `w=${encodeURIComponent(word)}|f=${freq}`,
      method: "POST",
      url: "/v1/responses",
      body: {
        model,
        input: `CEFR for "${word}"? Answer one of: A1,A2,B1,B2,C1,C2. Return label only.`,
        max_output_tokens: 1,
        temperature: 0,
      },
    });

  let lines = toClassify.map(({ word, freq }) => makeLine(word, freq));
  let jsonl = lines.join("\n");
  const MAX_BYTES = Number(Deno.env.get("CEFR_BATCH_MAX_BYTES") || 512 * 1024);
  let sizeBytes = byteLength(jsonl);
  if (sizeBytes > MAX_BYTES && lines.length > 0) {
    const avgPerLine = Math.max(64, Math.floor(sizeBytes / lines.length));
    const allowed = Math.max(1, Math.floor(MAX_BYTES / avgPerLine));
    lines = lines.slice(0, allowed);
    jsonl = lines.join("\n");
    sizeBytes = byteLength(jsonl);
  }

  const file = await openai.files.create({
    file: await toFile(new TextEncoder().encode(jsonl), "cefr.jsonl"),
    purpose: "batch",
  });
  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: "/v1/responses",
    completion_window: "24h",
    metadata: { feature: "cefr-word-classification" },
  });

  const { error } = await db.from("cefr_runs").upsert(
    {
      id: batch.id,
      created_at: nowIso(),
      status: "in_progress",
      existing: existingLabeled,
      acronyms: acronyms.map((a) => ({ word: a.word, level: a.level, freq: a.freq, source: a.source })),
      pending: toClassify,
    },
    { onConflict: "id" },
  );
  if (error) throw error;

  return json(req, {
    batchId: batch.id,
    queued: lines.length,
    addedAcronyms: acronyms.length,
  });
}

// -----------------------------------------------------------------------------
// action: poll
// -----------------------------------------------------------------------------
async function handlePoll(req: Request): Promise<Response> {
  const apiKey = Deno.env.get("NEXT_OPENAI_API_KEY");
  if (!apiKey) {
    return json(req, { error: "Missing OpenAI key. Set NEXT_OPENAI_API_KEY." }, 500);
  }
  const openai = new OpenAI({ apiKey });
  const db = admin();

  const { data: runs, error: runsErr } = await db
    .from("cefr_runs")
    .select("id, existing, acronyms")
    .in("status", ["in_progress", "queued"])
    .limit(10);
  if (runsErr) throw runsErr;

  const processed: string[] = [];

  for (const runRow of runs ?? []) {
    const id = runRow.id as string;
    try {
      const batch = await openai.batches.retrieve(id);
      if (batch.status !== "completed") continue;

      const words: Array<{ word: string; level: CefrLevel; freq: number; source: string }> = [];
      if (batch.output_file_id) {
        const content = await openai.files.content(batch.output_file_id);
        const raw = await content.text();
        const outLines = raw.split(/\n+/g).filter(Boolean);
        for (const line of outLines) {
          let parsed: any;
          try {
            parsed = JSON.parse(line);
          } catch {
            continue;
          }
          const bodyText =
            parsed?.response?.body?.output?.[0]?.content?.[0]?.text ||
            parsed?.response?.body?.choices?.[0]?.message?.content ||
            parsed?.response?.body?.content ||
            "";
          const cid: string = parsed?.custom_id || "";
          const m = cid.split("|");
          const w = decodeURIComponent((m.find((p: string) => p.startsWith("w=")) || "").slice(2));
          const f = Number((m.find((p: string) => p.startsWith("f=")) || "").slice(2));
          if (!w || !Number.isFinite(f)) continue;
          const lvl = extractLevel(String(bodyText));
          if (!lvl) continue;
          words.push({ word: w, level: lvl, freq: f, source: "batch" });
        }
      }

      // Persist inferred classifications (source "inference", increment freq).
      if (words.length) {
        await upsertCefrWords(
          db,
          words.map(({ word, level, freq }) => ({
            word,
            level,
            source: "inference",
            freqDelta: freq,
            setFirstSeen: true,
          })),
        );
      }

      // Roll up run context for the UI.
      const wordsByLevel: Record<CefrLevel, { word: string; freq: number; source?: string }[]> = {
        A1: [], A2: [], B1: [], B2: [], C1: [], C2: [],
      };
      const counts: Record<CefrLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
      let total = 0;
      const add = (arr: any[], src: string) => {
        for (const it of arr || []) {
          const lvl = (it.level || "").toUpperCase();
          if (!(lvl in counts)) continue;
          counts[lvl as CefrLevel] += it.freq || 0;
          total += it.freq || 0;
          wordsByLevel[lvl as CefrLevel].push({ word: it.word, freq: it.freq || 0, source: it.source || src });
        }
      };
      add((runRow.existing as any[]) || [], "db");
      add((runRow.acronyms as any[]) || [], "acronym");
      add(words, "batch");
      const uniqueCounts: Record<CefrLevel, number> = {
        A1: wordsByLevel.A1.length, A2: wordsByLevel.A2.length, B1: wordsByLevel.B1.length,
        B2: wordsByLevel.B2.length, C1: wordsByLevel.C1.length, C2: wordsByLevel.C2.length,
      };

      const { error } = await db
        .from("cefr_runs")
        .update({
          status: "completed",
          counts,
          total,
          unique_counts: uniqueCounts,
          words_by_level: wordsByLevel,
        })
        .eq("id", id);
      if (error) throw error;

      processed.push(id);
    } catch (e) {
      console.error("[pollCefrBatches]", id, e);
    }
  }

  return json(req, { polled: (runs ?? []).length, completed: processed });
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  let body: any = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const action = typeof body?.action === "string" ? body.action : "start";

  try {
    if (action === "poll") {
      return await handlePoll(req);
    }
    if (action === "start") {
      return await handleStart(req, body);
    }
    return json(req, { error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[cefr]", action, err);
    return json(req, { error: err?.message || "Internal error" }, 500);
  }
});
