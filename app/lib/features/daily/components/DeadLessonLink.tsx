import Link from "next/link";
import { DAILY_ACCOUNT_PATH, DAILY_MONTHLY_PRICE_KRW, formatKrw } from "../constants";
import { dailyDisplay } from "../fonts";
import type { DeadLinkVisitor } from "../server/lessons";
import { cn, displayClass, Emoji } from "./DailyUI";
import "../daily.css";

const price = `월 ₩${formatKrw(DAILY_MONTHLY_PRICE_KRW)}`;
const primary = "flex h-[54px] items-center justify-center rounded-2xl px-6 text-[1rem] font-black";

// What a lesson or review link that matches no message opens, instead of a 404: the
// link is no longer valid, and where to go from here. A subscriber finds every lesson
// they received under 내 계정 (내 학습 기록); anyone else needs to subscribe.
export default function DeadLessonLink({ visitor }: { visitor: DeadLinkVisitor }) {
  const subscribe = (
    <Link href="/daily/subscribe" className={cn(primary, "bg-[#050505] text-white")}>
      구독하고 계속 받기
    </Link>
  );
  const account = (
    <Link href={DAILY_ACCOUNT_PATH} className={cn(primary, visitor === "subscriber" ? "bg-[#050505] text-white" : "bg-white text-[#050505]")}>
      내 계정에서 레슨 링크 확인하기
    </Link>
  );

  return (
    <div className={cn("daily-page flex min-h-[80vh] items-center bg-[#fff8dc] px-4 py-16 text-[#050505] [word-break:keep-all]", dailyDisplay.variable)}>
      <div className="mx-auto w-full max-w-[520px] text-center">
        <Emoji className="text-[2.8rem]">⌛</Emoji>
        <h1 className={cn(displayClass, "mt-4 text-[2.1rem] leading-tight")}>레슨 링크가 만료됐어요</h1>

        {visitor === "subscriber" && (
          <p className="mt-3 text-[1rem] font-semibold text-[#475569]">
            구독 중이에요. 내 계정의 내 학습 기록에서 지금까지 받은 레슨 링크를 모두 다시 열 수 있어요.
          </p>
        )}
        {visitor === "not-subscriber" && (
          <p className="mt-3 text-[1rem] font-semibold text-[#475569]">
            지금은 구독 중이 아니에요. 레슨을 계속 보려면 구독이 필요해요. {price}, 언제든 해지할 수 있어요.
          </p>
        )}
        {visitor === "unknown" && (
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0 text-left text-[0.98rem] font-semibold text-[#475569]">
            <li>
              <span className="font-black text-[#050505]">구독 중이라면</span> 내 계정의 내 학습 기록에서 받은 레슨 링크를 다시 확인해 주세요.
            </li>
            <li>
              <span className="font-black text-[#050505]">구독 중이 아니라면</span> 레슨을 계속 보려면 구독이 필요해요. {price}, 언제든 해지할 수 있어요.
            </li>
          </ul>
        )}

        <div className="mt-7 flex flex-col gap-2">
          {visitor === "subscriber" ? account : subscribe}
          {visitor === "unknown" && account}
        </div>
      </div>
    </div>
  );
}
