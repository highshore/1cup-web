"use client";

import styled from "styled-components";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "../../../i18n/I18nProvider";
import { newsletterColors as c } from "../constants";
import {
  AccentLines,
  Chip,
  Container,
  Description,
  Section,
  SectionHeader,
  SectionTitle,
} from "./NewsletterUI";

const icons = {
  work: BriefcaseIcon,
  military: ShieldCheckIcon,
  score: TrophyIcon,
  school: AcademicCapIcon,
  company: BuildingOffice2Icon,
} as const;

const Layout = styled.div`
  display: grid;
  gap: 2rem;

  @media (min-width: 900px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 3rem;
  }
`;

const Photos = styled.figure`
  position: relative;
  margin: 0;
  padding-bottom: 2.5rem;
`;

const PhotoMain = styled.img`
  display: block;
  width: 88%;
  aspect-ratio: 4 / 3;
  border: 2px solid ${c.ink};
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.88);
`;

const PhotoSecond = styled.img`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 48%;
  aspect-ratio: 1;
  border: 2px solid ${c.ink};
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 5px 5px 0 ${c.orange};
`;

const PhotoCaption = styled.figcaption`
  position: absolute;
  bottom: 0.4rem;
  left: 0;
  max-width: 48%;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.45;
  color: ${c.muted};
`;

const List = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 2px solid ${c.ink};
`;

const Item = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 0.95rem 0.25rem;
  border-bottom: 1px solid ${c.line};

  svg {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    margin-top: 0.1rem;
    color: ${c.ink};
  }
`;

const ItemText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`;

const ItemTitle = styled.span`
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.4;
  color: ${c.ink};
`;

const ItemDetail = styled.span`
  font-size: 0.85rem;
  font-weight: 650;
  color: ${c.muted};
`;

// Founder credentials without names, schools or employers; see app/lib/i18n/newsletter.ts.
export default function AuthorSection({ background }: { background?: string }) {
  const { t } = useI18n();
  const copy = t.newsletter.author;

  return (
    <Section $background={background}>
      <Container>
        <SectionHeader>
          <Chip>{copy.eyebrow}</Chip>
          <SectionTitle>
            <AccentLines text={copy.title} />
          </SectionTitle>
          <Description>{copy.description}</Description>
        </SectionHeader>
        <Layout>
          <Photos>
            <PhotoMain src="/assets/homepage/gallery2.webp" alt={copy.photoAlt} loading="lazy" />
            <PhotoSecond src="/assets/homepage/gallery1.webp" alt="" loading="lazy" />
            <PhotoCaption>{copy.photoCaption}</PhotoCaption>
          </Photos>
          <List>
            {copy.credentials.map((credential) => {
              const Icon = icons[credential.icon as keyof typeof icons];
              return (
                <Item key={credential.title}>
                  <Icon aria-hidden />
                  <ItemText>
                    <ItemTitle>{credential.title}</ItemTitle>
                    <ItemDetail>{credential.detail}</ItemDetail>
                  </ItemText>
                </Item>
              );
            })}
          </List>
        </Layout>
      </Container>
    </Section>
  );
}
