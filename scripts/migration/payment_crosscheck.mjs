// payment_crosscheck.mjs — diff each user's subscription/payment status Firebase vs Supabase.
// Verifies the delta load copied the access-critical payment fields correctly.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json GOOGLE_CLOUD_PROJECT=one-cup-eng \
//   SUPABASE_DB_URL='postgresql://...' node payment_crosscheck.mjs
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import pg from "pg";

initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || "one-cup-eng" });
const fdb = getFirestore();

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
const { rows } = await c.query(
  "select uid, has_active_subscription, subscription_end_date, billing_key, plan_price, billing_cancelled from public.users",
);
const sup = new Map(rows.map((r) => [r.uid, r]));

const day = (v) => {
  if (!v) return null;
  if (v.toDate) return v.toDate().toISOString().slice(0, 10); // Firestore Timestamp
  return new Date(v).toISOString().slice(0, 10);
};

const snap = await fdb.collection("users").get();
let checked = 0, missing = 0, mismatch = 0;
const problems = [];
for (const d of snap.docs) {
  checked++;
  const f = d.data();
  const s = sup.get(d.id);
  if (!s) {
    missing++;
    problems.push({ uid: d.id, issue: "MISSING in Supabase", fb_active: !!f.hasActiveSubscription });
    continue;
  }
  const diffs = [];
  if (!!f.hasActiveSubscription !== !!s.has_active_subscription)
    diffs.push(`active ${!!f.hasActiveSubscription}→${!!s.has_active_subscription}`);
  if (day(f.subscriptionEndDate) !== day(s.subscription_end_date))
    diffs.push(`end ${day(f.subscriptionEndDate)}→${day(s.subscription_end_date)}`);
  if ((f.billingKey ? 1 : 0) !== (s.billing_key ? 1 : 0))
    diffs.push(`billingKey ${f.billingKey ? "set" : "none"}→${s.billing_key ? "set" : "none"}`);
  if (!!f.billingCancelled !== !!s.billing_cancelled)
    diffs.push(`cancelled ${!!f.billingCancelled}→${!!s.billing_cancelled}`);
  if (diffs.length) {
    mismatch++;
    problems.push({ uid: d.id, diffs });
  }
}
console.log(`\nchecked ${checked} firebase users | missing-in-supabase ${missing} | mismatched ${mismatch}`);
console.log(`firebase active subs: ${snap.docs.filter((d) => d.data().hasActiveSubscription).length}`);
console.log(`supabase active subs: ${rows.filter((r) => r.has_active_subscription).length}`);
if (problems.length) console.log("\nproblems (first 30):\n" + JSON.stringify(problems.slice(0, 30), null, 2));
else console.log("\n✅ every Firebase user matches Supabase on active/end/billingKey/cancelled");
await c.end();
process.exit(0);
