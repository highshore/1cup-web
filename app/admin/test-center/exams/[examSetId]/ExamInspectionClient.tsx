"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowPathIcon, CheckBadgeIcon, PlayIcon, RocketLaunchIcon, SpeakerWaveIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../../../lib/contexts/auth_context";
import { loadExamSet, postExamAction } from "../../../../lib/features/exam/services/exam_admin_client";
import type { ExamItem, ExamSetDetail } from "../../../../lib/features/exam/types";
import { useI18n } from "../../../../lib/i18n/I18nProvider";
import { Button, Card, ExamAvatar, ExamHeader, ExamPage, Eyebrow, GardenScene, Loading, MediaPill, Notice, PageLead, PageTitle, SetStatusPill } from "../../exam_ui";

const Summary = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(260px, .9fr);
  gap: 16px;
  margin-bottom: 26px;
  @media (max-width: 760px) { grid-template-columns: 1fr; }
`;

const SummaryCard = styled(Card)`
  padding: 20px;
`;

const SummaryTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

const Meter = styled.div`
  height: 10px;
  overflow: hidden;
  margin-top: 18px;
  border: 1.5px solid #050505;
  background: #fff8dc;
`;

const MeterFill = styled.div<{ $value: number }>`
  width: ${({ $value }) => `${Math.max(0, Math.min(100, $value))}%`};
  height: 100%;
  background: #f47a4a;
  transition: width .2s ease;
`;

const MetricRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 13px;
`;

const Metric = styled.div`
  border-left: 3px solid #f47a4a;
  padding-left: 8px;
  strong { display: block; font-size: 17px; font-weight: 900; letter-spacing: -.04em; }
  span { color: rgba(5,5,5,.63); font-size: 10px; font-weight: 750; line-height: 1.35; }
`;

const InterviewerCard = styled(SummaryCard)`
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  background: #fff8dc;
  @media (max-width: 450px) { grid-template-columns: 1fr; }
`;

const Section = styled.section`
  margin-top: 30px;
`;

const SectionTop = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  h2 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -.04em; }
  p { max-width: 620px; margin: 6px 0 0; color: rgba(5,5,5,.64); font-size: 12px; line-height: 1.55; }
  @media (max-width: 640px) { align-items: flex-start; flex-direction: column; }
`;

const NarrationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 960px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 500px) { grid-template-columns: 1fr; }
`;

const NarrationCard = styled(Card)`
  padding: 13px;
  h3 { margin: 9px 0 0; font-size: 12px; font-weight: 900; line-height: 1.28; }
  p { min-height: 67px; margin: 8px 0 0; color: rgba(5,5,5,.64); font-size: 11px; line-height: 1.46; }
`;

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

const ItemCard = styled(Card)`
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  overflow: hidden;
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

const ItemScene = styled.div`
  border-right: 2px solid #050505;
  padding: 9px;
  background: #fff8dc;
  @media (max-width: 480px) { border-right: 0; border-bottom: 2px solid #050505; }
`;

const InterviewerVisual = styled.div`
  display: grid;
  min-height: 126px;
  place-items: center;
  border-right: 2px solid #050505;
  background: #fff8dc;
  video { display: block; width: 100%; max-height: 174px; object-fit: cover; }
  @media (max-width: 480px) { border-right: 0; border-bottom: 2px solid #050505; }
`;

const ItemBody = styled.div`
  padding: 14px;
`;

const ItemTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  strong { font-size: 12px; font-weight: 900; }
`;

const Prompt = styled.p`
  margin: 9px 0 0;
  color: #050505;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.5;
`;

const ItemMeta = styled.p`
  margin: 9px 0 0;
  color: rgba(5,5,5,.61);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.5;
`;

const ItemActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
`;

const SmallButton = styled(Button)`
  min-height: 32px;
  padding: 6px 9px;
  font-size: 10px;
  box-shadow: 2px 2px 0 #050505;
`;

function playAudio(url: string | null) {
  if (!url) return;
  const audio = new Audio(url);
  void audio.play();
}

function itemReady(item: ExamItem) {
  return item.module === "listen_repeat"
    ? item.audio_status === "ready" && item.visual_status === "ready" && Boolean(item.audio_url && item.image_url)
    : item.video_status === "ready" && Boolean(item.video_url);
}

export default function ExamInspectionClient({ examSetId }: { examSetId: string }) {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [examSet, setExamSet] = useState<ExamSetDetail | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try { setExamSet(await loadExamSet(examSetId)); } catch (cause) { setNotice({ error: true, text: cause instanceof Error ? cause.message : "Could not load this exam." }); }
  }, [examSetId]);
  useEffect(() => { if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/"); }, [accountStatus, currentUser, isLoading, router]);
  useEffect(() => { if (currentUser && accountStatus === "admin") void refresh(); }, [accountStatus, currentUser, refresh]);

  const checks = useMemo(() => {
    const narrationReady = examSet?.narration.filter((cue) => cue.media_status === "ready").length ?? 0;
    const itemReadyCount = examSet?.items.filter(itemReady).length ?? 0;
    const total = (examSet?.narration.length ?? 0) + (examSet?.items.length ?? 0);
    return { narrationReady, itemReadyCount, total, ready: narrationReady + itemReadyCount };
  }, [examSet]);

  async function act(action: string, input: Record<string, unknown>, success: string) {
    setBusy(action + JSON.stringify(input)); setNotice(null);
    try { await postExamAction(action, input); await refresh(); setNotice({ text: success }); }
    catch (cause) { setNotice({ error: true, text: cause instanceof Error ? cause.message : "The exam could not be updated." }); }
    finally { setBusy(""); }
  }

  if (isLoading || !examSet) return <ExamPage><Loading>{notice?.text || t.examCenter.loadingInspection}</Loading></ExamPage>;
  const listenItems = examSet.items.filter((item) => item.module === "listen_repeat");
  const interviewItems = examSet.items.filter((item) => item.module === "interview");
  const isComplete = checks.ready === checks.total && checks.total === 16;

  return <ExamPage>
    <ExamHeader><div><Eyebrow>{t.examCenter.adminInspection}</Eyebrow><PageTitle>{examSet.title}</PageTitle><PageLead>{examSet.listen_repeat_theme} · {examSet.interview_theme}</PageLead></div><Button as={Link} href="/admin/test-center/exams" $tone="cream"><ArrowLeftIcon />{t.examCenter.setup}</Button></ExamHeader>
    {notice && <Notice $error={notice.error}>{notice.text}</Notice>}
    <Summary>
      <SummaryCard><SummaryTop><div><Eyebrow>{t.examCenter.readinessGate}</Eyebrow><h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, letterSpacing: "-.04em" }}>{isComplete ? t.examCenter.allChecksReady : t.examCenter.reviewInProgress}</h2></div><SetStatusPill status={examSet.status} /></SummaryTop><p style={{ margin: "10px 0 0", color: "rgba(5,5,5,.66)", fontSize: 12, lineHeight: 1.55 }}>This inspection is backed by the desktop pipeline’s saved narration, sentence audio, segmentation masks, illustration, and interviewer media—not browser-generated stand-ins.</p><Meter><MeterFill $value={checks.total ? (checks.ready / checks.total) * 100 : 0} /></Meter><MetricRow><Metric><strong>{checks.narrationReady}/5</strong><span>Narration cues</span></Metric><Metric><strong>{checks.itemReadyCount}/11</strong><span>Prompt items</span></Metric><Metric><strong>{checks.ready}/16</strong><span>Total checks</span></Metric></MetricRow><ItemActions>{!isComplete && <Button disabled={Boolean(busy)} onClick={() => void act("prepare-media", { examSetId }, "Available imported media was checked.")}><ArrowPathIcon />{t.examCenter.prepareMedia}</Button>}{isComplete && <Button $tone="orange" disabled={Boolean(busy)} onClick={() => void act("set-published", { examSetId, published: examSet.status !== "published" }, examSet.status === "published" ? "The exam is back in media-ready review." : "The exam is published and ready to run.")}><CheckBadgeIcon />{examSet.status === "published" ? t.examCenter.unpublish : t.examCenter.publishExam}</Button>}{examSet.status === "published" && <Button as={Link} href={`/admin/test-center/exams/${examSetId}/preview`} $tone="cream"><RocketLaunchIcon />{t.examCenter.runExam}</Button>}</ItemActions></SummaryCard>
      <InterviewerCard><ExamAvatar interviewer={examSet.interviewer} large /><div><Eyebrow>Selected interviewer</Eyebrow><h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.04em" }}>{examSet.interviewer.name}</h2><p style={{ margin: "7px 0 12px", color: "rgba(5,5,5,.65)", fontSize: 12, lineHeight: 1.5 }}>{examSet.interviewer.occupation} · {examSet.interviewer.personality} · {examSet.interviewer.voice_tone} voice</p><MediaPill status={examSet.interviewer.video_status} label="Imported listening preview ready" /></div></InterviewerCard>
    </Summary>

    <Section><SectionTop><div><h2>{t.examCenter.sharedNarration}</h2><p>These fixed and authored cues bridge the two task types in a continuous exam run. Listen to the original saved track for each cue.</p></div></SectionTop><NarrationGrid>{examSet.narration.map((cue) => <NarrationCard key={cue.id}><MediaPill status={cue.media_status} /><h3>{cue.label}</h3><p>{cue.script}</p><SmallButton $tone="cream" disabled={!cue.audio_url} onClick={() => playAudio(cue.audio_url)}><SpeakerWaveIcon />{t.examCenter.listen}</SmallButton></NarrationCard>)}</NarrationGrid></Section>

    <Section><SectionTop><div><h2>{t.examCenter.listenRepeat} · 7 items</h2><p>The garden scene stays consistent while the target label changes for each sentence, preserving the desktop pipeline’s visual grounding.</p></div></SectionTop><ItemGrid>{listenItems.map((item) => <InspectionItem item={item} examSetId={examSetId} busy={Boolean(busy)} onRetry={() => void act("retry-item", { itemId: item.id }, `${item.label} preview media was refreshed.`)} />)}</ItemGrid></Section>
    <Section><SectionTop><div><h2>{t.examCenter.takeInterview} · 4 items</h2><p>The selected interviewer asks each question once, then switches to a silent listening state during the response window.</p></div></SectionTop><ItemGrid>{interviewItems.map((item) => <InspectionItem item={item} interviewer={examSet.interviewer} examSetId={examSetId} busy={Boolean(busy)} onRetry={() => void act("retry-item", { itemId: item.id }, `${item.label} preview media was refreshed.`)} />)}</ItemGrid></Section>
  </ExamPage>;
}

function InspectionItem({ item, interviewer, busy, onRetry }: { item: ExamItem; interviewer?: ExamSetDetail["interviewer"]; examSetId: string; busy: boolean; onRetry: () => void }) {
  return <ItemCard key={item.id}>{item.module === "listen_repeat" ? <ItemScene><GardenScene target={item.visual_target} imageUrl={item.image_url} /></ItemScene> : <InterviewerVisual>{item.video_url ? <video controls muted playsInline preload="metadata" src={item.video_url} /> : interviewer && <ExamAvatar interviewer={interviewer} />}</InterviewerVisual>}<ItemBody><ItemTop><strong>{item.label} · {item.response_seconds}s response</strong><MediaPill status={itemReady(item) ? "ready" : "idle"} /></ItemTop><Prompt>{item.prompt}</Prompt><ItemMeta>{item.module === "listen_repeat" ? `Visual target: ${item.visual_target}. The original sentence audio plays once before recording begins.` : "The imported interviewer prompt plays once; the interviewer remains on screen during the response."}</ItemMeta><ItemActions>{item.module === "listen_repeat" ? <SmallButton $tone="cream" disabled={!item.audio_url} onClick={() => playAudio(item.audio_url)}><PlayIcon />Listen</SmallButton> : item.video_url ? <SmallButton $tone="cream" onClick={() => { const media = document.querySelector<HTMLVideoElement>(`video[src="${item.video_url}"]`); void media?.play(); }}><PlayIcon />Preview</SmallButton> : null}<SmallButton disabled={busy} onClick={onRetry}><ArrowPathIcon />Refresh</SmallButton></ItemActions></ItemBody></ItemCard>;
}
