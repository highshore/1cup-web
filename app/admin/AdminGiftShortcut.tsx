"use client";

import { GiftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import styled from "styled-components";

import { appLayout } from "../lib/constants/app_layout";
import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";

const Wrap = styled.div`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  box-sizing: border-box;
  margin: 0 auto 1rem;
  padding: 0 ${appLayout.pageGutterDesktop};

  @media (max-width: 640px) {
    padding-right: ${appLayout.pageGutterMobile};
    padding-left: ${appLayout.pageGutterMobile};
  }
`;

const GiftShortcut = styled.button`
  display: grid;
  width: 100%;
  min-height: 92px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.95rem 1rem;
  box-shadow: 3px 3px 0 #f47a4a;
  color: #050505;
  cursor: pointer;
  text-align: left;
  transition: transform 0.14s ease, box-shadow 0.14s ease;

  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0 #f47a4a;
  }

  &:focus-visible {
    outline: 3px solid #f47a4a;
    outline-offset: 3px;
  }

  svg {
    width: 1.5rem;
    height: 1.5rem;
  }
`;

const Copy = styled.span`
  min-width: 0;
`;

const Label = styled.span`
  display: block;
  font-size: 0.95rem;
  font-weight: 900;
`;

const Description = styled.span`
  display: block;
  margin-top: 0.28rem;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.4;
`;

const Arrow = styled.span`
  font-size: 1rem;
  font-weight: 900;
`;

export default function AdminGiftShortcut() {
  const router = useRouter();
  const { t } = useI18n();
  const { accountStatus, isLoading } = useAuth();

  if (isLoading || accountStatus !== "admin") return null;

  return (
    <Wrap>
      <GiftShortcut type="button" onClick={() => router.push("/admin/gifts")}>
        <GiftIcon />
        <Copy>
          <Label>{t.admin.gifts.navTitle}</Label>
          <Description>{t.admin.gifts.navDescription}</Description>
        </Copy>
        <Arrow aria-hidden="true">→</Arrow>
      </GiftShortcut>
    </Wrap>
  );
}
