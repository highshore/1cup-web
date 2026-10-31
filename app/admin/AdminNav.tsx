"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "../lib/i18n/I18nProvider";

type ItemId =
  | "overview"
  | "analytics"
  | "members"
  | "cancellations"
  | "meetups"
  | "articles"
  | "marketing"
  | "discountCodes"
  | "gifts"
  | "notifications";

type GroupId = "home" | "operations" | "content" | "growth";

// Grouped by how often the work happens: daily operations first, occasional
// promotion tools tucked under Growth. Routes are unchanged so bookmarks keep working.
const GROUPS: { id: GroupId; items: { id: ItemId; href: string }[] }[] = [
  {
    id: "home",
    items: [
      { id: "overview", href: "/admin" },
      { id: "analytics", href: "/admin/analytics" },
    ],
  },
  {
    id: "operations",
    items: [
      { id: "members", href: "/admin/members" },
      { id: "cancellations", href: "/admin/cancellations" },
      // Meetups are created and edited from the public meetup page's admin tools.
      { id: "meetups", href: "/meetup" },
    ],
  },
  {
    id: "content",
    items: [{ id: "articles", href: "/admin/articles" }],
  },
  {
    id: "growth",
    items: [
      { id: "marketing", href: "/admin/marketing" },
      { id: "discountCodes", href: "/admin/discount-codes" },
      { id: "gifts", href: "/admin/gifts" },
      { id: "notifications", href: "/admin/notifications" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const groupTabClass =
  "inline-flex items-center rounded-full border-2 px-4 py-1.5 text-[14px] font-black no-underline transition-colors";
const itemTabClass =
  "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-bold no-underline transition-colors";

export default function AdminNav() {
  const pathname = usePathname() ?? "/admin";
  const { t } = useI18n();
  const copy = t.admin.nav;

  const activeGroup =
    GROUPS.find((group) => group.items.some((item) => isActive(pathname, item.href))) ?? GROUPS[0];

  return (
    <nav
      aria-label={copy.ariaLabel}
      className="mx-auto mb-6 flex w-full max-w-[1400px] flex-col gap-3 px-5 pt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((group) => {
            const active = group.id === activeGroup.id;
            return (
              <Link
                key={group.id}
                href={group.items[0].href}
                aria-current={active ? "page" : undefined}
                className={`${groupTabClass} ${
                  active
                    ? "border-[#050505] bg-[#050505] text-white"
                    : "border-[#050505] bg-white text-[#050505] hover:bg-[#f7f6f2]"
                }`}
              >
                {copy.groups[group.id]}
              </Link>
            );
          })}
        </div>
        <Link
          href="/daily/admin"
          className="text-[13px] font-bold text-[rgba(5,5,5,0.64)] no-underline hover:text-[#050505]"
        >
          {copy.dailyAdmin}
        </Link>
      </div>

      {activeGroup.items.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b-2 border-[#050505] pb-2">
          {activeGroup.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${itemTabClass} ${
                  active
                    ? "bg-[#f47a4a] text-white"
                    : "text-[rgba(5,5,5,0.7)] hover:bg-[#f7f6f2] hover:text-[#050505]"
                }`}
              >
                {copy.items[item.id]}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
