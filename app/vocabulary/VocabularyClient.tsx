"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styled from "styled-components";
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
import { appLayout } from "../lib/constants/app_layout";

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
  itemCount: number;
  followerCount: number;
  updatedAt: string;
};

const copyByLocale = {
  ko: {
    myCollections: "내 모음집",
    myCollectionsHint: "내가 만든 모음집과 팔로우 중인 공개 모음집입니다.",
    publicCollections: "공개 모음집",
    publicCollectionsHint: "1 Cup English와 다른 멤버가 만든 공개 모음집을 둘러보세요.",
    createCollection: "새 모음집 만들기",
    noCollections: "아직 내 모음집이 없습니다.",
    noCollectionsHint: "직접 만들거나 아래 공개 모음집을 팔로우해 보세요.",
    noPublicCollections: "공개 모음집이 없습니다.",
    searchPublic: "공개 모음집 검색",
    official: "공식",
    own: "내 모음집",
    following: "팔로우 중",
    follow: "팔로우",
    unfollow: "팔로우 해제",
    followers: "팔로워",
    items: "개 표현",
    public: "공개",
    private: "비공개",
    createTitle: "새 모음집 만들기",
    name: "모음집 이름",
    namePlaceholder: "예: 회의에서 자주 쓰는 표현",
    description: "설명",
    descriptionPlaceholder: "이 모음집을 어떤 목적으로 만들었는지 적어주세요.",
    visibility: "공개 설정",
    publicDescription: "다른 멤버가 검색하고 팔로우할 수 있습니다.",
    privateDescription: "나만 볼 수 있습니다.",
    cancel: "취소",
    create: "만들기",
    loading: "모음집을 불러오는 중...",
    loadError: "모음집을 불러오지 못했습니다. 다시 시도해 주세요.",
    createError: "모음집을 만들지 못했습니다.",
    followError: "팔로우 상태를 변경하지 못했습니다.",
    retry: "다시 시도",
  },
  en: {
    myCollections: "My decks",
    myCollectionsHint: "Decks you own and public decks you follow.",
    publicCollections: "Public decks",
    publicCollectionsHint: "Explore public decks made by 1 Cup English and other members.",
    createCollection: "Create deck",
    noCollections: "You do not have any decks yet.",
    noCollectionsHint: "Create one or follow a public deck below.",
    noPublicCollections: "There are no public decks yet.",
    searchPublic: "Search public decks",
    official: "Official",
    own: "Mine",
    following: "Following",
    follow: "Follow",
    unfollow: "Unfollow",
    followers: "followers",
    items: "items",
    public: "Public",
    private: "Private",
    createTitle: "Create a new deck",
    name: "Deck name",
    namePlaceholder: "e.g. Expressions for meetings",
    description: "Description",
    descriptionPlaceholder: "What is this deck for?",
    visibility: "Visibility",
    publicDescription: "Other members can discover and follow it.",
    privateDescription: "Only you can see it.",
    cancel: "Cancel",
    create: "Create",
    loading: "Loading decks...",
    loadError: "We could not load the decks. Please try again.",
    createError: "We could not create that deck.",
    followError: "We could not update the follow state.",
    retry: "Try again",
  },
} as const;

const themeAccent: Record<DeckTheme, string> = {
  orange: "#f47a4a",
  blue: "#8ab4f8",
  green: "#7bc99a",
  purple: "#b39ddb",
  pink: "#f3a4c0",
};

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

const TopActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.9rem;
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

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  svg { width: 17px; height: 17px; }
`;

const SecondaryButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: ${(p) => (p.$active ? "#050505" : "#ffffff")};
  color: ${(p) => (p.$active ? "#ffffff" : "#050505")};
  padding: 0.42rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 900;
  cursor: pointer;

  &:disabled { opacity: 0.48; cursor: not-allowed; }
  svg { width: 14px; height: 14px; }
`;

const Section = styled.section`
  margin-top: 1.4rem;
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

const SectionTitle = styled.h1`
  margin: 0;
  color: #050505;
  font-size: 1.35rem;
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
  gap: 0.8rem;

  @media (max-width: 760px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const DeckCard = styled.article`
  min-height: 176px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  border: 2px solid #050505;
  border-radius: 16px;
  background: #ffffff;
  padding: 1rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
`;

const Accent = styled.div<{ $theme: DeckTheme }>`
  position: absolute;
  inset: 0 auto 0 0;
  width: 7px;
  background: ${(p) => themeAccent[p.$theme]};
`;

const DeckLink = styled(Link)`
  color: inherit;
  text-decoration: none;
  display: block;

  &:hover { color: inherit; text-decoration: none; }
`;

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
`;

const DeckIcon = styled.div`
  font-size: 1.55rem;
  line-height: 1;
`;

const Badges = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  padding: 0 0.45rem;
  color: #050505;
  font-size: 0.64rem;
  font-weight: 900;
`;

const DeckName = styled.h2`
  margin: 0.65rem 0 0.25rem;
  color: #050505;
  font-size: 1.03rem;
  font-weight: 950;
  line-height: 1.25;
`;

const DeckDescription = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.77rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DeckFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
  margin-top: 0.85rem;
`;

const DeckMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.68rem;
  font-weight: 800;
`;

const SearchWrap = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: min(340px, 100%);
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

const StateBox = styled.div`
  padding: 2rem 1rem;
  border: 2px dashed #050505;
  border-radius: 16px;
  background: #ffffff;
  text-align: center;
  color: rgba(5, 5, 5, 0.62);

  svg { width: 34px; height: 34px; color: #050505; }
  strong { display: block; margin-top: 0.55rem; color: #050505; }
  p { margin: 0.3rem 0 0; line-height: 1.5; font-size: 0.78rem; }
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
  background: #ffffff;
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

const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 0.4rem;

  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const VisibilityChoice = styled.button<{ $active: boolean }>`
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  border: 2px solid #050505;
  border-radius: 12px;
  background: ${(p) => (p.$active ? "#f5f5f5" : "#ffffff")};
  padding: 0.75rem;
  text-align: left;
  cursor: pointer;

  svg { width: 18px; height: 18px; flex: 0 0 auto; }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  margin-top: 1rem;
`;

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

      setOwnDecks((ownResult.data || []).map(mapDeck));
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

  const toggleFollow = async (deck: Deck) => {
    if (!currentUser || deck.ownerUserId === currentUser.uid || deck.visibility !== "public") return;
    const isFollowing = followedDeckIds.has(deck.id);
    setUpdatingDeckId(deck.id);
    try {
      if (isFollowing) {
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
      console.error("Unable to update deck follow:", followFailure);
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
      if (data?.id) {
        router.push(`/vocabulary/decks/${data.id}`);
      } else {
        await loadDecks();
      }
    } catch (createFailure) {
      console.error("Unable to create vocabulary deck:", createFailure);
      window.alert(copy.createError);
    } finally {
      setCreatingDeck(false);
    }
  };

  const renderDeck = (deck: Deck) => {
    const isMine = deck.ownerUserId === currentUser?.uid;
    const isFollowing = followedDeckIds.has(deck.id);
    return (
      <DeckCard key={deck.id}>
        <Accent $theme={deck.theme} />
        <DeckLink href={`/vocabulary/decks/${deck.id}`}>
          <CardTop>
            <DeckIcon>{deck.icon}</DeckIcon>
            <Badges>
              {deck.isOfficial && <Badge>{copy.official}</Badge>}
              {isMine && <Badge>{copy.own}</Badge>}
              {!isMine && isFollowing && <Badge>{copy.following}</Badge>}
              {deck.visibility === "private" && <Badge>{copy.private}</Badge>}
            </Badges>
          </CardTop>
          <DeckName>{deck.name}</DeckName>
          <DeckDescription>{deck.description}</DeckDescription>
        </DeckLink>
        <DeckFooter>
          <DeckMeta>
            <span>{deck.itemCount} {copy.items}</span>
            {deck.visibility === "public" && <span>{deck.followerCount} {copy.followers}</span>}
          </DeckMeta>
          {!isMine && deck.visibility === "public" && (
            <SecondaryButton
              type="button"
              $active={isFollowing}
              disabled={updatingDeckId === deck.id}
              onClick={() => void toggleFollow(deck)}
            >
              <UserGroupIcon />
              {isFollowing ? copy.unfollow : copy.follow}
            </SecondaryButton>
          )}
        </DeckFooter>
      </DeckCard>
    );
  };

  if (authLoading || loading) {
    return <Page><Shell><StateBox>{copy.loading}</StateBox></Shell></Page>;
  }

  if (error) {
    return (
      <Page>
        <Shell>
          <StateBox>
            <strong>{error}</strong>
            <PrimaryButton style={{ marginTop: "0.85rem" }} onClick={() => void loadDecks()}>
              {copy.retry}
            </PrimaryButton>
          </StateBox>
        </Shell>
      </Page>
    );
  }

  return (
    <Page>
      <Shell>
        <TopActions>
          <PrimaryButton type="button" onClick={() => setCreateOpen(true)}>
            <FolderPlusIcon />{copy.createCollection}
          </PrimaryButton>
        </TopActions>

        <Section>
          <SectionTop>
            <div>
              <SectionTitle>{copy.myCollections}</SectionTitle>
              <SectionHint>{copy.myCollectionsHint}</SectionHint>
            </div>
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
            <div>
              <SectionTitle>{copy.publicCollections}</SectionTitle>
              <SectionHint>{copy.publicCollectionsHint}</SectionHint>
            </div>
            <SearchWrap>
              <MagnifyingGlassIcon />
              <SearchInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPublic}
              />
            </SearchWrap>
          </SectionTop>
          {filteredPublicDecks.length > 0 ? (
            <DeckGrid>{filteredPublicDecks.map(renderDeck)}</DeckGrid>
          ) : (
            <StateBox>
              <BookOpenIcon />
              <strong>{copy.noPublicCollections}</strong>
            </StateBox>
          )}
        </Section>
      </Shell>

      {createOpen && (
        <ModalBackdrop onClick={() => !creatingDeck && setCreateOpen(false)}>
          <Modal onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{copy.createTitle}</ModalTitle>
              <IconButton type="button" onClick={() => setCreateOpen(false)} aria-label={copy.cancel}>
                <XMarkIcon />
              </IconButton>
            </ModalHeader>

            <Field>{copy.name}
              <Input
                value={newDeckName}
                maxLength={80}
                onChange={(event) => setNewDeckName(event.target.value)}
                placeholder={copy.namePlaceholder}
              />
            </Field>
            <Field>{copy.description}
              <Textarea
                value={newDeckDescription}
                maxLength={500}
                onChange={(event) => setNewDeckDescription(event.target.value)}
                placeholder={copy.descriptionPlaceholder}
              />
            </Field>
            <Field>{copy.visibility}</Field>
            <ChoiceGrid>
              <VisibilityChoice
                type="button"
                $active={newDeckVisibility === "private"}
                onClick={() => setNewDeckVisibility("private")}
              >
                <EyeSlashIcon />
                <div><strong>{copy.private}</strong><div>{copy.privateDescription}</div></div>
              </VisibilityChoice>
              <VisibilityChoice
                type="button"
                $active={newDeckVisibility === "public"}
                onClick={() => setNewDeckVisibility("public")}
              >
                <EyeIcon />
                <div><strong>{copy.public}</strong><div>{copy.publicDescription}</div></div>
              </VisibilityChoice>
            </ChoiceGrid>

            <ModalActions>
              <SecondaryButton type="button" onClick={() => setCreateOpen(false)}>{copy.cancel}</SecondaryButton>
              <PrimaryButton type="button" disabled={creatingDeck || !newDeckName.trim()} onClick={() => void createDeck()}>
                <PlusIcon />{copy.create}
              </PrimaryButton>
            </ModalActions>
          </Modal>
        </ModalBackdrop>
      )}
    </Page>
  );
}
