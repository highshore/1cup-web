// One-time seed for the leaderboard "celebration" wall.
// Inserts the SK하이닉스 achievement that previously lived in the homepage popup.
// Idempotent: re-running will not create duplicates.
//
// Usage: node scripts/seed-celebrations.mjs
import { supabase } from "./_supabase.mjs";

const TABLE = "celebrations";

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
    const { data: existing, error: selectError } = await supabase
      .from(TABLE)
      .select("id")
      .eq("headline", entry.headline)
      .eq("member_name", entry.memberName)
      .limit(1);
    if (selectError) throw selectError;

    if (existing?.length) {
      console.log(`Skip (exists): ${entry.memberName} — ${entry.headline}`);
      continue;
    }

    // celebrations.id is TEXT with no default (it used to be a Firestore doc id),
    // so generate one — same as createCelebration() in celebration_service.ts.
    const row = {
      id: crypto.randomUUID(),
      member_name: entry.memberName,
      headline: entry.headline,
      achieved_at: new Date(entry.achievedAt ?? Date.now()).toISOString(),
    };
    if (entry.description) row.description = entry.description;
    if (entry.logoUrl) row.logo_url = entry.logoUrl;

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;

    console.log(`Seeded: ${entry.memberName} — ${entry.headline} (${inserted.id})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
