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
  background: rgb(128, 00, 33);
  color: #e5e7ff;
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
  color: #ffffff;
  margin-bottom: 1.5rem;
  line-height: 1.2;
  font-family: "Noto Sans KR", sans-serif;

  @media (max-width: 768px) {
    text-align: center;
  }
`;

const Highlight = styled.span`
  color: #ffb7c5;
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
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
`;

const AutoScrollWrapper = styled.div`
  width: 100%;
  overflow: visible;
  position: relative;
`;

const AutoScrollStrip = styled.div<{ $duration: number; $isPaused: boolean }>`
  display: flex;
  gap: clamp(0.85rem, 3vw, 1.5rem);
  animation: ${autoScroll} ${({ $duration }) => $duration}s linear infinite;
  animation-play-state: ${({ $isPaused }) => ($isPaused ? "paused" : "running")};
  min-width: max-content;
`;

const TopicCard = styled.div<{ $hovered: boolean }>`
  position: relative;
  border-radius: 22px;
  overflow: hidden;
  cursor: pointer;
  scroll-snap-align: start;
  transition: transform 220ms ease;
  flex: 0 0 clamp(240px, 26vw, 320px);
  aspect-ratio: 1 / 1;
  isolation: isolate;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);

  &:hover {
    transform: perspective(900px) rotateY(-6deg) translateY(-3px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%);
    opacity: 0.8;
    transition: opacity 200ms ease;
    pointer-events: none;
    z-index: 3;
  }
`;

const TopicImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;

const TopicImagePlaceholder = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
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
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const ClickHint = styled.span<{ $visible: boolean }>`
  margin-top: 0.6rem;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: translateY(${({ $visible }) => ($visible ? "0" : "6px")});
  transition: opacity 200ms ease, transform 200ms ease;

  svg {
    width: 0.95rem;
    height: 0.95rem;
  }
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
  font-size: 1rem;
`;

export default function TopicsShowcase({ topics: initialTopics }: TopicsShowcaseProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [topics, setTopics] = useState<HomeTopicArticle[]>(initialTopics || []);
  const [loading, setLoading] = useState(!initialTopics || initialTopics.length === 0);

  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const displayTopics = useMemo(
    () => (topics.length > 0 ? [...topics, ...topics] : []),
    [topics]
  );

  useEffect(() => {
    // Always fetch from client-side Firebase if no initial topics
    if (!initialTopics || initialTopics.length === 0) {
      console.log('Fetching topics from client-side Firebase...');
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

  const handleAutoHover = () => {
    setIsCarouselHovered(true);
  };

  const handleAutoLeave = () => {
    setIsCarouselHovered(false);
  };

  const handleCardMouseEnter = (id: string) => {
    setHoveredCardId(id);
  };

  const handleCardMouseLeave = () => {
    setHoveredCardId(null);
  };

  const isAutoScrollEnabled = displayTopics.length > 0;
  const autoDuration = Math.max(displayTopics.length * 3, 18);

  // Always render the section
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          모임에서 <Highlight>어떤 토픽</Highlight>을 다루나요?
        </SectionTitle>
      </SectionHeader>

      {loading ? (
        <LoadingState>{t.common.loading}</LoadingState>
      ) : topics.length > 0 ? (
        <CarouselShell>
          <CarouselViewport>
            {isAutoScrollEnabled ? (
              <AutoScrollWrapper
                onMouseEnter={handleAutoHover}
                onMouseLeave={handleAutoLeave}
              >
                <AutoScrollStrip
                  $duration={autoDuration}
                  $isPaused={isCarouselHovered}
                >
                  {displayTopics.map((topic, idx) => (
                    <TopicCard
                      key={`${topic.id}-${idx}`}
                      onClick={() => router.push(`/article/${topic.id}`)}
                      onMouseEnter={() => handleCardMouseEnter(topic.id)}
                      onMouseLeave={handleCardMouseLeave}
                      $hovered={hoveredCardId === topic.id}
                    >
                      {topic.imageUrl ? (
                        <TopicImage
                          src={topic.imageUrl}
                          alt={topic.titleEnglish || topic.titleKorean}
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
                        <ClickHint $visible={hoveredCardId === topic.id}>
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
