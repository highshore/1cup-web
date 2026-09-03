"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../../lib/contexts/auth_context";
import { loadExamCenter, postExamAction } from "../../../lib/features/exam/services/exam_admin_client";
import type { ExamCenterOverview, ExamInterviewer } from "../../../lib/features/exam/types";
import { useI18n } from "../../../lib/i18n/I18nProvider";
import { Button, Card, ExamAvatar, ExamHeader, ExamPage, Eyebrow, Loading, Notice, PageLead, PageTitle } from "../exam_ui";

const Steps = styled.ol`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin: 0 0 24px;
  padding: 0;
  list-style: none;
`;

const Step = styled.li<{ $active: boolean; $complete: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 3px solid ${({ $active, $complete }) => $active || $complete ? "#050505" : "rgba(5,5,5,.2)"};
  padding-top: 9px;
  color: ${({ $active }) => $active ? "#050505" : "rgba(5,5,5,.53)"};
  font-size: 12px;
  font-weight: 850;
  span { display: grid; width: 22px; height: 22px; place-items: center; border: 1.5px solid #050505; border-radius: 50%; background: ${({ $complete }) => $complete ? "#f47a4a" : "#fff"}; font-size: 10px; }
`;

const SetupCard = styled(Card)`
  padding: clamp(18px, 4vw, 32px);
`;

const Picker = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 11px;
  margin-top: 20px;
  @media (max-width: 780px) { grid-template-columns: 1fr; }
`;

const PersonButton = styled.button<{ $selected?: boolean }>`
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  border: 2px solid #050505;
  border-radius: 11px;
  padding: 9px;
  background: ${({ $selected }) => $selected ? "#fff0b9" : "#fff"};
  box-shadow: ${({ $selected }) => $selected ? "3px 3px 0 #f47a4a" : "none"};
  color: #050505;
  font: inherit;
  text-align: left;
  cursor: pointer;
  strong { display: block; font-size: 13px; font-weight: 900; }
  span { display: block; margin-top: 3px; color: rgba(5,5,5,.64); font-size: 11px; font-weight: 650; line-height: 1.42; }
`;

const Fields = styled.div`
  display: grid;
  gap: 16px;
  margin-top: 21px;
`;

const Label = styled.label`
  display: grid;
  gap: 7px;
  color: #050505;
  font-size: 12px;
  font-weight: 850;
  span { color: rgba(5,5,5,.56); font-size: 11px; font-weight: 650; }
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 2px solid #050505;
  border-radius: 9px;
  padding: 11px;
  outline: none;
  color: #050505;
  font: inherit;
  font-size: 14px;
  &:focus { box-shadow: 3px 3px 0 #f47a4a; }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 104px;
  box-sizing: border-box;
  resize: vertical;
  border: 2px solid #050505;
  border-radius: 9px;
  padding: 11px;
  outline: none;
  color: #050505;
  font: inherit;
  font-size: 14px;
  line-height: 1.52;
  &:focus { box-shadow: 3px 3px 0 #f47a4a; }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
  margin-top: 23px;
`;

const Summary = styled.div`
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  margin: 20px 0 2px;
  border: 1.5px solid #050505;
  border-radius: 11px;
  padding: 11px;
  background: #fff8dc;
  strong { display: block; font-size: 14px; font-weight: 900; }
  p { margin: 4px 0 0; color: rgba(5,5,5,.64); font-size: 11px; font-weight: 650; line-height: 1.48; }
`;

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
    <Steps aria-label={t.examCenter.setupProgress}><Step $active={step === 1} $complete={step === 2}><span>{step === 2 ? <CheckIcon /> : "1"}</span>{t.examCenter.chooseInterviewer}</Step><Step $active={step === 2} $complete={false}><span>2</span>{t.examCenter.shapeExam}</Step></Steps>
    {notice && <Notice $error={notice.error}>{notice.text}</Notice>}
    {step === 1 ? <SetupCard>
      <Eyebrow>{t.examCenter.stepOne}</Eyebrow><h2 style={{ margin: 0, fontSize: 23, fontWeight: 900, letterSpacing: "-0.04em" }}>{t.examCenter.chooseInterviewer}</h2><p style={{ maxWidth: 610, margin: "9px 0 0", color: "rgba(5,5,5,.65)", fontSize: 13, lineHeight: 1.58 }}>Only hired profiles can anchor an exam. The browser preview keeps the chosen person visually consistent throughout item inspection and the timed run.</p>
      <Fields><Label>{t.examCenter.examTitle}<Input value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} /></Label></Fields>
      <Picker>{interviewers.map((person: ExamInterviewer) => <PersonButton key={person.id} $selected={selected?.id === person.id} onClick={() => setInterviewerId(person.id)}><ExamAvatar interviewer={person} /><div><strong>{person.name}</strong><span>{person.occupation} · {person.personality} · {person.voice_tone} voice</span></div></PersonButton>)}</Picker>
      {!interviewers.length && <Notice $error>No hired interviewer is available yet. Return to the roster and hire a reviewed profile.</Notice>}
      <ActionRow><span /><Button disabled={!selected} onClick={goToBriefs}>{t.examCenter.continueStepTwo}<ArrowRightIcon /></Button></ActionRow>
    </SetupCard> : <SetupCard as="form" onSubmit={createSet}>
      <Eyebrow>{t.examCenter.stepTwo}</Eyebrow><h2 style={{ margin: 0, fontSize: 23, fontWeight: 900, letterSpacing: "-0.04em" }}>{t.examCenter.shapeExam}</h2><p style={{ maxWidth: 630, margin: "9px 0 0", color: "rgba(5,5,5,.65)", fontSize: 13, lineHeight: 1.58 }}>The first brief supplies the seven Listen and Repeat prompts. The second supplies four interviewer questions. You can inspect every generated draft item before publishing.</p>
      {selected && <Summary><ExamAvatar interviewer={selected} /><div><strong>{selected.name} will lead this exam</strong><p>{title || "Untitled exam"} · {selected.occupation} · {selected.voice_tone} voice profile</p></div></Summary>}
      <Fields><Label>Listen and Repeat brief<span>Use a neutral, concrete setting rather than a learner question.</span><Textarea required minLength={6} value={listenRepeatTheme} onChange={(event) => setListenRepeatTheme(event.target.value)} placeholder="e.g. short updates about a community garden harvest schedule" /></Label><Label>Take an Interview brief<span>Choose a personal-experience theme for the four open answers.</span><Textarea required minLength={6} value={interviewTheme} onChange={(event) => setInterviewTheme(event.target.value)} placeholder="e.g. meaningful childhood objects and a sense of home" /></Label></Fields>
      <ActionRow><Button type="button" $tone="cream" onClick={() => setStep(1)}><ArrowLeftIcon />{t.examCenter.back}</Button><Button type="submit" disabled={submitting}>{submitting ? t.examCenter.buildingDraft : t.examCenter.buildDraft}<SparklesIcon /></Button></ActionRow>
    </SetupCard>}
  </ExamPage>;
}
