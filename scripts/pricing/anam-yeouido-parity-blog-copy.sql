-- Manual content-only cutover step. DO NOT run before new Anam prices are active.
-- Does not modify payment_products, users, payment_orders, or participation credits.
-- Existing referral rewards/discount rules remain governed by checkout at purchase time.
BEGIN;
UPDATE public.blog_posts
SET content = regexp_replace(
    content,
    '### 지인 추천 시 혜택.*?### 지인 추천 방법',
    $replacement$### 지인 추천 시 혜택\n\n* 신규 회원 30일 멤버십: 정가 19,700원 → 추천 코드 첫 구매 시 16,500원 (3,200원 할인)\n* 신규 회원 5회 참여권: 정가 29,700원 → 추천 코드 첫 구매 시 26,700원 (3,000원 할인)\n\n추천 코드는 원칙적으로 첫 유료 구매에 적용됩니다. 멤버십을 계속 유지하는 기존 회원에게는 기존에 적용된 정기결제 금액이 보호됩니다. 추천인 본인의 혜택 및 기타 프로모션은 개별 적용 조건에 따릅니다. 정확한 최종 결제금액은 결제 화면에서 확인해 주세요.\n\n### 지인 추천 방법$replacement$,
    's'
  ),
  updated_at = NOW()
WHERE id = 'TYQJWy36D79bb3A7EkDo'
  AND title = '지인 추천 할인 이벤트'
  AND status = 'published'
  AND content LIKE '%### 지인 추천 시 혜택%'
  AND content LIKE '%### 지인 추천 방법%';
-- Expect UPDATE 1. If no row was updated, ROLLBACK and inspect current post.
COMMIT;
