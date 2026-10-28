"use client";

import { DAILY_COOKIE_SETTINGS_ENABLED, openDailyCookieSettings } from "../features/daily/ads/OpenAIAdsPixel";

// cookieSettings: Daily pages, the only ones with optional measurement cookies.
export default function Footer({ cookieSettings = false }: { cookieSettings?: boolean }) {
  const linkClass =
    "text-[#4A2F23] no-underline hover:text-[#2C1810] hover:underline";
  const divider = <span className="mx-2 text-[#8B6B4F]">|</span>;

  return (
    <footer className="border-t border-[#F5EBE6] bg-white px-6 py-8 text-center text-[0.8rem] text-[#4A2F23] max-[768px]:px-4 max-[768px]:py-6 max-[768px]:text-[0.75rem]">
      <div className="mx-auto flex max-w-[850px] flex-col gap-2 [&>div]:leading-[1.4] max-[768px]:[&>div]:leading-[1.5]">
        <div>
          <a href="/vocabulary" className={linkClass}>
            내 단어장
          </a>
          {divider}
          <a href="/policy/privacy" className={linkClass}>
            개인정보처리방침
          </a>
          {divider}
          <a href="/policy/terms" className={linkClass}>
            이용약관
          </a>
          {divider}
          <a href="/policy/refund" className={linkClass}>
            환불 및 멤버십 해지
          </a>
          {cookieSettings && DAILY_COOKIE_SETTINGS_ENABLED && (
            <>
              {divider}
              <button type="button" onClick={openDailyCookieSettings} className={linkClass}>
                쿠키 설정
              </button>
            </>
          )}
        </div>
        <div>
          네이티브피티 | 549-04-02156 | 대표자 김수겸 | 이메일
          hello@1cupenglish.com | 전화 010-6858-4123
        </div>
        <div>통신판매업 신고번호 제2022-서울종로-1744호</div>
        <div>서울특별시 성북구 안암로9가길 9-8, 303호</div>
        <div>'영어 한잔'은 '네이티브피티'의 영어교육 서비스 브랜드입니다.</div>
        <div>ⓒ2026 All Rights Reserved.</div>
      </div>
    </footer>
  );
}
