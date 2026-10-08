"use client";

import { useI18n } from "../../lib/i18n/I18nProvider";
import { copyButtonClass, secondaryButtonClass, type ReferralCodeRow } from "./shared";

interface LegacyReferralRowProps {
  referral: ReferralCodeRow;
  copied: boolean;
  onCopy: () => void;
  onToggle: () => void;
}

// One operational legacy referral code (first-purchase discount) with copy and toggle.
export default function LegacyReferralRow({ referral, copied, onCopy, onToggle }: LegacyReferralRowProps) {
  const { t } = useI18n();
  const copy = t.admin.discountCodes;

  const formatLegacyDiscount = (code: ReferralCodeRow) => {
    const value = Number(code.discount ?? 0);
    if (!Number.isFinite(value) || value <= 0) return copy.noDiscountValue;
    return code.type === "percent"
      ? `${value.toLocaleString()}%`
      : `₩${value.toLocaleString()}`;
  };

  return (
    <div
            className="rounded-xl border border-black/25 px-3.5 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-black">{referral.code}</code>
          <button
            type="button"
            className={copyButtonClass}
            aria-label={copy.copyAria.replace("{code}", referral.code)}
            onClick={onCopy}
          >
            {copied ? copy.copied : copy.copy}
          </button>
          <span
            className={`rounded-full border border-[#050505] px-2 py-1 text-[11px] font-black ${
              referral.active === true ? "bg-[#dcfce7]" : "bg-[#fee2e2]"
            }`}
          >
            {referral.active === true ? copy.status.active : copy.status.disabled}
          </span>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={onToggle}
        >
          {referral.active === true ? copy.disable : copy.enable}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] max-[520px]:grid-cols-1">
        <div>
          <strong>{copy.columns.condition}</strong><br />
          {copy.eligibility.firstPurchase}
        </div>
        <div>
          <strong>{copy.columns.discount}</strong><br />
          {formatLegacyDiscount(referral)}
        </div>
      </div>
    </div>
  );
}
