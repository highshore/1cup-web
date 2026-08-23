import UnifiedErrorPanel from "./lib/components/UnifiedErrorPanel";

export default function NotFound() {
  return (
    <UnifiedErrorPanel
      title="페이지를 찾을 수 없습니다"
      message="주소가 잘못되었거나, 삭제되었거나, 더 이상 공개되지 않는 페이지입니다."
      homeHref="/"
    />
  );
}
