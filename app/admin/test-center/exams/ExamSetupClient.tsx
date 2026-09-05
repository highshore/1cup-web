"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, CheckIcon, PlusIcon, SparklesIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../../lib/contexts/auth_context";
import { loadExamCenter, postExamAction } from "../../../lib/features/exam/services/exam_admin_client";
import type { ExamCenterOverview, ExamInterviewer, ExamSetSummary } from "../../../lib/features/exam/types";
import { useI18n } from "../../../lib/i18n/I18nProvider";
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
} from "../exam_ui";

const Heading = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  max-width: 860px;
  border-bottom: 1px solid #e2d9d4;
  padding-bottom: 32px;

  @media (max-width: 650px) { align-items: flex-start; flex-direction: column; }
`;

const ResumeCard = styled.section`
  display: grid;
  max-width: 760px;
  margin-top: 28px;
  border: 1px solid #e3d5ce;
  padding: 28px;
  background: #fffdfb;

  h2 { margin: 8px 0 0; color: #382219; font-family: Georgia, "Times New Roman", serif; font-size: clamp(28px, 3vw, 40px); font-weight: 500; letter-spacing: -.05em; line-height: 1; }
  > p { max-width: 610px; margin: 12px 0 0; color: #77665d; font-size: 13px; line-height: 1.55; }
`;

const SetList = styled.div`
  display: grid;
  margin-top: 22px;
  border-top: 1px solid #e5d9d3;
`;

const SetRow = styled.button<{ $selected: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  border: 0;
  border-bottom: 1px solid #e5d9d3;
  padding: 13px 0;
  background: transparent;
  color: #3f281e;
  font: inherit;
  text-align: left;
  cursor: pointer;

  strong, small { display: block; }
  strong { font-size: 13px; font-weight: 800; }
  small { margin-top: 4px; color: #826f65; font-size: 11px; line-height: 1.4; }
  &::before { grid-column: 1; display: none; }
  ${({ $selected }) => $selected && "background: #fff5f0; margin-inline: -10px; padding-inline: 10px;"}
`;

const ResumeActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
`;

const BuilderGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 282px;
  gap: 30px;
  max-width: 1120px;
  margin-top: 30px;

  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const FormCard = styled.form`
  border: 1px solid #e3d7d1;
  padding: clamp(19px, 3vw, 30px);
  background: #fff;
`;

const Label = styled.label`
  display: grid;
  gap: 8px;
  color: #4b3025;
  font-size: 12px;
  font-weight: 800;
`;

const Input = styled.input`
  width: 100%;
  min-height: 43px;
  border: 1px solid #d9cac2;
  padding: 10px 11px;
  background: #fffdfb;
  color: #362118;
  font: inherit;
  font-size: 14px;
  outline: none;

  &:focus { border-color: #e57950; box-shadow: 0 0 0 3px #fff0eb; }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 112px;
  resize: vertical;
  border: 1px solid #d9cac2;
  padding: 11px;
  background: #fffdfb;
  color: #362118;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  outline: none;

  &:focus { border-color: #e57950; box-shadow: 0 0 0 3px #fff0eb; }
`;

const ResponseSummary = styled.div`
  display: grid;
  gap: 3px;
  margin-top: 15px;
  border-left: 3px solid #f47a4a;
  padding: 8px 10px;
  background: #fff8f4;
  strong { color: #4b2c20; font-size: 12px; font-weight: 800; }
  span { color: #806d63; font-size: 11px; line-height: 1.42; }
`;

const ThemeHeader = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-top: 28px;
  border-top: 1px solid #eadfd9;
  padding-top: 22px;

  strong { display: block; color: #41281d; font-family: Georgia, "Times New Roman", serif; font-size: 24px; font-weight: 500; letter-spacing: -.04em; }
  p { max-width: 470px; margin: 6px 0 0; color: #7b6a61; font-size: 11px; line-height: 1.5; }
  @media (max-width: 620px) { align-items: flex-start; flex-direction: column; }
`;

const ThemeGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 18px;

  @media (max-width: 650px) { grid-template-columns: 1fr; }
`;

const FieldKicker = styled.span`
  color: #b54a29;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  letter-spacing: .08em;
  text-transform: uppercase;
`;

const GenerateRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  border-top: 1px solid #eadfd9;
  padding-top: 20px;
  small { max-width: 360px; color: #806e65; font-size: 10px; line-height: 1.5; }

  @media (max-width: 560px) { align-items: stretch; flex-direction: column; }
`;

const InterviewerCard = styled.aside`
  position: sticky;
  top: 22px;
  align-self: start;
  border: 1px solid #e3d7d1;
  padding: 15px;
  background: #fff;

  @media (max-width: 900px) { position: static; }
`;

const Portrait = styled.div`
  margin-top: 12px;
  border: 1px solid #eaded8;
  > div { width: 100%; }
`;

const InterviewerName = styled.h2`
  margin: 14px 0 0;
  color: #352019;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -.045em;
`;

const InterviewerMeta = styled.p`
  margin: 5px 0 0;
  color: #806e65;
  font-size: 11px;
  line-height: 1.45;
`;

const PickerLabel = styled.label`
  display: grid;
  gap: 7px;
  margin-top: 18px;
  color: #554036;
  font-size: 11px;
  font-weight: 800;
`;

const Picker = styled.select`
  width: 100%;
  min-height: 38px;
  border: 1px solid #d9cac2;
  padding: 8px 9px;
  background: #fffdfb;
  color: #3b241a;
  font: inherit;
  font-size: 11px;
`;

const Facts = styled.dl`
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 17px 0 0;
  border-top: 1px solid #eadfd9;
  border-left: 1px solid #eadfd9;
  div { border-right: 1px solid #eadfd9; border-bottom: 1px solid #eadfd9; padding: 9px; }
  dt { color: #8b786e; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 8px; letter-spacing: .06em; text-transform: uppercase; }
  dd { margin: 5px 0 0; color: #513429; font-size: 10px; line-height: 1.35; }
`;

const NoInterviewer = styled.div`
  margin-top: 13px;
  border: 1px dashed #dfcec5;
  padding: 18px 14px;
  background: #fffaf7;
  strong { display: block; color: #4a2c21; font-size: 12px; }
  p { margin: 7px 0 0; color: #806e65; font-size: 11px; line-height: 1.5; }
`;

export default function ExamSetupClient({ initialInterviewerId }: { initialInterviewerId: string }) {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<ExamCenterOverview | null>(null);
  const [mode, setMode] = useState<"resume" | "editing">(initialInterviewerId ? "editing" : "resume");
  const [resumeId, setResumeId] = useState("");
  const [interviewerId, setInterviewerId] = useState(initialInterviewerId);
  const [title, setTitle] = useState("");
  const [listenRepeatTheme, setListenRepeatTheme] = useState("");
  const [interviewTheme, setInterviewTheme] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try { setWorkspace(await loadExamCenter()); }
    catch (cause) { setNotice({ error: true, text: cause instanceof Error ? cause.message : t.examCenter.workspaceLoadFailed }); }
  }, [t.examCenter.workspaceLoadFailed]);

  useEffect(() => { if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/"); }, [accountStatus, currentUser, isLoading, router]);
  useEffect(() => { if (currentUser && accountStatus === "admin") void refresh(); }, [accountStatus, currentUser, refresh]);

  const interviewers = useMemo(() => workspace?.interviewers.filter((person) => person.status === "approved") ?? [], [workspace?.interviewers]);
  const selected = interviewers.find((person) => person.id === interviewerId) ?? null;
  const resumeSet = workspace?.sets.find((set) => set.id === resumeId) ?? workspace?.sets[0] ?? null;

  useEffect(() => {
    if (!interviewerId && interviewers[0]) setInterviewerId(interviewers[0].id);
  }, [interviewerId, interviewers]);

  useEffect(() => {
    if (!resumeId && workspace?.sets[0]) setResumeId(workspace.sets[0].id);
  }, [resumeId, workspace?.sets]);

  async function suggestThemes() {
    if (!selected || suggesting || submitting) return;
    setSuggesting(true);
    setNotice(null);
    try {
      const result = await postExamAction<{ themes: { listenRepeatTheme: string; interviewTheme: string } }>("suggest-set-briefs", { title, interviewerId: selected.id });
      setListenRepeatTheme(result.themes.listenRepeatTheme);
      setInterviewTheme(result.themes.interviewTheme);
      setNotice({ text: t.examCenter.briefSuggestionsApplied });
    } catch (cause) {
      setNotice({ error: true, text: cause instanceof Error ? cause.message : t.examCenter.briefSuggestionsFailed });
    } finally {
      setSuggesting(false);
    }
  }

  async function createSet(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await postExamAction<{ set: { id: string } }>("create-set", { title, interviewerId: selected.id, listenRepeatTheme, interviewTheme });
      router.push(`/admin/test-center/exams/${result.set.id}`);
    } catch (cause) {
      setNotice({ error: true, text: cause instanceof Error ? cause.message : t.examCenter.workspaceUpdateFailed });
    } finally {
      setSubmitting(false);
    }
  }

  const showResume = mode === "resume" && Boolean(workspace?.sets.length) && !initialInterviewerId;

  return <ExamPage>
    <ExamPipelineTopbar current="sets" actionHref="/admin/test-center" actionLabel={t.examCenter.roster} />
    <ExamContent>
      {isLoading || !workspace ? <Loading>{notice?.text || t.examCenter.loadingSetup}</Loading> : <>
        <Heading>
          <div><PipelineEyebrow>{t.examCenter.stepOneOfTwo}</PipelineEyebrow><PipelineTitle>{t.examCenter.setupExamSet}<PipelinePeriod>.</PipelinePeriod></PipelineTitle><PipelineLead>{t.examCenter.setupExamSetLead}</PipelineLead></div>
          {mode === "editing" && workspace.sets.length > 0 && <Button type="button" $tone="cream" onClick={() => setMode("resume")}>{t.examCenter.savedExamSets}</Button>}
        </Heading>
        {notice && <Notice $error={notice.error}>{notice.text}</Notice>}

        {showResume ? <ResumeWork set={resumeSet} sets={workspace.sets} onSelect={setResumeId} onContinue={() => resumeSet && router.push(`/admin/test-center/exams/${resumeSet.id}`)} onStart={() => setMode("editing")} /> : <BuilderGrid>
          <FormCard onSubmit={createSet}>
            <Label>{t.examCenter.examTitle}<Input required value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} /></Label>
            <ResponseSummary><strong>{t.examCenter.elevenResponses}</strong><span>{t.examCenter.responseStructure}</span></ResponseSummary>
            <ThemeHeader><div><strong>{t.examCenter.scenarioTopics}</strong><p>{t.examCenter.scenarioTopicsLead}</p></div><Button type="button" $tone="cream" disabled={!selected || suggesting || submitting} onClick={() => void suggestThemes()}><SparklesIcon />{suggesting ? t.examCenter.suggestingBriefs : t.examCenter.suggestTopics}</Button></ThemeHeader>
            <ThemeGrid>
              <Label><FieldKicker>{t.examCenter.listenRepeat}</FieldKicker>{t.examCenter.listenRepeatBrief}<Textarea required minLength={6} value={listenRepeatTheme} onChange={(event) => setListenRepeatTheme(event.target.value)} /></Label>
              <Label><FieldKicker>{t.examCenter.takeInterview}</FieldKicker>{t.examCenter.interviewBrief}<Textarea required minLength={6} value={interviewTheme} onChange={(event) => setInterviewTheme(event.target.value)} /></Label>
            </ThemeGrid>
            <GenerateRow><Button type="submit" disabled={!selected || !title.trim() || !listenRepeatTheme.trim() || !interviewTheme.trim() || suggesting || submitting}>{submitting ? t.examCenter.buildingDraft : t.examCenter.buildDraft}<ArrowRightIcon /></Button><small>{t.examCenter.draftGenerationNote}</small></GenerateRow>
          </FormCard>
          <InterviewerCard>
            <PipelineEyebrow>{t.examCenter.interviewerForSet}</PipelineEyebrow>
            {selected ? <><Portrait><ExamAvatar interviewer={selected} large /></Portrait><InterviewerName>{selected.name}</InterviewerName><InterviewerMeta>{selected.occupation} · {selected.voice_tone}</InterviewerMeta><PickerLabel>{t.examCenter.hiredInterviewer}<Picker value={interviewerId} disabled={suggesting || submitting} onChange={(event) => setInterviewerId(event.target.value)}>{interviewers.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.occupation}</option>)}</Picker></PickerLabel><Facts><div><dt>{t.examCenter.gender}</dt><dd>{selected.gender}</dd></div><div><dt>{t.examCenter.voiceTone}</dt><dd>{selected.voice_tone}</dd></div><div><dt>{t.examCenter.attire}</dt><dd>{selected.attire}</dd></div><div><dt>{t.examCenter.personality}</dt><dd>{selected.personality}</dd></div></Facts></> : <NoInterviewer><strong>{t.examCenter.noApprovedInterviewer}</strong><p>{t.examCenter.noApprovedInterviewerLead}</p><Button as={Link} href="/admin/test-center" $tone="cream" style={{ marginTop: 12 }}>{t.examCenter.roster}</Button></NoInterviewer>}
          </InterviewerCard>
        </BuilderGrid>}
      </>}
    </ExamContent>
  </ExamPage>;
}

function ResumeWork({
  set,
  sets,
  onSelect,
  onContinue,
  onStart,
}: {
  set: ExamSetSummary | null;
  sets: ExamSetSummary[];
  onSelect: (id: string) => void;
  onContinue: () => void;
  onStart: () => void;
}) {
  const { t } = useI18n();
  return <ResumeCard>
    <PipelineEyebrow>{t.examCenter.pickUpWork}</PipelineEyebrow>
    <h2>{t.examCenter.resumeOrStart}<PipelinePeriod>.</PipelinePeriod></h2>
    <p>{t.examCenter.resumeOrStartLead}</p>
    <SetList>{sets.map((examSet) => <SetRow key={examSet.id} type="button" $selected={set?.id === examSet.id} onClick={() => onSelect(examSet.id)}><div><strong>{examSet.title}</strong><small>{examSet.interviewer?.name || "—"} · {examSet.ready_item_count ?? 0}/{examSet.item_count ?? 11} {t.examCenter.mediaReady}</small></div><SetStatusPill status={examSet.status} /></SetRow>)}</SetList>
    <ResumeActions><Button type="button" disabled={!set} onClick={onContinue}>{t.examCenter.continueThisSet}</Button><Button type="button" $tone="cream" onClick={onStart}><PlusIcon />{t.examCenter.startNewExamSet}</Button></ResumeActions>
  </ResumeCard>;
}
