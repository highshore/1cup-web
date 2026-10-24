import { Metadata } from "next";
import GrowthDashboard from "../../lib/features/growth/components/GrowthDashboard";

export const metadata: Metadata = {
  title: "Marketing - Admin - OneCup English",
  description: "Schedule Gopas posts and review marketing performance",
};

// Admin access is enforced by app/admin/layout.tsx; the dashboard loads its own data.
export default function AdminMarketingPage() {
  return (
    <div className="flex flex-col pt-0 px-5 pb-5 max-w-[1400px] mx-auto gap-[30px] bg-transparent">
      <GrowthDashboard />
    </div>
  );
}
