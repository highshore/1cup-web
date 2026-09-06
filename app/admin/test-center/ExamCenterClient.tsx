"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, ArrowRightIcon, ChartBarIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../../lib/contexts/auth_context";
import { loadExamCenter } from "../../lib/features/exam/services/exam_admin_client";
import type { ExamCenterOverview, ExamSetSummary } from "../../lib/features/exam/types";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  ExamAvatar,
  ExamContent,
  ExamPage,
  ExamPipelineTopbar,
  Loading,
  Notice,
  PipelineEyebrow,
  PipelineLead,
  PipelinePeriod,
  PipelineTitle,
  SetStatusPill,
} from "./exam_ui";

function Heading({ children }: { children: ReactNode }) {
  return <header className="flex items-end justify-between gap-6 border-b border-[#e2d9d4] pb-7 max-[700px]:flex-col max-[700px]:items-start">{children}</header>;
}

function RefreshButton({ className = "", ...rest }: ComponentProps<"button">) {
  return <button className={`inline-flex min-h-[38px] cursor-pointer items-center gap-[7px] border border-[#d9c9c1] bg-[#fffdfb] px-[11px] py-2 text-[#59382a] text-[11px] font-extrabold [&_svg]:h-[15px] [&_svg]:w-[15px] ${className}`} {...rest} />;
}

function Handoff({ children }: { children: ReactNode }) {
  return <section className="mt-[26px] grid grid-cols-[42px_minmax(0,1fr)] gap-4 border border-[#d9b3a3] bg-[#fff5ef] p-[19px] [&_h2]:mt-1 [&_h2]:text-[#3f251b] [&_h2]:[font-family:Georgia,'Times_New_Roman',serif] [&_h2]:text-[25px] [&_h2]:font-medium [&_h2]:tracking-[-.045em] [&_p]:mt-2 [&_p]:max-w-[780px] [&_p]:text-[#765f55] [&_p]:text-[12px] [&_p]:leading-[1.55]">{children}</section>;
}

function HandoffIcon({ children }: { children: ReactNode }) {
  return <span className="grid h-10 w-10 place-items-center bg-[#f47a4a] text-white [&_svg]:h-5 [&_svg]:w-5">{children}</span>;
}

function MetricGrid({ children }: { children: ReactNode }) {
  return <section className="mt-[26px] grid grid-cols-[repeat(4,minmax(0,1fr))] gap-3 max-[820px]:grid-cols-[repeat(2,minmax(0,1fr))]">{children}</section>;
}

function Metric({ children }: { children: ReactNode }) {
  return <article className="min-w-0 border border-[#e2d8d2] bg-white p-[17px] [&_span]:block [&_span]:text-[#88756b] [&_span]:[font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace] [&_span]:text-[8px] [&_span]:font-extrabold [&_span]:uppercase [&_span]:tracking-[.07em] [&_strong]:mt-2 [&_strong]:block [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:text-[#342018] [&_strong]:[font-family:Georgia,'Times_New_Roman',serif] [&_strong]:text-[31px] [&_strong]:font-medium [&_strong]:tracking-[-.06em]">{children}</article>;
}

function ListSection({ children }: { children: ReactNode }) {
  return <section className="mt-7 border border-[#e2d8d2] bg-white">{children}</section>;
}

function ListHeading({ children }: { children: ReactNode }) {
  return <header className="flex items-center justify-between gap-4 border-b border-[#e9dfda] px-5 py-[18px] [&_h2]:mt-1 [&_h2]:text-[#3b241a] [&_h2]:[font-family:Georgia,'Times_New_Roman',serif] [&_h2]:text-[26px] [&_h2]:font-medium [&_h2]:tracking-[-.05em]">{children}</header>;
}

function SetRow({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return <Link className={`grid grid-cols-[minmax(240px,1.35fr)_minmax(180px,.7fr)_minmax(120px,.5fr)_auto] items-center gap-[18px] border-b border-[#eee6e2] px-5 py-[17px] text-inherit no-underline last:border-b-0 hover:bg-[#fff8f4] hover:text-inherit hover:no-underline max-[800px]:grid-cols-[1fr_auto] max-[800px]:gap-[11px] ${className}`} {...rest} />;
}

function SetName({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2.5 [&_strong]:block [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[#43291f] [&_strong]:text-[13px] [&_strong]:font-[850] [&_small]:mt-1 [&_small]:block [&_small]:overflow-hidden [&_small]:text-ellipsis [&_small]:whitespace-nowrap [&_small]:text-[#806e65] [&_small]:text-[10px]">{children}</div>;
}

function Readiness({ children }: { children: ReactNode }) {
  return <div className="max-[800px]:hidden [&_strong]:block [&_strong]:text-[#503429] [&_strong]:text-[12px] [&_small]:mt-1 [&_small]:block [&_small]:text-[#87746b] [&_small]:text-[10px]">{children}</div>;
}

function Score({ children }: { children: ReactNode }) {
  return <div className="max-[800px]:hidden [&_strong]:block [&_strong]:text-[#503429] [&_strong]:text-[13px] [&_small]:mt-1 [&_small]:block [&_small]:text-[#87746b] [&_small]:text-[10px]">{children}</div>;
}

function Chevron({ children }: { children: ReactNode }) {
  return <span className="grid h-[30px] w-[30px] place-items-center border border-[#e3d3cb] text-[#b34a29] [&_svg]:h-[15px] [&_svg]:w-[15px]">{children}</span>;
}

function mediaReady(set: ExamSetSummary) {
  return set.item_count === 11 && set.ready_item_count === 11;
}

export default function ExamCenterClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<ExamCenterOverview | null>(null);
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setWorkspace(await loadExamCenter());
      setNotice(null);
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : t.examCenter.workspaceLoadFailed });
    } finally {
      setRefreshing(false);
    }
  }, [t.examCenter.workspaceLoadFailed]);

  useEffect(() => {
    if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/");
  }, [accountStatus, currentUser, isLoading, router]);

  useEffect(() => {
    if (currentUser && accountStatus === "admin") void refresh();
  }, [accountStatus, currentUser, refresh]);

  const metrics = useMemo(() => {
    const sets = workspace?.sets ?? [];
    const scored = sets.reduce((total, set) => total + (set.scored_attempt_count ?? 0), 0);
    const weightedScore = sets.reduce((total, set) => total + ((set.average_score ?? 0) * (set.scored_attempt_count ?? 0)), 0);
    return {
      sets: sets.length,
      deployed: sets.filter((set) => set.is_deployed).length,
      attempts: sets.reduce((total, set) => total + (set.attempt_count ?? 0), 0),
      score: scored ? Math.round((weightedScore / scored) * 10) / 10 : null,
    };
  }, [workspace]);

  if (isLoading || !workspace) return <ExamPage><ExamPipelineTopbar current="sets" actionHref="/admin" actionLabel={t.examCenter.back} /><ExamContent><Loading>{notice?.text || t.examCenter.loadingWorkspace}</Loading></ExamContent></ExamPage>;

  return <ExamPage>
    <ExamPipelineTopbar current="sets" actionHref="/admin" actionLabel={t.examCenter.back} />
    <ExamContent>
      <Heading>
        <div><PipelineEyebrow>{t.examCenter.workspace}</PipelineEyebrow><PipelineTitle>{t.examCenter.testCenterTitle}<PipelinePeriod>.</PipelinePeriod></PipelineTitle><PipelineLead>{t.examCenter.testOperationsLead}</PipelineLead></div>
        <RefreshButton type="button" onClick={() => void refresh()} disabled={refreshing}><ArrowPathIcon />{refreshing ? t.examCenter.refreshing : t.examCenter.refresh}</RefreshButton>
      </Heading>
      {notice && <Notice $error={notice.error}>{notice.text}</Notice>}

      <Handoff>
        <HandoffIcon><CloudArrowUpIcon /></HandoffIcon>
        <div><PipelineEyebrow>{t.examCenter.desktopProduction}</PipelineEyebrow><h2>{t.examCenter.desktopProductionTitle}</h2><p>{t.examCenter.desktopProductionLead}</p></div>
      </Handoff>

      <MetricGrid>
        <Metric><span>{t.examCenter.productionSets}</span><strong>{metrics.sets}</strong></Metric>
        <Metric><span>{t.examCenter.deployed}</span><strong>{metrics.deployed}</strong></Metric>
        <Metric><span>{t.examCenter.learnerAttempts}</span><strong>{metrics.attempts}</strong></Metric>
        <Metric><span>{t.examCenter.averageScore}</span><strong>{metrics.score ?? "—"}</strong></Metric>
      </MetricGrid>

      <ListSection>
        <ListHeading><div><PipelineEyebrow>{t.examCenter.manageDelivery}</PipelineEyebrow><h2>{t.examCenter.exams}<PipelinePeriod>.</PipelinePeriod></h2></div><ChartBarIcon width={23} color="#a84728" /></ListHeading>
        {!workspace.sets.length ? <Notice>{t.examCenter.noExams}</Notice> : workspace.sets.map((set) => <SetRow key={set.id} href={`/admin/test-center/exams/${set.id}`}>
          <SetName>{set.interviewer && <ExamAvatar interviewer={set.interviewer} />}<div><strong>{set.title}</strong><small>{set.interviewer?.name ?? t.examCenter.interviewer} · {set.deployment_categories.length ? set.deployment_categories.join(", ") : t.examCenter.staging}</small></div></SetName>
          <Readiness><strong>{set.ready_item_count ?? 0}/{set.item_count ?? 0} {t.examCenter.mediaReady}</strong><small>{mediaReady(set) ? t.examCenter.mediaReadyLabel : t.examCenter.mediaNeedsAttentionLabel}</small></Readiness>
          <Score><strong>{set.average_score ?? "—"}{set.average_score !== null ? "/55" : ""}</strong><small>{set.scored_attempt_count ?? 0} {t.examCenter.scoredAttempts}</small></Score>
          <div style={{ display: "grid", justifyItems: "end", gap: 7 }}><SetStatusPill status={set.status} /><Chevron><ArrowRightIcon /></Chevron></div>
        </SetRow>)}
      </ListSection>
    </ExamContent>
  </ExamPage>;
}
