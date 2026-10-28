"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DAILY_PAYMENT_ORDER_KEY,
  DAILY_PAYMENT_SESSION_KEY,
  DailyApiError,
  dailyApi,
} from "../../../lib/features/daily/api";
import { cn, displayClass, Emoji } from "../../../lib/features/daily/components/DailyUI";
import DailyLoading from "../../../lib/features/daily/components/DailyLoading";
import { DAILY_PASSES, DAILY_TRACK_LABEL, type DailyTrack } from "../../../lib/features/daily/constants";
import { dailyDisplay } from "../../../lib/features/daily/fonts";
import "../../../lib/features/daily/daily.css";

interface Settled {
  subscription: { track: DailyTrack; plan: string; paidUntil: string; autoRenew: boolean; deliveryTime: string } | null;
}

type State =
  | { kind: "working" }
  | { kind: "done"; settled: Settled }
  | { kind: "failed"; message: string };

const TRACK_TITLE = DAILY_TRACK_LABEL;

function readResponse(params: URLSearchParams): Record<string, string> {
  const fromQuery: Record<string, string> = {};
  params.forEach((value, key) => (fromQuery[key] = value));
  if (fromQuery.PCD_PAY_RST) return fromQuery;
  try {
    const stored = sessionStorage.getItem(DAILY_PAYMENT_SESSION_KEY);
    if (stored) return { ...JSON.parse(stored), ...fromQuery };
  } catch {
    // ignore
  }
  return fromQuery;
}

function orderNumberFrom(response: Record<string, string>): string {
  if (response.order) return response.order;
  if (response.PCD_PAY_OID) return response.PCD_PAY_OID;
  try {
    const defined = JSON.parse(response.PCD_USER_DEFINE2 ?? "{}");
    if (defined.orderNumber) return defined.orderNumber;
  } catch {
    // ignore
  }
  return sessionStorage.getItem(DAILY_PAYMENT_ORDER_KEY) ?? "";
}

export default function ResultClient() {
  const params = useSearchParams();
  const [state, setState] = useState<State>({ kind: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const response = readResponse(new URLSearchParams(params.toString()));
    const orderNumber = orderNumberFrom(response);
    if (!orderNumber) {
      setState({ kind: "failed", message: "결제 정보를 찾지 못했어요. 결제가 됐는지 확인한 뒤 다시 시도해 주세요." });
      return;
    }
    // Strip Payple's fields from the address bar once read.
    window.history.replaceState(null, "", "/daily/subscribe/result");

    const verify = async (attempt: number): Promise<void> => {
      try {
        const settled = await dailyApi<Settled>("checkout-verify", {
          orderNumber,
          result: {
            PCD_PAY_RST: response.PCD_PAY_RST,
            PCD_PAY_CODE: response.PCD_PAY_CODE,
            PCD_PAY_MSG: response.PCD_PAY_MSG,
            PCD_PAYER_ID: response.PCD_PAYER_ID,
          },
        });
        sessionStorage.removeItem(DAILY_PAYMENT_SESSION_KEY);
        sessionStorage.removeItem(DAILY_PAYMENT_ORDER_KEY);
        setState({ kind: "done", settled });
      } catch (e) {
        // Another tab or a double callback is settling the same order: wait for it.
        if (e instanceof DailyApiError && e.code === "payment-in-progress" && attempt < 6) {
          window.setTimeout(() => void verify(attempt + 1), 2500);
          return;
        }
        if (e instanceof DailyApiError && e.status === 401) {
          setState({ kind: "failed", message: "로그인이 만료됐어요. 구독 페이지에서 다시 인증해 주세요. 이미 결제됐다면 다시 결제되지 않아요." });
          return;
        }
        setState({ kind: "failed", message: e instanceof Error && e.message ? e.message : "결제를 확인하지 못했어요." });
      }
    };
    void verify(0);
  }, [params]);

  return (
    <div className={cn("daily-page min-h-[70vh] bg-[#f47a4a] px-4 pb-20 pt-14 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto w-full max-w-[720px] text-center min-[900px]:text-left">
        {state.kind === "working" && (
          <>
            <DailyLoading label="결제를 확인하고 있어요" />
            <h1 className={cn(displayClass, "mt-2 text-[2.2rem]")}>결제를 확인하고 있어요</h1>
            <p className="mt-2 font-semibold text-[rgba(5,5,5,0.75)]">이 창을 닫지 말고 잠시만 기다려 주세요.</p>
          </>
        )}
        {state.kind === "done" && (
          <>
            <Emoji className="text-[3rem]">🎉</Emoji>
            <h1 className={cn(displayClass, "mt-4 text-[2.4rem] leading-tight")}>
              {(() => {
                // The plan is the one just paid for; a pass is not a subscription.
                const pass = DAILY_PASSES.find((p) => p.id === state.settled.subscription?.plan);
                return pass ? (
                  <>
                    {pass.label}({pass.days}일)이 <span className="text-white">결제됐어요!</span>
                  </>
                ) : (
                  <>
                    정기구독이 <span className="text-white">시작됐어요!</span>
                  </>
                );
              })()}
            </h1>
            {state.settled.subscription && (
              <div className="mt-6 rounded-[24px] bg-white p-6 text-left">
                <p className="text-[1.05rem] font-black">{TRACK_TITLE[state.settled.subscription.track]}</p>
                <p className="mt-1 text-[0.95rem] font-semibold text-[#475569]">
                  {new Date(state.settled.subscription.paidUntil).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" })}
                  {state.settled.subscription.autoRenew ? "에 다음 결제가 자동으로 돼요." : "까지 받을 수 있어요."}
                </p>
                <p className="mt-1 text-[0.95rem] font-semibold text-[#475569]">
                  평일 {state.settled.subscription.deliveryTime}에 레슨이, 토요일엔 한 주 복습이 카카오톡으로 와요.
                </p>
              </div>
            )}
            <Link href="/daily" className="mt-6 inline-flex h-[54px] items-center rounded-2xl bg-[#050505] px-6 font-black text-white">
              Daily 소개로
            </Link>
          </>
        )}
        {state.kind === "failed" && (
          <>
            <Emoji className="text-[3rem]">😭</Emoji>
            <h1 className={cn(displayClass, "mt-4 text-[2.2rem]")}>결제가 완료되지 않았어요</h1>
            <p className="mt-3 font-semibold text-[rgba(5,5,5,0.8)]">{state.message}</p>
            <Link href="/daily/subscribe" className="mt-6 inline-flex h-[54px] items-center rounded-2xl bg-[#050505] px-6 font-black text-white">
              다시 시도하기
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
