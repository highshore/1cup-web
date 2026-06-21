// A member achievement shown on the leaderboard "celebration" wall.
// Admin-managed (mirrors the blog feature's editing model).
export interface Celebration {
  id: string;
  memberName: string; // e.g. "남OO" — displayed as entered by the admin
  headline: string; // e.g. "SK하이닉스 합격"
  description?: string; // optional supporting detail
  logoUrl?: string; // optional company / achievement logo
  achievedAt?: string | null; // ISO date string for when it happened
  createdAt: Date;
  updatedAt: Date;
}
