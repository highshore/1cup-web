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
  BookOpenIcon,
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

type DeckVisibility = "private" | "public";
type DeckTheme = "orange" | "blue" | "green" | "purple" | "pink";

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
  updatedAt: string;
};

const copyByLocale = {
  ko: {
    myCollections: "내 단어장",
    myCollectionsHint: "내가 만든 단어장과 추가한 공개 단어장입니다.",
    publicCollections: "공개 단어장",
    publicCollectionsHint: "1 Cup English와 다른 멤버가 만든 공개 단어장을 둘러보세요.",
    createCollection: "새 단어장 만들기",
    noCollections: "아직 내 단어장이 없습니다.",
    noCollectionsHint: "직접 만들거나 아래 공개 단어장을 추가해 보세요.",
    noPublicCollections: "공개 단어장이 없습니다.",
    searchPublic: "공개 단어장 검색",
    official: "공식",
    own: "내 단어장",
    added: "추가됨",
    add: "추가",
    remove: "제거",
    addedUsers: "추가한 유저",
    items: "개 표현",
    public: "공개",
    private: "비공개",
    createTitle: "새 단어장 만들기",
    name: "단어장 이름",
    namePlaceholder: "예: 회의에서 자주 쓰는 표현",
    description: "설명",
    descriptionPlaceholder: "이 단어장을 어떤 목적으로 만들었는지 적어주세요.",
    visibility: "공개 설정",
    publicDescription: "다른 멤버가 검색하고 추가할 수 있습니다.",
    privateDescription: "나만 볼 수 있습니다.",
    cancel: "취소",
    create: "만들기",
    loading: "단어장을 불러오는 중...",
    loadError: "단어장을 불러오지 못했습니다. 다시 시도해 주세요.",
    createError: "단어장을 만들지 못했습니다.",
    followError: "단어장 추가 상태를 변경하지 못했습니다.",
    retry: "다시 시도",
    personalName: "내 단어장",
    personalDescription: "내가 저장한 모든 단어와 표현이 자동으로 모이는 기본 단어장입니다.",
  },
  en: {
    myCollections: "My decks",
    myCollectionsHint: "Decks you own and public decks you added.",
    publicCollections: "Public decks",
    publicCollectionsHint: "Explore public decks made by 1 Cup English and other members.",
    createCollection: "Create deck",
    noCollections: "You do not have any decks yet.",
    noCollectionsHint: "Create one or add a public deck below.",
    noPublicCollections: "There are no public decks yet.",
    searchPublic: "Search public decks",
    official: "Official",
    own: "Mine",
    added: "Added",
    add: "Add",
    remove: "Remove",
    addedUsers: "added users",
    items: "items",
    public: "Public",
    private: "Private",
    createTitle: "Create a new deck",
    name: "Deck name",
    namePlaceholder: "e.g. Expressions for meetings",
    description: "Description",
    descriptionPlaceholder: "What is this deck for?",
    visibility: "Visibility",
    publicDescription: "Other members can discover and add it.",
    privateDescription: "Only you can see it.",
    cancel: "Cancel",
    create: "Create",
    loading: "Loading decks...",
    loadError: "We could not load the decks. Please try again.",
    createError: "We could not create that deck.",
    followError: "We could not update the added state.",
    retry: "Try again",
    personalName: "My Vocabulary",
    personalDescription: "Your built-in deck containing every word and expression you save.",
  },
} as const;

const themeAccent: Record<DeckTheme, string> = {
  orange: "#f47a4a",
  blue: "#8ab4f8",
  green: "#7bc99a",
  purple: "#b39ddb",
  pink: "#f3a4c0",
};

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

function PrimaryButton({ className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[0.38rem] min-h-[2.55rem] border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-[0.55rem] px-[0.9rem] text-[0.84rem] font-black cursor-pointer shadow-[3px_3px_0_#050505] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:w-[17px] [&_svg]:h-[17px] ${className}`}
      {...rest}
    >
      {children}
    </button>
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
      className={`inline-flex items-center justify-center gap-[0.3rem] border-[1.5px] border-[#050505] rounded-full ${$active ? "bg-[#050505] text-white" : "bg-white text-[#050505]"} py-[0.42rem] px-[0.65rem] text-[0.72rem] font-black cursor-pointer whitespace-nowrap disabled:opacity-[0.48] disabled:cursor-not-allowed [&_svg]:w-[14px] [&_svg]:h-[14px] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <section className="mt-[1.4rem] first-of-type:mt-[0.35rem]">{children}</section>;
}

function SectionTop({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-[0.8rem] mb-3 max-[640px]:items-start max-[640px]:flex-wrap">
      {children}
    </div>
  );
}

function SectionText({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1">{children}</div>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h1 className="m-0 text-[#050505] text-[1.35rem] font-[950]">{children}</h1>;
}

function SectionHint({ children }: { children: ReactNode }) {
  return <p className="mt-[0.15rem] mb-0 text-[rgba(5,5,5,0.58)] text-[0.8rem] leading-[1.45]">{children}</p>;
}

function DeckGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-[0.8rem] max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
      {children}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center min-h-[1.45rem] border-[1.5px] border-[#050505] rounded-full bg-white py-0 px-[0.45rem] text-[#050505] text-[0.64rem] font-black">
      {children}
    </span>
  );
}

function StateBox({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`py-8 px-4 border-2 border-dashed border-[#050505] rounded-2xl bg-white text-center text-[rgba(5,5,5,0.62)] [&_svg]:w-[34px] [&_svg]:h-[34px] [&_svg]:text-[#050505] [&_strong]:block [&_strong]:mt-[0.55rem] [&_strong]:text-[#050505] [&_p]:mt-[0.3rem] [&_p]:mb-0 [&_p]:leading-[1.5] [&_p]:text-[0.78rem] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function Field({ children }: { children: ReactNode }) {
  return <label className="block mt-[0.8rem] text-[#050505] text-[0.78rem] font-black">{children}</label>;
}

const mapDeck = (row: any): Deck => ({
  id: String(row.id),
  ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
  name: String(row.name || ""),
  description: String(row.description || ""),
  visibility: row.visibility === "public" ? "public" : "private",
  icon: String(row.icon || "📚"),
  theme: (["orange", "blue", "green", "purple", "pink"].includes(row.theme) ? row.theme : "orange") as DeckTheme,
  isOfficial: Boolean(row.is_official),
  systemKey: typeof row.system_key === "string" ? row.system_key : null,
  itemCount: Number(row.item_count || 0),
  followerCount: Number(row.follower_count || 0),
  updatedAt: String(row.updated_at || row.created_at || ""),
});

export default function VocabularyClient() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { locale } = useI18n();
  const copy = copyByLocale[locale];

  const [ownDecks, setOwnDecks] = useState<Deck[]>([]);
  const [publicDecks, setPublicDecks] = useState<Deck[]>([]);
  const [followedDeckIds, setFollowedDeckIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [updatingDeckId, setUpdatingDeckId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDescription, setNewDeckDescription] = useState("");
  const [newDeckVisibility, setNewDeckVisibility] = useState<DeckVisibility>("private");
  const [creatingDeck, setCreatingDeck] = useState(false);

  const loadDecks = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const { error: ensureError } = await supabase.rpc("ensure_personal_vocabulary_deck");
      if (ensureError) throw ensureError;

      const [ownResult, publicResult, followResult] = await Promise.all([
        supabase
          .from("vocabulary_decks")
          .select("*")
          .eq("owner_user_id", currentUser.uid)
          .order("updated_at", { ascending: false }),
        supabase
          .from("vocabulary_decks")
          .select("*")
          .eq("visibility", "public")
          .order("follower_count", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("vocabulary_deck_follows")
          .select("deck_id")
          .eq("user_id", currentUser.uid),
      ]);

      if (ownResult.error) throw ownResult.error;
      if (publicResult.error) throw publicResult.error;
      if (followResult.error) throw followResult.error;

      const mappedOwn = (ownResult.data || []).map(mapDeck).sort((a, b) => {
        const aPersonal = a.systemKey?.startsWith("personal:") ? 0 : 1;
        const bPersonal = b.systemKey?.startsWith("personal:") ? 0 : 1;
        if (aPersonal !== bPersonal) return aPersonal - bPersonal;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
      setOwnDecks(mappedOwn);
      setPublicDecks((publicResult.data || []).map(mapDeck));
      setFollowedDeckIds(new Set((followResult.data || []).map((row: any) => String(row.deck_id))));
    } catch (loadFailure) {
      console.error("Unable to load vocabulary decks:", loadFailure);
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, currentUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth?redirect=%2Fvocabulary");
      return;
    }
    void loadDecks();
  }, [authLoading, currentUser, loadDecks, router]);

  const followedDecks = useMemo(
    () => publicDecks.filter((deck) => followedDeckIds.has(deck.id)),
    [followedDeckIds, publicDecks],
  );

  const personalDecks = useMemo(() => {
    const combined = [...ownDecks, ...followedDecks];
    const seen = new Set<string>();
    return combined.filter((deck) => {
      if (seen.has(deck.id)) return false;
      seen.add(deck.id);
      return true;
    });
  }, [followedDecks, ownDecks]);

  const filteredPublicDecks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return publicDecks;
    return publicDecks.filter(
      (deck) =>
        deck.name.toLowerCase().includes(normalized) ||
        deck.description.toLowerCase().includes(normalized),
    );
  }, [publicDecks, query]);

  const displayName = (deck: Deck) =>
    deck.systemKey?.startsWith("personal:") ? copy.personalName : deck.name;
  const displayDescription = (deck: Deck) =>
    deck.systemKey?.startsWith("personal:") ? copy.personalDescription : deck.description;

  const toggleFollow = async (deck: Deck) => {
    if (!currentUser || deck.ownerUserId === currentUser.uid || deck.visibility !== "public") return;
    const isAdded = followedDeckIds.has(deck.id);
    setUpdatingDeckId(deck.id);
    try {
      if (isAdded) {
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
      await loadDecks();
    } catch (followFailure) {
      console.error("Unable to update deck added state:", followFailure);
      window.alert(copy.followError);
    } finally {
      setUpdatingDeckId(null);
    }
  };

  const createDeck = async () => {
    if (!currentUser || !newDeckName.trim()) return;
    setCreatingDeck(true);
    try {
      const { data, error: createError } = await supabase
        .from("vocabulary_decks")
        .insert({
          owner_user_id: currentUser.uid,
          name: newDeckName.trim(),
          description: newDeckDescription.trim(),
          visibility: newDeckVisibility,
          icon: "📚",
          theme: "orange",
          is_official: false,
        })
        .select("id")
        .single();
      if (createError) throw createError;

      setCreateOpen(false);
      setNewDeckName("");
      setNewDeckDescription("");
      setNewDeckVisibility("private");
      if (data?.id) router.push(`/vocabulary/decks/${data.id}`);
      else await loadDecks();
    } catch (createFailure) {
      console.error("Unable to create vocabulary deck:", createFailure);
      window.alert(copy.createError);
    } finally {
      setCreatingDeck(false);
    }
  };

  const renderDeck = (deck: Deck) => {
    const isMine = deck.ownerUserId === currentUser?.uid;
    const isAdded = followedDeckIds.has(deck.id);
    const isPersonal = deck.systemKey?.startsWith("personal:");
    return (
      <article
        key={deck.id}
        className="min-h-[176px] relative flex flex-col justify-between overflow-hidden border-2 border-[#050505] rounded-2xl bg-white p-4 shadow-[4px_4px_0_rgba(5,5,5,0.9)]"
      >
        <div
          className="absolute top-0 bottom-0 left-0 w-[7px]"
          style={{ background: themeAccent[deck.theme] }}
        />
        <Link
          href={`/vocabulary/decks/${deck.id}`}
          className="block text-inherit no-underline hover:text-inherit hover:no-underline"
        >
          <div className="flex items-start justify-between gap-[0.7rem]">
            <div className="text-[1.55rem] leading-none">{deck.icon}</div>
            <div className="flex gap-[0.3rem] flex-wrap justify-end">
              {deck.isOfficial && <Badge>{copy.official}</Badge>}
              {isMine && <Badge>{isPersonal ? copy.personalName : copy.own}</Badge>}
              {!isMine && isAdded && <Badge>{copy.added}</Badge>}
              {deck.visibility === "private" && <Badge>{copy.private}</Badge>}
            </div>
          </div>
          <h2 className="mt-[0.65rem] mb-[0.25rem] text-[#050505] text-[1.03rem] font-[950] leading-[1.25]">{displayName(deck)}</h2>
          <p className="m-0 min-h-[2.2em] text-[rgba(5,5,5,0.62)] text-[0.77rem] leading-[1.45] line-clamp-2">{displayDescription(deck)}</p>
        </Link>
        <div className="flex items-center justify-between gap-[0.55rem] mt-[0.85rem]">
          <div className="flex flex-wrap gap-y-[0.35rem] gap-x-[0.65rem] text-[rgba(5,5,5,0.58)] text-[0.68rem] font-extrabold">
            <span>{deck.itemCount} {copy.items}</span>
            {deck.visibility === "public" && <span>{deck.followerCount} {copy.addedUsers}</span>}
          </div>
          {!isMine && deck.visibility === "public" && (
            <SecondaryButton
              type="button"
              $active={isAdded}
              disabled={updatingDeckId === deck.id}
              onClick={() => void toggleFollow(deck)}
            >
              <UserGroupIcon />
              {isAdded ? copy.remove : copy.add}
            </SecondaryButton>
          )}
        </div>
      </article>
    );
  };

  if (authLoading || loading) {
    return <Page><Shell><StateBox>{copy.loading}</StateBox></Shell></Page>;
  }

  if (error) {
    return (
      <Page><Shell><StateBox><strong>{error}</strong><PrimaryButton style={{ marginTop: "0.85rem" }} onClick={() => void loadDecks()}>{copy.retry}</PrimaryButton></StateBox></Shell></Page>
    );
  }

  return (
    <Page>
      <Shell>
        <Section>
          <SectionTop>
            <SectionText>
              <SectionTitle>{copy.myCollections}</SectionTitle>
              <SectionHint>{copy.myCollectionsHint}</SectionHint>
            </SectionText>
            <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
              <FolderPlusIcon />{copy.createCollection}
            </PrimaryButton>
          </SectionTop>
          {personalDecks.length > 0 ? (
            <DeckGrid>{personalDecks.map(renderDeck)}</DeckGrid>
          ) : (
            <StateBox>
              <BookOpenIcon />
              <strong>{copy.noCollections}</strong>
              <p>{copy.noCollectionsHint}</p>
            </StateBox>
          )}
        </Section>

        <Section>
          <SectionTop>
            <SectionText>
              <SectionTitle>{copy.publicCollections}</SectionTitle>
              <SectionHint>{copy.publicCollectionsHint}</SectionHint>
            </SectionText>
            <label className="flex items-center gap-2 w-[min(340px,100%)] border-2 border-[#050505] rounded-full bg-white py-0 px-3 [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:flex-none">
              <MagnifyingGlassIcon />
              <input
                className="w-full border-0 outline-0 bg-transparent py-[0.65rem] px-0 text-[#050505] text-[0.82rem]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPublic}
              />
            </label>
          </SectionTop>
          {filteredPublicDecks.length > 0 ? (
            <DeckGrid>{filteredPublicDecks.map(renderDeck)}</DeckGrid>
          ) : (
            <StateBox><BookOpenIcon /><strong>{copy.noPublicCollections}</strong></StateBox>
          )}
        </Section>
      </Shell>

      {createOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.55)] p-4"
          onClick={() => !creatingDeck && setCreateOpen(false)}
        >
          <div
            className="w-[min(620px,100%)] max-h-[86vh] overflow-y-auto border-2 border-[#050505] rounded-[18px] bg-white p-[1.1rem] shadow-[7px_7px_0_#050505]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-[0.8rem] mb-[0.8rem]">
              <h2 className="m-0 text-[#050505] text-[1.25rem] font-[950]">{copy.createTitle}</h2>
              <button
                type="button"
                className="w-[34px] h-[34px] inline-flex items-center justify-center border-2 border-[#050505] rounded-full bg-white cursor-pointer [&_svg]:w-[17px] [&_svg]:h-[17px]"
                onClick={() => setCreateOpen(false)}
                aria-label={copy.cancel}
              ><XMarkIcon /></button>
            </div>

            <Field>{copy.name}
              <input
                className="w-full mt-[0.35rem] border-2 border-[#050505] rounded-xl bg-white p-3 text-[#050505] text-[0.9rem] outline-none"
                value={newDeckName}
                maxLength={80}
                onChange={(event) => setNewDeckName(event.target.value)}
                placeholder={copy.namePlaceholder}
              />
            </Field>
            <Field>{copy.description}
              <textarea
                className="w-full min-h-[90px] mt-[0.35rem] border-2 border-[#050505] rounded-xl bg-white p-3 text-[#050505] text-[0.9rem] resize-y outline-none"
                value={newDeckDescription}
                maxLength={500}
                onChange={(event) => setNewDeckDescription(event.target.value)}
                placeholder={copy.descriptionPlaceholder}
              />
            </Field>
            <Field>{copy.visibility}</Field>
            <div className="grid grid-cols-2 gap-[0.6rem] mt-[0.4rem] max-[520px]:grid-cols-1">
              <button
                type="button"
                className={`w-full flex items-start gap-[0.6rem] border-2 border-[#050505] rounded-xl ${newDeckVisibility === "private" ? "bg-[#f5f5f5]" : "bg-white"} p-3 text-left cursor-pointer [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:flex-none`}
                onClick={() => setNewDeckVisibility("private")}
              >
                <EyeSlashIcon /><div><strong>{copy.private}</strong><div>{copy.privateDescription}</div></div>
              </button>
              <button
                type="button"
                className={`w-full flex items-start gap-[0.6rem] border-2 border-[#050505] rounded-xl ${newDeckVisibility === "public" ? "bg-[#f5f5f5]" : "bg-white"} p-3 text-left cursor-pointer [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:flex-none`}
                onClick={() => setNewDeckVisibility("public")}
              >
                <EyeIcon /><div><strong>{copy.public}</strong><div>{copy.publicDescription}</div></div>
              </button>
            </div>

            <div className="flex justify-end gap-[0.55rem] mt-4">
              <SecondaryButton type="button" onClick={() => setCreateOpen(false)}>{copy.cancel}</SecondaryButton>
              <PrimaryButton type="button" disabled={creatingDeck || !newDeckName.trim()} onClick={() => void createDeck()}>
                <PlusIcon />{copy.create}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
