"use client";

import { useI18n } from "../i18n/I18nProvider";

type FooterProps = {
  variant?: "default" | "speaking";
};

export default function Footer({ variant = "default" }: FooterProps) {
  const { t } = useI18n();

  if (variant === "speaking") {
    const copy = t.speakingTest.center.footer;
    const linkClass = "text-[#d1d5db] no-underline transition-colors hover:text-white hover:no-underline";

    return (
      <footer className="bg-[#050505] text-[#d1d5db] [font-family:Inter,'Noto_Sans_KR',system-ui,sans-serif]">
        <div className="mx-auto grid min-h-[356px] w-full max-w-[912px] grid-cols-[minmax(0,1fr)_150px_150px_150px] gap-[26px] py-[72px] max-[980px]:px-6 max-[760px]:grid-cols-2 max-[760px]:gap-x-8 max-[760px]:gap-y-10 max-[640px]:px-5">
          <div className="max-w-[360px] max-[760px]:col-span-2">
            <p className="text-[18px] font-extrabold text-white">1 CUP ENGLISH</p>
            <p className="mt-3 text-[13px] font-medium leading-5 text-[#d1d5db]">{copy.tagline}</p>
          </div>

          <div className="text-[11px] font-semibold leading-[26px]">
            <p className="text-[#d1d5db]">{copy.practice}</p>
            <a href="/speaking-test" className={linkClass}>{copy.speakingCenter}</a><br />
            <a href="/shadow" className={linkClass}>{copy.shadowing}</a><br />
            <a href="/leaderboard" className={linkClass}>{copy.leaderboard}</a>
          </div>

          <div className="text-[11px] font-semibold leading-[26px]">
            <p className="text-[#d1d5db]">{copy.community}</p>
            <a href="/meetup" className={linkClass}>{copy.meetups}</a><br />
            <a href="/policy/terms" className={linkClass}>{copy.guidelines}</a><br />
            <a href="/blog" className={linkClass}>{copy.blog}</a>
          </div>

          <div className="text-[11px] font-semibold leading-[26px]">
            <p className="text-[#d1d5db]">{copy.account}</p>
            <a href="/payment" className={linkClass}>{copy.membership}</a><br />
            <a href="/profile" className={linkClass}>{copy.profile}</a><br />
            <a href="mailto:hello@1cupenglish.com" className={linkClass}>{copy.contact}</a>
          </div>

          <div className="col-span-4 mt-[30px] flex min-h-[48px] items-end justify-between gap-4 border-t border-[#2a2a2a] pt-[30px] text-[10px] font-medium text-[#8b8b8b] max-[760px]:col-span-2 max-[760px]:flex-col max-[760px]:items-start">
            <p>{copy.copyright}</p>
            <p className="flex flex-wrap gap-5">
              <a href="/policy/privacy" className="text-[#8b8b8b] hover:text-[#d1d5db]">{copy.privacy}</a>
              <a href="/policy/terms" className="text-[#8b8b8b] hover:text-[#d1d5db]">{copy.terms}</a>
              <span>Instagram</span>
              <span>LinkedIn</span>
            </p>
          </div>
        </div>
      </footer>
    );
  }

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
        </div>
        <div>
          네이티브피티 | 549-04-02156 | 대표자 김수겸 | 이메일
          hello@1cupenglish.com | 전화 010-6858-4123
        </div>
        <div>통신판매업 신고번호 제2022-서울종로-1744호</div>
        <div>서울특별시 성북구 안암로9가길 9-8, 303호</div>
        <div>&apos;영어 한잔&apos;은 &apos;네이티브피티&apos;의 영어교육 서비스 브랜드입니다.</div>
        <div>ⓒ2026 All Rights Reserved.</div>
      </div>
    </footer>
  );
}
