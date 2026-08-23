"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styled from "styled-components";
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

import { appLayout } from "../../../lib/constants/app_layout";
import { useAuth } from "../../../lib/contexts/auth_context";
import { useI18n } from "../../../lib/i18n/I18nProvider";
import { supabase } from "../../../lib/supabase/client";

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
    source: "Wiktionary",
  },
} as const;

const Page = styled.main`
  width: 100%; min-height: 100vh; background: transparent;
  padding: 1rem ${appLayout.pageGutterDesktop} 4rem;
  @media (max-width: 768px) { padding: 0.75rem ${appLayout.pageGutterMobile} 3rem; }
`;
const Shell = styled.div`width: 100%; max-width: ${appLayout.pageMaxWidth}; margin: 0 auto;`;
const BackLink = styled(Link)`display:inline-flex;align-items:center;gap:.35rem;color:#050505;font-size:.8rem;font-weight:850;text-decoration:none;svg{width:17px;height:17px}`;
const Header = styled.section`margin-top:.85rem;border:2px solid #050505;border-radius:18px;background:#fff;padding:1rem;box-shadow:3px 3px 0 #050505;`;
const HeaderTop = styled.div`display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;@media(max-width:680px){flex-direction:column}`;
const Identity = styled.div`display:flex;align-items:flex-start;gap:.75rem;min-width:0;`;
const Cover = styled.div<{ $image?: string | null }>`width:74px;height:74px;flex:0 0 74px;border:2px solid #050505;border-radius:14px;display:flex;align-items:center;justify-content:center;background:${p=>p.$image?`url(${JSON.stringify(p.$image)}) center/cover no-repeat`:"#f1efeb"};font-size:2rem;overflow:hidden;`;
const TitleRow = styled.div`display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;`;
const Title = styled.h1`margin:0;color:#050505;font-size:clamp(1.6rem,4vw,2.25rem);line-height:1.08;font-weight:950;`;
const Description = styled.p`max-width:680px;margin:.4rem 0 0;color:rgba(5,5,5,.6);font-size:.86rem;line-height:1.5;`;
const Badges = styled.div`display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.55rem;`;
const Badge = styled.span`display:inline-flex;align-items:center;border:1.5px solid #050505;border-radius:999px;background:#fff;padding:.23rem .45rem;font-size:.62rem;font-weight:900;`;
const HeaderActions = styled.div`display:flex;gap:.45rem;flex-wrap:wrap;justify-content:flex-end;`;
const Button = styled.button<{ $primary?: boolean; $active?: boolean }>`display:inline-flex;align-items:center;justify-content:center;gap:.3rem;min-height:2.35rem;border:${p=>p.$primary?"2px":"1.5px"} solid #050505;border-radius:999px;background:${p=>p.$active?"#050505":p.$primary?"#f47a4a":"#fff"};color:${p=>p.$active?"#fff":"#050505"};padding:.45rem .65rem;font-size:.7rem;font-weight:900;cursor:pointer;box-shadow:${p=>p.$primary?"2px 2px 0 #050505":"none"};white-space:nowrap;&:disabled{opacity:.45;cursor:not-allowed}svg{width:15px;height:15px}`;
const ResultAddButton = styled(Button)`min-height:1.8rem;padding:.28rem .42rem;font-size:.62rem;svg{width:13px;height:13px}`;
const StudyLink = styled(Link)`display:inline-flex;align-items:center;justify-content:center;gap:.3rem;min-height:2.4rem;border:2px solid #050505;border-radius:999px;background:#f47a4a;color:#050505;padding:.48rem .7rem;font-size:.72rem;font-weight:950;text-decoration:none;box-shadow:2px 2px 0 #050505;svg{width:16px;height:16px}`;
const Stats = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem;margin-top:.9rem;max-width:380px;`;
const Stat = styled.div`border:1.5px solid #050505;border-radius:12px;background:#fff;padding:.65rem .75rem;strong{display:block;font-size:1.2rem;font-weight:950}span{display:block;margin-top:.1rem;color:rgba(5,5,5,.54);font-size:.66rem;font-weight:800}`;
const Section = styled.section`margin-top:1.55rem;`;
const SectionTop = styled.div`display:flex;align-items:center;justify-content:space-between;gap:.7rem;flex-wrap:wrap;margin-bottom:.75rem;`;
const SectionText = styled.div`min-width:0;flex:1;`;
const SectionTitle = styled.h2`margin:0;color:#050505;font-size:1.16rem;font-weight:950;`;
const Hint = styled.p`margin:.12rem 0 0;color:rgba(5,5,5,.55);font-size:.76rem;line-height:1.4;`;
const Toolbar = styled.div`display:flex;align-items:center;gap:.42rem;flex-wrap:wrap;`;
const Segmented = styled.div`display:inline-flex;border:1.5px solid #050505;border-radius:999px;background:#fff;overflow:hidden;`;
const Segment = styled.button<{ $active:boolean }>`display:inline-flex;align-items:center;gap:.23rem;border:0;border-right:1px solid rgba(5,5,5,.15);background:${p=>p.$active?"#050505":"#fff"};color:${p=>p.$active?"#fff":"#050505"};padding:.45rem .56rem;font-size:.66rem;font-weight:900;cursor:pointer;&:last-child{border-right:0}svg{width:14px;height:14px}`;
const WordGrid = styled.div<{ $mode:ViewMode }>`display:${p=>p.$mode==="tiles"?"grid":"flex"};grid-template-columns:${p=>p.$mode==="tiles"?"repeat(3,minmax(0,1fr))":"none"};flex-direction:column;gap:.75rem;@media(max-width:900px){grid-template-columns:${p=>p.$mode==="tiles"?"repeat(2,minmax(0,1fr))":"none"}}@media(max-width:560px){grid-template-columns:1fr}`;
const WordCard = styled.article<{ $mode:ViewMode }>`min-width:0;display:${p=>p.$mode==="list"?"grid":"flex"};grid-template-columns:${p=>p.$mode==="list"?"96px minmax(0,1fr)":"none"};flex-direction:column;overflow:hidden;border:2px solid #050505;border-radius:15px;background:#fff;box-shadow:2px 2px 0 #050505;@media(max-width:560px){grid-template-columns:1fr}`;
const Media = styled.div<{ $image?:string|null }>`min-height:128px;display:flex;align-items:center;justify-content:center;border-bottom:2px solid #050505;background:${p=>p.$image?`url(${JSON.stringify(p.$image)}) center/cover no-repeat`:"#f1efeb"};font-size:2rem;@media(min-width:561px){${WordCard}[data-mode="list"] &{min-height:100%;border-bottom:0;border-right:2px solid #050505}}`;
const WordBody = styled.div`display:flex;flex-direction:column;min-width:0;padding:.85rem .9rem;`;
const WordHeading = styled.div`display:flex;align-items:flex-start;justify-content:space-between;gap:.55rem;`;
const Term = styled.h3`margin:0;color:#050505;font-size:1.08rem;font-weight:950;overflow-wrap:anywhere;`;
const Pron = styled.div`margin-top:.18rem;color:rgba(5,5,5,.56);font-size:.68rem;font-weight:750;`;
const AudioButton = styled.button`width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border:1.5px solid #050505;border-radius:50%;background:#fff;cursor:pointer;svg{width:15px;height:15px}`;
const Definition = styled.p`margin:.6rem 0 0;color:#050505;font-size:.84rem;line-height:1.48;`;
const Korean = styled.p`margin:.22rem 0 0;color:rgba(5,5,5,.65);font-size:.78rem;line-height:1.45;font-weight:650;`;
const Example = styled.div`margin-top:.65rem;padding:.6rem .7rem;border-radius:10px;background:#f4f3f0;color:rgba(5,5,5,.72);font-size:.72rem;line-height:1.45;`;
const WordFooter = styled.div`margin-top:auto;padding-top:.65rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem;`;
const Source = styled.span`color:rgba(5,5,5,.45);font-size:.61rem;font-weight:800;`;
const Empty = styled.div`padding:2rem 1rem;border:2px dashed #050505;border-radius:16px;background:#fff;color:rgba(5,5,5,.58);text-align:center;font-size:.8rem;`;
const Skeleton = styled.div`height:200px;border:2px solid rgba(5,5,5,.12);border-radius:16px;background:linear-gradient(90deg,#eceae6 25%,#f7f6f3 50%,#eceae6 75%);background-size:200% 100%;animation:pulse 1.3s infinite linear;@keyframes pulse{from{background-position:200% 0}to{background-position:-200% 0}}`;
const ModalBackdrop = styled.div`position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.58);padding:1rem;`;
const Modal = styled.div`width:min(760px,100%);max-height:88vh;overflow-y:auto;border:2px solid #050505;border-radius:18px;background:#fff;padding:1rem;box-shadow:7px 7px 0 #050505;`;
const ModalHeader = styled.div`display:flex;align-items:flex-start;justify-content:space-between;gap:.7rem;margin-bottom:.75rem;`;
const ModalTitle = styled.h2`margin:0;color:#050505;font-size:1.15rem;font-weight:950;`;
const Close = styled.button`width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border:2px solid #050505;border-radius:50%;background:#fff;cursor:pointer;svg{width:16px;height:16px}`;
const Search = styled.input`width:100%;border:2px solid #050505;border-radius:999px;background:#fff;padding:.7rem .9rem;color:#050505;font-size:.82rem;outline:none;`;
const Results = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;margin-top:.75rem;@media(max-width:680px){grid-template-columns:1fr}`;
const SearchSentinel = styled.div`min-height:1px;grid-column:1/-1;`;
const Result = styled.div`border:1.5px solid #050505;border-radius:13px;background:#fff;padding:.75rem;`;
const ResultHeading = styled.div`display:flex;align-items:center;justify-content:space-between;gap:.55rem;`;
const Sense = styled.div`margin-top:.6rem;padding-top:.6rem;border-top:1px solid rgba(5,5,5,.13);`;
const SenseTop = styled.div`display:flex;align-items:flex-start;justify-content:space-between;gap:.55rem;`;
const Grammar = styled.span`display:inline-flex;border:1px solid rgba(5,5,5,.5);border-radius:999px;padding:.15rem .34rem;color:rgba(5,5,5,.65);font-size:.58rem;font-weight:850;`;
const Field = styled.label`display:block;margin-top:.8rem;color:#050505;font-size:.75rem;font-weight:900;`;
const Input = styled.input`width:100%;margin-top:.32rem;border:2px solid #050505;border-radius:11px;background:#fff;padding:.7rem;color:#050505;font-size:.84rem;outline:none;`;
const Textarea = styled.textarea`width:100%;min-height:88px;margin-top:.32rem;border:2px solid #050505;border-radius:11px;background:#fff;padding:.7rem;color:#050505;font-size:.84rem;resize:vertical;outline:none;`;
const ChoiceRow = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;margin-top:.4rem;`;
const Choice = styled.button<{ $active:boolean }>`border:2px solid #050505;border-radius:11px;background:${p=>p.$active?"#f2f1ee":"#fff"};padding:.65rem;text-align:left;cursor:pointer;strong{display:block;font-size:.72rem}span{display:block;margin-top:.12rem;color:rgba(5,5,5,.55);font-size:.64rem;line-height:1.35}`;
const Actions = styled.div`display:flex;justify-content:flex-end;gap:.45rem;margin-top:.9rem;`;

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

  const fetchSearchPage=useCallback(async(normalized:string,offset:number):Promise<DictionaryEntry[]>=>{const { data:entries,error:entryError }=await supabase.from("dictionary_entries").select("id,term,normalized_term").eq("language_code","en").gte("normalized_term",normalized).lt("normalized_term",`${normalized}\uffff`).order("normalized_term",{ascending:true}).range(offset,offset+SEARCH_PAGE_SIZE-1);if(entryError)throw entryError;const ids=(entries||[]).map((row:any)=>String(row.id));if(!ids.length)return[];const { data:meaningRows,error:meaningError }=await supabase.from("dictionary_meanings").select("id,entry_id,grammar_type,definition_en,definition_ko,pronunciation_ipa,example_en,example_ko,audio_url,image_url,source,meaning_order").in("entry_id",ids).order("meaning_order",{ascending:true});if(meaningError)throw meaningError;const byEntry:Record<string,Meaning[]>={};(meaningRows||[]).forEach((row:any)=>{const meaning=mapMeaning(row);if(!meaning)return;(byEntry[meaning.entryId]??=[]).push(meaning)});Object.values(byEntry).forEach(list=>list.sort((a,b)=>Number(Boolean(b.definitionKo?.trim()))-Number(Boolean(a.definitionKo?.trim()))||(a.source==="wiktionary"?0:1)-(b.source==="wiktionary"?0:1)||a.meaningOrder-b.meaningOrder));return(entries||[]).map((row:any)=>{const all=byEntry[String(row.id)]||[];const wiki=all.filter(m=>m.source==="wiktionary");return{id:String(row.id),term:String(row.term),meanings:wiki.length?wiki:all}})},[]);

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
    <Header><HeaderTop><Identity><Cover $image={deck.coverImageUrl}>{deck.coverImageUrl?null:deck.icon}</Cover><div><TitleRow><Title>{displayName}</Title>{isOwner&&!isPersonal&&<Button type="button" onClick={()=>setEditOpen(true)}><PencilSquareIcon />{copy.edit}</Button>}</TitleRow><Description>{displayDescription}</Description><Badges>{deck.isOfficial&&<Badge>{copy.official}</Badge>}{isPersonal&&<Badge>{copy.personal}</Badge>}<Badge>{deck.visibility==="public"?copy.shared:copy.private}</Badge></Badges></div></Identity><HeaderActions>{!isOwner&&deck.visibility==="public"&&<Button type="button" $active={added} disabled={busyKey==="follow"} onClick={()=>void toggleAdded()}>{added?<MinusIcon />:<PlusIcon />}{added?copy.removeDeck:copy.addDeck}</Button>}<StudyLink href={`/vocabulary/study/${deck.id}`}><PlayIcon />{copy.study}</StudyLink></HeaderActions></HeaderTop><Stats><Stat><strong>{items.length}</strong><span>{copy.total}</span></Stat><Stat><strong>{deck.followerCount}</strong><span>{copy.addedUsers}</span></Stat></Stats></Header>

    <Section><SectionTop><SectionText><SectionTitle>{copy.words}</SectionTitle><Hint>{copy.wordsHint}</Hint></SectionText><Toolbar><Segmented><Segment type="button" $active={viewMode==="tiles"} onClick={()=>setViewMode("tiles")}><Squares2X2Icon />{copy.tiles}</Segment><Segment type="button" $active={viewMode==="list"} onClick={()=>setViewMode("list")}><Bars3Icon />{copy.list}</Segment></Segmented>{isOwner&&<Button type="button" $primary onClick={()=>setAddOpen(true)}><PlusIcon />{copy.addWord}</Button>}</Toolbar></SectionTop>
    {items.length?<WordGrid $mode={viewMode}>{items.map(item=><WordCard key={item.id} $mode={viewMode} data-mode={viewMode}><Media $image={item.meaning?.imageUrl}>{item.meaning?.imageUrl?null:"Aa"}</Media><WordBody><WordHeading><div><Term>{item.term}</Term>{item.meaning?.pronunciationIpa&&<Pron>{item.meaning.pronunciationIpa}</Pron>}</div>{item.meaning?.audioUrl&&<AudioButton type="button" onClick={()=>playAudio(item.meaning!.audioUrl!)} aria-label="Play pronunciation"><SpeakerWaveIcon /></AudioButton>}</WordHeading><Definition>{item.meaning?.definitionEn||copy.noDefinition}</Definition>{item.meaning?.definitionKo&&<Korean>{item.meaning.definitionKo}</Korean>}{item.meaning?.exampleEn&&<Example><strong>{copy.example}</strong><br/>{item.meaning.exampleEn}{item.meaning.exampleKo&&<><br/>{item.meaning.exampleKo}</>}</Example>}<WordFooter><Source>{item.meaning?.source==="wiktionary"?copy.source:""}</Source>{isOwner&&<Button type="button" disabled={busyKey===item.id} onClick={()=>void removeItem(item)}><TrashIcon />{copy.remove}</Button>}</WordFooter></WordBody></WordCard>)}</WordGrid>:<Empty>{copy.noItems}</Empty>}
    </Section>

    {addOpen&&<ModalBackdrop onClick={()=>setAddOpen(false)}><Modal onClick={event=>event.stopPropagation()}><ModalHeader><ModalTitle>{copy.addTitle}</ModalTitle><Close type="button" onClick={()=>setAddOpen(false)}><XMarkIcon /></Close></ModalHeader><Search autoFocus value={query} onChange={event=>{setQuery(event.target.value);setResults([]);setHasMoreResults(false)}} placeholder={copy.search}/>{query.trim().length<2?<Empty style={{marginTop:12}}>{copy.searchStart}</Empty>:searching?<Empty style={{marginTop:12}}>{copy.loading}</Empty>:results.length?<Results>{results.map(entry=>{const allKey=`${entry.id}:all`;const allAdded=entry.meanings.length>0&&entry.meanings.every(meaning=>itemKeys.has(`${entry.id}:${meaning.id}`));return <Result key={entry.id}><ResultHeading><Term>{entry.term}</Term>{entry.meanings.length>0&&<ResultAddButton type="button" $active={allAdded} disabled={allAdded||busyKey===allKey} onClick={()=>void addAllMeanings(entry)}>{allAdded?<CheckIcon />:<PlusIcon />}{allAdded?copy.added:copy.addAll}</ResultAddButton>}</ResultHeading>{entry.meanings.length?entry.meanings.map(meaning=>{const key=`${entry.id}:${meaning.id}`;const exists=itemKeys.has(key);return <Sense key={meaning.id}><SenseTop><div><Grammar>{meaning.grammarType}</Grammar><Definition>{meaning.definitionEn||copy.noDefinition}</Definition>{meaning.definitionKo&&<Korean>{meaning.definitionKo}</Korean>}</div><ResultAddButton type="button" $active={exists} disabled={exists||busyKey===key} onClick={()=>void addMeaning(entry,meaning)}>{exists?<CheckIcon />:<PlusIcon />}{exists?copy.added:copy.add}</ResultAddButton></SenseTop></Sense> }):<Sense><SenseTop><Definition>{copy.noDefinition}</Definition><ResultAddButton type="button" onClick={()=>void addMeaning(entry,null)}><PlusIcon />{copy.add}</ResultAddButton></SenseTop></Sense>}</Result>})}{(hasMoreResults||loadingMoreResults)&&<SearchSentinel ref={searchSentinelRef}>{loadingMoreResults&&<Empty style={{padding:".75rem",borderWidth:1}}>{copy.loading}</Empty>}</SearchSentinel>}</Results>:<Empty style={{marginTop:12}}>{copy.noSearch}</Empty>}</Modal></ModalBackdrop>}

    {editOpen&&<ModalBackdrop onClick={()=>setEditOpen(false)}><Modal onClick={event=>event.stopPropagation()}><ModalHeader><ModalTitle>{copy.editTitle}</ModalTitle><Close type="button" onClick={()=>setEditOpen(false)}><XMarkIcon /></Close></ModalHeader><Field>{copy.name}<Input value={editName} maxLength={80} onChange={event=>setEditName(event.target.value)}/></Field><Field>{copy.description}<Textarea value={editDescription} maxLength={500} onChange={event=>setEditDescription(event.target.value)}/></Field><Field>{copy.visibility}</Field><ChoiceRow><Choice type="button" $active={editVisibility==="private"} onClick={()=>setEditVisibility("private")}><strong>{copy.privateOption}</strong><span>{copy.privateOptionHint}</span></Choice><Choice type="button" $active={editVisibility==="public"} onClick={()=>setEditVisibility("public")}><strong>{copy.sharedOption}</strong><span>{copy.sharedOptionHint}</span></Choice></ChoiceRow><Actions><Button type="button" onClick={()=>setEditOpen(false)}>{copy.cancel}</Button><Button type="button" $primary disabled={busyKey==="edit"||!editName.trim()} onClick={()=>void saveEdit()}><PencilSquareIcon />{copy.save}</Button></Actions></Modal></ModalBackdrop>}
  </Shell></Page>;
}
