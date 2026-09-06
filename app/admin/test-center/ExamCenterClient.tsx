"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, ArrowRightIcon, ChartBarIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

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

const Heading = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 28px;
  border-bottom: 1px solid #e2d9d4;

  @media (max-width: 700px) { align-items: flex-start; flex-direction: column; }
`;

const RefreshButton = styled.button`
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 7px;
  border: 1px solid #d9c9c1;
  padding: 8px 11px;
  background: #fffdfb;
  color: #59382a;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  svg { width: 15px; height: 15px; }
`;

const Handoff = styled.section`
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 16px;
  margin-top: 26px;
  border: 1px solid #d9b3a3;
  padding: 19px;
  background: #fff5ef;

  h2 { margin: 4px 0 0; color: #3f251b; font-family: Georgia, "Times New Roman", serif; font-size: 25px; font-weight: 500; letter-spacing: -.045em; }
  p { max-width: 780px; margin: 8px 0 0; color: #765f55; font-size: 12px; line-height: 1.55; }
`;

const HandoffIcon = styled.span`
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  background: #f47a4a;
  color: white;
  svg { width: 20px; height: 20px; }
`;

const MetricGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 26px;

  @media (max-width: 820px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;

const Metric = styled.article`
  min-width: 0;
  border: 1px solid #e2d8d2;
  padding: 17px;
  background: #fff;
  span { display: block; color: #88756b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 8px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
  strong { display: block; overflow: hidden; margin-top: 8px; color: #342018; font-family: Georgia, "Times New Roman", serif; font-size: 31px; font-weight: 500; letter-spacing: -.06em; text-overflow: ellipsis; }
`;

const ListSection = styled.section`
  margin-top: 28px;
  border: 1px solid #e2d8d2;
  background: #fff;
`;

const ListHeading = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid #e9dfda;
  h2 { margin: 4px 0 0; color: #3b241a; font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 500; letter-spacing: -.05em; }
`;

const SetRow = styled(Link)`
  display: grid;
  grid-template-columns: minmax(240px, 1.35fr) minmax(180px, .7fr) minmax(120px, .5fr) auto;
  gap: 18px;
  align-items: center;
  border-bottom: 1px solid #eee6e2;
  padding: 17px 20px;
  color: inherit;
  text-decoration: none;

  &:last-child { border-bottom: 0; }
  &:hover { background: #fff8f4; color: inherit; text-decoration: none; }
  @media (max-width: 800px) { grid-template-columns: 1fr auto; gap: 11px; }
`;

const SetName = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  strong, small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  strong { color: #43291f; font-size: 13px; font-weight: 850; }
  small { margin-top: 4px; color: #806e65; font-size: 10px; }
`;

const Readiness = styled.div`
  strong, small { display: block; }
  strong { color: #503429; font-size: 12px; }
  small { margin-top: 4px; color: #87746b; font-size: 10px; }
  @media (max-width: 800px) { display: none; }
`;

const Score = styled.div`
  strong, small { display: block; }
  strong { color: #503429; font-size: 13px; }
  small { margin-top: 4px; color: #87746b; font-size: 10px; }
  @media (max-width: 800px) { display: none; }
`;

const Chevron = styled.span`
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid #e3d3cb;
  color: #b34a29;
  svg { width: 15px; height: 15px; }
`;

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
