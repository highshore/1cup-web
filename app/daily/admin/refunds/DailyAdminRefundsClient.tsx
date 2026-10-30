"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../../../lib/contexts/auth_context";
import { invokeFunction } from "../../../lib/supabase/client";

// One Cup Daily refund records. Korean only, like the rest of Daily (a product decision:
// Daily is not localized). Every refund is approved by default: it is priced from the
// refund policy and cancelled through Payple the moment it is requested, with nobody
// deciding. This page keeps the record, and retries one Payple refused or never got.

type Status = "requested" | "refunding" | "refunded" | "rejected" | "failed";

interface RefundRow {
  id: string;
  amount: number;
  days_refunded: number;
  full_refund: boolean;
  reason: string | null;
  status: Status;
  requested_at: string;
  decided_at: string | null;
  note: string | null;
  error: string | null;
  refunded_at: string | null;
  order: {
    order_number: string;
    kind: "checkout" | "renewal";
    amount: number;
    track: "basic" | "advanced";
    completed_at: string;
    product_row: { name: string } | null;
  } | null;
  // A deleted account keeps its payments with no phone or name.
  customer: { phone: string | null; name: string | null } | null;
}

const STATUS_LABEL: Record<Status, string> = {
  requested: "페이플 전송 전 (다시 처리 가능)",
  refunding: "처리 중 (페이플 응답 확인 필요)",
  refunded: "환불 완료",
  rejected: "반려",
  failed: "실패 (다시 처리 가능)",
};
const STATUS_CLASS: Record<Status, string> = {
  requested: "bg-[#f47a4a] text-[#050505]",
  refunding: "bg-[#fde68a] text-[#050505]",
  refunded: "bg-[#dcfce7] text-[#166534]",
  rejected: "bg-[#f1f5f9] text-[#475569]",
  failed: "bg-[#fee2e2] text-[#991b1b]",
};
const TRACK = { basic: "초·중급", advanced: "고급" } as const;

const won = (n: number) => `₩${n.toLocaleString("ko-KR")}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const phone = (p: string | null) => (p ? p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3") : "삭제된 계정");

const panelClass = "rounded-2xl border border-[#e9e8e5] bg-white p-4 shadow-[0_3px_18px_rgba(0,0,0,0.035)] sm:p-5";
const buttonClass = "inline-flex h-10 items-center justify-center rounded-xl px-4 text-[14px] font-black disabled:opacity-40";

export default function AdminDailyRefundsClient() {
  const { currentUser, accountStatus, isLoading } = useAuth();
  const [rows, setRows] = useState<RefundRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await invokeFunction<{ refunds: RefundRow[] }>("daily", { action: "admin-refunds" });
      setRows(data.refunds);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "불러오지 못했어요.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    // The admin layout already checked on the server; this waits for the browser session.
    if (isLoading || !currentUser || accountStatus !== "admin") return;
    void load();
  }, [isLoading, currentUser, accountStatus, load]);

  const retry = async (row: RefundRow) => {
    if (!window.confirm(`${won(row.amount)}를 다시 환불할까요? 페이플에서 바로 승인 취소돼요.`)) return;
    setBusy(row.id);
    setMessage("");
    try {
      await invokeFunction("daily", { action: "admin-refund-decide", id: row.id });
      setMessage(`${won(row.amount)} 환불을 마쳤어요.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "처리하지 못했어요.");
    } finally {
      setBusy(null);
      await load();
    }
  };

  const visible = rows ?? [];
  const needsLook = visible.filter((r) => ["requested", "failed", "refunding"].includes(r.status)).length;

  return (
    <div className="mx-auto w-full max-w-[752px] px-4 pb-20 pt-8 [word-break:keep-all]">
      <Link href="/daily/admin" className="inline-flex items-center gap-1 text-[14px] font-bold text-[rgba(5,5,5,0.6)]">
        <ArrowLeftIcon className="size-4" />
        Daily 관리자
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-[28px] font-black">Daily 환불 기록</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className={`${buttonClass} bg-[#f5f5f4]`} aria-label="새로고침">
            <ArrowPathIcon className="size-5" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
        모든 환불은 따로 승인하지 않아요. 고객이 누르는 순간(계정 삭제 때도) 환불 규정(이용약관 제7조)으로 계산한 금액만큼 페이플에서 바로 취소되고, 여기에 기록돼요. 페이플이 거절했거나 전송되지 않은 건만 다시 처리할 수 있어요.
      </p>

      {rows !== null && needsLook > 0 && (
        <p className="mt-4 rounded-xl bg-[#fee2e2] px-4 py-3 text-[14px] font-bold text-[#991b1b]">확인이 필요한 환불 {needsLook}건</p>
      )}
      {message && <p className="mt-4 rounded-xl bg-[#fff8dc] px-4 py-3 text-[14px] font-bold">{message}</p>}

      {rows === null ? (
        <p className="mt-8 text-center font-bold text-[rgba(5,5,5,0.6)]">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-center font-bold text-[rgba(5,5,5,0.6)]">환불 기록이 없어요.</p>
      ) : (
        <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {visible.map((row) => (
            <li key={row.id} className={panelClass}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-[18px] font-black">
                    {won(row.amount)}{" "}
                    <span className="text-[14px] font-bold text-[rgba(5,5,5,0.6)]">
                      {row.full_refund ? "전액" : `남은 ${row.days_refunded}일`}
                      {row.order && ` · 결제 ${won(row.order.amount)}`}
                    </span>
                  </p>
                  <p className="m-0 mt-1 text-[14px] font-semibold">
                    {row.customer ? `${row.customer.name || "이름 없음"} · ${phone(row.customer.phone)}` : "고객 정보 없음"}
                  </p>
                  {row.order && (
                    <p className="m-0 mt-0.5 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
                      {row.order.product_row?.name ?? ""} · {TRACK[row.order.track]}
                      {row.order.kind === "renewal" ? " · 자동 결제" : ""} · 결제 {when(row.order.completed_at)} · {row.order.order_number}
                    </p>
                  )}
                  <p className="m-0 mt-0.5 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
                    요청 {when(row.requested_at)}
                    {row.refunded_at ? ` · 환불 ${when(row.refunded_at)}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[12px] font-black ${STATUS_CLASS[row.status]}`}>{STATUS_LABEL[row.status]}</span>
              </div>

              {row.reason && <p className="m-0 mt-3 rounded-xl bg-[#f5f5f4] px-3 py-2 text-[14px] font-semibold">“{row.reason}”</p>}
              {row.status === "rejected" && row.note && (
                <p className="m-0 mt-2 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">반려 이유: {row.note}</p>
              )}
              {row.error && <p className="m-0 mt-2 text-[13px] font-semibold text-[#991b1b]">{row.error}</p>}

              {(row.status === "requested" || row.status === "failed") && (
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => retry(row)}
                    className={`${buttonClass} bg-[#050505] text-white`}
                  >
                    {busy === row.id ? "처리 중…" : `${won(row.amount)} 다시 환불`}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
