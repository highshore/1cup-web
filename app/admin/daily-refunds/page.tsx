import { redirect } from "next/navigation";

// Moved to One Cup Daily's own admin; kept so older links and refund notices still land.
export default function MovedDailyRefunds() {
  redirect("/daily/admin/refunds");
}
