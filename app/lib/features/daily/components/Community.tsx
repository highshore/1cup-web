"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DailyApiError, dailyApi } from "../api";
import { dailyCopy } from "../copy";
import { cn, Emoji } from "./DailyUI";

// The lesson page around the lesson (server/community.ts): the quiz's crowd numbers,
// 함께 쓰는 문장 with ☕, yesterday's 통역사 PICK, and the reader's streak.

const copy = dailyCopy.community;
const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), text);

export interface QuizStats {
  total: number;
  shown: boolean;
  correctRate?: number;
  topWrong?: { option: string; rate: number } | null;
}

interface Sentence {
  id: string;
  body: string;
  displayName: string | null;
  cups: number;
  cupped: boolean;
  mine: boolean;
  picked: boolean;
  hidden: boolean;
}

interface Progress {
  streak: number;
  expressions: number;
}

export interface Community {
  canWrite: boolean;
  signedIn: boolean;
  sentences: Sentence[];
  mine: Sentence | null;
  together: number | null;
  quiz: { answered: number | null; stats: QuizStats | null };
  yesterdayPick: { body: string; displayName: string | null; expression: string } | null;
  progress: Progress | null;
}

export function useLessonCommunity(token: string) {
  const [data, setData] = useState<Community | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await dailyApi<Community>("lesson-community", { token }));
    } catch {
      // The lesson itself never depends on this; the extras just stay hidden.
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  // Records the first answer. Returns nothing for readers who cannot answer for this
  // lesson (not signed in, someone else's link): the quiz still works for them.
  const answer = useCallback(
    async (choice: number) => {
      if (!data?.canWrite) return;
      try {
        const result = await dailyApi<{ stats: QuizStats | null; progress: Progress }>("quiz-answer", { token, choice });
        setData((prev) => (prev ? { ...prev, quiz: { answered: choice, stats: result.stats }, progress: result.progress } : prev));
      } catch {
        // Not recorded; the page still shows the answer.
      }
    },
    [data?.canWrite, token],
  );

  return { data, reload: load, answer };
}

export function QuizCrowd({ stats }: { stats: QuizStats | null }) {
  if (!stats) return null;
  if (!stats.shown) {
    return <p className="mt-3 text-[0.85rem] font-semibold text-white/60">{fill(copy.quizFew, { min: 10 })}</p>;
  }
  return (
    <div className="mt-3 rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-[0.95rem] font-black">{fill(copy.quizStats, { total: stats.total, rate: stats.correctRate ?? 0 })}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-[#f47a4a]" style={{ width: `${stats.correctRate ?? 0}%` }} />
      </div>
      {stats.topWrong && (
        <p className="mt-2 text-[0.85rem] font-semibold text-white/70">
          {fill(copy.quizTopWrong, { option: stats.topWrong.option, rate: stats.topWrong.rate })}
        </p>
      )}
    </div>
  );
}

export function YesterdayPick({ pick }: { pick: Community["yesterdayPick"] }) {
  if (!pick) return null;
  return (
    <section className="rounded-[28px] bg-[#050505] p-6 text-white">
      <p className="flex items-center gap-2 text-[1rem] font-black">
        <Emoji className="text-[1.4rem]">🏆</Emoji>
        {copy.pickTitle}
        <span className="text-[0.8rem] font-bold text-white/50">· {pick.expression}</span>
      </p>
      <p className="mt-3 text-[1.15rem] font-bold leading-snug">&ldquo;{pick.body}&rdquo;</p>
      <p className="mt-2 text-[0.85rem] font-semibold text-white/60">— {pick.displayName ?? copy.anonymous}</p>
    </section>
  );
}

function Composer({ token, expression, mine, onSaved }: { token: string; expression: string; mine: Sentence | null; onSaved: () => Promise<void> }) {
  const [body, setBody] = useState(mine?.body ?? "");
  const [name, setName] = useState(mine?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const run = async (action: "sentence-save" | "sentence-delete") => {
    if (action === "sentence-delete" && !window.confirm(copy.removeConfirm)) return;
    setBusy(true);
    setMessage("");
    try {
      await dailyApi(action, { token, body, displayName: name });
      if (action === "sentence-delete") {
        setBody("");
        setName("");
      } else setMessage(copy.posted);
      await onSaved();
    } catch (e) {
      setMessage(e instanceof DailyApiError && e.message ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-4">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value.slice(0, 200))}
        placeholder={fill(copy.placeholder, { expression })}
        rows={2}
        lang="en"
        className="w-full resize-none rounded-xl bg-[#f5f5f4] p-3 text-[1rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[0.8rem] font-bold text-[#64748b]">{copy.nameLabel}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 12))}
            placeholder={copy.namePlaceholder}
            className="h-10 min-w-0 flex-1 rounded-xl bg-[#f5f5f4] px-3 text-[0.9rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]"
          />
        </label>
        {mine && (
          <button type="button" disabled={busy} onClick={() => run("sentence-delete")} className="h-10 rounded-xl px-3 text-[0.88rem] font-bold text-[#64748b]">
            {copy.remove}
          </button>
        )}
        <button
          type="button"
          disabled={busy || body.trim().length < 2 || (mine?.body === body.trim() && (mine?.displayName ?? "") === name.trim())}
          onClick={() => run("sentence-save")}
          className="h-10 rounded-xl bg-[#050505] px-4 text-[0.9rem] font-black text-white disabled:opacity-35"
        >
          {mine ? copy.update : copy.post}
        </button>
      </div>
      {message && (
        <p role="status" className="mt-2 text-[0.85rem] font-semibold text-[#475569]">
          {message}
        </p>
      )}
    </div>
  );
}

export function SentenceWall({ token, expression, data, reload }: { token: string; expression: string; data: Community; reload: () => Promise<void> }) {
  const [pending, setPending] = useState<string | null>(null);

  const cup = async (id: string) => {
    setPending(id);
    try {
      await dailyApi("sentence-cup", { sentenceId: id });
      await reload();
    } catch {
      // Left as it was.
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="rounded-[28px] bg-[#f5f5f4] p-6 min-[900px]:p-8">
      <h2 className="flex items-center gap-2 text-[1.15rem] font-black">
        <Emoji className="text-[1.5rem]">✍️</Emoji>
        {copy.wallTitle}
      </h2>
      <p className="mt-1.5 text-[0.92rem] font-semibold text-[#475569]">{copy.wallSub}</p>
      {data.together !== null && (
        <p className="mt-1 text-[0.85rem] font-bold text-[#d95f2d]">{fill(copy.together, { count: data.together.toLocaleString("ko-KR") })}</p>
      )}

      <div className="mt-4">
        {data.canWrite ? (
          <Composer key={data.mine?.id ?? "new"} token={token} expression={expression} mine={data.mine} onSaved={reload} />
        ) : (
          <p className="rounded-2xl bg-white px-4 py-3 text-[0.9rem] font-semibold text-[#64748b]">{data.signedIn ? copy.notOwner : copy.signIn}</p>
        )}
      </div>

      {data.sentences.length === 0 ? (
        <p className="mt-4 text-center text-[0.9rem] font-semibold text-[#94a3b8]">{copy.empty}</p>
      ) : (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
          {data.sentences.map((s) => (
            <li key={s.id} className={cn("rounded-2xl bg-white p-4", s.picked && "ring-2 ring-[#f47a4a]")}>
              {s.picked && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-[#f47a4a] px-2.5 py-0.5 text-[0.72rem] font-black">🏆 {copy.pick}</span>
              )}
              <p lang="en" className="text-[1rem] font-bold leading-snug">
                {s.body}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[0.8rem] font-semibold text-[#64748b]">
                  {s.displayName ?? copy.anonymous}
                  {s.mine && ` · ${copy.mine}`}
                  {s.hidden && ` · ${copy.hidden}`}
                </span>
                <button
                  type="button"
                  aria-label={copy.cupLabel}
                  aria-pressed={s.cupped}
                  disabled={s.mine || !data.signedIn || pending === s.id}
                  onClick={() => cup(s.id)}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full px-3 text-[0.85rem] font-black transition-colors",
                    s.cupped ? "bg-[#fff8dc] text-[#050505] ring-1 ring-[#f47a4a]" : "bg-[#f5f5f4] text-[#475569]",
                    "disabled:cursor-default",
                  )}
                >
                  ☕ {s.cups}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProgressLink({ progress }: { progress: Progress | null }) {
  if (!progress) return null;
  return (
    <Link href="/daily/book" className="flex items-center justify-between gap-3 rounded-[22px] bg-white px-5 py-4 ring-1 ring-[#f1e5c7]">
      <span className="flex items-center gap-2 text-[1rem] font-black">
        <Emoji className="text-[1.4rem]" motion={progress.streak > 0 ? "animate" : "none"}>
          🔥
        </Emoji>
        {progress.streak > 0 ? fill(copy.streak, { days: progress.streak }) : copy.streakZero}
      </span>
      <span className="shrink-0 text-[0.88rem] font-bold text-[#475569] underline underline-offset-2">{fill(copy.book, { count: progress.expressions })}</span>
    </Link>
  );
}
