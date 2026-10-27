"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StarIcon } from "@heroicons/react/24/solid";
import { CheckIcon } from "@heroicons/react/24/outline";
import { DailyApiError, dailyApi } from "../../lib/features/daily/api";
import { cn, displayClass, Headline } from "../../lib/features/daily/components/DailyUI";
import DailyLoading from "../../lib/features/daily/components/DailyLoading";
import KakaoSignIn from "../../lib/features/daily/components/KakaoSignIn";
import { DAILY_ACCOUNT_PATH, DAILY_JOB_CATEGORIES, DAILY_TERMS_PATH } from "../../lib/features/daily/constants";
import { dailyCopy } from "../../lib/features/daily/copy";
import { dailyDisplay } from "../../lib/features/daily/fonts";
import "../../lib/features/daily/daily.css";

type Reward = "applied" | "pending" | "already";

interface ReviewStatus {
  eligible: boolean;
  workplace: string;
  jobCategory: string;
  existing: {
    rating: number;
    body: string;
    displayName: string | null;
    status: "pending" | "approved" | "hidden";
    reward: "applied" | "pending" | null;
  } | null;
}

const copy = dailyCopy.reviewPage;
const field = "w-full rounded-xl bg-[#f5f5f4] px-3.5 text-[0.98rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]";
const label = "text-[0.92rem] font-black";

// Reviews used to sit at the bottom of the lesson page; here they get the room the extra
// fields need. Everything required (별점, 10자 이상, 소속, 직종, 홍보 동의) is checked again
// on the server, which also hands out the 15 days.
export default function ReviewClient() {
  // undefined: checking; null: not signed in.
  const [status, setStatus] = useState<ReviewStatus | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [jobCategory, setJobCategory] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<Reward | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await dailyApi<ReviewStatus>("review-status");
      setStatus(data);
      setWorkplace(data.workplace ?? "");
      setJobCategory(data.jobCategory ?? "");
      if (data.existing) {
        setRating(data.existing.rating);
        setBody(data.existing.body);
        setDisplayName(data.existing.displayName ?? "");
      }
    } catch (e) {
      setStatus(
        e instanceof DailyApiError && e.status === 401 ? null : { eligible: false, workplace: "", jobCategory: "", existing: null },
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ready = rating > 0 && body.trim().length >= 10 && workplace.trim() !== "" && jobCategory !== "" && consent;

  const submit = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { reward } = await dailyApi<{ reward: Reward }>("review-submit", {
        rating,
        body,
        displayName,
        workplace,
        jobCategory,
        promoConsent: consent,
      });
      setDone(reward);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setMessage(e instanceof DailyApiError && e.message ? e.message : "후기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const existing = status?.existing ?? null;

  return (
    <div className={cn("daily-page min-h-[80vh] bg-[#fff8dc] px-4 pb-20 pt-10 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
        <div className="text-center">
          <h1 className={cn(displayClass, "whitespace-pre-line text-[2.3rem] leading-tight")}>
            <Headline text={copy.title} accent={copy.accent} accentClassName="text-[#f47a4a]" />
          </h1>
          <p className="mt-3 text-[1rem] font-semibold text-[#57534e]">{copy.lead}</p>
        </div>

        {status === undefined && <DailyLoading label="후기 정보를 불러오고 있어요" />}

        {status === null && (
          <section className="rounded-[24px] bg-white p-5">
            <KakaoSignIn bare detail={copy.signIn} />
          </section>
        )}

        {status && !status.eligible && (
          <p className="rounded-[24px] bg-white p-6 text-center text-[0.95rem] font-semibold text-[#64748b]">{copy.notEligible}</p>
        )}

        {done && (
          <section className="rounded-[24px] bg-white p-6 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f47a4a]">
              <CheckIcon className="size-6" strokeWidth={3} />
            </span>
            <h2 className="mt-3 text-[1.3rem] font-black">{copy.doneTitle}</h2>
            <p className="mt-2 text-[0.98rem] font-bold">{copy.done[done]}</p>
            <p className="mt-1 text-[0.9rem] font-semibold text-[#64748b]">{copy.doneNote}</p>
            <Link
              href={DAILY_ACCOUNT_PATH}
              className="mt-5 flex h-[54px] items-center justify-center rounded-2xl bg-[#050505] text-[1rem] font-black text-white"
            >
              {copy.toAccount}
            </Link>
          </section>
        )}

        {status?.eligible && !done && existing?.status === "approved" && (
          <p className="rounded-[24px] bg-white p-6 text-center text-[0.95rem] font-bold">{copy.approved}</p>
        )}

        {status?.eligible && !done && existing?.status !== "approved" && (
          <section className="flex flex-col gap-6 rounded-[24px] bg-white p-5 min-[600px]:p-6">
            {existing && (
              <p className="text-[0.9rem] font-bold text-[#475569]">
                {copy.pending}{" "}
                {existing.reward === "applied" ? copy.rewardApplied : existing.reward === "pending" ? copy.rewardPending : ""}
              </p>
            )}

            <div>
              <p className={label}>{copy.rating}</p>
              <div className="mt-2 flex gap-1" role="radiogroup" aria-label={copy.rating}>
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
                    <StarIcon className={cn("size-9 transition-colors", value <= rating ? "text-[#f47a4a]" : "text-[#d6d3d1]")} />
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className={label}>{copy.body}</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value.slice(0, 300))}
                placeholder={copy.bodyPlaceholder}
                rows={5}
                className={cn(field, "mt-2 resize-none py-3 font-semibold")}
              />
              <span className="mt-1 block text-right text-[0.78rem] font-semibold text-[#94a3b8]">{body.length}/300</span>
            </label>

            <label className="block">
              <span className={label}>{copy.displayName}</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value.slice(0, 12))}
                placeholder={copy.displayNamePlaceholder}
                className={cn(field, "mt-2 h-12")}
              />
              <span className="mt-1 block text-[0.8rem] font-semibold text-[#64748b]">{copy.displayNameHint}</span>
            </label>

            <div>
              <p className={label}>{copy.about}</p>
              <p className="mt-0.5 text-[0.82rem] font-semibold text-[#64748b]">{copy.aboutHint}</p>
              <label className="mt-2 block">
                <span className="sr-only">{dailyCopy.account.profile.workplace}</span>
                <input
                  value={workplace}
                  onChange={(event) => setWorkplace(event.target.value.slice(0, 60))}
                  placeholder={`${dailyCopy.account.profile.workplace} · ${dailyCopy.account.profile.workplacePlaceholder}`}
                  className={cn(field, "h-12")}
                />
              </label>
              <label className="mt-2 block">
                <span className="sr-only">{dailyCopy.account.profile.jobCategory}</span>
                <select
                  value={jobCategory}
                  onChange={(event) => setJobCategory(event.target.value)}
                  className={cn(field, "h-12 cursor-pointer", jobCategory === "" && "text-[#94a3b8]")}
                >
                  <option value="" disabled>
                    {dailyCopy.account.profile.jobCategory} · {dailyCopy.account.profile.jobPick}
                  </option>
                  {DAILY_JOB_CATEGORIES.map((item) => (
                    <option key={item} value={item} className="text-[#050505]">
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[#f47a4a]"
              />
              <span>
                <span className="block text-[0.92rem] font-black">{copy.consent}</span>
                <span className="mt-1 block text-[0.82rem] font-semibold leading-relaxed text-[#64748b]">
                  {copy.consentDetail}{" "}
                  <Link href={DAILY_TERMS_PATH} className="underline underline-offset-2">
                    {copy.terms}
                  </Link>
                </span>
              </span>
            </label>

            <div>
              {message && (
                <p role="alert" className="mb-2 text-[0.88rem] font-semibold text-[#b91c1c]">
                  {message}
                </p>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={busy || !ready}
                className="h-[54px] w-full rounded-2xl bg-[#050505] text-[1.02rem] font-black text-white transition-opacity disabled:opacity-35"
              >
                {busy ? copy.sending : existing ? copy.resubmit : copy.submit}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
