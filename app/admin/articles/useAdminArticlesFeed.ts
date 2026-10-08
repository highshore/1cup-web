"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "../../lib/supabase/client";

export const PAGE_SIZE = 10;
const ARTICLE_COLUMNS = "id,title,timestamp,created_at,publication_status,processing";

export type ArticleStatus = "processing" | "published" | "failed";

export type ArticleData = {
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

// The admin article list: first page, cursor pagination, and realtime inserts/updates/
// deletes from the ingest pipeline. Nothing loads until `enabled` (the browser session
// is ready); admin access itself is checked on the server by app/admin/layout.tsx.
export function useAdminArticlesFeed(
  enabled: boolean,
  copy: { deleteConfirm: string; deleteError: string },
) {
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
    if (!enabled || initialLoading || loadingMore || !hasMore || !cursor) return;
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
  }, [enabled, cursor, hasMore, initialLoading, loadingMore]);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, loadFirstPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, loadMore]);

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

  return {
    articles,
    totalCount,
    hasMore,
    initialLoading,
    loadingMore,
    deletingId,
    sentinelRef,
    handleQueued,
    handleDelete,
  };
}
