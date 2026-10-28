"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { DAILY_PASSES, DAILY_TRACK_LABEL, formatKrw } from "../../../lib/features/daily/constants";
import type { DailyAdminMember, DailyAdminSubscription } from "../../../lib/features/daily/server/admin";

// Daily 멤버 관리: every Daily customer (Kakao Login), apart from 1cup's members. Read
// only; refunds are handled on /daily/admin/refunds. Korean only, like the rest of Daily.

type Filter = "all" | "paying" | "autoRenew" | "trial" | "ended";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "paying", label: "이용 중 (유료)" },
  { id: "autoRenew", label: "자동 결제" },
  { id: "trial", label: "체험 중" },
  { id: "ended", label: "끝남·체험만" },
];

const STATUS_LABEL: Record<DailyAdminSubscription["status"], string> = {
  trial: "체험 중",
  trial_ended: "체험 끝",
  active: "이용 중",
  cancelled: "끝남",
};

const PLAN_LABEL: Record<string, string> = {
  sub_30d: "정기구독",
  ...Object.fromEntries(DAILY_PASSES.map((p) => [p.id, p.label])),
};

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "numeric", day: "numeric" }) : "—";

const phoneLabel = (phone: string | null) =>
  phone && /^010\d{8}$/.test(phone) ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}` : phone ?? "—";

// Paid access running now: an active subscription whose paid period has not ended.
const isPaying = (s: DailyAdminSubscription) => s.status === "active" && !!s.paidUntil && new Date(s.paidUntil) > new Date();

function matches(member: DailyAdminMember, filter: Filter) {
  const subs = member.subscriptions;
  switch (filter) {
    case "paying":
      return subs.some(isPaying);
    case "autoRenew":
      return subs.some((s) => isPaying(s) && s.autoRenew);
    case "trial":
      return subs.some((s) => s.status === "trial");
    case "ended":
      return !subs.some((s) => isPaying(s) || s.status === "trial");
    default:
      return true;
  }
}

export default function DailyAdminMembersClient({ members }: { members: DailyAdminMember[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/-/g, "");
    return members.filter(
      (m) =>
        matches(m, filter) &&
        (!q ||
          (m.name ?? "").toLowerCase().includes(q) ||
          (m.phone ?? "").includes(q) ||
          (m.workplace ?? "").toLowerCase().includes(q)),
    );
  }, [members, query, filter]);

  return (
    <div className="mx-auto w-full max-w-[752px] px-4 pb-20 pt-8 [word-break:keep-all]">
      <Link href="/daily/admin" className="inline-flex items-center gap-1 text-[14px] font-bold text-[rgba(5,5,5,0.6)]">
        <ArrowLeftIcon className="size-4" />
        Daily 관리자
      </Link>
      <h1 className="m-0 mt-4 text-[28px] font-black">멤버 관리</h1>
      <p className="mt-2 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
        Daily 고객 {members.length}명. 1cup 멤버와는 따로예요. 삭제한 계정은 보이지 않아요.
      </p>

      <div className="mt-5 flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름, 휴대폰 번호, 소속으로 찾기"
          className="h-11 min-w-0 flex-1 rounded-xl border-2 border-[#050505] bg-white px-3 text-[15px] font-semibold outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`h-9 rounded-full px-3 text-[13px] font-black ${filter === f.id ? "bg-[#050505] text-white" : "bg-[#f5f5f4] text-[#050505]"}`}
            >
              {f.label} {f.id === filter ? visible.length : ""}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center font-bold text-[rgba(5,5,5,0.6)]">해당하는 고객이 없어요.</p>
      ) : (
        <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {visible.map((m) => (
            <li key={m.id} className="rounded-2xl border-2 border-[#050505] bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="m-0 text-[17px] font-black">
                  {m.name || "이름 없음"}
                  <span className="ml-2 text-[14px] font-bold text-[rgba(5,5,5,0.6)]">{phoneLabel(m.phone)}</span>
                </p>
                <p className="m-0 text-[12px] font-semibold text-[rgba(5,5,5,0.6)]">
                  가입 {day(m.createdAt)} · 최근 로그인 {day(m.lastLoginAt)}
                </p>
              </div>
              {(m.workplace || m.jobCategory) && (
                <p className="m-0 mt-1 text-[13px] font-semibold text-[#475569]">
                  {[m.workplace, m.jobCategory]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {m.subscriptions.length > 0 && (
                <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
                  {m.subscriptions.map((s) => (
                    <li key={`${s.track}-${s.createdAt}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#f5f5f4] px-3 py-2 text-[13px] font-semibold">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[12px] font-black ${
                          isPaying(s) || s.status === "trial" ? "bg-[#f47a4a] text-[#050505]" : "bg-white text-[#64748b]"
                        }`}
                      >
                        {STATUS_LABEL[s.status]}
                      </span>
                      <span className="font-black">{DAILY_TRACK_LABEL[s.track]}</span>
                      {s.plan && <span>{PLAN_LABEL[s.plan] ?? s.plan}</span>}
                      {s.paidUntil && <span>~{day(s.paidUntil)}</span>}
                      {s.status === "active" && <span>{s.autoRenew ? "자동 결제 켜짐" : "자동 결제 꺼짐"}</span>}
                      <span className="text-[#64748b]">{s.deliveryTime.slice(0, 5)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="m-0 mt-3 text-[13px] font-bold">
                결제 {m.paidCount}건 · ₩{formatKrw(m.paidTotal)}
                {m.refundedTotal > 0 && <span className="text-[#b91c1c]"> · 환불 ₩{formatKrw(m.refundedTotal)}</span>}
                {m.lastPaidAt && <span className="font-semibold text-[rgba(5,5,5,0.6)]"> · 최근 결제 {day(m.lastPaidAt)}</span>}
                {m.marketing && <span className="font-semibold text-[rgba(5,5,5,0.6)]"> · 혜택 소식 동의</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
