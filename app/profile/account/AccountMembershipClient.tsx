"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import GlobalLoadingScreen from "../../lib/components/GlobalLoadingScreen";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { saveFeedback } from "../../lib/services/feedback_service";
import { invokeFunction, supabase } from "../../lib/supabase/client";
import {
  getParticipationCreditBalance,
  getParticipationCreditHistory,
} from "../../lib/features/meetup/services/participation_service";
import { DesktopProfileShell, useProfileShellData } from "../ProfileShell";

interface CreditHistoryItem {
  id: string;
  amount: number;
  type: string;
  meetup_id: string | null;
  expires_at: string | null;
  created_at: string;
  meetups?: { title?: string | null; date_time?: string | null } | null;
}

const cancellationReasons = [
  "모임 시간이 저와 맞지 않았어요",
  "모임 장소가 불편했어요",
  "기대했던 만큼의 가치를 느끼지 못했어요",
  "좀 더 체계적인 학습을 원했어요",
  "혼자 공부하는 걸 더 선호해요",
  "개인 사정으로 참여가 어려워졌어요",
  "단기 목표를 달성했어요",
  "가격이 지속적으로 부담되었어요",
  "모임 분위기나 멤버 구성과 잘 맞지 않았어요",
];

const refundReasons = ["결제 후 마음이 바뀌었어요 (단순 변심)", ...cancellationReasons];

function nextBillingDate(startDate: Date | null, billingCancelled: boolean) {
  if (!startDate || billingCancelled) return null;
  const next = new Date(startDate);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function dateLabel(date: Date | null, locale: string) {
  if (!date) return "-";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function historyLabel(entry: CreditHistoryItem) {
  const meetupTitle = entry.meetups?.title || "Sunday meetup";
  if (entry.type === "purchase") return "Credit pack purchase";
  if (entry.type === "registration") return meetupTitle;
  if (entry.type === "registration_refund") return "Meetup cancellation";
  if (entry.type === "payment_refund") return "Credit pack refund";
  return "Credit adjustment";
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[16px] border border-[#e6e6e6] bg-white p-4">{children}</section>;
}

function Row({ label, value, onClick }: { label: string; value?: string; onClick?: () => void }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className="grid min-h-[43px] w-full grid-cols-[1fr_minmax(110px,160px)_18px] items-center border-0 border-b border-[#ececec] bg-transparent px-0 text-left last:border-b-0"
    >
      <span className="text-[13px] font-medium text-[#171717]">{label}</span>
      <span className="truncate text-right text-[12px] text-[#6b6b6b]">{value || ""}</span>
      <span className={`text-right text-[22px] leading-none text-[#6b6b6b] ${onClick ? "" : "opacity-0"}`}>›</span>
    </Tag>
  );
}

function SurveyModal({
  title,
  reasons,
  submitLabel,
  danger,
  onClose,
  onSubmit,
}: {
  title: string;
  reasons: string[];
  submitLabel: string;
  danger?: boolean;
  onClose: () => void;
  onSubmit: (reasons: string[], other: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/40 min-[640px]:items-center min-[640px]:p-5" onMouseDown={onClose}>
      <div className="max-h-[86vh] w-full max-w-[560px] overflow-y-auto rounded-t-[24px] bg-white p-5 min-[640px]:rounded-[24px] min-[640px]:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-[20px] font-bold text-[#171717]">{title}</h2>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full border-0 bg-[#f5f5f5] text-[22px] text-[#6b6b6b]">×</button>
        </div>
        <p className="mt-2 text-[13px] leading-[1.55] text-[#6b6b6b]">Tell us what influenced your decision. You can select more than one.</p>
        <div className="mt-5 grid gap-2">
          {reasons.map((reason) => {
            const active = selected.includes(reason);
            return (
              <label key={reason} className={`flex cursor-pointer items-start gap-3 rounded-[14px] border p-3 text-[13px] leading-[1.45] ${active ? "border-[#f47a4a] bg-[#ffebe0]" : "border-[#e6e6e6] bg-white"}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setSelected((current) => event.target.checked ? [...current, reason] : current.filter((item) => item !== reason))}
                  className="mt-0.5"
                />
                <span>{reason}</span>
              </label>
            );
          })}
        </div>
        <textarea value={other} onChange={(event) => setOther(event.target.value)} placeholder="Anything else?" className="mt-4 min-h-[90px] w-full rounded-[14px] border border-[#e6e6e6] p-3 text-[13px] outline-none focus:border-[#f47a4a]" />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#e6e6e6] bg-white px-5 text-[13px] font-semibold">Cancel</button>
          <button
            type="button"
            disabled={saving || (selected.length === 0 && !other.trim())}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit(selected, other.trim());
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className={`h-10 rounded-full border-0 px-5 text-[13px] font-semibold text-white disabled:opacity-40 ${danger ? "bg-[#b42331]" : "bg-[#171717]"}`}
          >
            {saving ? "Working…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageMembershipModal({
  status,
  nextBilling,
  onClose,
  onStop,
  onRefund,
}: {
  status: string;
  nextBilling: string;
  onClose: () => void;
  onStop: () => void;
  onRefund: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1250] flex items-end justify-center bg-black/40 min-[640px]:items-center min-[640px]:p-5" onMouseDown={onClose}>
      <div className="w-full max-w-[520px] rounded-t-[24px] bg-[#f3f3f1] p-5 min-[640px]:rounded-[24px] min-[640px]:p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-[22px] font-bold">Manage membership</h2>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full border-0 bg-white text-[22px] text-[#6b6b6b]">×</button>
        </div>
        <p className="mt-2 text-[13px] text-[#6b6b6b]">Current status: {status} · Next billing: {nextBilling}</p>

        <button type="button" onClick={onStop} className="mt-6 w-full rounded-[18px] border border-[#e6e6e6] bg-white p-4 text-left">
          <strong className="block text-[16px]">Stop next billing</strong>
          <span className="mt-2 block text-[13px] leading-[1.5] text-[#6b6b6b]">Keep access until the end of your current paid period.</span>
          <span className="mt-3 inline-flex rounded-full bg-[#f47a4a] px-3 py-1.5 text-[11px] font-bold text-[#171717]">Recommended</span>
        </button>

        <button type="button" onClick={onRefund} className="mt-3 w-full rounded-[18px] border border-[#e6e6e6] bg-white p-4 text-left">
          <strong className="block text-[16px] text-[#b42331]">Cancel now & request refund</strong>
          <span className="mt-2 block text-[13px] leading-[1.5] text-[#6b6b6b]">Service ends immediately. Refund eligibility depends on usage period.</span>
        </button>
      </div>
    </div>
  );
}

function DeleteAccountModal({
  phrase,
  requiresBillingStop,
  onClose,
  onConfirm,
}: {
  phrase: string;
  requiresBillingStop: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [working, setWorking] = useState(false);

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/45 p-5" onMouseDown={onClose}>
      <div className="w-full max-w-[500px] rounded-[24px] bg-white p-6" onMouseDown={(event) => event.stopPropagation()}>
        <h2 className="m-0 text-[20px] font-bold text-[#b42331]">Delete account</h2>
        {requiresBillingStop ? (
          <p className="mt-4 text-[13px] leading-[1.6] text-[#6b6b6b]">Stop your active billing first. This prevents deleting an account that still has an active recurring payment.</p>
        ) : (
          <>
            <p className="mt-4 text-[13px] leading-[1.6] text-[#6b6b6b]">This permanently deletes your account and cannot be undone. Type <strong>{phrase}</strong> to confirm.</p>
            <input value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" className="mt-3 h-12 w-full rounded-[14px] border border-[#d9d9d9] px-4 text-[14px] outline-none focus:border-[#b42331]" />
          </>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#e6e6e6] bg-white px-5 text-[13px] font-semibold">Cancel</button>
          {!requiresBillingStop && (
            <button
              type="button"
              disabled={working || value !== phrase}
              onClick={async () => {
                setWorking(true);
                try { await onConfirm(); } finally { setWorking(false); }
              }}
              className="h-10 rounded-full border-0 bg-[#b42331] px-5 text-[13px] font-semibold text-white disabled:opacity-35"
            >
              {working ? "Deleting…" : "Delete account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountMembershipClient() {
  const router = useRouter();
  const { logout } = useAuth();
  const { locale, t } = useI18n();
  const shell = useProfileShellData();
  const [identities, setIdentities] = useState<{ id: string; provider: string }[]>([]);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [linkingIdentity, setLinkingIdentity] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [survey, setSurvey] = useState<"stop" | "refund" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refreshCredits = async () => {
    try {
      const [balance, rows] = await Promise.all([
        getParticipationCreditBalance(),
        getParticipationCreditHistory(6),
      ]);
      shell.setCreditBalance(balance);
      setHistory(rows as CreditHistoryItem[]);
    } catch (creditError) {
      console.error("Unable to load credit history:", creditError);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!shell.currentUser) return;
    void supabase.auth.getUserIdentities().then(({ data }) => {
      setIdentities((data?.identities ?? []).map((identity) => ({
        id: identity.identity_id ?? identity.id,
        provider: identity.provider,
      })));
    });
    void refreshCredits();
  }, [shell.currentUser?.uid]);

  const nextBilling = useMemo(
    () => nextBillingDate(shell.summary.subscriptionStartDate, shell.summary.billingCancelled),
    [shell.summary.subscriptionStartDate, shell.summary.billingCancelled],
  );

  const daysLeft = nextBilling
    ? Math.max(0, Math.ceil((nextBilling.getTime() - Date.now()) / 86400000))
    : null;
  const managedMembership = shell.summary.gdgMember || shell.summary.accountStatus === "leader";
  const membershipStatus = shell.membershipActive ? "Active" : "Inactive";

  if (shell.authLoading || shell.loading) return <GlobalLoadingScreen />;
  if (!shell.currentUser) return null;

  const handleIdentity = async (provider: string) => {
    if (provider !== "kakao" || identities.some((item) => item.provider === "kakao")) return;
    setLinkingIdentity(true);
    shell.setError(null);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "kakao",
        options: { redirectTo: `${window.location.origin}/profile/account` },
      });
      if (error) throw error;
    } catch (linkError) {
      console.error("Identity linking failed:", linkError);
      shell.setError("카카오 계정 연결에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setLinkingIdentity(false);
    }
  };

  const stopBilling = async (reasons: string[], other: string) => {
    shell.setError(null);
    try {
      await saveFeedback("cancellation", reasons, other);
      const result = await invokeFunction("payment", {
        action: "stop",
        reason: "User requested stop billing",
      });
      if (!(result as any)?.success) throw new Error((result as any)?.message || "Billing stop failed");
      await supabase.from("users").update({ billing_cancelled: true }).eq("uid", shell.currentUser!.uid);
      await shell.refresh();
      shell.setNotice((result as any)?.message || "Next billing has been stopped.");
    } catch (stopError) {
      console.error("Stop billing failed:", stopError);
      shell.setError("다음 결제를 중단하지 못했습니다. 잠시 후 다시 시도해주세요.");
      throw stopError;
    }
  };

  const cancelAndRefund = async (reasons: string[], other: string) => {
    if (!shell.summary.billingKey) {
      shell.setError("구독 정보를 찾을 수 없습니다.");
      throw new Error("Missing billing key");
    }
    try {
      await saveFeedback("refund", reasons, other);
      const result = await invokeFunction("payment", {
        action: "cancel",
        userId: shell.currentUser!.uid,
        billingKey: shell.summary.billingKey,
      });
      if (!(result as any)?.success) throw new Error((result as any)?.message || "Cancellation failed");
      const ended = new Date().toISOString();
      await supabase
        .from("users")
        .update({ has_active_subscription: false, subscription_end_date: ended })
        .eq("uid", shell.currentUser!.uid);
      await shell.refresh();
      shell.setNotice("Membership was canceled and the refund request was submitted.");
    } catch (refundError) {
      console.error("Cancel/refund failed:", refundError);
      shell.setError("구독 해지 또는 환불 처리에 실패했습니다. 고객 서비스에 문의해주세요.");
      throw refundError;
    }
  };

  const reactivateBilling = async () => {
    try {
      const { error } = await supabase.from("users").update({ billing_cancelled: false }).eq("uid", shell.currentUser!.uid);
      if (error) throw error;
      await shell.refresh();
      shell.setNotice("Recurring billing has been reactivated.");
    } catch (reactivateError) {
      console.error("Billing reactivation failed:", reactivateError);
      shell.setError("결제 재활성화에 실패했습니다.");
    }
  };

  const manageMembership = () => {
    if (managedMembership) return;
    if (!shell.summary.hasActiveSubscription) {
      router.push("/payment");
      return;
    }
    if (shell.summary.billingCancelled) {
      void reactivateBilling();
      return;
    }
    setManageOpen(true);
  };

  const deleteAccount = async () => {
    try {
      await invokeFunction("account-delete", { confirmation: t.profile.deleteAccountPhrase });
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      router.replace("/");
      router.refresh();
    } catch (deleteError) {
      console.error("Delete account failed:", deleteError);
      shell.setError(t.profile.deleteAccountFailed);
      throw deleteError;
    }
  };

  const AccountContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? "px-4 pb-12 pt-4" : "p-8"}>
      <div className="flex items-start gap-3">
        {mobile && <button type="button" onClick={() => router.push("/profile")} className="border-0 bg-transparent p-0 text-[30px]">‹</button>}
        <div>
          <h1 className="m-0 text-[26px] font-bold text-[#171717]">Account & Membership</h1>
          <p className="mt-1 text-[13px] text-[#6b6b6b]">Login, membership, credits and account actions.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <Card>
          <h2 className="mb-1 mt-0 text-[18px] font-bold">Login Methods</h2>
          {(["kakao", "email"] as const).map((provider) => {
            const connected = identities.some((identity) => identity.provider === provider) || (provider === "email" && Boolean(shell.currentUser?.email));
            return (
              <Row
                key={provider}
                label={provider === "kakao" ? "Kakao" : "Email"}
                value={connected ? "Connected" : linkingIdentity && provider === "kakao" ? "Connecting…" : "Not connected"}
                onClick={provider === "kakao" && !connected ? () => void handleIdentity("kakao") : undefined}
              />
            );
          })}
        </Card>

        <Card>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[18px] font-bold">Membership</h2>
            <span className="rounded-full bg-[#f47a4a] px-4 py-1.5 text-[11px] font-bold text-[#171717]">
              {managedMembership ? "Managed" : daysLeft !== null ? `${daysLeft} Days Left` : membershipStatus}
            </span>
          </div>
          <Row label="Member status" value={membershipStatus} />
          <Row label="Last payment" value={dateLabel(shell.summary.subscriptionStartDate, locale)} />
          <Row label="Next billing" value={managedMembership ? "Not applicable" : shell.summary.billingCancelled ? "Stopped" : dateLabel(nextBilling, locale)} />
          {!managedMembership && (
            <button type="button" onClick={manageMembership} className="mt-3 h-9 rounded-full border-0 bg-[#171717] px-4 text-[11px] font-semibold text-white">
              {!shell.summary.hasActiveSubscription ? "Start membership" : shell.summary.billingCancelled ? "Reactivate billing" : "Manage membership"}
            </button>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-[18px] font-bold">Participation Credits</h2>
            <span className="rounded-full bg-[#f47a4a] px-4 py-1.5 text-[11px] font-bold text-[#171717]">{shell.creditBalance} Credits Left</span>
          </div>
          {loadingHistory ? (
            <p className="text-[13px] text-[#6b6b6b]">Loading credit history…</p>
          ) : history.length ? (
            history.slice(0, 3).map((entry) => (
              <Row
                key={entry.id}
                label={`${entry.amount > 0 ? `+${entry.amount}` : entry.amount} · ${historyLabel(entry)}`}
                value={new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" }).format(new Date(entry.created_at))}
              />
            ))
          ) : (
            <p className="py-2 text-[13px] text-[#6b6b6b]">No participation-credit history yet.</p>
          )}
          <button type="button" onClick={() => router.push("/payment?product=participation_pack_5")} className="mt-3 h-9 rounded-full border-0 bg-[#171717] px-4 text-[11px] font-semibold text-white">Buy 5-credit pack</button>
        </Card>

        <Card>
          <h2 className="m-0 text-[18px] font-bold">Account Actions</h2>
          <p className="mb-4 mt-1 text-[12px] font-semibold text-[#b42331]">Danger Zone</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={async () => { await logout(); router.push("/"); }} className="h-9 rounded-full border border-[#e6e6e6] bg-white px-4 text-[11px] font-semibold">Log out</button>
            <button type="button" onClick={() => setDeleteOpen(true)} className="h-9 rounded-full border border-[#e6e6e6] bg-white px-4 text-[11px] font-semibold text-[#b42331]">Delete Account</button>
          </div>
        </Card>
      </div>

      {(shell.notice || shell.error) && mobile && (
        <div className={`mt-4 rounded-[14px] border border-[#e6e6e6] px-4 py-3 text-[13px] font-semibold ${shell.error ? "bg-[#fff1f2] text-[#b42331]" : "bg-white"}`}>
          {shell.error || shell.notice}
        </div>
      )}
    </div>
  );

  return (
    <>
      <DesktopProfileShell active="account" data={shell}>
        <AccountContent />
      </DesktopProfileShell>

      <main className="mx-auto min-h-[calc(100vh-68px)] w-full max-w-[430px] bg-[#f3f3f1] text-[#171717] min-[900px]:hidden">
        <AccountContent mobile />
      </main>

      {manageOpen && (
        <ManageMembershipModal
          status={membershipStatus}
          nextBilling={dateLabel(nextBilling, locale)}
          onClose={() => setManageOpen(false)}
          onStop={() => { setManageOpen(false); setSurvey("stop"); }}
          onRefund={() => { setManageOpen(false); setSurvey("refund"); }}
        />
      )}

      {survey === "stop" && (
        <SurveyModal title="Stop next billing" reasons={cancellationReasons} submitLabel="Stop next billing" onClose={() => setSurvey(null)} onSubmit={stopBilling} />
      )}
      {survey === "refund" && (
        <SurveyModal title="Cancel now & request refund" reasons={refundReasons} submitLabel="Cancel & request refund" danger onClose={() => setSurvey(null)} onSubmit={cancelAndRefund} />
      )}

      {deleteOpen && (
        <DeleteAccountModal
          phrase={t.profile.deleteAccountPhrase}
          requiresBillingStop={shell.summary.hasActiveSubscription && !shell.summary.billingCancelled}
          onClose={() => setDeleteOpen(false)}
          onConfirm={deleteAccount}
        />
      )}
    </>
  );
}
