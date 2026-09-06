"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, CheckIcon, PlayIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../../../lib/contexts/auth_context";
import { loadExamSet, postExamAction } from "../../../../lib/features/exam/services/exam_admin_client";
import type { ExamItem, ExamSetDetail } from "../../../../lib/features/exam/types";
import type { SpeakingTestCategory } from "../../../../lib/features/speaking-test/types";
import { useI18n } from "../../../../lib/i18n/I18nProvider";
import {
  Button,
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
} from "../../exam_ui";

const Heading = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 22px;
  padding-bottom: 29px;
  border-bottom: 1px solid #e2d9d4;
  @media (max-width: 760px) { align-items: flex-start; flex-direction: column; }
`;

const HeaderActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
`;

const OverviewGrid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(250px, .7fr);
  gap: 20px;
  margin-top: 25px;
  @media (max-width: 850px) { grid-template-columns: 1fr; }
`;

const Card = styled.section`
  border: 1px solid #e3d7d1;
  padding: 19px;
  background: #fff;
  h2 { margin: 5px 0 0; color: #392219; font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 500; letter-spacing: -.05em; }
  p { color: #7c6a61; font-size: 11px; line-height: 1.55; }
`;

const Facts = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 18px 0 0;
  border-top: 1px solid #eadfd9;
  border-left: 1px solid #eadfd9;
  div { min-width: 0; border-right: 1px solid #eadfd9; border-bottom: 1px solid #eadfd9; padding: 11px 10px; }
  dt { color: #8b786e; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 8px; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; }
  dd { overflow: hidden; margin: 6px 0 0; color: #513429; font-size: 12px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
`;

const Interviewer = styled.div`
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  margin-top: 14px;
  h3 { margin: 0; color: #442a20; font-size: 14px; }
  p { margin: 5px 0 0; }
`;

const Deployment = styled.section`
  margin-top: 20px;
  border: 1px solid #e3d7d1;
  padding: 19px;
  background: #fff;
`;

const DeploymentHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  h2 { margin: 5px 0 0; color: #382219; font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 500; letter-spacing: -.05em; }
  p { max-width: 610px; margin: 7px 0 0; color: #7d6b61; font-size: 11px; line-height: 1.5; }
`;

const CategoryRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 15px;
`;

const CategoryButton = styled.button<{ $active: boolean }>`
  min-height: 33px;
  border: 1px solid ${({ $active }) => $active ? "#e3754c" : "#decfc7"};
  padding: 0 10px;
  background: ${({ $active }) => $active ? "#fff0eb" : "#fffdfb"};
  color: ${({ $active }) => $active ? "#ad4427" : "#6c544a"};
  font: inherit;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
`;

const QuietButton = styled.button`
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #d9c9c1;
  padding: 8px 10px;
  background: #fffdfb;
  color: #59382a;
  font: inherit;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;
  &:hover:not(:disabled) { background: #fff4ef; }
  &:disabled { cursor: wait; opacity: .55; }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  margin-top: 16px;
`;

const Manifest = styled.section`
  margin-top: 20px;
  border: 1px solid #e3d7d1;
  background: #fff;
`;

const ManifestHeader = styled.header`
  padding: 18px 20px;
  border-bottom: 1px solid #eadfd9;
  h2 { margin: 5px 0 0; color: #382219; font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 500; letter-spacing: -.05em; }
  p { margin: 7px 0 0; color: #7d6b61; font-size: 11px; line-height: 1.5; }
`;

const ItemRow = styled.article`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) minmax(260px, .7fr);
  gap: 14px;
  align-items: center;
  border-bottom: 1px solid #efe7e3;
  padding: 14px 20px;
  &:last-child { border-bottom: 0; }
  @media (max-width: 780px) { grid-template-columns: 32px minmax(0, 1fr); }
`;

const ItemNumber = styled.span`
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid #dfd0c8;
  border-radius: 50%;
  color: #a94a2c;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  font-weight: 800;
`;

const ItemCopy = styled.div`
  min-width: 0;
  strong, small { display: block; }
  strong { color: #4a2e22; font-size: 12px; }
  small { display: -webkit-box; overflow: hidden; margin-top: 4px; color: #806e65; font-size: 10px; line-height: 1.42; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
`;

const Asset = styled.div`
  display: flex;
  justify-content: flex-end;
  audio, video { width: min(100%, 300px); max-height: 74px; }
  @media (max-width: 780px) { grid-column: 2; justify-content: flex-start; }
`;

const AttemptSection = styled.section`
  margin-top: 20px;
  border: 1px solid #e3d7d1;
  padding: 19px;
  background: #fff;
  h2 { margin: 5px 0 0; color: #382219; font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 500; letter-spacing: -.05em; }
`;

const Attempt = styled.article`
  padding: 16px 0;
  border-top: 1px solid #eadfd9;
  h3 { margin: 0; color: #4a2e22; font-size: 13px; font-weight: 850; }
  > p { margin: 5px 0 0; color: #806e65; font-size: 11px; }
`;

const Response = styled.div`
  margin-top: 12px;
  border-top: 1px solid #f0e6e1;
  padding-top: 12px;
  strong { color: #543528; font-size: 11px; }
  p { margin: 6px 0 0; color: #715c52; font-size: 11px; line-height: 1.5; }
  audio { display: block; width: min(440px, 100%); margin-top: 8px; }
`;

const Rubrics = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
`;

const Rubric = styled.span`
  border: 1px solid #e4d4cc;
  padding: 4px 6px;
  background: #fffaf7;
  color: #664438;
  font-size: 9px;
  line-height: 1.35;
`;

function itemReady(item: ExamItem) {
  return item.module === "listen_repeat"
    ? item.audio_status === "ready" && Boolean(item.audio_url)
    : item.video_status === "ready" && Boolean(item.video_url);
}

export default function ExamInspectionClient({ examSetId }: { examSetId: string }) {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [examSet, setExamSet] = useState<ExamSetDetail | null>(null);
  const [deploymentCategories, setDeploymentCategories] = useState<SpeakingTestCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadExamSet(examSetId);
      setExamSet(next);
      setDeploymentCategories(next.deployment_categories ?? []);
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : t.examCenter.workspaceLoadFailed });
    }
  }, [examSetId, t.examCenter.workspaceLoadFailed]);

  useEffect(() => {
    if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/");
  }, [accountStatus, currentUser, isLoading, router]);

  useEffect(() => {
    if (currentUser && accountStatus === "admin") void refresh();
  }, [accountStatus, currentUser, refresh]);

  const checks = useMemo(() => {
    const ready = examSet?.items.filter(itemReady).length ?? 0;
    return { ready, total: examSet?.items.length ?? 0 };
  }, [examSet]);

  async function act(action: string, input: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      await postExamAction(action, input);
      await refresh();
      setNotice({ text: success });
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : t.examCenter.workspaceUpdateFailed });
    } finally {
      setBusy(false);
    }
  }

  const toggleCategory = (category: SpeakingTestCategory) => setDeploymentCategories((current) => current.includes(category) ? current.filter((value) => value !== category) : [...current, category]);

  if (isLoading || !examSet) return <ExamPage><ExamPipelineTopbar current="inspection" actionHref="/admin/test-center" actionLabel={t.examCenter.backToTestCenter} /><ExamContent><Loading>{notice?.text || t.examCenter.loadingInspection}</Loading></ExamContent></ExamPage>;

  const isMediaComplete = checks.total === 11 && checks.ready === 11;
  return <ExamPage>
    <ExamPipelineTopbar current="inspection" actionHref="/admin/test-center" actionLabel={t.examCenter.backToTestCenter} />
    <ExamContent>
      <Heading>
        <div><PipelineEyebrow>{t.examCenter.testOperations}</PipelineEyebrow><PipelineTitle>{examSet.title}<PipelinePeriod>.</PipelinePeriod></PipelineTitle><PipelineLead>{t.examCenter.productionManifestLead}</PipelineLead></div>
        <HeaderActions>{examSet.status === "published" && <Button as={Link} href={`/admin/test-center/exams/${examSetId}/preview`}><PlayIcon />{t.examCenter.runExam}</Button>}<Button as={Link} href="/admin/test-center" $tone="cream"><ArrowLeftIcon />{t.examCenter.backToTestCenter}</Button></HeaderActions>
      </Heading>
      {notice && <Notice $error={notice.error}>{notice.text}</Notice>}

      <OverviewGrid>
        <Card><PipelineEyebrow>{t.examCenter.productionManifest}</PipelineEyebrow><h2>{isMediaComplete ? t.examCenter.mediaReady : t.examCenter.mediaNeedsAttentionLabel}</h2><Facts><div><dt>{t.examCenter.readiness}</dt><dd>{checks.ready}/{checks.total}</dd></div><div><dt>{t.examCenter.learnerAttempts}</dt><dd>{examSet.attempt_count ?? 0}</dd></div><div><dt>{t.examCenter.averageScore}</dt><dd>{examSet.average_score ?? "—"}</dd></div></Facts></Card>
        <Card><PipelineEyebrow>{t.examCenter.interviewer}</PipelineEyebrow><Interviewer><ExamAvatar interviewer={examSet.interviewer} large /><div><h3>{examSet.interviewer.name}</h3><p>{examSet.interviewer.occupation} · {examSet.interviewer.voice_tone}</p></div></Interviewer></Card>
      </OverviewGrid>

      <DeploymentPanel
        examSet={examSet}
        categories={deploymentCategories}
        isMediaComplete={isMediaComplete}
        busy={busy}
        onToggleCategory={toggleCategory}
        onStage={() => void act("set-deployment", { examSetId, isDeployed: examSet.is_deployed, categories: deploymentCategories }, examSet.is_deployed ? t.examCenter.categoriesUpdated : t.examCenter.stageSaved)}
        onDeploy={(isDeployed) => void act("set-deployment", { examSetId, isDeployed, categories: deploymentCategories }, isDeployed ? t.examCenter.deploymentLive : t.examCenter.deploymentWithdrawn)}
        onUnpublish={() => void act("set-published", { examSetId, published: false }, t.examCenter.stageSaved)}
        onPublishAndDeploy={() => void act("publish-and-deploy", { examSetId, categories: deploymentCategories }, t.examCenter.deploymentLive)}
      />

      <Manifest><ManifestHeader><PipelineEyebrow>{t.examCenter.testAssets}</PipelineEyebrow><h2>{checks.ready}/{checks.total} {t.examCenter.approvedAssets}<PipelinePeriod>.</PipelinePeriod></h2><p>{t.examCenter.desktopAssetReviewLead}</p></ManifestHeader>{examSet.items.map((item) => <ItemRow key={item.id}><ItemNumber>{item.position}</ItemNumber><ItemCopy><strong>{item.module === "listen_repeat" ? t.examCenter.listenRepeat : t.examCenter.takeInterview} · {item.label}</strong><small>{item.prompt}</small></ItemCopy><Asset>{item.module === "listen_repeat" ? item.audio_url ? <audio controls preload="metadata" src={item.audio_url} aria-label={item.label} /> : <Notice $error>{t.examCenter.assetMissing}</Notice> : item.video_url ? <video controls playsInline preload="metadata" src={item.video_url} /> : <Notice $error>{t.examCenter.assetMissing}</Notice>}</Asset></ItemRow>)}</Manifest>
      {examSet.is_deployed && <AttemptReview attempts={examSet.attempts} />}
    </ExamContent>
  </ExamPage>;
}

function DeploymentPanel({ examSet, categories, isMediaComplete, busy, onToggleCategory, onStage, onDeploy, onUnpublish, onPublishAndDeploy }: { examSet: ExamSetDetail; categories: SpeakingTestCategory[]; isMediaComplete: boolean; busy: boolean; onToggleCategory: (category: SpeakingTestCategory) => void; onStage: () => void; onDeploy: (isDeployed: boolean) => void; onUnpublish: () => void; onPublishAndDeploy: () => void }) {
  const { t } = useI18n();
  const isPublished = examSet.status === "published";
  const hasCategories = categories.length > 0;
  const visibility = examSet.is_deployed ? t.examCenter.deployed : isPublished ? t.examCenter.publishedHidden : t.examCenter.staged;
  const categoryOptions: Array<{ id: SpeakingTestCategory; label: string }> = [{ id: "topic", label: t.speakingTest.deployed.topic }, { id: "toefl", label: t.speakingTest.deployed.toefl }, { id: "free", label: t.speakingTest.deployed.free }];

  return <Deployment><DeploymentHeading><div><PipelineEyebrow>{t.examCenter.deployment}</PipelineEyebrow><h2>{visibility}</h2><p>{t.examCenter.deploymentLead}</p></div><SetStatusPill status={examSet.status} /></DeploymentHeading>{!isMediaComplete && <Notice $error>{t.examCenter.desktopAssetGate}</Notice>}<CategoryRow>{categoryOptions.map((category) => <CategoryButton key={category.id} type="button" disabled={busy} $active={categories.includes(category.id)} onClick={() => onToggleCategory(category.id)}>{category.label}</CategoryButton>)}</CategoryRow>{!hasCategories && <Notice $error>{t.examCenter.categoryRequired}</Notice>}<ActionRow><QuietButton type="button" disabled={busy || !hasCategories} onClick={onStage}>{t.examCenter.stage}</QuietButton>{!examSet.is_deployed && isPublished && <><Button type="button" $tone="orange" disabled={busy || !hasCategories} onClick={() => onDeploy(true)}><RocketLaunchIcon />{t.examCenter.deploy}</Button><QuietButton type="button" disabled={busy} onClick={onUnpublish}>{t.examCenter.unpublish}</QuietButton></>}{!examSet.is_deployed && !isPublished && isMediaComplete && <Button type="button" $tone="orange" disabled={busy || !hasCategories} onClick={onPublishAndDeploy}><CheckIcon />{t.examCenter.publishAndDeploy}</Button>}{examSet.is_deployed && <QuietButton type="button" disabled={busy} onClick={() => onDeploy(false)}>{t.examCenter.withdrawDeployment}</QuietButton>}</ActionRow></Deployment>;
}

function AttemptReview({ attempts }: { attempts: ExamSetDetail["attempts"] }) {
  const { t } = useI18n();
  return <AttemptSection><PipelineEyebrow>{t.examCenter.scoreEvidence}</PipelineEyebrow><h2>{t.examCenter.learnerAttemptReview}<PipelinePeriod>.</PipelinePeriod></h2>{!attempts.length ? <Notice>{t.examCenter.noAttempts}</Notice> : attempts.map((attempt) => <Attempt key={attempt.id}><div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}><div><h3>{attempt.memberName}</h3><p>{attempt.memberEmail || attempt.status}</p></div>{attempt.score !== null && <strong>{t.examCenter.attemptScore} {attempt.score}/55 · {attempt.band}</strong>}</div>{attempt.report && <p>{attempt.report.overall.summary}</p>}<div>{attempt.responses.map((response) => <Response key={response.id}><strong>{response.taskNumber}. {response.module === "listen_repeat" ? t.examCenter.listenRepeat : t.examCenter.takeInterview}{response.score !== null ? ` · ${response.score}/5` : ""}</strong>{response.audioUrl && <audio controls preload="metadata" src={response.audioUrl} aria-label={t.examCenter.responseAudio} />}<p><b>{t.examCenter.transcript}:</b> {response.transcript || "—"}</p>{response.rationale && <p><b>{t.examCenter.scoreRationale}:</b> {response.rationale}</p>}<Rubrics>{Object.entries(response.rubricScores).map(([dimension, value]) => <Rubric key={dimension}><b>{dimension}</b> {value.score}/5{value.evidence ? ` · ${value.evidence}` : ""}</Rubric>)}</Rubrics></Response>)}</div></Attempt>)}</AttemptSection>;
}
