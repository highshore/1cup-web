"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase, invokeFunction } from "../../lib/supabase/client";
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

interface ArticleData {
  content: {
    english: string[];
    korean: string[];
  };
  keywords: string[]; // Changed to just array of word strings
  timestamp: string;
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

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

// Firestore imports and newly processed Supabase articles use slightly different
// optional fields. Normalize at the boundary so a nullable JSONB field cannot crash
// the reading experience for an otherwise valid migrated article.
const articleFromRow = (row: Record<string, unknown>): ArticleData => {
  const rawContent =
    row.content && typeof row.content === "object"
      ? (row.content as Record<string, unknown>)
      : {};
  const rawTitle =
    row.title && typeof row.title === "object"
      ? (row.title as Record<string, unknown>)
      : {};

  return {
    ...row,
    content: {
      english: stringArray(rawContent.english),
      korean: stringArray(rawContent.korean),
    },
    title: {
      english: typeof rawTitle.english === "string" ? rawTitle.english : "",
      korean: typeof rawTitle.korean === "string" ? rawTitle.korean : "",
    },
    // New pipeline records use `keywords`; imported records use
    // `pronunciation_keywords`. Prefer the former but preserve the latter.
    keywords: stringArray(row.keywords).length
      ? stringArray(row.keywords)
      : stringArray(row.pronunciation_keywords),
    discussion_topics: stringArray(row.discussion_topics),
    discussion_topic_ids: stringArray(row.discussion_topic_ids),
    figures: Array.isArray(row.figures) ? (row.figures as ArticleFigure[]) : [],
    publicationStatus: row.publication_status as ArticleData["publicationStatus"],
  } as ArticleData;
};

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
  entryId: string;
  selectedMeaningId: string | null;
  meanings: DictionaryMeaning[];
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

interface DictionaryMeaning {
  id: string;
  grammar_type: string;
  definition_en: string;
  definition_ko: string | null;
  usage_labels: string[];
  synonyms: string[];
  antonyms: string[];
  pronunciation_ipa: string | null;
  example_en: string | null;
  example_ko: string | null;
}

interface SavedVocabularyItem {
  entryId: string;
  meaningId: string | null;
}

// styled-components have been replaced with Tailwind utility classes. `tw`
// builds a plain element component that keeps the old styled-component name
// and merges any className passed at the call site.
function tw<T extends keyof React.JSX.IntrinsicElements>(tag: T, base: string) {
  function TwComponent(props: React.JSX.IntrinsicElements[T]) {
    const { className, ...rest } = props as { className?: string };
    return React.createElement(tag, {
      ...rest,
      className: className ? `${base} ${className}` : base,
    });
  }
  return TwComponent;
}

const ARTICLE_FONT_FAMILY =
  "[font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI','Roboto','Helvetica_Neue',Arial,sans-serif]";

const ArticleContainer = tw(
  "div",
  `w-full max-w-[960px] mx-auto pt-0 px-6 pb-[clamp(2rem,3vw,2.75rem)] min-h-screen bg-transparent ${ARTICLE_FONT_FAMILY} relative max-[768px]:pb-[1.75rem] max-[768px]:min-h-[auto] max-[768px]:overflow-x-hidden max-[480px]:pb-4`
);

const Title = tw(
  "h1",
  `text-[2rem] m-0 mb-2 text-[#050505] font-black leading-[1.2] cursor-pointer ${ARTICLE_FONT_FAMILY} max-[768px]:text-[1.7rem] hover:text-[#f47a4a]`
);

function Subtitle({
  isVisible,
  className,
  ...rest
}: { isVisible: boolean } & React.JSX.IntrinsicElements["h2"]) {
  const base = `text-[1.6rem] mb-6 text-[rgba(5,5,5,0.6)] font-semibold leading-[1.3] overflow-hidden [transition:all_0.3s_ease] max-[768px]:text-[1.4rem] max-[768px]:mb-[1.2rem] ${
    isVisible ? "max-h-[200px] opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"
  }`;
  return <h2 {...rest} className={className ? `${base} ${className}` : base} />;
}

const TitleHeaderRow = tw(
  "div",
  "flex items-start justify-between gap-4 flex-wrap mb-4"
);

const TitleTextGroup = tw("div", "flex-1 min-w-[250px]");

const QuickSummaryCard = tw(
  "section",
  "bg-white border-2 border-[#050505] rounded-[14px] mb-4 overflow-hidden shadow-[3px_3px_0_rgba(5,5,5,0.9)] max-[768px]:rounded-xl"
);

const QuickSummaryHeader = tw(
  "div",
  "py-4 px-[1.1rem] flex items-center justify-between gap-3 max-[768px]:py-[0.9rem] max-[768px]:px-4"
);

const QuickSummaryTitle = tw("span", "text-[1.05rem] font-extrabold");

const QuickSummaryActions = tw("div", "flex items-center gap-[0.35rem]");

const QuickSummaryLanguageButton = tw(
  "button",
  "min-h-[1.7rem] box-border border-[1.5px] border-[#050505] rounded-full bg-white text-[#050505] py-0 px-2 text-[0.64rem] font-extrabold cursor-pointer inline-flex items-center gap-1 [&_svg]:w-[0.72rem] [&_svg]:h-[0.72rem] hover:bg-[#f47a4a]"
);

const QuickSummaryExpandButton = tw(
  "button",
  "w-[1.7rem] h-[1.7rem] p-0 border-0 rounded-full bg-transparent text-[#050505] inline-flex items-center justify-center cursor-pointer hover:bg-[#f47a4a] focus-visible:outline-[3px] focus-visible:outline-[rgba(244,122,74,0.45)] focus-visible:outline-offset-2"
);

function QuickSummaryChevron({ $isExpanded }: { $isExpanded: boolean }) {
  return (
    <ChevronDownIcon
      className={`w-[1.35rem] h-[1.35rem] flex-none [transition:transform_0.18s_ease] ${
        $isExpanded ? "[transform:rotate(180deg)]" : "[transform:rotate(0deg)]"
      }`}
    />
  );
}

const QuickSummaryList = tw(
  "ul",
  "mt-[-0.1rem] mr-[1.1rem] mb-4 ml-[2.35rem] p-0 text-[#050505] list-disc list-outside max-[768px]:mr-4 max-[768px]:mb-[0.9rem] max-[768px]:ml-[2.1rem]"
);

// `qsi` is a marker class replacing the styled-components `& + &` selector.
const QuickSummaryItem = tw(
  "li",
  "qsi pl-[0.15rem] text-[0.98rem] leading-[1.58] [.qsi+&]:mt-[0.55rem]"
);

const QuickSummaryEllipsis = tw(
  "li",
  "list-none m-0 mt-[0.15rem] ml-[0.15rem] text-[rgba(5,5,5,0.6)] font-extrabold tracking-[0.12em]"
);

const ReadingTime = tw(
  "div",
  "flex items-center gap-[0.4rem] text-[#050505] font-bold text-[0.85rem] py-[0.4rem] px-[0.8rem] bg-white border-2 border-[#050505] rounded-full h-8 box-border before:content-['⏱'] before:text-[1rem] max-[768px]:text-[0.8rem] max-[768px]:py-[0.35rem] max-[768px]:px-[0.7rem] max-[768px]:h-[1.8rem]"
);

// Rendered as an anchor at its only call site (previously `as="a"`).
function SourceTab({
  as: _as,
  className,
  ...rest
}: { as?: "a" } & React.JSX.IntrinsicElements["a"]) {
  const base =
    "flex items-center gap-[0.4rem] text-[#050505] font-bold text-[0.85rem] py-[0.4rem] px-[0.8rem] bg-white border-2 border-[#050505] rounded-full h-8 box-border cursor-pointer [transition:background_0.2s_ease,color_0.2s_ease,transform_0.16s_ease] hover:bg-[#f47a4a] hover:text-[#050505] hover:[transform:translateY(-1px)] max-[768px]:text-[0.8rem] max-[768px]:py-[0.35rem] max-[768px]:px-[0.7rem] max-[768px]:h-[1.8rem]";
  return <a {...rest} className={className ? `${base} ${className}` : base} />;
}

const SectionTitle = tw(
  "h3",
  "inline-flex items-center mb-[1.2rem] border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-[0.3rem] px-3 text-[1.05rem] font-black break-keep max-[768px]:text-[1rem] max-[768px]:mb-4"
);

const ContentSection = tw("div", "mb-6 w-full bg-transparent");

const Paragraph = tw(
  "p",
  "text-[1.1rem] leading-[1.7] text-[#050505] font-normal cursor-pointer mb-0 max-[768px]:text-[1.05rem] max-[768px]:leading-[1.6] hover:text-[#f47a4a]"
);

function KoreanParagraph({
  isVisible,
  className,
  ...rest
}: { isVisible: boolean } & React.JSX.IntrinsicElements["p"]) {
  const base = `text-[1.05rem] leading-[1.7] text-[#050505] font-normal bg-[#fff6f0] p-4 rounded-[10px] [transition:all_0.3s_ease] max-[768px]:text-[1rem] max-[768px]:leading-[1.6] max-[768px]:p-[0.9rem] ${
    isVisible
      ? "mb-2 mt-[0.15rem] max-h-none opacity-100 overflow-y-auto"
      : "mb-0 mt-0 max-h-0 opacity-0 overflow-y-hidden"
  }`;
  return <p {...rest} className={className ? `${base} ${className}` : base} />;
}

const LoadingContainer = tw(
  "div",
  "flex justify-center items-center min-h-screen text-[1.2rem] font-bold text-[rgba(5,5,5,0.6)] bg-transparent"
);

const ErrorContainer = tw(
  "div",
  "flex justify-center items-center min-h-screen text-[1.2rem] font-extrabold text-[#050505] bg-transparent"
);

const KeywordsSection = tw(
  "div",
  "mb-10 relative w-full box-border block"
);

const KeywordsContainer = tw(
  "div",
  "relative w-full m-0 overflow-visible box-border block"
);

const KeywordsSlider = tw(
  "div",
  "flex overflow-x-hidden scroll-smooth py-[0.8rem] px-0 w-full box-border cursor-grab select-none [-webkit-user-select:none] [-webkit-touch-callout:none] max-[768px]:overflow-x-auto max-[768px]:[-webkit-overflow-scrolling:touch] max-[768px]:[scrollbar-width:none] max-[768px]:[&::-webkit-scrollbar]:hidden active:cursor-grabbing after:content-[''] after:flex-[0_0_20px]"
);

const KeywordCard = tw(
  "div",
  "flex-[0_0_240px] bg-white rounded-[10px] shadow-[3px_3px_0_rgba(5,5,5,0.88)] p-4 mr-[0.6rem] [transition:transform_0.16s_ease,box-shadow_0.16s_ease] border-2 border-[#050505] box-border cursor-pointer max-[768px]:flex-[0_0_220px] max-[768px]:p-[0.9rem] hover:[transform:translate(-2px,-2px)] hover:shadow-[5px_5px_0_rgba(5,5,5,0.88)]"
);

const Word = tw("h4", "text-[1.2rem] font-black text-[#050505] mb-2");

const Meaning = tw(
  "p",
  "text-[0.8rem] text-[rgba(5,5,5,0.72)] leading-[1.5] mb-[0.8rem]"
);

const Synonyms = tw("div", "flex flex-wrap gap-[0.4rem] mb-[0.8rem]");

const Synonym = tw(
  "span",
  "text-[0.7rem] bg-white text-[#050505] border-[1.5px] border-[#050505] py-[0.2rem] px-[0.55rem] rounded-full font-bold"
);

const Example = tw(
  "div",
  "text-[0.8rem] italic text-[rgba(5,5,5,0.6)] leading-[1.5] pt-[0.6rem] border-t-[1.5px] border-dashed border-[#050505]"
);

const sliderButtonBase =
  "absolute top-1/2 [transform:translateY(-50%)] w-[34px] h-[34px] rounded-full bg-white text-[#050505] border-2 border-[#050505] shadow-[2px_2px_0_#050505] flex items-center justify-center cursor-pointer z-20 [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] max-[768px]:w-[30px] max-[768px]:h-[34px] enabled:hover:bg-[#f47a4a] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[3px_3px_0_#050505] disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed";

const NextButton = tw(
  "button",
  `${sliderButtonBase} right-[-16px] max-[768px]:right-[-14px] after:content-['›'] after:text-[1.3rem] after:leading-none after:font-light`
);

const PrevButton = tw(
  "button",
  `${sliderButtonBase} left-[-16px] max-[768px]:left-[-14px] after:content-['‹'] after:text-[1.3rem] after:leading-none after:font-light`
);

// Modal components for keyword popup
function ModalOverlay({
  isOpen,
  className,
  ...rest
}: { isOpen: boolean } & React.JSX.IntrinsicElements["div"]) {
  const base = `fixed inset-0 bg-black/70 flex justify-center items-center z-[1000] [transition:opacity_0.3s_ease,visibility_0.3s_ease] [-webkit-overflow-scrolling:touch] touch-none ${
    isOpen ? "opacity-100 visible" : "opacity-0 invisible"
  }`;
  return <div {...rest} className={className ? `${base} ${className}` : base} />;
}

const ModalContent = tw(
  "div",
  "bg-white rounded-2xl shadow-[6px_6px_0_#050505] p-8 max-w-[90%] w-[500px] relative [transform:scale(1)] [transition:transform_0.3s_ease] border-2 border-[#050505] overflow-y-auto max-h-[90vh] max-[768px]:p-6 max-[768px]:w-[85%] max-[768px]:max-h-[80vh] max-[480px]:p-[1.2rem] max-[480px]:w-[90%] max-[480px]:max-h-[75vh]"
);

const CloseButton = tw(
  "button",
  "absolute top-4 right-4 bg-white border-2 border-[#050505] text-[1.25rem] text-[#050505] cursor-pointer w-8 h-8 leading-none rounded-full flex items-center justify-center [transition:background_0.2s_ease,transform_0.16s_ease] max-[768px]:top-[0.8rem] max-[768px]:right-[0.8rem] hover:bg-[#f47a4a] hover:[transform:translateY(-1px)]"
);

// Add new styled components for the improved modal layout
const ModalSection = tw("div", "mb-6 max-[768px]:mb-[1.2rem]");

const ModalSectionTitle = tw(
  "div",
  "text-[0.85rem] text-[#f47a4a] mb-2 font-extrabold uppercase tracking-[0.5px]"
);

const DualText = tw("div", "flex flex-col gap-4");

const KoreanText = tw(
  "div",
  "text-[0.95rem] text-[rgba(5,5,5,0.72)] leading-[1.5] [font-family:'Apple_SD_Gothic_Neo','Noto_Sans_KR',sans-serif] max-[768px]:text-[0.9rem]"
);

const ExampleKoreanText = tw(
  "div",
  "text-[rgba(5,5,5,0.72)] leading-[1.5] [font-family:'Apple_SD_Gothic_Neo','Noto_Sans_KR',sans-serif] not-italic mt-2 text-[0.9rem] opacity-90"
);

const ModalSynonyms = tw("div", "flex flex-wrap gap-[0.6rem]");

const ModalSynonym = tw(
  "span",
  "text-[0.9rem] bg-white text-[#050505] border-[1.5px] border-[#050505] py-[0.3rem] px-[0.8rem] rounded-full font-bold max-[768px]:text-[0.8rem] max-[768px]:py-[0.25rem] max-[768px]:px-[0.6rem]"
);

// Update the ModalWord component for better styling
const ModalWord = tw(
  "h3",
  "text-[2rem] font-black text-[#050505] mb-[0.3rem] max-[768px]:text-[1.7rem]"
);

// Update the ModalMeaning component
const ModalMeaning = tw(
  "p",
  "text-[1.1rem] text-[#050505] leading-[1.6] max-[768px]:text-[1rem]"
);

// Update the Example component
const ModalExample = tw(
  "div",
  "text-[1rem] italic text-[rgba(5,5,5,0.6)] leading-[1.6] max-[768px]:text-[0.9rem]"
);
// Add InfoContainer styled component
const InfoContainer = tw(
  "div",
  "flex items-center mb-4 gap-[0.6rem] flex-wrap mt-3 max-[768px]:gap-2 max-[768px]:mt-[0.6rem]"
);

// Keywords display components
const Categories = tw("div", "flex flex-wrap gap-[0.3rem] mb-2");

const Category = tw(
  "span",
  "text-[0.65rem] bg-[#f47a4a] text-[#050505] border-[1.5px] border-[#050505] py-[0.12rem] px-[0.45rem] rounded-full font-extrabold"
);

const SaveButton = tw(
  "button",
  "border-2 border-[#050505] bg-[#f47a4a] text-[#050505] text-[0.9rem] py-[0.4rem] px-[0.9rem] rounded-full ml-4 font-extrabold cursor-pointer inline-flex items-center [transition:transform_0.16s_ease,box-shadow_0.16s_ease] shadow-[2px_2px_0_#050505] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[3px_3px_0_#050505] disabled:opacity-50 disabled:cursor-default disabled:shadow-none max-[768px]:text-[0.8rem] max-[768px]:py-[0.3rem] max-[768px]:px-[0.7rem] [&_svg]:w-[0.95rem] [&_svg]:h-[0.95rem]"
);

const SavedIndicator = tw(
  "div",
  "inline-flex items-center text-[#16a34a] text-[0.9rem] ml-4 font-bold before:content-['✓'] before:mr-[0.3rem] before:font-bold max-[768px]:text-[0.8rem]"
);

const WordTitleRow = tw("div", "flex items-center mb-[0.3rem]");

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

const ArticlePageWrapper = tw(
  "div",
  "min-h-screen bg-[#faf8f4] w-full pb-[clamp(2rem,4vw,3rem)] mt-[-85px] pt-[calc(85px+1.75rem)] max-[768px]:[-webkit-overflow-scrolling:touch] max-[768px]:overflow-y-auto max-[768px]:mt-[-75px] max-[768px]:pt-[calc(75px+1.25rem)] max-[768px]:pb-8"
);

// Define necessary styled components
const ParagraphContainer = tw(
  "div",
  "relative pt-[0.85rem] pb-[0.9rem] border-b border-[rgba(5,5,5,0.14)] first:pt-0 max-[768px]:pt-[0.55rem] max-[768px]:pb-[0.6rem]"
);

// Add a styled component for the translation toggle button.
// The `.active` className toggle became the `$active` prop. Its former
// top/bottom margins are omitted: its only render site sits inside
// ParagraphActionRow, which always reset them to 0.
function TranslationToggleButton({
  $active,
  className,
  ...rest
}: { $active?: boolean } & React.JSX.IntrinsicElements["button"]) {
  const base = `${
    $active ? "bg-[#f47a4a]" : "bg-white"
  } text-[#050505] border-2 border-[#050505] rounded-full min-h-8 box-border py-0 px-[0.7rem] text-[0.72rem] font-extrabold cursor-pointer flex items-center justify-center [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] shadow-[2px_2px_0_#050505] enabled:hover:bg-[#f47a4a] enabled:hover:text-[#050505] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[3px_3px_0_#050505] [&_svg]:w-[0.82rem] [&_svg]:h-[0.82rem] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:pointer-events-none max-[768px]:min-h-[1.85rem] max-[768px]:px-2 max-[768px]:text-[0.68rem]`;
  return (
    <button {...rest} className={className ? `${base} ${className}` : base} />
  );
}

const CopyActionButton = tw(
  "button",
  "inline-flex items-center justify-center gap-[0.35rem] border-2 border-[#050505] rounded-full bg-white text-[#050505] min-h-8 box-border py-0 px-[0.7rem] text-[0.72rem] font-extrabold whitespace-nowrap cursor-pointer shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] hover:bg-[#f47a4a] hover:[transform:translate(-1px,-1px)] hover:shadow-[3px_3px_0_#050505] focus-visible:outline-[3px] focus-visible:outline-[rgba(244,122,74,0.45)] focus-visible:outline-offset-2 [&_svg]:w-[0.9rem] [&_svg]:h-[0.9rem] max-[768px]:gap-1 max-[768px]:min-h-[1.85rem] max-[768px]:px-2 max-[768px]:text-[0.68rem]"
);

const ParagraphActionRow = tw(
  "div",
  "flex items-center flex-wrap gap-[0.45rem] mt-2 mb-0 max-[768px]:gap-[0.35rem] max-[768px]:mt-[0.35rem]"
);

// Define a new modal overlay for word definitions
const DefinitionModalOverlay = ModalOverlay;

// Define a new modal content for word definitions
const DefinitionModalContent = tw(
  "div",
  "bg-white rounded-2xl shadow-[6px_6px_0_#050505] max-w-[90%] relative [transform:scale(1)] [transition:transform_0.3s_ease] border-2 border-[#050505] overflow-y-auto max-h-[90vh] p-[1.8rem] w-[450px] max-[768px]:w-[80%] max-[768px]:max-h-[80vh] max-[480px]:max-h-[75vh]"
);

// Update the word definition displays for the modal
const WordDefinitionTitle = tw(
  "div",
  "font-black text-[#050505] mb-4 text-[1.5rem] pb-[0.7rem] border-b-2 border-[#050505]"
);

const WordDefinitionContent = tw(
  "div",
  "text-[rgba(5,5,5,0.72)] [font-family:'Apple_SD_Gothic_Neo','Noto_Sans_KR',sans-serif] leading-[1.6] whitespace-pre-line text-[1rem]"
);

const LoadingDefinitionContent = tw(
  "div",
  "text-[rgba(5,5,5,0.6)] italic py-4 px-0 flex items-center justify-center min-h-[100px]"
);

const getWordDefinition = async (
  word: string,
  context: string,
  articleId: string
): Promise<string> => {
  try {
    // Normalize the word to lowercase for consistent storage
    const wordLower = word.toLowerCase();

    // Shared definition cache, keyed by (article, word).
    const { data: cached } = await supabase
      .from("article_meanings")
      .select("definition")
      .eq("article_id", articleId)
      .eq("word", wordLower)
      .maybeSingle();

    if (cached?.definition) {
      return cached.definition;
    }

    // If no saved answer is found, call the GPT API.
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

    // Store the result for future readers.
    await supabase.from("article_meanings").upsert(
      { article_id: articleId, word: wordLower, definition },
      { onConflict: "article_id,word" },
    );

    return definition;
  } catch (error) {
    console.error("GPT API Error:", error);
    return `뜻풀이를 가져오는 중 오류가 발생했습니다: ${error}`;
  }
};

const ArticleImage = tw(
  "img",
  "w-full aspect-[3/2] object-cover rounded-[14px] m-0 mt-5 mb-[0.45rem] border-2 border-[#050505] shadow-[5px_5px_0_rgba(5,5,5,0.9)] max-[768px]:mt-4 max-[768px]:mb-2"
);

const YouTubeIframe = tw(
  "iframe",
  "w-full aspect-video rounded-2xl my-6 border-2 border-[#050505] shadow-[5px_5px_0_rgba(5,5,5,0.9)] max-[768px]:my-4"
);

const ImageCaption = tw(
  "p",
  "text-[0.8rem] text-[rgba(5,5,5,0.6)] text-left m-0 mb-5 pl-[0.2rem] max-[768px]:text-[0.7rem] max-[768px]:mb-4"
);

// Inline article figures supplied by the editor.
const FiguresSection = tw("div", "my-5");

const FiguresGrid = tw("div", "grid grid-cols-1 gap-5 mt-3");

const PhotoFiguresGrid = tw(
  "div",
  "grid gap-5 mt-3 grid-cols-2 max-[640px]:grid-cols-1"
);

const FigureCard = tw("figure", "m-0");

// Inline figures are visual breaks in the article, so they intentionally have
// no visible label or caption.
const ChartImage = tw(
  "img",
  "w-full h-auto object-contain block rounded-[14px] m-0 mt-4 max-[768px]:mt-[0.9rem]"
);

const ArticlePhoto = tw(
  "img",
  "w-full aspect-[4/3] object-cover block border-2 border-[#050505] rounded-[14px]"
);

// Discussion topics components
const DiscussionTopicsSection = tw(
  "div",
  "mt-0 mb-8 max-[768px]:mt-[1.8rem] max-[768px]:mb-[1.8rem]"
);

const DiscussionTopicsList = tw(
  "ul",
  "list-none m-0 bg-white rounded-[14px] p-[1.2rem] border-2 border-[#050505] shadow-[4px_4px_0_rgba(5,5,5,0.9)]"
);

const DiscussionTopicItem = tw(
  "li",
  "flex items-start gap-[0.65rem] py-[0.65rem] px-0 border-b border-[rgba(5,5,5,0.14)] last:border-b-0 last:pb-0 first:pt-0 max-[768px]:gap-2"
);

const DiscussionTopicText = tw(
  "span",
  "flex-1 min-w-0 text-[1.02rem] text-[#050505] leading-[1.55] pl-[0.95rem] relative cursor-pointer [transition:color_0.2s_ease] before:content-['•'] before:text-[#f47a4a] before:font-bold before:absolute before:left-0 before:text-[1rem] hover:text-[#f47a4a] max-[768px]:text-[0.95rem] max-[768px]:pl-[0.85rem]"
);

const DiscussionVoteControls = tw(
  "div",
  "flex items-center gap-[0.2rem] flex-none"
);

function DiscussionVoteButton({
  $active,
  $negative,
  className,
  ...rest
}: {
  $active: boolean;
  $negative?: boolean;
} & React.JSX.IntrinsicElements["button"]) {
  const base = `w-[1.85rem] h-[1.85rem] inline-flex items-center justify-center p-0 border-[1.5px] border-[#050505] rounded-full ${
    $active ? ($negative ? "bg-[#ffd9d9]" : "bg-[#f47a4a]") : "bg-white"
  } text-[#050505] cursor-pointer [transition:transform_0.16s_ease,background_0.16s_ease] [&_svg]:w-[0.82rem] [&_svg]:h-[0.82rem] ${
    $negative ? "enabled:hover:bg-[#ffd9d9]" : "enabled:hover:bg-[#f47a4a]"
  } enabled:hover:[transform:translateY(-1px)] disabled:opacity-[0.42] disabled:cursor-not-allowed`;
  return (
    <button {...rest} className={className ? `${base} ${className}` : base} />
  );
}

const DiscussionVoteScore = tw(
  "span",
  "min-w-[1.35rem] text-[0.72rem] font-extrabold text-center tabular-nums"
);

const VoteAccessNote = tw(
  "p",
  "m-0 mt-[0.7rem] text-[rgba(5,5,5,0.6)] text-[0.78rem] leading-[1.45]"
);

// Admin editing styled components
const AdminControlsContainer = tw(
  "div",
  "flex items-center gap-[0.8rem] mb-4 flex-wrap max-[768px]:gap-[0.6rem]"
);

const AdminButton = tw(
  "button",
  "flex items-center justify-center gap-[0.3rem] bg-[#f47a4a] text-[#050505] border-2 border-[#050505] min-h-8 box-border py-0 px-[0.7rem] rounded-full text-[0.72rem] cursor-pointer [transition:transform_0.16s_ease,box-shadow_0.16s_ease] font-extrabold shadow-[2px_2px_0_#050505] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[3px_3px_0_#050505] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none max-[768px]:text-[0.75rem] max-[768px]:px-[0.8rem] [&_svg]:w-[0.9rem] [&_svg]:h-[0.9rem]"
);

const EditableTopicInput = tw(
  "input",
  "w-full p-[0.6rem] border-2 border-[#050505] rounded-[10px] text-[0.95rem] text-[#050505] bg-white mb-2 [transition:box-shadow_0.16s_ease] focus:outline-none focus:shadow-[2px_2px_0_#f47a4a] max-[768px]:text-[0.9rem] max-[768px]:p-2"
);

const EditableTopicContainer = tw(
  "div",
  "flex items-center gap-2 mb-[0.6rem] p-[0.6rem] bg-white rounded-xl border-[1.5px] border-[#050505] max-[768px]:gap-[0.4rem] max-[768px]:p-2"
);

const RemoveTopicButton = tw(
  "button",
  "bg-white text-[#050505] border-[1.5px] border-[#050505] rounded-full w-6 h-6 flex items-center justify-center cursor-pointer text-[0.8rem] [transition:background_0.16s_ease,color_0.16s_ease] shrink-0 hover:bg-[#e74c3c] hover:text-white max-[768px]:w-5 max-[768px]:h-5 max-[768px]:text-[0.7rem]"
);

const NewTopicContainer = tw(
  "div",
  "flex gap-2 mt-4 items-start max-[768px]:flex-col max-[768px]:gap-[0.4rem]"
);

const NewTopicInput = tw(
  "input",
  "flex-1 p-[0.6rem] border-2 border-[#050505] rounded-[10px] text-[0.9rem] text-[#050505] bg-white [transition:box-shadow_0.16s_ease] focus:outline-none focus:shadow-[2px_2px_0_#f47a4a] max-[768px]:w-full max-[768px]:text-[0.85rem] max-[768px]:p-2"
);

const AddTopicButton = tw(
  "button",
  "bg-[#f47a4a] text-[#050505] border-2 border-[#050505] py-[0.6rem] px-4 rounded-full text-[0.8rem] cursor-pointer [transition:transform_0.16s_ease,box-shadow_0.16s_ease] font-extrabold whitespace-nowrap shadow-[2px_2px_0_#050505] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[3px_3px_0_#050505] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none max-[768px]:w-full max-[768px]:text-[0.75rem] max-[768px]:py-2 max-[768px]:px-[0.8rem]"
);

const SectionHeaderRow = tw(
  "div",
  "flex items-center justify-between gap-[0.8rem] mt-8 mb-[0.9rem] max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-2"
);

const SectionActions = tw(
  "div",
  "flex items-center gap-2 flex-wrap max-[768px]:w-auto max-[768px]:gap-[0.35rem] max-[768px]:self-end max-[768px]:justify-end max-[768px]:[&>button]:flex-none"
);

const DiscussionHeaderRow = tw(
  "div",
  "flex items-center justify-between gap-[0.8rem] mt-8 mb-4 max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-2"
);

const AdminActionGroup = tw("div", "flex items-center gap-2 flex-wrap");

function AdminActionButton({
  variant,
  className,
  ...rest
}: {
  variant?: "primary" | "ghost";
} & React.JSX.IntrinsicElements["button"]) {
  const base = `inline-flex items-center justify-center gap-[0.35rem] min-h-8 box-border py-0 px-[0.7rem] rounded-full text-[0.72rem] font-extrabold border-2 border-[#050505] ${
    variant === "ghost" ? "bg-white" : "bg-[#f47a4a]"
  } text-[#050505] cursor-pointer shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] enabled:hover:bg-[#f47a4a] enabled:hover:text-[#050505] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[3px_3px_0_#050505] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none max-[768px]:gap-1 max-[768px]:min-h-[1.85rem] max-[768px]:px-2 max-[768px]:text-[0.68rem]`;
  return (
    <button {...rest} className={className ? `${base} ${className}` : base} />
  );
}

const AdminEditCard = tw(
  "div",
  "border-2 border-[#050505] rounded-2xl p-[1.2rem] bg-white shadow-[4px_4px_0_rgba(5,5,5,0.9)] mb-6"
);

const AdminEditTitle = tw(
  "div",
  "flex items-center gap-2 font-extrabold text-[#050505] mb-[0.9rem]"
);

const AdminFieldLabel = tw(
  "label",
  "block text-[0.85rem] font-bold text-[rgba(5,5,5,0.72)] mb-[0.4rem]"
);

const AdminInput = tw(
  "input",
  "w-full rounded-[10px] border-2 border-[#050505] py-[0.55rem] px-3 text-[0.95rem] text-[#050505] bg-white [transition:box-shadow_0.16s_ease] mb-4 focus:outline-none focus:shadow-[2px_2px_0_#f47a4a]"
);

const AdminTextArea = tw(
  "textarea",
  "w-full rounded-[10px] border-2 border-[#050505] py-3 px-[0.85rem] text-[0.95rem] text-[#050505] bg-white [transition:box-shadow_0.16s_ease] min-h-[120px] resize-y mb-[0.8rem] leading-[1.5] focus:outline-none focus:shadow-[2px_2px_0_#f47a4a]"
);

const ParagraphEditorWrapper = tw("div", "flex flex-col gap-4");

const ParagraphEditorCard = tw(
  "div",
  "border-2 border-[#050505] rounded-[14px] p-4 bg-white shadow-[3px_3px_0_rgba(5,5,5,0.9)]"
);

const ParagraphEditorHeader = tw(
  "div",
  "flex items-center justify-between gap-2 mb-[0.8rem]"
);

const ParagraphBadge = tw(
  "span",
  "text-[0.8rem] font-extrabold text-[#050505] bg-[#f47a4a] border-[1.5px] border-[#050505] rounded-full py-[0.2rem] px-[0.8rem]"
);

const IconCircleButton = tw(
  "button",
  "w-8 h-8 inline-flex items-center justify-center rounded-full border-2 border-[#050505] bg-white text-[#050505] cursor-pointer shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] enabled:hover:bg-[#f47a4a] enabled:hover:text-[#050505] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[3px_3px_0_#050505] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
);

const AddParagraphButton = tw(
  "button",
  "w-full rounded-xl border-2 border-dashed border-[#050505] p-[0.7rem] inline-flex items-center justify-center gap-[0.4rem] bg-white text-[#050505] font-extrabold cursor-pointer [transition:background_0.16s_ease,color_0.16s_ease] hover:bg-[#f47a4a] hover:text-[#050505]"
);

const MediaPreview = tw(
  "div",
  "w-full rounded-[14px] overflow-hidden border-2 border-[#050505] bg-white shadow-[4px_4px_0_rgba(5,5,5,0.9)] mb-4"
);

const MediaPreviewImage = tw("img", "w-full block object-cover");

const EditorHint = tw(
  "p",
  "text-[0.85rem] text-[rgba(5,5,5,0.6)] mb-[0.8rem]"
);

const EmptyMediaState = tw(
  "div",
  "border-2 border-dashed border-[#050505] rounded-xl p-4 text-center text-[rgba(5,5,5,0.6)] text-[0.9rem]"
);

const FileUploadRow = tw(
  "div",
  "flex items-center gap-[0.6rem] mb-[0.8rem] flex-wrap"
);

const HiddenFileInput = tw("input", "hidden");

function UploadStatus({
  variant,
  className,
  ...rest
}: {
  variant?: "error" | "success";
} & React.JSX.IntrinsicElements["div"]) {
  const base = `text-[0.85rem] font-bold text-[#050505] border-[1.5px] border-[#050505] ${
    variant === "error" ? "bg-[#ffd9d9]" : "bg-[#fff0e8]"
  } rounded-[10px] py-2 px-3 mb-[0.8rem]`;
  return <div {...rest} className={className ? `${base} ${className}` : base} />;
}

const PaywallNotice = tw(
  "div",
  "flex items-start gap-[0.8rem] py-4 px-[1.2rem] rounded-2xl border-2 border-[#050505] bg-white text-[#050505] mb-6 shadow-[4px_4px_0_rgba(5,5,5,0.9)]"
);

const PaywallText = tw("div", "flex flex-col gap-[0.3rem]");

const PaywallTitle = tw("div", "font-extrabold text-[1rem]");

const PaywallDescription = tw(
  "p",
  "m-0 text-[0.9rem] leading-[1.5] text-[rgba(5,5,5,0.72)]"
);

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
  const [savedVocabulary, setSavedVocabulary] = useState<SavedVocabularyItem[]>([]);
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
        const { data: articleRow } = await supabase
          .from("articles")
          .select("*")
          .eq("id", articleId)
          .maybeSingle();

        if (articleRow) {
          const data = articleFromRow(articleRow as Record<string, unknown>);
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
    const loadStats = async () => {
      const { data } = await supabase
        .from("article_discussion_stats")
        .select("topic_id, score, upvotes, downvotes")
        .eq("article_id", articleId);

      const nextStats: Record<string, DiscussionTopicStats> = {};
      (data ?? []).forEach((row: any) => {
        if (typeof row.topic_id !== "string") return;
        nextStats[row.topic_id] = {
          topicId: row.topic_id,
          score: typeof row.score === "number" ? row.score : 0,
          upvotes: typeof row.upvotes === "number" ? row.upvotes : 0,
          downvotes: typeof row.downvotes === "number" ? row.downvotes : 0,
        };
      });
      setDiscussionStats(nextStats);
    };

    loadStats().catch((e) => console.error("Error loading discussion stats:", e));
    const channel = supabase
      .channel(`discussion-stats-${articleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "article_discussion_stats",
          filter: `article_id=eq.${articleId}`,
        },
        () => {
          loadStats().catch((e) => console.error("Error refreshing stats:", e));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
        const { data: voteRows } = await supabase
          .from("article_discussion_votes")
          .select("topic_id, vote")
          .eq("article_id", articleId)
          .in(
            "topic_id",
            topicEntries.map((topic) => topic.id),
          );

        if (!isCurrent) return;

        const nextVotes: Record<string, TopicVoteValue> = {};
        (voteRows ?? []).forEach((row: any) => {
          if (row.vote === 1 || row.vote === -1) {
            nextVotes[row.topic_id] = row.vote;
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

  // Fetch the member's saved dictionary meanings when user changes. The old
  // users.saved_words string array is deliberately no longer part of this flow.
  useEffect(() => {
    const fetchSavedVocabulary = async () => {
      if (!currentUser) {
        setSavedVocabulary([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_vocabulary")
          .select("entry_id, meaning_id")
          .eq("user_id", currentUser.uid);
        if (error) throw error;
        setSavedVocabulary(
          (data || []).map((item: any) => ({
            entryId: item.entry_id,
            meaningId: item.meaning_id,
          }))
        );
      } catch (err) {
        console.error("Error fetching saved vocabulary:", err);
        setSavedVocabulary([]);
      }
    };

    fetchSavedVocabulary();
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  const fetchWordDetails = async (word: string): Promise<WordData | null> => {
    // Skip if already fetched or currently fetching
    if (wordDetails[word]) return wordDetails[word];
    if (wordLoading[word]) return null;

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
      const normalizedTerm = word.trim().replace(/\s+/g, " ").toLowerCase();
      const entrySelect =
        "id, term, dictionary_meanings(id, grammar_type, definition_en, definition_ko, usage_labels, synonyms, antonyms, pronunciation_ipa, example_en, example_ko, meaning_order)";
      const [{ data: directEntry, error: directEntryError }, { data: formRows, error: formError }] =
        await Promise.all([
          supabase
            .from("dictionary_entries")
            .select(entrySelect)
            .eq("language_code", "en")
            .eq("normalized_term", normalizedTerm)
            .maybeSingle(),
          supabase
            .from("dictionary_entry_forms")
            .select(`entry:dictionary_entries!inner(${entrySelect})`)
            .eq("language_code", "en")
            .eq("normalized_form", normalizedTerm)
            .limit(1),
        ]);
      if (directEntryError) throw directEntryError;
      if (formError) throw formError;

      const formEntry = (formRows?.[0] as any)?.entry;
      const entryRow = directEntry || (Array.isArray(formEntry) ? formEntry[0] : formEntry);

      if (!entryRow) return null;

      const meanings = ((entryRow as any).dictionary_meanings || [])
        .sort((left: any, right: any) => left.meaning_order - right.meaning_order) as DictionaryMeaning[];
      const mappedMeanings = meanings.length
        ? (
            await supabase
              .from("article_vocabulary")
              .select("meaning_id")
              .eq("article_id", articleId)
              .in("meaning_id", meanings.map((meaning) => meaning.id))
          )
        : { data: [], error: null };
      if (mappedMeanings.error) throw mappedMeanings.error;

      const mappedMeaningIds = new Set(
        (mappedMeanings.data || []).map((mapping: any) => mapping.meaning_id)
      );
      const selectedMeaning =
        meanings.find((meaning) => mappedMeaningIds.has(meaning.id)) || meanings[0] || null;
      const wordData: WordData = {
        entryId: (entryRow as any).id,
        selectedMeaningId: selectedMeaning?.id || null,
        meanings,
        categories: {
          english: [...new Set(meanings.map((meaning) => meaning.grammar_type).filter(Boolean))],
          korean: [],
        },
        definitions: {
          english: selectedMeaning?.definition_en || "",
          korean: selectedMeaning?.definition_ko || "",
        },
        examples: selectedMeaning?.example_en
          ? [{ english: [selectedMeaning.example_en], korean: [selectedMeaning.example_ko || ""] }]
          : [],
        synonyms: selectedMeaning?.synonyms || [],
        antonyms: selectedMeaning?.antonyms || [],
      };
      setWordDetails((prev) => ({ ...prev, [word]: wordData }));
      return wordData;
    } catch (err) {
      console.error(`Error fetching word "${word}":`, err);
      return null;
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
    setSelectedWordData(null);
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";

    const wordData = wordDetails[word] || (await fetchWordDetails(word));
    setSelectedWordData(wordData || null);
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

  // The reader never calls a third-party dictionary at runtime. Adapt the
  // shared Supabase dictionary to the modal's existing presentation shape.
  const fetchWordFromDictionary = async (word: string): Promise<any | null> => {
    const wordData = wordDetails[word] || (await fetchWordDetails(word));
    if (!wordData || !wordData.meanings.length) return null;

    const meaningsByGrammar = new Map<string, DictionaryMeaning[]>();
    wordData.meanings.forEach((meaning) => {
      const grammar = meaning.grammar_type || "unknown";
      meaningsByGrammar.set(grammar, [
        ...(meaningsByGrammar.get(grammar) || []),
        meaning,
      ]);
    });

    return [
      {
        phonetics: wordData.meanings
          .filter((meaning) => meaning.pronunciation_ipa)
          .slice(0, 1)
          .map((meaning) => ({ text: meaning.pronunciation_ipa })),
        meanings: [...meaningsByGrammar.entries()].map(([grammar, meanings]) => ({
          partOfSpeech: grammar,
          definitions: meanings.map((meaning) => ({
            definition: meaning.definition_en,
            example: meaning.example_en,
            synonyms: meaning.synonyms,
            antonyms: meaning.antonyms,
          })),
        })),
      },
    ];
  };

  const handleSaveWord = async (word: string) => {
    if (!currentUser || isSaving) return;

    setIsSaving(true);

    try {
      const wordData = wordDetails[word];
      if (!wordData) throw new Error("Dictionary entry is not loaded");
      const isSaved = savedVocabulary.some(
        (item) =>
          item.entryId === wordData.entryId &&
          item.meaningId === wordData.selectedMeaningId
      );
      const { error } = isSaved
        ? await supabase
            .from("user_vocabulary")
            .delete()
            .eq("user_id", currentUser.uid)
            .eq("entry_id", wordData.entryId)
            .eq("meaning_id", wordData.selectedMeaningId)
        : await supabase.rpc("save_vocabulary_term", {
            p_term: word,
            p_source_article_id: articleId,
            p_meaning_id: wordData.selectedMeaningId,
          });
      if (error) throw error;
      setSavedVocabulary((current) =>
        isSaved
          ? current.filter(
              (item) =>
                item.entryId !== wordData.entryId ||
                item.meaningId !== wordData.selectedMeaningId
            )
          : [
              ...current,
              {
                entryId: wordData.entryId,
                meaningId: wordData.selectedMeaningId,
              },
            ]
      );
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

    // Fetch shared dictionary data in parallel.
    try {
      const wiktionaryData = await fetchWordFromDictionary(selectedWord);
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

  // Open meaning modal from a target and point, fetching AI and dictionary data together.
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
        fetchWordFromDictionary(selectedWord),
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
      const existingTopicIds = article?.discussion_topic_ids || [];
      const discussionTopicIds = editedTopics.map(
        (_, index) => existingTopicIds[index] || "topic-" + index
      );
      const { error } = await supabase
        .from("articles")
        .update({
          discussion_topics: editedTopics,
          discussion_topic_ids: discussionTopicIds,
        })
        .eq("id", articleId);
      if (error) throw error;

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
      const result = await invokeFunction<DiscussionVoteResult>("discussion-vote", {
        articleId,
        topicId,
        vote: nextVote,
      });

      setTopicVotes((previous) => {
        const next = { ...previous };
        if (result.vote === 0) delete next[topicId];
        else next[topicId] = result.vote;
        return next;
      });
      setDiscussionStats((previous) => ({
        ...previous,
        [topicId]: {
          topicId,
          score: result.score,
          upvotes: result.upvotes,
          downvotes: result.downvotes,
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
      const { error } = await supabase
        .from("articles")
        .update({
          image_url: trimmedUrl,
        })
        .eq("id", articleId);
      if (error) throw error;

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
      const { error } = await supabase
        .from("articles")
        .update({
          title: {
            english: trimmedEnglish,
            korean: trimmedKorean,
          },
        })
        .eq("id", articleId);
      if (error) throw error;

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
      const { error } = await supabase
        .from("articles")
        .update({
          content: {
            english: englishContent,
            korean: koreanContent,
          },
        })
        .eq("id", articleId);
      if (error) throw error;

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
                      $active={visibleKoreanParagraphs.includes(index)}
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
                    savedVocabulary.some(
                      (item) =>
                        item.entryId === selectedWordData.entryId &&
                        item.meaningId === selectedWordData.selectedMeaningId
                    ) ? (
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
                {selectedWordData.meanings.length > 1 && (
                    <ModalSection>
                      <ModalSectionTitle>Wiktionary</ModalSectionTitle>
                      {selectedWordData.meanings
                        .slice(0, 3)
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
                              {meaning.grammar_type}
                            </div>

                            <ul
                                  style={{
                                    marginTop: "0.3rem",
                                    paddingLeft: "1.2rem",
                                    listStyleType: "disc",
                                    margin: "0 0 0.8rem 0",
                                  }}
                                >
                                      <li
                                        key={meaning.id}
                                        style={{
                                          marginBottom: "0.6rem",
                                          fontSize: "0.95rem",
                                          color: "#050505",
                                          lineHeight: "1.5",
                                        }}
                                      >
                                        {meaning.definition_en}
                                        {meaning.definition_ko && (
                                          <div
                                            style={{
                                              color: "rgba(5, 5, 5, 0.72)",
                                              marginTop: "0.3rem",
                                              fontSize: "0.9rem",
                                              lineHeight: "1.4",
                                            }}
                                          >
                                            {meaning.definition_ko}
                                          </div>
                                        )}
                                        {meaning.example_en && (
                                          <div
                                            style={{
                                              fontStyle: "italic",
                                              color: "rgba(5, 5, 5, 0.6)",
                                              marginTop: "0.3rem",
                                              fontSize: "0.9rem",
                                              lineHeight: "1.4",
                                            }}
                                          >
                                            e.g. "{meaning.example_en}"
                                          </div>
                                        )}
                                        {meaning.synonyms &&
                                          meaning.synonyms.length > 0 && (
                                            <div
                                              style={{
                                                fontSize: "0.85rem",
                                                color: "rgba(5, 5, 5, 0.72)",
                                                marginTop: "0.25rem",
                                                lineHeight: "1.4",
                                              }}
                                            >
                                              <strong>Synonyms:</strong>{" "}
                                              {meaning.synonyms.join(", ")}
                                            </div>
                                          )}
                                        {meaning.antonyms &&
                                          meaning.antonyms.length > 0 && (
                                            <div
                                              style={{
                                                fontSize: "0.85rem",
                                                color: "rgba(5, 5, 5, 0.72)",
                                                marginTop: "0.25rem",
                                                lineHeight: "1.4",
                                              }}
                                            >
                                              <strong>Antonyms:</strong>{" "}
                                              {meaning.antonyms.join(", ")}
                                            </div>
                                          )}
                                      </li>
                                </ul>
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
