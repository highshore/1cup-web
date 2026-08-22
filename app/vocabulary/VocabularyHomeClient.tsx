"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import {
  EyeIcon,
  EyeSlashIcon,
  FolderPlusIcon,
  MinusIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { appLayout } from "../lib/constants/app_layout";
import { useAuth } from "../lib/contexts/auth_context";
import { useI18n } from "../lib/i18n/I18nProvider";
import { supabase } from "../lib/supabase/client";

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

const Section = styled.section`
  margin-top: 1.7rem;
  &:first-of-type { margin-top: 0.45rem; }
`;

const SectionTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.75rem;
`;

const SectionTitle = styled.h1`
  margin: 0;
  color: #050505;
  font-size: 1.35rem;
  font-weight: 950;
`;

const SectionHint = styled.p`
  margin: 0.14rem 0 0;
  color: rgba(5, 5, 5, 0.56);
  font-size: 0.8rem;
  line-height: 1.45;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  min-height: 2.5rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  color: #050505;
  padding: 0.5rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;
  white-space: nowrap;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  svg { width: 16px; height: 16px; }
`;

const DeckGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;

  @media (max-width: 720px) { grid-template-columns: 1fr; }
`;

const DeckCard = styled.article`
  min-width: 0;
  min-height: 142px;
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 3px 3px 0 #050505;

  @media (max-width: 480px) {
    grid-template-columns: 100px minmax(0, 1fr);
  }
`;

const Cover = styled(Link)<{ $image?: string | null }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 142px;
  border-right: 2px solid #050505;
  background: ${(p) => p.$image ? `url(${JSON.stringify(p.$image)}) center/cover no-repeat` : "#f1efeb"};
  color: #050505;
  font-size: 2.5rem;
  text-decoration: none;
`;

const DeckBody = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 0.85rem 0.9rem 0.8rem;
`;

const DeckTitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.55rem;
`;

const DeckLink = styled(Link)`
  min-width: 0;
  color: #050505;
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const DeckName = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1rem;
  line-height: 1.25;
  font-weight: 950;
  overflow-wrap: anywhere;
`;

const BadgeRow = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0.2rem 0.42rem;
  color: #050505;
  font-size: 0.6rem;
  font-weight: 900;
  white-space: nowrap;
`;

const Description = styled.p`
  margin: 0.36rem 0 0;
  color: rgba(5, 5, 5, 0.61);
  font-size: 0.75rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Footer = styled.div`
  margin-top: auto;
  padding-top: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.55rem;
  color: rgba(5, 5, 5, 0.52);
  font-size: 0.65rem;
  font-weight: 800;
`;

const SmallButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: ${(p) => (p.$active ? "#050505" : "#ffffff")};
  color: ${(p) => (p.$active ? "#ffffff" : "#050505")};
  padding: 0.37rem 0.55rem;
  font-size: 0.66rem;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
  svg { width: 13px; height: 13px; }
`;

const Empty = styled.div`
  padding: 2rem 1rem;
  border: 2px dashed #050505;
  border-radius: 16px;
  background: #ffffff;
  color: rgba(5, 5, 5, 0.58);
  text-align: center;
  font-size: 0.8rem;
`;

const SkeletonGrid = styled(DeckGrid)``;
const SkeletonCard = styled.div`
  height: 142px;
  border: 2px solid rgba(5,5,5,0.12);
  border-radius: 16px;
  background: linear-gradient(90deg, #eceae6 25%, #f7f6f3 50%, #eceae6 75%);
  background-size: 200% 100%;
  animation: pulse 1.3s infinite linear;
  @keyframes pulse { from { background-position: 200% 0; } to { background-position: -200% 0; } }
`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.55);
  padding: 1rem;
`;

const Modal = styled.div`
  width: min(600px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  border: 2px solid #050505;
  border-radius: 18px;
  background: #ffffff;
  padding: 1.1rem;
  box-shadow: 7px 7px 0 #050505;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-size: 1.18rem;
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
  svg { width: 16px; height: 16px; }
`;

const Field = styled.label`
  display: block;
  margin-top: 0.85rem;
  color: #050505;
  font-size: 0.76rem;
  font-weight: 900;
`;

const Input = styled.input`
  width: 100%;
  margin-top: 0.35rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.72rem;
  color: #050505;
  font-size: 0.86rem;
  outline: none;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 90px;
  margin-top: 0.35rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: #ffffff;
  padding: 0.72rem;
  color: #050505;
  font-size: 0.86rem;
  resize: vertical;
  outline: none;
`;

const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 0.4rem;
`;

const Choice = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: ${(p) => (p.$active ? "#f2f1ee" : "#ffffff")};
  padding: 0.7rem;
  text-align: left;
  cursor: pointer;
  svg { width: 17px; height: 17px; flex: 0 0 auto; }
  strong { display: block; font-size: 0.76rem; }
  span { display: block; margin-top: 0.15rem; color: rgba(5,5,5,0.56); font-size: 0.68rem; line-height: 1.35; }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
`;

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
      <DeckCard key={deck.id}>
        <Cover href={`/vocabulary/decks/${deck.id}`} $image={deck.coverImageUrl}>{deck.coverImageUrl ? null : deck.icon}</Cover>
        <DeckBody>
          <DeckTitleRow>
            <DeckLink href={`/vocabulary/decks/${deck.id}`}><DeckName>{displayName(deck)}</DeckName></DeckLink>
            <BadgeRow>
              {deck.isOfficial && <Badge>{copy.official}</Badge>}
              {mine && <Badge>{personal ? copy.personalName : copy.mine}</Badge>}
              {!mine && added && <Badge>{copy.added}</Badge>}
              {deck.visibility === "private" && <Badge>{copy.private}</Badge>}
            </BadgeRow>
          </DeckTitleRow>
          <Description>{displayDescription(deck)}</Description>
          <Footer>
            <Meta><span>{deck.itemCount} {copy.items}</span>{deck.visibility === "public" && <span>{deck.followerCount} {copy.addedUsers}</span>}</Meta>
            {!mine && (
              <SmallButton type="button" $active={added} disabled={updatingId === deck.id} onClick={() => void toggleAdded(deck)}>
                {added ? <MinusIcon /> : <PlusIcon />}{added ? copy.remove : copy.add}
              </SmallButton>
            )}
          </Footer>
        </DeckBody>
      </DeckCard>
    );
  };

  if (authLoading || loading) {
    return <Page><Shell><SkeletonGrid><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></SkeletonGrid></Shell></Page>;
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
        <ModalBackdrop onClick={() => !creating && setCreateOpen(false)}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <ModalHeader><ModalTitle>{copy.createTitle}</ModalTitle><IconButton type="button" onClick={() => setCreateOpen(false)}><XMarkIcon /></IconButton></ModalHeader>
            <Field>{copy.name}<Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={copy.namePlaceholder} /></Field>
            <Field>{copy.description}<Textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder={copy.descriptionPlaceholder} /></Field>
            <Field>{copy.visibility}</Field>
            <ChoiceGrid>
              <Choice type="button" $active={visibility === "private"} onClick={() => setVisibility("private")}><EyeSlashIcon /><div><strong>{copy.private}</strong><span>{copy.privateDescription}</span></div></Choice>
              <Choice type="button" $active={visibility === "public"} onClick={() => setVisibility("public")}><EyeIcon /><div><strong>{copy.public}</strong><span>{copy.publicDescription}</span></div></Choice>
            </ChoiceGrid>
            <ModalActions><SmallButton type="button" onClick={() => setCreateOpen(false)}>{copy.cancel}</SmallButton><PrimaryButton type="button" disabled={creating || !name.trim()} onClick={() => void createDeck()}><PlusIcon />{copy.create}</PrimaryButton></ModalActions>
          </Modal>
        </ModalBackdrop>
      )}
    </Page>
  );
}
