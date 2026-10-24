"use client";

import { useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { useI18n } from "../../../i18n/I18nProvider";
import { NEWSLETTER_TRACKS, newsletterColors as c, NewsletterTrack } from "../constants";
import { useInView, usePrefersReducedMotion } from "../hooks";
import PhoneFrame from "./PhoneFrame";

const KAKAO_CHAT_BG = "#BACEE0";
const KAKAO_YELLOW = "#FEE500";
const CYCLE_MS = 6500;
const TYPING_MS = 1100;

const arrive = keyframes`
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to { opacity: 1; transform: none; }
`;

const blink = keyframes`
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
`;

const nudge = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(244, 122, 74, 0); }
  50% { box-shadow: 0 0 0 4px rgba(244, 122, 74, 0.55); }
`;

const ChatHeader = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 1rem 0.75rem;
  font-size: 0.95rem;
  font-weight: 800;
  color: ${c.ink};

  svg {
    width: 18px;
    height: 18px;
  }
`;

const Thread = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.75rem;
  overflow: hidden;
  padding: 0 0.85rem 1.1rem;
`;

const DatePill = styled.span`
  align-self: center;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  padding: 0.2rem 0.75rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: #ffffff;
`;

const Row = styled.div<{ $animate: boolean }>`
  display: flex;
  gap: 0.5rem;
  ${(props) =>
    props.$animate &&
    css`
      animation: ${arrive} 420ms cubic-bezier(0.23, 1, 0.32, 1) both;
    `}
`;

const Avatar = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 2px solid ${c.ink};
  border-radius: 12px;
  background: ${c.orange};
  font-size: 0.8rem;
  font-weight: 900;
  color: ${c.ink};
`;

const Column = styled.div`
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
`;

const Name = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  color: #3c4a57;
`;

const BubbleRow = styled.div`
  display: flex;
  gap: 0.3rem;
`;

const Bubble = styled.div`
  overflow: hidden;
  width: 196px;
  border-radius: 12px;
  background: #ffffff;
`;

const BubbleHead = styled.div`
  background: ${KAKAO_YELLOW};
  padding: 0.45rem 0.75rem;
  font-size: 0.74rem;
  font-weight: 800;
  color: ${c.ink};
`;

const BubbleBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.7rem 0.75rem 0.6rem;
  font-size: 0.72rem;
  line-height: 1.5;
  color: ${c.heading};
`;

const Intro = styled.span`
  font-weight: 800;
`;

const Expression = styled.span`
  margin-top: 0.3rem;
  font-size: 1.05rem;
  font-weight: 900;
  line-height: 1.25;
  color: ${c.ink};
`;

const Meaning = styled.span`
  font-weight: 700;
  color: ${c.orangeText};
`;

const Example = styled.span`
  margin-top: 0.35rem;
  font-weight: 600;
  color: ${c.body};
`;

const LessonButton = styled.span<{ $animate: boolean }>`
  display: block;
  margin: 0.2rem 0.75rem 0.75rem;
  border-radius: 8px;
  background: #f1f2f4;
  padding: 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-align: center;
  color: ${c.ink};
  ${(props) =>
    props.$animate &&
    css`
      animation: ${nudge} 1200ms ease-in-out 1300ms 2;
    `}
`;

const Time = styled.span`
  align-self: flex-end;
  flex-shrink: 0;
  font-size: 0.62rem;
  color: #3c4a57;
`;

const Typing = styled.div`
  display: inline-flex;
  gap: 4px;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.7rem 0.8rem;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${c.muted};
    animation: ${blink} 1s infinite;
  }

  span:nth-child(2) {
    animation-delay: 0.15s;
  }

  span:nth-child(3) {
    animation-delay: 0.3s;
  }
`;

const Back = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M15 5l-7 7 7 7" stroke={c.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Hero demo: the daily Alimtalk arriving at 8:00, cycling through the three tracks.
export default function KakaoDemo() {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, 0.3);
  const [index, setIndex] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (reduced || !inView) return;
    let typingTimer: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      setTyping(true);
      typingTimer = setTimeout(() => {
        setIndex((value) => (value + 1) % NEWSLETTER_TRACKS.length);
        setTyping(false);
      }, TYPING_MS);
    }, CYCLE_MS);
    return () => {
      clearInterval(cycle);
      clearTimeout(typingTimer);
    };
  }, [reduced, inView]);

  const track: NewsletterTrack = NEWSLETTER_TRACKS[index];
  const trackCopy = t.newsletter.tracks[track];
  const previousCopy =
    t.newsletter.tracks[NEWSLETTER_TRACKS[(index + NEWSLETTER_TRACKS.length - 1) % NEWSLETTER_TRACKS.length]];
  const demo = t.newsletter.demo;

  return (
    <div ref={rootRef}>
      <PhoneFrame
        time="8:00"
        background={KAKAO_CHAT_BG}
        label={`${demo.alimtalk}: ${trackCopy.lesson.expression}`}
      >
        <ChatHeader>
          <Back />
          {t.newsletter.brand.name}
        </ChatHeader>
        <Thread>
          <DatePill>{demo.yesterday}</DatePill>
          <Row $animate={false}>
            <Avatar>1</Avatar>
            <Column>
              <Name>{t.newsletter.brand.name}</Name>
              <BubbleRow>
                <Bubble>
                  <BubbleHead>{demo.alimtalk}</BubbleHead>
                  <BubbleBody>
                    <Intro>{demo.messageIntro.replace("{track}", previousCopy.title)}</Intro>
                    <Expression lang="en">{previousCopy.lesson.expression}</Expression>
                  </BubbleBody>
                </Bubble>
                <Time>{t.newsletter.detail.kakaoTime}</Time>
              </BubbleRow>
            </Column>
          </Row>
          <DatePill>{demo.today}</DatePill>
          {typing ? (
            <Row $animate={!reduced}>
              <Avatar>1</Avatar>
              <Typing>
                <span />
                <span />
                <span />
              </Typing>
            </Row>
          ) : (
            <Row key={track} $animate={!reduced}>
              <Avatar>1</Avatar>
              <Column>
                <Name>{t.newsletter.brand.name}</Name>
                <BubbleRow>
                  <Bubble>
                    <BubbleHead>{demo.alimtalk}</BubbleHead>
                    <BubbleBody>
                      <Intro>{demo.messageIntro.replace("{track}", trackCopy.title)}</Intro>
                      <Expression lang="en">{trackCopy.lesson.expression}</Expression>
                      <Meaning>{trackCopy.lesson.meaning}</Meaning>
                      <Example lang="en">{trackCopy.lesson.examples[0].en}</Example>
                    </BubbleBody>
                    <LessonButton $animate={!reduced}>{demo.openLesson}</LessonButton>
                  </Bubble>
                  <Time>{t.newsletter.detail.kakaoTime}</Time>
                </BubbleRow>
              </Column>
            </Row>
          )}
        </Thread>
      </PhoneFrame>
    </div>
  );
}
