"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import styled from "styled-components";

import { useAuth } from "../../lib/contexts/auth_context";
import { loadExamCenter, postExamAction } from "../../lib/features/exam/services/exam_admin_client";
import type { ExamCenterOverview, ExamInterviewer, ExamInterviewerStatus } from "../../lib/features/exam/types";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { Button, Card, ExamAvatar, ExamPage, Eyebrow, InterviewerStatusPill, Loading, Notice, SetStatusPill } from "./exam_ui";

const WorkspaceNav = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 26px;
`;

const NavLink = styled(Link)<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 9px 13px;
  background: ${({ $active }) => $active ? "#050505" : "#fff"};
  color: ${({ $active }) => $active ? "#fff" : "#050505"};
  font-size: 12px;
  font-weight: 850;
  text-decoration: none;
  svg { width: 16px; height: 16px; }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  margin: 0 0 15px;
  h2 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.035em; }
  p { margin: 6px 0 0; color: rgba(5,5,5,.63); font-size: 13px; font-weight: 550; line-height: 1.5; }
  @media (max-width: 600px) { align-items: flex-start; flex-direction: column; }
`;

const FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;

const InterviewerControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
`;

const Filter = styled.button<{ $active?: boolean }>`
  border: 1.5px solid #050505;
  border-radius: 999px;
  padding: 6px 9px;
  background: ${({ $active }) => $active ? "#f47a4a" : "#fff"};
  color: #050505;
  font: inherit;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
`;

const CandidateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  @media (max-width: 900px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 580px) { grid-template-columns: 1fr; }
`;

const CandidateCard = styled(Card)<{ $selected?: boolean }>`
  overflow: hidden;
  border-color: ${({ $selected }) => $selected ? "#f47a4a" : "#050505"};
  box-shadow: ${({ $selected }) => $selected ? "5px 5px 0 #f47a4a" : "4px 4px 0 #050505"};
`;

const CandidateVisual = styled.div`
  position: relative;
  border-bottom: 2px solid #050505;
  padding: 10px;
  background: #fff8dc;
`;

const CandidateMeta = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 13px 0;
  h3 { margin: 0; font-size: 16px; font-weight: 900; letter-spacing: -0.035em; }
  p { margin: 5px 0 0; color: rgba(5,5,5,.66); font-size: 11px; font-weight: 700; line-height: 1.45; }
`;

const CandidateDetails = styled.p`
  margin: 10px 13px 0;
  border-top: 1px solid rgba(5,5,5,.25);
  padding-top: 9px;
  color: rgba(5,5,5,.7);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.55;
`;

const CandidateActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 13px;
  button, a { flex: 1 1 auto; }
`;

const CompactButton = styled(Button)`
  min-height: 35px;
  padding: 7px 9px;
  font-size: 11px;
  box-shadow: 2px 2px 0 #050505;
`;

const Empty = styled(Card)`
  display: grid;
  min-height: 180px;
  place-items: center;
  padding: 24px;
  background: #fff8dc;
  color: rgba(5,5,5,.68);
  font-size: 13px;
  font-weight: 750;
  text-align: center;
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
    <WorkspaceNav aria-label="Exam workflow navigation"><NavLink $active href="/admin/test-center"><UserGroupIcon />{t.examCenter.roster}</NavLink><NavLink href="/admin/test-center/exams"><PlusIcon />{t.examCenter.setup}</NavLink></WorkspaceNav>

    {notice && <Notice $error={notice.error}>{notice.text}</Notice>}

    <SectionHeader>
      <div><h2>{t.examCenter.interviewerBuilding}</h2><p>Approve a consistent profile before it can be used in an exam set. Preview media is intentionally neutral and silent while the web uses browser speech for questions.</p></div>
      <InterviewerControls><Button $tone="cream" disabled={busy === "create-candidates{}"} onClick={() => void act("create-candidates", {}, "A fresh candidate batch is ready for review.")}><SparklesIcon />{t.examCenter.generateCandidates}</Button><FilterRow>{(["all", "approved", "pending", "rejected"] as FilterName[]).map((name) => <Filter key={name} $active={filter === name} onClick={() => setFilter(name)}>{name === "approved" ? t.examCenter.hired : name === "all" ? t.examCenter.all : name === "pending" ? t.examCenter.pending : t.examCenter.rejected} · {counts[name]}</Filter>)}</FilterRow></InterviewerControls>
    </SectionHeader>

    <CandidateGrid>
      {visibleInterviewers.map((person) => {
        const working = Boolean(busy);
        const selected = selectedId === person.id;
        return <CandidateCard $selected={selected} key={person.id} onClick={() => setSelectedId(person.id)}>
          <CandidateVisual><ExamAvatar interviewer={person} large /></CandidateVisual>
          <CandidateMeta><div><h3>{person.name}</h3><p>{person.gender} · {person.occupation} · {person.voice_tone}</p></div><InterviewerStatusPill status={person.status} /></CandidateMeta>
          <CandidateDetails>{person.personality} presence · {person.attire} · Shot and nodding-preview state: {person.image_status === "ready" && person.video_status === "ready" ? "ready" : "needs refresh"}.</CandidateDetails>
          <CandidateActions>
            {person.status !== "approved" && <CompactButton disabled={working} onClick={(event) => { event.stopPropagation(); void act("set-interviewer-status", { interviewerId: person.id, status: "approved" satisfies ExamInterviewerStatus }, `${person.name} is now available for exam set-up.`); }}><CheckIcon />{t.examCenter.hire}</CompactButton>}
            {person.status !== "rejected" && <CompactButton $tone="cream" disabled={working} onClick={(event) => { event.stopPropagation(); void act("set-interviewer-status", { interviewerId: person.id, status: "rejected" satisfies ExamInterviewerStatus }, `${person.name} was moved out of the active roster.`); }}><XMarkIcon />{t.examCenter.reject}</CompactButton>}
            <CompactButton $tone="orange" disabled={working} onClick={(event) => { event.stopPropagation(); void act("refresh-interviewer-media", { interviewerId: person.id }, "The browser preview media is ready to inspect."); }}><FilmIcon />{t.examCenter.refreshPreview}</CompactButton>
            {person.status === "approved" && <CompactButton as={Link} href={`/admin/test-center/exams?interviewer=${person.id}`}><ArrowRightIcon />{t.examCenter.buildSet}</CompactButton>}
          </CandidateActions>
        </CandidateCard>;
      })}
      {!visibleInterviewers.length && <Empty>No profiles match this view. Generate a fresh review batch to begin.</Empty>}
    </CandidateGrid>

    <SectionHeader style={{ marginTop: 42 }}><div><h2>{t.examCenter.recentSets}</h2><p>Jump back into any saved draft or open a published timed preview.</p></div></SectionHeader>
    <CandidateGrid>
      {workspace.sets.slice(0, 3).map((set) => <Card key={set.id} style={{ padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}><div><Eyebrow>{set.interviewer?.name || "Interviewer"}</Eyebrow><h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, letterSpacing: "-0.035em" }}>{set.title}</h3><p style={{ margin: "8px 0 0", color: "rgba(5,5,5,.66)", fontSize: 12, lineHeight: 1.5 }}>{set.ready_item_count ?? 0} of {set.item_count ?? 11} item media checks ready</p></div><SetStatusPill status={set.status} /></div><div style={{ display: "flex", gap: 8, marginTop: 16 }}><CompactButton as={Link} href={`/admin/test-center/exams/${set.id}`}><ArrowRightIcon />{t.examCenter.inspect}</CompactButton>{set.status === "published" && <CompactButton as={Link} $tone="cream" href={`/admin/test-center/exams/${set.id}/preview`}>{t.examCenter.runPreview}</CompactButton>}</div></Card>)}
    </CandidateGrid>
  </ExamPage>;
}
