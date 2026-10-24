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
  cardStyles,
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

const Grid = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Item = styled.li`
  ${cardStyles}
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.1rem;
  box-shadow: 4px 4px 0 ${c.orange};
`;

const IconCircle = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 2px solid ${c.ink};
  border-radius: 50%;
  background: ${c.cream};

  svg {
    width: 22px;
    height: 22px;
    color: ${c.ink};
  }
`;

const ItemText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const ItemTitle = styled.span`
  font-size: 0.98rem;
  font-weight: 900;
  line-height: 1.4;
  color: ${c.ink};
`;

const ItemDetail = styled.span`
  font-size: 0.84rem;
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
        <Grid>
          {copy.credentials.map((credential) => {
            const Icon = icons[credential.icon as keyof typeof icons];
            return (
              <Item key={credential.title}>
                <IconCircle>
                  <Icon aria-hidden />
                </IconCircle>
                <ItemText>
                  <ItemTitle>{credential.title}</ItemTitle>
                  <ItemDetail>{credential.detail}</ItemDetail>
                </ItemText>
              </Item>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}
