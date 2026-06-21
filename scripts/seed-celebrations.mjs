// One-time seed for the leaderboard "celebration" wall.
// Inserts the SK하이닉스 achievement that previously lived in the homepage popup.
// Idempotent: re-running will not create duplicates.
//
// Usage: node scripts/seed-celebrations.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

// The key in .env.local is wrapped in quotes and may use escaped newlines.
let privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").trim();
if (
  (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
  (privateKey.startsWith("'") && privateKey.endsWith("'"))
) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local"
  );
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const COLLECTION = "celebrations";

// achievedAt is an ISO date string (or null). Idempotent on (memberName, headline).
const SEED = [
  {
    memberName: "남OO",
    headline: "SK하이닉스 합격",
    description:
      "국내 대표 반도체 기업에서 새 커리어를 시작하게 된 멤버의 성장을 함께 축하합니다.",
    logoUrl: "/assets/homepage/logos/sk-hynix.webp",
    achievedAt: "2026-06-21",
  },
  {
    memberName: "김OO",
    headline: "SAP 인턴 합격",
    achievedAt: "2026-06-01",
  },
  {
    memberName: "김OO",
    headline: "AWS 인턴 합격",
    achievedAt: "2026-06-01",
  },
  {
    memberName: "최OO",
    headline: "Penn State 박사 합격",
    achievedAt: "2026-04-01",
  },
];

async function main() {
  for (const entry of SEED) {
    const existing = await db
      .collection(COLLECTION)
      .where("headline", "==", entry.headline)
      .where("memberName", "==", entry.memberName)
      .get();

    if (!existing.empty) {
      console.log(
        `Skip (exists): ${entry.memberName} — ${entry.headline}`
      );
      continue;
    }

    const now = Timestamp.now();
    const doc = {
      memberName: entry.memberName,
      headline: entry.headline,
      createdAt: now,
      updatedAt: now,
    };
    if (entry.description) doc.description = entry.description;
    if (entry.logoUrl) doc.logoUrl = entry.logoUrl;
    doc.achievedAt = entry.achievedAt
      ? Timestamp.fromDate(new Date(entry.achievedAt))
      : now;

    const ref = await db.collection(COLLECTION).add(doc);
    console.log(`Seeded: ${entry.memberName} — ${entry.headline} (${ref.id})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
