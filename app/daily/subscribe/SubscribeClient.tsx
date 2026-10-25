"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "@heroicons/react/24/solid";
import { DAILY_PAYMENT_ORDER_KEY, DAILY_PAYMENT_SESSION_KEY, DailyApiError, dailyApi, signInWithLink } from "../../lib/features/daily/api";
import DailyConsentDialog, { type DailyConsent } from "../../lib/features/daily/components/DailyConsentDialog";
import { cn, displayClass, Emoji, Pill } from "../../lib/features/daily/components/DailyUI";
import PhoneVerification from "../../lib/features/daily/components/PhoneVerification";
import { DAILY_GUIDE_PATH, DAILY_TERMS_PATH, DAILY_TERMS_VERSION, formatKrw, type DailyTrack } from "../../lib/features/daily/constants";
import { dailyCopy } from "../../lib/features/daily/copy";
import { dailyDisplay } from "../../lib/features/daily/fonts";
import "../../lib/features/daily/daily.css";

const PAYPLE_HOST = (process.env.NEXT_PUBLIC_PAYPLE_HOST || "https://cpay.payple.kr").replace(/\/+$/, "");
const PAYPLE_SDK_SRC = `${PAYPLE_HOST}/js/v1/payment.js`;
const JQUERY_SRC = "https://code.jquery.com/jquery-3.6.0.min.js";

type PaypleWindow = Window & {
  $?: unknown;
  PaypleCpayAuthCheck?: (params: Record<string, unknown>) => void;
  PaypleCpayCallback?: Array<(response: Record<string, unknown>) => boolean>;
};

interface Product {
  id: "sub_30d" | "pass_1m" | "pass_3m" | "pass_6m";
  name: string;
  amount: number;
  days: number;
  recurring: boolean;
}

interface Subscription {
  track: DailyTrack;
  status: string;
  plan: string | null;
  paidUntil: string | null;
  autoRenew: boolean;
  deliveryTime: string;
}

interface BillingInfo {
  paymentsOpen: boolean;
  // False when signed in from a message link: paying and cancelling ask for the code first.
  verified: boolean;
  phone: string;
  subscriptions: Subscription[];
  products: Product[];
}

const TIMES = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

function timeLabel(value: string) {
  const [h, m] = value.split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
}

const TRACK_TITLE: Record<DailyTrack, string> = { business: "비즈니스 영어", tech: "테크 영어" };

// Payple's script needs jQuery first, as on the 1cup payment page.
function loadPayple() {
  const w = window as PaypleWindow;
  const appendPayple = () => {
    if (document.querySelector(`script[src="${PAYPLE_SDK_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = PAYPLE_SDK_SRC;
    script.async = true;
    document.body.appendChild(script);
  };
  if (w.$) return appendPayple();
  const existing = document.querySelector(`script[src="${JQUERY_SRC}"]`) as HTMLScriptElement | null;
  if (existing) return existing.addEventListener("load", appendPayple, { once: true });
  const jquery = document.createElement("script");
  jquery.src = JQUERY_SRC;
  jquery.async = true;
  jquery.onload = appendPayple;
  document.body.appendChild(jquery);
}

export default function SubscribeClient() {
  const [info, setInfo] = useState<BillingInfo | null | undefined>(undefined);
  const [product, setProduct] = useState<Product["id"]>("sub_30d");
  const [track, setTrack] = useState<DailyTrack>("business");
  const [time, setTime] = useState("08:00");
  const [consentOpen, setConsentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await dailyApi<BillingInfo>("billing-info");
      setInfo(data);
      const latest = data.subscriptions[0];
      if (latest) {
        setTrack(latest.track);
        setTime(latest.deliveryTime);
      }
    } catch (e) {
      setInfo(e instanceof DailyApiError && e.status === 401 ? null : undefined);
      if (!(e instanceof DailyApiError && e.status === 401)) setError("정보를 불러오지 못했어요. 새로고침해 주세요.");
    }
  }, []);

  useEffect(() => {
    // The trial-ended message and the lesson page link here with their delivery token.
    const linkToken = new URLSearchParams(window.location.search).get("t");
    if (linkToken) void signInWithLink(linkToken);
    void load();
  }, [load]);

  useEffect(() => {
    const w = window as PaypleWindow;
    w.PaypleCpayCallback = w.PaypleCpayCallback || [];
    // One verification path: the result page settles the order whether Payple returns
    // through this browser callback or through its server callback.
    const callback = (response: Record<string, unknown>) => {
      sessionStorage.setItem(DAILY_PAYMENT_SESSION_KEY, JSON.stringify(response));
      window.location.href = "/daily/subscribe/result";
      return true;
    };
    w.PaypleCpayCallback.push(callback);
    loadPayple();
    return () => {
      w.PaypleCpayCallback = (w.PaypleCpayCallback || []).filter((item) => item !== callback);
    };
  }, []);

  const startPayment = async (consent: DailyConsent) => {
    setBusy(true);
    setError("");
    try {
      const w = window as PaypleWindow;
      if (typeof w.PaypleCpayAuthCheck !== "function") {
        throw new Error("결제창을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.");
      }
      const data = await dailyApi<{ orderNumber: string; paymentParams: Record<string, unknown> }>("checkout-window", {
        product,
        track,
        time,
        marketing: consent.marketing,
        agreements: { terms: true, privacy: true, messages: true, refund: true },
        termsVersion: DAILY_TERMS_VERSION,
      });
      sessionStorage.setItem(DAILY_PAYMENT_ORDER_KEY, data.orderNumber);
      setConsentOpen(false);
      w.PaypleCpayAuthCheck(data.paymentParams);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "결제를 시작하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const cancelRenewal = async (target: DailyTrack) => {
    if (!window.confirm("자동 결제를 해지할까요? 이미 결제한 기간이 끝날 때까지는 계속 받아요.")) return;
    try {
      await dailyApi("cancel-renewal", { track: target });
      await load();
    } catch (e) {
      setError(
        e instanceof DailyApiError && e.code === "verify-required"
          ? "해지 전에 아래에서 본인 확인을 해 주세요."
          : "해지하지 못했어요. 다시 시도해 주세요.",
      );
    }
  };

  const products = info?.products.length ? info.products : [];
  const selected = products.find((p) => p.id === product);
  const recurringLive = info?.subscriptions.find((s) => s.track === track && s.status === "active" && s.autoRenew);
  const blocked = Boolean(selected?.recurring && recurringLive);
  const pricing = dailyCopy.pricing;

  return (
    <div className={cn("daily-page min-h-[80vh] bg-[#f47a4a] px-4 pb-20 pt-10 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto w-full max-w-[720px]">
        <div className="text-center min-[900px]:text-left">
          <Emoji className="text-[2.6rem]">☕</Emoji>
          <h1 className={cn(displayClass, "mt-3 text-[2.3rem] leading-tight")}>계속 받아보기</h1>
          <p className="mt-2 text-[1rem] font-semibold text-[rgba(5,5,5,0.78)]">
            평일엔 원하는 시간에 새 표현이, 토요일엔 한 주 복습이 카카오톡으로 와요.
          </p>
        </div>

        {info === null && (
          <div className="mt-8 rounded-[28px] bg-white p-6">
            <p className="mb-3 text-[1rem] font-black">받는 휴대폰 번호를 인증해 주세요</p>
            <PhoneVerification onVerified={load} />
          </div>
        )}

        {info?.subscriptions.filter((s) => s.status === "active").map((s) => (
          <div key={s.track} className="mt-6 rounded-[24px] bg-[#050505] p-5 text-white">
            <p className="text-[1rem] font-black">
              {TRACK_TITLE[s.track]} · 받는 중 ({timeLabel(s.deliveryTime)})
            </p>
            {s.paidUntil && (
              <p className="mt-1 text-[0.9rem] font-semibold text-white/70">
                {s.autoRenew ? `다음 결제일 ${dateLabel(s.paidUntil)}` : `${dateLabel(s.paidUntil)}까지 이용`}
              </p>
            )}
            {s.autoRenew && (
              <button type="button" onClick={() => cancelRenewal(s.track)} className="mt-3 text-[0.85rem] font-bold text-white/60 underline underline-offset-2">
                자동 결제 해지
              </button>
            )}
          </div>
        ))}

        {info && !info.paymentsOpen && (
          <div className="mt-6 rounded-[28px] bg-[#050505] p-6 text-white">
            <p className="text-[1.1rem] font-black">결제는 곧 열려요</p>
            <p className="mt-2 text-[0.95rem] font-semibold text-white/70">결제가 열리면 이 페이지에서 바로 구독할 수 있어요.</p>
          </div>
        )}

        {info && info.paymentsOpen && (
          <>
            <div className="mt-8 rounded-[28px] bg-white p-6 min-[900px]:p-8">
              <p className="text-[1.05rem] font-black">1. 상품</p>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {products.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={product === p.id}
                      onClick={() => setProduct(p.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left ring-2 transition-shadow",
                        product === p.id ? "bg-[#fff8dc] ring-[#050505]" : "bg-[#f5f5f4] ring-transparent",
                      )}
                    >
                      <span>
                        <span className="flex items-center gap-2 text-[1rem] font-black">
                          {p.recurring ? "30일 정기구독" : p.name.replace("영어 한잔 Daily ", "")}
                          {p.recurring && <Pill className="bg-[#050505] px-2 py-1 text-[0.7rem] text-white">{pricing.subscription.badge}</Pill>}
                        </span>
                        <span className="text-[0.82rem] font-semibold text-[#64748b]">
                          {p.recurring ? "30일마다 자동 결제 · 언제든 해지" : `${p.days}일 · 한 번만 결제`}
                        </span>
                      </span>
                      <span className="text-[1.15rem] font-black">₩{formatKrw(p.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-[1.05rem] font-black">2. 트랙과 받는 시간</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["business", "tech"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={track === key}
                    onClick={() => setTrack(key)}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-[0.95rem] font-black ring-2",
                      track === key ? "bg-[#fff8dc] ring-[#050505]" : "bg-[#f5f5f4] ring-transparent",
                    )}
                  >
                    {TRACK_TITLE[key]}
                  </button>
                ))}
              </div>
              <select
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-label="받는 시간"
                className="mt-2 h-12 w-full cursor-pointer rounded-2xl bg-[#f5f5f4] px-4 text-[1rem] font-black outline-none"
              >
                {TIMES.map((value) => (
                  <option key={value} value={value}>
                    {timeLabel(value)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[0.82rem] font-semibold text-[#64748b]">받는 번호: {info.phone}</p>

              <ul className="m-0 mt-5 flex list-none flex-col gap-2 p-0">
                {pricing.subscription.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-[0.92rem] font-bold">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-[#f47a4a]" />
                    {benefit}
                  </li>
                ))}
              </ul>

              {blocked && (
                <p className="mt-4 rounded-2xl bg-[#fff1ea] px-4 py-3 text-[0.9rem] font-bold text-[#b45309]">
                  이 트랙은 이미 정기구독 중이에요. 이용권으로 기간을 늘리거나 다른 트랙을 골라 주세요.
                </p>
              )}
              {error && !consentOpen && (
                <p role="alert" className="mt-4 rounded-2xl bg-[#fef2f2] px-4 py-3 text-[0.9rem] font-semibold text-[#b91c1c]">
                  {error}
                </p>
              )}

              {!info.verified ? (
                <div className="mt-5">
                  <PhoneVerification maskedPhone={info.phone} onVerified={load} />
                </div>
              ) : (
              <button
                type="button"
                disabled={!selected || blocked || busy}
                onClick={() => {
                  setError("");
                  setConsentOpen(true);
                }}
                className="mt-5 h-[56px] w-full rounded-2xl bg-[#050505] text-[1.05rem] font-black text-white transition-opacity disabled:opacity-35"
              >
                {selected ? `₩${formatKrw(selected.amount)} 결제하기` : "결제하기"}
              </button>
              )}
              <p className="mt-2 text-center text-[0.8rem] font-semibold text-[#64748b]">{pricing.note.split(" 무료 체험")[0]}</p>
            </div>
          </>
        )}

        <p className="mt-5 text-center text-[0.85rem] font-semibold text-[rgba(5,5,5,0.72)]">
          <Link href={DAILY_GUIDE_PATH} className="underline underline-offset-2">
            {pricing.guide}
          </Link>
          {" · "}
          <Link href={DAILY_TERMS_PATH} className="underline underline-offset-2">
            {pricing.terms}
          </Link>
        </p>
      </div>

      {consentOpen && (
        <DailyConsentDialog mode="payment" busy={busy} error={error} onAccept={startPayment} onClose={() => setConsentOpen(false)} />
      )}
    </div>
  );
}
