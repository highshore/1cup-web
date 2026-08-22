"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";

import { appLayout } from "../../lib/constants/app_layout";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";

type Deck = {
  id: string;
  owner_user_id: string | null;
  name: string;
  description: string;
  icon: string;
  theme: string;
  visibility: "private" | "public";
  is_official: boolean;
  system_key: string | null;
  item_count: number;
  follower_count: number;
};

const copyByLocale = {
  ko: {
    back: "단어장 페이지로",
    eyebrow: "ANKI-STYLE STUDY",
    title: "어떤 단어장을 학습할까요?",
    subtitle: "단어장을 고르면 복습일과 학습 상태에 맞춰 카드를 보여줍니다.",
    mine: "내 단어장",
    mineHint: "내 기본 단어장과 직접 만든 단어장",
    added: "추가한 단어장",
    addedHint: "다른 멤버나 1 Cup English의 공개 단어장",
    recommended: "공개 단어장",
    recommendedHint: "바로 학습하거나 추가할 수 있는 단어장",
    start: "학습 시작",
    items: "개 카드",
    addedUsers: "추가한 유저",
    official: "공식",
    emptyMine: "아직 내 단어장이 없습니다.",
    emptyAdded: "아직 추가한 공개 단어장이 없습니다.",
    emptyPublic: "공개 단어장이 없습니다.",
    loading: "단어장을 불러오는 중...",
    error: "학습할 단어장을 불러오지 못했습니다.",
    personalName: "내 단어장",
    personalDescription: "내가 저장한 모든 단어와 표현이 자동으로 모이는 기본 단어장입니다.",
  },
  en: {
    back: "Back to vocabulary",
    eyebrow: "ANKI-STYLE STUDY",
    title: "Which deck do you want to study?",
    subtitle: "Pick a deck and we'll serve cards based on their due dates and learning state.",
    mine: "My decks",
    mineHint: "Your built-in deck and decks you created",
    added: "Added decks",
    addedHint: "Public decks from members and 1 Cup English",
    recommended: "Public decks",
    recommendedHint: "Decks you can study or add right away",
    start: "Start studying",
    items: "cards",
    addedUsers: "added users",
    official: "Official",
    emptyMine: "You do not have any decks yet.",
    emptyAdded: "You have not added a public deck yet.",
    emptyPublic: "There are no public decks yet.",
    loading: "Loading decks...",
    error: "We could not load study decks.",
    personalName: "My Vocabulary",
    personalDescription: "Your built-in deck containing every word and expression you save.",
  },
} as const;

const Page = styled.main`
  width: 100%;
  min-height: 100vh;
  background: transparent;
  padding: 1.25rem ${appLayout.pageGutterDesktop} 4rem;

  @media (max-width: 768px) {
    padding: 0.85rem ${appLayout.pageGutterMobile} 3rem;
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

const Hero = styled.section`
  padding: 1.25rem 0 1.1rem;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  padding: 0.28rem 0.62rem;
  font-size: 0.68rem;
  font-weight: 950;
  letter-spacing: 0.07em;
`;

const Title = styled.h1`
  margin: 0.7rem 0 0.35rem;
  color: #050505;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 950;
  line-height: 1.05;
`;

const Subtitle = styled.p`
  max-width: 620px;
  margin: 0;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.95rem;
  line-height: 1.55;
`;

const Section = styled.section`
  margin-top: 1.35rem;
`;

const SectionTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1.15rem;
  font-weight: 950;
`;

const SectionHint = styled.p`
  margin: 0.2rem 0 0.65rem;
  color: rgba(5, 5, 5, 0.55);
  font-size: 0.76rem;
  line-height: 1.4;
`;

const DeckGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const DeckCard = styled.article`
  min-height: 190px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 2px solid #050505;
  border-radius: 17px;
  background: #ffffff;
  padding: 1rem;
  box-shadow: 4px 4px 0 #050505;
`;

const DeckIcon = styled.div`
  font-size: 1.6rem;
`;

const DeckName = styled.h3`
  margin: 0.55rem 0 0.25rem;
  color: #050505;
  font-size: 1.05rem;
  font-weight: 950;
  line-height: 1.25;
`;

const Description = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.76rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  margin-top: 0.75rem;
  color: rgba(5, 5, 5, 0.56);
  font-size: 0.68rem;
  font-weight: 800;
`;

const Badge = styled.span`
  display: inline-flex;
  width: fit-content;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.25rem 0.45rem;
  color: #050505;
  font-size: 0.63rem;
  font-weight: 900;
`;

const StudyLink = styled(Link)`
  margin-top: 0.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.5rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #f47a4a;
  color: #050505;
  padding: 0.5rem 0.7rem;
  font-size: 0.76rem;
  font-weight: 950;
  text-decoration: none;
  box-shadow: 2px 2px 0 #050505;

  svg { width: 16px; height: 16px; }
  &:hover { color: #050505; text-decoration: none; }
`;

const StateBox = styled.div`
  padding: 2rem 1rem;
  border: 2px dashed #050505;
  border-radius: 16px;
  background: #ffffff;
  text-align: center;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.82rem;

  svg { width: 34px; height: 34px; color: #050505; }
`;

function mapDeck(row: Record<string, unknown>): Deck {
  return {
    id: String(row.id),
    owner_user_id: row.owner_user_id ? String(row.owner_user_id) : null,
    name: String(row.name || ""),
    description: String(row.description || ""),
    icon: String(row.icon || "📚"),
    theme: String(row.theme || "orange"),
    visibility: row.visibility === "public" ? "public" : "private",
    is_official: Boolean(row.is_official),
    system_key: typeof row.system_key === "string" ? String(row.system_key) : null,
    item_count: Number(row.item_count || 0),
    follower_count: Number(row.follower_count || 0),
  };
}

export default function StudyDeckPicker() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { locale } = useI18n();
  const copy = copyByLocale[locale];
  const [ownDecks, setOwnDecks] = useState<Deck[]>([]);
  const [addedDecks, setAddedDecks] = useState<Deck[]>([]);
  const [publicDecks, setPublicDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDecks = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(false);
    try {
      await supabase.rpc("ensure_personal_vocabulary_deck");
      const [ownResult, followResult, publicResult] = await Promise.all([
        supabase
          .from("vocabulary_decks")
          .select("id,owner_user_id,name,description,icon,theme,visibility,is_official,system_key,item_count,follower_count")
          .eq("owner_user_id", currentUser.uid)
          .order("updated_at", { ascending: false }),
        supabase
          .from("vocabulary_deck_follows")
          .select("deck_id")
          .eq("user_id", currentUser.uid),
        supabase
          .from("vocabulary_decks")
          .select("id,owner_user_id,name,description,icon,theme,visibility,is_official,system_key,item_count,follower_count")
          .eq("visibility", "public")
          .order("follower_count", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(12),
      ]);

      if (ownResult.error) throw ownResult.error;
      if (followResult.error) throw followResult.error;
      if (publicResult.error) throw publicResult.error;

      const own = (ownResult.data || []).map((row) => mapDeck(row as Record<string, unknown>));
      own.sort((a, b) => Number(!a.system_key?.startsWith("personal:")) - Number(!b.system_key?.startsWith("personal:")));
      const publicRows = (publicResult.data || []).map((row) => mapDeck(row as Record<string, unknown>));
      const addedIds = new Set((followResult.data || []).map((row) => String(row.deck_id)));
      setOwnDecks(own);
      setPublicDecks(publicRows);
      setAddedDecks(publicRows.filter((deck) => addedIds.has(deck.id)));
    } catch (loadFailure) {
      console.error("Unable to load study decks:", loadFailure);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth?redirect=%2Fvocabulary%2Fstudy");
      return;
    }
    void loadDecks();
  }, [authLoading, currentUser, loadDecks, router]);

  const publicSuggestions = useMemo(() => {
    const ownIds = new Set(ownDecks.map((deck) => deck.id));
    const addedIds = new Set(addedDecks.map((deck) => deck.id));
    return publicDecks.filter((deck) => !ownIds.has(deck.id) && !addedIds.has(deck.id));
  }, [addedDecks, ownDecks, publicDecks]);

  const renderDeck = (deck: Deck) => {
    const isPersonal = deck.system_key?.startsWith("personal:");
    return (
      <DeckCard key={deck.id}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
            <DeckIcon>{deck.icon}</DeckIcon>
            {deck.is_official && <Badge>{copy.official}</Badge>}
          </div>
          <DeckName>{isPersonal ? copy.personalName : deck.name}</DeckName>
          <Description>{isPersonal ? copy.personalDescription : deck.description}</Description>
          <Meta>
            <span>{deck.item_count} {copy.items}</span>
            {deck.visibility === "public" && <span>{deck.follower_count} {copy.addedUsers}</span>}
          </Meta>
        </div>
        <StudyLink href={`/vocabulary/study/${deck.id}`}>
          <AcademicCapIcon />{copy.start}
        </StudyLink>
      </DeckCard>
    );
  };

  if (authLoading || loading) {
    return <Page><Shell><StateBox>{copy.loading}</StateBox></Shell></Page>;
  }

  if (error) {
    return <Page><Shell><StateBox>{copy.error}</StateBox></Shell></Page>;
  }

  return (
    <Page>
      <Shell>
        <BackLink href="/vocabulary"><ArrowLeftIcon />{copy.back}</BackLink>
        <Hero>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <Title>{copy.title}</Title>
          <Subtitle>{copy.subtitle}</Subtitle>
        </Hero>

        <Section>
          <SectionTitle>{copy.mine}</SectionTitle>
          <SectionHint>{copy.mineHint}</SectionHint>
          {ownDecks.length > 0 ? <DeckGrid>{ownDecks.map(renderDeck)}</DeckGrid> : <StateBox><BookOpenIcon /><div>{copy.emptyMine}</div></StateBox>}
        </Section>

        <Section>
          <SectionTitle>{copy.added}</SectionTitle>
          <SectionHint>{copy.addedHint}</SectionHint>
          {addedDecks.length > 0 ? <DeckGrid>{addedDecks.map(renderDeck)}</DeckGrid> : <StateBox><BookOpenIcon /><div>{copy.emptyAdded}</div></StateBox>}
        </Section>

        <Section>
          <SectionTitle>{copy.recommended}</SectionTitle>
          <SectionHint>{copy.recommendedHint}</SectionHint>
          {publicSuggestions.length > 0 ? <DeckGrid>{publicSuggestions.map(renderDeck)}</DeckGrid> : <StateBox><BookOpenIcon /><div>{copy.emptyPublic}</div></StateBox>}
        </Section>
      </Shell>
    </Page>
  );
}
