"use client";

import { useState } from "react";

import type { getDictionary } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";
import { ApplicabilityFields, DiscountRuleFields, LimitFields } from "./DiscountCodeFields";
import {
  emptyForm,
  inputClass,
  labelClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  type DiscountCodeRow,
  type FormState,
  type ProductId,
  type ReferralCodeRow,
  type Region,
} from "./shared";
import type { Notice } from "./useDiscountCodesData";

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function startOfDate(value: string): string | null {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function endOfDate(value: string): string | null {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : null;
}

const formFromCode = (code: DiscountCodeRow): FormState => ({
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

type DiscountCodesCopy = ReturnType<typeof getDictionary>["admin"]["discountCodes"];

// Returns the first validation message for the form, or null when it can be saved.
function validateDiscountForm(
  form: FormState,
  editingCode: string | null,
  referrals: ReferralCodeRow[],
  messages: DiscountCodesCopy["validation"],
): string | null {
  const normalizedCode = form.code.trim().toUpperCase();
  const discountValue = Number(form.discountValue);
  const perUser = Number(form.maxRedemptionsPerUser);
  const maxTotal = form.maxTotalRedemptions ? Number(form.maxTotalRedemptions) : null;
  const minInactive = Number(form.minInactiveDays);

  if (!/^[A-Z0-9_-]{3,32}$/.test(normalizedCode)) return messages.code;
  if (!form.name.trim()) return messages.name;
  if (!Number.isFinite(discountValue) || discountValue <= 0) return messages.discount;
  if (form.discountType === "percent" && discountValue > 100) return messages.percent;
  if (form.products.length === 0) return messages.products;
  if (form.regions.length === 0) return messages.regions;
  if (!Number.isInteger(perUser) || perUser < 1) return messages.perUser;
  if (maxTotal !== null && (!Number.isInteger(maxTotal) || maxTotal < 1)) {
    return messages.total;
  }
  if (
    form.eligibility === "returning" &&
    (!Number.isInteger(minInactive) || minInactive < 1)
  ) {
    return messages.inactiveDays;
  }
  if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
    return messages.dates;
  }

  if (!editingCode) {
    const collision = referrals.some(
      (referral) => referral.code.toUpperCase() === normalizedCode,
    );
    if (collision) return messages.collision;
  }
  return null;
}

// The discount_codes columns written on create and update (the code itself is set once).
function toDiscountCodePayload(form: FormState) {
  return {
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
}

interface DiscountCodeFormProps {
  /** The code being edited, or null to create one. The parent remounts this form (via
   *  `key`) whenever it switches codes or resets, so the fields start fresh each time. */
  editing: DiscountCodeRow | null;
  referrals: ReferralCodeRow[];
  onNotice: (notice: Notice | null) => void;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

// Create / edit form for a managed discount code, with client-side validation.
export default function DiscountCodeForm({
  editing,
  referrals,
  onNotice,
  onSaved,
  onCancel,
}: DiscountCodeFormProps) {
  const { t } = useI18n();
  const copy = t.admin.discountCodes;
  const editingCode = editing?.code ?? null;
  const [form, setForm] = useState<FormState>(() => (editing ? formFromCode(editing) : emptyForm()));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const validation = validateDiscountForm(form, editingCode, referrals, copy.validation);
    if (validation) {
      onNotice({ text: validation, error: true });
      return;
    }

    setSaving(true);
    onNotice(null);
    const normalizedCode = form.code.trim().toUpperCase();
    const payload = toDiscountCodePayload(form);

    const result = editingCode
      ? await supabase.from("discount_codes").update(payload).eq("code", editingCode)
      : await supabase
          .from("discount_codes")
          .insert({ code: normalizedCode, ...payload });

    if (result.error) {
      console.error("discount code save failed", result.error);
      onNotice({ text: result.error.message || copy.saveFailed, error: true });
      setSaving(false);
      return;
    }

    onNotice({
      text: editingCode ? copy.updated : copy.created,
      error: false,
    });
    // The parent resets (remounts) this form and reloads the lists.
    await onSaved();
  };

  return (
    <section className={panelClass}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[20px] font-black">
            {editingCode ? copy.editTitle.replace("{code}", editingCode) : copy.createTitle}
          </h2>
          <p className="mt-1 text-[13px] font-semibold text-black/55">{copy.createHelp}</p>
        </div>
        {editingCode && (
          <button type="button" className={secondaryButtonClass} onClick={onCancel}>
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

      <DiscountRuleFields form={form} setForm={setForm} />

      <ApplicabilityFields form={form} setForm={setForm} />

      <LimitFields form={form} setForm={setForm} />

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
          <button type="button" className={secondaryButtonClass} onClick={onCancel}>
            {copy.cancelEdit}
          </button>
        )}
      </div>
    </section>
  );
}
