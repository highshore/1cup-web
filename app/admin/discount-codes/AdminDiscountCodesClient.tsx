"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";

type DiscountType = "fixed_amount" | "percent";
type EligibilityType = "all" | "first_purchase" | "returning";
type ProductId = "membership_30d" | "participation_pack_5";
type Region = "anam" | "yeouido";

type DiscountCodeRow = {
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

type RedemptionRow = {
  discount_code: string;
  status: "claimed" | "consumed" | "released";
};

type ReferralCodeRow = {
  code: string;
  active: boolean | null;
  discount: number | string | null;
  type: string | null;
  referrer: string | null;
  created_at: string | null;
};

type FormState = {
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

const emptyForm = (): FormState => ({
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

const inputClass =
  "w-full rounded-xl border-2 border-[#050505] bg-white px-3.5 py-3 text-[14px] font-semibold text-[#050505] outline-none focus:ring-2 focus:ring-[#f47a4a]";
const labelClass = "grid gap-2 text-[12px] font-black text-[#050505]";
const panelClass =
  "rounded-2xl border-[3px] border-[#050505] bg-white p-5 shadow-[6px_6px_0_rgba(5,5,5,0.9)]";
const primaryButtonClass =
  "rounded-xl border-2 border-[#050505] bg-[#f47a4a] px-4 py-2.5 text-[13px] font-black text-[#050505] shadow-[3px_3px_0_#050505] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-xl border-2 border-[#050505] bg-white px-3.5 py-2 text-[12px] font-black text-[#050505] disabled:cursor-not-allowed disabled:opacity-45";
const dangerButtonClass =
  "rounded-xl border-2 border-[#050505] bg-[#fee2e2] px-3.5 py-2 text-[12px] font-black text-[#991b1b] disabled:cursor-not-allowed disabled:opacity-45";
const copyButtonClass =
  "inline-flex h-8 items-center justify-center rounded-md border border-[#050505] bg-white px-2.5 text-[11px] font-black text-[#050505] active:translate-y-px";

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function startOfDate(value: string): string | null {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function endOfDate(value: string): string | null {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : null;
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

export default function AdminDiscountCodesClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const { t, locale } = useI18n();
  const copy = t.admin.discountCodes;

  const [codes, setCodes] = useState<DiscountCodeRow[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralCodeRow[]>([]);
  const [memberGeneratedReferralCodes, setMemberGeneratedReferralCodes] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setNotice(null);
    const [codeResult, redemptionResult, referralResult, memberCodeResult] = await Promise.all([
      supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("discount_code_redemptions").select("discount_code,status"),
      supabase
        .from("referral_codes")
        .select("code,active,discount,type,referrer,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("users").select("referral_code").not("referral_code", "is", null),
    ]);

    const firstError =
      codeResult.error || redemptionResult.error || referralResult.error || memberCodeResult.error;
    if (firstError) {
      console.error("discount code admin load failed", firstError);
      setNotice({ text: copy.loadFailed, error: true });
    }

    setCodes((codeResult.data ?? []) as DiscountCodeRow[]);
    setRedemptions((redemptionResult.data ?? []) as RedemptionRow[]);
    setReferrals((referralResult.data ?? []) as ReferralCodeRow[]);
    setMemberGeneratedReferralCodes(
      (memberCodeResult.data ?? [])
        .map((row) => String(row.referral_code || "").trim())
        .filter(Boolean),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.replace("/");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStatus, authLoading, currentUser, router]);

  const usageByCode = useMemo(() => {
    const usage = new Map<string, { claimed: number; consumed: number }>();
    for (const row of redemptions) {
      const current = usage.get(row.discount_code) ?? { claimed: 0, consumed: 0 };
      if (row.status === "claimed") current.claimed += 1;
      if (row.status === "consumed") current.consumed += 1;
      usage.set(row.discount_code, current);
    }
    return usage;
  }, [redemptions]);

  const filteredCodes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return codes;
    return codes.filter((code) =>
      [code.code, code.name, code.description ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [codes, search]);

  const operationalLegacyCodes = useMemo(() => {
    const memberCodes = new Set(memberGeneratedReferralCodes.map((code) => code.toLowerCase()));
    const managedCodes = new Set(codes.map((code) => code.code.toLowerCase()));
    return referrals.filter((code) => {
      const normalized = code.code.toLowerCase();
      return !memberCodes.has(normalized) && !managedCodes.has(normalized);
    });
  }, [codes, memberGeneratedReferralCodes, referrals]);

  const filteredReferrals = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return operationalLegacyCodes;
    return operationalLegacyCodes.filter((code) =>
      code.code.toLowerCase().includes(query),
    );
  }, [operationalLegacyCodes, search]);

  const stats = useMemo(() => {
    const now = Date.now();
    const active = codes.filter((code) => {
      if (!code.active) return false;
      if (code.starts_at && new Date(code.starts_at).getTime() > now) return false;
      if (code.ends_at && new Date(code.ends_at).getTime() <= now) return false;
      return true;
    }).length;
    return {
      active,
      consumed: redemptions.filter((row) => row.status === "consumed").length,
      returning: codes.filter((code) => code.eligibility_type === "returning").length,
      referrals: operationalLegacyCodes.length,
    };
  }, [codes, redemptions, operationalLegacyCodes]);

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

  const resetForm = () => {
    setEditingCode(null);
    setForm(emptyForm());
  };

  const editCode = (code: DiscountCodeRow) => {
    setEditingCode(code.code);
    setForm({
      code: code.code,
      name: code.name,
      description: code.description ?? "",
      active: code.active,
      discountType: code.discount_type,
      discountValue: String(code.discount_value),
      products: (code.applies_to_products ?? ["membership_30d"]) as ProductId[],
      regions: (code.applies_to_regions ?? ["anam", "yeouido"]) as Region[],
      eligibility: code.eligibility_type,
      minInactiveDays: String(code.min_inactive_days ?? 30),
      startsAt: toDateInput(code.starts_at),
      endsAt: toDateInput(code.ends_at),
      maxTotalRedemptions:
        code.max_total_redemptions == null ? "" : String(code.max_total_redemptions),
      maxRedemptionsPerUser: String(code.max_redemptions_per_user ?? 1),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validate = () => {
    const normalizedCode = form.code.trim().toUpperCase();
    const discountValue = Number(form.discountValue);
    const perUser = Number(form.maxRedemptionsPerUser);
    const maxTotal = form.maxTotalRedemptions ? Number(form.maxTotalRedemptions) : null;
    const minInactive = Number(form.minInactiveDays);

    if (!/^[A-Z0-9_-]{3,32}$/.test(normalizedCode)) return copy.validation.code;
    if (!form.name.trim()) return copy.validation.name;
    if (!Number.isFinite(discountValue) || discountValue <= 0) return copy.validation.discount;
    if (form.discountType === "percent" && discountValue > 100) return copy.validation.percent;
    if (form.products.length === 0) return copy.validation.products;
    if (form.regions.length === 0) return copy.validation.regions;
    if (!Number.isInteger(perUser) || perUser < 1) return copy.validation.perUser;
    if (maxTotal !== null && (!Number.isInteger(maxTotal) || maxTotal < 1)) {
      return copy.validation.total;
    }
    if (
      form.eligibility === "returning" &&
      (!Number.isInteger(minInactive) || minInactive < 1)
    ) {
      return copy.validation.inactiveDays;
    }
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
      return copy.validation.dates;
    }

    if (!editingCode) {
      const collision = referrals.some(
        (referral) => referral.code.toUpperCase() === normalizedCode,
      );
      if (collision) return copy.validation.collision;
    }
    return null;
  };

  const save = async () => {
    const validation = validate();
    if (validation) {
      setNotice({ text: validation, error: true });
      return;
    }

    setSaving(true);
    setNotice(null);
    const normalizedCode = form.code.trim().toUpperCase();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
      discount_type: form.discountType,
      discount_value: Number(form.discountValue),
      applies_to_products: form.products,
      applies_to_regions: form.regions,
      eligibility_type: form.eligibility,
      min_inactive_days:
        form.eligibility === "returning" ? Number(form.minInactiveDays) : null,
      starts_at: startOfDate(form.startsAt),
      ends_at: endOfDate(form.endsAt),
      max_total_redemptions: form.maxTotalRedemptions
        ? Number(form.maxTotalRedemptions)
        : null,
      max_redemptions_per_user: Number(form.maxRedemptionsPerUser),
    };

    const result = editingCode
      ? await supabase.from("discount_codes").update(payload).eq("code", editingCode)
      : await supabase
          .from("discount_codes")
          .insert({ code: normalizedCode, ...payload });

    if (result.error) {
      console.error("discount code save failed", result.error);
      setNotice({ text: result.error.message || copy.saveFailed, error: true });
      setSaving(false);
      return;
    }

    setNotice({
      text: editingCode ? copy.updated : copy.created,
      error: false,
    });
    resetForm();
    await load();
    setSaving(false);
  };

  const toggleCode = async (code: DiscountCodeRow) => {
    const { error } = await supabase
      .from("discount_codes")
      .update({ active: !code.active })
      .eq("code", code.code);
    if (error) {
      setNotice({ text: error.message || copy.saveFailed, error: true });
      return;
    }
    await load();
  };

  const removeCode = async (code: DiscountCodeRow) => {
    const usage = usageByCode.get(code.code) ?? { claimed: 0, consumed: 0 };
    if (usage.claimed + usage.consumed > 0) {
      setNotice({ text: copy.cannotDeleteUsed, error: true });
      return;
    }
    if (!window.confirm(copy.deleteConfirm.replace("{code}", code.code))) return;
    const { error } = await supabase.from("discount_codes").delete().eq("code", code.code);
    if (error) {
      setNotice({ text: copy.deleteFailed, error: true });
      return;
    }
    if (editingCode === code.code) resetForm();
    await load();
  };

  const toggleReferral = async (referral: ReferralCodeRow) => {
    const { error } = await supabase
      .from("referral_codes")
      .update({ active: referral.active !== true })
      .eq("code", referral.code);
    if (error) {
      setNotice({ text: error.message || copy.saveFailed, error: true });
      return;
    }
    await load();
  };

  const copyCodeToClipboard = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("copy command failed");
      }

      setCopiedCode(code);
      window.setTimeout(() => {
        setCopiedCode((current) => (current === code ? null : current));
      }, 1600);
    } catch (error) {
      console.error("discount code copy failed", error);
      setNotice({ text: copy.copyFailed, error: true });
    }
  };

  const formatDiscount = (code: DiscountCodeRow) =>
    code.discount_type === "percent"
      ? `${Number(code.discount_value).toLocaleString()}%`
      : `₩${Number(code.discount_value).toLocaleString()}`;

  const formatLegacyDiscount = (code: ReferralCodeRow) => {
    const value = Number(code.discount ?? 0);
    if (!Number.isFinite(value) || value <= 0) return copy.noDiscountValue;
    return code.type === "percent"
      ? `${value.toLocaleString()}%`
      : `₩${value.toLocaleString()}`;
  };

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

  if (authLoading || loading || !currentUser || accountStatus !== "admin") {
    return <div className="mx-auto max-w-[1400px] px-5 py-10 font-bold text-black/60">{copy.loading}</div>;
  }

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-5 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            type="button"
            className="mb-3 text-[13px] font-black underline underline-offset-4"
            onClick={() => router.push("/admin")}
          >
            {copy.back}
          </button>
          <h1 className="m-0 text-[30px] font-black text-[#050505]">{copy.title}</h1>
          <p className="mt-2 max-w-[760px] text-[14px] font-semibold leading-6 text-black/60">
            {copy.subtitle}
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => void load()}>
          {copy.refresh}
        </button>
      </header>

      {notice && (
        <div
          className={`rounded-xl border-2 border-[#050505] px-4 py-3 text-[13px] font-bold ${
            notice.error ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#dcfce7] text-[#14532d]"
          }`}
        >
          {notice.text}
        </div>
      )}

      <section className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
        {[
          [copy.stats.active, stats.active],
          [copy.stats.redeemed, stats.consumed],
          [copy.stats.returning, stats.returning],
          [copy.stats.referrals, stats.referrals],
        ].map(([label, value]) => (
          <div key={String(label)} className={panelClass}>
            <div className="text-[28px] font-black">{value}</div>
            <div className="mt-1 text-[12px] font-black uppercase tracking-wide text-black/50">
              {label}
            </div>
          </div>
        ))}
      </section>

      <section className={panelClass}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[20px] font-black">
              {editingCode ? copy.editTitle.replace("{code}", editingCode) : copy.createTitle}
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-black/55">{copy.createHelp}</p>
          </div>
          {editingCode && (
            <button type="button" className={secondaryButtonClass} onClick={resetForm}>
              {copy.cancelEdit}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
          <label className={labelClass}>
            {copy.fields.code}
            <input
              className={inputClass}
              value={form.code}
              disabled={Boolean(editingCode)}
              maxLength={32}
              placeholder="WELCOME30"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                }))
              }
            />
          </label>
          <label className={labelClass}>
            {copy.fields.name}
            <input
              className={inputClass}
              value={form.name}
              placeholder={copy.placeholders.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
        </div>

        <label className={`${labelClass} mt-4`}>
          {copy.fields.description}
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={form.description}
            placeholder={copy.placeholders.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </label>

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

        <label className="mt-5 flex items-center gap-2 text-[13px] font-black">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) =>
              setForm((current) => ({ ...current, active: event.target.checked }))
            }
          />
          {copy.fields.active}
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? copy.saving : editingCode ? copy.saveChanges : copy.create}
          </button>
          {editingCode && (
            <button type="button" className={secondaryButtonClass} onClick={resetForm}>
              {copy.cancelEdit}
            </button>
          )}
        </div>
      </section>

      <section className={panelClass}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="m-0 text-[20px] font-black">{copy.managedTitle}</h2>
            <p className="mt-1 text-[12px] font-semibold text-black/50">{copy.managedHelp}</p>
          </div>
          <input
            className={`${inputClass} max-w-[320px]`}
            value={search}
            placeholder={copy.search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {filteredCodes.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-black/25 p-8 text-center text-[13px] font-bold text-black/45">
            {copy.empty}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredCodes.map((code) => {
              const usage = usageByCode.get(code.code) ?? { claimed: 0, consumed: 0 };
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
                  key={code.code}
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
                          onClick={() => void copyCodeToClipboard(code.code)}
                        >
                          {copiedCode === code.code ? copy.copied : copy.copy}
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
                      <button type="button" className={secondaryButtonClass} onClick={() => editCode(code)}>
                        {copy.edit}
                      </button>
                      <button type="button" className={secondaryButtonClass} onClick={() => void toggleCode(code)}>
                        {code.active ? copy.disable : copy.enable}
                      </button>
                      <button type="button" className={dangerButtonClass} onClick={() => void removeCode(code)}>
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
            })}
          </div>
        )}
      </section>

      <section className={panelClass}>
        <div className="mb-4">
          <h2 className="m-0 text-[20px] font-black">{copy.referralTitle}</h2>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-black/50">
            {copy.referralHelp}
          </p>
        </div>

        {filteredReferrals.length === 0 ? (
          <div className="text-[13px] font-bold text-black/45">{copy.noReferrals}</div>
        ) : (
          <div className="grid gap-2">
            {filteredReferrals.map((referral) => (
              <div
                key={referral.code}
                className="rounded-xl border border-black/25 px-3.5 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-black">{referral.code}</code>
                    <button
                      type="button"
                      className={copyButtonClass}
                      aria-label={copy.copyAria.replace("{code}", referral.code)}
                      onClick={() => void copyCodeToClipboard(referral.code)}
                    >
                      {copiedCode === referral.code ? copy.copied : copy.copy}
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
                    onClick={() => void toggleReferral(referral)}
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
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
