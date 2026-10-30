"use client";

import { ChatBubbleOvalLeftEllipsisIcon } from "@heroicons/react/24/outline";
import "./support-button.css";

// 영어 한잔 KakaoTalk channel chat. 1cup and Daily share the channel (Daily's lessons arrive
// as 알림톡 from it), so both pages send questions here.
export const SUPPORT_URL = "https://pf.kakao.com/_DxlPIn/chat";

// The floating 문의하기 button in the bottom-right corner. On narrow screens it shrinks to the
// icon. `lifted` moves it above a bottom bar the page is showing (Daily's sticky trial bar).
export default function SupportButton({
  label,
  ariaLabel,
  lifted = false,
}: {
  label: string;
  ariaLabel: string;
  lifted?: boolean;
}) {
  const bottom = lifted
    ? "bottom-[calc(5.75rem_+_env(safe-area-inset-bottom))]"
    : "bottom-[calc(1.45rem_+_env(safe-area-inset-bottom))] max-[620px]:bottom-[calc(0.9rem_+_env(safe-area-inset-bottom))]";
  return (
    <a
      className={`fixed right-[clamp(1rem,3vw,1.5rem)] ${bottom} z-[61] inline-flex items-center gap-[0.48rem] min-h-12 py-[0.55rem] pr-[0.78rem] pl-[0.6rem] border-2 border-[#050505] rounded-full bg-white text-[#050505] text-[0.82rem] font-black no-underline shadow-[4px_4px_0_#f47a4a] animate-[support-bob_3.2s_ease-in-out_infinite] [transition:background-color_180ms_ease,box-shadow_180ms_ease,transform_180ms_ease,bottom_300ms_ease-out] hover:bg-[#fff8dc] hover:shadow-[6px_6px_0_#f47a4a] hover:[transform:translate(-1px,-1px)] focus-visible:[outline:3px_solid_rgba(244,122,74,0.38)] focus-visible:[outline-offset:3px] motion-reduce:animate-none motion-reduce:transition-none max-[620px]:right-[calc(0.9rem_+_env(safe-area-inset-right))] max-[620px]:box-border max-[620px]:p-2 max-[620px]:w-[52px] max-[620px]:h-[52px] max-[620px]:justify-center max-[620px]:gap-0 max-[620px]:shadow-[3px_3px_0_#f47a4a] max-[620px]:animate-none`}
      href={SUPPORT_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
    >
      <span
        className="relative inline-grid place-items-center w-8 h-8 flex-none border-2 border-[#050505] rounded-full bg-[#f47a4a] [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:[stroke-width:2.4] after:content-[''] after:absolute after:top-1 after:right-[5px] after:w-[6px] after:h-[6px] after:border-[1.5px] after:border-[#050505] after:rounded-full after:bg-white"
        aria-hidden="true"
      >
        <ChatBubbleOvalLeftEllipsisIcon />
      </span>
      <span className="whitespace-nowrap max-[620px]:absolute max-[620px]:w-px max-[620px]:h-px max-[620px]:p-0 max-[620px]:-m-px max-[620px]:overflow-hidden max-[620px]:[clip:rect(0,0,0,0)] max-[620px]:border-0">
        {label}
      </span>
    </a>
  );
}
