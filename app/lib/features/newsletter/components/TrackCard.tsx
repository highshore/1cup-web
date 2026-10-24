"use client";

import Link from "next/link";
import styled from "styled-components";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  formatKrw,
  NEWSLETTER_MEMBER_PRICE_KRW,
  NEWSLETTER_MONTHLY_PRICE_KRW,
  newsletterColors as c,
  NewsletterTrack,
  trackCoverTheme,
} from "../constants";

const CardLink = styled(Link)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 2px solid ${c.ink};
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.88);
  color: ${c.heading};
  text-decoration: none;
  transition: box-shadow 160ms ease, transform 160ms ease;

  &:hover {
    color: ${c.heading};
    text-decoration: none;
  }

  @media (hover: hover) {
    &:hover {
      transform: translate(-1px, -1px);
      box-shadow: 7px 7px 0 rgba(5, 5, 5, 0.88);
    }
  }
`;

const Cover = styled.div<{ $background: string; $foreground: string }>`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.5rem;
  min-height: 168px;
  padding: 1.25rem;
  border-bottom: 2px solid ${c.ink};
  background: ${(props) => props.$background};
  color: ${(props) => props.$foreground};
`;

const CoverEyebrow = styled.span<{ $color: string }>`
  font-size: 0.78rem;
  font-weight: 900;
  color: ${(props) => props.$color};
`;

const CoverTitle = styled.span`
  font-size: 1.85rem;
  font-weight: 900;
  line-height: 1.18;
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem 1.25rem 1.25rem;
`;

const Tagline = styled.span`
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.55;
  color: ${c.body};
`;

const PriceRow = styled.span`
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
`;

const Price = styled.span`
  font-size: 1.4rem;
  font-weight: 900;
  color: ${c.ink};
`;

const Muted = styled.span`
  font-size: 0.85rem;
  font-weight: 650;
  color: ${c.muted};
`;

const MemberPrice = styled.span`
  align-self: flex-start;
  border-radius: 999px;
  background: ${c.cream};
  padding: 0.2rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 800;
  color: ${c.orangeText};
`;

export default function TrackCard({ track }: { track: NewsletterTrack }) {
  const { t } = useI18n();
  const copy = t.newsletter.tracks[track];
  const theme = trackCoverTheme[track];

  return (
    <CardLink href={`/newsletter/${track}`}>
      <Cover $background={theme.background} $foreground={theme.foreground}>
        <CoverEyebrow $color={theme.eyebrow}>
          {t.newsletter.storefront.coverEyebrow}
        </CoverEyebrow>
        <CoverTitle>{copy.title}</CoverTitle>
      </Cover>
      <Body>
        <Tagline>{copy.tagline}</Tagline>
        <PriceRow>
          <Price>
            {t.newsletter.price.amount.replace(
              "{price}",
              formatKrw(NEWSLETTER_MONTHLY_PRICE_KRW),
            )}
          </Price>
          <Muted>{t.newsletter.price.perMonth}</Muted>
        </PriceRow>
        <MemberPrice>
          {t.newsletter.price.memberShort.replace(
            "{price}",
            formatKrw(NEWSLETTER_MEMBER_PRICE_KRW),
          )}
        </MemberPrice>
      </Body>
    </CardLink>
  );
}
