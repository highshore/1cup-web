// Backfill public.users.phone / email from Firebase Auth (the Firestore-only migration
// missed phone-auth users, whose phone/email live in Firebase Auth, not the users doc).
// Only fills columns that are currently empty; normalizes phone to the stored 010… form.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json GOOGLE_CLOUD_PROJECT=one-cup-eng \
//   SUPABASE_DB_URL='postgresql://...' node backfill_auth_identifiers.mjs
import pg from "pg";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || "one-cup-eng" });
const auth = getAuth();

const toLocal = (p) => {
  if (!p) return null;
  const d = String(p).replace(/^\+?82/, "0").replace(/\D/g, "");
  return d.startsWith("010") && d.length >= 10 ? d : d || null;
};

// uid -> {phone,email} from Firebase Auth
const fb = new Map();
let pageToken;
do {
  const res = await auth.listUsers(1000, pageToken);
  res.users.forEach((u) => fb.set(u.uid, { phone: u.phoneNumber || null, email: u.email || null }));
  pageToken = res.pageToken;
} while (pageToken);
console.log("Firebase Auth users:", fb.size);

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
const { rows } = await c.query(
  "select uid, phone, email from public.users where uid !~ '^[0-9a-f]{8}-'",
);

let phoneFilled = 0, emailFilled = 0;
for (const r of rows) {
  const f = fb.get(r.uid);
  if (!f) continue;
  const sets = [];
  const vals = [];
  if ((!r.phone || r.phone === "") && f.phone) {
    const local = toLocal(f.phone);
    if (local && local.startsWith("010")) { sets.push("phone"); vals.push(local); }
  }
  if ((!r.email || r.email === "") && f.email) { sets.push("email"); vals.push(f.email); }
  if (!sets.length) continue;
  const setSql = sets.map((col, i) => `${col} = $${i + 1}`).join(", ");
  await c.query(`update public.users set ${setSql} where uid = $${sets.length + 1}`, [...vals, r.uid]);
  if (sets.includes("phone")) phoneFilled++;
  if (sets.includes("email")) emailFilled++;
}
console.log("phone backfilled:", phoneFilled, "| email backfilled:", emailFilled);
await c.end();
process.exit(0);
