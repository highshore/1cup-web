"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import {
  BookOpenIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase/client";
import { appLayout } from "../lib/constants/app_layout";

type LearningStatus = "saved" | "learning" | "learned";
type EntryType = "word" | "expression";
type FilterType = "all" | EntryType | "learned";

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
  note: string | null;
  sourceArticleId: string | null;
  sourceArticleTitle: string | null;
  meaning: Meaning | null;
};

const copyByLocale = {
  ko: {
    eyebrow: "MY VOCABULARY",
    title: "내 단어장",
    subtitle: "기사에서 저장한 단어와 표현을 한곳에서 관리하세요.",
    search: "단어 또는 표현 검색",
    all: "전체",
    words: "단어",
    expressions: "표현",
    learned: "학습 완료",
    empty: "아직 저장한 단어나 표현이 없습니다.",
    emptyHint: "아티클의 Key Vocabulary에서 원하는 단어를 저장해 보세요.",
    count: (count: number) => `${count}개 저장됨`,
    saved: "저장됨",
    learning: "학습 중",
    learnedStatus: "학습 완료",
    status: "학습 상태",
    meaningPending: "아직 어떤 의미로 저장할지 선택되지 않았습니다.",
    chooseMeaning: "이 의미로 저장",
    availableMeanings: "가능한 의미",
    sourceArticle: "저장한 기사",
    savedDate: "저장일",
    noDefinition: "뜻 정보가 아직 준비되지 않았습니다.",
    wiktionary: "Wiktionary 기반",
    loading: "단어장을 불러오는 중...",
    loadError: "단어장을 불러오지 못했습니다. 다시 시도해 주세요.",
    updateError: "변경 사항을 저장하지 못했습니다.",
    retry: "다시 시도",
    attribution: "Wiktionary 기반 사전 데이터는 CC BY-SA 4.0 / GFDL 조건에 따라 사용됩니다.",
  },
  en: {
    eyebrow: "MY VOCABULARY",
    title: "My Vocabulary",
    subtitle: "Keep the words and expressions you save from articles in one collection.",
    search: "Search words or expressions",
    all: "All",
    words: "Words",
    expressions: "Expressions",
    learned: "Learned",
    empty: "You haven't saved any vocabulary yet.",
    emptyHint: "Save a term from Key Vocabulary on an article to get started.",
    count: (count: number) => `${count} saved`,
    saved: "Saved",
    learning: "Learning",
    learnedStatus: "Learned",
    status: "Learning status",
    meaningPending: "This saved term has not been matched to a specific meaning yet.",
    chooseMeaning: "Use this meaning",
    availableMeanings: "Available meanings",
    sourceArticle: "Saved from",
    savedDate: "Saved",
    noDefinition: "A dictionary meaning is not available yet.",
    wiktionary: "From Wiktionary",
    loading: "Loading your vocabulary...",
    loadError: "We couldn't load your vocabulary. Please try again.",
    updateError: "We couldn't save that change.",
    retry: "Try again",
    attribution: "Wiktionary-derived dictionary data is used under CC BY-SA 4.0 / GFDL.",
  },
} as const;

const Page = styled.main`
  width: 100%;
  min-height: 100vh;
  background: #faf8f4;
  padding: 1.5rem ${appLayout.pageGutterDesktop} 4rem;

  @media (max-width: 768px) {
    padding: 1rem ${appLayout.pageGutterMobile} 3rem;
  }
`;

const Shell = styled.div`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
`;

const Hero = styled.section`
  padding: 1.4rem 0 1.2rem;
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
  margin: 0.75rem 0 0.35rem;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.05;
  color: #050505;
  font-weight: 950;
`;

const Subtitle = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.66);
  font-size: 1rem;
  line-height: 1.55;
`;

const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin: 0.8rem 0 1.2rem;
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

  svg {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
  }
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

const FilterRow = styled.div`
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  align-items: center;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  border: 2px solid #050505;
  border-radius: 999px;
  background: ${(props) => (props.$active ? "#f47a4a" : "#ffffff")};
  color: #050505;
  padding: 0.45rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 850;
  cursor: pointer;
  box-shadow: ${(props) => (props.$active ? "2px 2px 0 #050505" : "none")};
`;

const Count = styled.span`
  margin-left: auto;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.82rem;
  font-weight: 800;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
`;

const Card = styled.article`
  background: #ffffff;
  border: 2px solid #050505;
  border-radius: 16px;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  padding: 1.05rem 1.1rem;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 0.7rem;
  }
`;

const TermGroup = styled.div`
  min-width: 0;
`;

const Term = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1.35rem;
  font-weight: 950;
  overflow-wrap: anywhere;
`;

const Badges = styled.div`
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.45rem;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 1.55rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #fff6f0;
  padding: 0 0.5rem;
  font-size: 0.68rem;
  font-weight: 850;
  text-transform: capitalize;
`;

const StatusSelect = styled.select`
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  padding: 0.45rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 850;
  cursor: pointer;
`;

const Definition = styled.p`
  margin: 0.9rem 0 0;
  color: #050505;
  font-size: 0.98rem;
  line-height: 1.55;
`;

const KoreanDefinition = styled.p`
  margin: 0.35rem 0 0;
  color: rgba(5, 5, 5, 0.68);
  font-size: 0.92rem;
  line-height: 1.55;
`;

const Pending = styled.div`
  margin-top: 0.9rem;
  border: 1.5px dashed #050505;
  border-radius: 12px;
  background: #fffaf6;
  padding: 0.8rem;
  color: rgba(5, 5, 5, 0.7);
  font-size: 0.85rem;
  line-height: 1.5;
`;

const CandidateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 0.75rem;
`;

const Candidate = styled.div`
  border-top: 1px solid rgba(5, 5, 5, 0.16);
  padding-top: 0.65rem;
`;

const CandidateTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
`;

const ChooseButton = styled.button`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.35rem 0.6rem;
  font-size: 0.7rem;
  font-weight: 900;
  cursor: pointer;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(5, 5, 5, 0.14);
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.76rem;
  font-weight: 700;

  a {
    color: #050505;
    font-weight: 850;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`;

const StateBox = styled.div`
  margin-top: 1rem;
  padding: 2.5rem 1rem;
  border: 2px dashed #050505;
  border-radius: 16px;
  background: #ffffff;
  text-align: center;
  color: rgba(5, 5, 5, 0.68);

  svg {
    width: 36px;
    height: 36px;
    color: #050505;
  }

  strong {
    display: block;
    margin-top: 0.65rem;
    color: #050505;
  }

  p {
    margin: 0.35rem 0 0;
    line-height: 1.5;
  }
`;

const RetryButton = styled.button`
  margin-top: 0.9rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.45rem 0.8rem;
  font-weight: 900;
  cursor: pointer;
`;

const Attribution = styled.p`
  margin: 1.35rem 0 0;
  color: rgba(5, 5, 5, 0.5);
  font-size: 0.72rem;
  line-height: 1.45;
`;

const asSingleObject = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export default function VocabularyClient() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { locale } = useI18n();
  const copy = copyByLocale[locale];
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [candidateMeanings, setCandidateMeanings] = useState<Record<string, Meaning[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadVocabulary = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: loadError } = await supabase
        .from("user_vocabulary")
        .select(`
          id,
          entry_id,
          meaning_id,
          source_article_id,
          saved_at,
          learning_status,
          note,
          entry:dictionary_entries!user_vocabulary_entry_id_fkey(
            term, normalized_term, entry_type
          ),
          meaning:dictionary_meanings!user_vocabulary_meaning_id_fkey(
            id, entry_id, grammar_type, definition_en, definition_ko,
            usage_labels, pronunciation_ipa, source, source_license, meaning_order
          ),
          article:articles!user_vocabulary_source_article_id_fkey(
            id, title
          )
        `)
        .eq("user_id", currentUser.uid)
        .order("saved_at", { ascending: false });

      if (loadError) throw loadError;

      const parsed: VocabularyItem[] = (data || []).flatMap((row: any) => {
        const entry = asSingleObject<any>(row.entry);
        if (!entry?.term) return [];
        const meaning = asSingleObject<Meaning>(row.meaning);
        const article = asSingleObject<any>(row.article);
        const title = article?.title && typeof article.title === "object"
          ? article.title
          : null;

        return [{
          id: String(row.id),
          entryId: String(row.entry_id),
          meaningId: row.meaning_id ? String(row.meaning_id) : null,
          term: String(entry.term),
          normalizedTerm: String(entry.normalized_term || entry.term).toLowerCase(),
          entryType: entry.entry_type === "expression" ? "expression" : "word",
          savedAt: String(row.saved_at),
          learningStatus:
            row.learning_status === "learning" || row.learning_status === "learned"
              ? row.learning_status
              : "saved",
          note: typeof row.note === "string" ? row.note : null,
          sourceArticleId: row.source_article_id ? String(row.source_article_id) : null,
          sourceArticleTitle:
            typeof title?.english === "string"
              ? title.english
              : typeof title?.korean === "string"
                ? title.korean
                : null,
          meaning,
        }];
      });

      setItems(parsed);

      const unmatchedEntryIds = [...new Set(
        parsed.filter((item) => !item.meaningId).map((item) => item.entryId),
      )];

      if (unmatchedEntryIds.length === 0) {
        setCandidateMeanings({});
      } else {
        const { data: meanings, error: meaningError } = await supabase
          .from("dictionary_meanings")
          .select("id,entry_id,grammar_type,definition_en,definition_ko,usage_labels,pronunciation_ipa,source,source_license,meaning_order")
          .in("entry_id", unmatchedEntryIds)
          .order("meaning_order", { ascending: true });
        if (meaningError) throw meaningError;

        const grouped: Record<string, Meaning[]> = {};
        (meanings || []).forEach((meaning: any) => {
          const entryId = String(meaning.entry_id);
          if (!grouped[entryId]) grouped[entryId] = [];
          grouped[entryId].push(meaning as Meaning);
        });
        setCandidateMeanings(grouped);
      }
    } catch (loadFailure) {
      console.error("Unable to load vocabulary collection:", loadFailure);
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, currentUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    void loadVocabulary();
  }, [authLoading, currentUser, loadVocabulary, router]);

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

  const updateStatus = async (item: VocabularyItem, status: LearningStatus) => {
    setUpdatingId(item.id);
    try {
      const { error: updateError } = await supabase
        .from("user_vocabulary")
        .update({
          learning_status: status,
          last_reviewed_at: status === "learned" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (updateError) throw updateError;
      setItems((current) => current.map((row) =>
        row.id === item.id ? { ...row, learningStatus: status } : row,
      ));
    } catch (updateFailure) {
      console.error("Unable to update vocabulary status:", updateFailure);
      window.alert(copy.updateError);
    } finally {
      setUpdatingId(null);
    }
  };

  const chooseMeaning = async (item: VocabularyItem, meaning: Meaning) => {
    setUpdatingId(item.id);
    try {
      const { error: updateError } = await supabase
        .from("user_vocabulary")
        .update({ meaning_id: meaning.id, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (updateError) throw updateError;

      setItems((current) => current.map((row) =>
        row.id === item.id
          ? { ...row, meaningId: meaning.id, meaning }
          : row,
      ));
    } catch (updateFailure) {
      console.error("Unable to choose vocabulary meaning:", updateFailure);
      window.alert(copy.updateError);
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading || (loading && !currentUser)) {
    return <Page><Shell><StateBox>{copy.loading}</StateBox></Shell></Page>;
  }

  return (
    <Page>
      <Shell>
        <Hero>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <Title>{copy.title}</Title>
          <Subtitle>{copy.subtitle}</Subtitle>
        </Hero>

        <Toolbar>
          <SearchWrap>
            <MagnifyingGlassIcon />
            <SearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.search}
              aria-label={copy.search}
            />
          </SearchWrap>
          <FilterRow>
            <FilterButton $active={filter === "all"} onClick={() => setFilter("all")}>{copy.all}</FilterButton>
            <FilterButton $active={filter === "word"} onClick={() => setFilter("word")}>{copy.words}</FilterButton>
            <FilterButton $active={filter === "expression"} onClick={() => setFilter("expression")}>{copy.expressions}</FilterButton>
            <FilterButton $active={filter === "learned"} onClick={() => setFilter("learned")}>{copy.learned}</FilterButton>
            <Count>{copy.count(items.length)}</Count>
          </FilterRow>
        </Toolbar>

        {loading ? (
          <StateBox>{copy.loading}</StateBox>
        ) : error ? (
          <StateBox>
            <strong>{error}</strong>
            <RetryButton type="button" onClick={() => void loadVocabulary()}>{copy.retry}</RetryButton>
          </StateBox>
        ) : filteredItems.length === 0 ? (
          <StateBox>
            <BookOpenIcon />
            <strong>{copy.empty}</strong>
            <p>{copy.emptyHint}</p>
          </StateBox>
        ) : (
          <List>
            {filteredItems.map((item) => {
              const candidates = candidateMeanings[item.entryId] || [];
              return (
                <Card key={item.id}>
                  <CardHeader>
                    <TermGroup>
                      <Term>{item.term}</Term>
                      <Badges>
                        <Badge>{item.entryType === "expression" ? copy.expressions : copy.words}</Badge>
                        {item.meaning?.grammar_type && <Badge>{item.meaning.grammar_type}</Badge>}
                        {item.meaning?.pronunciation_ipa && <Badge>{item.meaning.pronunciation_ipa}</Badge>}
                        {item.meaning?.source === "wiktionary" && <Badge>{copy.wiktionary}</Badge>}
                      </Badges>
                    </TermGroup>
                    <StatusSelect
                      aria-label={copy.status}
                      value={item.learningStatus}
                      disabled={updatingId === item.id}
                      onChange={(event) => void updateStatus(item, event.target.value as LearningStatus)}
                    >
                      <option value="saved">{copy.saved}</option>
                      <option value="learning">{copy.learning}</option>
                      <option value="learned">{copy.learnedStatus}</option>
                    </StatusSelect>
                  </CardHeader>

                  {item.meaning ? (
                    <>
                      <Definition>{item.meaning.definition_en || copy.noDefinition}</Definition>
                      {item.meaning.definition_ko && <KoreanDefinition>{item.meaning.definition_ko}</KoreanDefinition>}
                    </>
                  ) : (
                    <Pending>
                      {copy.meaningPending}
                      {candidates.length > 0 && (
                        <CandidateList>
                          <strong>{copy.availableMeanings}</strong>
                          {candidates.map((meaning) => (
                            <Candidate key={meaning.id}>
                              <CandidateTop>
                                <div>
                                  <Badges style={{ marginTop: 0, marginBottom: "0.35rem" }}>
                                    <Badge>{meaning.grammar_type}</Badge>
                                    {meaning.source === "wiktionary" && <Badge>{copy.wiktionary}</Badge>}
                                  </Badges>
                                  <div>{meaning.definition_en}</div>
                                  {meaning.definition_ko && <KoreanDefinition>{meaning.definition_ko}</KoreanDefinition>}
                                </div>
                                <ChooseButton
                                  type="button"
                                  disabled={updatingId === item.id}
                                  onClick={() => void chooseMeaning(item, meaning)}
                                >
                                  <CheckIcon />
                                  {copy.chooseMeaning}
                                </ChooseButton>
                              </CandidateTop>
                            </Candidate>
                          ))}
                        </CandidateList>
                      )}
                    </Pending>
                  )}

                  <Meta>
                    <span>{copy.savedDate}: {new Date(item.savedAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US")}</span>
                    {item.sourceArticleId && item.sourceArticleTitle && (
                      <span>
                        {copy.sourceArticle}: {" "}
                        <Link href={`/article/${item.sourceArticleId}`}>{item.sourceArticleTitle}</Link>
                      </span>
                    )}
                  </Meta>
                </Card>
              );
            })}
          </List>
        )}

        <Attribution>{copy.attribution}</Attribution>
      </Shell>
    </Page>
  );
}
