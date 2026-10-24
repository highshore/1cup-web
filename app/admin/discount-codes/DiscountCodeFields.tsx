"use client";

import type { Dispatch, SetStateAction } from "react";

import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  inputClass,
  labelClass,
  type DiscountType,
  type EligibilityType,
  type FormState,
  type ProductId,
  type Region,
} from "./shared";

interface FieldGroupProps {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
}

function DateField({
  label,
  value,
  placeholder,
  clearLabel,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  clearLabel: string;
  onChange: (value: string) => void;
}) {
  const displayValue = value ? value.replaceAll("-", ".") : placeholder;

  return (
    <div className={labelClass}>
      <span>{label}</span>
      <div className="relative h-[52px] w-full overflow-hidden rounded-xl border-2 border-[#050505] bg-white">
        <span
          className={`pointer-events-none flex h-full items-center px-3.5 pr-12 text-[14px] font-semibold ${
            value ? "text-[#050505]" : "text-black/45"
          }`}
        >
          {displayValue}
        </span>
        <input
          type="date"
          className="absolute inset-0 z-10 m-0 h-full min-h-0 w-full cursor-pointer opacity-0"
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-[#f5f5f5] text-[18px] font-black leading-none text-black/60"
            aria-label={clearLabel}
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : (
          <span className="pointer-events-none absolute right-4 top-1/2 z-20 -translate-y-1/2 text-[14px] font-black text-black/40">
            ▾
          </span>
        )}
      </div>
    </div>
  );
}

// Discount type and amount, and who may use the code (with the inactivity window for
// returning-member codes).
export function DiscountRuleFields({ form, setForm }: FieldGroupProps) {
  const { t } = useI18n();
  const copy = t.admin.discountCodes;

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-4 max-[760px]:grid-cols-1">
        <label className={labelClass}>
          {copy.fields.discountType}
          <select
            className={inputClass}
            value={form.discountType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                discountType: event.target.value as DiscountType,
              }))
            }
          >
            <option value="percent">{copy.discountType.percent}</option>
            <option value="fixed_amount">{copy.discountType.fixed}</option>
          </select>
        </label>
        <label className={labelClass}>
          {copy.fields.discountValue}
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.discountValue}
            placeholder={form.discountType === "percent" ? "15" : "3000"}
            onChange={(event) =>
              setForm((current) => ({ ...current, discountValue: event.target.value }))
            }
          />
        </label>
        <label className={labelClass}>
          {copy.fields.eligibility}
          <select
            className={inputClass}
            value={form.eligibility}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                eligibility: event.target.value as EligibilityType,
              }))
            }
          >
            <option value="all">{copy.eligibility.all}</option>
            <option value="first_purchase">{copy.eligibility.firstPurchase}</option>
            <option value="returning">{copy.eligibility.returning}</option>
          </select>
        </label>
      </div>

      {form.eligibility === "returning" && (
        <label className={`${labelClass} mt-4 max-w-[360px]`}>
          {copy.fields.minInactiveDays}
          <input
            className={inputClass}
            inputMode="numeric"
            value={form.minInactiveDays}
            onChange={(event) =>
              setForm((current) => ({ ...current, minInactiveDays: event.target.value }))
            }
          />
          <span className="text-[11px] font-semibold leading-5 text-black/50">
            {copy.returningHint}
          </span>
        </label>
      )}
    </>
  );
}

// Which products and regions the code applies to.
export function ApplicabilityFields({ form, setForm }: FieldGroupProps) {
  const { t } = useI18n();
  const copy = t.admin.discountCodes;

  const setProducts = (product: ProductId) => {
    setForm((current) => ({
      ...current,
      products: current.products.includes(product)
        ? current.products.filter((item) => item !== product)
        : [...current.products, product],
    }));
  };

  const setRegions = (region: Region) => {
    setForm((current) => ({
      ...current,
      regions: current.regions.includes(region)
        ? current.regions.filter((item) => item !== region)
        : [...current.regions, region],
    }));
  };

  return (
    <div className="mt-5 grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[12px] font-black">{copy.fields.products}</legend>
        {([
          ["membership_30d", copy.products.membership],
          ["participation_pack_5", copy.products.pack],
        ] as const).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-[13px] font-bold">
            <input
              type="checkbox"
              checked={form.products.includes(value)}
              onChange={() => setProducts(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[12px] font-black">{copy.fields.regions}</legend>
        {([
          ["anam", copy.regions.anam],
          ["yeouido", copy.regions.yeouido],
        ] as const).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-[13px] font-bold">
            <input
              type="checkbox"
              checked={form.regions.includes(value)}
              onChange={() => setRegions(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

// Validity window and redemption limits (overall and per member).
export function LimitFields({ form, setForm }: FieldGroupProps) {
  const { t } = useI18n();
  const copy = t.admin.discountCodes;

  return (
    <div className="mt-5 grid grid-cols-4 gap-4 max-[980px]:grid-cols-2 max-[560px]:grid-cols-1">
      <DateField
        label={copy.fields.startsAt}
        value={form.startsAt}
        placeholder={copy.datePlaceholder}
        clearLabel={copy.clearDate}
        onChange={(value) =>
          setForm((current) => ({ ...current, startsAt: value }))
        }
      />
      <DateField
        label={copy.fields.endsAt}
        value={form.endsAt}
        placeholder={copy.datePlaceholder}
        clearLabel={copy.clearDate}
        onChange={(value) =>
          setForm((current) => ({ ...current, endsAt: value }))
        }
      />
      <label className={labelClass}>
        {copy.fields.maxTotal}
        <input
          className={inputClass}
          inputMode="numeric"
          value={form.maxTotalRedemptions}
          placeholder={copy.noLimit}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              maxTotalRedemptions: event.target.value,
            }))
          }
        />
      </label>
      <label className={labelClass}>
        {copy.fields.maxPerUser}
        <input
          className={inputClass}
          inputMode="numeric"
          value={form.maxRedemptionsPerUser}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              maxRedemptionsPerUser: event.target.value,
            }))
          }
        />
      </label>
    </div>
  );
}
