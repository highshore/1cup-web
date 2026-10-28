import { redirect } from "next/navigation";

// Moved to One Cup Daily's own admin; kept so older links still land.
export default function MovedDailySentences() {
  redirect("/daily/admin/sentences");
}
