// Server-only: who may use One Cup Daily's admin. A 1cup admin account (users.account_status
// 'admin') whose phone number is on daily_config.admin_access_phones; being a 1cup admin
// alone is not enough. The daily Edge Function applies the same rule (callerIsAdmin).
import { admin } from "../../../supabase/server";

/** 010…, digits only, from however the number was stored (+82 10-…, 010-…). */
export function normalizeKoreanPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
}

export async function isDailyAdmin(uid: string): Promise<boolean> {
  const db = admin();
  const [user, config] = await Promise.all([
    db.from("users").select("account_status, phone").eq("uid", uid).maybeSingle(),
    db.from("daily_config").select("admin_access_phones").eq("id", "settings").maybeSingle(),
  ]);
  if (user.data?.account_status !== "admin") return false;
  const allowed = (config.data?.admin_access_phones as string[] | null) ?? [];
  const phone = normalizeKoreanPhone(user.data.phone as string | null);
  return phone.length > 0 && allowed.includes(phone);
}
