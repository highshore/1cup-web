"use client";

import {
  AcademicCapIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  AccentLines,
  Chip,
  Container,
  Description,
  Section,
  SectionHeader,
  SectionTitle,
  Tone,
} from "./NewsletterUI";

const icons = {
  work: BriefcaseIcon,
  military: ShieldCheckIcon,
  score: TrophyIcon,
  school: AcademicCapIcon,
  company: BuildingOffice2Icon,
} as const;

// Founder credentials without names, schools or employers; see app/lib/i18n/newsletter.ts.
export default function AuthorSection({ tone }: { tone?: Tone }) {
  const { t } = useI18n();
  const copy = t.newsletter.author;

  return (
    <Section tone={tone}>
      <Container>
        <SectionHeader>
          <Chip>{copy.eyebrow}</Chip>
          <SectionTitle>
            <AccentLines text={copy.title} />
          </SectionTitle>
          <Description>{copy.description}</Description>
        </SectionHeader>
        <div className="grid gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[900px]:items-center min-[900px]:gap-12">
          <figure className="relative m-0 pb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/homepage/gallery2.webp"
              alt={copy.photoAlt}
              loading="lazy"
              className="block aspect-[4/3] w-[88%] rounded-[14px] border-2 border-[#050505] object-cover shadow-[5px_5px_0_rgba(5,5,5,0.88)]"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/homepage/gallery1.webp"
              alt=""
              loading="lazy"
              className="absolute right-0 bottom-0 aspect-square w-[48%] rounded-[14px] border-2 border-[#050505] object-cover shadow-[5px_5px_0_#f47a4a]"
            />
            <figcaption className="absolute bottom-[0.4rem] left-0 max-w-[48%] text-[0.8rem] font-bold leading-[1.45] text-[#64748b]">
              {copy.photoCaption}
            </figcaption>
          </figure>
          <ul className="m-0 flex list-none flex-col border-t-2 border-[#050505] p-0">
            {copy.credentials.map((credential) => {
              const Icon = icons[credential.icon as keyof typeof icons];
              return (
                <li
                  key={credential.title}
                  className="flex items-start gap-[0.85rem] border-b border-[#e5e7eb] px-1 py-[0.95rem]"
                >
                  <Icon aria-hidden className="mt-[0.1rem] size-6 shrink-0 text-[#050505]" />
                  <span className="flex flex-col gap-[0.1rem]">
                    <span className="text-base font-black leading-[1.4] text-[#050505]">{credential.title}</span>
                    <span className="text-[0.85rem] font-[650] text-[#64748b]">{credential.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
