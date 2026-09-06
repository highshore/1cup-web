"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  Bars3Icon,
  BookOpenIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../../../lib/contexts/auth_context";
import { useI18n } from "../../../lib/i18n/I18nProvider";
import { supabase } from "../../../lib/supabase/client";

type EntryType = "word" | "expression";
type DeckVisibility = "private" | "public";
type DeckTheme = "orange" | "blue" | "green" | "purple" | "pink";
type ViewMode = "tiles" | "list";

type Meaning = {
  id: string;
  entryId: string;
  grammarType: string;
  definitionEn: string;
  definitionKo: string | null;
  pronunciationIpa: string | null;
  usageLabels: string[];
  meaningOrder: number;
  source: string | null;
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
  systemKey: string | null;
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
    back: "단어장 페이지로",
    official: "공식",
    public: "공개",
    private: "비공개",
    added: "추가됨",
    addDeck: "추가",
    removeDeck: "제거",
    study: "이 단어장 학습하기",
    total: "전체 항목",
    words: "단어",
    expressions: "표현",
    addedUsers: "추가한 유저",
    by: "만든 사람",
    officialBy: "1 Cup English",
    yourCollection: "내 단어장",
    personalDeck: "기본 단어장",
    personalName: "내 단어장",
    personalDescription: "내가 저장한 모든 단어와 표현이 자동으로 모이는 기본 단어장입니다.",
    contents: "단어 리스트",
    contentsHint: "이 단어장에 들어 있는 단어와 표현입니다.",
    noItems: "아직 이 단어장에 단어가 없습니다.",
    noDefinition: "뜻 정보가 아직 준비되지 않았습니다.",
    remove: "제거",
    addTitle: "단어 추가",
    addHint: "Wiktionary 기반 글로벌 사전에서 단어나 표현을 검색하고 원하는 뜻을 골라 추가하세요.",
    openSearch: "단어 추가",
    closeSearch: "검색 닫기",
    search: "영어 단어 또는 표현 검색",
    searchStart: "두 글자 이상 입력하면 글로벌 사전을 검색합니다.",
    searchEmpty: "일치하는 단어나 표현을 찾지 못했습니다.",
    add: "추가",
    alreadyAdded: "추가됨",
    makePublic: "공개로 전환",
    makePrivate: "비공개로 전환",
    loading: "단어장을 불러오는 중...",
    loadError: "단어장을 불러오지 못했습니다.",
    updateError: "변경 사항을 저장하지 못했습니다.",
    followError: "단어장 추가 상태를 변경하지 못했습니다.",
    retry: "다시 시도",
    tiles: "타일",
    list: "리스트",
    wiktionary: "Wiktionary",
  },
  en: {
    back: "Back to vocabulary",
    official: "Official",
    public: "Public",
    private: "Private",
    added: "Added",
    addDeck: "Add",
    removeDeck: "Remove",
    study: "Study this deck",
    total: "Total items",
    words: "Words",
    expressions: "Expressions",
    addedUsers: "Added users",
    by: "By",
    officialBy: "1 Cup English",
    yourCollection: "Your deck",
    personalDeck: "Built-in deck",
    personalName: "My Vocabulary",
    personalDescription: "Your built-in deck containing every word and expression you save.",
    contents: "Vocabulary list",
    contentsHint: "Words and expressions currently included in this deck.",
    noItems: "There are no items in this deck yet.",
    noDefinition: "A definition is not available yet.",
    remove: "Remove",
    addTitle: "Add vocabulary",
    addHint: "Search the global Wiktionary-based dictionary and add the exact meaning you want.",
    openSearch: "Add vocabulary",
    closeSearch: "Close search",
    search: "Search an English word or expression",
    searchStart: "Enter at least two characters to search the global dictionary.",
    searchEmpty: "No matching vocabulary found.",
    add: "Add",
    alreadyAdded: "Added",
    makePublic: "Make public",
    makePrivate: "Make private",
    loading: "Loading deck...",
    loadError: "We could not load this deck.",
    updateError: "We could not save that change.",
    followError: "We could not update the added state.",
    retry: "Try again",
    tiles: "Tiles",
    list: "List",
    wiktionary: "Wiktionary",
  },
} as const;

function Page({ children }: { children: ReactNode }) {
  return (
    <main className="w-full min-h-screen bg-transparent pt-4 px-gutter pb-16 max-[768px]:pt-3 max-[768px]:px-gutter-mobile max-[768px]:pb-12">
      {children}
    </main>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-page mx-auto">{children}</div>;
}

function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-[0.35rem] text-[#050505] text-[0.82rem] font-[850] no-underline [&_svg]:w-[17px] [&_svg]:h-[17px]"
    >
      {children}
    </Link>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border-[1.5px] border-[#050505] rounded-full bg-white py-[0.3rem] px-2 text-[#050505] text-[0.66rem] font-black">
      {children}
    </span>
  );
}

function SecondaryButton({
  $active,
  className = "",
  children,
  ...rest
}: { $active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[0.3rem] min-h-[2.45rem] border-[1.5px] border-[#050505] rounded-full ${$active ? "bg-[#050505] text-white" : "bg-white text-[#050505]"} py-[0.48rem] px-[0.7rem] text-[0.72rem] font-black cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:w-[15px] [&_svg]:h-[15px] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function StatCard({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="border-[1.5px] border-[#050505] rounded-[13px] bg-white p-3">
      <div className="text-[#050505] text-[1.3rem] font-[950]">{value}</div>
      <div className="mt-[0.1rem] text-[rgba(5,5,5,0.56)] text-[0.7rem] font-extrabold">{label}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-[#050505] text-[1.18rem] font-[950]">{children}</h2>;
}

function SectionHint({ children }: { children: ReactNode }) {
  return <p className="mt-[0.15rem] mb-0 text-[rgba(5,5,5,0.58)] text-[0.78rem] leading-[1.45]">{children}</p>;
}

function WordCard({ $compact, children }: { $compact?: boolean; children: ReactNode }) {
  return (
    <article
      className={`min-w-0 border-2 border-[#050505] rounded-[15px] bg-white py-[0.95rem] px-4 shadow-[3px_3px_0_#050505] flex flex-col ${$compact ? "min-h-[190px]" : ""}`}
    >
      {children}
    </article>
  );
}

function Term({ children }: { children: ReactNode }) {
  return <h3 className="m-0 text-[#050505] text-[1.15rem] font-[950] [overflow-wrap:anywhere]">{children}</h3>;
}

function MiniBadges({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-[0.3rem] mt-[0.35rem]">{children}</div>;
}

function MiniBadge({ children }: { children: ReactNode }) {
  return (
    <span className="border border-[#050505] rounded-full bg-white py-[0.2rem] px-[0.42rem] text-[#050505] text-[0.62rem] font-[850]">
      {children}
    </span>
  );
}

function Definition({ children }: { children: ReactNode }) {
  return <p className="mt-[0.7rem] mb-0 text-[#050505] text-[0.88rem] leading-[1.5]">{children}</p>;
}

function KoreanDefinition({ children }: { children: ReactNode }) {
  return <p className="mt-[0.24rem] mb-0 text-[rgba(5,5,5,0.62)] text-[0.8rem] leading-[1.5]">{children}</p>;
}

function MeaningRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-[0.65rem] mt-[0.65rem] pt-[0.65rem] border-t border-t-[rgba(5,5,5,0.14)]">
      {children}
    </div>
  );
}

function StateBox({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`py-8 px-4 border-2 border-dashed border-[#050505] rounded-2xl bg-white text-center text-[rgba(5,5,5,0.62)] [&_svg]:w-[34px] [&_svg]:h-[34px] [&_svg]:text-[#050505] [&_strong]:block [&_strong]:mt-[0.55rem] [&_strong]:text-[#050505] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

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
    source: typeof row.source === "string" ? row.source : null,
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
    systemKey: typeof value.system_key === "string" ? value.system_key : null,
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
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("tiles");
  const [searchOpen, setSearchOpen] = useState(false);

  const isOwner = Boolean(currentUser && deck?.ownerUserId === currentUser.uid);
  const isPersonalDeck = Boolean(deck?.systemKey?.startsWith("personal:"));

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
            pronunciation_ipa,usage_labels,meaning_order,source
          )
        `)
        .eq("deck_id", deckId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("added_at", { ascending: false });
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
      } else setOwnerName(null);

      const { data: follow } = await supabase
        .from("vocabulary_deck_follows")
        .select("deck_id")
        .eq("deck_id", deckId)
        .eq("user_id", currentUser.uid)
        .maybeSingle();
      setAdded(Boolean(follow));
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
    if (!isOwner || !searchOpen) {
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
          .limit(24);
        if (entryError) throw entryError;

        const entryIds = (entryRows || []).map((row: any) => String(row.id));
        if (entryIds.length === 0) {
          setResults([]);
          return;
        }

        const { data: meaningRows, error: meaningError } = await supabase
          .from("dictionary_meanings")
          .select("id,entry_id,grammar_type,definition_en,definition_ko,pronunciation_ipa,usage_labels,meaning_order,source")
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
        Object.values(byEntry).forEach((meanings) => {
          meanings.sort((a, b) => {
            const sourceA = a.source === "wiktionary" ? 0 : 1;
            const sourceB = b.source === "wiktionary" ? 0 : 1;
            return sourceA - sourceB || a.meaningOrder - b.meaningOrder;
          });
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
    }, 220);

    return () => window.clearTimeout(timer);
  }, [isOwner, query, searchOpen]);

  const itemKeys = useMemo(
    () => new Set(items.map((item) => `${item.entryId}:${item.meaningId || ""}`)),
    [items],
  );
  const wordCount = items.filter((item) => item.entryType === "word").length;
  const expressionCount = items.filter((item) => item.entryType === "expression").length;

  const displayName = deck && isPersonalDeck ? copy.personalName : deck?.name || "";
  const displayDescription = deck && isPersonalDeck ? copy.personalDescription : deck?.description || "";

  const toggleAdded = async () => {
    if (!currentUser || !deck || isOwner || deck.visibility !== "public") return;
    setUpdating(true);
    try {
      if (added) {
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
      console.error("Unable to change deck added state:", followFailure);
      window.alert(copy.followError);
    } finally {
      setUpdating(false);
    }
  };

  const toggleVisibility = async () => {
    if (!deck || !isOwner || isPersonalDeck) return;
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
    if (!isOwner || !currentUser) return;
    const key = `${entry.id}:${meaning?.id || ""}`;
    setAddingKey(key);
    try {
      if (isPersonalDeck) {
        const { error: saveError } = await supabase.rpc("save_vocabulary_term", {
          p_term: entry.term,
          p_source_article_id: null,
          p_meaning_id: meaning?.id || null,
        });
        if (saveError) throw saveError;
      } else {
        const { error: addError } = await supabase.from("vocabulary_deck_items").insert({
          deck_id: deckId,
          entry_id: entry.id,
          meaning_id: meaning?.id || null,
        });
        if (addError && addError.code !== "23505") throw addError;
      }
      await loadDeck();
    } catch (addFailure) {
      console.error("Unable to add vocabulary to deck:", addFailure);
      window.alert(copy.updateError);
    } finally {
      setAddingKey(null);
    }
  };

  const removeItem = async (item: DeckItem) => {
    if (!isOwner || !currentUser) return;
    setRemovingId(item.id);
    try {
      if (isPersonalDeck) {
        let removal = supabase
          .from("user_vocabulary")
          .delete()
          .eq("user_id", currentUser.uid)
          .eq("entry_id", item.entryId);
        removal = item.meaningId ? removal.eq("meaning_id", item.meaningId) : removal.is("meaning_id", null);
        const { error: removeError } = await removal;
        if (removeError) throw removeError;
      } else {
        const { error: removeError } = await supabase
          .from("vocabulary_deck_items")
          .delete()
          .eq("id", item.id)
          .eq("deck_id", deckId);
        if (removeError) throw removeError;
      }
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
        <StateBox style={{ marginTop: "1rem" }}><strong>{error || copy.loadError}</strong><SecondaryButton style={{ marginTop: "0.8rem" }} onClick={() => void loadDeck()}>{copy.retry}</SecondaryButton></StateBox>
      </Shell></Page>
    );
  }

  return (
    <Page>
      <Shell>
        <BackLink href="/vocabulary"><ArrowLeftIcon />{copy.back}</BackLink>

        <section className="mt-[0.8rem] border-2 border-[#050505] rounded-[18px] bg-white p-[1.15rem] shadow-[4px_4px_0_#050505]">
          <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
            <div className="flex items-start gap-3">
              <div className="text-[2rem] leading-none">{deck.icon}</div>
              <div>
                <h1 className="m-0 text-[#050505] text-[clamp(1.65rem,5vw,2.35rem)] leading-[1.1] font-[950]">{displayName}</h1>
                <p className="max-w-[700px] mt-[0.45rem] mb-0 text-[rgba(5,5,5,0.62)] text-[0.9rem] leading-[1.55]">{displayDescription}</p>
                <div className="flex flex-wrap gap-[0.35rem] mt-[0.65rem]">
                  {deck.isOfficial && <Badge>{copy.official}</Badge>}
                  {isOwner && <Badge>{isPersonalDeck ? copy.personalDeck : copy.yourCollection}</Badge>}
                  <Badge>{deck.visibility === "public" ? copy.public : copy.private}</Badge>
                  {!isOwner && added && <Badge>{copy.added}</Badge>}
                  <Badge>{copy.by}: {deck.isOfficial ? copy.officialBy : ownerName || "Member"}</Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {isOwner && !isPersonalDeck && (
                <SecondaryButton type="button" disabled={updating} onClick={() => void toggleVisibility()}>
                  {deck.visibility === "public" ? <EyeSlashIcon /> : <EyeIcon />}
                  {deck.visibility === "public" ? copy.makePrivate : copy.makePublic}
                </SecondaryButton>
              )}
              {!isOwner && deck.visibility === "public" && (
                <SecondaryButton type="button" $active={added} disabled={updating} onClick={() => void toggleAdded()}>
                  <UserGroupIcon />{added ? copy.removeDeck : copy.addDeck}
                </SecondaryButton>
              )}
              <Link
                href={`/vocabulary/study/${deck.id}`}
                className="inline-flex items-center justify-center gap-[0.35rem] min-h-[2.6rem] border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-[0.55rem] px-[0.85rem] text-[0.78rem] font-[950] no-underline shadow-[3px_3px_0_#050505] hover:text-[#050505] hover:no-underline [&_svg]:w-[17px] [&_svg]:h-[17px]"
              ><AcademicCapIcon />{copy.study}</Link>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-[0.65rem] mt-4 max-[640px]:grid-cols-2">
            <StatCard value={items.length} label={copy.total} />
            <StatCard value={wordCount} label={copy.words} />
            <StatCard value={expressionCount} label={copy.expressions} />
            <StatCard value={deck.followerCount} label={copy.addedUsers} />
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-[0.8rem] mb-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <SectionTitle>{copy.contents}</SectionTitle>
              <SectionHint>{copy.contentsHint}</SectionHint>
            </div>
            <div className="flex items-center justify-end gap-[0.45rem] flex-wrap">
              {isOwner && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-[0.3rem] min-h-[2.45rem] border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-[0.48rem] px-3 text-[0.72rem] font-[950] cursor-pointer shadow-[2px_2px_0_#050505] [&_svg]:w-[15px] [&_svg]:h-[15px]"
                  onClick={() => setSearchOpen((value) => !value)}
                >
                  {searchOpen ? <XMarkIcon /> : <PlusIcon />}
                  {searchOpen ? copy.closeSearch : copy.openSearch}
                </button>
              )}
              <div className="inline-flex border-[1.5px] border-[#050505] rounded-full bg-white overflow-hidden" aria-label="Vocabulary layout">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 border-r border-r-[rgba(5,5,5,0.18)] last:border-r-0 ${viewMode === "tiles" ? "bg-[#050505] text-white" : "bg-white text-[#050505]"} py-[0.48rem] px-[0.6rem] text-[0.68rem] font-black cursor-pointer [&_svg]:w-[14px] [&_svg]:h-[14px]`}
                  onClick={() => setViewMode("tiles")}
                ><Squares2X2Icon />{copy.tiles}</button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 border-r border-r-[rgba(5,5,5,0.18)] last:border-r-0 ${viewMode === "list" ? "bg-[#050505] text-white" : "bg-white text-[#050505]"} py-[0.48rem] px-[0.6rem] text-[0.68rem] font-black cursor-pointer [&_svg]:w-[14px] [&_svg]:h-[14px]`}
                  onClick={() => setViewMode("list")}
                ><Bars3Icon />{copy.list}</button>
              </div>
            </div>
          </div>

          {isOwner && searchOpen && (
            <div className="mb-4 border-2 border-[#050505] rounded-2xl bg-white p-[0.9rem] shadow-[3px_3px_0_rgba(5,5,5,0.88)]">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <SectionTitle>{copy.addTitle}</SectionTitle>
                  <SectionHint>{copy.addHint}</SectionHint>
                </div>
              </div>
              <label className="flex items-center gap-2 w-full border-2 border-[#050505] rounded-full bg-white py-0 px-3 [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:flex-none">
                <MagnifyingGlassIcon />
                <input
                  className="w-full border-0 outline-0 bg-transparent py-[0.65rem] px-0 text-[#050505] text-[0.82rem]"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.search}
                />
              </label>

              {query.trim().length < 2 ? (
                <StateBox style={{ marginTop: "0.8rem", padding: "1rem" }}>{copy.searchStart}</StateBox>
              ) : searching ? (
                <StateBox style={{ marginTop: "0.8rem", padding: "1rem" }}>{copy.loading}</StateBox>
              ) : results.length === 0 ? (
                <StateBox style={{ marginTop: "0.8rem", padding: "1rem" }}><strong>{copy.searchEmpty}</strong></StateBox>
              ) : (
                <div className="grid grid-cols-2 gap-[0.7rem] mt-[0.8rem] max-[700px]:grid-cols-1">
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
                                {meaning.source === "wiktionary" && <MiniBadge>{copy.wiktionary}</MiniBadge>}
                                {meaning.pronunciationIpa && <MiniBadge>{meaning.pronunciationIpa}</MiniBadge>}
                              </MiniBadges>
                              <Definition>{meaning.definitionEn || copy.noDefinition}</Definition>
                              {meaning.definitionKo && <KoreanDefinition>{meaning.definitionKo}</KoreanDefinition>}
                            </div>
                            <SecondaryButton type="button" $active={alreadyAdded} disabled={alreadyAdded || addingKey === key} onClick={() => void addMeaning(entry, meaning)}>
                              {alreadyAdded ? <CheckIcon /> : <PlusIcon />}{alreadyAdded ? copy.alreadyAdded : copy.add}
                            </SecondaryButton>
                          </MeaningRow>
                        );
                      }) : (
                        <MeaningRow>
                          <Definition>{copy.noDefinition}</Definition>
                          <SecondaryButton type="button" $active={itemKeys.has(`${entry.id}:`)} disabled={itemKeys.has(`${entry.id}:`) || addingKey === `${entry.id}:`} onClick={() => void addMeaning(entry, null)}>
                            {itemKeys.has(`${entry.id}:`) ? <CheckIcon /> : <PlusIcon />}{itemKeys.has(`${entry.id}:`) ? copy.alreadyAdded : copy.add}
                          </SecondaryButton>
                        </MeaningRow>
                      )}
                    </WordCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {items.length > 0 ? (
            <div
              className={
                viewMode === "tiles"
                  ? "grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1"
                  : "flex flex-col gap-3"
              }
            >
              {items.map((item) => (
                <WordCard key={item.id} $compact={viewMode === "tiles"}>
                  <div className="flex items-start justify-between gap-[0.7rem]">
                    <div>
                      <Term>{item.term}</Term>
                      <MiniBadges>
                        <MiniBadge>{item.entryType}</MiniBadge>
                        {item.meaning?.grammarType && <MiniBadge>{item.meaning.grammarType}</MiniBadge>}
                        {item.meaning?.source === "wiktionary" && <MiniBadge>{copy.wiktionary}</MiniBadge>}
                        {item.meaning?.pronunciationIpa && <MiniBadge>{item.meaning.pronunciationIpa}</MiniBadge>}
                      </MiniBadges>
                    </div>
                  </div>
                  <Definition>{item.meaning?.definitionEn || copy.noDefinition}</Definition>
                  {item.meaning?.definitionKo && <KoreanDefinition>{item.meaning.definitionKo}</KoreanDefinition>}
                  {isOwner && (
                    <div className="mt-auto pt-[0.7rem] flex justify-end">
                      <SecondaryButton type="button" disabled={removingId === item.id} onClick={() => void removeItem(item)}>
                        <TrashIcon />{copy.remove}
                      </SecondaryButton>
                    </div>
                  )}
                </WordCard>
              ))}
            </div>
          ) : (
            <StateBox><BookOpenIcon /><strong>{copy.noItems}</strong></StateBox>
          )}
        </section>
      </Shell>
    </Page>
  );
}
