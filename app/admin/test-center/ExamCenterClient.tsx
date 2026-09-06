"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  CheckIcon,
  FilmIcon,
  PlusIcon,
  SparklesIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../../lib/contexts/auth_context";
import { loadExamCenter, postExamAction } from "../../lib/features/exam/services/exam_admin_client";
import type { ExamCenterOverview, ExamInterviewer, ExamInterviewerStatus } from "../../lib/features/exam/types";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { Button, Card, ExamAvatar, ExamHeader, ExamPage, Eyebrow, InterviewerStatusPill, Loading, Notice, PageLead, PageTitle, SetStatusPill } from "./exam_ui";

function HeroStat({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[10px] border border-[rgba(255,255,255,0.48)] bg-[rgba(255,255,255,0.07)] p-[13px] [&_span]:mt-[3px] [&_span]:block [&_span]:text-[11px] [&_span]:font-[750] [&_span]:text-[rgba(255,255,255,0.72)] [&_strong]:block [&_strong]:text-[24px] [&_strong]:font-black [&_strong]:tracking-[-0.05em] [&_strong]:text-white">{children}</div>;
}

function NavLink({ $active, className = "", children, ...rest }: { $active?: boolean } & ComponentProps<typeof Link>) {
  return <Link className={`inline-flex items-center gap-[7px] rounded-full border-2 border-[#050505] px-[13px] py-[9px] text-[12px] font-[850] no-underline ${$active ? "bg-[#050505] text-white" : "bg-white text-[#050505]"} [&_svg]:h-4 [&_svg]:w-4 ${className}`} {...rest}>{children}</Link>;
}

function SectionHeader({ children, ...rest }: ComponentProps<"div">) {
  return <div className="m-0 mb-[15px] flex items-end justify-between gap-[14px] max-[600px]:flex-col max-[600px]:items-start [&_h2]:m-0 [&_h2]:text-[20px] [&_h2]:font-black [&_h2]:tracking-[-0.035em] [&_p]:m-0 [&_p]:mt-1.5 [&_p]:text-[13px] [&_p]:font-[550] [&_p]:leading-[1.5] [&_p]:text-[rgba(5,5,5,.63)]" {...rest}>{children}</div>;
}

function Filter({ $active, ...rest }: { $active?: boolean } & ComponentProps<"button">) {
  return <button className={`cursor-pointer rounded-full border-[1.5px] border-[#050505] px-[9px] py-1.5 text-[11px] font-[850] text-[#050505] ${$active ? "bg-[#f47a4a]" : "bg-white"}`} {...rest} />;
}

function CandidateGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-[14px] max-[900px]:grid-cols-2 max-[580px]:grid-cols-1">{children}</div>;
}

function CandidateCard({ $selected, className = "", children, ...rest }: { $selected?: boolean } & ComponentProps<"article">) {
  return <article className={`overflow-hidden rounded-[14px] bg-white ${$selected ? "border-2 border-[#f47a4a] shadow-[5px_5px_0_#f47a4a]" : "border-2 border-[#050505] shadow-[4px_4px_0_#050505]"} ${className}`} {...rest}>{children}</article>;
}

function CompactButton(props: ComponentProps<typeof Button>) {
  return <Button sizeClassName="min-h-[35px] px-[9px] py-[7px] text-[11px] shadow-[2px_2px_0_#050505]" {...props} />;
}

type FilterName = "all" | "approved" | "pending" | "rejected";

export default function ExamCenterClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<ExamCenterOverview | null>(null);
  const [filter, setFilter] = useState<FilterName>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadExamCenter();
      setWorkspace(next);
      setSelectedId((current) => current && next.interviewers.some((person) => person.id === current) ? current : next.interviewers[0]?.id ?? null);
    } catch (cause) {
      setNotice({ error: true, text: cause instanceof Error ? cause.message : "The interviewer workspace could not be loaded." });
    }
  }, []);

  useEffect(() => {
    if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/");
  }, [accountStatus, currentUser, isLoading, router]);

  useEffect(() => { if (currentUser && accountStatus === "admin") void refresh(); }, [accountStatus, currentUser, refresh]);

  const visibleInterviewers = useMemo(
    () => (workspace?.interviewers ?? []).filter((person) => filter === "all" || person.status === filter),
    [filter, workspace?.interviewers],
  );
  const approved = workspace?.interviewers.filter((person) => person.status === "approved").length ?? 0;
  const pending = workspace?.interviewers.filter((person) => person.status === "pending").length ?? 0;
  const published = workspace?.sets.filter((set) => set.status === "published").length ?? 0;

  async function act(action: string, input: Record<string, unknown>, success: string) {
    setBusy(action + JSON.stringify(input));
    setNotice(null);
    try {
      await postExamAction(action, input);
      await refresh();
      setNotice({ text: success });
    } catch (cause) {
      setNotice({ error: true, text: cause instanceof Error ? cause.message : "The workspace could not be updated." });
    } finally {
      setBusy("");
    }
  }

  if (isLoading || !workspace) return <ExamPage><Loading>{notice?.text || t.examCenter.loadingWorkspace}</Loading></ExamPage>;

  const counts = {
    all: workspace.interviewers.length,
    approved,
    pending,
    rejected: workspace.interviewers.filter((person) => person.status === "rejected").length,
  };

  return <ExamPage>
    <ExamHeader>
      <div><Eyebrow>{t.examCenter.adminWorkflow}</Eyebrow><PageTitle>{t.examCenter.pipelineTitle}</PageTitle><PageLead>{t.examCenter.pipelineLead}</PageLead></div>
      <Button $tone="cream" disabled={busy === "create-candidates{}"} onClick={() => void act("create-candidates", {}, "A fresh candidate batch is ready for review.")}><SparklesIcon />{t.examCenter.generateCandidates}</Button>
    </ExamHeader>

    <section className="mb-7 grid grid-cols-[minmax(0,1.25fr)_minmax(250px,0.75fr)] gap-5 rounded-2xl border-2 border-[#050505] bg-[#050505] p-[clamp(20px,4vw,38px)] text-white shadow-[6px_6px_0_#f47a4a] max-[760px]:grid-cols-1">
      <div><p className="m-0 mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#f47a4a]">Web-native production flow</p><h2 className="m-0 max-w-[620px] text-[clamp(28px,4vw,44px)] font-black leading-[1.02] tracking-[-0.055em] text-white">From interviewer review to a timed 11-response exam.</h2><p className="m-0 mt-[13px] max-w-[630px] text-[14px] leading-[1.6] text-[rgba(255,255,255,0.76)]">The desktop prototype’s local candidate approval and media checks are now persistent, shareable records. Browser preview media gives every administrator a reliable review run without depending on temporary provider downloads.</p></div>
      <div className="grid grid-cols-2 content-center gap-2.5"><HeroStat><strong>{approved}</strong><span>Hired interviewers</span></HeroStat><HeroStat><strong>{pending}</strong><span>Awaiting review</span></HeroStat><HeroStat><strong>{workspace.sets.length}</strong><span>Exam sets</span></HeroStat><HeroStat><strong>{published}</strong><span>Published runs</span></HeroStat></div>
    </section>

    <nav className="mb-[26px] flex flex-wrap gap-2" aria-label="Exam workflow navigation"><NavLink $active href="/admin/test-center"><UserGroupIcon />{t.examCenter.roster}</NavLink><NavLink href="/admin/test-center/exams"><PlusIcon />{t.examCenter.setup}</NavLink></nav>

    {notice && <Notice $error={notice.error}>{notice.text}</Notice>}

    <SectionHeader>
      <div><h2>{t.examCenter.interviewerBuilding}</h2><p>Approve a consistent profile before it can be used in an exam set. Preview media is intentionally neutral and silent while the web uses browser speech for questions.</p></div>
      <div className="flex flex-wrap gap-[7px]">{(["all", "approved", "pending", "rejected"] as FilterName[]).map((name) => <Filter key={name} $active={filter === name} onClick={() => setFilter(name)}>{name === "approved" ? t.examCenter.hired : name === "all" ? t.examCenter.all : name === "pending" ? t.examCenter.pending : t.examCenter.rejected} · {counts[name]}</Filter>)}</div>
    </SectionHeader>

    <CandidateGrid>
      {visibleInterviewers.map((person) => {
        const working = Boolean(busy);
        const selected = selectedId === person.id;
        return <CandidateCard $selected={selected} key={person.id} onClick={() => setSelectedId(person.id)}>
          <div className="relative border-b-2 border-[#050505] bg-[#fff8dc] p-2.5"><ExamAvatar interviewer={person} large /></div>
          <div className="flex items-start justify-between gap-2.5 px-[13px] pb-0 pt-[13px] [&_h3]:m-0 [&_h3]:text-[16px] [&_h3]:font-black [&_h3]:tracking-[-0.035em] [&_p]:m-0 [&_p]:mt-[5px] [&_p]:text-[11px] [&_p]:font-bold [&_p]:leading-[1.45] [&_p]:text-[rgba(5,5,5,.66)]"><div><h3>{person.name}</h3><p>{person.gender} · {person.occupation} · {person.voice_tone}</p></div><InterviewerStatusPill status={person.status} /></div>
          <p className="mx-[13px] mb-0 mt-2.5 border-t border-[rgba(5,5,5,.25)] pt-[9px] text-[11px] font-[650] leading-[1.55] text-[rgba(5,5,5,.7)]">{person.personality} presence · {person.attire} · Shot and nodding-preview state: {person.image_status === "ready" && person.video_status === "ready" ? "ready" : "needs refresh"}.</p>
          <div className="flex flex-wrap gap-[7px] p-[13px] [&_a]:flex-auto [&_button]:flex-auto">
            {person.status !== "approved" && <CompactButton disabled={working} onClick={(event) => { event.stopPropagation(); void act("set-interviewer-status", { interviewerId: person.id, status: "approved" satisfies ExamInterviewerStatus }, `${person.name} is now available for exam set-up.`); }}><CheckIcon />{t.examCenter.hire}</CompactButton>}
            {person.status !== "rejected" && <CompactButton $tone="cream" disabled={working} onClick={(event) => { event.stopPropagation(); void act("set-interviewer-status", { interviewerId: person.id, status: "rejected" satisfies ExamInterviewerStatus }, `${person.name} was moved out of the active roster.`); }}><XMarkIcon />{t.examCenter.reject}</CompactButton>}
            <CompactButton $tone="orange" disabled={working} onClick={(event) => { event.stopPropagation(); void act("refresh-interviewer-media", { interviewerId: person.id }, "The browser preview media is ready to inspect."); }}><FilmIcon />{t.examCenter.refreshPreview}</CompactButton>
            {person.status === "approved" && <CompactButton as={Link} href={`/admin/test-center/exams?interviewer=${person.id}`}><ArrowRightIcon />{t.examCenter.buildSet}</CompactButton>}
          </div>
        </CandidateCard>;
      })}
      {!visibleInterviewers.length && <article className="grid min-h-[180px] place-items-center rounded-[14px] border-2 border-[#050505] bg-[#fff8dc] p-6 text-center text-[13px] font-[750] text-[rgba(5,5,5,.68)] shadow-[4px_4px_0_#050505]">No profiles match this view. Generate a fresh review batch to begin.</article>}
    </CandidateGrid>

    <SectionHeader style={{ marginTop: 42 }}><div><h2>{t.examCenter.recentSets}</h2><p>Jump back into any saved draft or open a published timed preview.</p></div></SectionHeader>
    <CandidateGrid>
      {workspace.sets.slice(0, 3).map((set) => <Card key={set.id} style={{ padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}><div><Eyebrow>{set.interviewer?.name || "Interviewer"}</Eyebrow><h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, letterSpacing: "-0.035em" }}>{set.title}</h3><p style={{ margin: "8px 0 0", color: "rgba(5,5,5,.66)", fontSize: 12, lineHeight: 1.5 }}>{set.ready_item_count ?? 0} of {set.item_count ?? 11} item media checks ready</p></div><SetStatusPill status={set.status} /></div><div style={{ display: "flex", gap: 8, marginTop: 16 }}><CompactButton as={Link} href={`/admin/test-center/exams/${set.id}`}><ArrowRightIcon />{t.examCenter.inspect}</CompactButton>{set.status === "published" && <CompactButton as={Link} $tone="cream" href={`/admin/test-center/exams/${set.id}/preview`}>{t.examCenter.runPreview}</CompactButton>}</div></Card>)}
    </CandidateGrid>
  </ExamPage>;
}
