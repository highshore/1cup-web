// kakao-login — Supabase Edge Function (Deno)
// ---------------------------------------------------------------------------
// PORT of the Firebase Cloud Function `processKakaoUser`
// (functions/src/processKakaoUser.ts).
//
// HOW THIS MAPS ONTO SUPABASE'S NATIVE KAKAO PROVIDER
// ---------------------------------------------------------------------------
// In Firebase, Kakao was wired up as a generic OIDC provider: the client got a
// temporary OIDC user, then this function did the heavy lifting — fetch the
// Kakao profile, find/merge the real account, and mint a Firebase custom token
// so the client could re-auth as the merged user.
//
// Supabase ships a FIRST-CLASS Kakao OAuth provider. The provider itself now
// owns the entire OAuth dance (redirect, code exchange, session/JWT minting,
// `auth.users` row, `auth.identities` row with provider='kakao'). There is no
// temporary-user-then-custom-token shuffle anymore — after `signInWithOAuth`
// the client already holds a valid Supabase session.
//
// So the *only* thing left for us to do is the APPLICATION-SIDE account merge
// against `public.users` (the mirror of the old Firestore `users` collection).
// This function is therefore a POST-OAUTH RECONCILIATION HOOK: call it ONCE,
// right after the first successful Kakao sign-in, with the user's Authorization
// bearer token. It replicates the original 3-priority MERGE so a returning
// customer who previously signed up by phone (or by Kakao under a different
// auth identity) keeps their existing `public.users` row instead of getting a
// duplicate.
//
// WHY THIS IS STILL NEEDED WITH THE NATIVE PROVIDER
// ---------------------------------------------------------------------------
// handle_new_user() already matches a new auth user against public.users by
// kakao_id, phone and email. What it cannot do is match on a phone number it never
// receives: Kakao's OIDC id_token carries `phone_verified` but not the number
// itself — that lives only in kapi.kakao.com's `kakao_account.phone_number`, even
// when the consent item is set to 필수 동의. Users who signed up by phone and have
// no kakao_id on file are therefore invisible to the trigger, and a Kakao sign-in
// leaves them with a duplicate profile.
//
// This hook closes that gap: fetch the real number with the caller's Kakao access
// token, find the profile by kakao_id (exact) or phone, and point this auth user's
// identity link at it. It ADDS a row to user_auth_identities rather than repointing
// users.auth_id, so the person's other login method keeps working; a stub profile
// the trigger just created is removed only when nothing references it.
//
// public.users columns used:
//   uid, auth_id (uuid), email, display_name, photo_url, phone, kakao_id,
//   last_login_at, created_at
//
// Request body (POST JSON):
//   { kakaoAccessToken: string }      // Kakao access token from the OAuth flow
// The caller is identified from the Authorization: Bearer <supabase-jwt> header
// (the post-OAuth session), NOT from the body — the body's only job is to let
// us read the Kakao profile from kapi.kakao.com.
// ---------------------------------------------------------------------------

import { preflight, json } from "../_shared/cors.ts";
import { admin, env } from "../_shared/db.ts";

// Normalize a raw phone to E.164 (+8210XXXXXXXX), faithful to the original
// Firebase `normalizePhoneNumber`. Returns null if it isn't a valid KR mobile.
function normalizeToE164(phoneNumber: string | undefined | null): string | null {
  if (!phoneNumber) return null;
  let cleaned = phoneNumber.startsWith("+")
    ? "+" + phoneNumber.replace(/[^0-9]/g, "")
    : phoneNumber.replace(/[^0-9]/g, "");

  if (cleaned.startsWith("+8201")) {
    cleaned = "+82" + cleaned.substring(4);
  } else if (cleaned.startsWith("01")) {
    cleaned = "+82" + cleaned.substring(1);
  } else if (cleaned.startsWith("82") && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return /^\+821[0-9]{8,9}$/.test(cleaned) ? cleaned : null;
}

// The rest of the app stores phones as 010XXXXXXXX (digits only). Convert the
// E.164 form (+8210…) to that local form. Mirrors _shared/kakao.ts `krPhone`.
function toLocalPhone(e164: string | null): string | null {
  if (!e164) return null;
  return e164.replace(/^\+82/, "0").replace(/\D/g, "");
}

interface KakaoAccount {
  phone_number?: string;
  email?: string;
  profile?: {
    nickname?: string;
    profile_image_url?: string;
  };
}

interface KakaoUserInfo {
  id?: number | string;
  kakao_account?: KakaoAccount;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const pf = preflight(req);
  if (pf) return pf;

  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405);
  }

  // --- 1. Identify the authenticated Supabase user (post-OAuth session) ------
  const authz = req.headers.get("Authorization");
  if (!authz) {
    return json(req, { error: "unauthenticated", message: "Missing Authorization bearer token." }, 401);
  }

  const a = admin();
  const jwt = authz.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await a.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return json(req, { error: "unauthenticated", message: "Invalid or expired session token." }, 401);
  }
  const authUser = userData.user;
  const authId = authUser.id; // uuid in auth.users (== public.users.auth_id)

  // --- 2. Parse request body -------------------------------------------------
  let body: { kakaoAccessToken?: string };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid-argument", message: "Request body must be JSON." }, 400);
  }
  const kakaoAccessToken = body.kakaoAccessToken;
  if (!kakaoAccessToken || typeof kakaoAccessToken !== "string") {
    return json(req, { error: "invalid-argument", message: "Missing or invalid 'kakaoAccessToken' string." }, 400);
  }

  // --- 3. Fetch the Kakao profile (faithful to the original) -----------------
  let kakaoUserInfo: KakaoUserInfo;
  try {
    const params = new URLSearchParams({
      property_keys: JSON.stringify([
        "kakao_account.phone_number",
        "kakao_account.profile",
        "kakao_account.email",
      ]),
    });
    const res = await fetch(`https://kapi.kakao.com/v2/user/me?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("Error fetching Kakao user info:", res.status, detail);
      return json(req, { error: "internal", message: "Failed to fetch Kakao user info." }, 502);
    }
    kakaoUserInfo = await res.json();
    console.log("Kakao raw user info for auth user", authId, JSON.stringify(kakaoUserInfo));
  } catch (e) {
    console.error("Error fetching Kakao user info:", e);
    return json(req, { error: "internal", message: "Failed to fetch Kakao user info." }, 502);
  }

  // Kakao "sub"/id — the stable kakao identifier. Stored as a string.
  const kakaoSub =
    kakaoUserInfo.id !== undefined && kakaoUserInfo.id !== null
      ? String(kakaoUserInfo.id)
      : null;
  if (!kakaoSub) {
    return json(req, { error: "internal", message: "Kakao profile did not include an id." }, 502);
  }

  // --- 4. Parse profile fields (faithful to the original) --------------------
  const account = kakaoUserInfo.kakao_account ?? {};
  const kakaoPhoneNumberRaw = account.phone_number;
  const kakaoEmail = account.email ?? null;
  const kakaoProfileNickname = account.profile?.nickname ?? null;

  let kakaoProfileImageUrl = account.profile?.profile_image_url ?? null;
  if (kakaoProfileImageUrl && kakaoProfileImageUrl.startsWith("http://")) {
    kakaoProfileImageUrl = kakaoProfileImageUrl.replace("http://", "https://");
  }

  const normalizedKakaoPhoneE164 = normalizeToE164(kakaoPhoneNumberRaw);
  const normalizedKakaoPhone = toLocalPhone(normalizedKakaoPhoneE164); // 010… for storage
  console.log("normalizePhoneNumber - input:", kakaoPhoneNumberRaw, "output:", normalizedKakaoPhone);

  const nowIso = new Date().toISOString();

  // ===========================================================================
  // MERGE — reconcile this Kakao auth user with the person's existing profile.
  //
  // The native provider already ran handle_new_user(), which matched on kakao_id /
  // phone / email and linked or created a row. It cannot match a phone the trigger
  // never saw, though: Kakao's OIDC id_token carries no phone number, only
  // `phone_verified`. That is why this hook exists — it reads the real number from
  // kapi.kakao.com and retries the match with it.
  // ===========================================================================

  // Where this auth user currently points (the trigger always leaves a link).
  const { data: currentLink } = await a
    .from("user_auth_identities")
    .select("uid")
    .eq("auth_id", authId)
    .maybeSingle();
  const currentUid = (currentLink?.uid as string | undefined) ?? null;

  // The profile this person really owns: kakao_id first (exact), then phone.
  //
  // Both lookups must EXCLUDE the row this session currently points at. When the
  // trigger cannot match anyone it creates a fresh row and stamps the kakao_id on it,
  // so an unfiltered kakao_id search finds that brand-new row, decides the session is
  // already correct, and never tries the phone — which is the only identifier that can
  // reach the real profile. That is exactly the duplicate this hook exists to prevent.
  //
  // No `auth_id is null` filter either: every migrated row already has an auth_id from
  // the seeded phone identity, so requiring null made the phone path unreachable for
  // precisely the people who need it.
  const COLUMNS = "uid, auth_id, email, display_name, photo_url, phone, kakao_id";

  const lookup = async (column: "kakao_id" | "phone", value: string) => {
    let query = a.from("users").select(COLUMNS).eq(column, value);
    if (currentUid) query = query.neq("uid", currentUid);
    const { data } = await query.limit(1).maybeSingle();
    return data;
  };

  const findProfile = async () => {
    const byKakao = await lookup("kakao_id", kakaoSub);
    if (byKakao) return { row: byKakao, how: "merged_by_kakao_id" as const };

    if (normalizedKakaoPhone) {
      const byPhone = await lookup("phone", normalizedKakaoPhone);
      if (byPhone) return { row: byPhone, how: "merged_by_phone" as const };
    }
    return null;
  };

  const found = await findProfile();

  // Fill only what is empty — the existing profile always wins.
  const fillFrom = (row: { display_name?: unknown; email?: unknown; photo_url?: unknown; phone?: unknown }) => {
    const update: Record<string, unknown> = { kakao_id: kakaoSub, last_login_at: nowIso };
    if (kakaoProfileNickname && !row.display_name) update.display_name = kakaoProfileNickname;
    if (kakaoEmail && !row.email) update.email = kakaoEmail;
    if (kakaoProfileImageUrl && !row.photo_url) update.photo_url = kakaoProfileImageUrl;
    if (normalizedKakaoPhone && !row.phone) update.phone = normalizedKakaoPhone;
    return update;
  };

  // A row the trigger just created for this auth user, with nothing attached to it
  // yet, is safe to drop once the link moves to the real profile. Anything with
  // history is left alone and only unlinked — losing data would be worse than
  // leaving an orphan row for a human to look at.
  const stubIsDisposable = async (uid: string): Promise<boolean> => {
    if (uid !== authId) return false; // trigger-created rows use the auth uuid as uid
    for (const [table, column] of [
      ["payment_orders", "user_id"],
      ["meetup_participants", "user_id"],
      ["transcripts", "created_by"],
      ["speaking_reports", "user_id"],
      ["feedback", "user_id"],
    ] as const) {
      const { count } = await a.from(table).select("*", { count: "exact", head: true }).eq(column, uid);
      if ((count ?? 0) > 0) return false;
    }
    return true;
  };

  if (found && found.row.uid !== currentUid) {
    // Same person, different auth user: move the link, never repoint users.auth_id.
    const { error: linkErr } = await a
      .from("user_auth_identities")
      .upsert({ auth_id: authId, uid: found.row.uid }, { onConflict: "auth_id" });
    if (linkErr) {
      console.error("Failed to link auth identity:", linkErr.message);
      return json(req, { error: "internal", message: "Failed to link account." }, 500);
    }

    const { error: updErr } = await a.from("users").update(fillFrom(found.row)).eq("uid", found.row.uid);
    if (updErr) console.error("Failed to refresh merged row:", updErr.message);

    let removedStub = false;
    if (currentUid && (await stubIsDisposable(currentUid))) {
      const { error: delErr } = await a.from("users").delete().eq("uid", currentUid);
      if (delErr) console.error("Failed to remove stub row:", delErr.message);
      else removedStub = true;
    } else if (currentUid) {
      console.warn(`Left orphan public.users row ${currentUid}: it has history attached.`);
    }

    return json(req, {
      status: found.how,
      finalUid: found.row.uid,
      authId,
      removedStub,
      message: "Account merged: this Kakao identity now resolves to the existing profile.",
    });
  }

  // Already pointing at the right profile (or this is a genuinely new person):
  // just refresh it from the Kakao profile.
  const targetUid = found?.row.uid ?? currentUid;
  if (!targetUid) {
    return json(req, { error: "internal", message: "No profile linked to this session." }, 500);
  }

  const { data: ownRow, error: ownErr } = await a
    .from("users")
    .select("uid, auth_id, email, display_name, photo_url, phone, kakao_id")
    .eq("uid", targetUid)
    .maybeSingle();
  if (ownErr || !ownRow) {
    console.error("Error loading target row:", ownErr?.message);
    return json(req, { error: "internal", message: "Failed to load user row." }, 500);
  }

  // The native provider fills these on the auth user; use them if Kakao's API did not.
  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const update = fillFrom(ownRow);
  if (!update.display_name && !ownRow.display_name) {
    const metaName = typeof meta.name === "string" ? meta.name
      : typeof meta.full_name === "string" ? meta.full_name : null;
    if (metaName) update.display_name = metaName;
  }
  if (!update.photo_url && !ownRow.photo_url) {
    const metaAvatar = typeof meta.avatar_url === "string" ? meta.avatar_url
      : typeof meta.picture === "string" ? meta.picture : null;
    if (metaAvatar) update.photo_url = metaAvatar;
  }
  if (!update.email && !ownRow.email && authUser.email) update.email = authUser.email;

  const { error: updErr } = await a.from("users").update(update).eq("uid", ownRow.uid);
  if (updErr) {
    console.error("Failed to update public.users row:", updErr.message);
    return json(req, { error: "internal", message: "Failed to update user row." }, 500);
  }

  return json(req, {
    status: "success",
    finalUid: ownRow.uid,
    authId,
    message: "Kakao login processed; profile refreshed.",
  });
});

// NOTE: `env` from _shared/db.ts is imported per the required signature; the
// service-role client created by admin() already reads SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY internally, so no extra env lookups are needed here.
void env;
