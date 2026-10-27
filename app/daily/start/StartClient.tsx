"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, ClockIcon, DevicePhoneMobileIcon } from "@heroicons/react/24/outline";
import DailyConsentDialog, { type DailyConsent } from "../../lib/features/daily/components/DailyConsentDialog";
import { cn, displayClass, Emoji } from "../../lib/features/daily/components/DailyUI";
import { DailyApiError, dailyApi } from "../../lib/features/daily/api";
import KakaoSignIn from "../../lib/features/daily/components/KakaoSignIn";
import { DAILY_GUIDE_PATH, DAILY_TERMS_VERSION, type DailyTrack } from "../../lib/features/daily/constants";
import { dailyCopy } from "../../lib/features/daily/copy";
import { dailyDisplay } from "../../lib/features/daily/fonts";
import "../../lib/features/daily/daily.css";

interface StartInfo {
  open: boolean;
  phone: string | null;
  // False when signed in from a message link: starting a trial asks for the code first.
  verified: boolean;
  name: string | null;
  usedTrialTracks: string[];
  liveTracks: string[];
}

interface StartResult {
  sent: boolean;
  nextSendAt: string;
}

// 06:00–22:00 in 30-minute steps: the range daily_subscriptions.delivery_time allows.
const TIMES = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

function timeLabel(value: string) {
  const [h, m] = value.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${hour}:${String(m).padStart(2, "0")}`;
}

const ERRORS: Record<string, string> = {
  "not-open": "무료 체험은 아직 열리지 않았어요. 곧 열릴 예정이에요.",
  "trial-used": "이 카카오계정으로 이 레벨의 무료 체험을 이미 받았어요.",
  "already-subscribed": "이미 이 레벨을 받고 있어요.",
  "no-lesson": "보낼 레슨을 준비하고 있어요. 잠시 후 다시 시도해 주세요.",
  "consent-required": "필수 항목에 모두 동의해 주세요.",
  "terms-outdated": "이용약관이 바뀌었어요. 페이지를 새로고침한 뒤 다시 동의해 주세요.",
  "login-required": "로그인이 끝났어요. 카카오로 다시 시작해 주세요.",
  "verify-required": "신청 전에 카카오로 한 번 확인해 주세요.",
};

const TRACKS = dailyCopy.tracks.items;

export default function StartClient() {
  const params = useSearchParams();

  const [track, setTrack] = useState<DailyTrack>(params.get("track") === "advanced" ? "advanced" : "basic");
  const [time, setTime] = useState(TIMES.includes(params.get("time") ?? "") ? (params.get("time") as string) : "08:00");
  const [name, setName] = useState("");
  // undefined: checking; null: not signed in.
  const [info, setInfo] = useState<StartInfo | null | undefined>(undefined);
  const [infoError, setInfoError] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<StartResult | null>(null);

  const loadInfo = useCallback(async () => {
    setInfoError("");
    try {
      const data = await dailyApi<StartInfo>("start-info");
      setInfo(data);
      setName((current) => current || data.name || "");
    } catch (e) {
      if (e instanceof DailyApiError && e.status === 401) setInfo(null);
      else setInfoError("신청 정보를 불러오지 못했어요. 새로고침해 주세요.");
    }
  }, []);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  const signOut = async () => {
    await dailyApi("logout").catch(() => undefined);
    setInfo(null);
    setName("");
  };

  const trackState = (key: string) =>
    info?.liveTracks.includes(key) ? "받는 중" : info?.usedTrialTracks.includes(key) ? "체험 완료" : null;
  const selectedBlocked = trackState(track) !== null;

  const start = async (consent: DailyConsent) => {
    setBusy(true);
    setError("");
    try {
      const data = await dailyApi<StartResult>("start-trial", {
        track,
        time,
        name,
        marketing: consent.marketing,
        agreements: { terms: true, privacy: true, messages: true },
        termsVersion: DAILY_TERMS_VERSION,
      });
      setResult(data);
      setConsentOpen(false);
    } catch (e) {
      const code = e instanceof DailyApiError ? e.code : "";
      setError(ERRORS[code] ?? "신청하지 못했어요. 잠시 후 다시 시도해 주세요.");
      if (code === "login-required") setInfo(null);
      if (code === "verify-required") void loadInfo();
    } finally {
      setBusy(false);
    }
  };

  if (result) return <Done result={result} track={track} time={time} />;

  const signedIn = Boolean(info);
  const canSubmit = Boolean(info?.open && !selectedBlocked);

  return (
    <div className={cn("daily-page min-h-[80vh] bg-[#fff8dc] px-4 pb-20 pt-8 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto w-full max-w-[720px]">
        <Link href="/daily" className="inline-flex items-center gap-1 text-[0.9rem] font-bold text-[#475569]">
          <ArrowLeftIcon className="size-4" />
          Daily 소개로
        </Link>
        <h1 className={cn(displayClass, "mt-5 text-[2.3rem] leading-[1.15] min-[900px]:text-[2.8rem]")}>
          첫 하루 <span className="text-[#f47a4a]">무료로</span> 받아보기
        </h1>
        <p className="mt-3 text-[1rem] font-semibold text-[#475569]">
          카드 등록 없이, 오늘의 레슨 1회를 바로 카카오톡으로 보내드려요.
        </p>

        <Step number={1} title="레벨을 골라주세요">
          <div className="grid gap-3 min-[600px]:grid-cols-2">
            {TRACKS.map((item) => {
              const state = trackState(item.key);
              const selected = track === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTrack(item.key as DailyTrack)}
                  className={cn(
                    "flex items-center gap-4 rounded-[22px] bg-white p-4 text-left ring-2 transition-shadow",
                    selected ? "ring-[#050505]" : "ring-transparent hover:ring-[#e5e7eb]",
                  )}
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#f5f5f4] text-[1.9rem]">
                    <Emoji label={item.emojiLabel} motion={selected ? "animate" : "none"}>
                      {item.emoji}
                    </Emoji>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[1.08rem] font-black">{item.title}</span>
                    <span className="block text-[0.86rem] font-semibold text-[#64748b]">{item.tagline}</span>
                    <span lang="en" className="mt-1 block text-[0.84rem] font-bold text-[#050505]">
                      {item.examples.map((example) => example.en).join(" · ")}
                    </span>
                    {state && <span className="mt-1 inline-block rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[0.75rem] font-bold text-[#475569]">{state}</span>}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      selected ? "bg-[#f47a4a]" : "ring-1 ring-[#e2e8f0]",
                    )}
                  >
                    {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        <Step number={2} title="받는 시간을 골라주세요">
          <label className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3">
            <ClockIcon className="size-6 shrink-0 text-[#f47a4a]" />
            <span className="sr-only">받는 시간</span>
            <select
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="h-11 flex-1 cursor-pointer bg-transparent text-[1.05rem] font-black outline-none"
            >
              {TIMES.map((value) => (
                <option key={value} value={value}>
                  {timeLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2.5 text-[0.88rem] font-semibold text-[#64748b]">
            평일엔 이 시간에 레슨이, 토요일엔 한 주 복습이 와요. 일요일은 쉬어요.
          </p>
        </Step>

        <Step number={3} title="카카오로 시작해 주세요">
          {info === undefined && !infoError ? (
            <div className="h-[88px] animate-pulse rounded-[22px] bg-white/70" />
          ) : info === null ? (
            <KakaoSignIn />
          ) : info && !info.verified && info.phone ? (
            <>
              <KakaoSignIn confirm />
              <button type="button" onClick={signOut} className="mt-2.5 text-[0.85rem] font-bold text-[#64748b] underline underline-offset-2">
                다른 카카오계정으로
              </button>
            </>
          ) : (
            <div className="rounded-[22px] bg-white p-5">
              <div className="flex items-center gap-2.5">
                <DevicePhoneMobileIcon className="size-5 text-[#f47a4a]" />
                <span className="flex-1 text-[1rem] font-black">{info?.phone ?? infoError}</span>
                {info && (
                  <button type="button" onClick={signOut} className="text-[0.85rem] font-bold text-[#64748b] underline underline-offset-2">
                    다른 카카오계정으로
                  </button>
                )}
              </div>
              <label className="mt-4 block">
                <span className="text-[0.82rem] font-bold text-[#64748b]">카톡에서 부를 이름 (선택)</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value.slice(0, 20))}
                  placeholder="이름"
                  className="mt-1 h-12 w-full rounded-xl bg-[#f5f5f4] px-3 text-[1rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]"
                />
              </label>
            </div>
          )}
        </Step>

        {info && !info.open && (
          <p className="mt-6 rounded-[18px] bg-white px-5 py-4 text-[0.95rem] font-bold text-[#475569]">
            <Emoji className="mr-1.5">⏳</Emoji>
            무료 체험은 곧 열려요. 열리면 이 페이지에서 바로 신청할 수 있어요.
          </p>
        )}
        {info && selectedBlocked && (
          <p className="mt-6 rounded-[18px] bg-white px-5 py-4 text-[0.95rem] font-bold text-[#475569]">
            {trackState(track) === "받는 중"
              ? "이미 이 레벨을 받고 있어요."
              : "이 레벨의 무료 체험은 이미 받았어요. 다른 레벨을 고르거나 구독해 주세요."}
          </p>
        )}

        {signedIn && (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              setError("");
              setConsentOpen(true);
            }}
            className="mt-8 h-[54px] w-full rounded-2xl bg-[#050505] text-[1.08rem] font-black text-white transition-opacity disabled:opacity-35"
          >
            무료 레슨 받기
          </button>
        )}
      </div>

      {consentOpen && (
        <DailyConsentDialog busy={busy} error={error} onAccept={start} onClose={() => setConsentOpen(false)} />
      )}
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 flex items-center gap-2.5 text-[1.12rem] font-black">
        <span className="flex size-7 items-center justify-center rounded-full bg-[#050505] text-[0.85rem] text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Done({ result, track, time }: { result: StartResult; track: DailyTrack; time: string }) {
  const trackTitle = TRACKS.find((item) => item.key === track)?.title ?? "";
  const next = new Date(result.nextSendAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className={cn("daily-page min-h-[80vh] bg-[#f47a4a] px-4 pb-20 pt-14 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto w-full max-w-[720px]">
        <Emoji className="text-[3.4rem]">{result.sent ? "☕" : "⏳"}</Emoji>
        <h1 className={cn(displayClass, "mt-4 text-[2.4rem] leading-[1.15] min-[900px]:text-[2.9rem]")}>
          {result.sent ? (
            <>
              첫 레슨을 카톡으로
              <br />
              <span className="text-white">보냈어요!</span>
            </>
          ) : (
            <>
              레슨을 보내는 중에
              <br />
              <span className="text-white">문제가 생겼어요</span>
            </>
          )}
        </h1>
        <p className="mt-4 text-[1.02rem] font-semibold text-[rgba(5,5,5,0.78)]">
          {result.sent
            ? `${trackTitle} 오늘의 레슨이 카카오톡으로 도착해요. 알림을 눌러 레슨을 열어보세요.`
            : "신청은 완료됐어요. 다음 발송 시간에 다시 보내드릴게요."}
        </p>

        <div className="mt-8 rounded-[24px] bg-white p-6">
          <p className="text-[1rem] font-black">무료 체험은 레슨 1회예요</p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0 text-[0.95rem] font-semibold text-[#334155]">
            <li>
              · {next}에 체험 종료 안내를 한 번 보내드려요. (받는 시간 {timeLabel(time)})
            </li>
            <li>· 구독하지 않으면 그 뒤로는 메시지를 보내지 않아요.</li>
            <li>· 카드를 등록하지 않았으니 자동으로 결제되지 않아요.</li>
          </ul>
        </div>

        <div className="mt-4 flex flex-col gap-2 min-[600px]:flex-row">
          <Link
            href="/daily#pricing"
            className="flex h-[54px] items-center min-[600px]:flex-1 justify-center rounded-2xl bg-[#050505] text-[1rem] font-black text-white"
          >
            가격 보기
          </Link>
          <Link
            href={DAILY_GUIDE_PATH}
            className="flex h-[54px] items-center min-[600px]:flex-1 justify-center rounded-2xl bg-white/70 text-[1rem] font-black"
          >
            이용 가이드 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
