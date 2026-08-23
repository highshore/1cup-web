import { NextResponse } from "next/server";
import { consumeCode, OtpError } from "../../../lib/otp/service";
import { admin, createServerClientRSC } from "../../../lib/supabase/server";

export const runtime = "nodejs";

// POST /api/account/link-phone  { phone, code }
//
// Attaches the caller's current login to the profile that already owns this number.
// The code sent to that number is the proof — which is the point: Kakao withholds the
// phone for about half our members, so no amount of provider data would settle it.
//
// Runs on the caller's own session only. The service-role client is used for the
// lookup and the relink, both of which are constrained inside link_identity_to_profile.
export async function POST(req: Request) {
  try {
    const { phone, code } = await req.json();
    if (typeof phone !== "string" || typeof code !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = await createServerClientRSC();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // Consume first: a wrong code must burn an attempt whether or not the number
    // belongs to anyone, so this cannot be used to probe which numbers are registered.
    const local = await consumeCode(phone, code);

    const db = admin();
    const { data: target } = await db
      .from("users")
      .select("uid, display_name, has_active_subscription")
      .eq("phone", local)
      .maybeSingle();

    if (!target) {
      return NextResponse.json(
        { error: "이 번호로 가입된 기존 계정을 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const { data: result, error } = await db.rpc("link_identity_to_profile", {
      p_auth_id: auth.user.id,
      p_target_uid: target.uid,
    });
    if (error) {
      // The function raises for the cases it refuses to handle; surface them as-is,
      // they are already written for a person to read.
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      result,
      displayName: target.display_name ?? null,
      hasActiveSubscription: Boolean(target.has_active_subscription),
    });
  } catch (err) {
    if (err instanceof OtpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("account/link-phone:", err);
    return NextResponse.json({ error: "계정 연결에 실패했습니다." }, { status: 500 });
  }
}

// DELETE — the member says this is not a duplicate. Stop asking.
export async function DELETE() {
  try {
    const supabase = await createServerClientRSC();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const db = admin();
    const { data: link } = await db
      .from("user_auth_identities")
      .select("uid")
      .eq("auth_id", auth.user.id)
      .maybeSingle();
    if (link?.uid) {
      await db.from("users").update({ identity_unmatched: false }).eq("uid", link.uid);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("account/link-phone dismiss:", err);
    return NextResponse.json({ error: "처리에 실패했습니다." }, { status: 500 });
  }
}
