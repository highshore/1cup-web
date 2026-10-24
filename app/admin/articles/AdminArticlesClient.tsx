"use client";

import type { HTMLAttributes, Ref } from "react";
import { useRouter } from "next/navigation";

import AdminArticleIngestForm from "../../lib/features/article/components/AdminArticleIngestForm";
import { useAuth } from "../../lib/contexts/auth_context";
import { useI18n } from "../../lib/i18n/I18nProvider";
import AdminArticleCard, { Hint } from "./AdminArticleCard";
import { PAGE_SIZE, useAdminArticlesFeed } from "./useAdminArticlesFeed";

type DivProps = HTMLAttributes<HTMLDivElement>;
type HeadingProps = HTMLAttributes<HTMLHeadingElement>;

function Wrapper({ className = "", ...rest }: DivProps) {
  return (
    <div
      {...rest}
      className={`flex flex-col px-5 pb-10 max-w-[1400px] mx-auto gap-[30px] ${className}`}
    />
  );
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
  // app/admin/layout.tsx has already redirected non-admins on the server; this only
  // waits for the browser session so RLS sees it before the list loads.
  const sessionReady = !authLoading && Boolean(currentUser) && accountStatus === "admin";
  const {
    articles,
    totalCount,
    hasMore,
    initialLoading,
    loadingMore,
    deletingId,
    sentinelRef,
    handleQueued,
    handleDelete,
  } = useAdminArticlesFeed(sessionReady, copy);

  if (!sessionReady || initialLoading) {
    return <Wrapper><Loading>{t.admin.dashboard.loading}</Loading></Wrapper>;
  }

  return (
    <Wrapper>
      <AdminArticleIngestForm onArticleQueued={handleQueued} />

      <ContentSection>
        <SectionTitle>{copy.listTitle.replace("{count}", String(totalCount))}</SectionTitle>
        {articles.length === 0 ? (
          <Empty>{copy.empty}</Empty>
        ) : (
          <ArticlesList>
            {articles.map((article) => (
              <AdminArticleCard
                key={article.id}
                article={article}
                deleting={deletingId === article.id}
                onOpen={() => router.push(`/article/${article.id}`)}
                onDelete={() => void handleDelete(article.id)}
              />
            ))}
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
