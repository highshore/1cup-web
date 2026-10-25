"use client";

import { useCallback, useEffect, useState } from "react";
import { StarIcon } from "@heroicons/react/24/solid";
import { DailyApiError, dailyApi } from "../api";
import PhoneVerification from "./PhoneVerification";
import { cn, Emoji } from "./DailyUI";

interface ReviewStatus {
  eligible: boolean;
  existing: { rating: number; body: string; displayName: string | null; status: "pending" | "approved" | "hidden" } | null;
}

// "레슨이 어땠나요?" on the lesson page. Writing needs the Daily phone sign-in, so the
// review is tied to a customer who actually received lessons, not to whoever holds the
// message link. Nothing appears publicly until the founder approves it.
export default function ReviewCard() {
  // undefined: checking; null: not signed in.
  const [status, setStatus] = useState<ReviewStatus | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await dailyApi<ReviewStatus>("review-status");
      setStatus(data);
      if (data.existing) {
        setRating(data.existing.rating);
        setBody(data.existing.body);
        setDisplayName(data.existing.displayName ?? "");
      }
    } catch (e) {
      setStatus(e instanceof DailyApiError && e.status === 401 ? null : { eligible: false, existing: null });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setMessage("");
    try {
      await dailyApi("review-submit", { rating, body, displayName });
      setDone(true);
    } catch (e) {
      setMessage(e instanceof DailyApiError && e.message ? e.message : "후기를 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (status === undefined) return null;

  return (
    <section className="rounded-[28px] bg-[#f5f5f4] p-6 text-left">
      <p className="flex items-center gap-2 text-[1.15rem] font-black">
        <Emoji className="text-[1.5rem]">💬</Emoji>
        레슨이 어땠나요?
      </p>

      {done || status?.existing?.status === "pending" ? (
        <p className="mt-3 text-[0.95rem] font-semibold leading-relaxed text-[#475569]">
          고마워요! 남겨주신 후기는 확인한 뒤 소개 페이지에 올라가요.
          {!done && " 내용을 고쳐서 다시 보내도 돼요."}
        </p>
      ) : status?.existing?.status === "approved" ? (
        <p className="mt-3 text-[0.95rem] font-semibold text-[#475569]">남겨주신 후기가 소개 페이지에 올라가 있어요. 고마워요!</p>
      ) : null}

      {status === null ? (
        <div className="mt-3">
          <p className="mb-3 text-[0.92rem] font-semibold text-[#475569]">
            레슨을 받은 번호로 인증하면 한 줄 후기를 남길 수 있어요.
          </p>
          <PhoneVerification onVerified={load} />
        </div>
      ) : !status.eligible ? (
        <p className="mt-3 text-[0.92rem] font-semibold text-[#64748b]">
          이 번호로 받은 레슨이 없어요. 레슨을 받은 번호로 인증해 주세요.
        </p>
      ) : done || status.existing?.status === "approved" ? null : (
        <div className="mt-4">
          <div className="flex gap-1" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value}점`}
                onClick={() => setRating(value)}
                className="p-0.5"
              >
                <StarIcon className={cn("size-8 transition-colors", value <= rating ? "text-[#f47a4a]" : "text-[#d6d3d1]")} />
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 300))}
            placeholder="어떤 점이 좋았는지, 아쉬웠는지 한 줄로 남겨 주세요. (10자 이상)"
            rows={3}
            className="mt-3 w-full resize-none rounded-2xl bg-white p-3.5 text-[0.98rem] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]"
          />
          <label className="mt-2 block">
            <span className="text-[0.8rem] font-bold text-[#64748b]">소개 페이지에 보일 이름 (비워두면 익명)</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value.slice(0, 12))}
              placeholder="예: 마케터 J"
              className="mt-1 h-11 w-full rounded-xl bg-white px-3 text-[0.95rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]"
            />
          </label>
          <p className="mt-2 text-[0.78rem] leading-relaxed text-[#64748b]">
            후기는 확인을 거쳐 별점, 내용, 이름(또는 익명), 받은 레슨 수와 함께 소개 페이지에 올라갈 수 있어요.
          </p>
          {message && (
            <p role="alert" className="mt-2 text-[0.88rem] font-semibold text-[#b91c1c]">
              {message}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy || rating === 0 || body.trim().length < 10}
            className="mt-3 h-[52px] w-full rounded-2xl bg-[#050505] text-[1rem] font-black text-white transition-opacity disabled:opacity-35"
          >
            {busy ? "보내는 중…" : "후기 보내기"}
          </button>
        </div>
      )}
    </section>
  );
}
