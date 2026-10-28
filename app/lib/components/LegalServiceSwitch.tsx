import Link from "next/link";

export type LegalDocType = "terms" | "privacy";
export type LegalService = "membership" | "daily";

// 1cupenglish.com runs two services with separate documents: the 영어 한잔 membership
// (/policy/terms, /policy/privacy) and 영어 한잔 Daily (/daily/terms, /daily/privacy).
// /policy/<type>?service=daily shows the Daily documents in place, so the site footer's
// links reach both. On the Daily pages, 영어 한잔 leads back to /policy/<type>.
export function legalHref(type: LegalDocType, service: LegalService, from: "policy" | "daily") {
  if (service === "membership") return `/policy/${type}`;
  return from === "daily" ? `/daily/${type}` : `/policy/${type}?service=daily`;
}

const OPTIONS: { service: LegalService; label: string }[] = [
  { service: "membership", label: "영어 한잔" },
  { service: "daily", label: "영어 한잔 Daily" },
];

export default function LegalServiceSwitch({
  type,
  current,
  from,
  className = "",
}: {
  type: LegalDocType;
  current: LegalService;
  from: "policy" | "daily";
  className?: string;
}) {
  return (
    <nav
      aria-label="서비스 선택"
      className={`inline-flex rounded-full border border-[#e5e5e5] bg-[#f5f5f4] p-1 ${className}`}
    >
      {OPTIONS.map(({ service, label }) => {
        const active = service === current;
        return (
          <Link
            key={service}
            href={legalHref(type, service, from)}
            replace={from === "policy"}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center rounded-full px-5 text-[0.9rem] font-bold no-underline transition-colors max-[400px]:px-4 max-[400px]:text-[0.85rem] ${
              active ? "bg-[#050505] text-white" : "text-[#64748b] hover:text-[#050505]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
