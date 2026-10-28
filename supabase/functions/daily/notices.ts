// KakaoTalk notices about a customer's account: payments, refunds, refund requests.
//
// They go out through the approved general-purpose 1cup template (`send-article`): a
// title line, a name and a link. The dedicated notice templates in ALIMTALK_TEMPLATES.md
// replace it once Kakao approves them.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendKakaoMessages } from "../_shared/kakao.ts";

const SITE_HOST = (Deno.env.get("DAILY_SITE_URL") || "https://1cupenglish.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");

export function won(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

export async function notify(_db: SupabaseClient, phones: string[], title: string, name: string, path: string) {
  if (phones.length === 0) return;
  try {
    await sendKakaoMessages(
      phones.map((phone) => ({
        recipientNo: phone,
        templateParameter: { "korean-title": title, "customer-name": name, "article-link": `${SITE_HOST}${path}` },
      })),
      "send-article",
    );
  } catch (e) {
    // A notice is never the reason a request, payment or refund fails.
    console.error("daily notice failed:", e instanceof Error ? e.message : String(e));
  }
}
