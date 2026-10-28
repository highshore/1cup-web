import AdminDailyRefundsClient from "./DailyAdminRefundsClient";

export const metadata = { title: "Daily 환불 | Daily 관리자", robots: { index: false, follow: false } };

export default function DailyAdminRefundsPage() {
  return <AdminDailyRefundsClient />;
}
