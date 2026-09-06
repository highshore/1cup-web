"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  Bars3Icon,
  CheckIcon,
  MinusIcon,
  PencilSquareIcon,
  PlayIcon,
  PlusIcon,
  SpeakerWaveIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../../../lib/contexts/auth_context";
import { useI18n } from "../../../lib/i18n/I18nProvider";
import { supabase } from "../../../lib/supabase/client";

import "./deck.css";

type ViewMode = "tiles" | "list";
type DeckVisibility = "private" | "public";

type Meaning = {
  id: string;
  entryId: string;
  grammarType: string;
  definitionEn: string;
  definitionKo: string | null;
  pronunciationIpa: string | null;
  exampleEn: string | null;
  exampleKo: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  source: string | null;
  meaningOrder: number;
};

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
  followerCount: number;
};

type DeckItem = {
  id: string;
  entryId: string;
  meaningId: string | null;
  term: string;
  meaning: Meaning | null;
};

type DictionaryEntry = {
  id: string;
  term: string;
  meanings: Meaning[];
  forms: EntryForm[];
};

type EntryForm = {
  form: string;
  tags: string[];
};

const SEARCH_PAGE_SIZE = 10;

const copyByLocale = {
  ko: {
    back: "단어장 페이지로",
    official: "공식",
    shared: "공용",
    private: "비공개",
    personal: "기본 단어장",
    personalName: "내 단어장",
    personalDescription: "내가 저장한 모든 단어와 표현이 자동으로 모이는 기본 단어장입니다.",
    edit: "편집",
    addDeck: "추가",
    removeDeck: "제거",
    addedUsers: "추가한 유저",
    total: "전체 단어",
    study: "이 단어장 학습하기",
    words: "단어 리스트",
    wordsHint: "이 단어장에 들어 있는 단어와 뜻입니다.",
    tiles: "타일",
    list: "리스트",
    addWord: "단어 추가",
    addTitle: "단어 추가",
    search: "영어 단어 또는 표현 검색",
    searchStart: "두 글자 이상 입력해 주세요.",
    noSearch: "일치하는 단어를 찾지 못했습니다.",
    added: "추가됨",
    add: "추가",
    addAll: "한꺼번에 추가",
    remove: "제거",
    noItems: "아직 단어가 없습니다.",
    noDefinition: "뜻 정보가 아직 준비되지 않았습니다.",
    loading: "단어장을 불러오는 중...",
    loadError: "단어장을 불러오지 못했습니다.",
    updateError: "변경 사항을 저장하지 못했습니다.",
    editTitle: "단어장 편집",
    name: "이름",
    description: "설명",
    visibility: "공개 설정",
    save: "저장",
    cancel: "취소",
    sharedOption: "공용 단어장",
    sharedOptionHint: "다른 멤버가 찾아보고 추가할 수 있습니다.",
    privateOption: "비공개 단어장",
    privateOptionHint: "나만 볼 수 있습니다.",
    example: "예문",
    forms: "활용형",
    source: "Wiktionary",
  },
  en: {
    back: "Back to vocabulary",
    official: "Official",
    shared: "Shared",
    private: "Private",
    personal: "Built-in deck",
    personalName: "My Vocabulary",
    personalDescription: "Your built-in deck containing everything you save.",
    edit: "Edit",
    addDeck: "Add",
    removeDeck: "Remove",
    addedUsers: "Added users",
    total: "Total words",
    study: "Study this deck",
    words: "Vocabulary list",
    wordsHint: "Words and meanings currently in this deck.",
    tiles: "Tiles",
    list: "List",
    addWord: "Add vocabulary",
    addTitle: "Add vocabulary",
    search: "Search an English word or expression",
    searchStart: "Enter at least two characters.",
    noSearch: "No matching vocabulary found.",
    added: "Added",
    add: "Add",
    addAll: "Add all",
    remove: "Remove",
    noItems: "There are no words in this deck yet.",
    noDefinition: "A definition is not available yet.",
    loading: "Loading deck...",
    loadError: "We could not load this deck.",
    updateError: "We could not save that change.",
    editTitle: "Edit deck",
    name: "Name",
    description: "Description",
    visibility: "Visibility",
    save: "Save",
    cancel: "Cancel",
    sharedOption: "Shared deck",
    sharedOptionHint: "Other members can browse and add it.",
    privateOption: "Private deck",
    privateOptionHint: "Only you can see it.",
    example: "Example",
    forms: "Forms",
    source: "Wiktionary",
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
      className="inline-flex items-center gap-[0.35rem] text-[#050505] text-[0.8rem] font-[850] no-underline [&_svg]:w-[17px] [&_svg]:h-[17px]"
    >
      {children}
    </Link>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border-[1.5px] border-[#050505] rounded-full bg-white py-[0.23rem] px-[0.45rem] text-[0.62rem] font-black">
      {children}
    </span>
  );
}

function Button({
  $primary,
  $active,
  className = "",
  children,
  ...rest
}: { $primary?: boolean; $active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[0.3rem] min-h-[2.35rem] ${$primary ? "border-2" : "border-[1.5px]"} border-[#050505] rounded-full ${$active ? "bg-[#050505] text-white" : $primary ? "bg-[#f47a4a] text-[#050505]" : "bg-white text-[#050505]"} py-[0.45rem] px-[0.65rem] text-[0.7rem] font-black cursor-pointer ${$primary ? "shadow-[2px_2px_0_#050505]" : "shadow-none"} whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:w-[15px] [&_svg]:h-[15px] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function ResultAddButton({
  $active,
  className = "",
  children,
  ...rest
}: { $active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-[0.3rem] min-h-[1.8rem] border-[1.5px] border-[#050505] rounded-full ${$active ? "bg-[#050505] text-white" : "bg-white text-[#050505]"} py-[0.28rem] px-[0.42rem] text-[0.62rem] font-black cursor-pointer shadow-none whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:w-[13px] [&_svg]:h-[13px] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Stat({ children }: { children: ReactNode }) {
  return (
    <div className="border-[1.5px] border-[#050505] rounded-xl bg-white py-[0.65rem] px-3 [&_strong]:block [&_strong]:text-[1.2rem] [&_strong]:font-[950] [&_span]:block [&_span]:mt-[0.1rem] [&_span]:text-[rgba(5,5,5,0.54)] [&_span]:text-[0.66rem] [&_span]:font-extrabold">
      {children}
    </div>
  );
}

function Segment({
  $active,
  className = "",
  children,
  ...rest
}: { $active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center gap-[0.23rem] border-r border-r-[rgba(5,5,5,0.15)] last:border-r-0 ${$active ? "bg-[#050505] text-white" : "bg-white text-[#050505]"} py-[0.45rem] px-[0.56rem] text-[0.66rem] font-black cursor-pointer [&_svg]:w-[14px] [&_svg]:h-[14px] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Term({ children }: { children: ReactNode }) {
  return <h3 className="m-0 text-[#050505] text-[1.08rem] font-[950] [overflow-wrap:anywhere]">{children}</h3>;
}

function Definition({ children }: { children: ReactNode }) {
  return <p className="mt-[0.6rem] mb-0 text-[#050505] text-[0.84rem] leading-[1.48]">{children}</p>;
}

function Korean({ children }: { children: ReactNode }) {
  return <p className="mt-[0.22rem] mb-0 text-[rgba(5,5,5,0.65)] text-[0.78rem] leading-[1.45] font-[650]">{children}</p>;
}

function Empty({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`py-8 px-4 border-2 border-dashed border-[#050505] rounded-2xl bg-white text-[rgba(5,5,5,0.58)] text-center text-[0.8rem] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function Skeleton({ style }: { style?: CSSProperties }) {
  return (
    <div
      className="h-[200px] border-2 border-[rgba(5,5,5,0.12)] rounded-2xl bg-[linear-gradient(90deg,#eceae6_25%,#f7f6f3_50%,#eceae6_75%)] bg-[length:200%_100%] animate-[vocab-deck-skeleton-pulse_1.3s_infinite_linear]"
      style={style}
    />
  );
}

function ModalBackdrop({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.58)] p-4" {...rest}>
      {children}
    </div>
  );
}

function Modal({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="w-[min(760px,100%)] max-h-[88vh] overflow-y-auto border-2 border-[#050505] rounded-[18px] bg-white p-4 shadow-[7px_7px_0_#050505]"
      {...rest}
    >
      {children}
    </div>
  );
}

function ModalHeader({ children }: { children: ReactNode }) {
  return <div className="flex items-start justify-between gap-[0.7rem] mb-3">{children}</div>;
}

function ModalTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-[#050505] text-[1.15rem] font-[950]">{children}</h2>;
}

function Close({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="w-[34px] h-[34px] inline-flex items-center justify-center border-2 border-[#050505] rounded-full bg-white cursor-pointer [&_svg]:w-4 [&_svg]:h-4"
      {...rest}
    >
      {children}
    </button>
  );
}

function Field({ children }: { children: ReactNode }) {
  return <label className="block mt-[0.8rem] text-[#050505] text-[0.75rem] font-black">{children}</label>;
}

function Choice({
  $active,
  children,
  ...rest
}: { $active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`border-2 border-[#050505] rounded-[11px] ${$active ? "bg-[#f2f1ee]" : "bg-white"} p-[0.65rem] text-left cursor-pointer [&_strong]:block [&_strong]:text-[0.72rem] [&_span]:block [&_span]:mt-[0.12rem] [&_span]:text-[rgba(5,5,5,0.55)] [&_span]:text-[0.64rem] [&_span]:leading-[1.35]`}
      {...rest}
    >
      {children}
    </button>
  );
}

const SearchSentinel = forwardRef<HTMLDivElement, { children?: ReactNode }>(
  function SearchSentinel({ children }, ref) {
    return <div ref={ref} className="min-h-px col-span-full">{children}</div>;
  },
);

const single = <T,>(value:T|T[]|null|undefined):T|null => Array.isArray(value)?value[0]??null:value??null;
function mapMeaning(row:any):Meaning|null { const value=single<any>(row); if(!value?.id)return null; return { id:String(value.id),entryId:String(value.entry_id),grammarType:String(value.grammar_type||""),definitionEn:String(value.definition_en||""),definitionKo:typeof value.definition_ko==="string"?value.definition_ko:null,pronunciationIpa:typeof value.pronunciation_ipa==="string"?value.pronunciation_ipa:null,exampleEn:typeof value.example_en==="string"?value.example_en:null,exampleKo:typeof value.example_ko==="string"?value.example_ko:null,audioUrl:typeof value.audio_url==="string"?value.audio_url:null,imageUrl:typeof value.image_url==="string"?value.image_url:null,source:typeof value.source==="string"?value.source:null,meaningOrder:Number(value.meaning_order||0) }; }

export default function VocabularyDeckV2Client({ deckId }:{ deckId:string }) {
  const router=useRouter(); const { currentUser,isLoading:authLoading }=useAuth(); const { locale }=useI18n(); const copy=copyByLocale[locale];
  const [deck,setDeck]=useState<Deck|null>(null); const [items,setItems]=useState<DeckItem[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(false); const [added,setAdded]=useState(false); const [viewMode,setViewMode]=useState<ViewMode>("tiles");
  const [addOpen,setAddOpen]=useState(false); const [editOpen,setEditOpen]=useState(false); const [query,setQuery]=useState(""); const [searching,setSearching]=useState(false); const [loadingMoreResults,setLoadingMoreResults]=useState(false); const [hasMoreResults,setHasMoreResults]=useState(false); const [results,setResults]=useState<DictionaryEntry[]>([]); const [busyKey,setBusyKey]=useState<string|null>(null);
  const [editName,setEditName]=useState(""); const [editDescription,setEditDescription]=useState(""); const [editVisibility,setEditVisibility]=useState<DeckVisibility>("private");
  const searchRequestId=useRef(0); const searchSentinelRef=useRef<HTMLDivElement|null>(null);
  const isOwner=Boolean(currentUser&&deck?.ownerUserId===currentUser.uid); const isPersonal=Boolean(deck?.systemKey?.startsWith("personal:"));

  const load=useCallback(async()=>{ if(!currentUser)return; setLoading(true); setError(false); try {
    const { data:deckRow,error:deckError }=await supabase.from("vocabulary_decks").select("*").eq("id",deckId).maybeSingle(); if(deckError||!deckRow)throw deckError||new Error("Deck not found");
    const mapped:Deck={id:String(deckRow.id),ownerUserId:deckRow.owner_user_id?String(deckRow.owner_user_id):null,name:String(deckRow.name||""),description:String(deckRow.description||""),visibility:deckRow.visibility==="public"?"public":"private",icon:String(deckRow.icon||"📚"),coverImageUrl:typeof deckRow.cover_image_url==="string"&&deckRow.cover_image_url?deckRow.cover_image_url:null,isOfficial:Boolean(deckRow.is_official),systemKey:typeof deckRow.system_key==="string"?deckRow.system_key:null,followerCount:Number(deckRow.follower_count||0)}; setDeck(mapped); setEditName(mapped.name); setEditDescription(mapped.description); setEditVisibility(mapped.visibility);
    const { data:itemRows,error:itemError }=await supabase.from("vocabulary_deck_items").select(`id,entry_id,meaning_id,entry:dictionary_entries!vocabulary_deck_items_entry_id_fkey(term),meaning:dictionary_meanings!vocabulary_deck_items_meaning_id_fkey(id,entry_id,grammar_type,definition_en,definition_ko,pronunciation_ipa,example_en,example_ko,audio_url,image_url,source,meaning_order)`).eq("deck_id",deckId).order("position",{ascending:true,nullsFirst:false}).order("added_at",{ascending:false}); if(itemError)throw itemError;
    setItems((itemRows||[]).flatMap((row:any)=>{const entry=single<any>(row.entry); if(!entry?.term)return[]; return[{id:String(row.id),entryId:String(row.entry_id),meaningId:row.meaning_id?String(row.meaning_id):null,term:String(entry.term),meaning:mapMeaning(row.meaning)}]}));
    const { data:follow }=await supabase.from("vocabulary_deck_follows").select("deck_id").eq("deck_id",deckId).eq("user_id",currentUser.uid).maybeSingle(); setAdded(Boolean(follow));
  } catch(failure){console.error("Unable to load deck",failure);setError(true)} finally{setLoading(false)} },[currentUser,deckId]);

  useEffect(()=>{if(authLoading)return;if(!currentUser){router.replace(`/auth?redirect=${encodeURIComponent(`/vocabulary/decks/${deckId}`)}`);return}void load()},[authLoading,currentUser,deckId,load,router]);

  const fetchSearchPage=useCallback(async(normalized:string,offset:number):Promise<DictionaryEntry[]>=>{const [{ data:directRows,error:directError },{ data:formMatchRows,error:formMatchError }]=await Promise.all([supabase.from("dictionary_entries").select("id,term,normalized_term").eq("language_code","en").gte("normalized_term",normalized).lt("normalized_term",`${normalized}￿`).order("normalized_term",{ascending:true}).range(offset,offset+SEARCH_PAGE_SIZE-1),supabase.from("dictionary_entry_forms").select("entry_id,entry:dictionary_entries!inner(id,term,normalized_term)").eq("language_code","en").gte("normalized_form",normalized).lt("normalized_form",`${normalized}￿`).order("normalized_form",{ascending:true}).range(offset,offset+SEARCH_PAGE_SIZE-1)]);if(directError)throw directError;if(formMatchError)throw formMatchError;const entriesById=new Map<string,{id:string;term:string;normalized_term:string}>();for(const row of directRows||[]){entriesById.set(String(row.id),{id:String(row.id),term:String(row.term),normalized_term:String(row.normalized_term)})}for(const row of formMatchRows||[]){const entry=single<any>((row as any).entry);if(entry?.id&&!entriesById.has(String(entry.id)))entriesById.set(String(entry.id),{id:String(entry.id),term:String(entry.term),normalized_term:String(entry.normalized_term)})}const entries=[...entriesById.values()].slice(0,SEARCH_PAGE_SIZE);const ids=entries.map(row=>row.id);if(!ids.length)return[];const [{ data:meaningRows,error:meaningError },{ data:formRows,error:formError }]=await Promise.all([supabase.from("dictionary_meanings").select("id,entry_id,grammar_type,definition_en,definition_ko,pronunciation_ipa,example_en,example_ko,audio_url,image_url,source,meaning_order").in("entry_id",ids).order("meaning_order",{ascending:true}),supabase.from("dictionary_entry_forms").select("entry_id,form,form_tags").in("entry_id",ids).order("normalized_form",{ascending:true})]);if(meaningError)throw meaningError;if(formError)throw formError;const byEntry:Record<string,Meaning[]>={};const formsByEntry:Record<string,EntryForm[]>={};(meaningRows||[]).forEach((row:any)=>{const meaning=mapMeaning(row);if(!meaning)return;(byEntry[meaning.entryId]??=[]).push(meaning)});(formRows||[]).forEach((row:any)=>{const form=typeof row.form==="string"?row.form.trim():"";if(!form)return;(formsByEntry[String(row.entry_id)]??=[]).push({form,tags:Array.isArray(row.form_tags)?row.form_tags.filter((tag:any)=>typeof tag==="string"):[]})});Object.values(byEntry).forEach(list=>list.sort((a,b)=>Number(Boolean(b.definitionKo?.trim()))-Number(Boolean(a.definitionKo?.trim()))||(a.source==="wiktionary"?0:1)-(b.source==="wiktionary"?0:1)||a.meaningOrder-b.meaningOrder));return entries.map(row=>{const all=byEntry[row.id]||[];const wiki=all.filter(m=>m.source==="wiktionary");return{id:row.id,term:row.term,meanings:wiki.length?wiki:all,forms:formsByEntry[row.id]||[]}})},[]);

  useEffect(()=>{const requestId=++searchRequestId.current;if(!addOpen||!isOwner){setResults([]);setHasMoreResults(false);return}const normalized=query.trim().toLowerCase();if(normalized.length<2){setResults([]);setHasMoreResults(false);return}const timer=window.setTimeout(async()=>{setSearching(true);try{const entries=await fetchSearchPage(normalized,0);if(requestId!==searchRequestId.current)return;setResults(entries);setHasMoreResults(entries.length===SEARCH_PAGE_SIZE)}catch(failure){console.error("Dictionary search failed",failure);if(requestId===searchRequestId.current){setResults([]);setHasMoreResults(false)}}finally{if(requestId===searchRequestId.current)setSearching(false)}},220);return()=>window.clearTimeout(timer)},[addOpen,fetchSearchPage,isOwner,query]);

  const loadMoreResults=useCallback(async()=>{const normalized=query.trim().toLowerCase();if(searching||loadingMoreResults||!hasMoreResults||normalized.length<2)return;const requestId=searchRequestId.current;setLoadingMoreResults(true);try{const entries=await fetchSearchPage(normalized,results.length);if(requestId!==searchRequestId.current)return;setResults(current=>[...current,...entries]);setHasMoreResults(entries.length===SEARCH_PAGE_SIZE)}catch(failure){console.error("More dictionary search results failed",failure);if(requestId===searchRequestId.current)setHasMoreResults(false)}finally{if(requestId===searchRequestId.current)setLoadingMoreResults(false)}},[fetchSearchPage,hasMoreResults,loadingMoreResults,query,results.length,searching]);

  useEffect(()=>{const sentinel=searchSentinelRef.current;if(!sentinel||!hasMoreResults)return;const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void loadMoreResults()},{rootMargin:"240px"});observer.observe(sentinel);return()=>observer.disconnect()},[hasMoreResults,loadMoreResults]);

  const itemKeys=useMemo(()=>new Set(items.map(item=>`${item.entryId}:${item.meaningId||""}`)),[items]);
  const displayName=isPersonal?copy.personalName:deck?.name||""; const displayDescription=isPersonal?copy.personalDescription:deck?.description||"";
  const playAudio=(url:string)=>{const audio=new Audio(url);void audio.play().catch(()=>undefined)};

  const toggleAdded=async()=>{if(!currentUser||!deck||isOwner)return;setBusyKey("follow");try{if(added){const {error:e}=await supabase.from("vocabulary_deck_follows").delete().eq("deck_id",deck.id).eq("user_id",currentUser.uid);if(e)throw e}else{const {error:e}=await supabase.from("vocabulary_deck_follows").insert({deck_id:deck.id,user_id:currentUser.uid});if(e)throw e}await load()}catch(failure){console.error(failure);window.alert(copy.updateError)}finally{setBusyKey(null)}};
  const addMeaning=async(entry:DictionaryEntry,meaning:Meaning|null)=>{if(!currentUser||!isOwner)return;const key=`${entry.id}:${meaning?.id||""}`;setBusyKey(key);try{if(isPersonal){const {error:e}=await supabase.rpc("save_vocabulary_term",{p_term:entry.term,p_source_article_id:null,p_meaning_id:meaning?.id||null});if(e)throw e}else{const {error:e}=await supabase.from("vocabulary_deck_items").insert({deck_id:deckId,entry_id:entry.id,meaning_id:meaning?.id||null});if(e&&e.code!=="23505")throw e}await load()}catch(failure){console.error(failure);window.alert(copy.updateError)}finally{setBusyKey(null)}};
  const addAllMeanings=async(entry:DictionaryEntry)=>{if(!currentUser||!isOwner)return;const meanings=entry.meanings.filter(meaning=>!itemKeys.has(`${entry.id}:${meaning.id}`));if(!meanings.length)return;const key=`${entry.id}:all`;setBusyKey(key);try{if(isPersonal){for(const meaning of meanings){const {error:e}=await supabase.rpc("save_vocabulary_term",{p_term:entry.term,p_source_article_id:null,p_meaning_id:meaning.id});if(e)throw e}}else{await Promise.all(meanings.map(async meaning=>{const {error:e}=await supabase.from("vocabulary_deck_items").insert({deck_id:deckId,entry_id:entry.id,meaning_id:meaning.id});if(e&&e.code!=="23505")throw e}))}await load()}catch(failure){console.error(failure);window.alert(copy.updateError)}finally{setBusyKey(null)}};
  const removeItem=async(item:DeckItem)=>{if(!currentUser||!isOwner)return;setBusyKey(item.id);try{if(isPersonal){let q=supabase.from("user_vocabulary").delete().eq("user_id",currentUser.uid).eq("entry_id",item.entryId);q=item.meaningId?q.eq("meaning_id",item.meaningId):q.is("meaning_id",null);const{error:e}=await q;if(e)throw e}else{const{error:e}=await supabase.from("vocabulary_deck_items").delete().eq("id",item.id).eq("deck_id",deckId);if(e)throw e}await load()}catch(failure){console.error(failure);window.alert(copy.updateError)}finally{setBusyKey(null)}};
  const saveEdit=async()=>{if(!deck||!isOwner||isPersonal||!editName.trim())return;setBusyKey("edit");try{const{error:e}=await supabase.from("vocabulary_decks").update({name:editName.trim(),description:editDescription.trim(),visibility:editVisibility,updated_at:new Date().toISOString()}).eq("id",deck.id);if(e)throw e;setEditOpen(false);await load()}catch(failure){console.error(failure);window.alert(copy.updateError)}finally{setBusyKey(null)}};

  if(authLoading||loading)return <Page><Shell><Skeleton /><div style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}}><Skeleton /><Skeleton /><Skeleton /></div></Shell></Page>;
  if(error||!deck)return <Page><Shell><BackLink href="/vocabulary"><ArrowLeftIcon />{copy.back}</BackLink><Empty style={{marginTop:16}}>{copy.loadError}</Empty></Shell></Page>;

  return <Page><Shell>
    <BackLink href="/vocabulary"><ArrowLeftIcon />{copy.back}</BackLink>
    <section className="mt-[0.85rem] border-2 border-[#050505] rounded-[18px] bg-white p-4 shadow-[3px_3px_0_#050505]"><div className="flex items-start justify-between gap-4 max-[680px]:flex-col"><div className="flex items-start gap-3 min-w-0"><div className="w-[74px] h-[74px] flex-[0_0_74px] border-2 border-[#050505] rounded-[14px] flex items-center justify-center text-[2rem] overflow-hidden" style={{background:deck.coverImageUrl?`url(${JSON.stringify(deck.coverImageUrl)}) center/cover no-repeat`:"#f1efeb"}}>{deck.coverImageUrl?null:deck.icon}</div><div><div className="flex items-center gap-[0.45rem] flex-wrap"><h1 className="m-0 text-[#050505] text-[clamp(1.6rem,4vw,2.25rem)] leading-[1.08] font-[950]">{displayName}</h1>{isOwner&&!isPersonal&&<Button type="button" onClick={()=>setEditOpen(true)}><PencilSquareIcon />{copy.edit}</Button>}</div><p className="max-w-[680px] mt-[0.4rem] mb-0 text-[rgba(5,5,5,0.6)] text-[0.86rem] leading-[1.5]">{displayDescription}</p><div className="flex gap-[0.3rem] flex-wrap mt-[0.55rem]">{deck.isOfficial&&<Badge>{copy.official}</Badge>}{isPersonal&&<Badge>{copy.personal}</Badge>}<Badge>{deck.visibility==="public"?copy.shared:copy.private}</Badge></div></div></div><div className="flex gap-[0.45rem] flex-wrap justify-end">{!isOwner&&deck.visibility==="public"&&<Button type="button" $active={added} disabled={busyKey==="follow"} onClick={()=>void toggleAdded()}>{added?<MinusIcon />:<PlusIcon />}{added?copy.removeDeck:copy.addDeck}</Button>}<Link href={`/vocabulary/study/${deck.id}`} className="inline-flex items-center justify-center gap-[0.3rem] min-h-[2.4rem] border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-[0.48rem] px-[0.7rem] text-[0.72rem] font-[950] no-underline shadow-[2px_2px_0_#050505] [&_svg]:w-4 [&_svg]:h-4"><PlayIcon />{copy.study}</Link></div></div><div className="grid grid-cols-2 gap-[0.6rem] mt-[0.9rem] max-w-[380px]"><Stat><strong>{items.length}</strong><span>{copy.total}</span></Stat><Stat><strong>{deck.followerCount}</strong><span>{copy.addedUsers}</span></Stat></div></section>

    <section className="mt-[1.55rem]"><div className="flex items-center justify-between gap-[0.7rem] flex-wrap mb-3"><div className="min-w-0 flex-1"><h2 className="m-0 text-[#050505] text-[1.16rem] font-[950]">{copy.words}</h2><p className="mt-[0.12rem] mb-0 text-[rgba(5,5,5,0.55)] text-[0.76rem] leading-[1.4]">{copy.wordsHint}</p></div><div className="flex items-center gap-[0.42rem] flex-wrap"><div className="inline-flex border-[1.5px] border-[#050505] rounded-full bg-white overflow-hidden"><Segment type="button" $active={viewMode==="tiles"} onClick={()=>setViewMode("tiles")}><Squares2X2Icon />{copy.tiles}</Segment><Segment type="button" $active={viewMode==="list"} onClick={()=>setViewMode("list")}><Bars3Icon />{copy.list}</Segment></div>{isOwner&&<Button type="button" $primary onClick={()=>setAddOpen(true)}><PlusIcon />{copy.addWord}</Button>}</div></div>
    {items.length?<div className={viewMode==="tiles"?"grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1":"flex flex-col gap-3"}>{items.map(item=><article key={item.id} data-mode={viewMode} className={`min-w-0 overflow-hidden border-2 border-[#050505] rounded-[15px] bg-white shadow-[2px_2px_0_#050505] ${viewMode==="list"?"grid grid-cols-[96px_minmax(0,1fr)] max-[560px]:grid-cols-1":"flex flex-col"}`}><div className={`min-h-[128px] flex items-center justify-center border-b-2 border-b-[#050505] text-[2rem] ${viewMode==="list"?"min-[561px]:min-h-full min-[561px]:border-b-0 min-[561px]:border-r-2 min-[561px]:border-r-[#050505]":""}`} style={{background:item.meaning?.imageUrl?`url(${JSON.stringify(item.meaning.imageUrl)}) center/cover no-repeat`:"#f1efeb"}}>{item.meaning?.imageUrl?null:"Aa"}</div><div className="flex flex-col min-w-0 py-[0.85rem] px-[0.9rem]"><div className="flex items-start justify-between gap-[0.55rem]"><div><Term>{item.term}</Term>{item.meaning?.pronunciationIpa&&<div className="mt-[0.18rem] text-[rgba(5,5,5,0.56)] text-[0.68rem] font-[750]">{item.meaning.pronunciationIpa}</div>}</div>{item.meaning?.audioUrl&&<button type="button" className="w-[30px] h-[30px] inline-flex items-center justify-center border-[1.5px] border-[#050505] rounded-full bg-white cursor-pointer [&_svg]:w-[15px] [&_svg]:h-[15px]" onClick={()=>playAudio(item.meaning!.audioUrl!)} aria-label="Play pronunciation"><SpeakerWaveIcon /></button>}</div><Definition>{item.meaning?.definitionEn||copy.noDefinition}</Definition>{item.meaning?.definitionKo&&<Korean>{item.meaning.definitionKo}</Korean>}{item.meaning?.exampleEn&&<div className="mt-[0.65rem] py-[0.6rem] px-[0.7rem] rounded-[10px] bg-[#f4f3f0] text-[rgba(5,5,5,0.72)] text-[0.72rem] leading-[1.45]"><strong>{copy.example}</strong><br/>{item.meaning.exampleEn}{item.meaning.exampleKo&&<><br/>{item.meaning.exampleKo}</>}</div>}<div className="mt-auto pt-[0.65rem] flex items-center justify-between gap-2"><span className="text-[rgba(5,5,5,0.45)] text-[0.61rem] font-extrabold">{item.meaning?.source==="wiktionary"?copy.source:""}</span>{isOwner&&<Button type="button" disabled={busyKey===item.id} onClick={()=>void removeItem(item)}><TrashIcon />{copy.remove}</Button>}</div></div></article>)}</div>:<Empty>{copy.noItems}</Empty>}
    </section>

    {addOpen&&<ModalBackdrop onClick={()=>setAddOpen(false)}><Modal onClick={event=>event.stopPropagation()}><ModalHeader><ModalTitle>{copy.addTitle}</ModalTitle><Close type="button" onClick={()=>setAddOpen(false)}><XMarkIcon /></Close></ModalHeader><input className="w-full border-2 border-[#050505] rounded-full bg-white py-[0.7rem] px-[0.9rem] text-[#050505] text-[0.82rem] outline-none" autoFocus value={query} onChange={event=>{setQuery(event.target.value);setResults([]);setHasMoreResults(false)}} placeholder={copy.search}/>{query.trim().length<2?<Empty style={{marginTop:12}}>{copy.searchStart}</Empty>:searching?<Empty style={{marginTop:12}}>{copy.loading}</Empty>:results.length?<div className="grid grid-cols-2 gap-[0.65rem] mt-3 max-[680px]:grid-cols-1">{results.map(entry=>{const allKey=`${entry.id}:all`;const allAdded=entry.meanings.length>0&&entry.meanings.every(meaning=>itemKeys.has(`${entry.id}:${meaning.id}`));return <div key={entry.id} className="border-[1.5px] border-[#050505] rounded-[13px] bg-white p-3"><div className="flex items-center justify-between gap-[0.55rem]"><Term>{entry.term}</Term>{entry.meanings.length>0&&<ResultAddButton type="button" $active={allAdded} disabled={allAdded||busyKey===allKey} onClick={()=>void addAllMeanings(entry)}>{allAdded?<CheckIcon />:<PlusIcon />}{allAdded?copy.added:copy.addAll}</ResultAddButton>}</div>{entry.forms.length>0&&<p className="mt-[0.38rem] mb-0 text-[rgba(5,5,5,0.58)] text-[0.66rem] leading-[1.4] [&_strong]:text-[#050505] [&_strong]:font-black"><strong>{copy.forms}</strong> {entry.forms.map(form=>form.form).join(", ")}</p>}{entry.meanings.length?entry.meanings.map(meaning=>{const key=`${entry.id}:${meaning.id}`;const exists=itemKeys.has(key);return <div key={meaning.id} className="mt-[0.6rem] pt-[0.6rem] border-t border-t-[rgba(5,5,5,0.13)]"><div className="flex items-start justify-between gap-[0.55rem]"><div><span className="inline-flex border border-[rgba(5,5,5,0.5)] rounded-full py-[0.15rem] px-[0.34rem] text-[rgba(5,5,5,0.65)] text-[0.58rem] font-[850]">{meaning.grammarType}</span><Definition>{meaning.definitionEn||copy.noDefinition}</Definition>{meaning.definitionKo&&<Korean>{meaning.definitionKo}</Korean>}</div><ResultAddButton type="button" $active={exists} disabled={exists||busyKey===key} onClick={()=>void addMeaning(entry,meaning)}>{exists?<CheckIcon />:<PlusIcon />}{exists?copy.added:copy.add}</ResultAddButton></div></div> }):<div className="mt-[0.6rem] pt-[0.6rem] border-t border-t-[rgba(5,5,5,0.13)]"><div className="flex items-start justify-between gap-[0.55rem]"><Definition>{copy.noDefinition}</Definition><ResultAddButton type="button" onClick={()=>void addMeaning(entry,null)}><PlusIcon />{copy.add}</ResultAddButton></div></div>}</div>})}{(hasMoreResults||loadingMoreResults)&&<SearchSentinel ref={searchSentinelRef}>{loadingMoreResults&&<Empty style={{padding:".75rem",borderWidth:1}}>{copy.loading}</Empty>}</SearchSentinel>}</div>:<Empty style={{marginTop:12}}>{copy.noSearch}</Empty>}</Modal></ModalBackdrop>}

    {editOpen&&<ModalBackdrop onClick={()=>setEditOpen(false)}><Modal onClick={event=>event.stopPropagation()}><ModalHeader><ModalTitle>{copy.editTitle}</ModalTitle><Close type="button" onClick={()=>setEditOpen(false)}><XMarkIcon /></Close></ModalHeader><Field>{copy.name}<input className="w-full mt-[0.32rem] border-2 border-[#050505] rounded-[11px] bg-white p-[0.7rem] text-[#050505] text-[0.84rem] outline-none" value={editName} maxLength={80} onChange={event=>setEditName(event.target.value)}/></Field><Field>{copy.description}<textarea className="w-full min-h-[88px] mt-[0.32rem] border-2 border-[#050505] rounded-[11px] bg-white p-[0.7rem] text-[#050505] text-[0.84rem] resize-y outline-none" value={editDescription} maxLength={500} onChange={event=>setEditDescription(event.target.value)}/></Field><Field>{copy.visibility}</Field><div className="grid grid-cols-2 gap-2 mt-[0.4rem]"><Choice type="button" $active={editVisibility==="private"} onClick={()=>setEditVisibility("private")}><strong>{copy.privateOption}</strong><span>{copy.privateOptionHint}</span></Choice><Choice type="button" $active={editVisibility==="public"} onClick={()=>setEditVisibility("public")}><strong>{copy.sharedOption}</strong><span>{copy.sharedOptionHint}</span></Choice></div><div className="flex justify-end gap-[0.45rem] mt-[0.9rem]"><Button type="button" onClick={()=>setEditOpen(false)}>{copy.cancel}</Button><Button type="button" $primary disabled={busyKey==="edit"||!editName.trim()} onClick={()=>void saveEdit()}><PencilSquareIcon />{copy.save}</Button></div></Modal></ModalBackdrop>}
  </Shell></Page>;
}
