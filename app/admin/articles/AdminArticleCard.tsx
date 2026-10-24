"use client";

import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { format } from "date-fns";
import { enUS, ko } from "date-fns/locale";
import { TrashIcon } from "@heroicons/react/24/outline";

import type { getDictionary } from "../../lib/i18n";
import { useI18n } from "../../lib/i18n/I18nProvider";
import type { ArticleData, ArticleStatus } from "./useAdminArticlesFeed";

type DivProps = HTMLAttributes<HTMLDivElement>;
type SpanProps = HTMLAttributes<HTMLSpanElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

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

export function Hint({ className = "", ...rest }: SpanProps) {
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

type ArticlesCopy = ReturnType<typeof getDictionary>["admin"]["articles"];

// The localized label for where an article is in the ingest pipeline.
function processingLabel(article: ArticleData, copy: ArticlesCopy) {
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
}

// Ingest state for one article: published (or legacy with no status), failed, or in progress.
function articleProgress(article: ArticleData) {
  const isReady = !article.publicationStatus || article.publicationStatus === "published";
  const isFailed = article.publicationStatus === "failed";
  const progress = Math.max(0, Math.min(100, article.processing?.progress ?? (isReady ? 100 : 5)));
  const tone: ArticleStatus = isFailed ? "failed" : isReady ? "published" : "processing";
  return { isReady, isFailed, progress, tone };
}

// Status pill, progress bar while ingesting, and the failure reason when ingest failed.
function ArticleProgressFooter({ article, copy }: { article: ArticleData; copy: ArticlesCopy }) {
  const { locale } = useI18n();
  const { isReady, isFailed, progress, tone } = articleProgress(article);
  const status = processingLabel(article, copy);
  const isProcessing = !isReady && !isFailed;
  const failure = isFailed ? article.processing : undefined;

  return (
    <ArticleFooter>
      <ArticleStatus $tone={tone}>
        {isProcessing
          ? copy.processingProgress
              .replace("{status}", status)
              .replace("{progress}", String(progress))
          : status}
      </ArticleStatus>
      {!isReady && (
        <>
          <ProgressTrack><ProgressFill $progress={progress} $failed={isFailed} /></ProgressTrack>
          <Hint>{copy.availableWhenReady}</Hint>
        </>
      )}
      {failure?.errorMessage && (
        <ErrorDetail>
          {locale === "ko" ? "실패 원인" : "Failure"}: {failure.errorMessage}
          {failure.failedStage
            ? ` (${locale === "ko" ? "단계" : "stage"}: ${failure.failedStage})`
            : ""}
        </ErrorDetail>
      )}
    </ArticleFooter>
  );
}

interface AdminArticleCardProps {
  article: ArticleData;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

// One article in the admin list: title, ingest progress or failure detail, and delete.
export default function AdminArticleCard({ article, deleting, onOpen, onDelete }: AdminArticleCardProps) {
  const { t, locale } = useI18n();
  const copy = t.admin.articles;

  const formatDateTime = (date?: Date) =>
    date
      ? format(date, "yyyy.MM.dd HH:mm", { locale: locale === "ko" ? ko : enUS })
      : t.admin.dashboard.unavailable;

  const primaryTitle = article.titleEnglish || article.titleKorean || copy.untitled;
  const showKorean = article.titleKorean && article.titleKorean !== article.titleEnglish;
  const { isReady } = articleProgress(article);

  return (
    <ArticleCard>
      <ArticleOpenButton
        type="button"
        $ready={isReady}
        disabled={!isReady}
        onClick={onOpen}
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
        <ArticleProgressFooter article={article} copy={copy} />
      </ArticleOpenButton>
      <ArticleActions>
        <DeleteButton
          type="button"
          onClick={onDelete}
          disabled={deleting}
        >
          <TrashIcon />
          {deleting ? copy.deleting : copy.delete}
        </DeleteButton>
      </ArticleActions>
    </ArticleCard>
  );
}
