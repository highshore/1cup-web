"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  EyeSlashIcon,
  FolderPlusIcon,
  MinusIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase/client";

import "./vocabulary.css";

type DeckVisibility = "private" | "public";

type Deck = {
  id: string;
  ownerUserId: string | null;
  name: string;
  description: string;
  visibility: DeckVisibility;
  icon: string;
  coverImageUrl: string | null;
  isOfficial: boolean;
  systemKey: string | null;
  itemCount: number;
  followerCount: number;
  updatedAt: string;
};

const copyByLocale = {
  ko: {
    myDecks: "내 단어장",
    myDecksHint: "내가 만든 단어장과 추가한 공용 단어장입니다.",
    sharedDecks: "공용 단어장",
    sharedDecksHint: "1 Cup English와 다른 멤버가 만든 단어장을 둘러보세요.",
    createDeck: "새 단어장 만들기",
    emptyMine: "아직 내 단어장이 없습니다.",
    emptyShared: "아직 공용 단어장이 없습니다.",
    official: "공식",
    mine: "내 단어장",
    added: "추가됨",
    add: "추가",
    remove: "제거",
    addedUsers: "명 추가",
    items: "개 단어",
    private: "비공개",
    createTitle: "새 단어장 만들기",
    name: "단어장 이름",
    namePlaceholder: "예: 회의에서 자주 쓰는 표현",
    description: "설명",
    descriptionPlaceholder: "이 단어장을 어떤 목적으로 만들었는지 적어주세요.",
    visibility: "공개 설정",
    public: "공용",
    publicDescription: "다른 멤버가 찾아보고 추가할 수 있습니다.",
    privateDescription: "나만 볼 수 있습니다.",
    cancel: "취소",
    create: "만들기",
    loading: "단어장을 불러오는 중...",
    loadError: "단어장을 불러오지 못했습니다.",
    createError: "단어장을 만들지 못했습니다.",
    followError: "단어장 추가 상태를 변경하지 못했습니다.",
    retry: "다시 시도",
    personalName: "내 단어장",
    personalDescription: "저장한 모든 단어와 표현이 자동으로 모이는 기본 단어장입니다.",
  },
  en: {
    myDecks: "My decks",
    myDecksHint: "Decks you own and shared decks you added.",
    sharedDecks: "Shared decks",
    sharedDecksHint: "Browse decks made by 1 Cup English and other members.",
    createDeck: "Create deck",
    emptyMine: "You do not have any decks yet.",
    emptyShared: "There are no shared decks yet.",
    official: "Official",
    mine: "Mine",
    added: "Added",
    add: "Add",
    remove: "Remove",
    addedUsers: "added",
    items: "words",
    private: "Private",
    createTitle: "Create a new deck",
    name: "Deck name",
    namePlaceholder: "e.g. Expressions for meetings",
    description: "Description",
    descriptionPlaceholder: "What is this deck for?",
    visibility: "Visibility",
    public: "Shared",
    publicDescription: "Other members can browse and add it.",
    privateDescription: "Only you can see it.",
    cancel: "Cancel",
    create: "Create",
    loading: "Loading decks...",
    loadError: "We could not load the decks.",
    createError: "We could not create that deck.",
    followError: "We could not update that deck.",
    retry: "Try again",
    personalName: "My Vocabulary",
    personalDescription: "Your built-in deck containing everything you save.",
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

function Section({ children }: { children: ReactNode }) {
  return <section className="mt-[1.7rem] first-of-type:mt-[0.45rem]">{children}</section>;
}

function SectionTop({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-between gap-[0.8rem] mb-3">{children}</div>;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h1 className="m-0 text-[#050505] text-[1.35rem] font-[950]">{children}</h1>;
}

function SectionHint({ children }: { children: ReactNode }) {
  return <p className="mt-[0.14rem] mb-0 text-[rgba(5,5,5,0.56)] text-[0.8rem] leading-[1.45]">{children}</p>;
}

function PrimaryButton({ className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[0.38rem] min-h-[2.5rem] border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-2 px-[0.85rem] text-[0.78rem] font-[950] cursor-pointer shadow-[2px_2px_0_#050505] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:w-4 [&_svg]:h-4 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function DeckGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-[0.8rem] max-[720px]:grid-cols-1">{children}</div>;
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border-[1.5px] border-[#050505] rounded-full bg-white py-[0.2rem] px-[0.42rem] text-[#050505] text-[0.6rem] font-black whitespace-nowrap">
      {children}
    </span>
  );
}

function SmallButton({
  $active,
  className = "",
  children,
  ...rest
}: { $active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1 border-[1.5px] border-[#050505] rounded-full ${$active ? "bg-[#050505] text-white" : "bg-white text-[#050505]"} py-[0.37rem] px-[0.55rem] text-[0.66rem] font-black cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:w-[13px] [&_svg]:h-[13px] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="py-8 px-4 border-2 border-dashed border-[#050505] rounded-2xl bg-white text-[rgba(5,5,5,0.58)] text-center text-[0.8rem]">
      {children}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="h-[142px] border-2 border-[rgba(5,5,5,0.12)] rounded-2xl bg-[linear-gradient(90deg,#eceae6_25%,#f7f6f3_50%,#eceae6_75%)] bg-[length:200%_100%] animate-[vocab-skeleton-pulse_1.3s_infinite_linear]" />
  );
}

function Field({ children }: { children: ReactNode }) {
  return <label className="block mt-[0.85rem] text-[#050505] text-[0.76rem] font-black">{children}</label>;
}

function mapDeck(row: any): Deck {
  return {
    id: String(row.id),
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    name: String(row.name || ""),
    description: String(row.description || ""),
    visibility: row.visibility === "public" ? "public" : "private",
    icon: String(row.icon || "📚"),
    coverImageUrl: typeof row.cover_image_url === "string" && row.cover_image_url ? row.cover_image_url : null,
    isOfficial: Boolean(row.is_official),
    systemKey: typeof row.system_key === "string" ? row.system_key : null,
    itemCount: Number(row.item_count || 0),
    followerCount: Number(row.follower_count || 0),
    updatedAt: String(row.updated_at || row.created_at || ""),
  };
}

export default function VocabularyHomeClient() {
  const router = useRouter();
  const { currentUser, isLoading: authLoading } = useAuth();
  const { locale } = useI18n();
  const copy = copyByLocale[locale];
  const [ownDecks, setOwnDecks] = useState<Deck[]>([]);
  const [sharedDecks, setSharedDecks] = useState<Deck[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<DeckVisibility>("private");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(false);
    try {
      const { error: ensureError } = await supabase.rpc("ensure_personal_vocabulary_deck");
      if (ensureError) throw ensureError;
      const [ownResult, sharedResult, addedResult] = await Promise.all([
        supabase.from("vocabulary_decks").select("*").eq("owner_user_id", currentUser.uid).order("updated_at", { ascending: false }),
        supabase.from("vocabulary_decks").select("*").eq("visibility", "public").order("follower_count", { ascending: false }).order("updated_at", { ascending: false }).limit(100),
        supabase.from("vocabulary_deck_follows").select("deck_id").eq("user_id", currentUser.uid),
      ]);
      if (ownResult.error) throw ownResult.error;
      if (sharedResult.error) throw sharedResult.error;
      if (addedResult.error) throw addedResult.error;
      const own = (ownResult.data || []).map(mapDeck).sort((a, b) => {
        const pa = a.systemKey?.startsWith("personal:") ? 0 : 1;
        const pb = b.systemKey?.startsWith("personal:") ? 0 : 1;
        return pa - pb || b.updatedAt.localeCompare(a.updatedAt);
      });
      setOwnDecks(own);
      setSharedDecks((sharedResult.data || []).map(mapDeck));
      setAddedIds(new Set((addedResult.data || []).map((row: any) => String(row.deck_id))));
    } catch (failure) {
      console.error("Unable to load vocabulary decks:", failure);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth?redirect=%2Fvocabulary");
      return;
    }
    void load();
  }, [authLoading, currentUser, load, router]);

  const myDecks = useMemo(() => {
    const seen = new Set<string>();
    return [...ownDecks, ...sharedDecks.filter((deck) => addedIds.has(deck.id))].filter((deck) => {
      if (seen.has(deck.id)) return false;
      seen.add(deck.id);
      return true;
    });
  }, [addedIds, ownDecks, sharedDecks]);

  const displayName = (deck: Deck) => deck.systemKey?.startsWith("personal:") ? copy.personalName : deck.name;
  const displayDescription = (deck: Deck) => deck.systemKey?.startsWith("personal:") ? copy.personalDescription : deck.description;

  const toggleAdded = async (deck: Deck) => {
    if (!currentUser || deck.ownerUserId === currentUser.uid) return;
    const isAdded = addedIds.has(deck.id);
    setUpdatingId(deck.id);
    try {
      if (isAdded) {
        const { error: followError } = await supabase.from("vocabulary_deck_follows").delete().eq("deck_id", deck.id).eq("user_id", currentUser.uid);
        if (followError) throw followError;
      } else {
        const { error: followError } = await supabase.from("vocabulary_deck_follows").insert({ deck_id: deck.id, user_id: currentUser.uid });
        if (followError) throw followError;
      }
      await load();
    } catch (failure) {
      console.error("Unable to update deck:", failure);
      window.alert(copy.followError);
    } finally {
      setUpdatingId(null);
    }
  };

  const createDeck = async () => {
    if (!currentUser || !name.trim()) return;
    setCreating(true);
    try {
      const { data, error: createError } = await supabase.from("vocabulary_decks").insert({
        owner_user_id: currentUser.uid,
        name: name.trim(),
        description: description.trim(),
        visibility,
        icon: "📚",
        theme: "orange",
        is_official: false,
      }).select("id").single();
      if (createError) throw createError;
      setCreateOpen(false);
      setName("");
      setDescription("");
      setVisibility("private");
      router.push(`/vocabulary/decks/${data.id}`);
    } catch (failure) {
      console.error("Unable to create deck:", failure);
      window.alert(copy.createError);
    } finally {
      setCreating(false);
    }
  };

  const renderDeck = (deck: Deck) => {
    const mine = deck.ownerUserId === currentUser?.uid;
    const added = addedIds.has(deck.id);
    const personal = deck.systemKey?.startsWith("personal:");
    return (
      <article
        key={deck.id}
        className="min-w-0 min-h-[142px] grid grid-cols-[132px_minmax(0,1fr)] overflow-hidden border-2 border-[#050505] rounded-2xl bg-white shadow-[3px_3px_0_#050505] max-[480px]:grid-cols-[100px_minmax(0,1fr)]"
      >
        <Link
          href={`/vocabulary/decks/${deck.id}`}
          className="flex items-center justify-center min-h-[142px] border-r-2 border-r-[#050505] text-[#050505] text-[2.5rem] no-underline"
          style={{
            background: deck.coverImageUrl
              ? `url(${JSON.stringify(deck.coverImageUrl)}) center/cover no-repeat`
              : "#f1efeb",
          }}
        >
          {deck.coverImageUrl ? null : deck.icon}
        </Link>
        <div className="min-w-0 flex flex-col pt-[0.85rem] px-[0.9rem] pb-[0.8rem]">
          <div className="flex items-start justify-between gap-[0.55rem]">
            <Link href={`/vocabulary/decks/${deck.id}`} className="min-w-0 text-[#050505] no-underline hover:underline">
              <h2 className="m-0 text-[#050505] text-[1rem] leading-[1.25] font-[950] [overflow-wrap:anywhere]">{displayName(deck)}</h2>
            </Link>
            <div className="flex gap-[0.3rem] flex-wrap justify-end">
              {deck.isOfficial && <Badge>{copy.official}</Badge>}
              {mine && <Badge>{personal ? copy.personalName : copy.mine}</Badge>}
              {!mine && added && <Badge>{copy.added}</Badge>}
              {deck.visibility === "private" && <Badge>{copy.private}</Badge>}
            </div>
          </div>
          <p className="mt-[0.36rem] mb-0 text-[rgba(5,5,5,0.61)] text-[0.75rem] leading-[1.45] line-clamp-2">{displayDescription(deck)}</p>
          <div className="mt-auto pt-[0.65rem] flex items-center justify-between gap-[0.55rem]">
            <div className="flex flex-wrap gap-y-[0.35rem] gap-x-[0.55rem] text-[rgba(5,5,5,0.52)] text-[0.65rem] font-extrabold">
              <span>{deck.itemCount} {copy.items}</span>
              {deck.visibility === "public" && <span>{deck.followerCount} {copy.addedUsers}</span>}
            </div>
            {!mine && (
              <SmallButton type="button" $active={added} disabled={updatingId === deck.id} onClick={() => void toggleAdded(deck)}>
                {added ? <MinusIcon /> : <PlusIcon />}{added ? copy.remove : copy.add}
              </SmallButton>
            )}
          </div>
        </div>
      </article>
    );
  };

  if (authLoading || loading) {
    return <Page><Shell><DeckGrid><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></DeckGrid></Shell></Page>;
  }

  if (error) {
    return <Page><Shell><Empty>{copy.loadError}<div style={{ marginTop: 12 }}><PrimaryButton onClick={() => void load()}>{copy.retry}</PrimaryButton></div></Empty></Shell></Page>;
  }

  return (
    <Page>
      <Shell>
        <Section>
          <SectionTop>
            <div><SectionTitle>{copy.myDecks}</SectionTitle><SectionHint>{copy.myDecksHint}</SectionHint></div>
            <PrimaryButton type="button" onClick={() => setCreateOpen(true)}><FolderPlusIcon />{copy.createDeck}</PrimaryButton>
          </SectionTop>
          {myDecks.length ? <DeckGrid>{myDecks.map(renderDeck)}</DeckGrid> : <Empty>{copy.emptyMine}</Empty>}
        </Section>

        <Section>
          <SectionTop><div><SectionTitle>{copy.sharedDecks}</SectionTitle><SectionHint>{copy.sharedDecksHint}</SectionHint></div></SectionTop>
          {sharedDecks.length ? <DeckGrid>{sharedDecks.map(renderDeck)}</DeckGrid> : <Empty>{copy.emptyShared}</Empty>}
        </Section>
      </Shell>

      {createOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.55)] p-4"
          onClick={() => !creating && setCreateOpen(false)}
        >
          <div
            className="w-[min(600px,100%)] max-h-[88vh] overflow-y-auto border-2 border-[#050505] rounded-[18px] bg-white p-[1.1rem] shadow-[7px_7px_0_#050505]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-[0.8rem]">
              <h2 className="m-0 text-[#050505] text-[1.18rem] font-[950]">{copy.createTitle}</h2>
              <button
                type="button"
                className="w-[34px] h-[34px] inline-flex items-center justify-center border-2 border-[#050505] rounded-full bg-white cursor-pointer [&_svg]:w-4 [&_svg]:h-4"
                onClick={() => setCreateOpen(false)}
              ><XMarkIcon /></button>
            </div>
            <Field>{copy.name}
              <input
                className="w-full mt-[0.35rem] border-2 border-[#050505] rounded-xl bg-white p-[0.72rem] text-[#050505] text-[0.86rem] outline-none"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder={copy.namePlaceholder}
              />
            </Field>
            <Field>{copy.description}
              <textarea
                className="w-full min-h-[90px] mt-[0.35rem] border-2 border-[#050505] rounded-xl bg-white p-[0.72rem] text-[#050505] text-[0.86rem] resize-y outline-none"
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={copy.descriptionPlaceholder}
              />
            </Field>
            <Field>{copy.visibility}</Field>
            <div className="grid grid-cols-2 gap-[0.55rem] mt-[0.4rem]">
              <button
                type="button"
                className={`flex items-start gap-[0.45rem] border-2 border-[#050505] rounded-xl ${visibility === "private" ? "bg-[#f2f1ee]" : "bg-white"} p-[0.7rem] text-left cursor-pointer [&_svg]:w-[17px] [&_svg]:h-[17px] [&_svg]:flex-none`}
                onClick={() => setVisibility("private")}
              >
                <EyeSlashIcon /><div><strong className="block text-[0.76rem]">{copy.private}</strong><span className="block mt-[0.15rem] text-[rgba(5,5,5,0.56)] text-[0.68rem] leading-[1.35]">{copy.privateDescription}</span></div>
              </button>
              <button
                type="button"
                className={`flex items-start gap-[0.45rem] border-2 border-[#050505] rounded-xl ${visibility === "public" ? "bg-[#f2f1ee]" : "bg-white"} p-[0.7rem] text-left cursor-pointer [&_svg]:w-[17px] [&_svg]:h-[17px] [&_svg]:flex-none`}
                onClick={() => setVisibility("public")}
              >
                <EyeIcon /><div><strong className="block text-[0.76rem]">{copy.public}</strong><span className="block mt-[0.15rem] text-[rgba(5,5,5,0.56)] text-[0.68rem] leading-[1.35]">{copy.publicDescription}</span></div>
              </button>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <SmallButton type="button" onClick={() => setCreateOpen(false)}>{copy.cancel}</SmallButton>
              <PrimaryButton type="button" disabled={creating || !name.trim()} onClick={() => void createDeck()}><PlusIcon />{copy.create}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
