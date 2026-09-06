"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, CheckIcon, PlayIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";

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

const serifH2Class = "[&_h2]:mt-[5px] [&_h2]:text-[#382219] [&_h2]:[font-family:Georgia,'Times_New_Roman',serif] [&_h2]:text-[26px] [&_h2]:font-medium [&_h2]:tracking-[-.05em]";

function Heading({ children }: { children: ReactNode }) {
  return <header className="flex items-end justify-between gap-[22px] border-b border-[#e2d9d4] pb-[29px] max-[760px]:flex-col max-[760px]:items-start">{children}</header>;
}

function HeaderActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-[9px]">{children}</div>;
}

function OverviewGrid({ children }: { children: ReactNode }) {
  return <section className="mt-[25px] grid grid-cols-[minmax(0,1.3fr)_minmax(250px,.7fr)] gap-5 max-[850px]:grid-cols-1">{children}</section>;
}

function Card({ children }: { children: ReactNode }) {
  return <section className="border border-[#e3d7d1] bg-white p-[19px] [&_h2]:mt-[5px] [&_h2]:text-[#392219] [&_h2]:[font-family:Georgia,'Times_New_Roman',serif] [&_h2]:text-[26px] [&_h2]:font-medium [&_h2]:tracking-[-.05em] [&_p]:text-[#7c6a61] [&_p]:text-[11px] [&_p]:leading-[1.55]">{children}</section>;
}

function Facts({ children }: { children: ReactNode }) {
  return <dl className="mt-[18px] grid grid-cols-[repeat(3,minmax(0,1fr))] border-t border-l border-[#eadfd9] [&_div]:min-w-0 [&_div]:border-r [&_div]:border-b [&_div]:border-[#eadfd9] [&_div]:px-2.5 [&_div]:py-[11px] [&_dt]:text-[#8b786e] [&_dt]:[font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace] [&_dt]:text-[8px] [&_dt]:font-[750] [&_dt]:uppercase [&_dt]:tracking-[.06em] [&_dd]:mt-1.5 [&_dd]:overflow-hidden [&_dd]:text-ellipsis [&_dd]:whitespace-nowrap [&_dd]:text-[#513429] [&_dd]:text-[12px] [&_dd]:font-extrabold">{children}</dl>;
}

function Interviewer({ children }: { children: ReactNode }) {
  return <div className="mt-3.5 grid grid-cols-[90px_minmax(0,1fr)] items-center gap-3.5 [&_h3]:m-0 [&_h3]:text-[#442a20] [&_h3]:text-[14px] [&_p]:mt-[5px]">{children}</div>;
}

function Deployment({ children }: { children: ReactNode }) {
  return <section className="mt-5 border border-[#e3d7d1] bg-white p-[19px]">{children}</section>;
}

function DeploymentHeading({ children }: { children: ReactNode }) {
  return <div className={`flex items-start justify-between gap-3.5 ${serifH2Class} [&_p]:mt-[7px] [&_p]:max-w-[610px] [&_p]:text-[#7d6b61] [&_p]:text-[11px] [&_p]:leading-[1.5]`}>{children}</div>;
}

function CategoryRow({ children }: { children: ReactNode }) {
  return <div className="mt-[15px] flex flex-wrap gap-[7px]">{children}</div>;
}

function CategoryButton({ $active, className = "", ...rest }: { $active: boolean } & ComponentProps<"button">) {
  return <button className={`min-h-[33px] cursor-pointer border px-2.5 text-[11px] font-[750] ${$active ? "border-[#e3754c] bg-[#fff0eb] text-[#ad4427]" : "border-[#decfc7] bg-[#fffdfb] text-[#6c544a]"} ${className}`} {...rest} />;
}

function QuietButton({ className = "", ...rest }: ComponentProps<"button">) {
  return <button className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 border border-[#d9c9c1] bg-[#fffdfb] px-2.5 py-2 text-[#59382a] text-[11px] font-[750] [&:hover:not(:disabled)]:bg-[#fff4ef] disabled:cursor-wait disabled:opacity-[.55] ${className}`} {...rest} />;
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center gap-[9px]">{children}</div>;
}

function Manifest({ children }: { children: ReactNode }) {
  return <section className="mt-5 border border-[#e3d7d1] bg-white">{children}</section>;
}

function ManifestHeader({ children }: { children: ReactNode }) {
  return <header className={`border-b border-[#eadfd9] px-5 py-[18px] ${serifH2Class} [&_p]:mt-[7px] [&_p]:text-[#7d6b61] [&_p]:text-[11px] [&_p]:leading-[1.5]`}>{children}</header>;
}

function ItemRow({ children }: { children: ReactNode }) {
  return <article className="grid grid-cols-[32px_minmax(0,1fr)_minmax(260px,.7fr)] items-center gap-3.5 border-b border-[#efe7e3] px-5 py-3.5 last:border-b-0 max-[780px]:grid-cols-[32px_minmax(0,1fr)]">{children}</article>;
}

function ItemNumber({ children }: { children: ReactNode }) {
  return <span className="grid h-[26px] w-[26px] place-items-center rounded-full border border-[#dfd0c8] text-[#a94a2c] [font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace] text-[9px] font-extrabold">{children}</span>;
}

function ItemCopy({ children }: { children: ReactNode }) {
  return <div className="min-w-0 [&_strong]:block [&_strong]:text-[#4a2e22] [&_strong]:text-[12px] [&_small]:mt-1 [&_small]:line-clamp-2 [&_small]:text-[#806e65] [&_small]:text-[10px] [&_small]:leading-[1.42]">{children}</div>;
}

function Asset({ children }: { children: ReactNode }) {
  return <div className="flex justify-end [&_audio]:max-h-[74px] [&_audio]:w-[min(100%,300px)] [&_video]:max-h-[74px] [&_video]:w-[min(100%,300px)] max-[780px]:col-[2] max-[780px]:justify-start">{children}</div>;
}

function AttemptSection({ children }: { children: ReactNode }) {
  return <section className={`mt-5 border border-[#e3d7d1] bg-white p-[19px] ${serifH2Class}`}>{children}</section>;
}

function Attempt({ children }: { children: ReactNode }) {
  return <article className="border-t border-[#eadfd9] py-4 [&_h3]:m-0 [&_h3]:text-[#4a2e22] [&_h3]:text-[13px] [&_h3]:font-[850] [&>p]:mt-[5px] [&>p]:text-[#806e65] [&>p]:text-[11px]">{children}</article>;
}

function Response({ children }: { children: ReactNode }) {
  return <div className="mt-3 border-t border-[#f0e6e1] pt-3 [&_strong]:text-[#543528] [&_strong]:text-[11px] [&_p]:mt-1.5 [&_p]:text-[#715c52] [&_p]:text-[11px] [&_p]:leading-[1.5] [&_audio]:mt-2 [&_audio]:block [&_audio]:w-[min(440px,100%)]">{children}</div>;
}

function Rubrics({ children }: { children: ReactNode }) {
  return <div className="mt-[9px] flex flex-wrap gap-1.5">{children}</div>;
}

function Rubric({ children }: { children: ReactNode }) {
  return <span className="border border-[#e4d4cc] bg-[#fffaf7] px-1.5 py-1 text-[#664438] text-[9px] leading-[1.35]">{children}</span>;
}

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
