// Types, form defaults and class strings shared by the discount-code admin panels.

export type DiscountType = "fixed_amount" | "percent";
export type EligibilityType = "all" | "first_purchase" | "returning";
export type ProductId = "membership_30d" | "participation_pack_5";
export type Region = "anam" | "yeouido";

export type DiscountCodeRow = {
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  discount_type: DiscountType;
  discount_value: number | string;
  applies_to_products: string[] | null;
  applies_to_regions: string[] | null;
  eligibility_type: EligibilityType;
  min_inactive_days: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_total_redemptions: number | null;
  max_redemptions_per_user: number;
  created_at: string;
  updated_at: string;
};

export type RedemptionRow = {
  discount_code: string;
  status: "claimed" | "consumed" | "released";
};

export type ReferralCodeRow = {
  code: string;
  active: boolean | null;
  discount: number | string | null;
  type: string | null;
  referrer: string | null;
  created_at: string | null;
};

export type FormState = {
  code: string;
  name: string;
  description: string;
  active: boolean;
  discountType: DiscountType;
  discountValue: string;
  products: ProductId[];
  regions: Region[];
  eligibility: EligibilityType;
  minInactiveDays: string;
  startsAt: string;
  endsAt: string;
  maxTotalRedemptions: string;
  maxRedemptionsPerUser: string;
};

export const emptyForm = (): FormState => ({
  code: "",
  name: "",
  description: "",
  active: true,
  discountType: "percent",
  discountValue: "",
  products: ["membership_30d"],
  regions: ["anam", "yeouido"],
  eligibility: "returning",
  minInactiveDays: "30",
  startsAt: "",
  endsAt: "",
  maxTotalRedemptions: "",
  maxRedemptionsPerUser: "1",
});

export const inputClass =
  "w-full rounded-xl border-2 border-[#050505] bg-white px-3.5 py-3 text-[14px] font-semibold text-[#050505] outline-none focus:ring-2 focus:ring-[#f47a4a]";
export const labelClass = "grid gap-2 text-[12px] font-black text-[#050505]";
export const panelClass =
  "rounded-2xl border-[3px] border-[#050505] bg-white p-5 shadow-[6px_6px_0_rgba(5,5,5,0.9)]";
export const primaryButtonClass =
  "rounded-xl border-2 border-[#050505] bg-[#f47a4a] px-4 py-2.5 text-[13px] font-black text-[#050505] shadow-[3px_3px_0_#050505] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "rounded-xl border-2 border-[#050505] bg-white px-3.5 py-2 text-[12px] font-black text-[#050505] disabled:cursor-not-allowed disabled:opacity-45";
export const dangerButtonClass =
  "rounded-xl border-2 border-[#050505] bg-[#fee2e2] px-3.5 py-2 text-[12px] font-black text-[#991b1b] disabled:cursor-not-allowed disabled:opacity-45";
export const copyButtonClass =
  "inline-flex h-8 items-center justify-center rounded-md border border-[#050505] bg-white px-2.5 text-[11px] font-black text-[#050505] active:translate-y-px";

