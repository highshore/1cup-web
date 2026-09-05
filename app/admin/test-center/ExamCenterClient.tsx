"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  FilmIcon,
  PlusIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../lib/contexts/auth_context";
import { loadExamCenter, postExamAction } from "../../lib/features/exam/services/exam_admin_client";
import type { ExamCenterOverview, ExamInterviewer, ExamInterviewerStatus } from "../../lib/features/exam/types";
import { useI18n } from "../../lib/i18n/I18nProvider";
import {
  Button,
  ExamAvatar,
  ExamContent,
  ExamPage,
  ExamPipelineTopbar,
  InterviewerStatusPill,
  Loading,
  Notice,
  PipelineEyebrow,
  PipelineLead,
  PipelinePeriod,
  PipelineTitle,
} from "./exam_ui";

const Workspace = styled.section`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 52px;

  @media (max-width: 980px) { grid-template-columns: 1fr; gap: 30px; }
`;

const Sidebar = styled.aside`
  min-height: 670px;
  border-right: 1px solid #e2d9d4;
  padding: 2px 28px 30px 0;

  @media (max-width: 980px) {
    min-height: 0;
    border-right: 0;
    border-bottom: 1px solid #e2d9d4;
    padding: 0 0 24px;
  }
`;

const PipelineSteps = styled.div`
  display: grid;
  gap: 22px;
  margin-top: 28px;
`;

const PipelineStep = styled.div<{ $active?: boolean }>`
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  color: ${({ $active }) => $active ? "#2c1810" : "#8f7d74"};

  > span {
    display: grid;
    width: 23px;
    height: 23px;
    place-items: center;
    border: 1px solid ${({ $active }) => $active ? "#e7774d" : "#ddcec7"};
    border-radius: 50%;
    background: ${({ $active }) => $active ? "#fff0eb" : "#fffdfb"};
    color: ${({ $active }) => $active ? "#bc4c28" : "#8f7d74"};
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 9px;
    font-weight: 800;
  }

  strong, small { display: block; }
  strong { font-size: 12px; font-weight: 800; }
  small { margin-top: 3px; color: #8d7d75; font-size: 10px; line-height: 1.3; }
`;

const SideCard = styled.div`
  margin-top: 42px;
  border: 1px solid #e5d9d1;
  padding: 16px;
  background: #fffaf7;

  strong { display: block; margin-top: 12px; color: #3d251b; font-size: 12px; font-weight: 800; }
  p { margin: 7px 0 0; color: #806e65; font-size: 11px; line-height: 1.52; }
`;

const SideCardIcon = styled.span`
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  background: #fff0eb;
  color: #c4532d;
  svg { width: 15px; height: 15px; }
`;

const Dashboard = styled.section`
  min-width: 0;
`;

const Heading = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 26px;
  border-bottom: 1px solid #e2d9d4;
  padding-bottom: 32px;

  @media (max-width: 680px) { align-items: flex-start; flex-direction: column; }
`;

const ReviewToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 74px;
  border-bottom: 1px solid #e2d9d4;
`;

const FilterTabs = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
`;

const FilterTab = styled.button<{ $active: boolean }>`
  flex: 0 0 auto;
  border: 0;
  border-bottom: 2px solid ${({ $active }) => $active ? "#f47a4a" : "transparent"};
  padding: 12px 9px 10px;
  background: transparent;
  color: ${({ $active }) => $active ? "#3d251b" : "#85746b"};
  font: inherit;
  font-size: 11px;
  font-weight: ${({ $active }) => $active ? 800 : 650};
  cursor: pointer;

  span {
    display: inline-grid;
    min-width: 16px;
    height: 16px;
    place-items: center;
    margin-left: 4px;
    border-radius: 99px;
    background: ${({ $active }) => $active ? "#fff0eb" : "#f2e9e5"};
    color: ${({ $active }) => $active ? "#b64725" : "#7e6d65"};
    font-size: 9px;
  }
`;

const ReviewSummary = styled.p`
  margin: 0;
  color: #806e65;
  font-size: 11px;
  white-space: nowrap;
  b { color: #4a2e22; }

  @media (max-width: 620px) { display: none; }
`;

const ProfileLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 28px;
  margin-top: 26px;

  @media (max-width: 1180px) { grid-template-columns: minmax(0, 1fr) 260px; }
  @media (max-width: 840px) { grid-template-columns: 1fr; }
`;

const ProfileGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: start;
  gap: 16px;

  @media (max-width: 1180px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

const ProfileCard = styled.button<{ $selected: boolean }>`
  overflow: hidden;
  border: 1px solid ${({ $selected }) => $selected ? "#7e4733" : "#e2d9d4"};
  border-bottom: 3px solid ${({ $selected }) => $selected ? "#f47a4a" : "#e2d9d4"};
  padding: 0;
  background: #fff;
  color: #2c1810;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;

  &:hover { transform: translateY(-2px); border-color: #b6806b; box-shadow: 0 8px 18px rgba(88, 47, 29, .09); }
  &:focus-visible { outline: 3px solid #f4b29a; outline-offset: 3px; }
`;

const ProfileVisual = styled.div`
  position: relative;
  aspect-ratio: 16 / 9.2;
  overflow: hidden;
  background: #eee3de;
`;

const CardAvatar = styled.div`
  position: absolute;
  inset: 0;
  > div { width: 100%; height: 100%; }
`;

const CardPill = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
`;

const CardCopy = styled.div`
  padding: 14px 14px 12px;
  h2 { margin: 0; color: #2d1a13; font-family: Georgia, "Times New Roman", serif; font-size: 21px; font-weight: 500; letter-spacing: -.04em; line-height: 1.05; }
  p { margin: 6px 0 0; color: #806e65; font-size: 10px; line-height: 1.45; }
`;

const CardFacts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 13px;
  span { padding: 4px 5px; background: #fbf4f0; color: #765f54; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 8px; line-height: 1; }
`;

const Detail = styled.aside`
  position: sticky;
  top: 22px;
  border: 1px solid #e1d5cf;
  padding: 17px;
  background: #fff;

  @media (max-width: 840px) { position: static; }
`;

const DetailTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Identity = styled.div`
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 11px;
  align-items: center;
  margin: 20px 0 17px;

  h2 { margin: 0; color: #2b1811; font-family: Georgia, "Times New Roman", serif; font-size: 25px; font-weight: 500; letter-spacing: -.045em; line-height: 1; }
  p { margin: 5px 0 0; color: #806e65; font-size: 11px; }
`;

const Facts = styled.dl`
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0;
  border-top: 1px solid #eadfd9;
  border-left: 1px solid #eadfd9;

  div { min-width: 0; border-right: 1px solid #eadfd9; border-bottom: 1px solid #eadfd9; padding: 10px 9px; }
  dt { color: #917f76; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 8px; letter-spacing: .06em; text-transform: uppercase; }
  dd { overflow: hidden; margin: 5px 0 0; color: #4e3024; font-size: 10px; line-height: 1.35; text-overflow: ellipsis; }
`;

const MediaPanel = styled.section`
  margin-top: 16px;
  padding: 15px;
  background: #3b231a;
  color: #fff8f4;

  h3 { margin: 5px 0 0; color: #fff8f4; font-family: Georgia, "Times New Roman", serif; font-size: 21px; font-weight: 500; letter-spacing: -.04em; line-height: 1; }
`;

const MediaLine = styled.div`
  display: grid;
  grid-template-columns: 21px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  margin-top: 16px;
  > span { display: grid; width: 20px; height: 20px; place-items: center; border-radius: 50%; background: #f47a4a; color: #fff; font-size: 11px; font-weight: 800; }
  strong { display: block; font-size: 11px; font-weight: 800; }
  p { margin: 3px 0 0; color: #e7cfc4; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 8px; line-height: 1.4; }
`;

const DarkAction = styled.button`
  display: inline-flex;
  width: 100%;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
  border: 1px solid #95786c;
  padding: 7px 9px;
  background: transparent;
  color: #fff8f4;
  font: inherit;
  font-size: 10px;
  font-weight: 750;
  cursor: pointer;

  &:hover:not(:disabled) { border-color: #f47a4a; background: #542d20; }
  &:disabled { cursor: wait; opacity: .55; }
  svg { width: 14px; height: 14px; }
`;

const DecisionRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 16px;
`;

const QuietAction = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid ${({ $danger }) => $danger ? "#e9b4a4" : "#d9c8c0"};
  padding: 8px 9px;
  background: ${({ $danger }) => $danger ? "#fff5f2" : "#fffdfb"};
  color: ${({ $danger }) => $danger ? "#a54432" : "#5a382b"};
  font: inherit;
  font-size: 11px;
  font-weight: 750;
  cursor: pointer;

  &:hover:not(:disabled) { background: ${({ $danger }) => $danger ? "#ffede8" : "#fff2ec"}; }
  &:disabled { cursor: wait; opacity: .55; }
  svg { width: 14px; height: 14px; }
`;

const DetailLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  margin-top: 12px;
  border: 1px solid #f2b29b;
  background: #fff0eb;
  color: #a5442b;
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;

  &:hover { background: #ffe4da; color: #8e3a23; text-decoration: none; }
  svg { width: 14px; height: 14px; }
`;

const Empty = styled.section`
  display: grid;
  min-height: 380px;
  place-items: center;
  border: 1px dashed #ddcdc5;
  padding: 40px;
  background: #fffaf7;
  text-align: center;

  h2 { margin: 14px 0 0; color: #3a241a; font-family: Georgia, "Times New Roman", serif; font-size: 29px; font-weight: 500; letter-spacing: -.045em; }
  p { max-width: 410px; margin: 10px 0 0; color: #7d6c63; font-size: 13px; line-height: 1.58; }
`;

const EmptyMark = styled.div`
  display: grid;
  width: 66px;
  height: 66px;
  place-items: center;
  border-radius: 50%;
  background: #fff0eb;
  color: #c6532e;
  svg { width: 29px; height: 29px; }
`;

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
      setNotice({ error: true, text: cause instanceof Error ? cause.message : t.examCenter.workspaceLoadFailed });
    }
  }, [t.examCenter.workspaceLoadFailed]);

  useEffect(() => {
    if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/");
  }, [accountStatus, currentUser, isLoading, router]);

  useEffect(() => {
    if (currentUser && accountStatus === "admin") void refresh();
  }, [accountStatus, currentUser, refresh]);

  useEffect(() => {
    const pending = workspace?.interviewers.filter((person) => person.video_status === "generating") ?? [];
    if (!pending.length) return;
    let active = true;
    const poll = async () => {
      await Promise.all(pending.map((person) => postExamAction("poll-interviewer-video", { interviewerId: person.id }).catch(() => undefined)));
      if (active) await refresh();
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 8_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [refresh, workspace?.interviewers]);

  const profiles = workspace?.interviewers ?? [];
  const visibleProfiles = useMemo(
    () => profiles.filter((person) => filter === "all" || person.status === filter),
    [filter, profiles],
  );
  const selected = visibleProfiles.find((person) => person.id === selectedId) ?? visibleProfiles[0] ?? null;
  const counts = useMemo(() => ({
    all: profiles.length,
    approved: profiles.filter((person) => person.status === "approved").length,
    pending: profiles.filter((person) => person.status === "pending").length,
    rejected: profiles.filter((person) => person.status === "rejected").length,
  }), [profiles]);
  const generatedPortraits = profiles.filter((person) => person.image_status === "ready").length;
  const generatedVideos = profiles.filter((person) => person.video_status === "ready").length;

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

  const isWorking = Boolean(busy);

  return <ExamPage>
    <ExamPipelineTopbar current="assets" actionHref="/admin/test-center/exams" actionLabel={t.examCenter.testSections} />
    <ExamContent>
      {isLoading || !workspace ? <Loading>{notice?.text || t.examCenter.loadingWorkspace}</Loading> : <Workspace>
        <Sidebar>
          <PipelineEyebrow>{t.examCenter.buildPipeline}</PipelineEyebrow>
          <PipelineSteps aria-label={t.examCenter.pipelineProgress}>
            <PipelineStep $active><span>01</span><div><strong>{t.examCenter.profiles}</strong><small>{profiles.length ? `${counts.approved} ${t.examCenter.saved}` : t.examCenter.createBatch}</small></div></PipelineStep>
            <PipelineStep $active={generatedPortraits > 0}><span>02</span><div><strong>{t.examCenter.profileShot}</strong><small>{generatedPortraits ? `${generatedPortraits} ${t.examCenter.generated}` : t.examCenter.studioFrame}</small></div></PipelineStep>
            <PipelineStep $active={generatedVideos > 0}><span>03</span><div><strong>{t.examCenter.noddingVideo}</strong><small>{generatedVideos ? `${generatedVideos} ${t.examCenter.generated}` : t.examCenter.videoInterpolation}</small></div></PipelineStep>
          </PipelineSteps>
          <SideCard><SideCardIcon><SparklesIcon /></SideCardIcon><strong>{t.examCenter.aiAssistedPipeline}</strong><p>{t.examCenter.aiAssistedPipelineLead}</p></SideCard>
        </Sidebar>

        <Dashboard>
          <Heading>
            <div>
              <PipelineEyebrow>{t.examCenter.profileReview}</PipelineEyebrow>
              <PipelineTitle>{t.examCenter.buildInterviewerRoster}<PipelinePeriod>.</PipelinePeriod></PipelineTitle>
              <PipelineLead>{t.examCenter.buildInterviewerRosterLead}</PipelineLead>
            </div>
            <Button type="button" disabled={isWorking} onClick={() => void act("create-candidates", {}, t.examCenter.candidateBatchReady)}><PlusIcon />{profiles.length ? t.examCenter.generateNewBatch : t.examCenter.generateCandidateBatch}</Button>
          </Heading>

          {notice && <Notice $error={notice.error}>{notice.text}</Notice>}

          <ReviewToolbar>
            <FilterTabs role="tablist" aria-label={t.examCenter.interviewers}>
              {([
                ["all", t.examCenter.all],
                ["pending", t.examCenter.pending],
                ["approved", t.examCenter.hired],
                ["rejected", t.examCenter.rejected],
              ] as const).map(([name, label]) => <FilterTab key={name} type="button" role="tab" aria-selected={filter === name} $active={filter === name} onClick={() => setFilter(name)}>{label}<span>{counts[name]}</span></FilterTab>)}
            </FilterTabs>
            {profiles.length > 0 && <ReviewSummary><b>{counts.approved}</b> {t.examCenter.savedOf} {profiles.length}</ReviewSummary>}
          </ReviewToolbar>

          {!profiles.length ? <Empty>
            <div><EmptyMark><SparklesIcon /></EmptyMark><h2>{t.examCenter.emptyRosterTitle}</h2><p>{t.examCenter.emptyRosterLead}</p><Button type="button" style={{ marginTop: 20 }} disabled={isWorking} onClick={() => void act("create-candidates", {}, t.examCenter.candidateBatchReady)}><PlusIcon />{t.examCenter.generateCandidateBatch}</Button></div>
          </Empty> : <ProfileLayout>
            <ProfileGrid aria-label={t.examCenter.interviewers}>
              {visibleProfiles.map((person) => <ProfileCard key={person.id} type="button" $selected={selected?.id === person.id} onClick={() => setSelectedId(person.id)}>
                <ProfileVisual><CardAvatar><ExamAvatar interviewer={person} large /></CardAvatar><CardPill><InterviewerStatusPill status={person.status} /></CardPill></ProfileVisual>
                <CardCopy><h2>{person.name}</h2><p>{person.gender} · {person.occupation} · {person.voice_tone}</p><CardFacts><span>{person.attire}</span><span>{person.personality}</span></CardFacts></CardCopy>
              </ProfileCard>)}
            </ProfileGrid>
            <ProfileDetail person={selected} busy={isWorking} onAct={act} />
          </ProfileLayout>}
        </Dashboard>
      </Workspace>}
    </ExamContent>
  </ExamPage>;
}

function ProfileDetail({
  person,
  busy,
  onAct,
}: {
  person: ExamInterviewer | null;
  busy: boolean;
  onAct: (action: string, input: Record<string, unknown>, success: string) => Promise<void>;
}) {
  const { t } = useI18n();
  if (!person) return <Detail><PipelineEyebrow>{t.examCenter.profileDetail}</PipelineEyebrow><PipelineLead>{t.examCenter.noInterviewers}</PipelineLead></Detail>;

  const generating = person.image_status === "generating" || person.video_status === "generating";
  const mediaReady = person.image_status === "ready" && person.video_status === "ready";

  return <Detail aria-live="polite">
    <DetailTop><PipelineEyebrow>{t.examCenter.profileDetail}</PipelineEyebrow><InterviewerStatusPill status={person.status} /></DetailTop>
    <Identity><ExamAvatar interviewer={person} /><div><h2>{person.name}</h2><p>{person.occupation}</p></div></Identity>
    <Facts>
      <div><dt>{t.examCenter.gender}</dt><dd>{person.gender}</dd></div>
      <div><dt>{t.examCenter.voiceTone}</dt><dd>{person.voice_tone}</dd></div>
      <div><dt>{t.examCenter.attire}</dt><dd>{person.attire}</dd></div>
      <div><dt>{t.examCenter.personality}</dt><dd>{person.personality}</dd></div>
    </Facts>
    <MediaPanel>
      <PipelineEyebrow style={{ color: "#e7cfc4" }}>{t.examCenter.assetCreation}</PipelineEyebrow>
      <h3>{t.examCenter.bringInterviewerToLife}</h3>
      <MediaLine><span>{person.image_status === "ready" ? <CheckIcon /> : "1"}</span><div><strong>{t.examCenter.profileShot}</strong><p>{t.examCenter.profileShotModel}</p></div></MediaLine>
      <MediaLine><span>{person.video_status === "ready" ? <CheckIcon /> : "2"}</span><div><strong>{t.examCenter.noddingVideo}</strong><p>{t.examCenter.noddingVideoModel}</p></div></MediaLine>
      <DarkAction type="button" disabled={busy || generating} onClick={() => void onAct("refresh-interviewer-media", { interviewerId: person.id }, t.examCenter.generationStarted)}><FilmIcon />{generating ? t.examCenter.generatingMedia : mediaReady ? t.examCenter.regenerateMedia : t.examCenter.generateMedia}</DarkAction>
    </MediaPanel>
    {person.status === "approved" ? <><DetailLink href={`/admin/test-center/exams?interviewer=${person.id}`}><ArrowRightIcon />{t.examCenter.createExam}</DetailLink><QuietAction type="button" $danger disabled={busy} style={{ width: "100%", marginTop: 8 }} onClick={() => void onAct("set-interviewer-status", { interviewerId: person.id, status: "pending" satisfies ExamInterviewerStatus }, t.examCenter.unhireInterviewer)}><XMarkIcon />{t.examCenter.unhire}</QuietAction></> : mediaReady ? <DecisionRow><QuietAction type="button" disabled={busy} onClick={() => void onAct("set-interviewer-status", { interviewerId: person.id, status: "approved" satisfies ExamInterviewerStatus }, t.examCenter.interviewerApproved)}><CheckIcon />{t.examCenter.hire}</QuietAction><QuietAction type="button" $danger disabled={busy || person.status === "rejected"} onClick={() => void onAct("set-interviewer-status", { interviewerId: person.id, status: "rejected" satisfies ExamInterviewerStatus }, t.examCenter.interviewerExcluded)}><XMarkIcon />{t.examCenter.reject}</QuietAction></DecisionRow> : <Notice style={{ marginTop: 16 }}>{t.examCenter.mediaApprovalHint}</Notice>}
  </Detail>;
}
