"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import {
  BookOpenIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  FolderPlusIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase/client";
import { appLayout } from "../lib/constants/app_layout";

type LearningStatus = "saved" | "learning" | "learned";
type EntryType = "word" | "expression";
type FilterType = "all" | EntryType | "learned";
type TabType = "mine" | "dictionary" | "decks";
type DeckVisibility = "private" | "public";
type DeckTheme = "orange" | "blue" | "green" | "purple" | "pink";

type Meaning = {
  id: string;
  entry_id: string;
  grammar_type: string;
  definition_en: string;
  definition_ko: string | null;
  usage_labels: string[];
  pronunciation_ipa: string | null;
  source: string;
  source_license: string | null;
  meaning_order: number;
};

type VocabularyItem = {
  id: string;
  entryId: string;
  meaningId: string | null;
  term: string;
  normalizedTerm: string;
  entryType: EntryType;
  savedAt: string;
  learningStatus: LearningStatus;
  sourceArticleId: string | null;
  sourceArticleTitle: string | null;
  meaning: Meaning | null;
};

type DictionaryEntry = {
  id: string;
  term: string;
  normalizedTerm: string;
  entryType: EntryType;
  meanings: Meaning[];
};

type Deck = {
  id: string;
  ownerUserId: string | null;
  name: string;
  description: string;
  visibility: DeckVisibility;
  icon: string;
  theme: DeckTheme;
  isOfficial: boolean;
  itemCount: number;
  followerCount: number;
  updatedAt: string;
};

type DeckItem = {
  id: string;
  entryId: string;
  meaningId: string | null;
  term: string;
  entryType: EntryType;
  meaning: Meaning | null;
};

type AddTarget = {
  entryId: string;
  meaningId: string | null;
  term: string;
};

const copyByLocale = {
  ko: {
    eyebrow: "VOCABULARY",
    title: "단어장",
    subtitle: "내가 저장한 표현을 복습하고, 사전을 검색하고, 다른 사람의 공개 덱도 팔로우해 보세요.",
    createDeck: "새 덱 만들기",
    mineTab: "내 단어장",
    dictionaryTab: "사전 검색",
    decksTab: "공개 덱",
    savedCount: "저장한 표현",
    learningCount: "학습 중",
    learnedCount: "학습 완료",
    myDeckCount: "내 덱",
    myDecks: "내 덱",
    myDecksHint: "원하는 표현을 묶어 나만의 덱을 만들 수 있어요.",
    noDecks: "아직 만든 덱이 없습니다.",
    searchMine: "내 단어장 검색",
    all: "전체",
    words: "단어",
    expressions: "표현",
    learned: "학습 완료",
    empty: "아직 저장한 단어나 표현이 없습니다.",
    emptyHint: "아티클에서 단어를 저장하거나 사전 검색에서 새 표현을 추가해 보세요.",
    saved: "저장됨",
    learning: "학습 중",
    learnedStatus: "학습 완료",
    addToDeck: "덱에 추가",
    savedDate: "저장일",
    sourceArticle: "저장한 기사",
    meaningPending: "아직 정확한 뜻이 연결되지 않았습니다.",
    availableMeanings: "가능한 뜻",
    chooseMeaning: "이 뜻으로 선택",
    dictionaryTitle: "사전에서 찾아보기",
    dictionaryHint: "One Cup English 데이터베이스에 있는 단어와 표현을 검색할 수 있습니다.",
    dictionarySearch: "영어 단어 또는 표현 검색",
    dictionaryStart: "두 글자 이상 입력하면 검색을 시작합니다.",
    dictionaryEmpty: "일치하는 단어를 찾지 못했습니다.",
    saveToMine: "내 단어장에 저장",
    savedToMine: "저장됨",
    publicDecksTitle: "공개 덱 둘러보기",
    publicDecksHint: "다른 멤버와 One Cup English가 만든 공개 덱을 팔로우할 수 있습니다.",
    deckSearch: "공개 덱 검색",
    official: "공식",
    public: "공개",
    private: "비공개",
    follow: "팔로우",
    following: "팔로잉",
    followers: "팔로워",
    items: "개 표현",
    by: "만든 사람",
    officialBy: "1 Cup English",
    noPublicDecks: "조건에 맞는 공개 덱이 없습니다.",
    followedBadge: "팔로우 중",
    deckContents: "덱 구성",
    removeFromDeck: "덱에서 제거",
    makePublic: "공개로 전환",
    makePrivate: "비공개로 전환",
    createDeckTitle: "새 덱 만들기",
    deckName: "덱 이름",
    deckNamePlaceholder: "예: 회의에서 자주 쓰는 표현",
    deckDescription: "설명",
    deckDescriptionPlaceholder: "이 덱을 어떤 목적으로 만들었는지 적어주세요.",
    visibility: "공개 설정",
    publicDescription: "다른 멤버가 검색하고 팔로우할 수 있습니다.",
    privateDescription: "나만 볼 수 있습니다.",
    cancel: "취소",
    create: "만들기",
    addToDeckTitle: "어느 덱에 추가할까요?",
    createFirstDeck: "먼저 덱을 만들어 주세요.",
    added: "추가됨",
    close: "닫기",
    loading: "단어장을 불러오는 중...",
    loadError: "단어장을 불러오지 못했습니다. 다시 시도해 주세요.",
    updateError: "변경 사항을 저장하지 못했습니다.",
    createError: "덱을 만들지 못했습니다.",
    followError: "팔로우 상태를 변경하지 못했습니다.",
    retry: "다시 시도",
    noDefinition: "뜻 정보가 아직 준비되지 않았습니다.",
    attribution: "Wiktionary 기반 사전 데이터는 CC BY-SA 4.0 / GFDL 조건에 따라 사용됩니다.",
  },
  en: {
    eyebrow: "VOCABULARY",
    title: "Vocabulary",
    subtitle: "Review what you saved, search the dictionary, and follow useful public decks from other members.",
    createDeck: "Create deck",
    mineTab: "My vocabulary",
    dictionaryTab: "Dictionary",
    decksTab: "Public decks",
    savedCount: "Saved",
    learningCount: "Learning",
    learnedCount: "Learned",
    myDeckCount: "My decks",
    myDecks: "My decks",
    myDecksHint: "Group useful words and expressions into your own decks.",
    noDecks: "You have not created a deck yet.",
    searchMine: "Search my vocabulary",
    all: "All",
    words: "Words",
    expressions: "Expressions",
    learned: "Learned",
    empty: "You have not saved any vocabulary yet.",
    emptyHint: "Save a term from an article or add one from dictionary search.",
    saved: "Saved",
    learning: "Learning",
    learnedStatus: "Learned",
    addToDeck: "Add to deck",
    savedDate: "Saved",
    sourceArticle: "Saved from",
    meaningPending: "A specific meaning has not been linked yet.",
    availableMeanings: "Available meanings",
    chooseMeaning: "Use this meaning",
    dictionaryTitle: "Search the dictionary",
    dictionaryHint: "Search words and expressions already available in the One Cup English database.",
    dictionarySearch: "Search an English word or expression",
    dictionaryStart: "Enter at least two characters to start searching.",
    dictionaryEmpty: "No matching vocabulary found.",
    saveToMine: "Save to my vocabulary",
    savedToMine: "Saved",
    publicDecksTitle: "Explore public decks",
    publicDecksHint: "Follow public decks curated by members and One Cup English.",
    deckSearch: "Search public decks",
    official: "Official",
    public: "Public",
    private: "Private",
    follow: "Follow",
    following: "Following",
    followers: "followers",
    items: "items",
    by: "By",
    officialBy: "1 Cup English",
    noPublicDecks: "No public decks match your search.",
    followedBadge: "Following",
    deckContents: "Deck contents",
    removeFromDeck: "Remove",
    makePublic: "Make public",
    makePrivate: "Make private",
    createDeckTitle: "Create a new deck",
    deckName: "Deck name",
    deckNamePlaceholder: "e.g. Expressions for meetings",
    deckDescription: "Description",
    deckDescriptionPlaceholder: "What is this deck for?",
    visibility: "Visibility",
    publicDescription: "Other members can discover and follow it.",
    privateDescription: "Only you can see it.",
    cancel: "Cancel",
    create: "Create",
    addToDeckTitle: "Choose a deck",
    createFirstDeck: "Create a deck first.",
    added: "Added",
    close: "Close",
    loading: "Loading vocabulary...",
    loadError: "We could not load your vocabulary. Please try again.",
    updateError: "We could not save that change.",
    createError: "We could not create that deck.",
    followError: "We could not update the follow state.",
    retry: "Try again",
    noDefinition: "A definition is not available yet.",
    attribution: "Wiktionary-derived dictionary data is used under CC BY-SA 4.0 / GFDL.",
  },
} as const;

const themeBackground: Record<DeckTheme, string> = {
  orange: "#fff0e8",
  blue: "#eaf3ff",
  green: "#eaf8ef",
  purple: "#f3edff",
  pink: "#fff0f5",
};

const Page = styled.main`
  width: 100%;
  min-height: 100vh;
  background: #faf8f4;
  padding: 1.35rem ${appLayout.pageGutterDesktop} 4rem;

  @media (max-width: 768px) {
    padding: 0.8rem ${appLayout.pageGutterMobile} 3rem;
  }
`;

const Shell = styled.div`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
`;

const Hero = styled.section`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 0 1rem;

  @media (max-width: 640px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const Eyebrow = styled.div`
  display: inline-flex;
  padding: 0.28rem 0.65rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
`;

const Title = styled.h1`
  margin: 0.7rem 0 0.35rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.05;
  color: #050505;
  font-weight: 950;
`;

const Subtitle = styled.p`
  max-width: 620px;
  margin: 0;
  color: rgba(5, 5, 5, 0.64);
  font-size: 0.98rem;
  line-height: 1.55;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  min-height: 2.55rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.55rem 0.9rem;
  font-size: 0.84rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 3px 3px 0 #050505;
  transition: transform 0.16s ease, box-shadow 0.16s ease;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg { width: 17px; height: 17px; }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 0.45rem 0 1.15rem;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const StatCard = styled.div`
  border: 2px solid #050505;
  border-radius: 14px;
  background: #ffffff;
  padding: 0.85rem;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.9);
`;

const StatValue = styled.div`
  font-size: 1.45rem;
  font-weight: 950;
  color: #050505;
`;

const StatLabel = styled.div`
  margin-top: 0.12rem;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.74rem;
  font-weight: 800;
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding: 0.2rem 0 0.75rem;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 0 0 auto;
  border: 2px solid #050505;
  border-radius: 999px;
  background: ${(p) => (p.$active ? "#050505" : "#ffffff")};
  color: ${(p) => (p.$active ? "#ffffff" : "#050505")};
  padding: 0.5rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 900;
  cursor: pointer;
`;

const Section = styled.section`
  margin-top: 0.75rem;
`;

const SectionTop = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.7rem;
`;

const SectionTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1.2rem;
  font-weight: 950;
`;

const SectionHint = styled.p`
  margin: 0.15rem 0 0;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.8rem;
  line-height: 1.45;
`;

const DeckGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 760px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const DeckCard = styled.article<{ $theme: DeckTheme }>`
  min-height: 170px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 2px solid #050505;
  border-radius: 16px;
  background: ${(p) => themeBackground[p.$theme]};
  padding: 1rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.9);
  }
`;

const DeckIcon = styled.div`
  font-size: 1.65rem;
  line-height: 1;
`;

const DeckName = styled.h3`
  margin: 0.65rem 0 0.25rem;
  color: #050505;
  font-size: 1.05rem;
  font-weight: 950;
  line-height: 1.25;
`;

const DeckDescription = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.65);
  font-size: 0.78rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DeckMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.7rem;
  margin-top: 0.9rem;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.7rem;
  font-weight: 800;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0 0.48rem;
  color: #050505;
  font-size: 0.66rem;
  font-weight: 900;
  text-transform: capitalize;
`;

const SearchWrap = styled.label`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  background: #ffffff;
  border: 2px solid #050505;
  border-radius: 14px;
  padding: 0 0.9rem;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.9);

  svg { width: 20px; height: 20px; flex: 0 0 auto; }
`;

const SearchInput = styled.input`
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 0.85rem 0;
  font-size: 0.95rem;
  color: #050505;
`;

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin: 0.8rem 0 1rem;
`;

const FilterRow = styled.div`
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  align-items: center;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  border: 2px solid #050505;
  border-radius: 999px;
  background: ${(p) => (p.$active ? "#f47a4a" : "#ffffff")};
  color: #050505;
  padding: 0.43rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 850;
  cursor: pointer;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const WordCard = styled.article`
  background: #ffffff;
  border: 2px solid #050505;
  border-radius: 16px;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  padding: 1rem 1.05rem;
`;

const WordHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;

  @media (max-width: 600px) { flex-direction: column; }
`;

const Term = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 1.3rem;
  font-weight: 950;
  overflow-wrap: anywhere;
`;

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.4rem;
`;

const WordActions = styled.div`
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const SecondaryButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: ${(p) => (p.$active ? "#f47a4a" : "#ffffff")};
  color: #050505;
  padding: 0.42rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 900;
  cursor: pointer;

  &:disabled { opacity: 0.48; cursor: not-allowed; }
  svg { width: 14px; height: 14px; }
`;

const StatusSelect = styled.select`
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  padding: 0.42rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 850;
`;

const Definition = styled.p`
  margin: 0.8rem 0 0;
  color: #050505;
  font-size: 0.94rem;
  line-height: 1.55;
`;

const KoreanDefinition = styled.p`
  margin: 0.28rem 0 0;
  color: rgba(5, 5, 5, 0.64);
  font-size: 0.86rem;
  line-height: 1.5;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.9rem;
  margin-top: 0.75rem;
  padding-top: 0.7rem;
  border-top: 1px solid rgba(5, 5, 5, 0.14);
  color: rgba(5, 5, 5, 0.54);
  font-size: 0.7rem;
  font-weight: 750;

  a { color: #050505; font-weight: 850; text-decoration: underline; }
`;

const Pending = styled.div`
  margin-top: 0.75rem;
  border: 1.5px dashed #050505;
  border-radius: 12px;
  background: #fffaf6;
  padding: 0.75rem;
  color: rgba(5, 5, 5, 0.68);
  font-size: 0.8rem;
  line-height: 1.45;
`;

const Candidate = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  border-top: 1px solid rgba(5, 5, 5, 0.14);
  padding-top: 0.6rem;
  margin-top: 0.6rem;
`;

const StateBox = styled.div`
  margin-top: 0.8rem;
  padding: 2.2rem 1rem;
  border: 2px dashed #050505;
  border-radius: 16px;
  background: #ffffff;
  text-align: center;
  color: rgba(5, 5, 5, 0.62);

  svg { width: 34px; height: 34px; color: #050505; }
  strong { display: block; margin-top: 0.55rem; color: #050505; }
  p { margin: 0.3rem 0 0; line-height: 1.5; }
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  padding: 1rem;
`;

const Modal = styled.div`
  width: min(620px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  border: 2px solid #050505;
  border-radius: 18px;
  background: #faf8f4;
  padding: 1.1rem;
  box-shadow: 7px 7px 0 #050505;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1.25rem;
  font-weight: 950;
`;

const IconButton = styled.button`
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #050505;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  svg { width: 17px; height: 17px; }
`;

const Field = styled.label`
  display: block;
  margin-top: 0.8rem;
  color: #050505;
  font-size: 0.78rem;
  font-weight: 900;
`;

const Input = styled.input`
  width: 100%;
  margin-top: 0.35rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.75rem;
  color: #050505;
  font-size: 0.9rem;
  outline: none;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 90px;
  margin-top: 0.35rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.75rem;
  color: #050505;
  font-size: 0.9rem;
  resize: vertical;
  outline: none;
`;

const VisibilityChoice = styled.button<{ $active: boolean }>`
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: ${(p) => (p.$active ? "#fff0e8" : "#ffffff")};
  padding: 0.75rem;
  text-align: left;
  cursor: pointer;

  svg { width: 18px; height: 18px; flex: 0 0 auto; }
`;

const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 0.4rem;

  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  margin-top: 1rem;
`;

const DeckItemRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
  border-top: 1px solid rgba(5, 5, 5, 0.15);
  padding: 0.75rem 0;
`;

const OwnerLine = styled.div`
  margin-top: 0.45rem;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.75rem;
  font-weight: 750;
`;

const Attribution = styled.p`
  margin: 1.4rem 0 0;
  color: rgba(5, 5, 5, 0.48);
  font-size: 0.7rem;
  line-height: 1.45;
`;

const asSingleObject = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const mapMeaning = (value: unknown): Meaning | null => {
  const row = asSingleObject<any>(value as any);
  if (!row?.id) return null;
  return {
    id: String(row.id),
    entry_id: String(row.entry_id),
    grammar_type: String(row.grammar_type || "unknown"),
    definition_en: String(row.definition_en || ""),
    definition_ko: typeof row.definition_ko === "string" ? row.definition_ko : null,
    usage_labels: Array.isArray(row.usage_labels) ? row.usage_labels : [],
    pronunciation_ipa: typeof row.pronunciation_ipa === "string" ? row.pronunciation_ipa : null,
    source: String(row.source || ""),
    source_license: typeof row.source_license === "string" ? row.source_license : null,
    meaning_order: Number(row.meaning_order || 0),
  };
};

const mapDeck = (row: any): Deck => ({
  id: String(row.id),
  ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
  name: String(row.name || ""),
  description: String(row.description || ""),
  visibility: row.visibility === "public" ? "public" : "private",
  icon: String(row.icon || "📚"),
  theme: (["orange", "blue", "green", "purple", "pink"].includes(row.theme) ? row.theme : "orange") as DeckTheme,
  isOfficial: Boolean(row.is_official),
  itemCount: Number(row.item_count || 0),
  followerCount: Number(row.follower_count || 0),
  updatedAt: String(row.updated_at || row.created_at || ""),
});

export default function VocabularyClient() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { locale } = useI18n();
  const copy = copyByLocale[locale];

  const [activeTab, setActiveTab] = useState<TabType>("mine");
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [candidateMeanings, setCandidateMeanings] = useState<Record<string, Meaning[]>>({});
  const [ownDecks, setOwnDecks] = useState<Deck[]>([]);
  const [publicDecks, setPublicDecks] = useState<Deck[]>([]);
  const [followedDeckIds, setFollowedDeckIds] = useState<Set<string>>(new Set());
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [dictQuery, setDictQuery] = useState("");
  const [dictResults, setDictResults] = useState<DictionaryEntry[]>([]);
  const [dictLoading, setDictLoading] = useState(false);
  const [deckQuery, setDeckQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDescription, setNewDeckDescription] = useState("");
  const [newDeckVisibility, setNewDeckVisibility] = useState<DeckVisibility>("private");
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [addingDeckId, setAddingDeckId] = useState<string | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [selectedDeckItems, setSelectedDeckItems] = useState<DeckItem[]>([]);
  const [deckDetailLoading, setDeckDetailLoading] = useState(false);
  const [deckActionId, setDeckActionId] = useState<string | null>(null);

  const loadVocabulary = useCallback(async () => {
    if (!currentUser) return;
    const { data, error: loadError } = await supabase
      .from("user_vocabulary")
      .select(`
        id, entry_id, meaning_id, source_article_id, saved_at, learning_status,
        entry:dictionary_entries!user_vocabulary_entry_id_fkey(term, normalized_term, entry_type),
        meaning:dictionary_meanings!user_vocabulary_meaning_id_fkey(
          id, entry_id, grammar_type, definition_en, definition_ko,
          usage_labels, pronunciation_ipa, source, source_license, meaning_order
        ),
        article:articles!user_vocabulary_source_article_id_fkey(id, title)
      `)
      .eq("user_id", currentUser.uid)
      .order("saved_at", { ascending: false });

    if (loadError) throw loadError;

    const parsed: VocabularyItem[] = (data || []).flatMap((row: any) => {
      const entry = asSingleObject<any>(row.entry);
      if (!entry?.term) return [];
      const article = asSingleObject<any>(row.article);
      const title = article?.title && typeof article.title === "object" ? article.title : null;
      return [{
        id: String(row.id),
        entryId: String(row.entry_id),
        meaningId: row.meaning_id ? String(row.meaning_id) : null,
        term: String(entry.term),
        normalizedTerm: String(entry.normalized_term || entry.term).toLowerCase(),
        entryType: entry.entry_type === "expression" ? "expression" : "word",
        savedAt: String(row.saved_at),
        learningStatus: row.learning_status === "learning" || row.learning_status === "learned" ? row.learning_status : "saved",
        sourceArticleId: row.source_article_id ? String(row.source_article_id) : null,
        sourceArticleTitle: typeof title?.english === "string" ? title.english : typeof title?.korean === "string" ? title.korean : null,
        meaning: mapMeaning(row.meaning),
      }];
    });

    setItems(parsed);

    const unmatchedEntryIds = [...new Set(parsed.filter((item) => !item.meaningId).map((item) => item.entryId))];
    if (unmatchedEntryIds.length === 0) {
      setCandidateMeanings({});
      return;
    }

    const { data: meanings, error: meaningError } = await supabase
      .from("dictionary_meanings")
      .select("id,entry_id,grammar_type,definition_en,definition_ko,usage_labels,pronunciation_ipa,source,source_license,meaning_order")
      .in("entry_id", unmatchedEntryIds)
      .order("meaning_order", { ascending: true });
    if (meaningError) throw meaningError;

    const grouped: Record<string, Meaning[]> = {};
    (meanings || []).forEach((meaning: any) => {
      const mapped = mapMeaning(meaning);
      if (!mapped) return;
      if (!grouped[mapped.entry_id]) grouped[mapped.entry_id] = [];
      grouped[mapped.entry_id].push(mapped);
    });
    setCandidateMeanings(grouped);
  }, [currentUser]);

  const loadDecks = useCallback(async () => {
    if (!currentUser) return;
    const [ownResult, publicResult, followResult] = await Promise.all([
      supabase.from("vocabulary_decks").select("*").eq("owner_user_id", currentUser.uid).order("updated_at", { ascending: false }),
      supabase.from("vocabulary_decks").select("*").eq("visibility", "public").order("follower_count", { ascending: false }).order("updated_at", { ascending: false }).limit(60),
      supabase.from("vocabulary_deck_follows").select("deck_id").eq("user_id", currentUser.uid),
    ]);

    if (ownResult.error) throw ownResult.error;
    if (publicResult.error) throw publicResult.error;
    if (followResult.error) throw followResult.error;

    const nextOwn = (ownResult.data || []).map(mapDeck);
    const nextPublic = (publicResult.data || []).map(mapDeck);
    setOwnDecks(nextOwn);
    setPublicDecks(nextPublic);
    setFollowedDeckIds(new Set((followResult.data || []).map((row: any) => String(row.deck_id))));

    const ownerIds = [...new Set(nextPublic.map((deck) => deck.ownerUserId).filter((id): id is string => Boolean(id)))];
    if (ownerIds.length === 0) {
      setOwnerNames({});
      return;
    }

    const { data: owners } = await supabase
      .from("public_users")
      .select("uid,display_name")
      .in("uid", ownerIds);
    const names: Record<string, string> = {};
    (owners || []).forEach((row: any) => {
      names[String(row.uid)] = typeof row.display_name === "string" && row.display_name.trim() ? row.display_name : "Member";
    });
    setOwnerNames(names);
  }, [currentUser]);

  const loadAll = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadVocabulary(), loadDecks()]);
    } catch (loadFailure) {
      console.error("Unable to load vocabulary workspace:", loadFailure);
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, currentUser, loadDecks, loadVocabulary]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth?redirect=%2Fvocabulary");
      return;
    }
    void loadAll();
  }, [authLoading, currentUser, loadAll, router]);

  useEffect(() => {
    const normalized = dictQuery.trim().toLowerCase();
    if (normalized.length < 2 || activeTab !== "dictionary") {
      setDictResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setDictLoading(true);
      try {
        const { data: entries, error: entryError } = await supabase
          .from("dictionary_entries")
          .select("id,term,normalized_term,entry_type")
          .eq("language_code", "en")
          .ilike("normalized_term", `%${normalized}%`)
          .order("normalized_term", { ascending: true })
          .limit(24);
        if (entryError) throw entryError;

        const entryIds = (entries || []).map((entry: any) => String(entry.id));
        if (entryIds.length === 0) {
          setDictResults([]);
          return;
        }

        const { data: meanings, error: meaningError } = await supabase
          .from("dictionary_meanings")
          .select("id,entry_id,grammar_type,definition_en,definition_ko,usage_labels,pronunciation_ipa,source,source_license,meaning_order")
          .in("entry_id", entryIds)
          .order("meaning_order", { ascending: true });
        if (meaningError) throw meaningError;

        const byEntry: Record<string, Meaning[]> = {};
        (meanings || []).forEach((row: any) => {
          const meaning = mapMeaning(row);
          if (!meaning) return;
          if (!byEntry[meaning.entry_id]) byEntry[meaning.entry_id] = [];
          byEntry[meaning.entry_id].push(meaning);
        });

        setDictResults((entries || []).map((entry: any) => ({
          id: String(entry.id),
          term: String(entry.term),
          normalizedTerm: String(entry.normalized_term),
          entryType: entry.entry_type === "expression" ? "expression" : "word",
          meanings: byEntry[String(entry.id)] || [],
        })));
      } catch (searchError) {
        console.error("Dictionary search failed:", searchError);
        setDictResults([]);
      } finally {
        setDictLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activeTab, dictQuery]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "word" && item.entryType !== "word") return false;
      if (filter === "expression" && item.entryType !== "expression") return false;
      if (filter === "learned" && item.learningStatus !== "learned") return false;
      if (!normalizedQuery) return true;
      return item.normalizedTerm.includes(normalizedQuery)
        || item.meaning?.definition_en?.toLowerCase().includes(normalizedQuery)
        || item.meaning?.definition_ko?.includes(query.trim());
    });
  }, [filter, items, query]);

  const filteredPublicDecks = useMemo(() => {
    const q = deckQuery.trim().toLowerCase();
    const decks = [...publicDecks].sort((a, b) => {
      const followedDelta = Number(followedDeckIds.has(b.id)) - Number(followedDeckIds.has(a.id));
      return followedDelta || b.followerCount - a.followerCount;
    });
    if (!q) return decks;
    return decks.filter((deck) => deck.name.toLowerCase().includes(q) || deck.description.toLowerCase().includes(q));
  }, [deckQuery, followedDeckIds, publicDecks]);

  const learningCount = items.filter((item) => item.learningStatus === "learning").length;
  const learnedCount = items.filter((item) => item.learningStatus === "learned").length;
  const savedEntryIds = useMemo(() => new Set(items.map((item) => item.entryId)), [items]);

  const updateStatus = async (item: VocabularyItem, status: LearningStatus) => {
    setUpdatingId(item.id);
    try {
      const { error: updateError } = await supabase
        .from("user_vocabulary")
        .update({ learning_status: status, last_reviewed_at: status === "learned" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (updateError) throw updateError;
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, learningStatus: status } : row));
    } catch (updateFailure) {
      console.error(updateFailure);
      window.alert(copy.updateError);
    } finally {
      setUpdatingId(null);
    }
  };

  const chooseMeaning = async (item: VocabularyItem, meaning: Meaning) => {
    setUpdatingId(item.id);
    try {
      const { error: updateError } = await supabase.from("user_vocabulary").update({ meaning_id: meaning.id, updated_at: new Date().toISOString() }).eq("id", item.id);
      if (updateError) throw updateError;
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, meaningId: meaning.id, meaning } : row));
    } catch (updateFailure) {
      console.error(updateFailure);
      window.alert(copy.updateError);
    } finally {
      setUpdatingId(null);
    }
  };

  const saveDictionaryEntry = async (entry: DictionaryEntry) => {
    if (!currentUser) return;
    setUpdatingId(`dict-${entry.id}`);
    try {
      const preferredMeaning = entry.meanings[0] || null;
      const { error: saveError } = await supabase.rpc("save_vocabulary_term", {
        p_term: entry.term,
        p_source_article_id: null,
        p_meaning_id: preferredMeaning?.id || null,
      });
      if (saveError) throw saveError;
      await loadVocabulary();
    } catch (saveError) {
      console.error(saveError);
      window.alert(copy.updateError);
    } finally {
      setUpdatingId(null);
    }
  };

  const createDeck = async () => {
    if (!currentUser || !newDeckName.trim()) return;
    setCreatingDeck(true);
    try {
      const { error: createError } = await supabase.from("vocabulary_decks").insert({
        owner_user_id: currentUser.uid,
        name: newDeckName.trim(),
        description: newDeckDescription.trim(),
        visibility: newDeckVisibility,
        icon: "📚",
        theme: "orange",
        is_official: false,
      });
      if (createError) throw createError;
      setCreateOpen(false);
      setNewDeckName("");
      setNewDeckDescription("");
      setNewDeckVisibility("private");
      await loadDecks();
    } catch (createError) {
      console.error(createError);
      window.alert(copy.createError);
    } finally {
      setCreatingDeck(false);
    }
  };

  const toggleFollow = async (deck: Deck) => {
    if (!currentUser || deck.ownerUserId === currentUser.uid) return;
    setDeckActionId(deck.id);
    const isFollowing = followedDeckIds.has(deck.id);
    try {
      if (isFollowing) {
        const { error: followError } = await supabase.from("vocabulary_deck_follows").delete().eq("deck_id", deck.id).eq("user_id", currentUser.uid);
        if (followError) throw followError;
      } else {
        const { error: followError } = await supabase.from("vocabulary_deck_follows").insert({ deck_id: deck.id, user_id: currentUser.uid });
        if (followError) throw followError;
      }
      setFollowedDeckIds((current) => {
        const next = new Set(current);
        if (isFollowing) next.delete(deck.id); else next.add(deck.id);
        return next;
      });
      setPublicDecks((current) => current.map((row) => row.id === deck.id ? { ...row, followerCount: Math.max(0, row.followerCount + (isFollowing ? -1 : 1)) } : row));
      if (selectedDeck?.id === deck.id) {
        setSelectedDeck((current) => current ? { ...current, followerCount: Math.max(0, current.followerCount + (isFollowing ? -1 : 1)) } : current);
      }
    } catch (followError) {
      console.error(followError);
      window.alert(copy.followError);
    } finally {
      setDeckActionId(null);
    }
  };

  const addToDeck = async (deck: Deck) => {
    if (!addTarget) return;
    setAddingDeckId(deck.id);
    try {
      const { error: addError } = await supabase.from("vocabulary_deck_items").insert({
        deck_id: deck.id,
        entry_id: addTarget.entryId,
        meaning_id: addTarget.meaningId,
      });
      if (addError && addError.code !== "23505") throw addError;
      await loadDecks();
    } catch (addError) {
      console.error(addError);
      window.alert(copy.updateError);
    } finally {
      setAddingDeckId(null);
    }
  };

  const openDeck = async (deck: Deck) => {
    setSelectedDeck(deck);
    setDeckDetailLoading(true);
    try {
      const { data, error: detailError } = await supabase
        .from("vocabulary_deck_items")
        .select(`
          id, entry_id, meaning_id,
          entry:dictionary_entries!vocabulary_deck_items_entry_id_fkey(term,entry_type),
          meaning:dictionary_meanings!vocabulary_deck_items_meaning_id_fkey(
            id,entry_id,grammar_type,definition_en,definition_ko,usage_labels,pronunciation_ipa,source,source_license,meaning_order
          )
        `)
        .eq("deck_id", deck.id)
        .order("position", { ascending: true, nullsFirst: false })
        .order("added_at", { ascending: true });
      if (detailError) throw detailError;
      setSelectedDeckItems((data || []).flatMap((row: any) => {
        const entry = asSingleObject<any>(row.entry);
        if (!entry?.term) return [];
        return [{
          id: String(row.id),
          entryId: String(row.entry_id),
          meaningId: row.meaning_id ? String(row.meaning_id) : null,
          term: String(entry.term),
          entryType: entry.entry_type === "expression" ? "expression" : "word",
          meaning: mapMeaning(row.meaning),
        }];
      }));
    } catch (detailError) {
      console.error(detailError);
      setSelectedDeckItems([]);
    } finally {
      setDeckDetailLoading(false);
    }
  };

  const removeDeckItem = async (item: DeckItem) => {
    if (!selectedDeck) return;
    setUpdatingId(`deck-item-${item.id}`);
    try {
      const { error: removeError } = await supabase.from("vocabulary_deck_items").delete().eq("id", item.id);
      if (removeError) throw removeError;
      setSelectedDeckItems((current) => current.filter((row) => row.id !== item.id));
      setSelectedDeck((current) => current ? { ...current, itemCount: Math.max(0, current.itemCount - 1) } : current);
      await loadDecks();
    } catch (removeError) {
      console.error(removeError);
      window.alert(copy.updateError);
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleDeckVisibility = async (deck: Deck) => {
    if (!currentUser || deck.ownerUserId !== currentUser.uid) return;
    setDeckActionId(deck.id);
    const nextVisibility: DeckVisibility = deck.visibility === "public" ? "private" : "public";
    try {
      const { error: visibilityError } = await supabase.from("vocabulary_decks").update({ visibility: nextVisibility, updated_at: new Date().toISOString() }).eq("id", deck.id);
      if (visibilityError) throw visibilityError;
      setSelectedDeck((current) => current ? { ...current, visibility: nextVisibility, followerCount: nextVisibility === "private" ? 0 : current.followerCount } : current);
      await loadDecks();
    } catch (visibilityError) {
      console.error(visibilityError);
      window.alert(copy.updateError);
    } finally {
      setDeckActionId(null);
    }
  };

  const ownerLabel = (deck: Deck) => deck.isOfficial ? copy.officialBy : deck.ownerUserId ? ownerNames[deck.ownerUserId] || "Member" : copy.officialBy;

  const renderDeckCard = (deck: Deck, own: boolean) => (
    <DeckCard key={deck.id} $theme={deck.theme} onClick={() => void openDeck(deck)}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <DeckIcon>{deck.icon}</DeckIcon>
          <Badges style={{ marginTop: 0 }}>
            {deck.isOfficial && <Badge>{copy.official}</Badge>}
            {followedDeckIds.has(deck.id) && !own && <Badge>{copy.followedBadge}</Badge>}
            <Badge>{deck.visibility === "public" ? copy.public : copy.private}</Badge>
          </Badges>
        </div>
        <DeckName>{deck.name}</DeckName>
        <DeckDescription>{deck.description}</DeckDescription>
        {!own && <OwnerLine>{copy.by}: {ownerLabel(deck)}</OwnerLine>}
      </div>
      <DeckMeta>
        <span>{deck.itemCount} {copy.items}</span>
        <span>{deck.followerCount} {copy.followers}</span>
      </DeckMeta>
    </DeckCard>
  );

  if (authLoading || loading) {
    return <Page><Shell><StateBox>{copy.loading}</StateBox></Shell></Page>;
  }

  if (error) {
    return <Page><Shell><StateBox><strong>{error}</strong><PrimaryButton style={{ marginTop: "0.8rem" }} onClick={() => void loadAll()}>{copy.retry}</PrimaryButton></StateBox></Shell></Page>;
  }

  return (
    <Page>
      <Shell>
        <Hero>
          <div>
            <Eyebrow>{copy.eyebrow}</Eyebrow>
            <Title>{copy.title}</Title>
            <Subtitle>{copy.subtitle}</Subtitle>
          </div>
          <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
            <FolderPlusIcon />
            {copy.createDeck}
          </PrimaryButton>
        </Hero>

        <StatsGrid>
          <StatCard><StatValue>{items.length}</StatValue><StatLabel>{copy.savedCount}</StatLabel></StatCard>
          <StatCard><StatValue>{learningCount}</StatValue><StatLabel>{copy.learningCount}</StatLabel></StatCard>
          <StatCard><StatValue>{learnedCount}</StatValue><StatLabel>{copy.learnedCount}</StatLabel></StatCard>
          <StatCard><StatValue>{ownDecks.length}</StatValue><StatLabel>{copy.myDeckCount}</StatLabel></StatCard>
        </StatsGrid>

        <Tabs>
          <Tab $active={activeTab === "mine"} onClick={() => setActiveTab("mine")}>{copy.mineTab}</Tab>
          <Tab $active={activeTab === "dictionary"} onClick={() => setActiveTab("dictionary")}>{copy.dictionaryTab}</Tab>
          <Tab $active={activeTab === "decks"} onClick={() => setActiveTab("decks")}>{copy.decksTab}</Tab>
        </Tabs>

        {activeTab === "mine" && (
          <>
            <Section>
              <SectionTop>
                <div><SectionTitle>{copy.myDecks}</SectionTitle><SectionHint>{copy.myDecksHint}</SectionHint></div>
              </SectionTop>
              {ownDecks.length > 0 ? <DeckGrid>{ownDecks.map((deck) => renderDeckCard(deck, true))}</DeckGrid> : <StateBox><BookOpenIcon /><strong>{copy.noDecks}</strong></StateBox>}
            </Section>

            <Section style={{ marginTop: "1.4rem" }}>
              <Toolbar>
                <SearchWrap><MagnifyingGlassIcon /><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchMine} /></SearchWrap>
                <FilterRow>
                  <FilterButton $active={filter === "all"} onClick={() => setFilter("all")}>{copy.all}</FilterButton>
                  <FilterButton $active={filter === "word"} onClick={() => setFilter("word")}>{copy.words}</FilterButton>
                  <FilterButton $active={filter === "expression"} onClick={() => setFilter("expression")}>{copy.expressions}</FilterButton>
                  <FilterButton $active={filter === "learned"} onClick={() => setFilter("learned")}>{copy.learned}</FilterButton>
                </FilterRow>
              </Toolbar>

              {filteredItems.length === 0 ? (
                <StateBox><BookOpenIcon /><strong>{copy.empty}</strong><p>{copy.emptyHint}</p></StateBox>
              ) : (
                <List>
                  {filteredItems.map((item) => {
                    const candidates = candidateMeanings[item.entryId] || [];
                    return (
                      <WordCard key={item.id}>
                        <WordHeader>
                          <div>
                            <Term>{item.term}</Term>
                            <Badges>
                              <Badge>{item.entryType === "expression" ? copy.expressions : copy.words}</Badge>
                              {item.meaning?.grammar_type && <Badge>{item.meaning.grammar_type}</Badge>}
                              {item.meaning?.pronunciation_ipa && <Badge>{item.meaning.pronunciation_ipa}</Badge>}
                            </Badges>
                          </div>
                          <WordActions>
                            <SecondaryButton onClick={() => setAddTarget({ entryId: item.entryId, meaningId: item.meaningId, term: item.term })}><PlusIcon />{copy.addToDeck}</SecondaryButton>
                            <StatusSelect value={item.learningStatus} disabled={updatingId === item.id} onChange={(event) => void updateStatus(item, event.target.value as LearningStatus)}>
                              <option value="saved">{copy.saved}</option>
                              <option value="learning">{copy.learning}</option>
                              <option value="learned">{copy.learnedStatus}</option>
                            </StatusSelect>
                          </WordActions>
                        </WordHeader>
                        {item.meaning ? (
                          <><Definition>{item.meaning.definition_en || copy.noDefinition}</Definition>{item.meaning.definition_ko && <KoreanDefinition>{item.meaning.definition_ko}</KoreanDefinition>}</>
                        ) : (
                          <Pending>
                            {copy.meaningPending}
                            {candidates.length > 0 && <div><strong>{copy.availableMeanings}</strong>{candidates.slice(0, 3).map((meaning) => <Candidate key={meaning.id}><div><Badge>{meaning.grammar_type}</Badge><Definition>{meaning.definition_en}</Definition>{meaning.definition_ko && <KoreanDefinition>{meaning.definition_ko}</KoreanDefinition>}</div><SecondaryButton disabled={updatingId === item.id} onClick={() => void chooseMeaning(item, meaning)}><CheckIcon />{copy.chooseMeaning}</SecondaryButton></Candidate>)}</div>}
                          </Pending>
                        )}
                        <Meta>
                          <span>{copy.savedDate}: {new Date(item.savedAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US")}</span>
                          {item.sourceArticleId && item.sourceArticleTitle && <span>{copy.sourceArticle}: <Link href={`/article/${item.sourceArticleId}`}>{item.sourceArticleTitle}</Link></span>}
                        </Meta>
                      </WordCard>
                    );
                  })}
                </List>
              )}
            </Section>
          </>
        )}

        {activeTab === "dictionary" && (
          <Section>
            <SectionTop><div><SectionTitle>{copy.dictionaryTitle}</SectionTitle><SectionHint>{copy.dictionaryHint}</SectionHint></div></SectionTop>
            <SearchWrap><MagnifyingGlassIcon /><SearchInput value={dictQuery} onChange={(event) => setDictQuery(event.target.value)} placeholder={copy.dictionarySearch} autoFocus /></SearchWrap>
            {dictQuery.trim().length < 2 ? <StateBox><MagnifyingGlassIcon /><strong>{copy.dictionaryStart}</strong></StateBox> : dictLoading ? <StateBox>{copy.loading}</StateBox> : dictResults.length === 0 ? <StateBox><strong>{copy.dictionaryEmpty}</strong></StateBox> : (
              <List style={{ marginTop: "0.9rem" }}>
                {dictResults.map((entry) => {
                  const firstMeaning = entry.meanings[0] || null;
                  const isSaved = savedEntryIds.has(entry.id);
                  return (
                    <WordCard key={entry.id}>
                      <WordHeader>
                        <div>
                          <Term>{entry.term}</Term>
                          <Badges><Badge>{entry.entryType === "expression" ? copy.expressions : copy.words}</Badge>{firstMeaning?.grammar_type && <Badge>{firstMeaning.grammar_type}</Badge>}{firstMeaning?.pronunciation_ipa && <Badge>{firstMeaning.pronunciation_ipa}</Badge>}</Badges>
                        </div>
                        <WordActions>
                          <SecondaryButton disabled={isSaved || updatingId === `dict-${entry.id}`} $active={isSaved} onClick={() => void saveDictionaryEntry(entry)}>{isSaved ? <CheckIcon /> : <PlusIcon />}{isSaved ? copy.savedToMine : copy.saveToMine}</SecondaryButton>
                          <SecondaryButton onClick={() => setAddTarget({ entryId: entry.id, meaningId: firstMeaning?.id || null, term: entry.term })}><PlusIcon />{copy.addToDeck}</SecondaryButton>
                        </WordActions>
                      </WordHeader>
                      {firstMeaning ? <><Definition>{firstMeaning.definition_en}</Definition>{firstMeaning.definition_ko && <KoreanDefinition>{firstMeaning.definition_ko}</KoreanDefinition>}{entry.meanings.length > 1 && <Meta><span>+{entry.meanings.length - 1} more meanings</span></Meta>}</> : <Pending>{copy.noDefinition}</Pending>}
                    </WordCard>
                  );
                })}
              </List>
            )}
          </Section>
        )}

        {activeTab === "decks" && (
          <Section>
            <SectionTop><div><SectionTitle>{copy.publicDecksTitle}</SectionTitle><SectionHint>{copy.publicDecksHint}</SectionHint></div></SectionTop>
            <SearchWrap><MagnifyingGlassIcon /><SearchInput value={deckQuery} onChange={(event) => setDeckQuery(event.target.value)} placeholder={copy.deckSearch} /></SearchWrap>
            {filteredPublicDecks.length > 0 ? <DeckGrid style={{ marginTop: "0.9rem" }}>{filteredPublicDecks.map((deck) => renderDeckCard(deck, deck.ownerUserId === currentUser?.uid))}</DeckGrid> : <StateBox><UserGroupIcon /><strong>{copy.noPublicDecks}</strong></StateBox>}
          </Section>
        )}

        <Attribution>{copy.attribution}</Attribution>
      </Shell>

      {createOpen && (
        <ModalBackdrop onClick={() => !creatingDeck && setCreateOpen(false)}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <ModalHeader><ModalTitle>{copy.createDeckTitle}</ModalTitle><IconButton onClick={() => setCreateOpen(false)}><XMarkIcon /></IconButton></ModalHeader>
            <Field>{copy.deckName}<Input value={newDeckName} onChange={(event) => setNewDeckName(event.target.value)} maxLength={80} placeholder={copy.deckNamePlaceholder} autoFocus /></Field>
            <Field>{copy.deckDescription}<Textarea value={newDeckDescription} onChange={(event) => setNewDeckDescription(event.target.value)} maxLength={500} placeholder={copy.deckDescriptionPlaceholder} /></Field>
            <Field>{copy.visibility}</Field>
            <ChoiceGrid>
              <VisibilityChoice type="button" $active={newDeckVisibility === "private"} onClick={() => setNewDeckVisibility("private")}><EyeSlashIcon /><div><strong>{copy.private}</strong><SectionHint>{copy.privateDescription}</SectionHint></div></VisibilityChoice>
              <VisibilityChoice type="button" $active={newDeckVisibility === "public"} onClick={() => setNewDeckVisibility("public")}><EyeIcon /><div><strong>{copy.public}</strong><SectionHint>{copy.publicDescription}</SectionHint></div></VisibilityChoice>
            </ChoiceGrid>
            <ModalActions><SecondaryButton onClick={() => setCreateOpen(false)}>{copy.cancel}</SecondaryButton><PrimaryButton disabled={creatingDeck || !newDeckName.trim()} onClick={() => void createDeck()}><PlusIcon />{copy.create}</PrimaryButton></ModalActions>
          </Modal>
        </ModalBackdrop>
      )}

      {addTarget && (
        <ModalBackdrop onClick={() => setAddTarget(null)}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <ModalHeader><div><ModalTitle>{copy.addToDeckTitle}</ModalTitle><SectionHint>{addTarget.term}</SectionHint></div><IconButton onClick={() => setAddTarget(null)}><XMarkIcon /></IconButton></ModalHeader>
            {ownDecks.length === 0 ? <StateBox><strong>{copy.createFirstDeck}</strong><PrimaryButton style={{ marginTop: "0.7rem" }} onClick={() => { setAddTarget(null); setCreateOpen(true); }}>{copy.createDeck}</PrimaryButton></StateBox> : <DeckGrid>{ownDecks.map((deck) => <DeckCard key={deck.id} $theme={deck.theme} onClick={() => void addToDeck(deck)}><div><DeckIcon>{deck.icon}</DeckIcon><DeckName>{deck.name}</DeckName><DeckDescription>{deck.description}</DeckDescription></div><DeckMeta><span>{addingDeckId === deck.id ? copy.added : `${deck.itemCount} ${copy.items}`}</span></DeckMeta></DeckCard>)}</DeckGrid>}
            <ModalActions><SecondaryButton onClick={() => setAddTarget(null)}>{copy.close}</SecondaryButton></ModalActions>
          </Modal>
        </ModalBackdrop>
      )}

      {selectedDeck && (
        <ModalBackdrop onClick={() => setSelectedDeck(null)}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><DeckIcon>{selectedDeck.icon}</DeckIcon><ModalTitle>{selectedDeck.name}</ModalTitle></div>
                <SectionHint>{selectedDeck.description}</SectionHint>
                <Badges>{selectedDeck.isOfficial && <Badge>{copy.official}</Badge>}<Badge>{selectedDeck.visibility === "public" ? copy.public : copy.private}</Badge><Badge>{selectedDeck.itemCount} {copy.items}</Badge><Badge>{selectedDeck.followerCount} {copy.followers}</Badge></Badges>
              </div>
              <IconButton onClick={() => setSelectedDeck(null)}><XMarkIcon /></IconButton>
            </ModalHeader>

            <WordActions style={{ justifyContent: "flex-start", marginBottom: "0.65rem" }}>
              {selectedDeck.ownerUserId === currentUser?.uid ? (
                <SecondaryButton disabled={deckActionId === selectedDeck.id} onClick={() => void toggleDeckVisibility(selectedDeck)}>{selectedDeck.visibility === "public" ? <EyeSlashIcon /> : <EyeIcon />}{selectedDeck.visibility === "public" ? copy.makePrivate : copy.makePublic}</SecondaryButton>
              ) : (
                <SecondaryButton $active={followedDeckIds.has(selectedDeck.id)} disabled={deckActionId === selectedDeck.id} onClick={() => void toggleFollow(selectedDeck)}>{followedDeckIds.has(selectedDeck.id) ? <CheckIcon /> : <PlusIcon />}{followedDeckIds.has(selectedDeck.id) ? copy.following : copy.follow}</SecondaryButton>
              )}
            </WordActions>

            <SectionTitle style={{ fontSize: "1rem", marginTop: "0.8rem" }}>{copy.deckContents}</SectionTitle>
            {deckDetailLoading ? <StateBox>{copy.loading}</StateBox> : selectedDeckItems.length === 0 ? <StateBox><strong>{copy.empty}</strong></StateBox> : (
              <div>
                {selectedDeckItems.map((item) => (
                  <DeckItemRow key={item.id}>
                    <div>
                      <Term style={{ fontSize: "1rem" }}>{item.term}</Term>
                      <Badges><Badge>{item.entryType === "expression" ? copy.expressions : copy.words}</Badge>{item.meaning?.grammar_type && <Badge>{item.meaning.grammar_type}</Badge>}</Badges>
                      {item.meaning?.definition_en && <Definition style={{ marginTop: "0.45rem" }}>{item.meaning.definition_en}</Definition>}
                      {item.meaning?.definition_ko && <KoreanDefinition>{item.meaning.definition_ko}</KoreanDefinition>}
                    </div>
                    {selectedDeck.ownerUserId === currentUser?.uid && <SecondaryButton disabled={updatingId === `deck-item-${item.id}`} onClick={() => void removeDeckItem(item)}>{copy.removeFromDeck}</SecondaryButton>}
                  </DeckItemRow>
                ))}
              </div>
            )}
          </Modal>
        </ModalBackdrop>
      )}
    </Page>
  );
}
