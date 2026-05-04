import LeaderboardClient from "./LeaderboardClient";

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}

export async function generateMetadata() {
  return {
    title: "리더보드 | 영어 한잔",
    description: "영어 한잔 밋업 참여 랭킹과 신규 유료 멤버를 확인하세요.",
  };
}
