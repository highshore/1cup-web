"use client";

import React, { useEffect, useState } from "react";
import {
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  NewspaperIcon,
  TrophyIcon,
  UserCircleIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import NotificationDropdown from "../../lib/features/chat/components/NotificationDropdown";

// Collapse breakpoint is 920px (max-[920px]: variants below).

const NAV_ITEMS = [
  { path: "/shadow", labelKey: "shadowing", icon: ChatBubbleLeftRightIcon },
  { path: "/meetup", labelKey: "meetup", icon: UserGroupIcon },
  { path: "/leaderboard", labelKey: "leaderboard", icon: TrophyIcon },
  { path: "/blog", labelKey: "blog", icon: NewspaperIcon },
] as const;

const NewNavbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const isLoggedIn = Boolean(currentUser);
  const isTransparent = pathname === "/" && !isScrolled;
  const logoSrc = isTransparent
    ? "/images/logos/1cup_logo_new_white.svg"
    : "/images/logos/1cup_logo_new.svg";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleLanguage = () => setLocale(locale === "en" ? "ko" : "en");

  const handleNavigate = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const handleJoin = () => {
    const queryString = typeof window !== "undefined" ? window.location.search.slice(1) : "";
    const returnUrl = queryString ? `${pathname}?${queryString}` : pathname;
    const safeReturnUrl =
      returnUrl.startsWith("/auth") || returnUrl.startsWith("/kakao_callback")
        ? "/"
        : returnUrl;
    localStorage.setItem("returnUrl", safeReturnUrl);
    handleNavigate(`/auth?redirect=${encodeURIComponent(safeReturnUrl)}`);
  };

  const isActivePath = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 [transition:background-color_160ms_ease,border-color_160ms_ease,backdrop-filter_160ms_ease] border-b ${
        isTransparent
          ? "bg-transparent border-transparent"
          : "bg-[rgba(255,255,255,0.94)] border-[rgba(226,232,240,0.82)] backdrop-blur-[14px]"
      }`}
    >
      <div className="[--nav-control-height:60px] [--nav-item-height:38px] [--nav-action-size:38px] max-[520px]:[--nav-action-size:44px] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] relative box-border w-full max-w-page min-h-[var(--nav-control-height)] items-center gap-1.5 mx-auto px-gutter [transition:min-height_140ms_ease] max-[920px]:grid-cols-[1fr_auto_1fr] max-[920px]:px-gutter-mobile">
        <button
          className="inline-flex w-fit min-h-[var(--nav-item-height)] items-center justify-center justify-self-start border-0 bg-transparent px-0 py-1 cursor-pointer hover:opacity-[0.82] max-[920px]:col-start-2 max-[920px]:row-start-1 max-[920px]:justify-self-center"
          onClick={() => handleNavigate("/")}
          aria-label="Home"
        >
          <img className="block w-[90px] h-auto" src={logoSrc} alt="1 Cup English" />
        </button>

        <button
          className={`hidden min-h-[var(--nav-item-height)] min-w-[var(--nav-item-height)] items-center justify-center border-0 rounded-full bg-transparent cursor-pointer [&_svg]:w-5 [&_svg]:h-5 max-[920px]:inline-flex max-[920px]:col-start-1 max-[920px]:row-start-1 max-[920px]:justify-self-start ${
            isTransparent
              ? "text-white hover:bg-[rgba(255,255,255,0.14)]"
              : "text-[#0f172a] hover:bg-[#f1f5f9]"
          }`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={locale === "en" ? "Toggle menu" : "메뉴 열기"}
        >
          {isMobileMenuOpen ? <XMarkIcon /> : <Bars3Icon />}
        </button>

        <div className="inline-flex flex-wrap items-center justify-center justify-self-center gap-[3px] max-[920px]:hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`inline-flex min-h-[var(--nav-item-height)] items-center justify-center gap-1.5 border-0 rounded-full px-[15px] py-[7px] [font-family:inherit] text-[0.88rem] font-bold cursor-pointer [transition:background-color_140ms_ease,color_140ms_ease,box-shadow_140ms_ease] [&_svg]:w-4 [&_svg]:h-4 ${
                  isTransparent
                    ? active
                      ? "bg-[rgba(255,255,255,0.18)] text-white"
                      : "bg-transparent text-[rgba(255,255,255,0.88)] hover:bg-[rgba(255,255,255,0.14)] hover:text-white"
                    : active
                      ? "bg-[#e2e8f0] text-[#0f172a]"
                      : "bg-transparent text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                }`}
              >
                <Icon />
                {t.nav[item.labelKey]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end justify-self-end gap-1 min-w-0 max-[920px]:col-start-3 max-[920px]:row-start-1 max-[920px]:ml-auto">
          <button
            className={`inline-flex box-border w-[var(--nav-action-size)] h-[var(--nav-action-size)] min-h-[var(--nav-action-size)] flex-[0_0_var(--nav-action-size)] items-center justify-center border-0 rounded-full bg-transparent p-0 [font-family:inherit] text-[0.88rem] font-bold cursor-pointer ${
              isTransparent
                ? "text-[rgba(255,255,255,0.88)] hover:bg-[rgba(255,255,255,0.14)] hover:text-white"
                : "text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]"
            }`}
            onClick={toggleLanguage}
          >
            <img
              className={`w-[22px] h-[22px] rounded-full object-cover border max-[520px]:w-7 max-[520px]:h-7 ${
                isTransparent ? "border-[rgba(255,255,255,0.58)]" : "border-[#e2e8f0]"
              }`}
              src={locale === "en" ? "/images/flags/i18n_en.jpg" : "/images/flags/i18n_ko.jpg"}
              alt={locale}
            />
          </button>

          {isLoggedIn ? (
            // The profile photo is the single desktop account affordance. Notifications,
            // profile navigation and logout live in its dropdown; unread state is shown
            // directly on the photo so there is no competing bell icon in the navbar.
            <NotificationDropdown isTransparent={isTransparent} />
          ) : (
            <button
              className={`inline-flex min-h-[var(--nav-item-height)] items-center justify-center gap-1.5 border rounded-full px-[15px] py-[7px] [font-family:inherit] text-[0.88rem] font-extrabold shadow-[0_7px_16px_rgba(15,23,42,0.14)] cursor-pointer hover:shadow-[0_10px_24px_rgba(15,23,42,0.18)] [&_svg]:w-4 [&_svg]:h-4 max-[920px]:hidden ${
                isTransparent
                  ? "border-[rgba(255,255,255,0.92)] bg-white text-[#0f172a]"
                  : "border-[rgba(15,23,42,0.92)] bg-[#0f172a] text-white"
              }`}
              onClick={handleJoin}
            >
              <UserCircleIcon />
              {t.nav.join}
            </button>
          )}

        </div>

        {isMobileMenuOpen && (
          <div className="hidden max-[920px]:grid absolute top-full left-0 right-0 gap-[2px] border border-[rgba(226,232,240,0.9)] border-t-0 rounded-t-none rounded-b-[14px] bg-[rgba(255,255,255,0.98)] p-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`inline-flex min-h-9 w-full items-center gap-1.5 border-0 rounded-full px-3 py-1.5 [font-family:inherit] text-[0.86rem] font-[750] cursor-pointer [&_svg]:w-[15px] [&_svg]:h-[15px] ${
                    active
                      ? "bg-[#f1f5f9] text-[#0f172a]"
                      : "bg-transparent text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                  }`}
                >
                  <Icon />
                  {t.nav[item.labelKey]}
                </button>
              );
            })}

            {!isLoggedIn && (
              <button
                className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 border border-[rgba(15,23,42,0.92)] rounded-full bg-[#0f172a] px-3 py-1.5 text-white [font-family:inherit] text-[0.86rem] font-extrabold cursor-pointer"
                onClick={handleJoin}
              >
                {t.nav.join}
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default NewNavbar;
