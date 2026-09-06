"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowPathIcon, CheckBadgeIcon, PlayIcon, RocketLaunchIcon, SpeakerWaveIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../../../../lib/contexts/auth_context";
import { loadExamSet, postExamAction } from "../../../../lib/features/exam/services/exam_admin_client";
import type { ExamItem, ExamSetDetail } from "../../../../lib/features/exam/types";
import { useI18n } from "../../../../lib/i18n/I18nProvider";
import { Button, Card, ExamAvatar, ExamHeader, ExamPage, Eyebrow, GardenScene, Loading, MediaPill, Notice, PageLead, PageTitle, SetStatusPill } from "../../exam_ui";

function Metric({ children }: { children: React.ReactNode }) {
  return <div className="border-l-[3px] border-l-[#f47a4a] pl-2 [&_span]:text-[10px] [&_span]:font-[750] [&_span]:leading-[1.35] [&_span]:text-[rgba(5,5,5,.63)] [&_strong]:block [&_strong]:text-[17px] [&_strong]:font-black [&_strong]:tracking-[-.04em]">{children}</div>;
}

function SectionTop({ children }: { children: React.ReactNode }) {
  return <div className="mb-[14px] flex items-end justify-between gap-3 max-[640px]:flex-col max-[640px]:items-start [&_h2]:m-0 [&_h2]:text-[20px] [&_h2]:font-black [&_h2]:tracking-[-.04em] [&_p]:m-0 [&_p]:mt-1.5 [&_p]:max-w-[620px] [&_p]:text-[12px] [&_p]:leading-[1.55] [&_p]:text-[rgba(5,5,5,.64)]">{children}</div>;
}

function ItemGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">{children}</div>;
}

function ItemActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-[7px]">{children}</div>;
}

function SmallButton(props: ComponentProps<typeof Button>) {
  return <Button sizeClassName="min-h-[32px] px-[9px] py-1.5 text-[10px] shadow-[2px_2px_0_#050505]" {...props} />;
}

function speak(script: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(script);
  utterance.rate = 0.92;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

function itemReady(item: ExamItem) {
  return item.audio_status === "ready" && item.visual_status === "ready" && item.video_status === "ready";
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
    <section className="mb-[26px] grid grid-cols-[minmax(0,1.1fr)_minmax(260px,.9fr)] gap-4 max-[760px]:grid-cols-1">
      <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><Eyebrow>{t.examCenter.readinessGate}</Eyebrow><h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, letterSpacing: "-.04em" }}>{isComplete ? t.examCenter.allChecksReady : t.examCenter.reviewInProgress}</h2></div><SetStatusPill status={examSet.status} /></div><p style={{ margin: "10px 0 0", color: "rgba(5,5,5,.66)", fontSize: 12, lineHeight: 1.55 }}>The web preview replaces temporary desktop provider files with browser-native narration, illustration, and silent interviewer motion. Publish remains locked until all 16 checks are ready.</p><div className="mt-[18px] h-2.5 overflow-hidden border-[1.5px] border-[#050505] bg-[#fff8dc]"><div className="h-full bg-[#f47a4a] [transition:width_.2s_ease]" style={{ width: `${Math.max(0, Math.min(100, checks.total ? (checks.ready / checks.total) * 100 : 0))}%` }} /></div><div className="mt-[13px] grid grid-cols-3 gap-2"><Metric><strong>{checks.narrationReady}/5</strong><span>Narration cues</span></Metric><Metric><strong>{checks.itemReadyCount}/11</strong><span>Prompt items</span></Metric><Metric><strong>{checks.ready}/16</strong><span>Total checks</span></Metric></div><ItemActions><Button disabled={Boolean(busy)} onClick={() => void act("prepare-media", { examSetId }, "Browser preview media is ready for every item.")}><ArrowPathIcon />{t.examCenter.prepareMedia}</Button>{isComplete && <Button $tone="orange" disabled={Boolean(busy)} onClick={() => void act("set-published", { examSetId, published: examSet.status !== "published" }, examSet.status === "published" ? "The exam is back in media-ready review." : "The exam is published and ready to run.")}><CheckBadgeIcon />{examSet.status === "published" ? t.examCenter.unpublish : t.examCenter.publishExam}</Button>}{examSet.status === "published" && <Button as={Link} href={`/admin/test-center/exams/${examSetId}/preview`} $tone="cream"><RocketLaunchIcon />{t.examCenter.runExam}</Button>}</ItemActions></Card>
      <article className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-[14px] rounded-[14px] border-2 border-[#050505] bg-[#fff8dc] p-5 shadow-[4px_4px_0_#050505] max-[450px]:grid-cols-1"><ExamAvatar interviewer={examSet.interviewer} large /><div><Eyebrow>Selected interviewer</Eyebrow><h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.04em" }}>{examSet.interviewer.name}</h2><p style={{ margin: "7px 0 12px", color: "rgba(5,5,5,.65)", fontSize: 12, lineHeight: 1.5 }}>{examSet.interviewer.occupation} · {examSet.interviewer.personality} · {examSet.interviewer.voice_tone} voice</p><MediaPill status={examSet.interviewer.video_status} label="Silent listening preview ready" /></div></article>
    </section>

    <section className="mt-[30px]"><SectionTop><div><h2>{t.examCenter.sharedNarration}</h2><p>These fixed and authored cues bridge the two task types in a continuous exam run. Use Listen to validate browser voice output.</p></div></SectionTop><div className="grid grid-cols-5 gap-2.5 max-[960px]:grid-cols-2 max-[500px]:grid-cols-1">{examSet.narration.map((cue) => <Card key={cue.id} className="p-[13px] [&_h3]:m-0 [&_h3]:mt-[9px] [&_h3]:text-[12px] [&_h3]:font-black [&_h3]:leading-[1.28] [&_p]:m-0 [&_p]:mt-2 [&_p]:min-h-[67px] [&_p]:text-[11px] [&_p]:leading-[1.46] [&_p]:text-[rgba(5,5,5,.64)]"><MediaPill status={cue.media_status} /><h3>{cue.label}</h3><p>{cue.script}</p><SmallButton $tone="cream" onClick={() => speak(cue.script)}><SpeakerWaveIcon />{t.examCenter.listen}</SmallButton></Card>)}</div></section>

    <section className="mt-[30px]"><SectionTop><div><h2>{t.examCenter.listenRepeat} · 7 items</h2><p>The garden scene stays consistent while the target label changes for each sentence, preserving the desktop pipeline’s visual grounding.</p></div></SectionTop><ItemGrid>{listenItems.map((item) => <InspectionItem item={item} examSetId={examSetId} busy={Boolean(busy)} onRetry={() => void act("retry-item", { itemId: item.id }, `${item.label} preview media was refreshed.`)} />)}</ItemGrid></section>
    <section className="mt-[30px]"><SectionTop><div><h2>{t.examCenter.takeInterview} · 4 items</h2><p>The selected interviewer asks each question once, then switches to a silent listening state during the response window.</p></div></SectionTop><ItemGrid>{interviewItems.map((item) => <InspectionItem item={item} interviewer={examSet.interviewer} examSetId={examSetId} busy={Boolean(busy)} onRetry={() => void act("retry-item", { itemId: item.id }, `${item.label} preview media was refreshed.`)} />)}</ItemGrid></section>
  </ExamPage>;
}

function InspectionItem({ item, interviewer, busy, onRetry }: { item: ExamItem; interviewer?: ExamSetDetail["interviewer"]; examSetId: string; busy: boolean; onRetry: () => void }) {
  return <Card key={item.id} className="grid grid-cols-[150px_minmax(0,1fr)] overflow-hidden max-[480px]:grid-cols-1">{item.module === "listen_repeat" ? <div className="border-r-2 border-[#050505] bg-[#fff8dc] p-[9px] max-[480px]:border-b-2 max-[480px]:border-r-0"><GardenScene target={item.visual_target} /></div> : <div className="grid min-h-[126px] place-items-center border-r-2 border-[#050505] bg-[#fff8dc] max-[480px]:border-b-2 max-[480px]:border-r-0">{interviewer && <ExamAvatar interviewer={interviewer} />}</div>}<div className="p-[14px]"><div className="flex items-center justify-between gap-2.5 [&_strong]:text-[12px] [&_strong]:font-black"><strong>{item.label} · {item.response_seconds}s response</strong><MediaPill status={itemReady(item) ? "ready" : "idle"} /></div><p className="m-0 mt-[9px] text-[13px] font-[750] leading-[1.5] text-[#050505]">{item.prompt}</p><p className="m-0 mt-[9px] text-[10px] font-bold leading-[1.5] text-[rgba(5,5,5,.61)]">{item.module === "listen_repeat" ? `Visual target: ${item.visual_target}. The sentence plays once before recording begins.` : "Question voice is played once; the interviewer remains on screen during the response."}</p><ItemActions><SmallButton $tone="cream" onClick={() => speak(item.prompt)}><PlayIcon />Listen</SmallButton><SmallButton disabled={busy} onClick={onRetry}><ArrowPathIcon />Refresh</SmallButton></ItemActions></div></Card>;
}
