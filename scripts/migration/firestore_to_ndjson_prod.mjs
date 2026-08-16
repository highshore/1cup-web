// Dump every Firestore collection from PRODUCTION (Admin SDK) to NDJSON.
// Delta-refresh variant of firestore_to_ndjson.mjs (which reads the emulator).
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json \
//   GOOGLE_CLOUD_PROJECT=one-cup-eng \
//     node firestore_to_ndjson_prod.mjs
//
// Reads LIVE production — NOT a frozen snapshot. Fine for a testing delta refresh;
// for the final cutover, run this during a write-freeze so cross-collection state
// is consistent. Output: ../data/<collection>.ndjson (identical format to the
// emulator dumper, so load_to_supabase.mjs consumes it unchanged).

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR } from "./_data_dir.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = DATA_DIR;
mkdirSync(OUT, { recursive: true });

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Refusing to run: set GOOGLE_APPLICATION_CREDENTIALS to a one-cup-eng service-account JSON.");
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "one-cup-eng",
});
const db = getFirestore();

const COLLECTIONS = [
  "articles", "billing_stops", "blog_posts", "cache", "cefr", "cefr_runs",
  "celebrations", "communityAnnouncements", "communityComments", "communityTopics",
  "en_dict", "feedback", "links", "meetup", "meetup_reports", "payment_cancellations",
  "payment_orders", "referral_codes", "reports", "shadow", "transcripts", "users", "words",
];

// Recursively serialize Firestore values to JSON-safe forms.
function ser(v) {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(ser);
  if (v && typeof v === "object" && v.constructor === Object)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)]));
  if (v && typeof v === "object" && typeof v.path === "string") return v.path; // DocumentReference
  return v;
}

async function dumpCollection(name, fileLabel = name) {
  const snap = await db.collection(name).get();
  const out = createWriteStream(join(OUT, `${fileLabel}.ndjson`));
  let n = 0;
  for (const doc of snap.docs) {
    out.write(JSON.stringify({ __id: doc.id, __path: doc.ref.path, ...ser(doc.data()) }) + "\n");
    n++;
  }
  out.end();
  console.log(`${fileLabel.padEnd(24)} ${n}`);
  return snap.docs;
}

// Dump a named subcollection under every parent doc, into one file.
async function dumpSubcollection(parents, sub, fileLabel) {
  const out = createWriteStream(join(OUT, `${fileLabel}.ndjson`));
  let n = 0;
  for (const p of parents) {
    const snap = await p.ref.collection(sub).get();
    for (const doc of snap.docs) {
      out.write(JSON.stringify({
        __id: doc.id, __path: doc.ref.path, __parent: p.id, ...ser(doc.data()),
      }) + "\n");
      n++;
    }
  }
  out.end();
  console.log(`${fileLabel.padEnd(24)} ${n}`);
}

console.log("collection               docs");
console.log("------------------------ ----");
const articleDocs = await dumpCollection("articles");
const meetupReportDocs = await dumpCollection("meetup_reports");
const userDocs = await dumpCollection("users");

for (const c of COLLECTIONS) {
  if (["articles", "meetup_reports", "users"].includes(c)) continue;
  await dumpCollection(c);
}

// subcollections -> child tables
await dumpSubcollection(articleDocs, "meanings", "article_meanings");
await dumpSubcollection(meetupReportDocs, "users", "meetup_report_users");
await dumpSubcollection(userDocs, "speaking_reports", "users_speaking_reports");

console.log("\nDone. NDJSON written to", OUT);
