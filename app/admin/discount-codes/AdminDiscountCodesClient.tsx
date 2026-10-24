"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";
import DiscountCodeCard from "./DiscountCodeCard";
import DiscountCodeForm from "./DiscountCodeForm";
import LegacyReferralRow from "./LegacyReferralRow";
import {
  inputClass,
  panelClass,
  secondaryButtonClass,
  type DiscountCodeRow,
  type ReferralCodeRow,
} from "./shared";
import { useDiscountCodesData } from "./useDiscountCodesData";

export default function AdminDiscountCodesClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const copy = t.admin.discountCodes;
  // app/admin/layout.tsx has already redirected non-admins on the server; this only
  // waits for the browser session so RLS sees it before the lists load.
  const sessionReady = !authLoading && Boolean(currentUser) && accountStatus === "admin";
  const {
    codes,
    redemptions,
    referrals,
    memberGeneratedReferralCodes,
    loading,
    notice: noticeState,
    setNotice,
    reload,
  } = useDiscountCodesData(sessionReady);
  const notice =
    noticeState === "loadFailed" ? { text: copy.loadFailed, error: true } : noticeState;

  const [editing, setEditing] = useState<DiscountCodeRow | null>(null);
  // Bumped to remount the form with fresh fields (after save, cancel, or picking a code).
  const [formVersion, setFormVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const resetForm = () => {
    setEditing(null);
    setFormVersion((version) => version + 1);
  };

  const editCode = (code: DiscountCodeRow) => {
    setEditing(code);
    setFormVersion((version) => version + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    await reload();
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
    if (editing?.code === code.code) resetForm();
    await reload();
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
    await reload();
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

  if (!sessionReady || loading) {
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
        <button type="button" className={secondaryButtonClass} onClick={() => void reload()}>
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

      <DiscountCodeForm
        key={formVersion}
        editing={editing}
        referrals={referrals}
        onNotice={setNotice}
        onSaved={async () => {
          resetForm();
          await reload();
        }}
        onCancel={resetForm}
      />

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
            {filteredCodes.map((code) => (
              <DiscountCodeCard
                key={code.code}
                code={code}
                usage={usageByCode.get(code.code) ?? { claimed: 0, consumed: 0 }}
                copied={copiedCode === code.code}
                onCopy={() => void copyCodeToClipboard(code.code)}
                onEdit={() => editCode(code)}
                onToggle={() => void toggleCode(code)}
                onRemove={() => void removeCode(code)}
              />
            ))}
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
            {filteredReferrals.map((referral: ReferralCodeRow) => (
              <LegacyReferralRow
                key={referral.code}
                referral={referral}
                copied={copiedCode === referral.code}
                onCopy={() => void copyCodeToClipboard(referral.code)}
                onToggle={() => void toggleReferral(referral)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
