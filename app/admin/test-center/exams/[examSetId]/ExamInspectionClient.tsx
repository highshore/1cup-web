"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowPathIcon, CheckIcon, PlayIcon, RocketLaunchIcon, SpeakerWaveIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../../../lib/contexts/auth_context";
import { loadExamSet, postExamAction } from "../../../../lib/features/exam/services/exam_admin_client";
import type { ExamItem, ExamNarration, ExamSetDetail } from "../../../../lib/features/exam/types";
import type { SpeakingTestCategory } from "../../../../lib/features/speaking-test/types";
import { useI18n } from "../../../../lib/i18n/I18nProvider";
import {
  Button,
  ExamAvatar,
  ExamContent,
  ExamPage,
  ExamPipelineTopbar,
  GardenScene,
  Loading,
  MediaPill,
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
  gap: 28px;
  border-bottom: 1px solid #e2d9d4;
  padding-bottom: 30px;

  @media (max-width: 760px) { align-items: flex-start; flex-direction: column; }
`;

const HeaderActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
`;

const InspectionGrid = styled.div`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 250px;
  gap: 20px;
  align-items: start;
  margin-top: 26px;

  @media (max-width: 1100px) { grid-template-columns: 280px minmax(0, 1fr); }
  @media (max-width: 840px) { grid-template-columns: 1fr; }
`;

const ItemNavigation = styled.aside`
  overflow: hidden;
  border: 1px solid #e3d7d1;
  background: #fff;

  @media (max-width: 1100px) { max-height: 680px; overflow-y: auto; }
  @media (max-width: 840px) { max-height: 430px; }
`;

const NavigationHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e7dcd6;
  strong { display: block; color: #4d3328; font-size: 11px; font-weight: 800; }
  span { display: block; margin-top: 5px; color: #88766c; font-size: 9px; line-height: 1.4; }
`;

const NavigationGroup = styled.section`
  border-bottom: 1px solid #e7dcd6;
  &:last-child { border-bottom: 0; }
`;

const NavigationGroupHeading = styled.div`
  padding: 14px 16px 9px;
  strong { display: block; color: #563a2d; font-size: 11px; font-weight: 800; }
  span { display: -webkit-box; overflow: hidden; margin-top: 4px; color: #88766c; font-size: 9px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
`;

const NavItem = styled.button<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: 23px minmax(0, 1fr);
  gap: 9px;
  width: 100%;
  border: 0;
  border-top: 1px solid #f0e9e5;
  padding: 11px 15px;
  background: ${({ $selected }) => $selected ? "#fff3ed" : "#fff"};
  color: #43291f;
  font: inherit;
  text-align: left;
  cursor: pointer;

  > span { display: grid; width: 19px; height: 19px; place-items: center; border: 1px solid ${({ $selected }) => $selected ? "#e67851" : "#ddcfc8"}; border-radius: 50%; background: ${({ $selected }) => $selected ? "#f47a4a" : "#fffdfb"}; color: ${({ $selected }) => $selected ? "#fff" : "#8d796f"}; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 8px; }
  strong, small, em { display: block; }
  strong { color: #4b3024; font-size: 10px; font-weight: 800; }
  small { display: -webkit-box; overflow: hidden; margin-top: 3px; color: #87756c; font-size: 9px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  em { margin-top: 5px; color: #b14b2b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 7px; font-style: normal; letter-spacing: .04em; text-transform: uppercase; }
  &:hover { background: #fff8f4; }
`;

const Editor = styled.section`
  min-height: 510px;
  border: 1px solid #e3d7d1;
  padding: clamp(18px, 3vw, 25px);
  background: #fff;
`;

const EditorHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #eae1dc;
  padding-bottom: 18px;

  h2 { margin: 7px 0 0; color: #342018; font-family: Georgia, "Times New Roman", serif; font-size: clamp(28px, 3vw, 36px); font-weight: 500; letter-spacing: -.055em; line-height: .98; }
`;

const EditorMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
`;

const ModuleChip = styled.span`
  border: 1px solid #edd3c8;
  padding: 4px 6px;
  background: #fff5f0;
  color: #a84528;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .05em;
  text-transform: uppercase;
`;

const SourceLabel = styled.label`
  display: grid;
  gap: 8px;
  margin-top: 23px;
  color: #583a2d;
  font-size: 11px;
  font-weight: 800;
`;

const SourceText = styled.textarea`
  width: 100%;
  min-height: 112px;
  resize: vertical;
  border: 1px solid #dccdc5;
  padding: 11px;
  background: #fffdfb;
  color: #4a2e22;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
`;

const EditorActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
`;

const Helper = styled.small`
  color: #846f64;
  font-size: 10px;
  line-height: 1.45;
`;

const MediaStage = styled.section`
  display: grid;
  gap: 12px;
  margin-top: 22px;
  border: 1px solid #eadbd4;
  padding: 14px;
  background: #fffaf7;
`;

const MediaStageHeading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  p { margin: 0; color: #7b665c; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
`;

const AudioPlayer = styled.audio`
  display: block;
  width: 100%;
`;

const InterviewerStage = styled.div`
  overflow: hidden;
  background: #3b231a;
  video { display: block; width: 100%; max-height: 340px; background: #3b231a; object-fit: contain; }
  > div { width: min(100%, 540px); margin: 0 auto; }
`;

const InterviewerCard = styled.aside`
  border: 1px solid #e3d7d1;
  padding: 15px;
  background: #fff;

  @media (max-width: 1100px) { grid-column: 1 / -1; display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 16px; align-items: start; }
  @media (max-width: 840px) { grid-column: auto; grid-template-columns: 1fr; }
`;

const InterviewerPortrait = styled.div`
  margin-top: 12px;
  border: 1px solid #eadeD8;
  > div { width: 100%; }
  @media (max-width: 1100px) { grid-row: span 3; margin-top: 0; }
`;

const InterviewerName = styled.h2`
  margin: 14px 0 0;
  color: #352019;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -.045em;
  @media (max-width: 1100px) { margin-top: 2px; }
`;

const InterviewerMeta = styled.p`
  margin: 5px 0 0;
  color: #806e65;
  font-size: 11px;
  line-height: 1.45;
`;

const Readiness = styled.div`
  display: grid;
  gap: 8px;
  margin-top: 16px;
  border-top: 1px solid #eadfd9;
  padding-top: 13px;
  strong { color: #4c2f22; font-size: 11px; }
  @media (max-width: 1100px) { margin-top: 0; }
`;

const Deployment = styled.section`
  margin-top: 22px;
  border: 1px solid #e3d7d1;
  padding: 18px;
  background: #fff;
`;

const DeploymentHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  h2 { margin: 5px 0 0; color: #382219; font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 500; letter-spacing: -.05em; }
  p { max-width: 600px; margin: 7px 0 0; color: #7d6b61; font-size: 11px; line-height: 1.5; }
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
  svg { width: 14px; height: 14px; }
`;

const AttemptSection = styled.section`
  margin-top: 22px;
  border: 1px solid #e3d7d1;
  padding: 18px;
  background: #fff;
  h2 { margin: 5px 0 0; color: #382219; font-family: Georgia, "Times New Roman", serif; font-size: 26px; font-weight: 500; letter-spacing: -.05em; }
`;

const Attempt = styled.article`
  padding: 15px 0;
  border-top: 1px solid #eadfd9;
  h3 { margin: 0; color: #4a2e22; font-size: 13px; font-weight: 800; }
  > p { margin: 4px 0 0; color: #806e65; font-size: 11px; }
`;

const Response = styled.div`
  padding: 11px 0;
  border-top: 1px solid #f0e6e1;
  strong { color: #543528; font-size: 11px; }
  p { margin: 6px 0 0; color: #715c52; font-size: 11px; line-height: 1.5; }
  audio { display: block; width: min(440px, 100%); margin-top: 8px; }
`;

type Selection = { kind: "narration" | "item"; id: string };

function itemReady(item: ExamItem) {
  return item.module === "listen_repeat"
    ? item.audio_status === "ready" && item.visual_status === "ready" && Boolean(item.audio_url && item.image_url)
    : item.video_status === "ready" && Boolean(item.video_url);
}

function playAudio(url: string | null) {
  if (!url) return;
  const audio = new window.Audio(url);
  void audio.play();
}

export default function ExamInspectionClient({ examSetId }: { examSetId: string }) {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [examSet, setExamSet] = useState<ExamSetDetail | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [deploymentCategories, setDeploymentCategories] = useState<SpeakingTestCategory[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadExamSet(examSetId);
      setExamSet(next);
      setDeploymentCategories(next.deployment_categories ?? []);
    } catch (cause) {
      setNotice({ error: true, text: cause instanceof Error ? cause.message : t.examCenter.workspaceLoadFailed });
    }
  }, [examSetId, t.examCenter.workspaceLoadFailed]);

  useEffect(() => { if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/"); }, [accountStatus, currentUser, isLoading, router]);
  useEffect(() => { if (currentUser && accountStatus === "admin") void refresh(); }, [accountStatus, currentUser, refresh]);

  useEffect(() => {
    if (!examSet) return;
    const available: Selection[] = [
      ...examSet.narration.map((cue) => ({ kind: "narration" as const, id: cue.id })),
      ...examSet.items.map((item) => ({ kind: "item" as const, id: item.id })),
    ];
    if (!selection || !available.some((item) => item.kind === selection.kind && item.id === selection.id)) setSelection(available[0] ?? null);
  }, [examSet, selection]);

  useEffect(() => {
    if (!examSet) return;
    const itemIds = examSet.items.filter((item) => item.module === "interview" && item.video_status === "generating").map((item) => item.id);
    const interviewerId = examSet.interviewer.video_status === "generating" ? examSet.interviewer.id : null;
    if (!itemIds.length && !interviewerId) return;
    let active = true;
    const poll = async () => {
      await Promise.all([
        ...itemIds.map((itemId) => postExamAction("poll-item-video", { itemId }).catch(() => undefined)),
        ...(interviewerId ? [postExamAction("poll-interviewer-video", { interviewerId }).catch(() => undefined)] : []),
      ]);
      if (active) await refresh();
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 8_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [examSet, refresh]);

  const checks = useMemo(() => {
    const narrationReady = examSet?.narration.filter((cue) => cue.media_status === "ready" && cue.audio_url).length ?? 0;
    const itemReadyCount = examSet?.items.filter(itemReady).length ?? 0;
    const total = (examSet?.narration.length ?? 0) + (examSet?.items.length ?? 0);
    return { narrationReady, itemReadyCount, total, ready: narrationReady + itemReadyCount };
  }, [examSet]);

  async function act(action: string, input: Record<string, unknown>, success: string) {
    setBusy(`${action}:${JSON.stringify(input)}`);
    setNotice(null);
    try {
      await postExamAction(action, input);
      await refresh();
      setNotice({ text: success });
    } catch (cause) {
      setNotice({ error: true, text: cause instanceof Error ? cause.message : t.examCenter.workspaceUpdateFailed });
    } finally {
      setBusy("");
    }
  }

  const toggleCategory = (category: SpeakingTestCategory) => setDeploymentCategories((current) => current.includes(category) ? current.filter((value) => value !== category) : [...current, category]);

  if (isLoading || !examSet) return <ExamPage><ExamPipelineTopbar current="inspection" actionHref="/admin/test-center/exams" actionLabel={t.examCenter.newTestSet} /><ExamContent><Loading>{notice?.text || t.examCenter.loadingInspection}</Loading></ExamContent></ExamPage>;

  const listenItems = examSet.items.filter((item) => item.module === "listen_repeat");
  const interviewItems = examSet.items.filter((item) => item.module === "interview");
  const selectedNarration = selection?.kind === "narration" ? examSet.narration.find((cue) => cue.id === selection.id) ?? null : null;
  const selectedItem = selection?.kind === "item" ? examSet.items.find((item) => item.id === selection.id) ?? null : null;
  const isComplete = checks.ready === checks.total && checks.total === 16;

  return <ExamPage>
    <ExamPipelineTopbar current="inspection" actionHref="/admin/test-center/exams" actionLabel={t.examCenter.newTestSet} />
    <ExamContent>
      <Heading>
        <div><PipelineEyebrow>{t.examCenter.stepTwoOfTwo} <span aria-hidden="true">/</span> {t.examCenter.itemInspection}</PipelineEyebrow><PipelineTitle>{examSet.title}<PipelinePeriod>.</PipelinePeriod></PipelineTitle><PipelineLead>{t.examCenter.elevenResponseSummary} {examSet.interviewer.name}</PipelineLead></div>
        <HeaderActions>{examSet.status === "published" && <Button as={Link} href={`/admin/test-center/exams/${examSetId}/preview`}><RocketLaunchIcon />{t.examCenter.runPreview}</Button>}<Button as={Link} href="/admin/test-center/exams" $tone="cream"><ArrowLeftIcon />{t.examCenter.testBuilder}</Button></HeaderActions>
      </Heading>
      {notice && <Notice $error={notice.error}>{notice.text}</Notice>}

      <InspectionGrid>
        <ItemNavigation><NavigationHeader><strong>{t.examCenter.defaultSection}</strong><span>{t.examCenter.defaultSectionLead}</span></NavigationHeader><NavigationGroup><NavigationGroupHeading><strong>{t.examCenter.sharedNarration}</strong><span>{checks.narrationReady}/5 {t.examCenter.mediaReady}</span></NavigationGroupHeading>{examSet.narration.map((cue) => <NavigationItem key={cue.id} number={cue.source === "fixed" ? "D" : "S"} label={cue.label} copy={cue.script} status={cue.media_status} selected={selection?.kind === "narration" && selection.id === cue.id} onClick={() => setSelection({ kind: "narration", id: cue.id })} />)}</NavigationGroup><NavigationGroup><NavigationGroupHeading><strong>{t.examCenter.listenRepeat}</strong><span>{examSet.listen_repeat_theme}</span></NavigationGroupHeading>{listenItems.map((item) => <NavigationItem key={item.id} number={item.position} label={item.label} copy={item.prompt} status={itemReady(item) ? "ready" : item.audio_status} selected={selection?.kind === "item" && selection.id === item.id} onClick={() => setSelection({ kind: "item", id: item.id })} />)}</NavigationGroup><NavigationGroup><NavigationGroupHeading><strong>{t.examCenter.takeInterview}</strong><span>{examSet.interview_theme}</span></NavigationGroupHeading>{interviewItems.map((item) => <NavigationItem key={item.id} number={item.position} label={item.label} copy={item.prompt} status={itemReady(item) ? "ready" : item.video_status} selected={selection?.kind === "item" && selection.id === item.id} onClick={() => setSelection({ kind: "item", id: item.id })} />)}</NavigationGroup></ItemNavigation>

        <Editor>
          <EditorContent narration={selectedNarration} item={selectedItem} interviewer={examSet.interviewer} busy={Boolean(busy)} onAct={act} onRefreshVisuals={() => void act("retry-listen-repeat-visuals", { examSetId }, t.examCenter.visualGenerationStarted)} />
          <DeploymentPanel examSet={examSet} categories={deploymentCategories} isMediaComplete={isComplete} busy={Boolean(busy)} onToggleCategory={toggleCategory} onStage={() => void act("set-deployment", { examSetId, isDeployed: examSet.is_deployed, categories: deploymentCategories }, examSet.is_deployed ? t.examCenter.categoriesUpdated : t.examCenter.stageSaved)} onDeploy={(isDeployed) => void act("set-deployment", { examSetId, isDeployed, categories: deploymentCategories }, isDeployed ? t.examCenter.deploymentLive : t.examCenter.deploymentWithdrawn)} onUnpublish={() => void act("set-published", { examSetId, published: false }, t.examCenter.stageSaved)} onPublishAndDeploy={() => void act("publish-and-deploy", { examSetId, categories: deploymentCategories }, t.examCenter.deploymentLive)} onPrepare={() => void act("prepare-media", { examSetId }, t.examCenter.reviewMedia)} />
        </Editor>

        <InterviewerCard><PipelineEyebrow>{t.examCenter.assignedInterviewer}</PipelineEyebrow><InterviewerPortrait><ExamAvatar interviewer={examSet.interviewer} large /></InterviewerPortrait><InterviewerName>{examSet.interviewer.name}</InterviewerName><InterviewerMeta>{examSet.interviewer.occupation} · {examSet.interviewer.voice_tone}</InterviewerMeta><Readiness><strong>{isComplete ? t.examCenter.allChecksReady : t.examCenter.reviewInProgress}</strong><span>{checks.ready}/{checks.total} {t.examCenter.readiness}</span><MediaPill status={examSet.interviewer.video_status} /></Readiness></InterviewerCard>
      </InspectionGrid>
      {examSet.is_deployed && <AttemptReview attempts={examSet.attempts} />}
    </ExamContent>
  </ExamPage>;
}

function NavigationItem({ number, label, copy, status, selected, onClick }: { number: string | number; label: string; copy: string; status: "idle" | "generating" | "ready" | "failed"; selected: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const statusLabel = status === "ready" ? t.examCenter.mediaReadyLabel : status === "generating" ? t.examCenter.mediaGeneratingLabel : status === "failed" ? t.examCenter.mediaNeedsAttentionLabel : t.examCenter.mediaNeedsMediaLabel;
  return <NavItem type="button" $selected={selected} onClick={onClick}><span>{number}</span><div><strong>{label}</strong><small>{copy}</small><em>{statusLabel}</em></div></NavItem>;
}

function EditorContent({ narration, item, interviewer, busy, onAct, onRefreshVisuals }: { narration: ExamNarration | null; item: ExamItem | null; interviewer: ExamSetDetail["interviewer"]; busy: boolean; onAct: (action: string, input: Record<string, unknown>, success: string) => Promise<void>; onRefreshVisuals: () => void }) {
  const { t } = useI18n();
  if (!narration && !item) return <PipelineLead>{t.examCenter.loadingInspection}</PipelineLead>;

  const title = narration?.label ?? item?.label ?? "";
  const script = narration?.script ?? item?.prompt ?? "";
  const status = narration?.media_status ?? (item ? itemReady(item) ? "ready" : item.module === "listen_repeat" ? item.audio_status : item.video_status : "idle");
  const chip = narration ? narration.source === "fixed" ? t.examCenter.fixedScript : t.examCenter.scenario : item?.module === "listen_repeat" ? t.examCenter.listenRepeat : t.examCenter.takeInterview;

  return <>
    <EditorHeading><div><PipelineEyebrow>{narration ? t.examCenter.flowAudio : t.examCenter.sourceText}</PipelineEyebrow><h2>{title}</h2></div><EditorMeta><ModuleChip>{chip}</ModuleChip><MediaPill status={status} /></EditorMeta></EditorHeading>
    <SourceLabel>{t.examCenter.sourceText}<SourceText value={script} readOnly aria-readonly="true" aria-label={t.examCenter.sourceText} /></SourceLabel>
    <EditorActions>
      {narration ? <><Button type="button" $tone="cream" disabled={!narration.audio_url} onClick={() => playAudio(narration.audio_url)}><SpeakerWaveIcon />{t.examCenter.listen}</Button><Button type="button" disabled={busy || narration.media_status === "generating"} onClick={() => void onAct("retry-narration", { narrationId: narration.id }, t.examCenter.generationStarted)}><ArrowPathIcon />{t.examCenter.regenerateAudio}</Button></> : item?.module === "listen_repeat" ? <><Button type="button" $tone="cream" disabled={!item.audio_url} onClick={() => playAudio(item.audio_url)}><PlayIcon />{t.examCenter.listen}</Button><Button type="button" disabled={busy || item.audio_status === "generating"} onClick={() => void onAct("retry-item", { itemId: item.id }, t.examCenter.generationStarted)}><ArrowPathIcon />{t.examCenter.regenerateAudio}</Button><QuietButton type="button" disabled={busy || item.visual_status === "generating"} onClick={onRefreshVisuals}><ArrowPathIcon />{t.examCenter.regenerateVisuals}</QuietButton></> : item ? <><Button type="button" disabled={busy || item.video_status === "generating"} onClick={() => void onAct("retry-item", { itemId: item.id }, t.examCenter.generationStarted)}><ArrowPathIcon />{t.examCenter.regenerateVideo}</Button></> : null}
      <Helper>{narration ? t.examCenter.mediaReviewHint : item?.module === "listen_repeat" ? t.examCenter.listenRepeatReviewHint : t.examCenter.interviewReviewHint}</Helper>
    </EditorActions>
    <MediaStage><MediaStageHeading><p>{narration ? t.examCenter.flowAudio : item?.module === "listen_repeat" ? t.examCenter.listenRepeat : t.examCenter.takeInterview}</p><MediaPill status={status} /></MediaStageHeading>{narration ? narration.audio_url ? <AudioPlayer controls preload="metadata" src={narration.audio_url} /> : <Notice>{t.examCenter.mediaNeedsMediaLabel}</Notice> : item?.module === "listen_repeat" ? <><GardenScene target={item.visual_target} imageUrl={item.image_url} />{item.audio_url ? <AudioPlayer controls preload="metadata" src={item.audio_url} /> : <Notice>{t.examCenter.mediaNeedsMediaLabel}</Notice>}</> : item?.video_url ? <InterviewerStage><video controls muted playsInline preload="metadata" src={item.video_url} /></InterviewerStage> : <InterviewerStage><ExamAvatar interviewer={interviewer} large /></InterviewerStage>}</MediaStage>
  </>;
}

function DeploymentPanel({ examSet, categories, isMediaComplete, busy, onToggleCategory, onStage, onDeploy, onUnpublish, onPublishAndDeploy, onPrepare }: { examSet: ExamSetDetail; categories: SpeakingTestCategory[]; isMediaComplete: boolean; busy: boolean; onToggleCategory: (category: SpeakingTestCategory) => void; onStage: () => void; onDeploy: (isDeployed: boolean) => void; onUnpublish: () => void; onPublishAndDeploy: () => void; onPrepare: () => void }) {
  const { t } = useI18n();
  const isPublished = examSet.status === "published";
  const hasCategories = categories.length > 0;
  const visibility = examSet.is_deployed ? t.examCenter.deployed : isPublished ? t.examCenter.publishedHidden : t.examCenter.staged;
  const categoryOptions: Array<{ id: SpeakingTestCategory; label: string }> = [{ id: "topic", label: t.speakingTest.deployed.topic }, { id: "toefl", label: t.speakingTest.deployed.toefl }, { id: "free", label: t.speakingTest.deployed.free }];

  return <Deployment><DeploymentHeading><div><PipelineEyebrow>{t.examCenter.deployment}</PipelineEyebrow><h2>{visibility}</h2><p>{t.examCenter.deploymentLead}</p></div><SetStatusPill status={examSet.status} /></DeploymentHeading>{!isMediaComplete && <Notice style={{ marginTop: 15 }}>{t.examCenter.prepareMediaLead}</Notice>}<CategoryRow>{categoryOptions.map((category) => <CategoryButton key={category.id} type="button" disabled={busy} $active={categories.includes(category.id)} onClick={() => onToggleCategory(category.id)}>{category.label}</CategoryButton>)}</CategoryRow>{!hasCategories && <Notice $error>{t.examCenter.categoryRequired}</Notice>}<EditorActions>{!isMediaComplete && <Button type="button" disabled={busy} onClick={onPrepare}><ArrowPathIcon />{t.examCenter.prepareMedia}</Button>}<QuietButton type="button" disabled={busy || !hasCategories} onClick={onStage}>{t.examCenter.stage}</QuietButton>{!examSet.is_deployed && isPublished && <><Button type="button" $tone="orange" disabled={busy || !hasCategories} onClick={() => onDeploy(true)}>{t.examCenter.deploy}</Button><QuietButton type="button" disabled={busy} onClick={onUnpublish}>{t.examCenter.unpublish}</QuietButton></>}{!examSet.is_deployed && !isPublished && isMediaComplete && <Button type="button" $tone="orange" disabled={busy || !hasCategories} onClick={onPublishAndDeploy}>{t.examCenter.publishAndDeploy}</Button>}{examSet.is_deployed && <QuietButton type="button" disabled={busy} onClick={() => onDeploy(false)}>{t.examCenter.withdrawDeployment}</QuietButton>}</EditorActions></Deployment>;
}

function AttemptReview({ attempts }: { attempts: ExamSetDetail["attempts"] }) {
  const { t } = useI18n();
  return <AttemptSection><PipelineEyebrow>{t.examCenter.reviewAttempts}</PipelineEyebrow><h2>{t.examCenter.learnerAttemptReview}<PipelinePeriod>.</PipelinePeriod></h2>{!attempts.length ? <Notice>{t.examCenter.noAttempts}</Notice> : attempts.map((attempt) => <Attempt key={attempt.id}><div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}><div><h3>{attempt.memberName}</h3><p>{attempt.memberEmail || attempt.status}</p></div>{attempt.score !== null && <strong>{t.examCenter.attemptScore} {attempt.score}/55 · {attempt.band}</strong>}</div>{attempt.report && <p style={{ maxWidth: 760, margin: "10px 0 0", color: "#715c52", fontSize: 11, lineHeight: 1.5 }}>{attempt.report.overall.summary}</p>}<div style={{ marginTop: 12 }}>{attempt.responses.map((response) => <Response key={response.id}><strong>{response.taskNumber}. {response.module === "listen_repeat" ? t.examCenter.listenRepeat : t.examCenter.takeInterview}{response.score !== null ? ` · ${response.score}/5` : ""}</strong>{response.audioUrl && <audio controls preload="metadata" src={response.audioUrl} aria-label={t.examCenter.responseAudio} />}<p><b>{t.examCenter.transcript}:</b> {response.transcript || "—"}</p>{response.rationale && <p><b>{t.examCenter.scoreRationale}:</b> {response.rationale}</p>}</Response>)}</div></Attempt>)}</AttemptSection>;
}
