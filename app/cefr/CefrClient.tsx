"use client";
import React from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { supabase, invokeFunction } from "../lib/supabase/client";

import "./cefr.css";

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

// Shared class strings (styled-components migration).
const secondaryTextClass = "text-[rgba(0,0,0,0.6)] text-[13px] mt-2";

const spinnerClass =
	"w-[18px] h-[18px] rounded-full border-2 border-[rgba(0,0,0,0.2)] border-t-[rgba(0,0,0,0.8)] animate-[cefr-spin_0.8s_linear_infinite]";

const levels: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const levelColors: Record<CefrLevel, string> = {
	A1: "#0f766e",
	A2: "#14532d",
	B1: "#854d0e",
	B2: "#7c2d12",
	C1: "#1f2937",
	C2: "#111827",
};

const createEmptyCounts = (): Record<CefrLevel, number> => ({
	A1: 0,
	A2: 0,
	B1: 0,
	B2: 0,
	C1: 0,
	C2: 0,
});

const createEmptyWordsByLevel = (): Record<CefrLevel, { word: string; freq: number; source?: string }[]> => ({
	A1: [],
	A2: [],
	B1: [],
	B2: [],
	C1: [],
	C2: [],
});

export default function CefrClient() {
	const [text, setText] = React.useState("");
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [batchId, setBatchId] = React.useState<string | null>(null);
	const [status, setStatus] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [counts, setCounts] = React.useState<Record<CefrLevel, number>>(() => createEmptyCounts());
	const [total, setTotal] = React.useState(0);
	const [uniqueCounts, setUniqueCounts] = React.useState<Record<CefrLevel, number>>(() => createEmptyCounts());
	const [wordsByLevel, setWordsByLevel] = React.useState<Record<CefrLevel, { word: string; freq: number; source?: string }[]>>(() => createEmptyWordsByLevel());
	const [labeledWords, setLabeledWords] = React.useState<Array<{ word: string; level: CefrLevel; source?: string; freq?: number }>>([]);
	const [candidateWordCount, setCandidateWordCount] = React.useState(0);

	const handleSubmit = React.useCallback(async () => {
		if (!text.trim()) return;

		setError(null);
		const stripPuncPreserveCase = (raw: string) => raw.replace(/^[^A-Za-z]+/g, "").replace(/[^A-Za-z]+$/g, "");
		const normalizeWord = (raw: string) => raw.toLowerCase().replace(/^[^a-z]+/g, "").replace(/[^a-z]+$/g, "");
		const freqMap = new Map<string, { freq: number; hasCapital: boolean }>();
		for (const token of text.split(/\s+/g)) {
			const core = stripPuncPreserveCase(token);
			const w = normalizeWord(core);
			if (!w) continue;
			if (!/^[a-z]+$/.test(w)) continue;
			const hasCap = /[A-Z]/.test(core);
			const prev = freqMap.get(w);
			if (prev) freqMap.set(w, { freq: prev.freq + 1, hasCapital: prev.hasCapital || hasCap });
			else freqMap.set(w, { freq: 1, hasCapital: hasCap });
		}
		if (freqMap.size === 0) {
			setCandidateWordCount(0);
			setError("No valid words found in text.");
			return;
		}

		let entries = Array.from(freqMap.entries()).map(([word, v]) => ({ word, freq: v.freq, hasCapital: v.hasCapital }));
		entries.sort((a, b) => b.freq - a.freq);
		entries = entries.slice(0, 5000);
		setCandidateWordCount(entries.length);

		const payload = { words: entries } as { words: Array<{ word: string; freq: number; hasCapital: boolean }> };
		const payloadJson = JSON.stringify(payload);
		const payloadBytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(payloadJson).length : payloadJson.length;
		const MAX_BYTES = 450 * 1024; // stay well under 500KB CF limit
		if (payloadBytes > MAX_BYTES) {
			setError("Unique word list is too large. Please shorten the text and try again.");
			return;
		}

		setIsSubmitting(true);
		setCounts(createEmptyCounts());
		setUniqueCounts(createEmptyCounts());
		setWordsByLevel(createEmptyWordsByLevel());
		setLabeledWords([]);
		setStatus(null);
		setTotal(0);
		setBatchId(null);
		try {
			const data = await invokeFunction<any>("cefr", { action: "start", words: entries });
			setBatchId(data?.batchId || data?.runId || null);
			setStatus("in_progress");
		} catch (e: any) {
			console.error(e);
			setError(e?.message ? String(e.message) : "Unexpected error while creating batch");
		} finally {
			setIsSubmitting(false);
		}
	}, [text]);

	const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key !== "Enter") return;
		const nativeEvent: any = event.nativeEvent;
		if (nativeEvent?.isComposing) return;
		if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
		event.preventDefault();
		if (isSubmitting) return;
		handleSubmit();
	}, [handleSubmit, isSubmitting]);

	// Subscribe to run status when batchId exists (Supabase Realtime + initial fetch)
	React.useEffect(() => {
		if (!batchId) return;

		// Map a snake_case cefr_runs row into the camelCase shape this handler expects.
		const applyRow = (row: any) => {
			if (!row) return;
			const data: any = {
				status: row.status,
				total: row.total,
				counts: row.counts,
				uniqueCounts: row.unique_counts,
				wordsByLevel: row.words_by_level,
				existing: row.existing,
				acronyms: row.acronyms,
			};
			const s: string = data.status || "in_progress";
			setStatus(s);
			if (data.counts && data.wordsByLevel) {
				setCounts(data.counts);
				setWordsByLevel(data.wordsByLevel);
				if (typeof data.total === "number") setTotal(data.total);
				if (data.uniqueCounts) {
					setUniqueCounts(data.uniqueCounts);
					const uniqueTotal = levels.reduce((sum, lvl) => sum + Number(data.uniqueCounts?.[lvl] || 0), 0);
					if (uniqueTotal > 0) setCandidateWordCount(uniqueTotal);
				} else {
					setUniqueCounts(createEmptyCounts());
				}
				const flat: Array<{ word: string; level: CefrLevel; source?: string; freq?: number }> = [];
				for (const lvl of levels) {
					for (const item of (data.wordsByLevel?.[lvl] || [])) {
						flat.push({ word: item.word, level: lvl, source: (item as any).source, freq: item.freq });
					}
				}
				setLabeledWords(flat.sort((a,b) => (a.level > b.level ? 1 : a.level < b.level ? -1 : 0)));
				return;
			}

			// Derive interim counts from existing + acronyms while batch is running
			const interimWordsByLevel: Record<CefrLevel, { word: string; freq: number; source?: string }[]> = { A1: [], A2: [], B1: [], B2: [], C1: [], C2: [] };
			const interimCounts: Record<CefrLevel, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
			let interimTotal = 0;
			for (const src of ["existing", "acronyms"]) {
				for (const it of (data?.[src] || [])) {
					const lvl = String(it.level || "").toUpperCase();
					if (!(lvl in interimCounts)) continue;
					const level = lvl as CefrLevel;
					const freq = Number(it.freq) || 0;
					interimCounts[level] += freq;
					interimTotal += freq;
					interimWordsByLevel[level].push({ word: it.word, freq, source: src });
				}
			}
			const interimUniqueCounts: Record<CefrLevel, number> = {
				A1: interimWordsByLevel.A1.length,
				A2: interimWordsByLevel.A2.length,
				B1: interimWordsByLevel.B1.length,
				B2: interimWordsByLevel.B2.length,
				C1: interimWordsByLevel.C1.length,
				C2: interimWordsByLevel.C2.length,
			};
			setCounts(interimCounts);
			setWordsByLevel(interimWordsByLevel);
			setUniqueCounts(interimUniqueCounts);
			setTotal(interimTotal);
			const interimUniqueTotal = levels.reduce((sum, lvl) => sum + interimUniqueCounts[lvl], 0);
			if (interimUniqueTotal > 0) setCandidateWordCount(interimUniqueTotal);
			const flat: Array<{ word: string; level: CefrLevel; source?: string; freq?: number }> = [];
			for (const lvl of levels) {
				for (const item of interimWordsByLevel[lvl] || []) {
					flat.push({ word: item.word, level: lvl, source: (item as any).source, freq: item.freq });
				}
			}
			setLabeledWords(flat.sort((a,b) => (a.level > b.level ? 1 : a.level < b.level ? -1 : 0)));
		};

		let cancelled = false;

		// Initial fetch so current state is reflected immediately.
		supabase
			.from("cefr_runs")
			.select("*")
			.eq("id", batchId)
			.maybeSingle()
			.then(({ data }) => {
				if (!cancelled) applyRow(data);
			});

		// Live updates via Postgres Realtime on this run row.
		const channel = supabase
			.channel(`cefr_runs:${batchId}`)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "cefr_runs", filter: `id=eq.${batchId}` },
				(payload) => {
					if (!cancelled) applyRow(payload.new);
				}
			)
			.subscribe();

		return () => {
			cancelled = true;
			supabase.removeChannel(channel);
		};
	}, [batchId]);

	const maxCount = Math.max(1, ...levels.map(l => counts[l]));
	const isTerminal = status === "completed" || status === "failed" || status === "cancelled" || status === "expired";
	const isLoading = isSubmitting || (!!batchId && !isTerminal);

	return (
		<div className="max-w-page mx-auto py-6 px-4 text-[#111]">
			<h1 className="text-[28px] font-extrabold mx-0 mt-0 mb-4">CEFR Level Classifier</h1>
			<textarea
				className="w-full min-h-[160px] p-[14px] rounded-[12px] border border-[rgba(0,0,0,0.12)] bg-white text-[#111] resize-y outline-none text-[14px] leading-[1.5] shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]"
				placeholder="Paste or type your text here..."
				value={text}
				onChange={e => setText(e.target.value)}
				onKeyDown={handleKeyDown}
			/>
			<div className="flex items-center gap-2 mt-[10px] text-[rgba(0,0,0,0.62)] text-[13px]">
				<InformationCircleIcon
					className="w-[18px] h-[18px] shrink-0 text-[rgba(0,0,0,0.45)]"
					aria-hidden="true"
				/>
				<span>
					Press Enter to classify with the CEFR model (Shift+Enter for a newline).{" "}
					{candidateWordCount > 0
						? `Batching ${candidateWordCount.toLocaleString()} unique words.`
						: "We automatically deduplicate words before sending."}
				</span>
			</div>
			<div className="flex gap-3 mt-3">
				<button
					className="relative py-3 px-[18px] rounded-[14px] border border-[rgba(0,0,0,0.15)] cursor-pointer bg-[linear-gradient(135deg,#f9fafb,#e5e7eb)] text-[#111] font-bold shadow-[0_6px_14px_rgba(0,0,0,0.08),inset_0_-2px_6px_rgba(255,255,255,0.7)] [transition:transform_0.08s_ease,box-shadow_0.2s_ease,background_0.2s_ease] active:[transform:translateY(1px)] active:shadow-[0_3px_10px_rgba(0,0,0,0.06)] disabled:opacity-60"
					onClick={handleSubmit}
					disabled={isSubmitting || !text.trim()}
				>
					{isSubmitting ? "Submitting..." : "Classify Words"}
				</button>
				{isLoading && <div className={spinnerClass} role="status" aria-label="loading" />}
				{status && <div className={secondaryTextClass}>Status: {status}</div>}
			</div>
			{error && <div className={secondaryTextClass} style={{ color: "#b91c1c" }}>{error}</div>}

			<div className="mt-6 p-4 rounded-[16px] bg-[linear-gradient(180deg,#ffffff,#f8fafc)] border border-[rgba(0,0,0,0.08)] shadow-[0_8px_26px_rgba(0,0,0,0.06)]">
				<div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
					<div style={{ fontWeight: 700 }}>Total weighted words: {total}</div>
					{levels.map(l => (
						<div key={`uc-${l}`} style={{ color: "#374151", fontSize: 13 }}>
							<strong>{l}</strong>: {uniqueCounts[l]} unique
						</div>
					))}
				</div>
				{isLoading && (
					<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, color: "#111" }}>
						<div className={spinnerClass} />
						<div>Processing batch… This may take a while.</div>
					</div>
				)}
				<div className="grid grid-cols-[repeat(6,1fr)] gap-[14px] items-end h-[260px]">
					{levels.map(level => {
						const value = counts[level] || 0;
						const pct = total > 0 ? Math.round((value / total) * 100) : 0;
						const barHeight = (value / maxCount) * 180; // px for rect
						return (
							<div className="flex flex-col items-center gap-2" key={level}>
								<svg className="w-full h-[200px]" viewBox="0 0 100 200" preserveAspectRatio="none">
									<defs>
										<linearGradient id={`grad-${level}`} x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stopColor={levelColors[level]} stopOpacity="0.95" />
											<stop offset="100%" stopColor={levelColors[level]} stopOpacity="0.55" />
										</linearGradient>
									</defs>
									<rect x="20" width="60" y={200 - barHeight} height={barHeight} rx="10" fill={`url(#grad-${level})`} />
								</svg>
								<div className="font-extrabold text-[#111]">{value} ({pct}%)</div>
								<div className="font-bold text-[rgba(0,0,0,0.9)]">{level}</div>
							</div>
						);
					})}
				</div>
				{!isLoading && (status === "completed") && (
					<div style={{ marginTop: 16 }}>
						{levels.map(l => {
							const list = wordsByLevel[l] || [];
							if (!list.length) return null;
							const top = [...list].sort((a,b) => b.freq - a.freq).slice(0, 20);
							return (
								<details key={`words-${l}`} style={{ marginBottom: 8 }}>
									<summary style={{ cursor: "pointer", fontWeight: 700, color: "#111" }}>{l} top words (showing {top.length} of {list.length})</summary>
									<div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", color: "#111" }}>
										{top.map(item => (
											<span key={`${l}-${item.word}`} style={{ padding: "4px 8px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, background: "#fff" }}>
												{item.word} ×{item.freq}
											</span>
										))}
									</div>
								</details>
							);
						})}
					</div>
				)}
			</div>
			{!isLoading && (status === "completed") && (
				<div style={{ marginTop: 16 }}>
					<strong>Per-word labels</strong>
					<div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
						{labeledWords.slice(0, 300).map((w) => (
							<div key={`${w.level}-${w.word}`} style={{ padding: "6px 8px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, background: "#fff", color: "#111", display: "flex", justifyContent: "space-between", gap: 8 }}>
								<span style={{ fontWeight: 700 }}>{w.word}</span>
								<span style={{ opacity: 0.7 }}>{w.level}{w.source ? ` · ${w.source}` : ""}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}


