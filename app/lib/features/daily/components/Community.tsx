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

export interface Progress {
  streak: number;
  expressions: number;
}

export interface Community {
  canWrite: boolean;
  signedIn: boolean;
  writerName: string | null;
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

// Today's expression inside a sentence, allowing the usual endings and one word inside a
// phrasal verb: "circle back" also finds "circling back", "loop in" finds "loop him in".
function expressionPattern(expression: string): RegExp | null {
  const words = expression.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const stems = words.map((w) => w.replace(/e$/i, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[a-z']*");
  return new RegExp(`\\b${stems.join("\\s+(?:[a-z']+\\s+)?")}`, "i");
}

function Highlighted({ body, pattern }: { body: string; pattern: RegExp | null }) {
  const match = pattern ? body.match(pattern) : null;
  if (!match || match.index === undefined) return <>{body}</>;
  const end = match.index + match[0].length;
  return (
    <>
      {body.slice(0, match.index)}
      <span className="text-[#d95f2d]">{body.slice(match.index, end)}</span>
      {body.slice(end)}
    </>
  );
}

function Composer({
  token,
  expression,
  mine,
  writerName,
  onSaved,
  onCancel,
}: {
  token: string;
  expression: string;
  mine: Sentence | null;
  writerName: string | null;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(mine?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const uses = expressionPattern(expression)?.test(body) ?? false;

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      await dailyApi("sentence-save", { token, body });
      await onSaved();
    } catch (e) {
      setMessage(e instanceof DailyApiError && e.message ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value.slice(0, 200))}
        placeholder={fill(copy.placeholder, { expression })}
        rows={3}
        lang="en"
        aria-label={copy.wallTitle}
        className="block w-full resize-none rounded-2xl bg-white px-4 py-3.5 text-[1.05rem] font-bold leading-snug outline-none placeholder:text-[#a8a29e] focus-visible:ring-2 focus-visible:ring-[#050505]"
      />
      <div className="mt-2.5 flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[0.82rem] font-semibold text-[#64748b]">
          {uses ? (
            <span className="font-black text-[#d95f2d]">✓ {fill(copy.usesExpression, { expression })}</span>
          ) : (
            fill(copy.postAs, { name: writerName ?? copy.anonymous })
          )}
        </p>
        {onCancel && (
          <button type="button" disabled={busy} onClick={onCancel} className="h-12 shrink-0 px-2 text-[0.9rem] font-bold text-[#64748b]">
            {copy.cancel}
          </button>
        )}
        <button
          type="button"
          disabled={busy || body.trim().length < 2 || mine?.body === body.trim()}
          onClick={save}
          className="h-12 shrink-0 rounded-2xl bg-[#050505] px-5 text-[0.95rem] font-black text-white disabled:opacity-35"
        >
          {mine ? copy.update : copy.post}
        </button>
      </div>
      {message && (
        <p role="alert" className="mt-2 text-[0.85rem] font-semibold text-[#b91c1c]">
          {message}
        </p>
      )}
    </div>
  );
}

export function SentenceWall({ token, expression, data, reload }: { token: string; expression: string; data: Community; reload: () => Promise<void> }) {
  const [pending, setPending] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const pattern = expressionPattern(expression);

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

  const remove = async () => {
    if (!window.confirm(copy.removeConfirm)) return;
    try {
      await dailyApi("sentence-delete", { token });
      setEditing(false);
      await reload();
    } catch {
      // Left as it was.
    }
  };

  const saved = async () => {
    setEditing(false);
    await reload();
  };

  // One sentence per person per lesson: once it is up, the field gives way to the row.
  const showComposer = data.canWrite && (!data.mine || editing);

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

      <div className="mt-5">
        {showComposer ? (
          <Composer
            key={data.mine?.id ?? "new"}
            token={token}
            expression={expression}
            mine={data.mine}
            writerName={data.writerName}
            onSaved={saved}
            onCancel={data.mine ? () => setEditing(false) : undefined}
          />
        ) : !data.canWrite ? (
          <p className="text-[0.9rem] font-semibold text-[#64748b]">{data.signedIn ? copy.notOwner : copy.signIn}</p>
        ) : null}
      </div>

      {data.sentences.length === 0 ? (
        <p className="mt-6 text-center text-[0.9rem] font-semibold text-[#94a3b8]">{copy.empty}</p>
      ) : (
        <ul className="m-0 mt-5 list-none divide-y divide-[#e7e5e4] border-t border-[#e7e5e4] p-0">
          {data.sentences.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                {s.picked && <p className="mb-1 text-[0.78rem] font-black text-[#d95f2d]">🏆 {copy.pick}</p>}
                <p lang="en" className="text-[1.02rem] font-bold leading-snug">
                  <Highlighted body={s.body} pattern={pattern} />
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[0.8rem] font-semibold text-[#78716c]">
                  <span>{s.displayName ?? copy.anonymous}</span>
                  {s.mine && <span>· {copy.mine}</span>}
                  {s.hidden && <span>· {copy.hidden}</span>}
                  {s.mine && !editing && (
                    <>
                      {!s.picked && (
                        <button type="button" onClick={() => setEditing(true)} className="ml-1 font-bold text-[#050505] underline underline-offset-2">
                          {copy.edit}
                        </button>
                      )}
                      <button type="button" onClick={remove} className="ml-1 font-bold text-[#050505] underline underline-offset-2">
                        {copy.remove}
                      </button>
                    </>
                  )}
                </p>
              </div>
              {s.mine || !data.signedIn ? (
                <span className="flex h-10 shrink-0 items-center gap-1 px-1 text-[0.88rem] font-black text-[#78716c]" aria-label={fill(copy.cupCount, { count: s.cups })}>
                  ☕ {s.cups}
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={copy.cupLabel}
                  aria-pressed={s.cupped}
                  disabled={pending === s.id}
                  onClick={() => cup(s.id)}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-1 rounded-full px-3.5 text-[0.88rem] font-black transition-colors",
                    s.cupped ? "bg-[#f47a4a] text-[#050505]" : "bg-white text-[#475569]",
                  )}
                >
                  ☕ {s.cups}
                </button>
              )}
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
