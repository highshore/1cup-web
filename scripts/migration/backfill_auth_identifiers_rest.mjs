// Backfill public.users.phone / email / display_name from Firebase Auth, over PostgREST.
//
// Same job as backfill_auth_identifiers.mjs, which needs SUPABASE_DB_URL (a direct
// Postgres password) and was therefore never run — leaving 37 users with no phone and 6
// with no email in Supabase even though Firebase Auth had them. The Firestore export
// only carried the users *documents*; phone-auth users keep their number in Firebase
// Auth, not in the document.
//
// Only fills columns that are currently empty and refuses to run if Firebase Auth and
// Supabase disagree on a number. users.phone is normalized to 010… by a DB trigger.
//
//   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json GOOGLE_CLOUD_PROJECT=one-cup-eng \
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node backfill_auth_identifiers_rest.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const APPLY = process.argv.includes("--apply");
initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || "one-cup-eng" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const toLocal = (p) => (p ? String(p).replace(/\D/g, "").replace(/^82/, "0") : null);

const fb = new Map();
let pageToken;
do {
  const res = await getAuth().listUsers(1000, pageToken);
  res.users.forEach((u) =>
    fb.set(u.uid, {
      phone: toLocal(u.phoneNumber),
      email: u.email || null,
      displayName: u.displayName || null,
    }));
  pageToken = res.pageToken;
} while (pageToken);

const { data: rows, error } = await sb.from("users").select("uid, phone, email, display_name").limit(5000);
if (error) throw error;

const phone = [], email = [], name = [], conflict = [];
for (const r of rows) {
  const f = fb.get(r.uid);
  if (!f) continue;
  if (f.phone && !r.phone) phone.push({ uid: r.uid, phone: f.phone });
  else if (f.phone && r.phone && r.phone !== f.phone) conflict.push({ uid: r.uid, supabase: r.phone, firebase: f.phone });
  if (f.email && !r.email) email.push({ uid: r.uid, email: f.email });
  // Firestore users documents were the only source of display_name, so people who only
  // ever existed in Firebase Auth came across nameless.
  if (f.displayName && !r.display_name) name.push({ uid: r.uid, display_name: f.displayName });
}

console.log(`firebase auth users: ${fb.size}`);
console.log(`phone fillable: ${phone.length}   email fillable: ${email.length}   name fillable: ${name.length}   conflicts: ${conflict.length}`);
if (conflict.length) { console.error("conflicts — refusing to write:", conflict.slice(0, 10)); process.exit(1); }
if (!APPLY) { console.log("dry run — pass --apply to write."); process.exit(0); }

for (const p of phone) await sb.from("users").update({ phone: p.phone }).eq("uid", p.uid).is("phone", null);
for (const e of email) await sb.from("users").update({ email: e.email }).eq("uid", e.uid).is("email", null);
for (const n of name) await sb.from("users").update({ display_name: n.display_name }).eq("uid", n.uid).is("display_name", null);
console.log("done.");
