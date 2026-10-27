import DailyLoading from "../lib/features/daily/components/DailyLoading";

// Shown while a /daily route renders on the server (a lesson link, 내 계정, …), in place
// of the site-wide Lottie screen, so Daily has a single loader throughout.
export default function Loading() {
  return <DailyLoading label="불러오고 있어요" />;
}
