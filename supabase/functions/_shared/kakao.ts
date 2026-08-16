// Kakao Alimtalk (NHN Toast) sender — ported from functions/src/index.ts.
// SECRETS WERE HARDCODED in the original; they now come from Edge Function secrets
// (set via `supabase secrets set`) and MUST be rotated.
export async function sendKakaoMessages(recipientList: unknown[], templateCode: string) {
  const appkey = Deno.env.get("KAKAO_APPKEY")!;
  const body = {
    senderKey: Deno.env.get("KAKAO_SENDER_KEY")!,
    templateCode,
    recipientList,
  };
  const res = await fetch(
    `https://api-alimtalk.cloud.toast.com/alimtalk/v2.2/appkeys/${appkey}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Secret-Key": Deno.env.get("KAKAO_SECRET_KEY")!,
      },
      body: JSON.stringify(body),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Kakao Alimtalk ${res.status}: ${text}`);
  return JSON.parse(text);
}

// +8210… / 010… -> 010XXXXXXXX (digits only), matching the old normalization.
export function krPhone(p?: string | null): string {
  return (p ?? "").replace(/^\+82/, "0").replace(/\D/g, "");
}
