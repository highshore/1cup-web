// How a Daily review is signed on the landing page: 소속, 직종 and the first letter of the
// Kakao name, e.g. "삼성전자 재무·회계 김00 님" or "고려대 학생 이00 님". Shared by the
// server (which stores it with the review) and the review page (which previews it).
export function reviewerLabel(workplace: string, jobCategory: string, name: string | null | undefined): string {
  const initial = Array.from((name ?? "").trim())[0] ?? "";
  const parts = [workplace.trim(), jobCategory === "기타" ? "" : jobCategory.trim()].filter(Boolean);
  parts.push(initial ? `${initial}00 님` : "회원님");
  return parts.join(" ");
}
