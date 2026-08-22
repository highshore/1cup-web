"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";

import { appLayout } from "../../../lib/constants/app_layout";
import { useAuth } from "../../../lib/contexts/auth_context";
import { useI18n } from "../../../lib/i18n/I18nProvider";
import { supabase } from "../../../lib/supabase/client";

type EntryType = "word" | "expression";
type DeckVisibility = "private" | "public";
type DeckTheme = "orange" | "blue" | "green" | "purple" | "pink";

type Meaning = {
  id: string;
  entryId: string;
  grammarType: string;
  definitionEn: string;
  definitionKo: string | null;
  pronunciationIpa: string | null;
  usageLabels: string[];
  meaningOrder: number;
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
};

type DeckItem = {
  id: string;
  entryId: string;
  meaningId: string | null;
  term: string;
  entryType: EntryType;
  meaning: Meaning | null;
};

type DictionaryEntry = {
  id: string;
  term: string;
  normalizedTerm: string;
  entryType: EntryType;
  meanings: Meaning[];
};

const copyByLocale = {
  ko: {
    back: "단어장으로",
    official: "공식",
    public: "공개",
    private: "비공개",
    following: "팔로우 중",
    follow: "팔로우",
    unfollow: "팔로우 해제",
    study: "이 모음집 학습하기",
    total: "전체 표현",
    words: "단어",
    expressions: "표현",
    followers: "팔로워",
    by: "만든 사람",
    officialBy: "1 Cup English",
    yourCollection: "내 모음집",
    contents: "모음집 구성",
    contentsHint: "이 모음집에 들어 있는 단어와 표현입니다.",
    noItems: "아직 이 모음집에 표현이 없습니다.",
    noDefinition: "뜻 정보가 아직 준비되지 않았습니다.",
    remove: "제거",
    addTitle: "표현 추가",
    addHint: "Wiktionary 기반 글로벌 사전에서 단어나 표현을 검색하고 원하는 뜻을 추가하세요.",
    search: "영어 단어 또는 표현 검색",
    searchStart: "두 글자 이상 입력하면 검색을 시작합니다.",
    searchEmpty: "일치하는 표현을 찾지 못했습니다.",
    add: "추가",
    added: "추가됨",
    makePublic: "공개로 전환",
    makePrivate: "비공개로 전환",
    loading: "모음집을 불러오는 중...",
    loadError: "모음집을 불러오지 못했습니다.",
    updateError: "변경 사항을 저장하지 못했습니다.",
    followError: "팔로우 상태를 변경하지 못했습니다.",
    retry: "다시 시도",
    pronunciation: "발음",
  },
  en: {
    back: "Back to vocabulary",
    official: "Official",
    public: "Public",
    private: "Private",
    following: "Following",
    follow: "Follow",
    unfollow: "Unfollow",
    study: "Study this deck",
    total: "Total items",
    words: "Words",
    expressions: "Expressions",
    followers: "Followers",
    by: "By",
    officialBy: "1 Cup English",
    yourCollection: "Your deck",
    contents: "Deck contents",
    contentsHint: "Words and expressions currently included in this deck.",
    noItems: "There are no items in this deck yet.",
    noDefinition: "A definition is not available yet.",
    remove: "Remove",
    addTitle: "Add vocabulary",
    addHint: "Search the global Wiktionary-based dictionary and add the exact meaning you want.",
    search: "Search an English word or expression",
    searchStart: "Enter at least two characters to start searching.",
    searchEmpty: "No matching vocabulary found.",
    add: "Add",
    added: "Added",
    makePublic: "Make public",
    makePrivate: "Make private",
    loading: "Loading deck...",
    loadError: "We could not load this deck.",
    updateError: "We could not save that change.",
    followError: "We could not update the follow state.",
    retry: "Try again",
    pronunciation: "Pronunciation",
  },
} as const;

const Page = styled.main`
  width: 100%;
  min-height: 100vh;
  background: transparent;
  padding: 1rem ${appLayout.pageGutterDesktop} 4rem;

  @media (max-width: 768px) {
    padding: 0.75rem ${appLayout.pageGutterMobile} 3rem;
  }
`;

const Shell = styled.div`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #050505;
  font-size: 0.82rem;
  font-weight: 850;
  text-decoration: none;
  svg { width: 17px; height: 17px; }
`;

const DeckHeader = styled.section`
  margin-top: 0.8rem;
  border: 2px solid #050505;
  border-radius: 18px;
  background: #ffffff;
  padding: 1.15rem;
  box-shadow: 4px 4px 0 #050505;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const IdentityRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
`;

const DeckIcon = styled.div`
  font-size: 2rem;
  line-height: 1;
`;

const DeckName = styled.h1`
  margin: 0;
  color: #050505;
  font-size: clamp(1.65rem, 5vw, 2.35rem);
  line-height: 1.1;
  font-weight: 950;
`;

const Description = styled.p`
  max-width: 700px;
  margin: 0.45rem 0 0;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.9rem;
  line-height: 1.55;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.65rem;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.3rem 0.5rem;
  color: #050505;
  font-size: 0.66rem;
  font-weight: 900;
`;

const HeaderActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const PrimaryLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.6rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.55rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 950;
  text-decoration: none;
  box-shadow: 3px 3px 0 #050505;
  svg { width: 17px; height: 17px; }
  &:hover { color: #050505; text-decoration: none; }
`;

const SecondaryButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-height: 2.45rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: ${(p) => (p.$active ? "#050505" : "#ffffff")};
  color: ${(p) => (p.$active ? "#ffffff" : "#050505")};
  padding: 0.48rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 900;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  svg { width: 15px; height: 15px; }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin: 1rem 0 0;

  @media (max-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const StatCard = styled.div`
  border: 1.5px solid #050505;
  border-radius: 13px;
  background: #ffffff;
  padding: 0.75rem;
`;

const StatValue = styled.div`
  color: #050505;
  font-size: 1.3rem;
  font-weight: 950;
`;

const StatLabel = styled.div`
  margin-top: 0.1rem;
  color: rgba(5, 5, 5, 0.56);
  font-size: 0.7rem;
  font-weight: 800;
`;

const Section = styled.section`
  margin-top: 1.5rem;
`;

const SectionTop = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.75rem;

  @media (max-width: 640px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

const SectionTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1.18rem;
  font-weight: 950;
`;

const SectionHint = styled.p`
  margin: 0.15rem 0 0;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.78rem;
  line-height: 1.45;
`;

const SearchWrap = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: min(390px, 100%);
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0 0.75rem;
  svg { width: 18px; height: 18px; flex: 0 0 auto; }
`;

const SearchInput = styled.input`
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 0.65rem 0;
  color: #050505;
  font-size: 0.82rem;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

const WordCard = styled.article`
  border: 2px solid #050505;
  border-radius: 15px;
  background: #ffffff;
  padding: 0.95rem 1rem;
  box-shadow: 3px 3px 0 #050505;
`;

const WordTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;

  @media (max-width: 580px) {
    flex-direction: column;
  }
`;

const Term = styled.h3`
  margin: 0;
  color: #050505;
  font-size: 1.15rem;
  font-weight: 950;
`;

const MiniBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.35rem;
`;

const MiniBadge = styled.span`
  border: 1px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.2rem 0.42rem;
  color: #050505;
  font-size: 0.62rem;
  font-weight: 850;
`;

const Definition = styled.p`
  margin: 0.7rem 0 0;
  color: #050505;
  font-size: 0.9rem;
  line-height: 1.55;
`;

const KoreanDefinition = styled.p`
  margin: 0.24rem 0 0;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.82rem;
  line-height: 1.5;
`;

const SearchResults = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 0.8rem;
`;

const MeaningRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(5, 5, 5, 0.14);

  @media (max-width: 580px) {
    flex-direction: column;
  }
`;

const StateBox = styled.div`
  padding: 2rem 1rem;
  border: 2px dashed #050505;
  border-radius: 16px;
  background: #ffffff;
  text-align: center;
  color: rgba(5, 5, 5, 0.62);
  svg { width: 34px; height: 34px; color: #050505; }
  strong { display: block; margin-top: 0.55rem; color: #050505; }
`;

const asSingle = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

function mapMeaning(value: any): Meaning | null {
  const row = asSingle<any>(value);
  if (!row?.id) return null;
  return {
    id: String(row.id),
    entryId: String(row.entry_id),
    grammarType: String(row.grammar_type || "unknown"),
    definitionEn: String(row.definition_en || ""),
    definitionKo: typeof row.definition_ko === "string" ? row.definition_ko : null,
    pronunciationIpa: typeof row.pronunciation_ipa === "string" ? row.pronunciation_ipa : null,
    usageLabels: Array.isArray(row.usage_labels) ? row.usage_labels.map(String) : [],
    meaningOrder: Number(row.meaning_order || 0),
  };
}

function mapDeck(value: any): Deck {
  return {
    id: String(value.id),
    ownerUserId: value.owner_user_id ? String(value.owner_user_id) : null,
    name: String(value.name || ""),
    description: String(value.description || ""),
    visibility: value.visibility === "public" ? "public" : "private",
    icon: String(value.icon || "📚"),
    theme: (["orange", "blue", "green", "purple", "pink"].includes(value.theme) ? value.theme : "orange") as DeckTheme,
    isOfficial: Boolean(value.is_official),
    itemCount: Number(value.item_count || 0),
    followerCount: Number(value.follower_count || 0),
  };
}

export default function VocabularyDeckClient({ deckId }: { deckId: string }) {
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { locale } = useI18n();
  const copy = copyByLocale[locale];

  const [deck, setDeck] = useState<Deck | null>(null);
  const [items, setItems] = useState<DeckItem[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = Boolean(currentUser && deck?.ownerUserId === currentUser.uid);

  const loadDeck = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const { data: deckRow, error: deckError } = await supabase
        .from("vocabulary_decks")
        .select("*")
        .eq("id", deckId)
        .maybeSingle();
      if (deckError) throw deckError;
      if (!deckRow) {
        setError(copy.loadError);
        return;
      }
      const mappedDeck = mapDeck(deckRow);
      setDeck(mappedDeck);

      const { data: itemRows, error: itemError } = await supabase
        .from("vocabulary_deck_items")
        .select(`
          id,entry_id,meaning_id,
          entry:dictionary_entries!vocabulary_deck_items_entry_id_fkey(term,entry_type),
          meaning:dictionary_meanings!vocabulary_deck_items_meaning_id_fkey(
            id,entry_id,grammar_type,definition_en,definition_ko,
            pronunciation_ipa,usage_labels,meaning_order
          )
        `)
        .eq("deck_id", deckId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("added_at", { ascending: true });
      if (itemError) throw itemError;

      const parsedItems: DeckItem[] = (itemRows || []).flatMap((row: any) => {
        const entry = asSingle<any>(row.entry);
        if (!entry?.term) return [];
        return [{
          id: String(row.id),
          entryId: String(row.entry_id),
          meaningId: row.meaning_id ? String(row.meaning_id) : null,
          term: String(entry.term),
          entryType: entry.entry_type === "expression" ? "expression" : "word",
          meaning: mapMeaning(row.meaning),
        }];
      });
      setItems(parsedItems);

      if (mappedDeck.ownerUserId) {
        const { data: owner } = await supabase
          .from("public_users")
          .select("display_name")
          .eq("uid", mappedDeck.ownerUserId)
          .maybeSingle();
        setOwnerName(typeof owner?.display_name === "string" ? owner.display_name : null);
      } else {
        setOwnerName(null);
      }

      const { data: follow } = await supabase
        .from("vocabulary_deck_follows")
        .select("deck_id")
        .eq("deck_id", deckId)
        .eq("user_id", currentUser.uid)
        .maybeSingle();
      setFollowing(Boolean(follow));
    } catch (loadFailure) {
      console.error("Unable to load vocabulary deck:", loadFailure);
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, currentUser, deckId]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace(`/auth?redirect=${encodeURIComponent(`/vocabulary/decks/${deckId}`)}`);
      return;
    }
    void loadDeck();
  }, [authLoading, currentUser, deckId, loadDeck, router]);

  useEffect(() => {
    if (!isOwner) {
      setResults([]);
      return;
    }
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { data: entryRows, error: entryError } = await supabase
          .from("dictionary_entries")
          .select("id,term,normalized_term,entry_type")
          .eq("language_code", "en")
          .ilike("normalized_term", `%${normalized}%`)
          .order("normalized_term", { ascending: true })
          .limit(20);
        if (entryError) throw entryError;

        const entryIds = (entryRows || []).map((row: any) => String(row.id));
        if (entryIds.length === 0) {
          setResults([]);
          return;
        }

        const { data: meaningRows, error: meaningError } = await supabase
          .from("dictionary_meanings")
          .select("id,entry_id,grammar_type,definition_en,definition_ko,pronunciation_ipa,usage_labels,meaning_order")
          .in("entry_id", entryIds)
          .order("meaning_order", { ascending: true });
        if (meaningError) throw meaningError;

        const byEntry: Record<string, Meaning[]> = {};
        (meaningRows || []).forEach((row: any) => {
          const meaning = mapMeaning(row);
          if (!meaning) return;
          if (!byEntry[meaning.entryId]) byEntry[meaning.entryId] = [];
          byEntry[meaning.entryId].push(meaning);
        });

        setResults((entryRows || []).map((row: any) => ({
          id: String(row.id),
          term: String(row.term),
          normalizedTerm: String(row.normalized_term || row.term).toLowerCase(),
          entryType: row.entry_type === "expression" ? "expression" : "word",
          meanings: byEntry[String(row.id)] || [],
        })));
      } catch (searchFailure) {
        console.error("Dictionary search failed:", searchFailure);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [isOwner, query]);

  const itemKeys = useMemo(
    () => new Set(items.map((item) => `${item.entryId}:${item.meaningId || ""}`)),
    [items],
  );
  const wordCount = items.filter((item) => item.entryType === "word").length;
  const expressionCount = items.filter((item) => item.entryType === "expression").length;

  const toggleFollow = async () => {
    if (!currentUser || !deck || isOwner || deck.visibility !== "public") return;
    setUpdating(true);
    try {
      if (following) {
        const { error: followError } = await supabase
          .from("vocabulary_deck_follows")
          .delete()
          .eq("deck_id", deck.id)
          .eq("user_id", currentUser.uid);
        if (followError) throw followError;
      } else {
        const { error: followError } = await supabase
          .from("vocabulary_deck_follows")
          .insert({ deck_id: deck.id, user_id: currentUser.uid });
        if (followError) throw followError;
      }
      await loadDeck();
    } catch (followFailure) {
      console.error("Unable to change follow state:", followFailure);
      window.alert(copy.followError);
    } finally {
      setUpdating(false);
    }
  };

  const toggleVisibility = async () => {
    if (!deck || !isOwner) return;
    setUpdating(true);
    try {
      const nextVisibility: DeckVisibility = deck.visibility === "public" ? "private" : "public";
      const { error: updateError } = await supabase
        .from("vocabulary_decks")
        .update({ visibility: nextVisibility, updated_at: new Date().toISOString() })
        .eq("id", deck.id);
      if (updateError) throw updateError;
      await loadDeck();
    } catch (visibilityFailure) {
      console.error("Unable to update deck visibility:", visibilityFailure);
      window.alert(copy.updateError);
    } finally {
      setUpdating(false);
    }
  };

  const addMeaning = async (entry: DictionaryEntry, meaning: Meaning | null) => {
    if (!isOwner) return;
    const key = `${entry.id}:${meaning?.id || ""}`;
    setAddingKey(key);
    try {
      const { error: addError } = await supabase.from("vocabulary_deck_items").insert({
        deck_id: deckId,
        entry_id: entry.id,
        meaning_id: meaning?.id || null,
      });
      if (addError && addError.code !== "23505") throw addError;
      await loadDeck();
    } catch (addFailure) {
      console.error("Unable to add vocabulary to deck:", addFailure);
      window.alert(copy.updateError);
    } finally {
      setAddingKey(null);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!isOwner) return;
    setRemovingId(itemId);
    try {
      const { error: removeError } = await supabase
        .from("vocabulary_deck_items")
        .delete()
        .eq("id", itemId)
        .eq("deck_id", deckId);
      if (removeError) throw removeError;
      await loadDeck();
    } catch (removeFailure) {
      console.error("Unable to remove vocabulary from deck:", removeFailure);
      window.alert(copy.updateError);
    } finally {
      setRemovingId(null);
    }
  };

  if (authLoading || loading) {
    return <Page><Shell><StateBox>{copy.loading}</StateBox></Shell></Page>;
  }

  if (error || !deck) {
    return (
      <Page><Shell>
        <BackLink href="/vocabulary"><ArrowLeftIcon />{copy.back}</BackLink>
        <StateBox style={{ marginTop: "1rem" }}>
          <strong>{error || copy.loadError}</strong>
          <SecondaryButton style={{ marginTop: "0.8rem" }} onClick={() => void loadDeck()}>{copy.retry}</SecondaryButton>
        </StateBox>
      </Shell></Page>
    );
  }

  return (
    <Page>
      <Shell>
        <BackLink href="/vocabulary"><ArrowLeftIcon />{copy.back}</BackLink>

        <DeckHeader>
          <HeaderTop>
            <div>
              <IdentityRow>
                <DeckIcon>{deck.icon}</DeckIcon>
                <div>
                  <DeckName>{deck.name}</DeckName>
                  <Description>{deck.description}</Description>
                  <BadgeRow>
                    {deck.isOfficial && <Badge>{copy.official}</Badge>}
                    {isOwner && <Badge>{copy.yourCollection}</Badge>}
                    <Badge>{deck.visibility === "public" ? copy.public : copy.private}</Badge>
                    {!isOwner && following && <Badge>{copy.following}</Badge>}
                    <Badge>{copy.by}: {deck.isOfficial ? copy.officialBy : ownerName || "Member"}</Badge>
                  </BadgeRow>
                </div>
              </IdentityRow>
            </div>
            <HeaderActions>
              {isOwner && (
                <SecondaryButton type="button" disabled={updating} onClick={() => void toggleVisibility()}>
                  {deck.visibility === "public" ? <EyeSlashIcon /> : <EyeIcon />}
                  {deck.visibility === "public" ? copy.makePrivate : copy.makePublic}
                </SecondaryButton>
              )}
              {!isOwner && deck.visibility === "public" && (
                <SecondaryButton type="button" $active={following} disabled={updating} onClick={() => void toggleFollow()}>
                  <UserGroupIcon />{following ? copy.unfollow : copy.follow}
                </SecondaryButton>
              )}
              <PrimaryLink href={`/vocabulary/study/${deck.id}`}>
                <AcademicCapIcon />{copy.study}
              </PrimaryLink>
            </HeaderActions>
          </HeaderTop>

          <StatsGrid>
            <StatCard><StatValue>{items.length}</StatValue><StatLabel>{copy.total}</StatLabel></StatCard>
            <StatCard><StatValue>{wordCount}</StatValue><StatLabel>{copy.words}</StatLabel></StatCard>
            <StatCard><StatValue>{expressionCount}</StatValue><StatLabel>{copy.expressions}</StatLabel></StatCard>
            <StatCard><StatValue>{deck.followerCount}</StatValue><StatLabel>{copy.followers}</StatLabel></StatCard>
          </StatsGrid>
        </DeckHeader>

        <Section>
          <SectionTop>
            <div>
              <SectionTitle>{copy.contents}</SectionTitle>
              <SectionHint>{copy.contentsHint}</SectionHint>
            </div>
          </SectionTop>

          {items.length > 0 ? (
            <List>
              {items.map((item) => (
                <WordCard key={item.id}>
                  <WordTop>
                    <div>
                      <Term>{item.term}</Term>
                      <MiniBadges>
                        <MiniBadge>{item.entryType}</MiniBadge>
                        {item.meaning?.grammarType && <MiniBadge>{item.meaning.grammarType}</MiniBadge>}
                        {item.meaning?.pronunciationIpa && <MiniBadge>{item.meaning.pronunciationIpa}</MiniBadge>}
                      </MiniBadges>
                    </div>
                    {isOwner && (
                      <SecondaryButton
                        type="button"
                        disabled={removingId === item.id}
                        onClick={() => void removeItem(item.id)}
                      >
                        <TrashIcon />{copy.remove}
                      </SecondaryButton>
                    )}
                  </WordTop>
                  <Definition>{item.meaning?.definitionEn || copy.noDefinition}</Definition>
                  {item.meaning?.definitionKo && <KoreanDefinition>{item.meaning.definitionKo}</KoreanDefinition>}
                </WordCard>
              ))}
            </List>
          ) : (
            <StateBox>
              <BookOpenIcon />
              <strong>{copy.noItems}</strong>
            </StateBox>
          )}
        </Section>

        {isOwner && (
          <Section>
            <SectionTop>
              <div>
                <SectionTitle>{copy.addTitle}</SectionTitle>
                <SectionHint>{copy.addHint}</SectionHint>
              </div>
              <SearchWrap>
                <MagnifyingGlassIcon />
                <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
              </SearchWrap>
            </SectionTop>

            {query.trim().length < 2 ? (
              <StateBox>{copy.searchStart}</StateBox>
            ) : searching ? (
              <StateBox>{copy.loading}</StateBox>
            ) : results.length === 0 ? (
              <StateBox><strong>{copy.searchEmpty}</strong></StateBox>
            ) : (
              <SearchResults>
                {results.map((entry) => (
                  <WordCard key={entry.id}>
                    <Term>{entry.term}</Term>
                    <MiniBadges><MiniBadge>{entry.entryType}</MiniBadge></MiniBadges>
                    {entry.meanings.length > 0 ? entry.meanings.map((meaning) => {
                      const key = `${entry.id}:${meaning.id}`;
                      const alreadyAdded = itemKeys.has(key);
                      return (
                        <MeaningRow key={meaning.id}>
                          <div>
                            <MiniBadges>
                              <MiniBadge>{meaning.grammarType}</MiniBadge>
                              {meaning.pronunciationIpa && <MiniBadge>{meaning.pronunciationIpa}</MiniBadge>}
                            </MiniBadges>
                            <Definition>{meaning.definitionEn || copy.noDefinition}</Definition>
                            {meaning.definitionKo && <KoreanDefinition>{meaning.definitionKo}</KoreanDefinition>}
                          </div>
                          <SecondaryButton
                            type="button"
                            $active={alreadyAdded}
                            disabled={alreadyAdded || addingKey === key}
                            onClick={() => void addMeaning(entry, meaning)}
                          >
                            {alreadyAdded ? <CheckIcon /> : <PlusIcon />}
                            {alreadyAdded ? copy.added : copy.add}
                          </SecondaryButton>
                        </MeaningRow>
                      );
                    }) : (
                      <MeaningRow>
                        <Definition>{copy.noDefinition}</Definition>
                        <SecondaryButton
                          type="button"
                          $active={itemKeys.has(`${entry.id}:`)}
                          disabled={itemKeys.has(`${entry.id}:`) || addingKey === `${entry.id}:`}
                          onClick={() => void addMeaning(entry, null)}
                        >
                          {itemKeys.has(`${entry.id}:`) ? <CheckIcon /> : <PlusIcon />}
                          {itemKeys.has(`${entry.id}:`) ? copy.added : copy.add}
                        </SecondaryButton>
                      </MeaningRow>
                    )}
                  </WordCard>
                ))}
              </SearchResults>
            )}
          </Section>
        )}
      </Shell>
    </Page>
  );
}
