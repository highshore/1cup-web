"use client";

import Link from "next/link";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  formatKrw,
  NEWSLETTER_MEMBER_PRICE_KRW,
  NEWSLETTER_MONTHLY_PRICE_KRW,
  NewsletterTrack,
} from "../constants";
import TrackVisual from "./TrackVisual";

export default function TrackCard({ track }: { track: NewsletterTrack }) {
  const { t } = useI18n();
  const copy = t.newsletter.tracks[track];

  return (
    <Link
      href={`/newsletter/${track}`}
      className="flex flex-col overflow-hidden rounded-[14px] border-2 border-[#050505] bg-white text-[#0f172a] no-underline shadow-[5px_5px_0_rgba(5,5,5,0.88)] [transition:box-shadow_160ms_ease,transform_160ms_ease] hover:text-[#0f172a] hover:no-underline focus-visible:outline-3 focus-visible:outline-offset-[3px] focus-visible:outline-[rgba(244,122,74,0.45)] [@media(hover:hover)]:hover:-translate-x-px [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:shadow-[7px_7px_0_rgba(5,5,5,0.88)]"
    >
      <div className="border-b-2 border-[#050505]">
        <TrackVisual track={track} compact />
      </div>
      <div className="flex flex-col gap-2 px-5 pt-[1.1rem] pb-[1.3rem]">
        <span className="text-[1.35rem] font-black leading-[1.25] text-[#050505]">{copy.title}</span>
        <span className="text-[0.94rem] font-[650] leading-[1.55] text-[#475569]">{copy.tagline}</span>
        <span className="mt-[0.35rem] flex items-baseline gap-[0.375rem]">
          <span className="text-[1.3rem] font-black text-[#050505]">
            {t.newsletter.price.amount.replace("{price}", formatKrw(NEWSLETTER_MONTHLY_PRICE_KRW))}
          </span>
          <span className="text-[0.85rem] font-[650] text-[#64748b]">{t.newsletter.price.perMonth}</span>
        </span>
        <span className="self-start rounded-full bg-[#fff8dc] px-[0.6rem] py-[0.2rem] text-[0.8rem] font-extrabold text-[#d95f2d]">
          {t.newsletter.price.memberShort.replace("{price}", formatKrw(NEWSLETTER_MEMBER_PRICE_KRW))}
        </span>
      </div>
    </Link>
  );
}
