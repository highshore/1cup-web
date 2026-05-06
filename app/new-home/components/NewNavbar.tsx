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
    display: flex;
    flex-wrap: nowrap;
    padding: 0 ${appLayout.pageGutterMobile};
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
  border-radius: 0;
  background: transparent;
  padding: 4px 0;
  cursor: pointer;

  &:hover {
    opacity: 0.82;
  }

  @media (max-width: 420px) {
    padding: 4px 0;
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

  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    display: none;
  }
`;

const NavLinkButton = styled.button<{
  $active: boolean;
  $isTransparent: boolean;
}>`
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
  transition: background-color 140ms ease, color 140ms ease,
    box-shadow 140ms ease;

  ${({ $active, $isTransparent }) =>
    $isTransparent
      ? $active
        ? css`
            background: rgba(255, 255, 255, 0.18);
            color: #ffffff;
            box-shadow: none;
          `
        : css`
            background: transparent;
            color: rgba(255, 255, 255, 0.88);

            &:hover {
              background: rgba(255, 255, 255, 0.14);
              color: #ffffff;
            }
          `
      : $active
      ? css`
          background: #e2e8f0;
          color: #0f172a;
          box-shadow: none;
        `
      : css`
          background: transparent;
          color: #475569;

          &:hover {
            background: #f1f5f9;
            color: #0f172a;
          }
        `}

  svg {
    width: 16px;
    height: 16px;
  }
`;

const RightActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
  gap: 6px;
  min-width: 0;

  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    margin-left: auto;
  }
`;

const LanguageButton = styled.button<{ $isTransparent: boolean }>`
  display: inline-flex;
  min-height: var(--nav-item-height);
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 6px 9px;
  color: ${({ $isTransparent }) =>
    $isTransparent ? "rgba(255, 255, 255, 0.88)" : "#475569"};
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    background: ${({ $isTransparent }) =>
      $isTransparent ? "rgba(255, 255, 255, 0.14)" : "#f8fafc"};
    color: ${({ $isTransparent }) => ($isTransparent ? "#ffffff" : "#0f172a")};
  }

  @media (max-width: 520px) {
    padding: 6px 8px;

    span {
      display: none;
    }
  }
`;

const LangIcon = styled.img<{ $isTransparent: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid
    ${({ $isTransparent }) =>
      $isTransparent ? "rgba(255, 255, 255, 0.58)" : "#e2e8f0"};
`;

const JoinButton = styled.button<{ $isTransparent: boolean }>`
  display: inline-flex;
  min-height: var(--nav-item-height);
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid
    ${({ $isTransparent }) =>
      $isTransparent ? "rgba(255, 255, 255, 0.92)" : "rgba(15, 23, 42, 0.92)"};
  border-radius: 999px;
  background: ${({ $isTransparent }) =>
    $isTransparent ? "#ffffff" : "#0f172a"};
  padding: 7px 15px;
  color: ${({ $isTransparent }) => ($isTransparent ? "#0f172a" : "#ffffff")};
  font-family: inherit;
  font-size: 0.88rem;
  font-weight: 800;
  box-shadow: 0 7px 16px rgba(15, 23, 42, 0.14);
  cursor: pointer;

  &:hover {
    background: ${({ $isTransparent }) =>
      $isTransparent ? "rgba(255, 255, 255, 0.9)" : "#020617"};
    box-shadow: 0 10px 24px
      ${({ $isTransparent }) =>
        $isTransparent ? "rgba(0, 0, 0, 0.18)" : "rgba(15, 23, 42, 0.18)"};
  }

  svg {
    width: 16px;
    height: 16px;
  }

  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    display: none;
  }
`;

type AvatarVariant = "gdg" | "active" | "inactive" | "default";

const AvatarButton = styled.button<{ $variant: AvatarVariant }>`
  position: relative;
  width: var(--nav-item-height);
  height: var(--nav-item-height);
  border: ${({ $variant }) => {
    switch ($variant) {
      case "gdg":
        return "0";
      case "active":
        return "2px solid #22c55e";
      case "inactive":
        return "2px solid #cbd5e1";
      default:
        return "2px solid rgba(15, 23, 42, 0.14)";
    }
  }};
  border-radius: 50%;
  background: ${({ $variant }) =>
    $variant === "gdg"
      ? "conic-gradient(from 90deg, #4285f4, #db4437, #fbbc05, #34a853, #4285f4)"
      : "#ffffff"};
  padding: ${({ $variant }) => ($variant === "gdg" ? "2px" : "0")};
  box-shadow: 0 7px 16px rgba(15, 23, 42, 0.1);
  cursor: pointer;

  &:hover {
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
  }
`;

const AvatarInner = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: #ffffff;
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
`;

const AvatarFallback = styled.span`
  color: #0f172a;
  font-size: 0.95rem;
  font-weight: 800;
`;

const AvatarStatusDot = styled.span`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 11px;
  height: 11px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #22c55e;
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
  color: ${({ $isTransparent }) => ($isTransparent ? "#ffffff" : "#0f172a")};
  cursor: pointer;

  &:hover {
    background: ${({ $isTransparent }) =>
      $isTransparent ? "rgba(255, 255, 255, 0.14)" : "#f1f5f9"};
  }

  svg {
    width: 20px;
    height: 20px;
  }

  @media (max-width: ${NAV_COLLAPSE_BREAKPOINT}) {
    display: inline-flex;
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
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-top: 0;
    border-radius: 0 0 14px 14px;
    background: rgba(255, 255, 255, 0.98);
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

  ${({ $active }) =>
    $active
      ? css`
          background: #f1f5f9;
          color: #0f172a;
        `
      : css`
          background: transparent;
          color: #475569;

          &:hover {
            background: #f1f5f9;
            color: #0f172a;
          }
        `}

  svg {
    width: 15px;
    height: 15px;
  }
`;

const MobileJoinButton = styled.button`
  display: inline-flex;
  min-height: 36px;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid rgba(15, 23, 42, 0.92);
  border-radius: 999px;
  background: #0f172a;
  padding: 6px 12px;
  color: #ffffff;
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
  const { currentUser, logout, hasActiveSubscription, isGdgMember } = useAuth();
  const isLoggedIn = Boolean(currentUser);
  const isTransparent = pathname === "/" && !isScrolled;
  const logoSrc = isTransparent
    ? "/images/logos/1cup_logo_new_white.svg"
    : "/images/logos/1cup_logo_new.svg";
  const avatarSrc = currentUser?.photoURL || "/images/logos/1cup_logo_new.svg";
  const avatarInitial =
    currentUser?.displayName?.charAt(0).toUpperCase() ?? "U";
  const avatarVariant: AvatarVariant = isGdgMember
    ? "gdg"
    : hasActiveSubscription === true
    ? "active"
    : currentUser
    ? "inactive"
    : "default";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleLanguage = () => {
    setLocale(locale === "en" ? "ko" : "en");
  };

  const handleNavigate = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const handleJoin = () => {
    handleNavigate("/auth");
  };

  const handleProfileNav = () => {
    handleNavigate("/profile");
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMobileMenuOpen(false);
      router.push("/");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const isActivePath = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <Nav $isTransparent={isTransparent}>
      <NavTrack>
        <BrandButton onClick={() => handleNavigate("/")} aria-label="Home">
          <LogoImage src={logoSrc} alt="1 Cup English" />
        </BrandButton>

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
              src={
                locale === "en"
                  ? "/images/flags/i18n_en.jpg"
                  : "/images/flags/i18n_ko.jpg"
              }
              alt={locale}
              $isTransparent={isTransparent}
            />
            <span>{locale === "en" ? "ENG" : "한국어"}</span>
          </LanguageButton>

          {isLoggedIn ? (
            <AvatarButton
              onClick={handleProfileNav}
              aria-label={locale === "en" ? "Go to profile" : "프로필로 이동"}
              $variant={avatarVariant}
            >
              <AvatarInner>
                {currentUser?.photoURL ? (
                  <AvatarImage
                    src={avatarSrc}
                    alt="profile"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <AvatarFallback>{avatarInitial}</AvatarFallback>
                )}
              </AvatarInner>
              {avatarVariant === "active" && <AvatarStatusDot />}
            </AvatarButton>
          ) : (
            <JoinButton onClick={handleJoin} $isTransparent={isTransparent}>
              <UserCircleIcon />
              {t.nav.join}
            </JoinButton>
          )}

          <MobileMenuButton
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={locale === "en" ? "Toggle menu" : "메뉴 열기"}
            $isTransparent={isTransparent}
          >
            {isMobileMenuOpen ? <XMarkIcon /> : <Bars3Icon />}
          </MobileMenuButton>
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

            {isLoggedIn ? (
              <>
                <MobileNavButton
                  onClick={handleProfileNav}
                  $active={isActivePath("/profile")}
                >
                  <UserCircleIcon />
                  {locale === "en" ? "My Account" : "내 계정"}
                </MobileNavButton>
                <MobileJoinButton onClick={handleLogout}>
                  {locale === "en" ? "Logout" : "로그아웃"}
                </MobileJoinButton>
              </>
            ) : (
              <MobileJoinButton onClick={handleJoin}>
                {t.nav.join}
              </MobileJoinButton>
            )}
          </MobileMenu>
        )}
      </NavTrack>
    </Nav>
  );
};

export default NewNavbar;
