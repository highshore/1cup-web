"use client";

import styled, { keyframes } from "styled-components";
import { useI18n } from "../../../i18n/I18nProvider";
import { NEWSLETTER_TRACKS, newsletterColors as c, NewsletterTrack } from "../constants";

const slide = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
`;

const Viewport = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  padding: 0.5rem 0 0.75rem;
  mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
`;

const Track = styled.div<{ $reverse?: boolean; $seconds: number }>`
  display: flex;
  width: max-content;
  gap: 1rem;
  animation: ${slide} ${(props) => props.$seconds}s linear infinite;
  animation-direction: ${(props) => (props.$reverse ? "reverse" : "normal")};

  ${Viewport}:hover & {
    animation-play-state: paused;
  }

  @media (prefers-reduced-motion: reduce) {
    flex-wrap: wrap;
    width: auto;
    justify-content: center;
    animation: none;
  }
`;

const Item = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 220px;
  border: 2px solid ${c.ink};
  border-radius: 14px;
  background: #ffffff;
  padding: 0.9rem 1.1rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.88);
`;

const Expression = styled.span`
  font-size: 1.15rem;
  font-weight: 900;
  color: ${c.ink};
`;

const Meaning = styled.span`
  font-size: 0.84rem;
  font-weight: 650;
  color: ${c.body};
`;

const TrackName = styled.span`
  align-self: flex-start;
  margin-bottom: 0.3rem;
  border-radius: 999px;
  background: ${c.cream};
  padding: 0.15rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: ${c.orangeText};
`;

type Entry = { key: string; track: string; en: string; ko: string };

// Two rows in opposite directions; duplicated so the loop is seamless.
export default function ExpressionMarquee({ tracks = NEWSLETTER_TRACKS }: { tracks?: readonly NewsletterTrack[] }) {
  const { t } = useI18n();
  const entries: Entry[] = tracks.flatMap((track) => {
    const copy = t.newsletter.tracks[track];
    return [
      { key: `${track}-lesson`, track: copy.title, en: copy.lesson.expression, ko: copy.lesson.meaning },
      ...copy.notBasic.map((item) => ({ key: `${track}-${item.en}`, track: copy.title, en: item.en, ko: item.ko })),
    ];
  });
  const half = Math.ceil(entries.length / 2);
  const rows = [entries.slice(0, half), entries.slice(half)].filter((row) => row.length);

  return (
    <Viewport>
      {rows.map((row, rowIndex) => (
        <Track key={rowIndex} $reverse={rowIndex === 1} $seconds={Math.max(30, row.length * 9)}>
          {[...row, ...row].map((entry, index) => (
            <Item key={`${entry.key}-${index}`} aria-hidden={index >= row.length}>
              <TrackName>{entry.track}</TrackName>
              <Expression lang="en">{entry.en}</Expression>
              <Meaning>{entry.ko}</Meaning>
            </Item>
          ))}
        </Track>
      ))}
    </Viewport>
  );
}
