"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, Ref } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { enUS, ko } from "date-fns/locale";
import { TrashIcon } from "@heroicons/react/24/outline";

import AdminArticleIngestForm from "../../lib/features/article/components/AdminArticleIngestForm";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { supabase } from "../../lib/supabase/client";

const PAGE_SIZE = 10;
const ARTICLE_COLUMNS = "id,title,timestamp,created_at,publication_status,processing";

type ArticleStatus = "processing" | "published" | "failed";

type ArticleData = {
  id: string;
  titleEnglish: string;
  titleKorean: string;
  publishedAt?: Date;
  cursorTimestamp?: string;
  publicationStatus?: ArticleStatus;
  processing?: {
    state?: string;
    stage?: string;
    progress?: number;
    errorMessage?: string;
    failedStage?: string;
  };
};

const parseArticle = (row: Record<string, unknown>): ArticleData => {
  const title = row.title && typeof row.title === "object"
    ? (row.title as Record<string, unknown>)
    : {};
  const processing = row.processing && typeof row.processing === "object"
    ? (row.processing as Record<string, unknown>)
    : undefined;
  const processingError = processing?.error && typeof processing.error === "object"
    ? (processing.error as Record<string, unknown>)
    : undefined;
  const timestamp = typeof row.timestamp === "string"
    ? row.timestamp
    : typeof row.created_at === "string"
      ? row.created_at
      : undefined;
  const parsedDate = timestamp ? new Date(timestamp) : undefined;
  const rawStatus = row.publication_status;

  return {
    id: String(row.id ?? ""),
    titleEnglish: typeof title.english === "string" ? title.english : "",
    titleKorean: typeof title.korean === "string" ? title.korean : "",
    publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
    cursorTimestamp: timestamp,
    publicationStatus:
      rawStatus === "processing" || rawStatus === "published" || rawStatus === "failed"
        ? rawStatus
        : undefined,
    processing: processing
      ? {
          state: typeof processing.state === "string" ? processing.state : undefined,
          stage: typeof processing.stage === "string" ? processing.stage : undefined,
          progress: typeof processing.progress === "number" ? processing.progress : undefined,
          failedStage:
            typeof processing.failedStage === "string" ? processing.failedStage : undefined,
          errorMessage:
            typeof processingError?.message === "string"
              ? processingError.message
              : undefined,
        }
      : undefined,
  };
};

const sortArticles = (items: ArticleData[]) =>
  [...items].sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );

const mergeArticle = (items: ArticleData[], next: ArticleData) =>
  sortArticles([next, ...items.filter((item) => item.id !== next.id)]);

type DivProps = HTMLAttributes<HTMLDivElement>;
type SpanProps = HTMLAttributes<HTMLSpanElement>;
type HeadingProps = HTMLAttributes<HTMLHeadingElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

function Wrapper({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex flex-col px-5 pb-10 max-w-[1400px] mx-auto gap-[30px] ${className}`}
    />
  );
}

function Header({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`mb-[-10px] ${className}`} />;
}

function Title({ className = "", ...rest }: HeadingProps) {
  return <h1 {...rest} className={`m-0 text-[#050505] text-[28px] font-black ${className}`} />;
}

function ContentSection({ className = "", ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...rest}
      className={`bg-white rounded-[16px] p-6 shadow-[6px_6px_0_rgba(5,5,5,0.9)] border-[3px] border-[#050505] ${className}`}
    />
  );
}

function SectionTitle({ className = "", ...rest }: HeadingProps) {
  return (
    <h2
      {...rest}
      className={`inline-flex items-center border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] px-[0.7rem] py-[0.3rem] text-[16px] font-black mx-0 mt-0 mb-5 ${className}`}
    />
  );
}

function ArticlesList({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`flex flex-col gap-[10px] ${className}`} />;
}

function ArticleCard({ className = "", ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <article
      {...rest}
      className={`w-full flex flex-col box-border py-3 px-[14px] rounded-[10px] border-[1.5px] border-[#050505] bg-white text-[#050505] shadow-[3px_3px_0_rgba(5,5,5,0.9)] ${className}`}
    />
  );
}

function ArticleOpenButton({
  $ready,
  className = "",
  ...rest
}: { $ready: boolean } & ButtonProps) {
  return (
    <button
      {...rest}
      className={`flex w-full flex-col gap-[6px] border-0 p-0 bg-transparent text-inherit text-left [&:hover:not(:disabled)]:[transform:translate(-1px,-1px)] focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-[#f47a4a] focus-visible:outline-offset-[5px] disabled:opacity-[0.78] ${
        $ready ? "cursor-pointer" : "cursor-default"
      } ${className}`}
    />
  );
}

function ArticleHeader({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex justify-between items-start gap-3 max-[700px]:flex-col ${className}`}
    />
  );
}

function ArticleTitle({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`text-[#050505] text-[15px] font-black leading-[1.45] ${className}`}
    />
  );
}

function ArticleSubtitle({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`text-[rgba(5,5,5,0.68)] text-[13px] font-bold ${className}`} />;
}

function ArticleMeta({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex flex-wrap justify-end gap-2 text-[rgba(5,5,5,0.6)] text-[12px] text-right max-[700px]:justify-start max-[700px]:text-left ${className}`}
    />
  );
}

function ArticleFooter({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`flex flex-col gap-[6px] mt-[6px] ${className}`} />;
}

function ArticleStatus({
  $tone,
  className = "",
  ...rest
}: { $tone: ArticleStatus } & SpanProps) {
  return (
    <span
      {...rest}
      className={`inline-flex w-fit items-center border-[1.5px] border-[#050505] rounded-full px-2 py-1 text-[11px] font-black ${
        $tone === "failed" ? "bg-[#fee2e2]" : $tone === "published" ? "bg-[#dcfce7]" : "bg-[#fff3cd]"
      } ${$tone === "failed" ? "text-[#991b1b]" : "text-[#050505]"} ${className}`}
    />
  );
}

function ProgressTrack({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`w-full h-2 overflow-hidden border-[1.5px] border-[#050505] rounded-full bg-[#fff8f4] ${className}`}
    />
  );
}

function ProgressFill({
  $progress,
  $failed,
  className = "",
  style,
  ...rest
}: { $progress: number; $failed: boolean } & DivProps) {
  return (
    <div
      {...rest}
      style={{ width: `${$progress}%`, ...style }}
      className={`h-full ${$failed ? "bg-[#dc2626]" : "bg-[#f47a4a]"} ${className}`}
    />
  );
}

function Hint({ className = "", ...rest }: SpanProps) {
  return <span {...rest} className={`text-[rgba(5,5,5,0.6)] text-[12px] font-bold ${className}`} />;
}

function ErrorDetail({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`border-l-[3px] border-l-[#dc2626] pl-[9px] text-[#991b1b] text-[12px] font-bold leading-[1.45] ${className}`}
    />
  );
}

function ArticleActions({ className = "", ...rest }: DivProps) {
  return <div {...rest} className={`flex justify-end mt-2 ${className}`} />;
}

function DeleteButton({ className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-[6px] px-[14px] py-2 rounded-full border-2 border-[#050505] bg-[#fee2e2] text-[#991b1b] text-[13px] font-extrabold cursor-pointer shadow-[2px_2px_0_#991b1b] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none [&_svg]:w-4 [&_svg]:h-4 ${className}`}
    />
  );
}

function Loading({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex justify-center p-7 text-[rgba(5,5,5,0.6)] text-[13px] font-extrabold ${className}`}
    />
  );
}

function Empty({ className = "", ...rest }: DivProps) {
  return (
    <div {...rest} className={`p-9 text-center text-[rgba(5,5,5,0.6)] font-bold ${className}`} />
  );
}

function Sentinel({
  className = "",
  ...rest
}: DivProps & { ref?: Ref<HTMLDivElement> }) {
  return <div {...rest} className={`w-full h-px ${className}`} />;
}

export default function AdminArticlesClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const { t, locale } = useI18n();
  const copy = t.admin.articles;
  const [authorized, setAuthorized] = useState(false);
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef(new Set<string>());
  const locallyDeletingIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.replace("/");
      return;
    }
    setAuthorized(true);
  }, [accountStatus, authLoading, currentUser, router]);

  const loadFirstPage = useCallback(async () => {
    setInitialLoading(true);
    try {
      const { data, error, count } = await supabase
        .from("articles")
        .select(ARTICLE_COLUMNS, { count: "exact" })
        .order("timestamp", { ascending: false, nullsFirst: false })
        .limit(PAGE_SIZE);
      if (error) throw error;

      const next = (data || []).map((row) => parseArticle(row as Record<string, unknown>));
      knownIdsRef.current = new Set(next.map((article) => article.id));
      setArticles(next);
      setTotalCount(count ?? next.length);
      setCursor(next.at(-1)?.cursorTimestamp ?? null);
      setHasMore(next.length === PAGE_SIZE && Boolean(next.at(-1)?.cursorTimestamp));
    } catch (error) {
      console.error("Error fetching initial admin articles:", error);
      setArticles([]);
      setHasMore(false);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!authorized || initialLoading || loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select(ARTICLE_COLUMNS)
        .lt("timestamp", cursor)
        .order("timestamp", { ascending: false, nullsFirst: false })
        .limit(PAGE_SIZE);
      if (error) throw error;

      const page = (data || []).map((row) => parseArticle(row as Record<string, unknown>));
      page.forEach((article) => knownIdsRef.current.add(article.id));
      setArticles((current) => {
        const byId = new Map(current.map((article) => [article.id, article]));
        page.forEach((article) => byId.set(article.id, article));
        return sortArticles(Array.from(byId.values()));
      });
      setCursor(page.at(-1)?.cursorTimestamp ?? null);
      setHasMore(page.length === PAGE_SIZE && Boolean(page.at(-1)?.cursorTimestamp));
    } catch (error) {
      console.error("Error loading more admin articles:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [authorized, cursor, hasMore, initialLoading, loadingMore]);

  useEffect(() => {
    if (!authorized) return;
    void loadFirstPage();

    const channel = supabase
      .channel("admin-articles-paginated")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "articles" },
        (payload) => {
          const next = parseArticle(payload.new as Record<string, unknown>);
          const wasKnown = knownIdsRef.current.has(next.id);
          knownIdsRef.current.add(next.id);
          setArticles((current) => mergeArticle(current, next));
          if (!wasKnown) setTotalCount((count) => count + 1);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "articles" },
        (payload) => {
          const next = parseArticle(payload.new as Record<string, unknown>);
          if (!knownIdsRef.current.has(next.id)) return;
          setArticles((current) => mergeArticle(current, next));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "articles" },
        (payload) => {
          const id = String((payload.old as Record<string, unknown>).id ?? "");
          if (!id) return;
          const wasKnown = knownIdsRef.current.has(id);
          if (wasKnown) {
            knownIdsRef.current.delete(id);
            setArticles((current) => current.filter((article) => article.id !== id));
          }
          if (locallyDeletingIdsRef.current.has(id)) {
            locallyDeletingIdsRef.current.delete(id);
            return;
          }
          setTotalCount((count) => Math.max(0, count - 1));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized, loadFirstPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !authorized) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [authorized, loadMore]);

  const handleQueued = ({ articleId, title }: { articleId: string; title: string }) => {
    const wasKnown = knownIdsRef.current.has(articleId);
    knownIdsRef.current.add(articleId);
    const queued: ArticleData = {
      id: articleId,
      titleEnglish: title,
      titleKorean: "",
      publishedAt: new Date(),
      cursorTimestamp: new Date().toISOString(),
      publicationStatus: "processing",
      processing: { state: "queued", stage: "queued", progress: 5 },
    };
    setArticles((current) => mergeArticle(current, queued));
    if (!wasKnown) setTotalCount((count) => count + 1);
  };

  const handleDelete = async (articleId: string) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setDeletingId(articleId);
    locallyDeletingIdsRef.current.add(articleId);
    try {
      const { error } = await supabase.from("articles").delete().eq("id", articleId);
      if (error) throw error;
      if (knownIdsRef.current.has(articleId)) {
        knownIdsRef.current.delete(articleId);
        setArticles((current) => current.filter((article) => article.id !== articleId));
      }
      if (locallyDeletingIdsRef.current.delete(articleId)) {
        setTotalCount((count) => Math.max(0, count - 1));
      }
    } catch (error) {
      locallyDeletingIdsRef.current.delete(articleId);
      console.error("Error deleting article:", error);
      window.alert(copy.deleteError);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateTime = (date?: Date) =>
    date
      ? format(date, "yyyy.MM.dd HH:mm", { locale: locale === "ko" ? ko : enUS })
      : t.admin.dashboard.unavailable;

  const processingLabel = (article: ArticleData) => {
    if (article.publicationStatus === "failed") return copy.statusFailed;
    if (!article.publicationStatus || article.publicationStatus === "published") {
      return copy.statusPublished;
    }
    switch (article.processing?.stage) {
      case "refining": return copy.statusRefining;
      case "summarizing": return copy.statusSummarizing;
      case "extractingVocabulary": return copy.statusExtractingVocabulary;
      case "draftingDiscussion": return copy.statusDraftingDiscussion;
      case "identifyingTerms": return copy.statusIdentifyingTerms;
      case "organizing": return copy.statusOrganizing;
      case "translating": return copy.statusTranslating;
      case "polishingKorean": return copy.statusPolishingKorean;
      case "validating": return copy.statusValidating;
      case "placingFigures": return copy.statusPlacingFigures;
      case "designingCover": return copy.statusDesigningCover;
      case "illustrating": return copy.statusIllustrating;
      case "publishing": return copy.statusPublishing;
      default: return copy.statusQueued;
    }
  };

  if (authLoading || !authorized || initialLoading) {
    return <Wrapper><Loading>{t.admin.dashboard.loading}</Loading></Wrapper>;
  }

  return (
    <Wrapper>
      <Header><Title>{copy.pageTitle}</Title></Header>
      <AdminArticleIngestForm onArticleQueued={handleQueued} />

      <ContentSection>
        <SectionTitle>{copy.listTitle.replace("{count}", String(totalCount))}</SectionTitle>
        {articles.length === 0 ? (
          <Empty>{copy.empty}</Empty>
        ) : (
          <ArticlesList>
            {articles.map((article) => {
              const primaryTitle = article.titleEnglish || article.titleKorean || copy.untitled;
              const showKorean = article.titleKorean && article.titleKorean !== article.titleEnglish;
              const isReady = !article.publicationStatus || article.publicationStatus === "published";
              const isFailed = article.publicationStatus === "failed";
              const progress = Math.max(0, Math.min(100, article.processing?.progress ?? (isReady ? 100 : 5)));
              const tone: ArticleStatus = isFailed ? "failed" : isReady ? "published" : "processing";

              return (
                <ArticleCard key={article.id}>
                  <ArticleOpenButton
                    type="button"
                    $ready={isReady}
                    disabled={!isReady}
                    onClick={() => router.push(`/article/${article.id}`)}
                    aria-label={isReady ? copy.openReady : copy.availableWhenReady}
                  >
                    <ArticleHeader>
                      <ArticleTitle>{primaryTitle}</ArticleTitle>
                      <ArticleMeta>
                        <span>{formatDateTime(article.publishedAt)}</span>
                        <span>{copy.articleId.replace("{id}", article.id)}</span>
                      </ArticleMeta>
                    </ArticleHeader>
                    {showKorean && <ArticleSubtitle>{article.titleKorean}</ArticleSubtitle>}
                    <ArticleFooter>
                      <ArticleStatus $tone={tone}>
                        {!isReady && !isFailed
                          ? copy.processingProgress
                              .replace("{status}", processingLabel(article))
                              .replace("{progress}", String(progress))
                          : processingLabel(article)}
                      </ArticleStatus>
                      {!isReady && (
                        <>
                          <ProgressTrack><ProgressFill $progress={progress} $failed={isFailed} /></ProgressTrack>
                          <Hint>{copy.availableWhenReady}</Hint>
                        </>
                      )}
                      {isFailed && article.processing?.errorMessage && (
                        <ErrorDetail>
                          {locale === "ko" ? "실패 원인" : "Failure"}: {article.processing.errorMessage}
                          {article.processing.failedStage
                            ? ` (${locale === "ko" ? "단계" : "stage"}: ${article.processing.failedStage})`
                            : ""}
                        </ErrorDetail>
                      )}
                    </ArticleFooter>
                  </ArticleOpenButton>
                  <ArticleActions>
                    <DeleteButton
                      type="button"
                      onClick={() => void handleDelete(article.id)}
                      disabled={deletingId === article.id}
                    >
                      <TrashIcon />
                      {deletingId === article.id ? copy.deleting : copy.delete}
                    </DeleteButton>
                  </ArticleActions>
                </ArticleCard>
              );
            })}
            <Sentinel ref={sentinelRef} aria-hidden="true" />
            {loadingMore && <Loading>{locale === "ko" ? "아티클을 더 불러오는 중…" : "Loading more articles…"}</Loading>}
            {!hasMore && articles.length > PAGE_SIZE && (
              <Hint>{locale === "ko" ? "모든 아티클을 불러왔습니다." : "All articles loaded."}</Hint>
            )}
          </ArticlesList>
        )}
      </ContentSection>
    </Wrapper>
  );
}
