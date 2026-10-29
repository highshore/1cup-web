// KakaoTalk notices about a customer's account: payments, renewals, refunds.
//
// Each goes out through its own approved template (ALIMTALK_TEMPLATES.md). The variable
// names below must match the approved text exactly; NHN rejects a message missing one.

import { sendKakaoMessages } from "../_shared/kakao.ts";

export function won(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

/** 2027년 4월 26일, from a YYYY-MM-DD date. */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export interface NoticeVariables {
  DAILY_PAY_DONE: { name: string; product: string; amount: string; date: string };
  DAILY_SUB_STARTED: { name: string; product: string; amount: string; date: string };
  DAILY_RENEWED: { name: string; product: string; amount: string; date: string };
  DAILY_PAY_FAILED: { name: string; track: string; amount: string; date: string };
  DAILY_SUB_ENDED: { name: string; track: string };
  DAILY_REFUND_DONE: { name: string; amount: string };
  DAILY_REFUND_REJECT: { name: string };
  DAILY_ADMIN_REFUND: { result: string; product: string; amount: string };
}

export async function notify<T extends keyof NoticeVariables>(phones: string[], template: T, variables: NoticeVariables[T]) {
  if (phones.length === 0) return;
  try {
    await sendKakaoMessages(
      phones.map((phone) => ({ recipientNo: phone, templateParameter: variables })),
      template,
    );
  } catch (e) {
    // A notice is never the reason a request, payment or refund fails.
    console.error(`daily notice ${template} failed:`, e instanceof Error ? e.message : String(e));
  }
}
