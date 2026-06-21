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

const SEED = {
  memberName: "남OO",
  headline: "SK하이닉스 합격",
  description:
    "국내 대표 반도체 기업에서 새 커리어를 시작하게 된 멤버의 성장을 함께 축하합니다.",
  logoUrl: "/assets/homepage/logos/sk-hynix.webp",
};

async function main() {
  const existing = await db
    .collection(COLLECTION)
    .where("headline", "==", SEED.headline)
    .where("memberName", "==", SEED.memberName)
    .get();

  if (!existing.empty) {
    console.log(`Already seeded (${existing.size} match). Skipping.`);
    return;
  }

  const now = Timestamp.now();
  const ref = await db.collection(COLLECTION).add({
    ...SEED,
    achievedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Seeded SK하이닉스 celebration with id: ${ref.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
