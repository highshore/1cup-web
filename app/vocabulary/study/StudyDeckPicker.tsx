"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";

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

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="w-full min-h-screen bg-transparent pt-5 px-gutter pb-16 max-[768px]:pt-[0.85rem] max-[768px]:px-gutter-mobile max-[768px]:pb-12">
      {children}
    </main>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-page mx-auto">{children}</div>;
}

function Section({ children }: { children: ReactNode }) {
  return <section className="mt-[1.35rem]">{children}</section>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-[#050505] text-[1.15rem] font-[950]">{children}</h2>;
}

function SectionHint({ children }: { children: ReactNode }) {
  return <p className="mt-[0.2rem] mb-[0.65rem] text-[rgba(5,5,5,0.55)] text-[0.76rem] leading-[1.4]">{children}</p>;
}

function DeckGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
      {children}
    </div>
  );
}

function StateBox({ children }: { children: ReactNode }) {
  return (
    <div className="py-8 px-4 border-2 border-dashed border-[#050505] rounded-2xl bg-white text-center text-[rgba(5,5,5,0.58)] text-[0.82rem] [&_svg]:w-[34px] [&_svg]:h-[34px] [&_svg]:text-[#050505]">
      {children}
    </div>
  );
}

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
      <article
        key={deck.id}
        className="min-h-[190px] flex flex-col justify-between border-2 border-[#050505] rounded-[17px] bg-white p-4 shadow-[4px_4px_0_#050505]"
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
            <div className="text-[1.6rem]">{deck.icon}</div>
            {deck.is_official && (
              <span className="inline-flex w-fit border-[1.5px] border-[#050505] rounded-full bg-white py-1 px-[0.45rem] text-[#050505] text-[0.63rem] font-black">
                {copy.official}
              </span>
            )}
          </div>
          <h3 className="mt-[0.55rem] mb-[0.25rem] text-[#050505] text-[1.05rem] font-[950] leading-[1.25]">{isPersonal ? copy.personalName : deck.name}</h3>
          <p className="m-0 text-[rgba(5,5,5,0.6)] text-[0.76rem] leading-[1.45] line-clamp-2">{isPersonal ? copy.personalDescription : deck.description}</p>
          <div className="flex flex-wrap gap-y-[0.35rem] gap-x-[0.65rem] mt-3 text-[rgba(5,5,5,0.56)] text-[0.68rem] font-extrabold">
            <span>{deck.item_count} {copy.items}</span>
            {deck.visibility === "public" && <span>{deck.follower_count} {copy.addedUsers}</span>}
          </div>
        </div>
        <Link
          href={`/vocabulary/study/${deck.id}`}
          className="mt-[0.85rem] inline-flex items-center justify-center gap-[0.35rem] min-h-10 border-2 border-[#050505] rounded-xl bg-[#f47a4a] text-[#050505] py-2 px-[0.7rem] text-[0.76rem] font-[950] no-underline shadow-[2px_2px_0_#050505] hover:text-[#050505] hover:no-underline [&_svg]:w-4 [&_svg]:h-4"
        >
          <AcademicCapIcon />{copy.start}
        </Link>
      </article>
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
        <Link
          href="/vocabulary"
          className="inline-flex items-center gap-[0.35rem] text-[#050505] text-[0.82rem] font-[850] no-underline [&_svg]:w-[17px] [&_svg]:h-[17px]"
        ><ArrowLeftIcon />{copy.back}</Link>
        <section className="pt-5 pb-[1.1rem]">
          <div className="inline-flex border-2 border-[#050505] rounded-full bg-[#f47a4a] py-[0.28rem] px-[0.62rem] text-[0.68rem] font-[950] tracking-[0.07em]">{copy.eyebrow}</div>
          <h1 className="mt-[0.7rem] mb-[0.35rem] text-[#050505] text-[clamp(2rem,5vw,3rem)] font-[950] leading-[1.05]">{copy.title}</h1>
          <p className="max-w-[620px] m-0 text-[rgba(5,5,5,0.62)] text-[0.95rem] leading-[1.55]">{copy.subtitle}</p>
        </section>

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
