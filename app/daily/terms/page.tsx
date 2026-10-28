import { Metadata } from "next";
import { DailyTermsDocument } from "../../lib/features/daily/components/DailyLegal";
import DailyLegalPage from "../../lib/features/daily/components/DailyLegalPage";

export const metadata: Metadata = {
  title: "이용약관 | One Cup Daily",
  description: "영어 한잔 Daily 이용약관과 환불 규정",
};

export default function DailyTermsPage() {
  return (
    <DailyLegalPage type="terms" title="이용약관">
      <DailyTermsDocument />
    </DailyLegalPage>
  );
}
