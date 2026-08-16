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
// Mapping of the original 3 priorities (Firebase Auth + Firestore) onto
// public.users:
//   1. Match by PHONE  (a public.users row with the same normalized phone and
//      no auth_id yet) -> link it: set auth_id + kakao_id. This is the
//      "merge_by_phone" path (was: Firebase Auth getUserByPhoneNumber).
//   2. Match by KAKAO_ID (a public.users row already carrying this kakao_id)
//      -> link/refresh it. This is the "merge_by_kakao_id" path
//      (was: Firestore where kakaoId == kakaoSub).
//   3. Otherwise create/update THIS auth user's own public.users row from the
//      Kakao profile. This is the "success" path (was: P3 OIDC user finalize).
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
  // PRIORITY 1 — match by phone, row not yet linked to any auth identity.
  // (was: Firebase Auth getUserByPhoneNumber + merge into that account)
  // ===========================================================================
  if (normalizedKakaoPhone) {
    const { data: phoneRow, error: phoneErr } = await a
      .from("users")
      .select("uid, auth_id, email, display_name, photo_url, phone, kakao_id")
      .eq("phone", normalizedKakaoPhone)
      .is("auth_id", null)
      .limit(1)
      .maybeSingle();

    if (phoneErr) {
      console.error("Error querying users by phone:", phoneErr.message);
      // Non-fatal: fall through to kakao_id / create paths (mirrors original).
    } else if (phoneRow) {
      console.log(`Found unlinked public.users row by phone. uid=${phoneRow.uid}`);

      // Link the phone-matched row to this auth identity + Kakao. Only fill
      // profile fields that are currently empty (faithful "only if empty").
      const update: Record<string, unknown> = {
        auth_id: authId,
        kakao_id: kakaoSub,
        last_login_at: nowIso,
      };
      if (kakaoProfileNickname && !phoneRow.display_name) update.display_name = kakaoProfileNickname;
      if (kakaoEmail && !phoneRow.email) update.email = kakaoEmail;
      if (kakaoProfileImageUrl && !phoneRow.photo_url) update.photo_url = kakaoProfileImageUrl;

      const { error: linkErr } = await a.from("users").update(update).eq("uid", phoneRow.uid);
      if (linkErr) {
        console.error("Failed to link phone-matched user:", linkErr.message);
        return json(req, { error: "internal", message: "Failed to merge by phone." }, 500);
      }

      return json(req, {
        status: "merged_by_phone",
        finalUid: phoneRow.uid,
        authId,
        message: "Account merged: Kakao identity linked to existing phone-verified user.",
      });
    } else {
      console.log(`No unlinked public.users row with phone '${normalizedKakaoPhone}'. Checking by kakao_id.`);
    }
  }

  // ===========================================================================
  // PRIORITY 2 — match by kakao_id already present on a row.
  // (was: Firestore where kakaoId == kakaoSub + merge into that account)
  // ===========================================================================
  {
    const { data: kakaoRow, error: kakaoErr } = await a
      .from("users")
      .select("uid, auth_id, email, display_name, photo_url, phone, kakao_id")
      .eq("kakao_id", kakaoSub)
      .limit(1)
      .maybeSingle();

    if (kakaoErr) {
      console.error("Error querying users by kakao_id:", kakaoErr.message);
      // Non-fatal: fall through to create path (mirrors original).
    } else if (kakaoRow) {
      console.log(`Found public.users row by kakao_id=${kakaoSub}. uid=${kakaoRow.uid}`);

      const update: Record<string, unknown> = {
        kakao_id: kakaoSub,
        last_login_at: nowIso,
      };
      // Ensure the row is linked to this auth identity if it wasn't already.
      if (!kakaoRow.auth_id) update.auth_id = authId;
      // Fill empty profile fields only.
      if (kakaoProfileNickname && !kakaoRow.display_name) update.display_name = kakaoProfileNickname;
      if (kakaoEmail && !kakaoRow.email) update.email = kakaoEmail;
      if (kakaoProfileImageUrl && !kakaoRow.photo_url) update.photo_url = kakaoProfileImageUrl;
      if (normalizedKakaoPhone && !kakaoRow.phone) update.phone = normalizedKakaoPhone;

      const { error: linkErr } = await a.from("users").update(update).eq("uid", kakaoRow.uid);
      if (linkErr) {
        console.error("Failed to link kakao_id-matched user:", linkErr.message);
        return json(req, { error: "internal", message: "Failed to merge by kakao_id." }, 500);
      }

      return json(req, {
        status: "merged_by_kakao_id",
        finalUid: kakaoRow.uid,
        authId,
        message: "Account merged: Kakao identity linked to existing user found by kakao_id.",
      });
    } else {
      console.log(`No public.users row with kakao_id=${kakaoSub}. Finalizing this auth user.`);
    }
  }

  // ===========================================================================
  // PRIORITY 3 — create/update THIS auth user's own public.users row.
  // (was: P3 finalize Auth + Firestore for the OIDC user)
  // ===========================================================================

  // Pull any existing row already linked to this auth identity.
  const { data: ownRow, error: ownErr } = await a
    .from("users")
    .select("uid, auth_id, email, display_name, photo_url, phone, kakao_id, created_at")
    .eq("auth_id", authId)
    .limit(1)
    .maybeSingle();

  if (ownErr) {
    console.error("Error querying own user row:", ownErr.message);
    return json(req, { error: "internal", message: "Failed to load user row." }, 500);
  }

  // Best-effort display fields from the Supabase auth user metadata as a
  // fallback (the native Kakao provider populates these).
  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const metaName = typeof meta.name === "string" ? meta.name
    : typeof meta.full_name === "string" ? meta.full_name : null;
  const metaAvatar = typeof meta.avatar_url === "string" ? meta.avatar_url
    : typeof meta.picture === "string" ? meta.picture : null;

  if (!ownRow) {
    // Create a brand-new row. uid mirrors the auth uuid for new Supabase users.
    const insert = {
      uid: authId,
      auth_id: authId,
      kakao_id: kakaoSub,
      email: kakaoEmail ?? authUser.email ?? null,
      display_name: kakaoProfileNickname ?? metaName ?? null,
      photo_url: kakaoProfileImageUrl ?? metaAvatar ?? null,
      phone: normalizedKakaoPhone ?? null,
      last_login_at: nowIso,
      created_at: nowIso,
    };
    const { error: insErr } = await a.from("users").insert(insert);
    if (insErr) {
      console.error("Failed to create public.users row:", insErr.message);
      return json(req, { error: "internal", message: "Failed to create user row." }, 500);
    }
    console.log(`Created NEW public.users row for auth user ${authId}.`);

    return json(req, {
      status: "success_oidc_user",
      finalUid: authId,
      authId,
      message: "Kakao login processed. New public.users row created for this user.",
    });
  }

  // Update the existing row — fill empties, refresh kakao_id + last_login_at.
  const update: Record<string, unknown> = {
    kakao_id: kakaoSub,
    last_login_at: nowIso,
  };
  if (kakaoProfileNickname && !ownRow.display_name) update.display_name = kakaoProfileNickname;
  if (kakaoEmail && !ownRow.email) update.email = kakaoEmail;
  if (kakaoProfileImageUrl && !ownRow.photo_url) update.photo_url = kakaoProfileImageUrl;
  if (normalizedKakaoPhone && !ownRow.phone) update.phone = normalizedKakaoPhone;

  const { error: updErr } = await a.from("users").update(update).eq("uid", ownRow.uid);
  if (updErr) {
    console.error("Failed to update public.users row:", updErr.message);
    return json(req, { error: "internal", message: "Failed to update user row." }, 500);
  }
  console.log(`Updated EXISTING public.users row for auth user ${authId} (uid=${ownRow.uid}).`);

  return json(req, {
    status: "success_oidc_user",
    finalUid: ownRow.uid,
    authId,
    message: "Kakao login processed. Existing public.users row updated for this user.",
  });
});

// NOTE: `env` from _shared/db.ts is imported per the required signature; the
// service-role client created by admin() already reads SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY internally, so no extra env lookups are needed here.
void env;
