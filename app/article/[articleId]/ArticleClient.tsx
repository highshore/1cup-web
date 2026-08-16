"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase/firebase";
import styled from "styled-components";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import React from "react";
import {
  ArrowUpTrayIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  LanguageIcon,
  LockClosedIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  uploadArticleImage,
  validateArticleImageFiles,
} from "../../lib/features/article/services/article_image_service";

// Import modular components
import TranslationWarning from "./components/TranslationWarning";
import { colors } from "./constants/colors";

interface ArticleData {
  content: {
    english: string[];
    korean: string[];
  };
  keywords: string[]; // Changed to just array of word strings
  timestamp: Timestamp;
  title: {
    english: string;
    korean: string;
  };
  url: string;
  image_url?: string; // Added new optional field
  discussion_topics?: string[]; // Added new optional field
  discussion_topic_ids?: string[];
  summary?: {
    english?: string[];
    korean?: string[];
  };
  source_url?: string; // Added new optional field
  figures?: ArticleFigure[]; // Inline figures/charts supplied by the editor
  publicationStatus?: "processing" | "published" | "failed";
}

interface ArticleFigure {
  kind?: string; // "photo" | "chart" | "table" | "illustration" | ...
  caption?: { english?: string; korean?: string };
  display_url?: string | null; // generated image for photos, original crop for charts
  original_url?: string | null;
  generated_url?: string | null;
  bbox?: number[];
  is_hero?: boolean;
  after_paragraph?: number;
}

interface DiscussionTopicStats {
  topicId: string;
  score: number;
  upvotes: number;
  downvotes: number;
}

type TopicVoteValue = -1 | 0 | 1;

interface DiscussionTopicEntry {
  id: string;
  originalIndex: number;
  text: string;
}

interface DiscussionVoteResult {
  topicId: string;
  vote: TopicVoteValue;
  upvotes: number;
  downvotes: number;
  score: number;
}

const discussionTopicEntriesFor = (article: ArticleData | null): DiscussionTopicEntry[] =>
  (article?.discussion_topics || []).flatMap((topic, originalIndex) => {
    const text = typeof topic === "string" ? topic.trim() : "";
    if (!text) return [];
    const configuredId = article?.discussion_topic_ids?.[originalIndex];
    return [
      {
        id:
          typeof configuredId === "string" && /^[A-Za-z0-9_-]+$/.test(configuredId)
            ? configuredId
            : "topic-" + originalIndex,
        originalIndex,
        text,
      },
    ];
  });

interface WordData {
  categories: {
    english: string[];
    korean: string[];
  };
  definitions: {
    english: string;
    korean: string;
  };
  examples: Array<{
    english: string[];
    korean: string[];
  }>;
  synonyms: string[];
  antonyms: string[];
}

const NAVBAR_MAX_WIDTH = 960;
const NAVBAR_OFFSET_DESKTOP = 85;
const NAVBAR_OFFSET_MOBILE = 75;
const NAVBAR_PADDING_DESKTOP = "1.5rem";
const NAVBAR_PADDING_MOBILE = "1.5rem";
const DESKTOP_PAGE_TOP_PADDING = "1.75rem";

const ArticleContainer = styled.div`
  width: 100%;
  max-width: ${NAVBAR_MAX_WIDTH}px;
  margin: 0 auto;
  padding: 0 ${NAVBAR_PADDING_DESKTOP} clamp(2rem, 3vw, 2.75rem);
  min-height: 100vh;
  background: transparent;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Roboto", "Helvetica Neue", Arial, sans-serif;
  position: relative;
  padding-top: 0;

  @media (max-width: 768px) {
    padding: 0 ${NAVBAR_PADDING_MOBILE} 1.75rem;
    width: 100%;
    min-height: auto;
    overflow-x: hidden;
  }

  @media (max-width: 480px) {
    padding: 0 ${NAVBAR_PADDING_MOBILE} 1rem;
  }
`;

const Title = styled.h1`
  font-size: 2rem;
  margin: 0 0 0.5rem 0;
  color: #050505;
  font-weight: 900;
  line-height: 1.2;
  cursor: pointer;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Roboto", "Helvetica Neue", Arial, sans-serif;

  @media (max-width: 768px) {
    font-size: 1.7rem;
  }

  &:hover {
    color: #f47a4a;
  }
`;

const Subtitle = styled.h2<{ isVisible: boolean }>`
  font-size: 1.6rem;
  margin-bottom: 1.5rem;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 600;
  line-height: 1.3;
  max-height: ${(props) => (props.isVisible ? "200px" : "0")};
  overflow: hidden;
  opacity: ${(props) => (props.isVisible ? 1 : 0)};
  transition: all 0.3s ease;
  margin-top: ${(props) => (props.isVisible ? "0.25rem" : "0")};

  @media (max-width: 768px) {
    font-size: 1.4rem;
    margin-bottom: 1.2rem;
  }
`;

const TitleHeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;

const TitleTextGroup = styled.div`
  flex: 1;
  min-width: 250px;
`;

const QuickSummaryCard = styled.section`
  background: #ffffff;
  border: 2px solid #050505;
  border-radius: 14px;
  margin-bottom: 1rem;
  overflow: hidden;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.9);

  @media (max-width: 768px) {
    border-radius: 12px;
  }
`;

const QuickSummaryHeader = styled.div`
  padding: 1rem 1.1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  @media (max-width: 768px) {
    padding: 0.9rem 1rem;
  }
`;

const QuickSummaryTitle = styled.span`
  font-size: 1.05rem;
  font-weight: 800;
`;

const QuickSummaryActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const QuickSummaryLanguageButton = styled.button`
  min-height: 1.7rem;
  box-sizing: border-box;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  padding: 0 0.5rem;
  font-size: 0.64rem;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;

  svg {
    width: 0.72rem;
    height: 0.72rem;
  }

  &:hover {
    background: #f47a4a;
  }
`;

const QuickSummaryExpandButton = styled.button`
  width: 1.7rem;
  height: 1.7rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #050505;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: #f47a4a;
  }

  &:focus-visible {
    outline: 3px solid rgba(244, 122, 74, 0.45);
    outline-offset: 2px;
  }
`;

const QuickSummaryChevron = styled(ChevronDownIcon)<{ $isExpanded: boolean }>`
  width: 1.35rem;
  height: 1.35rem;
  flex: 0 0 auto;
  transition: transform 0.18s ease;
  transform: rotate(${(props) => (props.$isExpanded ? "180deg" : "0deg")});
`;

const QuickSummaryList = styled.ul`
  margin: -0.1rem 1.1rem 1rem 2.35rem;
  padding: 0;
  color: #050505;
  list-style: disc outside;

  @media (max-width: 768px) {
    margin: -0.1rem 1rem 0.9rem 2.1rem;
  }
`;

const QuickSummaryItem = styled.li`
  padding-left: 0.15rem;
  font-size: 0.98rem;
  line-height: 1.58;

  & + & {
    margin-top: 0.55rem;
  }
`;

const QuickSummaryEllipsis = styled.li`
  list-style: none;
  margin: 0.15rem 0 0 0.15rem;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 800;
  letter-spacing: 0.12em;
`;

const ReadingTime = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #050505;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.4rem 0.8rem;
  background: #ffffff;
  border: 2px solid #050505;
  border-radius: 999px;
  height: 2rem;
  box-sizing: border-box;

  &::before {
    content: "⏱";
    font-size: 1rem;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.35rem 0.7rem;
    height: 1.8rem;
  }
`;

const SourceTab = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #050505;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.4rem 0.8rem;
  background: #ffffff;
  border: 2px solid #050505;
  border-radius: 999px;
  height: 2rem;
  box-sizing: border-box;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.16s ease;

  &::before {
    font-size: 1rem;
  }

  &:hover {
    background: #f47a4a;
    color: #050505;
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.35rem 0.7rem;
    height: 1.8rem;
  }
`;

const SectionTitle = styled.h3`
  display: inline-flex;
  align-items: center;
  margin-bottom: 1.2rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.3rem 0.75rem;
  font-size: 1.05rem;
  font-weight: 900;
  word-break: keep-all;

  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 1rem;
  }
`;

const ContentSection = styled.div`
  margin-bottom: 1.5rem;
  width: 100%;
  background: transparent;
`;

const Paragraph = styled.p`
  font-size: 1.1rem;
  line-height: 1.7;
  color: #050505;
  font-weight: 400;
  cursor: pointer;
  margin-bottom: 0;

  @media (max-width: 768px) {
    font-size: 1.05rem;
    line-height: 1.6;
  }

  &:hover {
    color: #f47a4a;
  }
`;

const KoreanParagraph = styled.p<{ isVisible: boolean }>`
  font-size: 1.05rem;
  line-height: 1.7;
  margin-bottom: ${(props) => (props.isVisible ? "0.5rem" : "0")};
  color: #050505;
  font-weight: 400;
  background: #fff6f0;
  padding: 1rem;
  border-radius: 10px;
  max-height: ${(props) => (props.isVisible ? "auto" : "0")};
  opacity: ${(props) => (props.isVisible ? 1 : 0)};
  overflow-y: ${(props) => (props.isVisible ? "auto" : "hidden")};
  transition: all 0.3s ease;
  margin-top: ${(props) => (props.isVisible ? "0.15rem" : "0")};

  @media (max-width: 768px) {
    font-size: 1rem;
    line-height: 1.6;
    padding: 0.9rem;
    max-height: ${(props) => (props.isVisible ? "none" : "0")};
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-size: 1.2rem;
  font-weight: 700;
  color: rgba(5, 5, 5, 0.6);
  background: transparent;
`;

const ErrorContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-size: 1.2rem;
  font-weight: 800;
  color: #050505;
  background: transparent;
`;

const KeywordsSection = styled.div`
  margin-bottom: 2.5rem;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  display: block;
`;

const KeywordsContainer = styled.div`
  position: relative;
  width: 100%;
  margin: 0;
  overflow: visible;
  box-sizing: border-box;
  display: block;
`;

const KeywordsSlider = styled.div`
  display: flex;
  overflow-x: hidden;
  scroll-behavior: smooth;
  padding: 0.8rem 0;
  width: 100%;
  box-sizing: border-box;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;

  @media (max-width: 768px) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  &:active {
    cursor: grabbing;
  }

  &::after {
    content: "";
    flex: 0 0 20px;
  }
`;

const KeywordCard = styled.div`
  flex: 0 0 240px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.88);
  padding: 1rem;
  margin-right: 0.6rem;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  border: 2px solid #050505;
  box-sizing: border-box;
  cursor: pointer;

  @media (max-width: 768px) {
    flex: 0 0 220px;
    padding: 0.9rem;
  }

  &:first-child {
    margin-left: 0;
  }

  &:hover {
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.88);
  }
`;

const Word = styled.h4`
  font-size: 1.2rem;
  font-weight: 900;
  color: #050505;
  margin-bottom: 0.5rem;
`;

const Meaning = styled.p`
  font-size: 0.8rem;
  color: rgba(5, 5, 5, 0.72);
  line-height: 1.5;
  margin-bottom: 0.8rem;
`;

const Synonyms = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.8rem;
`;

const Synonym = styled.span`
  font-size: 0.7rem;
  background: #ffffff;
  color: #050505;
  border: 1.5px solid #050505;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-weight: 700;
`;

const Example = styled.div`
  font-size: 0.8rem;
  font-style: italic;
  color: rgba(5, 5, 5, 0.6);
  line-height: 1.5;
  padding-top: 0.6rem;
  border-top: 1.5px dashed #050505;
`;

const SliderButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #ffffff;
  color: #050505;
  border: 2px solid #050505;
  box-shadow: 2px 2px 0 #050505;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;

  @media (max-width: 768px) {
    width: 30px;
    height: 34px;
  }

  &:hover {
    background: #f47a4a;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    opacity: 0.4;
    box-shadow: none;
    cursor: not-allowed;
  }
`;

const NextButton = styled(SliderButton)`
  right: -16px;

  @media (max-width: 768px) {
    right: -14px;
  }

  &::after {
    content: "›";
    font-size: 1.3rem;
    line-height: 1;
    font-weight: 300;
  }
`;

const PrevButton = styled(SliderButton)`
  left: -16px;

  @media (max-width: 768px) {
    left: -14px;
  }

  &::after {
    content: "‹";
    font-size: 1.3rem;
    line-height: 1;
    font-weight: 300;
  }
`;

// Modal components for keyword popup
const ModalOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  opacity: ${(props) => (props.isOpen ? 1 : 0)};
  visibility: ${(props) => (props.isOpen ? "visible" : "hidden")};
  transition: opacity 0.3s ease, visibility 0.3s ease;
  -webkit-overflow-scrolling: touch; /* Better scrolling on iOS */
  touch-action: none; /* Prevent scrolling behind modal */
`;

const ModalContent = styled.div`
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 6px 6px 0 #050505;
  padding: 2rem;
  max-width: 90%;
  width: 500px;
  position: relative;
  transform: scale(1);
  transition: transform 0.3s ease;
  border: 2px solid #050505;
  overflow-y: auto; /* Allow scrolling within modal if content is too tall */
  max-height: 90vh; /* Limit height on small screens */

  @media (max-width: 768px) {
    padding: 1.5rem;
    width: 85%;
    max-height: 80vh;
  }

  @media (max-width: 480px) {
    padding: 1.2rem;
    width: 90%;
    max-height: 75vh;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: #ffffff;
  border: 2px solid #050505;
  font-size: 1.25rem;
  color: #050505;
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  line-height: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, transform 0.16s ease;

  @media (max-width: 768px) {
    top: 0.8rem;
    right: 0.8rem;
  }

  &:hover {
    background: #f47a4a;
    transform: translateY(-1px);
  }
`;

// Add new styled components for the improved modal layout
const ModalSection = styled.div`
  margin-bottom: 1.5rem;

  @media (max-width: 768px) {
    margin-bottom: 1.2rem;
  }
`;

const ModalSectionTitle = styled.div`
  font-size: 0.85rem;
  color: #f47a4a;
  margin-bottom: 0.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const DualText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const KoreanText = styled.div`
  font-size: 0.95rem;
  color: rgba(5, 5, 5, 0.72);
  line-height: 1.5;
  font-family: "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;

const ExampleKoreanText = styled(KoreanText)`
  font-style: normal;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.9;
`;

const ModalSynonyms = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
`;

const ModalSynonym = styled.span`
  font-size: 0.9rem;
  background: #ffffff;
  color: #050505;
  border: 1.5px solid #050505;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-weight: 700;

  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
  }
`;

// Update the ModalWord component for better styling
const ModalWord = styled.h3`
  font-size: 2rem;
  font-weight: 900;
  color: #050505;
  margin-bottom: 0.3rem;

  @media (max-width: 768px) {
    font-size: 1.7rem;
  }
`;

// Update the ModalMeaning component
const ModalMeaning = styled.p`
  font-size: 1.1rem;
  color: #050505;
  line-height: 1.6;

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

// Update the Example component
const ModalExample = styled.div`
  font-size: 1rem;
  font-style: italic;
  color: rgba(5, 5, 5, 0.6);
  line-height: 1.6;

  @media (max-width: 768px) {
    font-size: 0.9rem;
  }
`;
// Add InfoContainer styled component
const InfoContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;

  @media (max-width: 768px) {
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
`;

// Keywords display components
const Categories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.5rem;
`;

const Category = styled.span`
  font-size: 0.65rem;
  background: #f47a4a;
  color: #050505;
  border: 1.5px solid #050505;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-weight: 800;
`;

const SaveButton = styled.button`
  border: 2px solid #050505;
  background: #f47a4a;
  color: #050505;
  font-size: 0.9rem;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  margin-left: 1rem;
  font-weight: 800;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  box-shadow: 2px 2px 0 #050505;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
    transform: none;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.3rem 0.7rem;
  }

  svg {
    width: 0.95rem;
    height: 0.95rem;
  }
`;

const SavedIndicator = styled.div`
  display: inline-flex;
  align-items: center;
  color: #16a34a;
  font-size: 0.9rem;
  margin-left: 1rem;
  font-weight: 700;

  &::before {
    content: "✓";
    margin-right: 0.3rem;
    font-weight: bold;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
  }
`;

const WordTitleRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 0.3rem;
`;

// Add a helper function to better handle how words with hyphens are highlighted
const highlightWithHyphens = (text: string): string => {
  // Split text into words, preserving punctuation
  const words = text.split(/(\s+|[.,!?;:'"()[\]{}—])/);

  return words
    .map((word) => {
      // Skip if it's just whitespace or punctuation
      if (!word.trim() || /^[.,!?;:'"()[\]{}—]$/.test(word)) {
        return word;
      }

      // Check if this is a hyphenated word
      if (word.includes("-")) {
        // Split by hyphen and handle each part separately
        const parts = word.split("-");
        return parts
          .map((part) => {
            if (!part) return "";

            // Calculate how many letters to highlight for each part
            const highlightCount = Math.max(
              1,
              Math.min(3, Math.floor(part.length / 2))
            );

            // Split the part into highlighted and non-highlighted sections
            const highlighted = part.slice(0, highlightCount);
            const rest = part.slice(highlightCount);

            // Return the part with highlighted section
            return `<span class="highlighted">${highlighted}</span>${rest}`;
          })
          .join("-"); // Rejoin with hyphen
      }

      // Regular word (non-hyphenated) - original logic
      const highlightCount = Math.max(
        1,
        Math.min(5, Math.floor(word.length / 2))
      );
      const highlighted = word.slice(0, highlightCount);
      const rest = word.slice(highlightCount);

      return `<span class="highlighted">${highlighted}</span>${rest}`;
    })
    .join("");
};

// Update the highlightFirstLetters function to use the new helper
const highlightFirstLetters = (text: string): string => {
  return highlightWithHyphens(text);
};

// YouTube URL detection and conversion utilities
const isYouTubeUrl = (url: string): boolean => {
  if (!url) return false;
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/i;
  return youtubeRegex.test(url);
};

const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;

  // Handle youtu.be format: https://youtu.be/VIDEO_ID or https://youtu.be/VIDEO_ID?params
  const youtuBeMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (youtuBeMatch) {
    return youtuBeMatch[1];
  }

  // Handle youtube.com format: https://youtube.com/watch?v=VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID
  const youtubeMatch = url.match(/youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]+)/);
  if (youtubeMatch) {
    return youtubeMatch[1];
  }

  // Handle embed format: https://youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) {
    return embedMatch[1];
  }

  return null;
};

const getYouTubeEmbedUrl = (url: string): string | null => {
  const videoId = extractYouTubeVideoId(url);
  console.log("YouTube URL:", url, "Video ID:", videoId); // Debug log
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return null;
};

// Add a helper function to extract a complete word from bionic reading mode text
const extractFullWordFromBionicText = (
  element: HTMLElement,
  clickX: number,
  clickY: number
): { word: string; rect?: DOMRect } => {
  try {
    // Get the range at the click point
    const range = document.caretRangeFromPoint(clickX, clickY);
    if (!range) return { word: "" };

    // Get the text container that holds all the text
    const textContainer = element.closest(".article-text");
    if (!textContainer) return { word: "" };

    // Get the original text without highlighting
    const originalText = textContainer.getAttribute("data-original-text") || "";
    if (!originalText) return { word: "" };

    // Extract all text from the DOM, preserving the structure without any spans
    let fullText = "";
    const collectText = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        fullText += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of Array.from(node.childNodes)) {
          collectText(child);
        }
      }
    };
    collectText(textContainer);

    // Get the element and position at the clicked point
    const clickedNode = range.startContainer;
    const clickOffset = range.startOffset;

    // Find our exact position in the full text
    let currentPosition = 0;
    let clickPosition = -1;

    const findPosition = (node: Node) => {
      if (clickPosition >= 0) return; // Already found

      if (node === clickedNode) {
        clickPosition = currentPosition + clickOffset;
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        currentPosition += node.textContent?.length || 0;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of Array.from(node.childNodes)) {
          findPosition(child);
        }
      }
    };

    findPosition(textContainer);

    // If we couldn't find the exact position, exit
    if (clickPosition < 0) return { word: "" };

    // Now expand in both directions until we hit a space or em-dash
    let startPos = clickPosition;
    let endPos = clickPosition;

    // Expand backward until we hit a space or em-dash
    while (
      startPos > 0 &&
      fullText[startPos - 1] !== " " &&
      fullText[startPos - 1] !== "—"
    ) {
      startPos--;
    }

    // Expand forward until we hit a space or em-dash
    while (
      endPos < fullText.length &&
      fullText[endPos] !== " " &&
      fullText[endPos] !== "—"
    ) {
      endPos++;
    }

    // Extract the word at the click position
    let word = fullText.substring(startPos, endPos);

    // Clean it of punctuation but keep hyphens
    word = word.replace(/[.,!?;:'"()[\]{}]|…/g, "").trim();

    // Return the word and the clicked element's rect for positioning
    return {
      word,
      rect:
        (range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : (range.startContainer as Element)
        )?.getBoundingClientRect() || undefined,
    };
  } catch (error) {
    console.error("Error extracting word from text:", error);
    return { word: "" };
  }
};

const ArticlePageWrapper = styled.div`
  min-height: 100vh;
  background-color: #faf8f4;
  width: 100%;
  padding-bottom: clamp(2rem, 4vw, 3rem);
  margin-top: -${NAVBAR_OFFSET_DESKTOP}px;
  padding-top: calc(${NAVBAR_OFFSET_DESKTOP}px + ${DESKTOP_PAGE_TOP_PADDING});

  @media (max-width: 768px) {
    /* Ensure proper mobile scrolling */
    -webkit-overflow-scrolling: touch;
    overflow-y: auto;
    margin-top: -${NAVBAR_OFFSET_MOBILE}px;
    padding-top: calc(${NAVBAR_OFFSET_MOBILE}px + 1.25rem);
    padding-bottom: 2rem;
  }
`;

// Define necessary styled components
const ParagraphContainer = styled.div`
  position: relative;
  padding: 0.85rem 0 0.9rem;
  border-bottom: 1px solid rgba(5, 5, 5, 0.14);

  &:first-child {
    padding-top: 0;
  }

  @media (max-width: 768px) {
    padding: 0.55rem 0 0.6rem;
  }
`;

// Add a styled component for the translation toggle button
const TranslationToggleButton = styled.button`
  background: #ffffff;
  color: #050505;
  border: 2px solid #050505;
  border-radius: 999px;
  min-height: 2rem;
  box-sizing: border-box;
  padding: 0 0.7rem;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  margin-top: 0.6rem;
  margin-bottom: 0.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
  box-shadow: 2px 2px 0 #050505;

  &:hover {
    background: #f47a4a;
    color: #050505;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  svg {
    width: 0.82rem;
    height: 0.82rem;
  }

  &.active {
    background: #f47a4a;
    color: #050505;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    min-height: 1.85rem;
    padding: 0 0.5rem;
    font-size: 0.68rem;
  }
`;

const CopyActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  min-height: 2rem;
  box-sizing: border-box;
  padding: 0 0.7rem;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;

  &:hover {
    background: #f47a4a;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:focus-visible {
    outline: 3px solid rgba(244, 122, 74, 0.45);
    outline-offset: 2px;
  }

  svg {
    width: 0.9rem;
    height: 0.9rem;
  }

  @media (max-width: 768px) {
    gap: 0.25rem;
    min-height: 1.85rem;
    padding: 0 0.5rem;
    font-size: 0.68rem;
  }
`;

const ParagraphActionRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.5rem;
  margin-bottom: 0;

  ${TranslationToggleButton} {
    margin-top: 0;
    margin-bottom: 0;
  }

  @media (max-width: 768px) {
    gap: 0.35rem;
    margin-top: 0.35rem;
  }
`;

// Define a new modal overlay for word definitions
const DefinitionModalOverlay = styled(ModalOverlay)`
  /* Inherit styles from ModalOverlay */
`;

// Define a new modal content for word definitions
const DefinitionModalContent = styled(ModalContent)`
  width: 450px;
  padding: 1.8rem;

  @media (max-width: 768px) {
    width: 80%;
  }
`;

// Update the word definition displays for the modal
const WordDefinitionTitle = styled.div`
  font-weight: 900;
  color: #050505;
  margin-bottom: 1rem;
  font-size: 1.5rem;
  padding-bottom: 0.7rem;
  border-bottom: 2px solid #050505;
`;

const WordDefinitionContent = styled.div`
  color: rgba(5, 5, 5, 0.72);
  font-family: "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  line-height: 1.6;
  white-space: pre-line;
  font-size: 1rem;
`;

const LoadingDefinitionContent = styled.div`
  color: rgba(5, 5, 5, 0.6);
  font-style: italic;
  padding: 1rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
`;

const getWordDefinition = async (
  word: string,
  context: string,
  articleId: string
): Promise<string> => {
  try {
    // Normalize the word to lowercase for consistent storage
    const wordLower = word.toLowerCase();

    // First check if the definition exists in Firestore
    const meaningRef = doc(db, `articles/${articleId}/meanings/${wordLower}`);
    const meaningSnap = await getDoc(meaningRef);

    // If the definition exists in Firestore, return it
    if (meaningSnap.exists()) {
      return meaningSnap.data().definition;
    }

    // If not found in Firestore, call the GPT API
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }
    const url = "https://api.openai.com/v1/chat/completions";

    const prompt = `다음 문장에서 '${word}'의 정의를 한국어로 제공해주세요. 단어의 의미를 문장의 맥락에 맞게 설명해주세요. 반드시 존대말로 작성해주세요.

문장: "${context}"

* 결과 형식:
뜻풀이: [문장 문맥에 맞는 단어 정의]
`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    const definition = data.choices[0].message.content;

    // Store the result in Firestore for future use
    await setDoc(meaningRef, {
      word: wordLower,
      definition: definition,
    });

    return definition;
  } catch (error) {
    console.error("GPT API Error:", error);
    return `뜻풀이를 가져오는 중 오류가 발생했습니다: ${error}`;
  }
};

const ArticleImage = styled.img`
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: 14px;
  margin: 1.25rem 0 0.45rem 0;
  border: 2px solid #050505;
  box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.9);

  @media (max-width: 768px) {
    margin: 1rem 0 0.5rem 0;
  }
`;

const YouTubeIframe = styled.iframe`
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  margin: 1.5rem 0 1.5rem 0;
  border: 2px solid #050505;
  box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.9);

  @media (max-width: 768px) {
    margin: 1rem 0 1rem 0;
  }
`;

const ImageCaption = styled.p`
  font-size: 0.8rem;
  color: rgba(5, 5, 5, 0.6);
  text-align: left;
  margin: 0 0 1.25rem 0;
  padding-left: 0.2rem;

  @media (max-width: 768px) {
    font-size: 0.7rem;
    margin: 0 0 1rem 0;
  }
`;

// Inline article figures supplied by the editor.
const FiguresSection = styled.div`
  margin: 1.25rem 0;
`;

const FiguresGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  margin-top: 0.75rem;
`;

const PhotoFiguresGrid = styled(FiguresGrid)`
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const FigureCard = styled.figure`
  margin: 0;
`;

// Inline figures are visual breaks in the article, so they intentionally have
// no visible label or caption.
const ChartImage = styled.img`
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
  border-radius: 14px;
  margin: 1rem 0 0;

  @media (max-width: 768px) {
    margin: 0.9rem 0 0;
  }
`;

const ArticlePhoto = styled.img`
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  border: 2px solid #050505;
  border-radius: 14px;
`;

// Discussion topics components
const DiscussionTopicsSection = styled.div`
  margin-top: 0;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    margin-top: 1.8rem;
    margin-bottom: 1.8rem;
  }
`;

const DiscussionTopicsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  background: #ffffff;
  border-radius: 14px;
  padding: 1.2rem;
  border: 2px solid #050505;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
`;

const DiscussionTopicItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid rgba(5, 5, 5, 0.14);

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }

  @media (max-width: 768px) {
    gap: 0.5rem;
  }
`;

const DiscussionTopicText = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 1.02rem;
  color: #050505;
  line-height: 1.55;
  padding-left: 0.95rem;
  position: relative;
  cursor: pointer;
  transition: color 0.2s ease;

  &::before {
    content: "•";
    color: #f47a4a;
    font-weight: bold;
    position: absolute;
    left: 0;
    font-size: 1rem;
  }

  &:hover {
    color: #f47a4a;
  }

  @media (max-width: 768px) {
    font-size: 0.95rem;
    padding-left: 0.85rem;
  }
`;

const DiscussionVoteControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex: 0 0 auto;
`;

const DiscussionVoteButton = styled.button<{ $active: boolean; $negative?: boolean }>`
  width: 1.85rem;
  height: 1.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: ${(props) =>
    props.$active ? (props.$negative ? "#ffd9d9" : "#f47a4a") : "#ffffff"};
  color: #050505;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease;

  svg {
    width: 0.82rem;
    height: 0.82rem;
  }

  &:hover:not(:disabled) {
    background: ${(props) => (props.$negative ? "#ffd9d9" : "#f47a4a")};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }
`;

const DiscussionVoteScore = styled.span`
  min-width: 1.35rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-align: center;
  font-variant-numeric: tabular-nums;
`;

const VoteAccessNote = styled.p`
  margin: 0.7rem 0 0;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.78rem;
  line-height: 1.45;
`;

// Admin editing styled components
const AdminControlsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 0.6rem;
  }
`;

const AdminButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  background: #f47a4a;
  color: #050505;
  border: 2px solid #050505;
  min-height: 2rem;
  box-sizing: border-box;
  padding: 0 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  font-weight: 800;
  box-shadow: 2px 2px 0 #050505;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    font-size: 0.75rem;
    padding: 0 0.8rem;
  }

  svg {
    width: 0.9rem;
    height: 0.9rem;
  }
`;

const EditableTopicInput = styled.input`
  width: 100%;
  padding: 0.6rem;
  border: 2px solid #050505;
  border-radius: 10px;
  font-size: 0.95rem;
  color: #050505;
  background: white;
  margin-bottom: 0.5rem;
  transition: box-shadow 0.16s ease;

  &:focus {
    outline: none;
    box-shadow: 2px 2px 0 #f47a4a;
  }

  @media (max-width: 768px) {
    font-size: 0.9rem;
    padding: 0.5rem;
  }
`;

const EditableTopicContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  padding: 0.6rem;
  background: #ffffff;
  border-radius: 12px;
  border: 1.5px solid #050505;

  @media (max-width: 768px) {
    gap: 0.4rem;
    padding: 0.5rem;
  }
`;

const RemoveTopicButton = styled.button`
  background: #ffffff;
  color: #050505;
  border: 1.5px solid #050505;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.16s ease, color 0.16s ease;
  flex-shrink: 0;

  &:hover {
    background: #e74c3c;
    color: #ffffff;
  }

  @media (max-width: 768px) {
    width: 20px;
    height: 20px;
    font-size: 0.7rem;
  }
`;

const NewTopicContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  align-items: flex-start;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.4rem;
  }
`;

const NewTopicInput = styled.input`
  flex: 1;
  padding: 0.6rem;
  border: 2px solid #050505;
  border-radius: 10px;
  font-size: 0.9rem;
  color: #050505;
  background: white;
  transition: box-shadow 0.16s ease;

  &:focus {
    outline: none;
    box-shadow: 2px 2px 0 #f47a4a;
  }

  @media (max-width: 768px) {
    width: 100%;
    font-size: 0.85rem;
    padding: 0.5rem;
  }
`;

const AddTopicButton = styled.button`
  background: #f47a4a;
  color: #050505;
  border: 2px solid #050505;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 2px 2px 0 #050505;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    width: 100%;
    font-size: 0.75rem;
    padding: 0.5rem 0.8rem;
  }
`;

const SectionHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-top: 2rem;
  margin-bottom: 0.9rem;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
`;

const SectionActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    width: auto;
    gap: 0.35rem;
    align-self: flex-end;
    justify-content: flex-end;

    > button {
      flex: 0 0 auto;
    }
  }
`;

const DiscussionHeaderRow = styled(SectionHeaderRow)`
  margin-top: 2rem;
  margin-bottom: 1rem;
`;

const AdminActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const AdminActionButton = styled.button<{ variant?: "primary" | "ghost" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2rem;
  box-sizing: border-box;
  padding: 0 0.7rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  border: 2px solid #050505;
  background: ${(props) =>
    props.variant === "ghost" ? "#ffffff" : "#f47a4a"};
  color: #050505;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.variant === "ghost" ? "#f47a4a" : "#f47a4a"};
    color: #050505;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    gap: 0.25rem;
    min-height: 1.85rem;
    padding: 0 0.5rem;
    font-size: 0.68rem;
  }
`;

const AdminEditCard = styled.div`
  border: 2px solid #050505;
  border-radius: 16px;
  padding: 1.2rem;
  background: #ffffff;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  margin-bottom: 1.5rem;
`;

const AdminEditTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  color: #050505;
  margin-bottom: 0.9rem;
`;

const AdminFieldLabel = styled.label`
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: rgba(5, 5, 5, 0.72);
  margin-bottom: 0.4rem;
`;

const AdminInput = styled.input`
  width: 100%;
  border-radius: 10px;
  border: 2px solid #050505;
  padding: 0.55rem 0.75rem;
  font-size: 0.95rem;
  color: #050505;
  background: #ffffff;
  transition: box-shadow 0.16s ease;
  margin-bottom: 1rem;

  &:focus {
    outline: none;
    box-shadow: 2px 2px 0 #f47a4a;
  }
`;

const AdminTextArea = styled.textarea`
  width: 100%;
  border-radius: 10px;
  border: 2px solid #050505;
  padding: 0.75rem 0.85rem;
  font-size: 0.95rem;
  color: #050505;
  background: #ffffff;
  transition: box-shadow 0.16s ease;
  min-height: 120px;
  resize: vertical;
  margin-bottom: 0.8rem;
  line-height: 1.5;

  &:focus {
    outline: none;
    box-shadow: 2px 2px 0 #f47a4a;
  }
`;

const ParagraphEditorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ParagraphEditorCard = styled.div`
  border: 2px solid #050505;
  border-radius: 14px;
  padding: 1rem;
  background: white;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.9);
`;

const ParagraphEditorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
`;

const ParagraphBadge = styled.span`
  font-size: 0.8rem;
  font-weight: 800;
  color: #050505;
  background: #f47a4a;
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 0.2rem 0.8rem;
`;

const IconCircleButton = styled.button`
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid #050505;
  background: white;
  color: #050505;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;

  &:hover {
    background: #f47a4a;
    color: #050505;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
`;

const AddParagraphButton = styled.button`
  width: 100%;
  border-radius: 12px;
  border: 2px dashed #050505;
  padding: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: #ffffff;
  color: #050505;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;

  &:hover {
    background: #f47a4a;
    color: #050505;
  }
`;

const MediaPreview = styled.div`
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid #050505;
  background: #ffffff;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  margin-bottom: 1rem;
`;

const MediaPreviewImage = styled.img`
  width: 100%;
  display: block;
  object-fit: cover;
`;

const EditorHint = styled.p`
  font-size: 0.85rem;
  color: rgba(5, 5, 5, 0.6);
  margin-bottom: 0.8rem;
`;

const EmptyMediaState = styled.div`
  border: 2px dashed #050505;
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.9rem;
`;

const FileUploadRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const UploadStatus = styled.div<{ variant?: "error" | "success" }>`
  font-size: 0.85rem;
  font-weight: 700;
  color: #050505;
  border: 1.5px solid #050505;
  background: ${(props) =>
    props.variant === "error" ? "#ffd9d9" : "#fff0e8"};
  border-radius: 10px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.8rem;
`;

const PaywallNotice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 1rem 1.2rem;
  border-radius: 16px;
  border: 2px solid #050505;
  background: #ffffff;
  color: #050505;
  margin-bottom: 1.5rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
`;

const PaywallText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const PaywallTitle = styled.div`
  font-weight: 800;
  font-size: 1rem;
`;

const PaywallDescription = styled.p`
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: rgba(5, 5, 5, 0.72);
`;

const GUEST_PARAGRAPH_LIMIT = 2;

const Article = () => {
  const params = useParams();
  const articleId = params.articleId as string;

  // Early return if no articleId
  if (!articleId) {
    return <ErrorContainer>Article ID not found</ErrorContainer>;
  }

  const { currentUser, accountStatus, hasActiveSubscription } = useAuth();
  const { t } = useI18n();
  const isAdmin = accountStatus === "admin";
  const isGuestUser = !currentUser;
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isKoreanTitleVisible, setIsKoreanTitleVisible] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isKoreanSummaryVisible, setIsKoreanSummaryVisible] = useState(false);
  const [visibleKoreanParagraphs, setVisibleKoreanParagraphs] = useState<
    number[]
  >([]);
  const [currentKeywordIndex, setCurrentKeywordIndex] = useState(0);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedWordData, setSelectedWordData] = useState<WordData | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isQuickReading, setIsQuickReading] = useState(false);
  const [wordDetails, setWordDetails] = useState<Record<string, WordData>>({});
  const [wordLoading, setWordLoading] = useState<Record<string, boolean>>({});
  const [savedWords, setSavedWords] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Admin discussion topics editing state
  const [isEditingTopics, setIsEditingTopics] = useState(false);
  const [editedTopics, setEditedTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [isSavingTopics, setIsSavingTopics] = useState(false);
  const [discussionStats, setDiscussionStats] = useState<
    Record<string, DiscussionTopicStats>
  >({});
  const [topicVotes, setTopicVotes] = useState<Record<string, TopicVoteValue>>({});
  const [votingTopicId, setVotingTopicId] = useState<string | null>(null);

  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState("");
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitleEnglish, setEditedTitleEnglish] = useState("");
  const [editedTitleKorean, setEditedTitleKorean] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedEnglishContent, setEditedEnglishContent] = useState<string[]>([]);
  const [editedKoreanContent, setEditedKoreanContent] = useState<string[]>([]);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);

  // Translation warning state
  const [translationClickCount, setTranslationClickCount] = useState(0);
  const [showTranslationWarning, setShowTranslationWarning] = useState(false);
  const [dontShowTranslationWarning, setDontShowTranslationWarning] =
    useState(false);

  // Load "don't show again" preference from localStorage
  useEffect(() => {
    const dontShowPref = localStorage.getItem("dontShowTranslationWarning");
    if (dontShowPref === "true") {
      setDontShowTranslationWarning(true);
    }
  }, []);

  // Update state for word definition modal
  const [wordDefinitionModal, setWordDefinitionModal] = useState({
    isOpen: false,
    word: "",
    definition: "",
    isLoading: false,
    wiktionaryData: null as any | null,
    isWiktionaryLoading: false,
  });

  // Add state for Wiktionary API data in keyword modal
  const [selectedWordWiktionaryData, setSelectedWordWiktionaryData] = useState<
    any | null
  >(null);

  // Long-press detection for showing meaning modal
  const LONG_PRESS_MS = 500;
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pressCurrentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pressTargetRef = useRef<HTMLElement | null>(null);
  const isTouchPressRef = useRef(false);
  const MOVEMENT_THRESHOLD_PX = 8;

  useEffect(() => {
    const fetchArticle = async () => {
      if (!articleId) return;

      try {
        const articleRef = doc(db, "articles", articleId);
        const articleSnap = await getDoc(articleRef);

        if (articleSnap.exists()) {
          const data = articleSnap.data() as ArticleData;
          if (
            data.publicationStatus === "processing" ||
            data.publicationStatus === "failed"
          ) {
            setError(
              data.publicationStatus === "failed"
                ? "This article could not be processed."
                : "This article is still processing. Please try again shortly."
            );
            return;
          }
          setArticle(data);

          // Prefetch word details for all keywords
          if (data.keywords && data.keywords.length > 0) {
            data.keywords.forEach((word) => {
              fetchWordDetails(word);
            });
          }
        } else {
          setError("Article not found");
        }
      } catch (err) {
        setError("Error fetching article");
        console.error("Error fetching article:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [articleId]);

  useEffect(() => {
    const statsQuery = query(
      collection(db, "article_discussion_stats"),
      where("articleId", "==", articleId)
    );
    return onSnapshot(
      statsQuery,
      (snapshot) => {
        const nextStats: Record<string, DiscussionTopicStats> = {};
        snapshot.forEach((stat) => {
          const data = stat.data();
          if (typeof data.topicId !== "string") return;
          nextStats[data.topicId] = {
            topicId: data.topicId,
            score: typeof data.score === "number" ? data.score : 0,
            upvotes: typeof data.upvotes === "number" ? data.upvotes : 0,
            downvotes: typeof data.downvotes === "number" ? data.downvotes : 0,
          };
        });
        setDiscussionStats(nextStats);
      },
      (statsError) => {
        console.error("Unable to subscribe to discussion-topic scores:", statsError);
      }
    );
  }, [articleId]);

  useEffect(() => {
    if (!currentUser) {
      setTopicVotes({});
      return;
    }

    const topicEntries = discussionTopicEntriesFor(article);
    if (topicEntries.length === 0) {
      setTopicVotes({});
      return;
    }

    let isCurrent = true;
    const loadVotes = async () => {
      try {
        const snapshots = await Promise.all(
          topicEntries.map((topic) =>
            getDoc(
              doc(
                db,
                "article_discussion_votes",
                articleId + "_" + topic.id + "_" + currentUser.uid
              )
            )
          )
        );
        if (!isCurrent) return;

        const nextVotes: Record<string, TopicVoteValue> = {};
        snapshots.forEach((snapshot, index) => {
          const vote = snapshot.data()?.vote;
          if (vote === 1 || vote === -1) {
            nextVotes[topicEntries[index].id] = vote;
          }
        });
        setTopicVotes(nextVotes);
      } catch (voteError) {
        console.error("Unable to load discussion-topic votes:", voteError);
      }
    };

    loadVotes();
    return () => {
      isCurrent = false;
    };
  }, [article, articleId, currentUser]);

  // Fetch user's saved words when user changes
  useEffect(() => {
    const fetchSavedWords = async () => {
      if (!currentUser) {
        setSavedWords([]);
        return;
      }

      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setSavedWords(userData.saved_words || []);
        } else {
          // Create user document if it doesn't exist
          await setDoc(userRef, {
            saved_words: [],
          });
          setSavedWords([]);
        }
      } catch (err) {
        console.error("Error fetching saved words:", err);
        setSavedWords([]);
      }
    };

    fetchSavedWords();
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  const fetchWordDetails = async (word: string) => {
    // Skip if already fetched or currently fetching
    if (wordDetails[word] || wordLoading[word]) return;

    setWordLoading((prev) => ({ ...prev, [word]: true }));

    // Set a timeout to ensure wordLoading is reset even if the fetch operation fails
    const timeoutId = setTimeout(() => {
      setWordLoading((prev) => {
        // Only reset if it's still loading (operation didn't complete)
        if (prev[word]) {
          console.error(`Fetch timeout for word "${word}"`);
          return { ...prev, [word]: false };
        }
        return prev;
      });
    }, 5000); // 5 seconds timeout

    try {
      const wordRef = doc(db, "words", word);
      const wordSnap = await getDoc(wordRef);

      if (wordSnap.exists()) {
        const wordData = wordSnap.data() as WordData;
        setWordDetails((prev) => ({ ...prev, [word]: wordData }));
      } else {
        console.error(`Word "${word}" not found in the database`);
      }
    } catch (err) {
      console.error(`Error fetching word "${word}":`, err);
    } finally {
      clearTimeout(timeoutId); // Clear the timeout as the operation completed
      setWordLoading((prev) => ({ ...prev, [word]: false }));
    }
  };

  useEffect(() => {
    if (isQuickReading && article) {
      // Get all text content elements
      const textElements = document.querySelectorAll(".article-text");

      textElements.forEach((element) => {
        const originalText =
          element.getAttribute("data-original-text") ||
          element.textContent ||
          "";
        element.innerHTML = highlightFirstLetters(originalText);
      });
    } else {
      // Restore original text when not in quick reading mode
      const textElements = document.querySelectorAll(".article-text");
      textElements.forEach((element) => {
        const originalText = element.getAttribute("data-original-text") || "";
        element.textContent = originalText;
      });
    }
  }, [isQuickReading, article]);

  const toggleKoreanTitle = () => {
    setIsKoreanTitleVisible(!isKoreanTitleVisible);
  };

  // Handle "don't show again" preference for translation warning
  const handleDontShowTranslationWarning = (dontShow: boolean) => {
    setDontShowTranslationWarning(dontShow);
    localStorage.setItem("dontShowTranslationWarning", dontShow.toString());
  };

  const registerKoreanTranslationView = () => {
    const newClickCount = translationClickCount + 1;
    setTranslationClickCount(newClickCount);

    if (
      newClickCount >= 3 &&
      !showTranslationWarning &&
      !dontShowTranslationWarning
    ) {
      setShowTranslationWarning(true);
    }
  };

  const toggleKoreanSummary = () => {
    if (!isKoreanSummaryVisible) {
      registerKoreanTranslationView();
    }

    setIsKoreanSummaryVisible((current) => !current);
  };

  const toggleKoreanParagraph = (index: number) => {
    const wasVisible = visibleKoreanParagraphs.includes(index);

    setVisibleKoreanParagraphs((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );

    // Only track translation clicks when EXPANDING (showing) Korean text, not when hiding
    if (!wasVisible) {
      registerKoreanTranslationView();
    }
  };

  const copyText = async (text: string, target: string) => {
    if (!text.trim()) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      setCopiedTarget(target);
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopiedTarget(null);
        copyFeedbackTimerRef.current = null;
      }, 1800);
    } catch (copyError) {
      console.error("Unable to copy article text:", copyError);
    }
  };

  const handleLastKeyword = () => {
    if (!article?.keywords || article.keywords.length <= 1) return;

    // Calculate exactly how many cards we need to show - set to the last keyword
    const totalCards = article.keywords.length;
    const lastIndex = totalCards - 1;

    setCurrentKeywordIndex(lastIndex);

    if (sliderRef.current) {
      // Determine card width based on screen size
      const isMobile = window.innerWidth <= 768;
      const cardWidth = isMobile ? 230 : 250;
      const marginWidth = 8;

      // Calculate exact position to show the last card at the left
      const scrollPosition = lastIndex * (cardWidth + marginWidth);

      sliderRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
    }
  };

  const handleNextKeyword = () => {
    if (!article?.keywords) return;

    // Calculate the maximum index based on visible cards
    const maxIndex = Math.max(0, article.keywords.length - 1);

    // Special case for the second-to-last position
    if (currentKeywordIndex === maxIndex - 1) {
      return handleLastKeyword();
    }

    // Allow scrolling all the way to the last keyword
    if (currentKeywordIndex >= maxIndex) return;

    const nextIndex = currentKeywordIndex + 1;
    setCurrentKeywordIndex(nextIndex);

    if (sliderRef.current) {
      // Determine card width based on screen size
      const isMobile = window.innerWidth <= 768;
      const cardWidth = isMobile ? 230 : 250;
      const marginWidth = 8;

      // Calculate exact position (each card has margin-right except the last one)
      const scrollPosition = nextIndex * (cardWidth + marginWidth);

      sliderRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
    }
  };

  const handlePrevKeyword = () => {
    if (currentKeywordIndex <= 0) return;

    const prevIndex = currentKeywordIndex - 1;
    setCurrentKeywordIndex(prevIndex);

    if (sliderRef.current) {
      // Determine card width based on screen size
      const isMobile = window.innerWidth <= 768;
      const cardWidth = isMobile ? 230 : 250;
      const marginWidth = 8;

      // Calculate exact position (each card has margin-right except the last one)
      const scrollPosition = prevIndex * (cardWidth + marginWidth);

      sliderRef.current.scrollTo({
        left: scrollPosition,
        behavior: "smooth",
      });
    }
  };

  const openKeywordModal = async (word: string) => {
    setSelectedKeyword(word);
    setSelectedWordWiktionaryData(null); // Reset Wiktionary data

    // Get word details if not already loaded
    if (!wordDetails[word]) {
      await fetchWordDetails(word);
    }

    setSelectedWordData(wordDetails[word] || null);
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";

    // Fetch Wiktionary data in parallel
    try {
      const wiktionaryData = await fetchWordFromWiktionaryApi(word);
      setSelectedWordWiktionaryData(wiktionaryData);
    } catch (error) {
      console.error("Error fetching Wiktionary data:", error);
      setSelectedWordWiktionaryData(null);
    }
  };

  const closeKeywordModal = () => {
    setIsModalOpen(false);
    // Re-enable scrolling when modal is closed
    document.body.style.overflow = "";
  };

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isModalOpen) {
        closeKeywordModal();
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => {
      window.removeEventListener("keydown", handleEscKey);
      // Make sure to reset body overflow in case component unmounts while modal is open
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - sliderRef.current.offsetLeft);
    setScrollLeft(sliderRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    sliderRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!sliderRef.current) return;
    setIsDragging(true);
    setStartX(e.touches[0].pageX - sliderRef.current.offsetLeft);
    setScrollLeft(sliderRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !sliderRef.current) return;
    const x = e.touches[0].pageX - sliderRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    sliderRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const calculateReadingTime = (content: string[]): string => {
    const totalWords = content.reduce((acc, paragraph) => {
      return acc + paragraph.split(/\s+/).length;
    }, 0);

    const readingTimeInSeconds = (totalWords / 150) * 60; // 150 words per minute
    const minutes = Math.floor(readingTimeInSeconds / 60);
    const seconds = Math.round(readingTimeInSeconds % 60);

    return `${minutes}분 ${seconds}초`;
  };

  // Function to fetch word definition from Wiktionary API
  const fetchWordFromWiktionaryApi = async (
    word: string
  ): Promise<any | null> => {
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
      );
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(
            `No definitions found for "${word}" from Wiktionary API.`
          );
          return null;
        }
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Wiktionary API Error:", error);
      return null;
    }
  };

  const handleSaveWord = async (word: string) => {
    if (!currentUser || isSaving) return;

    setIsSaving(true);

    try {
      const userRef = doc(db, "users", currentUser.uid);

      if (savedWords.includes(word)) {
        // Remove word if already saved
        await updateDoc(userRef, {
          saved_words: arrayRemove(word),
        });
        setSavedWords((prevWords) => prevWords.filter((w) => w !== word));
      } else {
        // Add word if not saved
        await updateDoc(userRef, {
          saved_words: arrayUnion(word),
        });
        setSavedWords((prevWords) => [...prevWords, word]);
      }
    } catch (err) {
      console.error("Error saving word:", err);
      alert("단어 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWordClick = async (e: React.MouseEvent) => {
    // Allow selection/copy on short clicks
    e.preventDefault();
    e.stopPropagation();

    // Get the clicked element - handle nested span structure
    let target = e.target as HTMLElement;
    if (
      target.parentElement &&
      target.id.startsWith("char-") &&
      target.parentElement.closest("[id^='char-']")
    ) {
      target = target.parentElement.closest("[id^='char-']") as HTMLElement;
    }

    const paragraphElement = target.closest(
      ".article-text"
    ) as HTMLElement | null;
    if (!paragraphElement) return;

    // Always work with the original text rather than the HTML with highlights
    const originalText =
      paragraphElement.getAttribute("data-original-text") || "";
    if (!originalText) return;

    let selectedWord = "";

    // Clear any existing text selection first to prevent issues
    window.getSelection()?.removeAllRanges();

    // Use our extraction function
    const { word } = extractFullWordFromBionicText(
      paragraphElement,
      e.clientX,
      e.clientY
    );

    if (word) {
      selectedWord = word;
    }

    // Clean up the selected word and ensure it's valid
    selectedWord = selectedWord
      // Keep regular hyphens but remove other punctuation
      .replace(/[.,!?;:'"()[\]{}]|…/g, "")
      .trim();

    // Don't proceed if we couldn't get a word or if it's too long/complex
    if (
      !selectedWord ||
      selectedWord.length > 30 ||
      // Allow hyphenated words (count as one term) but not multiple space-separated words
      (selectedWord.split(/\s+/).length > 1 && !selectedWord.includes("-"))
    ) {
      console.log("Invalid selection, not proceeding:", selectedWord);
      return;
    }

    console.log("Final selected word:", selectedWord);

    // Get the surrounding context (the sentence containing the word)
    const sentenceRegex = new RegExp(
      `[^.!?]*\\b${selectedWord.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}\\b[^.!?]*[.!?]`,
      "i"
    );
    const sentenceMatch = originalText.match(sentenceRegex);
    const context = sentenceMatch ? sentenceMatch[0].trim() : originalText;

    // Set loading state for the modal
    setWordDefinitionModal({
      isOpen: true,
      word: selectedWord,
      definition: "",
      isLoading: true,
      wiktionaryData: null,
      isWiktionaryLoading: true,
    });

    // Prevent scrolling while modal is open
    document.body.style.overflow = "hidden";

    // Get definition
    try {
      console.log("Requesting definition for:", selectedWord);
      if (!articleId) {
        throw new Error("Article ID is missing");
      }
      const definition = await getWordDefinition(
        selectedWord,
        context,
        articleId as string
      );
      console.log("Definition received:", definition);

      setWordDefinitionModal((prev) => ({
        ...prev,
        definition: definition,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Definition error:", error);
      setWordDefinitionModal((prev) => ({
        ...prev,
        definition: "뜻풀이를 가져오는 중 오류가 발생했습니다.",
        isLoading: false,
      }));
    }

    // Fetch Wiktionary data in parallel
    try {
      const wiktionaryData = await fetchWordFromWiktionaryApi(selectedWord);
      setWordDefinitionModal((prev) => ({
        ...prev,
        wiktionaryData: wiktionaryData,
        isWiktionaryLoading: false,
      }));
    } catch (error) {
      console.error("Error fetching Wiktionary data:", error);
      setWordDefinitionModal((prev) => ({
        ...prev,
        wiktionaryData: null,
        isWiktionaryLoading: false,
      }));
    }
  };

  // Close definition modal
  const closeDefinitionModal = () => {
    setWordDefinitionModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
    // Re-enable scrolling
    document.body.style.overflow = "";
  };

  // Open meaning modal from a target and point, fetching AI and Wiktionary together
  const openMeaningFromTargetAtPoint = async (
    targetEl: HTMLElement,
    clientX: number,
    clientY: number
  ) => {
    const paragraphElement = targetEl.closest(
      ".article-text"
    ) as HTMLElement | null;
    if (!paragraphElement) return;

    const originalText =
      paragraphElement.getAttribute("data-original-text") || "";
    if (!originalText) return;

    const { word } = extractFullWordFromBionicText(
      paragraphElement,
      clientX,
      clientY
    );
    let selectedWord = (word || "").replace(/[.,!?;:'"()[\]{}]|…/g, "").trim();
    if (
      !selectedWord ||
      selectedWord.length > 30 ||
      (selectedWord.split(/\s+/).length > 1 && !selectedWord.includes("-"))
    )
      return;

    const sentenceRegex = new RegExp(
      `[^.!?]*\\b${selectedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^.!?]*[.!?]`,
      "i"
    );
    const sentenceMatch = originalText.match(sentenceRegex);
    const context = sentenceMatch ? sentenceMatch[0].trim() : originalText;

    setWordDefinitionModal({
      isOpen: true,
      word: selectedWord,
      definition: "",
      isLoading: true,
      wiktionaryData: null,
      isWiktionaryLoading: true,
    });
    document.body.style.overflow = "hidden";

    try {
      if (!articleId) throw new Error("Article ID is missing");
      const [aiResult, wikiResult] = await Promise.allSettled([
        getWordDefinition(selectedWord, context, articleId as string),
        fetchWordFromWiktionaryApi(selectedWord),
      ]);

      const definition =
        aiResult.status === "fulfilled"
          ? aiResult.value
          : "뜻풀이를 가져오는 중 오류가 발생했습니다.";
      const wiktionaryData = wikiResult.status === "fulfilled" ? wikiResult.value : null;

      setWordDefinitionModal((prev) => ({
        ...prev,
        definition,
        isLoading: false,
        wiktionaryData,
        isWiktionaryLoading: false,
      }));
    } catch (error) {
      setWordDefinitionModal((prev) => ({
        ...prev,
        definition: "뜻풀이를 가져오는 중 오류가 발생했습니다.",
        isLoading: false,
        wiktionaryData: null,
        isWiktionaryLoading: false,
      }));
    }
  };

  // Long-press handlers (mouse)
  const onMouseDownPress = (e: React.MouseEvent) => {
    longPressTriggeredRef.current = false;
    isTouchPressRef.current = false;
    pressTargetRef.current = e.target as HTMLElement;
    pressStartPosRef.current = { x: e.clientX, y: e.clientY };
    pressCurrentPosRef.current = { x: e.clientX, y: e.clientY };
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
    }, LONG_PRESS_MS);
  };

  const onMouseMovePress = (e: React.MouseEvent) => {
    if (!longPressTimerRef.current) return;
    pressCurrentPosRef.current = { x: e.clientX, y: e.clientY };
    const dx = pressCurrentPosRef.current.x - pressStartPosRef.current.x;
    const dy = pressCurrentPosRef.current.y - pressStartPosRef.current.y;
    if (Math.hypot(dx, dy) > MOVEMENT_THRESHOLD_PX) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const onMouseUpPress = (e: React.MouseEvent) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressTriggeredRef.current && pressTargetRef.current) {
      const { x, y } = pressCurrentPosRef.current;
      openMeaningFromTargetAtPoint(pressTargetRef.current, x, y);
    }
    longPressTriggeredRef.current = false;
    pressTargetRef.current = null;
  };

  const onMouseLeavePress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTriggeredRef.current = false;
  };

  // Long-press handlers (touch)
  const onTouchStartPress = (e: React.TouchEvent) => {
    longPressTriggeredRef.current = false;
    isTouchPressRef.current = true;
    pressTargetRef.current = e.target as HTMLElement;
    const t = e.touches[0];
    pressStartPosRef.current = { x: t.clientX, y: t.clientY };
    pressCurrentPosRef.current = { x: t.clientX, y: t.clientY };
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
    }, LONG_PRESS_MS);
  };

  const onTouchMovePress = (e: React.TouchEvent) => {
    if (!longPressTimerRef.current) return;
    const t = e.touches[0];
    pressCurrentPosRef.current = { x: t.clientX, y: t.clientY };
    const dx = pressCurrentPosRef.current.x - pressStartPosRef.current.x;
    const dy = pressCurrentPosRef.current.y - pressStartPosRef.current.y;
    if (Math.hypot(dx, dy) > MOVEMENT_THRESHOLD_PX) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const onTouchEndPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressTriggeredRef.current && pressTargetRef.current) {
      const { x, y } = pressCurrentPosRef.current;
      openMeaningFromTargetAtPoint(pressTargetRef.current, x, y);
    }
    longPressTriggeredRef.current = false;
    pressTargetRef.current = null;
  };

  // Admin discussion topics editing functions
  const startEditingTopics = () => {
    setEditedTopics([...(article?.discussion_topics || [])]);
    setIsEditingTopics(true);
  };

  const cancelEditingTopics = () => {
    setIsEditingTopics(false);
    setEditedTopics([]);
    setNewTopic("");
  };

  const addNewTopic = () => {
    if (newTopic.trim()) {
      setEditedTopics([...editedTopics, newTopic.trim()]);
      setNewTopic("");
    }
  };

  const removeTopic = (index: number) => {
    setEditedTopics(editedTopics.filter((_, i) => i !== index));
  };

  const updateTopic = (index: number, newValue: string) => {
    const updated = [...editedTopics];
    updated[index] = newValue;
    setEditedTopics(updated);
  };

  const saveTopics = async () => {
    if (!articleId || !currentUser || accountStatus !== "admin") return;

    setIsSavingTopics(true);
    try {
      const articleRef = doc(db, "articles", articleId);
      const existingTopicIds = article?.discussion_topic_ids || [];
      const discussionTopicIds = editedTopics.map(
        (_, index) => existingTopicIds[index] || "topic-" + index
      );
      await updateDoc(articleRef, {
        discussion_topics: editedTopics,
        discussion_topic_ids: discussionTopicIds,
      });

      // Update local state
      setArticle((prev) =>
        prev
          ? {
              ...prev,
              discussion_topics: editedTopics,
              discussion_topic_ids: discussionTopicIds,
            }
          : null
      );
      setIsEditingTopics(false);
      setEditedTopics([]);
      setNewTopic("");
    } catch (error) {
      console.error("Error saving discussion topics:", error);
      alert("토론 주제 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSavingTopics(false);
    }
  };

  const handleDiscussionVote = async (
    topicId: string,
    direction: Exclude<TopicVoteValue, 0>
  ) => {
    if (!currentUser || hasActiveSubscription !== true || votingTopicId) return;

    const nextVote: TopicVoteValue =
      topicVotes[topicId] === direction ? 0 : direction;
    setVotingTopicId(topicId);
    try {
      const vote = httpsCallable<
        { articleId: string; topicId: string; vote: TopicVoteValue },
        DiscussionVoteResult
      >(functions, "voteDiscussionTopic");
      const result = await vote({ articleId, topicId, vote: nextVote });

      setTopicVotes((previous) => {
        const next = { ...previous };
        if (result.data.vote === 0) delete next[topicId];
        else next[topicId] = result.data.vote;
        return next;
      });
      setDiscussionStats((previous) => ({
        ...previous,
        [topicId]: {
          topicId,
          score: result.data.score,
          upvotes: result.data.upvotes,
          downvotes: result.data.downvotes,
        },
      }));
    } catch (voteError) {
      console.error("Unable to save discussion-topic vote:", voteError);
      alert(t.article.votingError);
    } finally {
      setVotingTopicId(null);
    }
  };

  const handleImageUploadClick = () => {
    if (isUploadingImage) return;
    fileInputRef.current?.click();
  };

  const handleImageFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setImageUploadError(null);
    setImageUploadStatus(null);

    const { valid, errors } = validateArticleImageFiles(files);
    if (errors.length > 0) {
      setImageUploadError(errors.join("\n"));
      event.target.value = "";
      return;
    }

    const file = valid[0];

    try {
      setIsUploadingImage(true);
      const downloadURL = await uploadArticleImage(file);
      setEditedImageUrl(downloadURL);
      setImageUploadStatus("업로드가 완료되었습니다. 미리보기로 확인해주세요.");
    } catch (uploadError) {
      console.error("Error uploading article image:", uploadError);
      setImageUploadError(
        uploadError instanceof Error
          ? uploadError.message
          : "이미지 업로드 중 오류가 발생했습니다."
      );
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  };

  const startEditingMedia = () => {
    if (!isAdmin) return;
    setEditedImageUrl(article?.image_url || "");
    setIsEditingMedia(true);
    setImageUploadError(null);
    setImageUploadStatus(null);
  };

  const cancelEditingMedia = () => {
    setIsEditingMedia(false);
    setEditedImageUrl("");
    setImageUploadError(null);
    setImageUploadStatus(null);
  };

  const saveMediaChanges = async () => {
    if (!articleId || !isAdmin) return;

    const trimmedUrl = editedImageUrl.trim();
    if (!trimmedUrl) {
      alert("이미지 URL을 입력해주세요.");
      return;
    }

    setIsSavingMedia(true);
    try {
      const articleRef = doc(db, "articles", articleId);
      await updateDoc(articleRef, {
        image_url: trimmedUrl,
      });

      setArticle((prev) =>
        prev
          ? {
              ...prev,
              image_url: trimmedUrl,
            }
          : prev
      );

      setIsEditingMedia(false);
      setEditedImageUrl("");
      setImageUploadStatus(null);
    } catch (error) {
      console.error("Error saving media:", error);
      alert("이미지 정보를 저장하는 중 문제가 발생했습니다.");
    } finally {
      setIsSavingMedia(false);
    }
  };

  const startEditingTitle = () => {
    if (!isAdmin) return;
    setEditedTitleEnglish(article?.title?.english || "");
    setEditedTitleKorean(article?.title?.korean || "");
    setIsEditingTitle(true);
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditedTitleEnglish("");
    setEditedTitleKorean("");
  };

  const saveTitleChanges = async () => {
    if (!articleId || !isAdmin) return;

    const trimmedEnglish = editedTitleEnglish.trim();
    const trimmedKorean = editedTitleKorean.trim();

    if (!trimmedEnglish) {
      alert("영문 제목은 반드시 입력해야 합니다.");
      return;
    }

    setIsSavingTitle(true);
    try {
      const articleRef = doc(db, "articles", articleId);
      await updateDoc(articleRef, {
        title: {
          english: trimmedEnglish,
          korean: trimmedKorean,
        },
      });

      setArticle((prev) =>
        prev
          ? {
              ...prev,
              title: {
                english: trimmedEnglish,
                korean: trimmedKorean,
              },
            }
          : prev
      );

      setIsEditingTitle(false);
      setEditedTitleEnglish("");
      setEditedTitleKorean("");
    } catch (error) {
      console.error("Error saving title:", error);
      alert("제목을 저장하는 중 문제가 발생했습니다.");
    } finally {
      setIsSavingTitle(false);
    }
  };

  const startEditingContent = () => {
    if (!isAdmin) return;
    const english = [...(article?.content?.english || [])];
    const korean = [...(article?.content?.korean || [])];
    const maxLength = Math.max(english.length, korean.length);
    const length = maxLength > 0 ? maxLength : 1;

    const normalizedEnglish = Array.from({ length }, (_, index) => english[index] || "");
    const normalizedKorean = Array.from({ length }, (_, index) => korean[index] || "");

    setEditedEnglishContent(normalizedEnglish);
    setEditedKoreanContent(normalizedKorean);
    setIsEditingContent(true);
  };

  const cancelEditingContent = () => {
    setIsEditingContent(false);
    setEditedEnglishContent([]);
    setEditedKoreanContent([]);
  };

  const updateContentParagraph = (
    language: "english" | "korean",
    index: number,
    value: string
  ) => {
    if (language === "english") {
      setEditedEnglishContent((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
    } else {
      setEditedKoreanContent((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });
    }
  };

  const addContentParagraph = () => {
    setEditedEnglishContent((prev) => [...prev, ""]);
    setEditedKoreanContent((prev) => [...prev, ""]);
  };

  const removeContentParagraph = (index: number) => {
    if (editedEnglishContent.length <= 1) return;

    setEditedEnglishContent((prev) => prev.filter((_, idx) => idx !== index));
    setEditedKoreanContent((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveContentChanges = async () => {
    if (!articleId || !isAdmin) return;

    const combined = editedEnglishContent.map((englishParagraph, index) => ({
      english: englishParagraph.trim(),
      korean: (editedKoreanContent[index] || "").trim(),
    }));

    const filtered = combined.filter(
      (paragraph) => paragraph.english.length > 0 || paragraph.korean.length > 0
    );

    if (filtered.length === 0) {
      alert("최소 한 개의 단락을 입력해주세요.");
      return;
    }

    const englishContent = filtered.map((paragraph) => paragraph.english);
    const koreanContent = filtered.map((paragraph) => paragraph.korean);

    setIsSavingContent(true);
    try {
      const articleRef = doc(db, "articles", articleId);
      await updateDoc(articleRef, {
        content: {
          english: englishContent,
          korean: koreanContent,
        },
      });

      setArticle((prev) =>
        prev
          ? {
              ...prev,
              content: {
                english: englishContent,
                korean: koreanContent,
              },
            }
          : prev
      );

      setIsEditingContent(false);
      setEditedEnglishContent([]);
      setEditedKoreanContent([]);
      setVisibleKoreanParagraphs([]);
    } catch (error) {
      console.error("Error saving article content:", error);
      alert("본문을 저장하는 중 문제가 발생했습니다.");
    } finally {
      setIsSavingContent(false);
    }
  };

  if (loading) return <LoadingContainer>Loading article...</LoadingContainer>;
  if (error) return <ErrorContainer>Error: {error}</ErrorContainer>;
  if (!article) return <ErrorContainer>No article found</ErrorContainer>;

  const { content = { english: [], korean: [] }, keywords = [] } = article;
  const englishSummary = (article.summary?.english || []).filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim())
  );
  const koreanSummary = (article.summary?.korean || []).filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim())
  );
  const displayedSummary =
    isKoreanSummaryVisible && koreanSummary.length > 0
      ? koreanSummary
      : englishSummary.length > 0
      ? englishSummary
      : koreanSummary;
  const canToggleSummaryLanguage =
    englishSummary.length > 0 && koreanSummary.length > 0;
  const isActiveSubscriber = hasActiveSubscription === true;
  const discussionTopicEntries = discussionTopicEntriesFor(article)
    .map((topic) => ({
      ...topic,
      score: discussionStats[topic.id]?.score || 0,
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.originalIndex - right.originalIndex
    );
  const displayedEnglishContent = isGuestUser
    ? content.english.slice(0, GUEST_PARAGRAPH_LIMIT)
    : content.english;
  const displayedKoreanContent = isGuestUser
    ? content.korean.slice(0, GUEST_PARAGRAPH_LIMIT)
    : content.korean;
  const hasHiddenParagraphs =
    isGuestUser && content.english.length > displayedEnglishContent.length;
  const articleFigures = (article.figures || []).filter(
    (figure) => figure.display_url && !figure.is_hero
  );
  const figuresAfterParagraph = (paragraphIndex: number) =>
    articleFigures.filter(
      (figure) =>
        figure.kind === "figure" && figure.after_paragraph === paragraphIndex
    );
  const unplacedFigures = articleFigures.filter(
    (figure) =>
      figure.kind !== "figure" ||
      !Number.isInteger(figure.after_paragraph)
  );

  // Update next button visibility logic to ensure it stays visible until the last card
  const hasMoreKeywords = currentKeywordIndex < keywords.length - 1;
  // Check if we're near the end but not at the very last card
  const isAtLastButNotEnd =
    currentKeywordIndex >= keywords.length - 3 &&
    currentKeywordIndex < keywords.length - 1;
  const hasPrevKeywords = currentKeywordIndex > 0;

  return (
    <ArticlePageWrapper>
      <ArticleContainer>
        {isEditingTitle ? (
          <AdminEditCard style={{ marginBottom: "1.5rem" }}>
            <AdminEditTitle>
              <DocumentTextIcon width={20} height={20} />
              기사 제목 편집
            </AdminEditTitle>
            <EditorHint>
              영어 제목은 필수이며, 한국어 제목은 선택 사항입니다. 저장 시 모든
              사용자에게 바로 반영됩니다.
            </EditorHint>
            <AdminFieldLabel htmlFor="articleTitleEn">영문 제목</AdminFieldLabel>
            <AdminInput
              id="articleTitleEn"
              type="text"
              placeholder="Enter the English title"
              value={editedTitleEnglish}
              onChange={(e) => setEditedTitleEnglish(e.target.value)}
            />
            <AdminFieldLabel htmlFor="articleTitleKo">
              한국어 제목 (선택)
            </AdminFieldLabel>
            <AdminInput
              id="articleTitleKo"
              type="text"
              placeholder="한국어 제목을 입력하세요"
              value={editedTitleKorean}
              onChange={(e) => setEditedTitleKorean(e.target.value)}
            />
            <AdminActionGroup>
              <AdminActionButton
                type="button"
                onClick={saveTitleChanges}
                disabled={isSavingTitle}
              >
                <CheckIcon width={18} height={18} />
                {isSavingTitle ? "저장 중..." : "변경 사항 저장"}
              </AdminActionButton>
              <AdminActionButton
                type="button"
                variant="ghost"
                onClick={cancelEditingTitle}
                disabled={isSavingTitle}
              >
                <XMarkIcon width={18} height={18} />
                취소
              </AdminActionButton>
            </AdminActionGroup>
          </AdminEditCard>
        ) : (
          <TitleHeaderRow>
            <TitleTextGroup>
              <Title
                onClick={toggleKoreanTitle}
                className="article-text"
                data-original-text={article?.title.english}
              >
                {article?.title.english}
              </Title>

              <Subtitle
                isVisible={isKoreanTitleVisible}
                className="article-text"
                data-original-text={article?.title.korean}
              >
                {article?.title.korean}
              </Subtitle>
            </TitleTextGroup>
            {isAdmin && (
              <AdminActionButton type="button" onClick={startEditingTitle}>
                <PencilSquareIcon width={18} height={18} />
                제목 편집
              </AdminActionButton>
            )}
          </TitleHeaderRow>
        )}
        <InfoContainer>
          <ReadingTime>
            예상 읽기 시간: {calculateReadingTime(displayedEnglishContent)}
          </ReadingTime>
          {article.source_url && (
            <SourceTab
              as="a"
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              밋업 참가자 전용, 외부 배포 금지: 출처 확인
            </SourceTab>
          )}
        </InfoContainer>

        {isAdmin && !isEditingMedia && (
          <SectionHeaderRow style={{ justifyContent: "flex-end" }}>
            <AdminActionButton type="button" onClick={startEditingMedia}>
              <PencilSquareIcon width={18} height={18} />
              이미지 편집
            </AdminActionButton>
          </SectionHeaderRow>
        )}

        {isEditingMedia ? (
          <AdminEditCard>
            <AdminEditTitle>
              <PhotoIcon width={20} height={20} />
              대표 이미지 URL
            </AdminEditTitle>
            <EditorHint>
              새로운 이미지를 입력하면 저장 즉시 모든 사용자 화면에 반영됩니다.
              안정적인 CDN 또는 Cloud Storage 경로를 권장합니다.
            </EditorHint>
            <FileUploadRow>
              <AdminActionButton
                type="button"
                onClick={handleImageUploadClick}
                disabled={isUploadingImage}
              >
                <ArrowUpTrayIcon width={18} height={18} />
                {isUploadingImage ? "업로드 중..." : "내 컴퓨터에서 업로드"}
              </AdminActionButton>
              <HiddenFileInput
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageFileChange}
              />
            </FileUploadRow>
            {imageUploadStatus && (
              <UploadStatus>{imageUploadStatus}</UploadStatus>
            )}
            {imageUploadError && (
              <UploadStatus variant="error">{imageUploadError}</UploadStatus>
            )}
            <AdminFieldLabel htmlFor="articleImageUrl">
              이미지 URL
            </AdminFieldLabel>
            <AdminInput
              id="articleImageUrl"
              type="url"
              placeholder="https://"
              value={editedImageUrl}
              onChange={(e) => setEditedImageUrl(e.target.value)}
            />
            {editedImageUrl && (
              <MediaPreview>
                <MediaPreviewImage
                  src={editedImageUrl}
                  alt="선택한 기사 이미지 미리보기"
                  loading="lazy"
                />
              </MediaPreview>
            )}
            <AdminActionGroup>
              <AdminActionButton
                type="button"
                onClick={saveMediaChanges}
                disabled={isSavingMedia}
              >
                <CheckIcon width={18} height={18} />
                {isSavingMedia ? "저장 중..." : "변경 사항 저장"}
              </AdminActionButton>
              <AdminActionButton
                type="button"
                variant="ghost"
                onClick={cancelEditingMedia}
                disabled={isSavingMedia}
              >
                <XMarkIcon width={18} height={18} />
                취소
              </AdminActionButton>
            </AdminActionGroup>
          </AdminEditCard>
        ) : (
          (() => {
            console.log("Article URL:", article.url);
            console.log("Article image_url:", article.image_url);
            console.log("Is YouTube URL:", isYouTubeUrl(article.url));

            if (isYouTubeUrl(article.url)) {
              return (
                <YouTubeIframe
                  src={getYouTubeEmbedUrl(article.url) || ""}
                  title={article.title.english}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              );
            }

            if (article.image_url) {
              return (
                <>
                  <ArticleImage
                    src={article.image_url}
                    alt={article.title.english}
                    loading="lazy"
                  />
                  <ImageCaption>
                    이 이미지는 기사 이해를 돕기 위한 이미지로, AI에 의해
                    생성되었으며 실제와 다를 수 있습니다.
                  </ImageCaption>
                </>
              );
            }

            return (
              <EmptyMediaState>
                등록된 이미지가 없습니다. 상단의 편집 버튼을 눌러 이미지를
                추가해 보세요.
              </EmptyMediaState>
            );
          })()
        )}

        {/* Discussion Topics */}
        {(article.discussion_topics && article.discussion_topics.length > 0) ||
        accountStatus === "admin" ? (
          <DiscussionTopicsSection>
            <DiscussionHeaderRow>
              <SectionTitle style={{ marginBottom: 0 }}>
                Discussion Topics
              </SectionTitle>
              <SectionActions>
                <CopyActionButton
                  type="button"
                  onClick={() =>
                    copyText(
                      discussionTopicEntries
                        .map((topic, index) => `${index + 1}. ${topic.text}`)
                        .join("\n"),
                      "questions"
                    )
                  }
                  aria-label={t.article.copyQuestions}
                >
                  <DocumentDuplicateIcon />
                  {copiedTarget === "questions"
                    ? t.article.copied
                    : t.article.copyQuestions}
                </CopyActionButton>
                {accountStatus === "admin" && !isEditingTopics && (
                  <AdminButton onClick={startEditingTopics}>
                    <PencilSquareIcon />
                    편집
                  </AdminButton>
                )}
              </SectionActions>
            </DiscussionHeaderRow>

            {isEditingTopics ? (
              <div>
                <AdminControlsContainer>
                  <AdminButton onClick={saveTopics} disabled={isSavingTopics}>
                    {isSavingTopics ? (
                      "저장 중..."
                    ) : (
                      <>
                        <CheckIcon />
                        저장
                      </>
                    )}
                  </AdminButton>
                  <AdminButton
                    onClick={cancelEditingTopics}
                    disabled={isSavingTopics}
                  >
                    <XMarkIcon />
                    취소
                  </AdminButton>
                </AdminControlsContainer>

                {editedTopics.map((topic, index) => (
                  <EditableTopicContainer key={index}>
                    <EditableTopicInput
                      value={topic}
                      onChange={(e) => updateTopic(index, e.target.value)}
                      placeholder="토론 주제를 입력하세요"
                    />
                    <RemoveTopicButton
                      onClick={() => removeTopic(index)}
                      title="삭제"
                    >
                      ×
                    </RemoveTopicButton>
                  </EditableTopicContainer>
                ))}

                <NewTopicContainer>
                  <NewTopicInput
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="새 토론 주제 추가..."
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addNewTopic();
                      }
                    }}
                  />
                  <AddTopicButton
                    onClick={addNewTopic}
                    disabled={!newTopic.trim()}
                  >
                    ➕ 추가
                  </AddTopicButton>
                </NewTopicContainer>
              </div>
            ) : article.discussion_topics &&
              article.discussion_topics.length > 0 ? (
              <>
                <DiscussionTopicsList>
                  {discussionTopicEntries.map((topic) => {
                    const currentVote = topicVotes[topic.id] || 0;
                    const score = discussionStats[topic.id]?.score || 0;
                    const votingDisabled =
                      !isActiveSubscriber || votingTopicId !== null;

                    return (
                      <DiscussionTopicItem key={topic.id}>
                        <DiscussionTopicText
                          className="article-text"
                          data-original-text={topic.text}
                          onClick={handleWordClick}
                          onMouseDown={onMouseDownPress}
                          onMouseMove={onMouseMovePress}
                          onMouseUp={onMouseUpPress}
                          onMouseLeave={onMouseLeavePress}
                          onTouchStart={onTouchStartPress}
                          onTouchMove={onTouchMovePress}
                          onTouchEnd={onTouchEndPress}
                        >
                          {topic.text}
                        </DiscussionTopicText>
                        <DiscussionVoteControls>
                          <DiscussionVoteButton
                            type="button"
                            $active={currentVote === 1}
                            disabled={votingDisabled}
                            aria-pressed={currentVote === 1}
                            aria-label={t.article.upvoteTopic}
                            title={
                              isActiveSubscriber
                                ? t.article.upvoteTopic
                                : t.article.votingMembersOnly
                            }
                            onClick={() => handleDiscussionVote(topic.id, 1)}
                          >
                            <ChevronUpIcon />
                          </DiscussionVoteButton>
                          <DiscussionVoteScore aria-label={`${score}`}>
                            {score > 0 ? `+${score}` : score}
                          </DiscussionVoteScore>
                          <DiscussionVoteButton
                            type="button"
                            $active={currentVote === -1}
                            $negative
                            disabled={votingDisabled}
                            aria-pressed={currentVote === -1}
                            aria-label={t.article.downvoteTopic}
                            title={
                              isActiveSubscriber
                                ? t.article.downvoteTopic
                                : t.article.votingMembersOnly
                            }
                            onClick={() => handleDiscussionVote(topic.id, -1)}
                          >
                            <ChevronDownIcon />
                          </DiscussionVoteButton>
                        </DiscussionVoteControls>
                      </DiscussionTopicItem>
                    );
                  })}
                </DiscussionTopicsList>
                {!isActiveSubscriber && (
                  <VoteAccessNote>{t.article.votingMembersOnly}</VoteAccessNote>
                )}
              </>
            ) : (
              accountStatus === "admin" && (
                <div
                  style={{
                    color: "rgba(5, 5, 5, 0.6)",
                    fontStyle: "italic",
                    textAlign: "center",
                    padding: "2rem",
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "2px dashed #050505",
                  }}
                >
                  토론 주제가 없습니다. 편집 버튼을 눌러 추가해보세요.
                </div>
              )
            )}
          </DiscussionTopicsSection>
        ) : null}

        <SectionHeaderRow>
          <SectionTitle style={{ marginBottom: 0 }}>Article Content</SectionTitle>
          <SectionActions>
            {!isEditingContent && (
              <CopyActionButton
                type="button"
                onClick={() =>
                  copyText(displayedEnglishContent.join("\n\n"), "body")
                }
                aria-label={t.article.copyBody}
              >
                <DocumentDuplicateIcon />
                {copiedTarget === "body" ? t.article.copied : t.article.copyBody}
              </CopyActionButton>
            )}
            {isAdmin && !isEditingContent && (
              <AdminActionButton type="button" onClick={startEditingContent}>
                <DocumentTextIcon width={18} height={18} />
                본문 편집
              </AdminActionButton>
            )}
          </SectionActions>
        </SectionHeaderRow>

        {!isEditingContent && displayedSummary.length > 0 && (
          <QuickSummaryCard>
            <QuickSummaryHeader>
              <QuickSummaryTitle>{t.article.quickSummary}</QuickSummaryTitle>
              <QuickSummaryActions>
                {canToggleSummaryLanguage && (
                  <QuickSummaryLanguageButton
                    type="button"
                    onClick={toggleKoreanSummary}
                  >
                    <LanguageIcon />
                    {isKoreanSummaryVisible
                      ? t.article.showEnglishSummary
                      : t.article.showKoreanSummary}
                  </QuickSummaryLanguageButton>
                )}
                <QuickSummaryExpandButton
                  type="button"
                  onClick={() => setIsSummaryExpanded((current) => !current)}
                  aria-label={
                    isSummaryExpanded
                      ? t.article.collapseSummary
                      : t.article.expandSummary
                  }
                  aria-expanded={isSummaryExpanded}
                  aria-controls="quick-summary-list"
                >
                  <QuickSummaryChevron $isExpanded={isSummaryExpanded} />
                </QuickSummaryExpandButton>
              </QuickSummaryActions>
            </QuickSummaryHeader>
            <QuickSummaryList id="quick-summary-list">
              {displayedSummary
                .slice(0, isSummaryExpanded ? displayedSummary.length : 1)
                .map((summaryItem, index) => (
                  <QuickSummaryItem key={index}>{summaryItem}</QuickSummaryItem>
                ))}
              {!isSummaryExpanded && displayedSummary.length > 1 && (
                <QuickSummaryEllipsis aria-hidden="true">…</QuickSummaryEllipsis>
              )}
            </QuickSummaryList>
          </QuickSummaryCard>
        )}

        {hasHiddenParagraphs && !isEditingContent && (
          <PaywallNotice>
            <LockClosedIcon width={24} height={24} />
            <PaywallText>
              <PaywallTitle>참가자 전용 전체 기사</PaywallTitle>
              <PaywallDescription>
                출판사의 저작권을 보호하기 위해 전체 기사 본문은 이벤트에
                참여 중인 회원에게만 제공됩니다. 로그인 후 계속 읽어주세요.
              </PaywallDescription>
            </PaywallText>
          </PaywallNotice>
        )}

        {(isEditingContent || displayedEnglishContent?.length > 0) && (
          <ContentSection>
            {isEditingContent ? (
              <>
                <AdminActionGroup style={{ marginBottom: "0.8rem" }}>
                  <AdminActionButton
                    type="button"
                    onClick={saveContentChanges}
                    disabled={isSavingContent}
                  >
                    <CheckIcon width={18} height={18} />
                    {isSavingContent ? "저장 중..." : "변경 사항 저장"}
                  </AdminActionButton>
                  <AdminActionButton
                    type="button"
                    variant="ghost"
                    onClick={cancelEditingContent}
                    disabled={isSavingContent}
                  >
                    <XMarkIcon width={18} height={18} />
                    취소
                  </AdminActionButton>
                </AdminActionGroup>
                <EditorHint>
                  영어와 한국어 단락은 같은 순서를 유지합니다. 두 언어 모두
                  비워 둔 단락은 저장 시 자동으로 제외됩니다.
                </EditorHint>
                <ParagraphEditorWrapper>
                  {editedEnglishContent.map((paragraph, index) => (
                    <ParagraphEditorCard key={index}>
                      <ParagraphEditorHeader>
                        <ParagraphBadge>{`Paragraph ${index + 1}`}</ParagraphBadge>
                        <IconCircleButton
                          type="button"
                          onClick={() => removeContentParagraph(index)}
                          disabled={editedEnglishContent.length <= 1}
                          aria-label="단락 삭제"
                        >
                          <TrashIcon width={16} height={16} />
                        </IconCircleButton>
                      </ParagraphEditorHeader>
                      <AdminFieldLabel>English</AdminFieldLabel>
                      <AdminTextArea
                        value={paragraph}
                        onChange={(e) =>
                          updateContentParagraph("english", index, e.target.value)
                        }
                        placeholder="영어 단락을 입력하세요"
                      />
                      <AdminFieldLabel>한국어 (선택)</AdminFieldLabel>
                      <AdminTextArea
                        value={editedKoreanContent[index] || ""}
                        onChange={(e) =>
                          updateContentParagraph("korean", index, e.target.value)
                        }
                        placeholder="한국어 번역 단락을 입력하세요"
                        style={{ minHeight: "100px" }}
                      />
                    </ParagraphEditorCard>
                  ))}
                </ParagraphEditorWrapper>
                <AddParagraphButton type="button" onClick={addContentParagraph}>
                  <PlusIcon width={18} height={18} />
                  단락 추가
                </AddParagraphButton>
              </>
            ) : (
              displayedEnglishContent.map((paragraph, index) => {
                const hasKoreanParagraph = Boolean(
                  displayedKoreanContent[index]
                );
                const placedFigures = figuresAfterParagraph(index);

                return (
                <React.Fragment key={index}>
                <ParagraphContainer>
                  <Paragraph
                    className="article-text"
                    data-original-text={paragraph}
                    onClick={handleWordClick}
                    onMouseDown={onMouseDownPress}
                    onMouseMove={onMouseMovePress}
                    onMouseUp={onMouseUpPress}
                    onMouseLeave={onMouseLeavePress}
                    onTouchStart={onTouchStartPress}
                    onTouchMove={onTouchMovePress}
                    onTouchEnd={onTouchEndPress}
                  >
                    {paragraph}
                  </Paragraph>
                  <ParagraphActionRow>
                    <CopyActionButton
                      type="button"
                      onClick={() => copyText(paragraph, `paragraph-${index}`)}
                      aria-label={t.article.copyParagraph}
                    >
                      <DocumentDuplicateIcon />
                      {copiedTarget === `paragraph-${index}`
                        ? t.article.copied
                        : t.article.copyParagraph}
                    </CopyActionButton>
                    <TranslationToggleButton
                      onClick={() => toggleKoreanParagraph(index)}
                      className={
                        visibleKoreanParagraphs.includes(index) ? "active" : ""
                      }
                      disabled={!hasKoreanParagraph}
                    >
                      <LanguageIcon />
                      {hasKoreanParagraph
                        ? visibleKoreanParagraphs.includes(index)
                          ? t.article.hideKorean
                          : t.article.showKorean
                        : t.article.noKoreanTranslation}
                    </TranslationToggleButton>
                  </ParagraphActionRow>
                    {hasKoreanParagraph && (
                    <KoreanParagraph
                      isVisible={visibleKoreanParagraphs.includes(index)}
                      className="article-text"
                        data-original-text={displayedKoreanContent[index]}
                    >
                        {displayedKoreanContent[index]}
                    </KoreanParagraph>
                  )}
                </ParagraphContainer>
                {placedFigures.length > 0 && (
                  <FiguresSection>
                    <FiguresGrid>
                      {placedFigures.map((figure, figureIndex) => (
                        <FigureCard key={`figure-${index}-${figureIndex}`}>
                          <ChartImage
                            src={figure.display_url as string}
                            alt={figure.caption?.english || "Article figure"}
                            loading="lazy"
                          />
                        </FigureCard>
                      ))}
                    </FiguresGrid>
                  </FiguresSection>
                )}
                </React.Fragment>
                );
              })
            )}
          </ContentSection>
        )}

        {(() => {
          const photos = unplacedFigures.filter(
            (f) => f.display_url && !f.is_hero && f.kind === "photo"
          );
          const charts = unplacedFigures.filter(
            (f) =>
              f.display_url &&
              !f.is_hero &&
              (f.kind === "chart" || f.kind === "table")
          );
          if (photos.length === 0 && charts.length === 0) return null;
          return (
            <FiguresSection>
              {photos.length > 0 && (
                <PhotoFiguresGrid>
                  {photos.map((fig, index) => (
                    <FigureCard key={`photo-${index}`}>
                      <ArticlePhoto
                        src={fig.display_url as string}
                        alt={fig.caption?.english || article.title.english}
                        loading="lazy"
                      />
                    </FigureCard>
                  ))}
                </PhotoFiguresGrid>
              )}

              {charts.length > 0 && (
                <FiguresGrid>
                  {charts.map((fig, index) => (
                    <FigureCard key={index}>
                      <ChartImage
                        src={fig.display_url as string}
                        alt={fig.caption?.english || "Article chart"}
                        loading="lazy"
                      />
                    </FigureCard>
                  ))}
                </FiguresGrid>
              )}
            </FiguresSection>
          );
        })()}

        {keywords && keywords.length > 0 && (
          <KeywordsSection>
            <SectionHeaderRow>
              <SectionTitle style={{ marginBottom: 0 }}>Key Vocabulary</SectionTitle>
            </SectionHeaderRow>
            <KeywordsContainer>
              <KeywordsSlider
                ref={sliderRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {keywords.map((word, index) => {
                  const wordData = wordDetails[word];
                  // Skip rendering cards that have failed to load or are still loading
                  const isLoading = wordLoading[word];
                  if (!wordData && !isLoading) return null;

                  return (
                    <KeywordCard
                      key={index}
                      onClick={() => openKeywordModal(word)}
                    >
                      <Word>{word}</Word>
                      {wordData && (
                        <>
                          {wordData.categories?.english &&
                            wordData.categories.english.length > 0 && (
                              <Categories>
                                {wordData.categories.english
                                  .slice(0, 2)
                                  .map((cat, idx) => (
                                    <Category key={idx}>{cat}</Category>
                                  ))}
                              </Categories>
                            )}
                          <Meaning>{wordData.definitions.english}</Meaning>
                          {wordData.synonyms &&
                            wordData.synonyms.length > 0 && (
                              <Synonyms>
                                {wordData.synonyms
                                  .slice(0, 3)
                                  .map((syn, idx) => (
                                    <Synonym key={idx}>{syn}</Synonym>
                                  ))}
                              </Synonyms>
                            )}
                          {wordData.examples &&
                            wordData.examples.length > 0 &&
                            wordData.examples[0].english.length > 0 && (
                              <Example>
                                "{wordData.examples[0].english[0]}"
                              </Example>
                            )}
                        </>
                      )}
                      {isLoading && <Meaning>Loading word details...</Meaning>}
                    </KeywordCard>
                  );
                })}
              </KeywordsSlider>
              {hasPrevKeywords && (
                <PrevButton
                  onClick={handlePrevKeyword}
                  aria-label="Previous keyword"
                />
              )}
              {hasMoreKeywords && (
                <NextButton
                  onClick={
                    isAtLastButNotEnd ? handleLastKeyword : handleNextKeyword
                  }
                  aria-label="Next keyword"
                />
              )}
            </KeywordsContainer>
          </KeywordsSection>
        )}

        {/* Keyword modal */}
        <ModalOverlay isOpen={isModalOpen} onClick={closeKeywordModal}>
          <ModalContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <CloseButton onClick={closeKeywordModal}>×</CloseButton>
            {selectedKeyword && selectedWordData && (
              <>
                <WordTitleRow>
                  <ModalWord>{selectedKeyword}</ModalWord>
                  {currentUser ? (
                    savedWords.includes(selectedKeyword) ? (
                      <SavedIndicator>저장됨</SavedIndicator>
                    ) : (
                      <SaveButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveWord(selectedKeyword);
                        }}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          "저장 중..."
                        ) : (
                          <>
                            <PlusIcon />
                            단어장에 추가
                          </>
                        )}
                      </SaveButton>
                    )
                  ) : null}
                </WordTitleRow>

                {/* Categories */}
                {selectedWordData.categories?.english &&
                  selectedWordData.categories.english.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginBottom: "1.2rem",
                      }}
                    >
                      {selectedWordData.categories.english.map(
                        (category, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: "0.8rem",
                              color: "#050505",
                              backgroundColor: "#f47a4a",
                              border: "1.5px solid #050505",
                              padding: "0.2rem 0.6rem",
                              borderRadius: "999px",
                              fontWeight: 800,
                            }}
                          >
                            {category}
                          </span>
                        )
                      )}
                    </div>
                  )}

                {/* Definition Section */}
                <ModalSection>
                  <ModalSectionTitle>Definition</ModalSectionTitle>
                  <DualText>
                    <ModalMeaning>
                      {selectedWordData.definitions.english}
                    </ModalMeaning>
                    <KoreanText>
                      {selectedWordData.definitions.korean}
                    </KoreanText>
                  </DualText>
                </ModalSection>

                {/* Synonyms Section */}
                {selectedWordData.synonyms &&
                  selectedWordData.synonyms.length > 0 && (
                    <ModalSection>
                      <ModalSectionTitle>Synonyms</ModalSectionTitle>
                      <ModalSynonyms>
                        {selectedWordData.synonyms.map((syn, idx) => (
                          <ModalSynonym key={idx}>{syn}</ModalSynonym>
                        ))}
                      </ModalSynonyms>
                    </ModalSection>
                  )}

                {/* Antonyms Section */}
                {selectedWordData.antonyms &&
                  selectedWordData.antonyms.length > 0 && (
                    <ModalSection>
                      <ModalSectionTitle>Antonyms</ModalSectionTitle>
                      <ModalSynonyms>
                        {selectedWordData.antonyms.map((ant, idx) => (
                          <ModalSynonym key={idx}>{ant}</ModalSynonym>
                        ))}
                      </ModalSynonyms>
                    </ModalSection>
                  )}

                {/* Examples Section */}
                {selectedWordData.examples &&
                  selectedWordData.examples.length > 0 && (
                    <ModalSection>
                      <ModalSectionTitle>Examples</ModalSectionTitle>
                      <div
                        style={{
                          borderRadius: "8px",
                          padding: "0.5rem 0",
                        }}
                      >
                        {selectedWordData.examples[0].english.map(
                          (example, idx) => (
                            <div
                              key={idx}
                              style={{
                                marginBottom:
                                  idx <
                                  selectedWordData.examples[0].english.length -
                                    1
                                    ? "1.2rem"
                                    : 0,
                                paddingBottom:
                                  idx <
                                  selectedWordData.examples[0].english.length -
                                    1
                                    ? "1.2rem"
                                    : 0,
                                borderBottom:
                                  idx <
                                  selectedWordData.examples[0].english.length -
                                    1
                                    ? `1.5px solid #050505`
                                    : "none",
                              }}
                            >
                              <ModalExample>"{example}"</ModalExample>
                              {selectedWordData.examples[0].korean &&
                                selectedWordData.examples[0].korean[idx] && (
                                  <ExampleKoreanText>
                                    {selectedWordData.examples[0].korean[idx]}
                                  </ExampleKoreanText>
                                )}
                            </div>
                          )
                        )}
                      </div>
                    </ModalSection>
                  )}

                {/* Wiktionary Section */}
                {selectedWordWiktionaryData &&
                  selectedWordWiktionaryData.length > 0 && (
                    <ModalSection>
                      <ModalSectionTitle>Wiktionary</ModalSectionTitle>
                      {selectedWordWiktionaryData[0].meanings
                        ?.slice(0, 3)
                        .map((meaning: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: "1.2rem" }}>
                            <div
                              style={{
                                fontWeight: 900,
                                color: "#050505",
                                marginBottom: "0.5rem",
                                fontSize: "1rem",
                                textTransform: "capitalize",
                              }}
                            >
                              {meaning.partOfSpeech}
                            </div>

                            {meaning.definitions &&
                              meaning.definitions.length > 0 && (
                                <ul
                                  style={{
                                    marginTop: "0.3rem",
                                    paddingLeft: "1.2rem",
                                    listStyleType: "disc",
                                    margin: "0 0 0.8rem 0",
                                  }}
                                >
                                  {meaning.definitions
                                    .slice(0, 2)
                                    .map((def: any, defIdx: number) => (
                                      <li
                                        key={defIdx}
                                        style={{
                                          marginBottom: "0.6rem",
                                          fontSize: "0.95rem",
                                          color: "#050505",
                                          lineHeight: "1.5",
                                        }}
                                      >
                                        {def.definition}
                                        {def.example && (
                                          <div
                                            style={{
                                              fontStyle: "italic",
                                              color: "rgba(5, 5, 5, 0.6)",
                                              marginTop: "0.3rem",
                                              fontSize: "0.9rem",
                                              lineHeight: "1.4",
                                            }}
                                          >
                                            e.g. "{def.example}"
                                          </div>
                                        )}
                                        {def.synonyms &&
                                          def.synonyms.length > 0 && (
                                            <div
                                              style={{
                                                fontSize: "0.85rem",
                                                color: "rgba(5, 5, 5, 0.72)",
                                                marginTop: "0.25rem",
                                                lineHeight: "1.4",
                                              }}
                                            >
                                              <strong>Synonyms:</strong>{" "}
                                              {def.synonyms.join(", ")}
                                            </div>
                                          )}
                                        {def.antonyms &&
                                          def.antonyms.length > 0 && (
                                            <div
                                              style={{
                                                fontSize: "0.85rem",
                                                color: "rgba(5, 5, 5, 0.72)",
                                                marginTop: "0.25rem",
                                                lineHeight: "1.4",
                                              }}
                                            >
                                              <strong>Antonyms:</strong>{" "}
                                              {def.antonyms.join(", ")}
                                            </div>
                                          )}
                                      </li>
                                    ))}
                                </ul>
                              )}

                            {/* Display meaning-level synonyms */}
                            {meaning.synonyms &&
                              meaning.synonyms.length > 0 && (
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "rgba(5, 5, 5, 0.72)",
                                    marginTop: "0.3rem",
                                    lineHeight: "1.4",
                                  }}
                                >
                                  <strong>Synonyms:</strong>{" "}
                                  {meaning.synonyms.join(", ")}
                                </div>
                              )}

                            {/* Display meaning-level antonyms */}
                            {meaning.antonyms &&
                              meaning.antonyms.length > 0 && (
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "rgba(5, 5, 5, 0.72)",
                                    marginTop: "0.3rem",
                                    lineHeight: "1.4",
                                  }}
                                >
                                  <strong>Antonyms:</strong>{" "}
                                  {meaning.antonyms.join(", ")}
                                </div>
                              )}
                          </div>
                        ))}
                    </ModalSection>
                  )}
              </>
            )}
            {selectedKeyword && !selectedWordData && (
              <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                <div
                  style={{
                    fontSize: "1.2rem",
                    color: "rgba(5, 5, 5, 0.72)",
                    marginBottom: "0.5rem",
                  }}
                >
                  Loading details...
                </div>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    margin: "1rem auto",
                    border: `3px solid rgba(5, 5, 5, 0.15)`,
                    borderTop: `3px solid #f47a4a`,
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                <style>
                  {`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}
                </style>
              </div>
            )}
          </ModalContent>
        </ModalOverlay>

        {/* Word definition modal */}
        <DefinitionModalOverlay
          isOpen={wordDefinitionModal.isOpen}
          onClick={closeDefinitionModal}
        >
          <DefinitionModalContent
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <CloseButton onClick={closeDefinitionModal}>×</CloseButton>
            <WordDefinitionTitle>
              {wordDefinitionModal.word}
            </WordDefinitionTitle>

            {/* GPT Definition Section */}
            {wordDefinitionModal.isLoading ? (
              <LoadingDefinitionContent>
                뜻풀이 생각 중...
              </LoadingDefinitionContent>
            ) : (
              <div style={{ marginBottom: "1.5rem" }}>
                <ModalSectionTitle>AI Definition</ModalSectionTitle>
                <WordDefinitionContent>
                  {wordDefinitionModal.definition}
                </WordDefinitionContent>
              </div>
            )}

            {/* Wiktionary Section */}
            {wordDefinitionModal.isWiktionaryLoading ? (
              <div style={{ marginTop: "1.5rem" }}>
                <ModalSectionTitle>Wiktionary</ModalSectionTitle>
                <LoadingDefinitionContent>
                  Wiktionary 정보 로딩 중...
                </LoadingDefinitionContent>
              </div>
            ) : (
              wordDefinitionModal.wiktionaryData &&
              wordDefinitionModal.wiktionaryData.length > 0 && (
                <div style={{ marginTop: "1.5rem" }}>
                  <ModalSectionTitle>Wiktionary</ModalSectionTitle>
                  {wordDefinitionModal.wiktionaryData[0].meanings
                    ?.slice(0, 3)
                    .map((meaning: any, idx: number) => (
                      <div key={idx} style={{ marginBottom: "1.2rem" }}>
                        <div
                          style={{
                            fontWeight: 900,
                            color: "#050505",
                            marginBottom: "0.5rem",
                            fontSize: "1rem",
                            textTransform: "capitalize",
                          }}
                        >
                          {meaning.partOfSpeech}
                        </div>

                        {meaning.definitions &&
                          meaning.definitions.length > 0 && (
                            <ul
                              style={{
                                marginTop: "0.3rem",
                                paddingLeft: "1.2rem",
                                listStyleType: "disc",
                                margin: "0 0 0.8rem 0",
                              }}
                            >
                              {meaning.definitions
                                .slice(0, 2)
                                .map((def: any, defIdx: number) => (
                                  <li
                                    key={defIdx}
                                    style={{
                                      marginBottom: "0.6rem",
                                      fontSize: "0.95rem",
                                      color: "#050505",
                                      lineHeight: "1.5",
                                    }}
                                  >
                                    {def.definition}
                                    {def.example && (
                                      <div
                                        style={{
                                          fontStyle: "italic",
                                          color: "rgba(5, 5, 5, 0.6)",
                                          marginTop: "0.3rem",
                                          fontSize: "0.9rem",
                                          lineHeight: "1.4",
                                        }}
                                      >
                                        e.g. "{def.example}"
                                      </div>
                                    )}
                                    {def.synonyms &&
                                      def.synonyms.length > 0 && (
                                        <div
                                          style={{
                                            fontSize: "0.85rem",
                                            color: "rgba(5, 5, 5, 0.72)",
                                            marginTop: "0.25rem",
                                            lineHeight: "1.4",
                                          }}
                                        >
                                          <strong>Synonyms:</strong>{" "}
                                          {def.synonyms.join(", ")}
                                        </div>
                                      )}
                                    {def.antonyms &&
                                      def.antonyms.length > 0 && (
                                        <div
                                          style={{
                                            fontSize: "0.85rem",
                                            color: "rgba(5, 5, 5, 0.72)",
                                            marginTop: "0.25rem",
                                            lineHeight: "1.4",
                                          }}
                                        >
                                          <strong>Antonyms:</strong>{" "}
                                          {def.antonyms.join(", ")}
                                        </div>
                                      )}
                                  </li>
                                ))}
                            </ul>
                          )}

                        {/* Display meaning-level synonyms */}
                        {meaning.synonyms && meaning.synonyms.length > 0 && (
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "rgba(5, 5, 5, 0.72)",
                              marginTop: "0.3rem",
                              lineHeight: "1.4",
                            }}
                          >
                            <strong>Synonyms:</strong>{" "}
                            {meaning.synonyms.join(", ")}
                          </div>
                        )}

                        {/* Display meaning-level antonyms */}
                        {meaning.antonyms && meaning.antonyms.length > 0 && (
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "rgba(5, 5, 5, 0.72)",
                              marginTop: "0.3rem",
                              lineHeight: "1.4",
                            }}
                          >
                            <strong>Antonyms:</strong>{" "}
                            {meaning.antonyms.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )
            )}
          </DefinitionModalContent>
        </DefinitionModalOverlay>

        {/* Translation Warning */}
        <TranslationWarning
          isVisible={showTranslationWarning}
          onClose={() => setShowTranslationWarning(false)}
          onDontShowAgain={handleDontShowTranslationWarning}
        />
      </ArticleContainer>
    </ArticlePageWrapper>
  );
};

export default Article;
