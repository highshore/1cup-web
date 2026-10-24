"use client";

import { useEffect, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { useI18n } from "../../../i18n/I18nProvider";
import { newsletterColors as c, NewsletterTrack } from "../constants";
import { usePrefersReducedMotion } from "../hooks";
import LoopVideo from "./LoopVideo";

const Tile = styled.div<{ $background: string; $compact: boolean }>`
  position: relative;
  overflow: hidden;
  aspect-ratio: ${(props) => (props.$compact ? "16 / 10" : "4 / 3")};
  background: ${(props) => props.$background};
`;

const Caption = styled.div<{ $compact: boolean }>`
  position: absolute;
  right: ${(props) => (props.$compact ? "0.75rem" : "1rem")};
  bottom: ${(props) => (props.$compact ? "0.75rem" : "1rem")};
  left: ${(props) => (props.$compact ? "0.75rem" : "1rem")};
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border: 2px solid ${c.ink};
  border-radius: 12px;
  background: #ffffff;
  padding: ${(props) => (props.$compact ? "0.55rem 0.75rem" : "0.8rem 1rem")};
`;

const CaptionLabel = styled.span`
  font-size: 0.7rem;
  font-weight: 800;
  color: ${c.orangeText};
`;

const CaptionText = styled.span<{ $compact: boolean }>`
  font-size: ${(props) => (props.$compact ? "0.86rem" : "1rem")};
  font-weight: 800;
  line-height: 1.4;
  color: ${c.ink};
`;

const fade = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
`;

const Player = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.85rem;
  background:
    radial-gradient(circle at 25% 30%, rgba(255, 255, 255, 0.55), transparent 45%),
    linear-gradient(135deg, ${c.orange} 0%, #f9b48f 55%, ${c.cream} 100%);
`;

const PlayerTop = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  font-weight: 800;
  color: ${c.ink};
`;

const CC = styled.span`
  border: 2px solid ${c.ink};
  border-radius: 6px;
  background: #ffffff;
  padding: 0.05rem 0.35rem;
`;

const PlayGlyph = styled.span`
  display: inline-flex;
  align-self: center;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border: 2px solid ${c.ink};
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 3px 3px 0 ${c.ink};

  svg {
    width: 22px;
    height: 22px;
    margin-left: 3px;
  }
`;

const Subtitle = styled.p<{ $animate: boolean }>`
  align-self: center;
  max-width: 92%;
  margin: 0;
  border-radius: 8px;
  background: rgba(5, 5, 5, 0.82);
  padding: 0.35rem 0.7rem;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.45;
  text-align: center;
  color: #ffffff;
  ${(props) =>
    props.$animate &&
    css`
      animation: ${fade} 320ms ease-out both;
    `}
`;

const Progress = styled.div`
  height: 4px;
  margin-top: 0.6rem;
  border-radius: 999px;
  background: rgba(5, 5, 5, 0.18);

  span {
    display: block;
    width: 38%;
    height: 100%;
    border-radius: inherit;
    background: ${c.ink};
  }
`;

const sweep = keyframes`
  from { background-size: 0% 42%; }
  to { background-size: 100% 42%; }
`;

const Article = styled.div<{ $compact: boolean }>`
  position: absolute;
  inset: ${(props) => (props.$compact ? "0.75rem" : "1.1rem")};
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
  border: 2px solid ${c.ink};
  border-radius: 12px;
  background: #ffffff;
  padding: ${(props) => (props.$compact ? "0.85rem" : "1.25rem")};
`;

const Source = styled.span`
  font-size: 0.7rem;
  font-weight: 800;
  color: ${c.muted};
`;

const Headline = styled.p<{ $compact: boolean }>`
  margin: 0;
  font-size: ${(props) => (props.$compact ? "1.02rem" : "1.3rem")};
  font-weight: 900;
  line-height: 1.3;
  color: ${c.ink};

  mark {
    background: linear-gradient(${c.orange}, ${c.orange}) no-repeat left 85%;
    background-size: 100% 42%;
    color: inherit;
    animation: ${sweep} 900ms cubic-bezier(0.23, 1, 0.32, 1) 400ms both;
  }

  @media (prefers-reduced-motion: reduce) {
    mark {
      animation: none;
    }
  }
`;

const Dek = styled.p`
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: ${c.body};
`;

const Play = () => (
  <svg viewBox="0 0 24 24" fill={c.ink} aria-hidden>
    <path d="M7 4.5v15l12-7.5L7 4.5z" />
  </svg>
);

function highlight(text: string, word: string) {
  const index = text.toLowerCase().indexOf(word.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + word.length)}</mark>
      {text.slice(index + word.length)}
    </>
  );
}

// Per-track media tile: real footage for business, product-style mocks for drama and tech.
export default function TrackVisual({
  track,
  compact = false,
}: {
  track: NewsletterTrack;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const copy = t.newsletter.tracks[track];
  const demo = t.newsletter.demo;
  const example = copy.lesson.examples[0];
  const [showKo, setShowKo] = useState(false);

  useEffect(() => {
    if (track !== "drama" || reduced) return;
    const timer = setInterval(() => setShowKo((value) => !value), 2600);
    return () => clearInterval(timer);
  }, [track, reduced]);

  if (track === "business") {
    return (
      <Tile $background={c.surface} $compact={compact}>
        <LoopVideo src="/assets/newsletter/city-loop.mp4" poster="/assets/newsletter/city-poster.jpg" />
        <Caption $compact={compact}>
          <CaptionLabel>{t.newsletter.detail.coverCaption}</CaptionLabel>
          <CaptionText $compact={compact} lang="en">
            {example.en}
          </CaptionText>
        </Caption>
      </Tile>
    );
  }

  if (track === "drama") {
    return (
      <Tile $background={c.orange} $compact={compact}>
        <Player>
          <PlayerTop>
            <span>{showKo ? demo.subtitlesKo : demo.subtitlesEn}</span>
            <CC>CC</CC>
          </PlayerTop>
          <PlayGlyph>
            <Play />
          </PlayGlyph>
          <div>
            <Subtitle key={String(showKo)} $animate={!reduced} lang={showKo ? "ko" : "en"}>
              {showKo ? example.ko : example.en}
            </Subtitle>
            <Progress>
              <span />
            </Progress>
          </div>
        </Player>
      </Tile>
    );
  }

  return (
    <Tile $background={c.surface} $compact={compact}>
      <Article $compact={compact}>
        <Source>{demo.newsSource}</Source>
        <Headline $compact={compact} lang="en">
          {highlight(example.en, copy.lesson.expression)}
        </Headline>
        <Dek lang="ko">{example.ko}</Dek>
      </Article>
    </Tile>
  );
}
