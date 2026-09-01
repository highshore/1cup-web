import { NextResponse } from "next/server";
import { admin, createServerClientRSC } from "../../../lib/supabase/server";

export const runtime = "nodejs";

// POST /api/auth/session-event  { event, reason?, }
//
// The browser reporting that a sign-in ended without the member asking it to. Only the
// client can tell that apart from a deliberate sign-out, and nothing else records it —
// auth.sessions shows a session that stopped refreshing whether the person was logged
// out or simply never came back.
//
// Deliberately forgiving: a report arrives while the session is already gone, so it
// cannot require one. Whatever identity is still readable gets attached; the row is
// worth having either way.
const ALLOWED_EVENTS = new Set([
  "signed_out_unexpectedly",
  "session_missing_on_load",
]);

export async function POST(req: Request) {
  try {
    const { event, reason } = await req.json();
    if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    let authId: string | null = null;
    let uid: string | null = null;
    try {
      const supabase = await createServerClientRSC();
      const { data } = await supabase.auth.getUser();
      authId = data?.user?.id ?? null;
      if (authId) {
        const { data: link } = await admin()
          .from("user_auth_identities")
          .select("uid")
          .eq("auth_id", authId)
          .maybeSingle();
        uid = (link?.uid as string) ?? null;
      }
    } catch {
      // Expected on the path this exists to record: the session is already gone.
    }

    await admin().from("auth_session_events").insert({
      uid,
      auth_id: authId,
      event,
      reason: typeof reason === "string" ? reason.slice(0, 200) : null,
      // Which browser, not who: this is the field that would show an in-app browser or
      // one platform losing sessions where others do not.
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Reporting must never be the reason a page breaks.
    console.error("auth/session-event:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
