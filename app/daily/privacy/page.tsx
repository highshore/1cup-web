import { Metadata } from "next";
import { DailyPrivacyDocument } from "../../lib/features/daily/components/DailyLegal";
import DailyLegalPage from "../../lib/features/daily/components/DailyLegalPage";

export const metadata: Metadata = {
  title: "개인정보 수집·이용 안내 | 1cup Daily",
  description: "영어 한잔 Daily가 수집하는 개인정보와 이용 목적, 보유 기간",
};

export default function DailyPrivacyPage() {
  return (
    <DailyLegalPage title="개인정보 수집·이용 안내">
      <DailyPrivacyDocument />
    </DailyLegalPage>
  );
}
