"use client";

import { useEffect, useState, useMemo } from "react";
import styled, { keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { HomeTopicArticle, fetchHomeTopicsClient } from "../services/topics_service_client";
import { useI18n } from "../../../i18n/I18nProvider";

const MOBILE_NAV_GUTTER = "1rem";

interface TopicsShowcaseProps {
  topics: HomeTopicArticle[];
}

const Section = styled.section`
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  padding: clamp(3.5rem, 7vw, 5rem) 0 clamp(4rem, 8vw, 6rem);
  background: #f47a4a;
  color: #050505;
  overflow: hidden;
`;

const SectionHeader = styled.div`
  max-width: 960px;
  margin: 0 auto clamp(2rem, 4vw, 3rem);
  padding: 0 clamp(1.25rem, 4vw, 1.5rem);
  text-align: left;

  @media (max-width: 768px) {
    text-align: center;
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const SectionTitle = styled.h2`
  font-size: clamp(1.85rem, 3vw, 2.4rem);
  font-weight: 900;
  color: #050505;
  margin-bottom: 1.5rem;
  line-height: 1.2;
  font-family: "Noto Sans KR", sans-serif;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

const Highlight = styled.span`
  color: #050505;
`;

const CarouselShell = styled.div`
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  padding: 0 0 2rem; /* Remove horizontal padding, keep bottom */
`;

const CarouselViewport = styled.div`
  width: 100%;
  overflow: visible;
`;

const autoScroll = keyframes`
  0% {
    transform: translate3d(0, 0, 0);
  }
  100% {
    transform: translate3d(-50%, 0, 0);
  }
`;

const AutoScrollWrapper = styled.div`
  width: 100%;
  overflow: hidden;
  position: relative;
  contain: layout paint style;
  transform: translateZ(0);

  &:hover > div {
    animation-play-state: paused;
  }
`;

const AutoScrollStrip = styled.div<{ $duration: number }>`
  display: flex;
  gap: clamp(0.85rem, 3vw, 1.5rem);
  animation: ${autoScroll} ${({ $duration }) => $duration}s linear infinite;
  animation-play-state: running;
  min-width: max-content;
  will-change: transform;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
`;

const TopicCard = styled.div`
  position: relative;
  border: 2px solid #050505;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  scroll-snap-align: start;
  transition: transform 220ms ease;
  flex: 0 0 clamp(240px, 26vw, 320px);
  aspect-ratio: 1 / 1;
  isolation: isolate;
  background: #fff8dc;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.88);
  contain: paint;
  transform: translateZ(0);
  backface-visibility: hidden;

  &:hover {
    transform: perspective(900px) rotateY(-3deg) translateY(-2px);
    box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.88);
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(5, 5, 5, 0) 22%, rgba(5, 5, 5, 0.82) 100%);
    opacity: 0.9;
    transition: opacity 200ms ease;
    pointer-events: none;
    z-index: 3;
  }

  @media (max-width: 640px) {
    flex-basis: min(78vw, 300px);
    box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.88);
  }
`;

const TopicImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  transform: translateZ(0);
  backface-visibility: hidden;
`;

const TopicImagePlaceholder = styled.div`
  position: absolute;
  inset: 0;
  background: #fff8dc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  z-index: 0;
`;

const TopicContent = styled.div`
  position: relative;
  z-index: 4;
  padding: clamp(1rem, 2.5vw, 1.3rem);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;

  @media (max-width: 640px) {
    padding: 1rem;
  }
`;

const TopicTitle = styled.h3`
  margin: 0;
  font-size: clamp(1rem, 2.2vw, 1.15rem);
  font-weight: 700;
  letter-spacing: -0.015em;
  color: #ffffff;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.32);

  @media (max-width: 640px) {
    font-size: 0.98rem;
    line-height: 1.32;
    -webkit-line-clamp: 3;
  }
`;

const ClickHint = styled.span`
  margin-top: 0.6rem;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 200ms ease, transform 200ms ease;

  svg {
    width: 0.95rem;
    height: 0.95rem;
  }

  ${TopicCard}:hover & {
    opacity: 1;
    transform: translateY(0);
  }

  @media (max-width: 640px) {
    opacity: 0.92;
    transform: none;
    font-size: 0.74rem;
  }
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 2rem;
  color: #050505;
  font-size: 1rem;
`;

export default function TopicsShowcase({ topics: initialTopics }: TopicsShowcaseProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [topics, setTopics] = useState<HomeTopicArticle[]>(initialTopics || []);
  const [loading, setLoading] = useState(!initialTopics || initialTopics.length === 0);

  const displayTopics = useMemo(
    () => (topics.length > 0 ? [...topics, ...topics] : []),
    [topics]
  );

  useEffect(() => {
    // Always fetch from the browser Supabase client if no initial topics
    if (!initialTopics || initialTopics.length === 0) {
      console.log('Fetching topics from client-side Supabase...');
      fetchHomeTopicsClient()
        .then(data => {
          console.log('Topics fetched:', data);
          if (data && Array.isArray(data)) {
            setTopics(data);
          }
        })
        .catch(error => {
          console.error('Error fetching topics:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [initialTopics]);

  const isAutoScrollEnabled = displayTopics.length > 0;
  const autoDuration = Math.max(displayTopics.length * 3, 18);

  // Always render the section
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          {t.home.topicsShowcase.titlePrefix}
          <Highlight>{t.home.topicsShowcase.titleHighlight}</Highlight>
          {t.home.topicsShowcase.titleSuffix}
        </SectionTitle>
      </SectionHeader>

      {loading ? (
        <LoadingState>{t.common.loading}</LoadingState>
      ) : topics.length > 0 ? (
        <CarouselShell>
          <CarouselViewport>
            {isAutoScrollEnabled ? (
              <AutoScrollWrapper>
                <AutoScrollStrip
                  $duration={autoDuration}
                >
                  {displayTopics.map((topic, idx) => (
                    <TopicCard
                      key={`${topic.id}-${idx}`}
                      onClick={() => router.push(`/article/${topic.id}`)}
                      aria-hidden={idx >= topics.length}
                    >
                      {topic.imageUrl ? (
                        <TopicImage
                          src={topic.imageUrl}
                          alt={topic.titleEnglish || topic.titleKorean}
                          width={320}
                          height={320}
                          loading={idx < 3 ? "eager" : "lazy"}
                          fetchPriority={idx < 2 ? "high" : "auto"}
                          decoding="async"
                          draggable={false}
                          onContextMenu={(event) => event.preventDefault()}
                        />
                      ) : (
                        <TopicImagePlaceholder>📰</TopicImagePlaceholder>
                      )}
                      <TopicContent>
                        <TopicTitle>
                          {locale === "ko"
                            ? topic.titleKorean || topic.titleEnglish
                            : topic.titleEnglish || topic.titleKorean}
                        </TopicTitle>
                        <ClickHint>
                          {t.home.topicsShowcase.hoverPrompt}
                          <ArrowUpRightIcon />
                        </ClickHint>
                      </TopicContent>
                    </TopicCard>
                  ))}
                </AutoScrollStrip>
              </AutoScrollWrapper>
            ) : null}
          </CarouselViewport>
        </CarouselShell>
      ) : null}
    </Section>
  );
}
