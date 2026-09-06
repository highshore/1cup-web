"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentProps, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../../../lib/contexts/auth_context";
import { loadExamCenter, postExamAction } from "../../../lib/features/exam/services/exam_admin_client";
import type { ExamCenterOverview, ExamInterviewer } from "../../../lib/features/exam/types";
import { useI18n } from "../../../lib/i18n/I18nProvider";
import { Button, Card, ExamAvatar, ExamHeader, ExamPage, Eyebrow, Loading, Notice, PageLead, PageTitle } from "../exam_ui";

function Step({ $active, $complete, children, ...rest }: { $active: boolean; $complete: boolean } & ComponentProps<"li">) {
  return <li className={`flex items-center gap-2 border-t-[3px] pt-[9px] text-[12px] font-[850] ${$active || $complete ? "border-[#050505]" : "border-[rgba(5,5,5,.2)]"} ${$active ? "text-[#050505]" : "text-[rgba(5,5,5,.53)]"} [&_span]:grid [&_span]:h-[22px] [&_span]:w-[22px] [&_span]:place-items-center [&_span]:rounded-full [&_span]:border-[1.5px] [&_span]:border-[#050505] [&_span]:text-[10px] ${$complete ? "[&_span]:bg-[#f47a4a]" : "[&_span]:bg-white"}`} {...rest}>{children}</li>;
}

function SetupCard({ className = "", ...rest }: ComponentProps<typeof Card>) {
  return <Card className={`p-[clamp(18px,4vw,32px)] ${className}`} {...rest} />;
}

function PersonButton({ $selected, children, ...rest }: { $selected?: boolean } & ComponentProps<"button">) {
  return <button className={`grid cursor-pointer grid-cols-[68px_minmax(0,1fr)] items-center gap-2.5 rounded-[11px] border-2 border-[#050505] p-[9px] text-left text-[#050505] ${$selected ? "bg-[#fff0b9] shadow-[3px_3px_0_#f47a4a]" : "bg-white shadow-none"} [&_span]:mt-[3px] [&_span]:block [&_span]:text-[11px] [&_span]:font-[650] [&_span]:leading-[1.42] [&_span]:text-[rgba(5,5,5,.64)] [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-black`} {...rest}>{children}</button>;
}

function Fields({ children }: { children: React.ReactNode }) {
  return <div className="mt-[21px] grid gap-4">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="grid gap-[7px] text-[12px] font-[850] text-[#050505] [&_span]:text-[11px] [&_span]:font-[650] [&_span]:text-[rgba(5,5,5,.56)]">{children}</label>;
}

const fieldClass = "w-full box-border rounded-[9px] border-2 border-[#050505] p-[11px] text-[14px] text-[#050505] outline-none focus:shadow-[3px_3px_0_#f47a4a]";

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-[23px] flex flex-wrap justify-between gap-2.5">{children}</div>;
}

export default function ExamSetupClient({ initialInterviewerId }: { initialInterviewerId: string }) {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<ExamCenterOverview | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [interviewerId, setInterviewerId] = useState(initialInterviewerId);
  const [title, setTitle] = useState("Speaking practice set");
  const [listenRepeatTheme, setListenRepeatTheme] = useState("");
  const [interviewTheme, setInterviewTheme] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try { setWorkspace(await loadExamCenter()); } catch (cause) { setNotice({ error: true, text: cause instanceof Error ? cause.message : "Could not load approved interviewers." }); }
  }, []);

  useEffect(() => { if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/"); }, [accountStatus, currentUser, isLoading, router]);
  useEffect(() => { if (currentUser && accountStatus === "admin") void refresh(); }, [accountStatus, currentUser, refresh]);

  const interviewers = useMemo(() => workspace?.interviewers.filter((person) => person.status === "approved") ?? [], [workspace?.interviewers]);
  const selected = interviewers.find((person) => person.id === interviewerId) ?? null;
  useEffect(() => { if (!interviewerId && interviewers[0]) setInterviewerId(interviewers[0].id); }, [interviewerId, interviewers]);

  function goToBriefs() {
    if (!selected || title.trim().length < 2) { setNotice({ error: true, text: "Choose a hired interviewer and enter an exam title first." }); return; }
    setNotice(null);
    setStep(2);
  }

  async function createSet(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true); setNotice(null);
    try {
      const result = await postExamAction<{ set: { id: string } }>("create-set", { title, interviewerId: selected.id, listenRepeatTheme, interviewTheme });
      router.push(`/admin/test-center/exams/${result.set.id}`);
    } catch (cause) { setNotice({ error: true, text: cause instanceof Error ? cause.message : "Could not create the exam set." }); } finally { setSubmitting(false); }
  }

  if (isLoading || !workspace) return <ExamPage><Loading>{notice?.text || t.examCenter.loadingSetup}</Loading></ExamPage>;

  return <ExamPage>
    <ExamHeader><div><Eyebrow>{t.examCenter.adminSetup}</Eyebrow><PageTitle>{t.examCenter.createTitle}</PageTitle><PageLead>{t.examCenter.createLead}</PageLead></div><Button as={Link} href="/admin/test-center" $tone="cream"><ArrowLeftIcon />{t.examCenter.roster}</Button></ExamHeader>
    <ol className="m-0 mb-6 grid list-none grid-cols-2 gap-[9px] p-0" aria-label={t.examCenter.setupProgress}><Step $active={step === 1} $complete={step === 2}><span>{step === 2 ? <CheckIcon /> : "1"}</span>{t.examCenter.chooseInterviewer}</Step><Step $active={step === 2} $complete={false}><span>2</span>{t.examCenter.shapeExam}</Step></ol>
    {notice && <Notice $error={notice.error}>{notice.text}</Notice>}
    {step === 1 ? <SetupCard>
      <Eyebrow>{t.examCenter.stepOne}</Eyebrow><h2 style={{ margin: 0, fontSize: 23, fontWeight: 900, letterSpacing: "-0.04em" }}>{t.examCenter.chooseInterviewer}</h2><p style={{ maxWidth: 610, margin: "9px 0 0", color: "rgba(5,5,5,.65)", fontSize: 13, lineHeight: 1.58 }}>Only hired profiles can anchor an exam. The browser preview keeps the chosen person visually consistent throughout item inspection and the timed run.</p>
      <Fields><Label>{t.examCenter.examTitle}<input className={fieldClass} value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} /></Label></Fields>
      <div className="mt-5 grid grid-cols-3 gap-[11px] max-[780px]:grid-cols-1">{interviewers.map((person: ExamInterviewer) => <PersonButton key={person.id} $selected={selected?.id === person.id} onClick={() => setInterviewerId(person.id)}><ExamAvatar interviewer={person} /><div><strong>{person.name}</strong><span>{person.occupation} · {person.personality} · {person.voice_tone} voice</span></div></PersonButton>)}</div>
      {!interviewers.length && <Notice $error>No hired interviewer is available yet. Return to the roster and hire a reviewed profile.</Notice>}
      <ActionRow><span /><Button disabled={!selected} onClick={goToBriefs}>{t.examCenter.continueStepTwo}<ArrowRightIcon /></Button></ActionRow>
    </SetupCard> : <SetupCard as="form" onSubmit={createSet}>
      <Eyebrow>{t.examCenter.stepTwo}</Eyebrow><h2 style={{ margin: 0, fontSize: 23, fontWeight: 900, letterSpacing: "-0.04em" }}>{t.examCenter.shapeExam}</h2><p style={{ maxWidth: 630, margin: "9px 0 0", color: "rgba(5,5,5,.65)", fontSize: 13, lineHeight: 1.58 }}>The first brief supplies the seven Listen and Repeat prompts. The second supplies four interviewer questions. You can inspect every generated draft item before publishing.</p>
      {selected && <div className="mb-[2px] mt-5 grid grid-cols-[78px_minmax(0,1fr)] items-center gap-[14px] rounded-[11px] border-[1.5px] border-[#050505] bg-[#fff8dc] p-[11px] [&_p]:m-0 [&_p]:mt-1 [&_p]:text-[11px] [&_p]:font-[650] [&_p]:leading-[1.48] [&_p]:text-[rgba(5,5,5,.64)] [&_strong]:block [&_strong]:text-[14px] [&_strong]:font-black"><ExamAvatar interviewer={selected} /><div><strong>{selected.name} will lead this exam</strong><p>{title || "Untitled exam"} · {selected.occupation} · {selected.voice_tone} voice profile</p></div></div>}
      <Fields><Label>Listen and Repeat brief<span>Use a neutral, concrete setting rather than a learner question.</span><textarea className={`${fieldClass} min-h-[104px] resize-y leading-[1.52]`} required minLength={6} value={listenRepeatTheme} onChange={(event) => setListenRepeatTheme(event.target.value)} placeholder="e.g. short updates about a community garden harvest schedule" /></Label><Label>Take an Interview brief<span>Choose a personal-experience theme for the four open answers.</span><textarea className={`${fieldClass} min-h-[104px] resize-y leading-[1.52]`} required minLength={6} value={interviewTheme} onChange={(event) => setInterviewTheme(event.target.value)} placeholder="e.g. meaningful childhood objects and a sense of home" /></Label></Fields>
      <ActionRow><Button type="button" $tone="cream" onClick={() => setStep(1)}><ArrowLeftIcon />{t.examCenter.back}</Button><Button type="submit" disabled={submitting}>{submitting ? t.examCenter.buildingDraft : t.examCenter.buildDraft}<SparklesIcon /></Button></ActionRow>
    </SetupCard>}
  </ExamPage>;
}
