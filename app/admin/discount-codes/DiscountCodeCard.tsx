"use client";

import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  copyButtonClass,
  dangerButtonClass,
  secondaryButtonClass,
  type DiscountCodeRow,
} from "./shared";

interface DiscountCodeCardProps {
  code: DiscountCodeRow;
  usage: { claimed: number; consumed: number };
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

// One managed discount code: status, discount, eligibility, usage against its limit, and
// its validity window, with copy / edit / enable-disable / delete actions.
export default function DiscountCodeCard({
  code,
  usage,
  copied,
  onCopy,
  onEdit,
  onToggle,
  onRemove,
}: DiscountCodeCardProps) {
  const { t, locale } = useI18n();
  const copy = t.admin.discountCodes;

  const formatDiscount = (code: DiscountCodeRow) =>
    code.discount_type === "percent"
      ? `${Number(code.discount_value).toLocaleString()}%`
      : `₩${Number(code.discount_value).toLocaleString()}`;

  const conditionLabel = (code: DiscountCodeRow) => {
    if (code.eligibility_type === "first_purchase") return copy.eligibility.firstPurchase;
    if (code.eligibility_type === "returning") {
      return copy.eligibility.returningWithDays.replace(
        "{days}",
        String(code.min_inactive_days ?? 30),
      );
    }
    return copy.eligibility.all;
  };

  const statusLabel = (code: DiscountCodeRow) => {
    if (!code.active) return copy.status.disabled;
    const now = Date.now();
    if (code.starts_at && new Date(code.starts_at).getTime() > now) return copy.status.scheduled;
    if (code.ends_at && new Date(code.ends_at).getTime() <= now) return copy.status.expired;
    return copy.status.active;
  };

  const formatDate = (value: string | null) => {
    if (!value) return copy.noLimit;
    return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  };

  const products = (code.applies_to_products ?? [])
    .map((product) =>
      product === "membership_30d" ? copy.products.membership : copy.products.pack,
    )
    .join(", ");
  const regions = (code.applies_to_regions ?? [])
    .map((region) =>
      region === "anam" ? copy.regions.anam : copy.regions.yeouido,
    )
    .join(", ");

  return (
    <article
            className="rounded-xl border-2 border-[#050505] p-4 shadow-[3px_3px_0_rgba(5,5,5,0.9)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-[#fff1e9] px-2 py-1 text-[15px] font-black">
              {code.code}
            </code>
            <button
              type="button"
              className={copyButtonClass}
              aria-label={copy.copyAria.replace("{code}", code.code)}
              onClick={onCopy}
            >
              {copied ? copy.copied : copy.copy}
            </button>
            <span className="rounded-full border border-[#050505] px-2 py-1 text-[11px] font-black">
              {statusLabel(code)}
            </span>
            <span className="rounded-full border border-[#050505] bg-[#dcfce7] px-2 py-1 text-[11px] font-black">
              {formatDiscount(code)}
            </span>
          </div>
          <h3 className="mb-0 mt-2 text-[15px] font-black">{code.name}</h3>
          {code.description && (
            <p className="mt-1 text-[12px] font-semibold text-black/55">
              {code.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButtonClass} onClick={onEdit}>
            {copy.edit}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={onToggle}>
            {code.active ? copy.disable : copy.enable}
          </button>
          <button type="button" className={dangerButtonClass} onClick={onRemove}>
            {copy.delete}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-3 text-[12px] max-[1000px]:grid-cols-2 max-[520px]:grid-cols-1">
        <div><strong>{copy.columns.condition}</strong><br />{conditionLabel(code)}</div>
        <div><strong>{copy.columns.discount}</strong><br />{formatDiscount(code)}</div>
        <div><strong>{copy.columns.appliesTo}</strong><br />{products} · {regions}</div>
        <div>
          <strong>{copy.columns.usage}</strong><br />
          {copy.usage
            .replace("{used}", String(usage.consumed))
            .replace(
              "{limit}",
              code.max_total_redemptions == null
                ? copy.noLimit
                : String(code.max_total_redemptions),
            )}
          {usage.claimed > 0
            ? ` · ${copy.claimed.replace("{count}", String(usage.claimed))}`
            : ""}
        </div>
        <div>
          <strong>{copy.columns.period}</strong><br />
          {formatDate(code.starts_at)} → {formatDate(code.ends_at)}
        </div>
      </div>
    </article>
  );
}
