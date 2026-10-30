import Link from "next/link";

import { formatKrw } from "../../lib/features/daily/constants";
import { loadDailyOverview } from "../../lib/features/daily/server/admin";

export const dynamic = "force-dynamic";

// /daily/admin: One Cup Daily's admin home. Korean only, like the rest of Daily.
const SECTIONS = [
  { href: "/daily/admin/lessons", title: "콘텐츠", detail: "초·중급·고급 레슨 전체를 날짜별로 보고 열어봐요." },
  { href: "/daily/admin/members", title: "멤버 관리", detail: "Daily 고객, 구독·이용권, 결제와 환불 합계를 봐요." },
  { href: "/daily/admin/refunds", title: "환불 기록", detail: "모든 환불은 규정대로 바로 처리돼요. 기록을 보고, 페이플이 거절한 건만 다시 처리해요." },
  { href: "/daily/admin/sentences", title: "함께 쓰는 문장", detail: "문장을 숨기거나 통역사 PICK을 골라요." },
] as const;

export default async function DailyAdminHome() {
  const o = await loadDailyOverview();
  const stats = [
    { label: "고객", value: o.customers },
    { label: "이용 중 (유료)", value: o.paying },
    { label: "자동 결제 켜짐", value: o.autoRenew },
    { label: "무료 체험 중", value: o.trials },
    { label: "확인 필요한 환불", value: o.openRefunds },
    { label: "최근 30일 순매출", value: `₩${formatKrw(o.revenue30d)}` },
  ];
  return (
    <div className="mx-auto w-full max-w-[752px] px-4 pb-20 pt-8 [word-break:keep-all]">
      <h1 className="m-0 text-[28px] font-black">Daily 관리자</h1>
      <p className="mt-2 text-[13px] font-semibold text-[rgba(5,5,5,0.6)]">
        One Cup Daily만 다뤄요. 1cup 멤버십·모임은 1cup 관리자(/admin)에서 관리해요.
      </p>

      <dl className="m-0 mt-6 grid grid-cols-2 gap-3 min-[700px]:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border-[3px] border-[#050505] bg-white p-4">
            <dt className="text-[12px] font-bold text-[rgba(5,5,5,0.6)]">{s.label}</dt>
            <dd className="m-0 mt-1 text-[24px] font-black">{s.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="m-0 mt-6 grid list-none gap-3 p-0 min-[700px]:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block h-full rounded-2xl bg-[#f47a4a] p-5 text-[#050505]">
              <span className="block text-[18px] font-black">{s.title}</span>
              <span className="mt-1 block text-[13px] font-semibold">{s.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
