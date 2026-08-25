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
import styled, { css } from "styled-components";

import { useAuth } from "../../lib/contexts/auth_context";
import { appLayout } from "../../lib/constants/app_layout";
import { useI18n } from "../../lib/i18n/I18nProvider";
import NotificationDropdown from "../../lib/features/chat/components/NotificationDropdown";

const NAV_COLLAPSE_BREAKPOINT = "920px";

const Nav = styled.nav<{ $isTransparent: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: ${({ $isTransparent }) =>
    $isTransparent ? "transparent" : "rgba(255, 255, 255, 0.94)"};
  border-bottom: 1px solid
    ${({ $isTransparent }) =>
      $isTransparent ? "transparent" : "rgba(226, 232, 240, 0.82)"};
  backdrop-filter: ${({ $isTransparent }) =>
    $isTransparent ? "none" : "blur(14px)"};
  transition: background-color 160ms ease, border-color 160ms ease,
    backdrop-filter 160ms ease;
`;

const NavTrack = styled.div`
  --nav-control-height: 60px;
  --nav-item-height: 38px;
  --nav-action-size: 38px;

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  min-height: var(--nav-control-height);
  align-items: center;
  gap: 6px;
  margin: 0 auto;
  padding: 0 ${appLayout.pageGutterDesktop};
  transition: min-height 140ms ease;

  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    padding: 0 ${appLayout.pageGutterMobile};
  }

  @media (max-width: 520px) {
    --nav-action-size: 44px;
  }
`;

const BrandButton = styled.button`
  display: inline-flex;
  width: fit-content;
  min-height: var(--nav-item-height);
  align-items: center;
  justify-content: center;
  justify-self: start;
  border: 0;
  background: transparent;
  padding: 4px 0;
  cursor: pointer;
  &:hover { opacity: 0.82; }

  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    grid-column: 2;
    justify-self: center;
  }
`;

const LogoImage = styled.img`
  display: block;
  width: 90px;
  height: auto;
`;

const NavLinks = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  justify-self: center;
  gap: 3px;
  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) { display: none; }
`;

const NavLinkButton = styled.button<{ $active: boolean; $isTransparent: boolean }>`
  display: inline-flex;
  min-height: var(--nav-item-height);
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 999px;
  padding: 7px 15px;
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, box-shadow 140ms ease;

  ${({ $active, $isTransparent }) =>
    $isTransparent
      ? $active
        ? css`background: rgba(255,255,255,0.18); color: #fff;`
        : css`background: transparent; color: rgba(255,255,255,0.88); &:hover { background: rgba(255,255,255,0.14); color:#fff; }`
      : $active
        ? css`background:#e2e8f0; color:#0f172a;`
        : css`background:transparent; color:#475569; &:hover { background:#f1f5f9; color:#0f172a; }`}
  svg { width: 16px; height: 16px; }
`;

const RightActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
  gap: 4px;
  min-width: 0;
  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    grid-column: 3;
    margin-left: auto;
  }
`;

const LanguageButton = styled.button<{ $isTransparent: boolean }>`
  display: inline-flex;
  box-sizing: border-box;
  width: var(--nav-action-size);
  height: var(--nav-action-size);
  min-height: var(--nav-action-size);
  flex: 0 0 var(--nav-action-size);
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0;
  color: ${({ $isTransparent }) =>
    $isTransparent ? "rgba(255,255,255,0.88)" : "#475569"};
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  &:hover {
    background: ${({ $isTransparent }) =>
      $isTransparent ? "rgba(255,255,255,0.14)" : "#f8fafc"};
    color: ${({ $isTransparent }) => ($isTransparent ? "#fff" : "#0f172a")};
  }
`;

const LangIcon = styled.img<{ $isTransparent: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid ${({ $isTransparent }) =>
    $isTransparent ? "rgba(255,255,255,0.58)" : "#e2e8f0"};
  @media (max-width: 520px) { width: 22px; height: 22px; }
`;

const JoinButton = styled.button<{ $isTransparent: boolean }>`
  display: inline-flex;
  min-height: var(--nav-item-height);
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid ${({ $isTransparent }) =>
    $isTransparent ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.92)"};
  border-radius: 999px;
  background: ${({ $isTransparent }) => ($isTransparent ? "#fff" : "#0f172a")};
  padding: 7px 15px;
  color: ${({ $isTransparent }) => ($isTransparent ? "#0f172a" : "#fff")};
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  box-shadow: 0 7px 16px rgba(15,23,42,0.14);
  cursor: pointer;
  &:hover { box-shadow: 0 10px 24px rgba(15,23,42,0.18); }
  svg { width: 16px; height: 16px; }
  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) { display: none; }
`;

const MobileMenuButton = styled.button<{ $isTransparent: boolean }>`
  display: none;
  min-height: var(--nav-item-height);
  min-width: var(--nav-item-height);
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: ${({ $isTransparent }) => ($isTransparent ? "#fff" : "#0f172a")};
  cursor: pointer;
  &:hover { background: ${({ $isTransparent }) => $isTransparent ? "rgba(255,255,255,0.14)" : "#f1f5f9"}; }
  svg { width: 20px; height: 20px; }
  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    display: inline-flex;
    grid-column: 1;
    justify-self: start;
  }
`;

const MobileMenu = styled.div`
  display: none;
  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    display: grid;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    gap: 2px;
    border: 1px solid rgba(226,232,240,0.9);
    border-top: 0;
    border-radius: 0 0 14px 14px;
    background: rgba(255,255,255,0.98);
    padding: 6px;
  }
`;

const MobileNavButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  min-height: 36px;
  width: 100%;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 999px;
  padding: 6px 12px;
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 750;
  cursor: pointer;
  ${({ $active }) => $active
    ? css`background:#f1f5f9; color:#0f172a;`
    : css`background:transparent; color:#475569; &:hover { background:#f1f5f9; color:#0f172a; }`}
  svg { width: 15px; height: 15px; }
`;

const MobileJoinButton = styled.button`
  display: inline-flex;
  min-height: 36px;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid rgba(15,23,42,0.92);
  border-radius: 999px;
  background: #0f172a;
  padding: 6px 12px;
  color: #fff;
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
`;

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
    <Nav $isTransparent={isTransparent}>
      <NavTrack>
        <BrandButton onClick={() => handleNavigate("/")} aria-label="Home">
          <LogoImage src={logoSrc} alt="1 Cup English" />
        </BrandButton>

        <MobileMenuButton
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={locale === "en" ? "Toggle menu" : "메뉴 열기"}
          $isTransparent={isTransparent}
        >
          {isMobileMenuOpen ? <XMarkIcon /> : <Bars3Icon />}
        </MobileMenuButton>

        <NavLinks>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLinkButton
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                $active={isActivePath(item.path)}
                $isTransparent={isTransparent}
              >
                <Icon />
                {t.nav[item.labelKey]}
              </NavLinkButton>
            );
          })}
        </NavLinks>

        <RightActions>
          <LanguageButton onClick={toggleLanguage} $isTransparent={isTransparent}>
            <LangIcon
              src={locale === "en" ? "/images/flags/i18n_en.jpg" : "/images/flags/i18n_ko.jpg"}
              alt={locale}
              $isTransparent={isTransparent}
            />
          </LanguageButton>

          {isLoggedIn ? (
            // The profile photo is the single desktop account affordance. Notifications,
            // profile navigation and logout live in its dropdown; unread state is shown
            // directly on the photo so there is no competing bell icon in the navbar.
            <NotificationDropdown isTransparent={isTransparent} />
          ) : (
            <JoinButton onClick={handleJoin} $isTransparent={isTransparent}>
              <UserCircleIcon />
              {t.nav.join}
            </JoinButton>
          )}

        </RightActions>

        {isMobileMenuOpen && (
          <MobileMenu>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <MobileNavButton
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  $active={isActivePath(item.path)}
                >
                  <Icon />
                  {t.nav[item.labelKey]}
                </MobileNavButton>
              );
            })}

            {!isLoggedIn && (
              <MobileJoinButton onClick={handleJoin}>{t.nav.join}</MobileJoinButton>
            )}
          </MobileMenu>
        )}
      </NavTrack>
    </Nav>
  );
};

export default NewNavbar;
