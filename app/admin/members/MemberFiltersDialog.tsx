"use client";

import { useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";
import type { MemberFilters, PurchaseFilter, LocationFilter } from "./memberListFilters";
import { DEFAULT_MEMBER_FILTERS } from "./memberListFilters";
import type { MemberStatusFilter } from "./membershipStatus";

export default function MemberFiltersDialog({
  initialFilters,
  purchaseDataAvailable,
  countMatches,
  onApply,
  onClose,
}: {
  initialFilters: MemberFilters;
  purchaseDataAvailable: boolean;
  countMatches: (filters: MemberFilters) => number;
  onApply: (filters: MemberFilters) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const copy = t.admin.members;
  const [draft, setDraft] = useState<MemberFilters>(initialFilters);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]),select:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex='-1'])",
        )];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (focusable.length && event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (focusable.length && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);

  const selectClass = "mt-1.5 h-11 w-full rounded-xl border border-[#d8d8d8] bg-white px-3 text-[14px] font-medium text-[#252525] outline-none focus:border-[#f47a4a]";
  const labelClass = "block text-[13px] font-bold text-[#363636]";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/35"
        aria-label={copy.closeDetails}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-filters-heading"
        className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-white shadow-2xl sm:max-h-[85dvh] sm:max-w-[460px] sm:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[#dedede] sm:hidden" />
        <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
          <h2 id="member-filters-heading" className="m-0 text-[17px] font-extrabold text-[#171717]">{copy.advancedFilters}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={copy.closeDetails}
            onClick={onClose}
            className="rounded-lg p-2 text-[#555] hover:bg-[#f2f2f2] focus-visible:outline-2 focus-visible:outline-[#f47a4a]"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <label className={labelClass}>
            {copy.subscriptionFilterLabel}
            <select
              className={selectClass}
              value={draft.status}
              onChange={(event) => setDraft((state) => ({ ...state, status: event.target.value as MemberStatusFilter }))}
            >
              <option value="all">{copy.subscriptionAll}</option>
              <option value="ongoing">{copy.subscriptionOngoing}</option>
              <option value="cancelled">{copy.subscriptionCancelled}</option>
              <option value="active">{copy.subscriptionActive}</option>
              <option value="ended" disabled={!purchaseDataAvailable}>{copy.subscriptionEnded}</option>
              <option value="none" disabled={!purchaseDataAvailable}>{copy.subscriptionNone}</option>
            </select>
          </label>
          <label className={labelClass}>
            {copy.purchaseFilterLabel}
            <select
              className={selectClass}
              value={draft.purchase}
              onChange={(event) => setDraft((state) => ({ ...state, purchase: event.target.value as PurchaseFilter }))}
              disabled={!purchaseDataAvailable}
            >
              <option value="all">{copy.purchaseAll}</option>
              <option value="membership">{copy.purchaseMembership}</option>
              <option value="pass">{copy.purchasePass}</option>
              <option value="both">{copy.purchaseBoth}</option>
              <option value="none">{copy.purchaseNone}</option>
            </select>
          </label>
          <label className={labelClass}>
            {copy.locationFilterLabel}
            <select
              className={selectClass}
              value={draft.location}
              onChange={(event) => setDraft((state) => ({ ...state, location: event.target.value as LocationFilter }))}
            >
              <option value="all">{copy.locationAll}</option>
              <option value="anam">{copy.locationAnam}</option>
              <option value="yeouido">{copy.locationYeouido}</option>
            </select>
          </label>
          <p className="m-0 text-[12px] leading-relaxed text-[#777]">{copy.subscriptionStatusHint}</p>
          {!purchaseDataAvailable && (
            <p className="m-0 rounded-lg bg-[#fff4de] px-3 py-2 text-[12px] text-[#8a561d]" role="alert">
              {copy.purchaseLoadError}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-[#efefef] bg-white px-5 py-4">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_MEMBER_FILTERS)}
            className="min-h-11 rounded-xl border border-[#dedede] px-4 text-[13px] font-bold text-[#454545] hover:bg-[#f6f6f6]"
          >
            {copy.resetFilters}
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="min-h-11 flex-1 rounded-xl bg-[#f47a4a] px-3 text-[13px] font-extrabold text-[#171717] hover:bg-[#ef6f3c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#050505]"
          >
            {copy.applyFilters.replace("{count}", String(countMatches(draft)))}
          </button>
        </div>
      </div>
    </div>
  );
}
