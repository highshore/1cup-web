import AdminDailySentencesClient from "./DailyAdminSentencesClient";

export const metadata = { title: "함께 쓰는 문장 | Daily 관리자", robots: { index: false, follow: false } };

export default function DailyAdminSentencesPage() {
  return <AdminDailySentencesClient />;
}
