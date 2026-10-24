"use client";

import Link from "next/link";
import styled, { css } from "styled-components";
import { appLayout } from "../../../constants/app_layout";
import { useI18n } from "../../../i18n/I18nProvider";
import { newsletterColors as c } from "../constants";

// Primitives mirror the production home (app/new-home/NewHomeClient.tsx):
// 2px ink borders, hard offset shadows, orange pill chips, 900-weight titles.

export const Page = styled.div`
  background: #ffffff;
  color: ${c.heading};
  font-family: "Noto Sans KR", sans-serif;
  word-break: keep-all;
`;

export const Section = styled.section<{ $background?: string }>`
  background: ${(props) => props.$background ?? "transparent"};
  padding: clamp(3.5rem, 7vw, 5.5rem) 0;
  /* Anchor targets clear the fixed global navbar. */
  scroll-margin-top: 74px;
`;

export const Container = styled.div<{ $narrow?: boolean }>`
  max-width: ${(props) => (props.$narrow ? "720px" : appLayout.pageMaxWidth)};
  margin: 0 auto;
  padding: 0 20px;

  @media (max-width: 768px) {
    padding: 0 1rem;
  }
`;

export const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: clamp(1.5rem, 4vw, 2.25rem);

  @media (max-width: 768px) {
    align-items: center;
    text-align: center;
  }
`;

export const Chip = styled.p`
  display: inline-flex;
  align-items: center;
  margin: 0 0 0.85rem;
  border: 2px solid ${c.ink};
  border-radius: 999px;
  background: ${c.orange};
  color: ${c.ink};
  padding: 0.34rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: 1.25;
`;

// Headings opt out of the global h1–h6 font and color.
export const SectionTitle = styled.h2`
  margin: 0;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(1.6rem, 2.4vw, 2.05rem);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
  color: ${c.heading};
`;

export const Accent = styled.span`
  color: ${c.orangeText};
`;

// Renders a multi-line title with the last line in the accent color, like the production home.
export function AccentLines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, index) =>
        index === lines.length - 1 ? (
          <Accent key={line}>{line}</Accent>
        ) : (
          <span key={line}>
            {line}
            <br />
          </span>
        ),
      )}
    </>
  );
}

export const SubTitle = styled.h3`
  margin: 0;
  font-family: "Noto Sans KR", sans-serif;
  font-size: 1.25rem;
  font-weight: 900;
  line-height: 1.3;
  color: ${c.heading};
`;

export const Description = styled.p`
  max-width: 32rem;
  margin: 1rem 0 0;
  color: ${c.muted};
  font-size: 0.98rem;
  font-weight: 620;
  line-height: 1.65;
`;

export const SmallText = styled.p<{ $color?: string }>`
  margin: 0;
  font-size: 0.82rem;
  font-weight: 580;
  line-height: 1.6;
  color: ${(props) => props.$color ?? c.muted};
`;

export const cardStyles = css`
  border: 2px solid ${c.ink};
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.88);
`;

export const Card = styled.div`
  ${cardStyles}
`;

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0.875rem 1.9rem;
  border: 2px solid ${c.ink};
  border-radius: 999px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 850;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 160ms ease, box-shadow 160ms ease,
    transform 160ms ease;

  &:hover {
    text-decoration: none;
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    cursor: not-allowed;
    box-shadow: none;
    opacity: 0.5;
  }
`;

// White pill with the orange offset shadow (production hero CTA).
const primary = css`
  ${buttonBase}
  background: #ffffff;
  color: ${c.ink};
  box-shadow: 5px 5px 0 ${c.orange};

  &:hover {
    color: ${c.ink};
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background: ${c.cream};
      box-shadow: 7px 7px 0 ${c.orange};
      transform: translate(-1px, -1px);
    }
  }
`;

// Orange pill with an ink offset shadow, for the main purchase action.
const orange = css`
  ${buttonBase}
  background: ${c.orange};
  color: ${c.ink};
  box-shadow: 4px 4px 0 ${c.ink};

  &:hover {
    color: ${c.ink};
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      box-shadow: 6px 6px 0 ${c.ink};
      transform: translate(-1px, -1px);
    }
  }
`;

// Plain ink outline for secondary actions on light backgrounds.
const outline = css`
  ${buttonBase}
  background: transparent;
  color: ${c.ink};

  &:hover {
    color: ${c.ink};
  }

  @media (hover: hover) {
    &:hover:not(:disabled) {
      background: ${c.cream};
    }
  }
`;

export const PrimaryLink = styled(Link)`
  ${primary}
`;
export const OrangeLink = styled(Link)`
  ${orange}
`;
export const OutlineLink = styled(Link)`
  ${outline}
`;
export const OrangeButton = styled.button`
  ${orange}
`;
export const OutlineButton = styled.button`
  ${outline}
`;

const BrandBarRoot = styled.div`
  border-bottom: 1px solid ${c.line};
  background: #ffffff;
`;

const BrandBarInner = styled(Container)`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding-top: 0.875rem;
  padding-bottom: 0.875rem;
`;

const Wordmark = styled(Link)`
  font-size: 1.15rem;
  font-weight: 900;
  color: ${c.ink};
  text-decoration: none;

  &:hover {
    color: ${c.ink};
    text-decoration: none;
  }
`;

const Endorsement = styled.span`
  font-size: 0.78rem;
  font-weight: 700;
  color: ${c.muted};
`;

// Sub-brand bar under the global navbar; the brand name is a placeholder until it is decided.
export function BrandBar() {
  const { t } = useI18n();
  return (
    <BrandBarRoot>
      <BrandBarInner>
        <Wordmark href="/newsletter">{t.newsletter.brand.name}</Wordmark>
        <Endorsement>{t.newsletter.brand.endorsement}</Endorsement>
      </BrandBarInner>
    </BrandBarRoot>
  );
}
