"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, ArrowPathIcon, CheckIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../lib/contexts/auth_context";

type QuestionType = "listen_repeat" | "picture_description" | "interview";
type AssetType = "image" | "audio";

type QuestionSet = { id: string; slug: string; title: string; description: string; is_published: boolean };
type Section = { id: string; question_set_id: string; question_type: QuestionType; position: number; title: string; directions: string; preparation_seconds: number; response_seconds: number; required_question_count: number };
type Asset = { id: string; asset_type: AssetType; storage_path: string; alt_text: string; duration_seconds: number | null };
type Question = { id: string; question_type: QuestionType; version: number; topic: string; cefr_target: string | null; prompt: string; scenario: string; image_asset_id: string | null; audio_asset_id: string | null; is_active: boolean };
type PrivateQuestion = { question_id: string; expected_transcript: string | null; scoring_notes: Record<string, unknown>; internal_notes: string };
type Link = { section_id: string; question_id: string; position: number };
type Attempt = { id: string; user_id: string; test_version: string; question_set_id: string | null; task_count: number; overall_cefr: string; overall_band: string; overall_score: number; completed_at: string };
type Response = { attempt_id: string; task_number: number; task_kind: QuestionType; question_id: string | null; duration_seconds: number; word_count: number };
type Member = { uid: string; display_name: string | null };
type CenterTab = "overview" | "bank" | "results";
type BuilderData = {
  sets: QuestionSet[];
  sections: Section[];
  assets: Asset[];
  questions: Question[];
  privateRows: PrivateQuestion[];
  links: Link[];
  attempts: Attempt[];
  responses: Response[];
  members: Member[];
};

const QUESTION_LABELS: Record<QuestionType, string> = {
  listen_repeat: "Listen & Repeat",
  picture_description: "Describe a Picture",
  interview: "Take an Interview",
};

const Shell = styled.main`
  max-width: 1180px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  color: #050505;
`;

const Header = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #050505;
  padding-bottom: 1.1rem;
`;

const Eyebrow = styled.p`
  margin: 0 0 0.35rem;
  color: #f47a4a;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.09em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  margin: 0;
  font-size: clamp(1.7rem, 4vw, 2.5rem);
  letter-spacing: -0.045em;
`;

const Body = styled.p`
  max-width: 650px;
  margin: 0.7rem 0 0;
  color: rgba(5, 5, 5, 0.67);
  font-size: 0.92rem;
  line-height: 1.6;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(250px, 0.76fr) minmax(0, 1.5fr);
  gap: 1.6rem;
  @media (max-width: 840px) { grid-template-columns: 1fr; }
`;

const Tabs = styled.nav`
  display: flex;
  gap: 1.2rem;
  margin: -0.55rem 0 2rem;
  border-bottom: 1px solid rgba(5, 5, 5, 0.2);
`;

const Tab = styled.button<{ $active: boolean }>`
  border: 0;
  border-bottom: 3px solid ${({ $active }) => ($active ? "#f47a4a" : "transparent")};
  margin-bottom: -1px;
  padding: 0.7rem 0.05rem 0.65rem;
  background: transparent;
  color: ${({ $active }) => ($active ? "#050505" : "rgba(5, 5, 5, 0.55)")};
  font: inherit;
  font-size: 0.82rem;
  font-weight: 900;
  cursor: pointer;
`;

const Metrics = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  margin-bottom: 2rem;
  @media (max-width: 840px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

const Metric = styled.div`
  border-top: 2px solid #050505;
  padding-top: 0.65rem;
`;

const MetricValue = styled.strong`
  display: block;
  font-size: 1.7rem;
  letter-spacing: -0.05em;
`;

const MetricLabel = styled.span`
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.72rem;
  font-weight: 850;
  text-transform: uppercase;
`;

const DataGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2rem;
  @media (max-width: 760px) { grid-template-columns: 1fr; }
`;

const DataTable = styled.div`
  overflow-x: auto;
  border-top: 2px solid #050505;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  th, td { padding: 0.7rem 0.35rem; border-bottom: 1px solid rgba(5, 5, 5, 0.14); text-align: left; vertical-align: middle; }
  th { color: rgba(5, 5, 5, 0.55); font-size: 0.68rem; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
  th:last-child, td:last-child { text-align: right; }
`;

const Sidebar = styled.aside`
  border-right: 1px solid rgba(5, 5, 5, 0.2);
  padding-right: 1.4rem;
  @media (max-width: 840px) { border-right: 0; border-bottom: 1px solid rgba(5, 5, 5, 0.2); padding: 0 0 1.4rem; }
`;

const SetButton = styled.button<{ $selected: boolean }>`
  display: block;
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(5, 5, 5, 0.16);
  background: ${({ $selected }) => ($selected ? "#fff8dc" : "transparent")};
  padding: 0.85rem 0.65rem;
  color: #050505;
  font: inherit;
  text-align: left;
  cursor: pointer;
  &:hover { background: #fff5ef; }
`;

const SetName = styled.strong`
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.9rem;
`;

const Status = styled.span<{ $published: boolean }>`
  color: ${({ $published }) => ($published ? "#15764b" : "#a34a26")};
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
`;

const Stack = styled.div`
  display: grid;
  gap: 1rem;
`;

const Panel = styled.section`
  border-top: 2px solid #050505;
  padding-top: 0.9rem;
`;

const PanelTitle = styled.h2`
  margin: 0 0 0.85rem;
  font-size: 1.02rem;
  letter-spacing: -0.02em;
`;

const Form = styled.form`
  display: grid;
  gap: 0.65rem;
`;

const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  @media (max-width: 580px) { grid-template-columns: 1fr; }
`;

const Label = styled.label`
  display: grid;
  gap: 0.28rem;
  color: rgba(5, 5, 5, 0.72);
  font-size: 0.73rem;
  font-weight: 850;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1.5px solid #050505;
  border-radius: 7px;
  background: #fff;
  padding: 0.62rem 0.68rem;
  color: #050505;
  font: inherit;
  font-size: 0.85rem;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  box-sizing: border-box;
  resize: vertical;
  border: 1.5px solid #050505;
  border-radius: 7px;
  background: #fff;
  padding: 0.62rem 0.68rem;
  color: #050505;
  font: inherit;
  font-size: 0.85rem;
  line-height: 1.5;
`;

const Select = styled.select`
  width: 100%;
  box-sizing: border-box;
  border: 1.5px solid #050505;
  border-radius: 7px;
  background: #fff;
  padding: 0.62rem 0.68rem;
  color: #050505;
  font: inherit;
  font-size: 0.85rem;
`;

const Button = styled.button<{ $secondary?: boolean }>`
  display: inline-flex;
  width: fit-content;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: ${({ $secondary }) => ($secondary ? "#fff" : "#050505")};
  padding: 0.55rem 0.85rem;
  color: ${({ $secondary }) => ($secondary ? "#050505" : "#fff")};
  font: inherit;
  font-size: 0.78rem;
  font-weight: 850;
  cursor: pointer;
  &:hover { background: ${({ $secondary }) => ($secondary ? "#fff8dc" : "#f47a4a")}; color: #050505; }
  svg { width: 16px; height: 16px; }
`;

const Notice = styled.p<{ $error?: boolean }>`
  margin: 0;
  color: ${({ $error }) => ($error ? "#b42318" : "#167044")};
  font-size: 0.78rem;
  font-weight: 700;
`;

const SectionRow = styled.article`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgba(5, 5, 5, 0.16);
  padding: 0.75rem 0;
`;

const Muted = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.6);
  font-size: 0.8rem;
  line-height: 1.5;
`;

const Loading = styled.div`
  display: grid;
  min-height: 45vh;
  place-items: center;
  color: rgba(5, 5, 5, 0.62);
  font-weight: 800;
`;

const initialData: BuilderData = { sets: [], sections: [], assets: [], questions: [], privateRows: [], links: [], attempts: [], responses: [], members: [] };

export default function SpeakingTestBuilderClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<BuilderData>(initialData);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [questionType, setQuestionType] = useState<QuestionType>("listen_repeat");
  const [assetType, setAssetType] = useState<AssetType>("image");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [activeTab, setActiveTab] = useState<CenterTab>("overview");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/test-center", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load the builder.");
      const next = payload as BuilderData;
      setData(next);
      setSelectedSetId((current) => current && next.sets.some((set) => set.id === current) ? current : next.sets[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the builder.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { router.replace("/auth"); return; }
    if (accountStatus !== "admin") { router.replace("/"); return; }
    void load();
  }, [accountStatus, authLoading, currentUser, load, router]);

  const selectedSet = data.sets.find((set) => set.id === selectedSetId) ?? null;
  const selectedSections = useMemo(() => data.sections.filter((section) => section.question_set_id === selectedSetId), [data.sections, selectedSetId]);
  const assetsForQuestion = useMemo(() => data.assets.filter((asset) => asset.asset_type === (questionType === "listen_repeat" ? "audio" : "image")), [data.assets, questionType]);
  const assignableQuestions = useMemo(() => {
    const section = data.sections.find((item) => item.id === selectedSectionId);
    return section ? data.questions.filter((question) => question.question_type === section.question_type && question.is_active) : [];
  }, [data.questions, data.sections, selectedSectionId]);
  const membersById = useMemo(() => new Map(data.members.map((member) => [member.uid, member])), [data.members]);
  const scoreAverage = useMemo(
    () => data.attempts.length ? data.attempts.reduce((total, attempt) => total + Number(attempt.overall_score), 0) / data.attempts.length : 0,
    [data.attempts],
  );
  const recentAttempts = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return data.attempts.filter((attempt) => new Date(attempt.completed_at).getTime() >= cutoff).length;
  }, [data.attempts]);
  const linkedQuestionIds = useMemo(() => new Set(data.links.map((link) => link.question_id)), [data.links]);
  const questionStats = useMemo(() => data.questions.map((question) => {
    const responses = data.responses.filter((response) => response.question_id === question.id);
    const responseCount = responses.length;
    return {
      question,
      responseCount,
      averageWords: responseCount ? responses.reduce((total, response) => total + response.word_count, 0) / responseCount : 0,
      averageSeconds: responseCount ? responses.reduce((total, response) => total + Number(response.duration_seconds), 0) / responseCount : 0,
      linked: linkedQuestionIds.has(question.id),
    };
  }).sort((a, b) => b.responseCount - a.responseCount), [data.questions, data.responses, linkedQuestionIds]);
  const formatStats = useMemo(() => (Object.keys(QUESTION_LABELS) as QuestionType[]).map((type) => {
    const responses = data.responses.filter((response) => response.task_kind === type);
    return {
      type,
      count: responses.length,
      averageWords: responses.length ? responses.reduce((total, response) => total + response.word_count, 0) / responses.length : 0,
      averageSeconds: responses.length ? responses.reduce((total, response) => total + Number(response.duration_seconds), 0) / responses.length : 0,
    };
  }), [data.responses]);

  const submit = async (event: FormEvent<HTMLFormElement>, action: string) => {
    event.preventDefault();
    setError(""); setMessage("");
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
    payload.action = action;
    ["position", "preparationSeconds", "responseSeconds", "requiredQuestionCount", "durationSeconds"].forEach((name) => {
      if (typeof payload[name] === "string" && payload[name] !== "") payload[name] = Number(payload[name]);
    });
    try {
      const response = await fetch("/api/admin/test-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the change.");
      setMessage("Saved.");
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the change.");
    }
  };

  const publish = async () => {
    if (!selectedSet) return;
    setError(""); setMessage("");
    const response = await fetch("/api/admin/test-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-published", setId: selectedSet.id, isPublished: !selectedSet.is_published }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Could not update publication."); return; }
    setMessage(selectedSet.is_published ? "Set returned to draft." : "Set published.");
    await load();
  };

  if (authLoading || loading || !currentUser || accountStatus !== "admin") return <Loading>Loading Test Center…</Loading>;

  return (
    <Shell>
      <Header>
        <div><Eyebrow>Admin · Speaking practice</Eyebrow><Title>Test Center</Title><Body>Build published test sets, review completion results, and use response data to improve the question bank.</Body></div>
        <Button type="button" $secondary onClick={() => void load()}><ArrowPathIcon />Refresh</Button>
      </Header>
      {(error || message) && <Notice $error={Boolean(error)}>{error || message}</Notice>}
      <Tabs aria-label="Test Center views">
        <Tab type="button" $active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</Tab>
        <Tab type="button" $active={activeTab === "bank"} onClick={() => setActiveTab("bank")}>Question bank</Tab>
        <Tab type="button" $active={activeTab === "results"} onClick={() => setActiveTab("results")}>Test results</Tab>
      </Tabs>
      {activeTab === "overview" && <>
        <Metrics>
          <Metric><MetricValue>{data.attempts.length}</MetricValue><MetricLabel>Completed tests</MetricLabel></Metric>
          <Metric><MetricValue>{new Set(data.attempts.map((attempt) => attempt.user_id)).size}</MetricValue><MetricLabel>Members assessed</MetricLabel></Metric>
          <Metric><MetricValue>{scoreAverage ? scoreAverage.toFixed(0) : "—"}</MetricValue><MetricLabel>Average score</MetricLabel></Metric>
          <Metric><MetricValue>{recentAttempts}</MetricValue><MetricLabel>Completed in 30 days</MetricLabel></Metric>
        </Metrics>
        <DataGrid>
          <Panel><PanelTitle>Question bank status</PanelTitle>
            <Metrics style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
              <Metric><MetricValue>{data.questions.length}</MetricValue><MetricLabel>Bank questions</MetricLabel></Metric>
              <Metric><MetricValue>{linkedQuestionIds.size}</MetricValue><MetricLabel>Assigned to a section</MetricLabel></Metric>
              <Metric><MetricValue>{data.sets.filter((set) => set.is_published).length}</MetricValue><MetricLabel>Published sets</MetricLabel></Metric>
            </Metrics>
          </Panel>
          <Panel><PanelTitle>Response format trends</PanelTitle>
            <DataTable><Table><thead><tr><th>Format</th><th>Responses</th><th>Avg. words</th></tr></thead><tbody>
              {formatStats.map((stat) => <tr key={stat.type}><td>{QUESTION_LABELS[stat.type]}</td><td>{stat.count}</td><td>{stat.count ? stat.averageWords.toFixed(0) : "—"}</td></tr>)}
            </tbody></Table></DataTable>
          </Panel>
        </DataGrid>
      </>}
      {activeTab === "results" && <>
        <Metrics>
          <Metric><MetricValue>{data.attempts.length}</MetricValue><MetricLabel>Saved reports</MetricLabel></Metric>
          <Metric><MetricValue>{data.responses.length}</MetricValue><MetricLabel>Recorded responses</MetricLabel></Metric>
          <Metric><MetricValue>{questionStats.filter((stat) => stat.responseCount > 0).length}</MetricValue><MetricLabel>Bank questions with data</MetricLabel></Metric>
          <Metric><MetricValue>{scoreAverage ? scoreAverage.toFixed(0) : "—"}</MetricValue><MetricLabel>Average score</MetricLabel></Metric>
        </Metrics>
        <DataGrid>
          <Panel><PanelTitle>Recent test results</PanelTitle>
            {data.attempts.length === 0 ? <Muted>No completed tests yet.</Muted> : <DataTable><Table><thead><tr><th>Member</th><th>CEFR</th><th>Score</th><th>Completed</th></tr></thead><tbody>
              {data.attempts.slice(0, 25).map((attempt) => <tr key={attempt.id}><td>{membersById.get(attempt.user_id)?.display_name || "Member"}</td><td>{attempt.overall_cefr}</td><td>{Number(attempt.overall_score).toFixed(0)}</td><td>{new Date(attempt.completed_at).toLocaleDateString()}</td></tr>)}
            </tbody></Table></DataTable>}
          </Panel>
          <Panel><PanelTitle>Question performance</PanelTitle>
            {questionStats.filter((stat) => stat.responseCount > 0).length === 0 ? <Muted>Responses from authored bank questions will appear here once a published set is served to members.</Muted> : <DataTable><Table><thead><tr><th>Question</th><th>Responses</th><th>Avg. words</th></tr></thead><tbody>
              {questionStats.filter((stat) => stat.responseCount > 0).slice(0, 25).map((stat) => <tr key={stat.question.id}><td>{stat.question.topic || QUESTION_LABELS[stat.question.question_type]}</td><td>{stat.responseCount}</td><td>{stat.averageWords.toFixed(0)}</td></tr>)}
            </tbody></Table></DataTable>}
          </Panel>
        </DataGrid>
      </>}
      {activeTab === "bank" && <Layout>
        <Sidebar>
          <Panel><PanelTitle>Test sets</PanelTitle>
            <Form onSubmit={(event) => void submit(event, "create-set")}>
              <Label>Set title<Input name="title" required placeholder="Campus Life 01" /></Label>
              <Label>Slug<Input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="campus-life-01" /></Label>
              <Label>Description<Textarea name="description" placeholder="Short internal description" /></Label>
              <Button type="submit"><PlusIcon />Create set</Button>
            </Form>
          </Panel>
          <div style={{ marginTop: "1rem" }}>
            {data.sets.map((set) => <SetButton key={set.id} type="button" $selected={set.id === selectedSetId} onClick={() => setSelectedSetId(set.id)}><SetName>{set.title}<Status $published={set.is_published}>{set.is_published ? "Published" : "Draft"}</Status></SetName><Muted>{set.slug}</Muted></SetButton>)}
          </div>
        </Sidebar>
        <Stack>
          {!selectedSet ? <Muted>Create a test set to begin.</Muted> : <>
            <Panel><PanelTitle>{selectedSet.title}</PanelTitle><Body>{selectedSet.description || "No internal description."}</Body><div style={{ marginTop: "0.8rem" }}><Button type="button" $secondary={!selectedSet.is_published} onClick={() => void publish()}>{selectedSet.is_published ? "Unpublish set" : <><CheckIcon />Publish set</>}</Button></div></Panel>
            <Panel><PanelTitle>1. Add a section</PanelTitle>
              <Form onSubmit={(event) => void submit(event, "create-section")}>
                <input type="hidden" name="questionSetId" value={selectedSet.id} />
                <Fields><Label>Type<Select name="questionType" defaultValue="listen_repeat">{Object.entries(QUESTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Label><Label>Section title<Input name="title" required placeholder="Listen and Repeat" /></Label></Fields>
                <Label>Directions<Textarea name="directions" required placeholder="Listen carefully, then repeat exactly what you heard." /></Label>
                <Fields><Label>Position<Input name="position" type="number" min="1" required defaultValue={selectedSections.length + 1} /></Label><Label>Questions required<Input name="requiredQuestionCount" type="number" min="1" required defaultValue="3" /></Label><Label>Preparation (seconds)<Input name="preparationSeconds" type="number" min="0" required defaultValue="5" /></Label><Label>Response (seconds)<Input name="responseSeconds" type="number" min="5" required defaultValue="15" /></Label></Fields>
                <Button type="submit"><PlusIcon />Add section</Button>
              </Form>
              {selectedSections.map((section) => <SectionRow key={section.id}><div><strong>{section.position}. {section.title}</strong><Muted>{QUESTION_LABELS[section.question_type]} · {section.required_question_count} questions · {section.preparation_seconds}s / {section.response_seconds}s</Muted></div></SectionRow>)}
            </Panel>
            <Panel><PanelTitle>2. Register an asset</PanelTitle>
              <Form onSubmit={(event) => void submit(event, "create-asset")}>
                <Fields><Label>Asset type<Select name="assetType" value={assetType} onChange={(event) => setAssetType(event.target.value as AssetType)}><option value="image">Image</option><option value="audio">Audio</option></Select></Label><Label>Storage path or CDN URL<Input name="storagePath" required placeholder="speaking-test/campus-life-01.png" /></Label></Fields>
                <Fields><Label>Alt text<Input name="altText" placeholder="Students at a campus booth" /></Label><Label>Audio duration (optional)<Input name="durationSeconds" type="number" min="0" step="0.1" /></Label></Fields>
                <Button type="submit"><PlusIcon />Register asset</Button>
              </Form>
            </Panel>
            <Panel><PanelTitle>3. Create a bank question</PanelTitle>
              <Form onSubmit={(event) => void submit(event, "create-question")}>
                <Fields><Label>Question type<Select name="questionType" value={questionType} onChange={(event) => setQuestionType(event.target.value as QuestionType)}>{Object.entries(QUESTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Label><Label>CEFR target<Select name="cefrTarget" defaultValue="B1"><option value="">Not set</option>{["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => <option key={level}>{level}</option>)}</Select></Label></Fields>
                <Fields><Label>Topic<Input name="topic" placeholder="Campus life" /></Label><Label>{questionType === "listen_repeat" ? "Audio asset" : questionType === "picture_description" ? "Image asset" : "Asset (not required)"}<Select name={questionType === "listen_repeat" ? "audioAssetId" : "imageAssetId"} defaultValue=""><option value="">{questionType === "interview" ? "No asset" : "Choose an asset"}</option>{assetsForQuestion.map((asset) => <option key={asset.id} value={asset.id}>{asset.storage_path}</option>)}</Select></Label></Fields>
                <Label>Prompt shown to the member<Textarea name="prompt" placeholder={questionType === "listen_repeat" ? "Leave blank; the sentence is delivered as audio." : "Describe the picture in as much detail as you can."} /></Label>
                <Label>Interview scenario (optional)<Textarea name="scenario" placeholder="You are meeting an academic adviser for the first time." /></Label>
                <Label>Expected transcript / scoring notes (private)<Textarea name="expectedTranscript" placeholder="Listen & Repeat only — never sent to test-takers." /></Label>
                <Label>Internal notes<Textarea name="internalNotes" placeholder="Reviewer notes or coverage points" /></Label>
                <Button type="submit"><PlusIcon />Create bank question</Button>
              </Form>
            </Panel>
            <Panel><PanelTitle>4. Add questions to a section</PanelTitle>
              <Form onSubmit={(event) => void submit(event, "add-question-to-section")}>
                <Fields><Label>Section<Select name="sectionId" value={selectedSectionId} onChange={(event) => { setSelectedSectionId(event.target.value); setSelectedQuestionId(""); }}><option value="">Choose a section</option>{selectedSections.map((section) => <option key={section.id} value={section.id}>{section.position}. {section.title}</option>)}</Select></Label><Label>Bank question<Select name="questionId" value={selectedQuestionId} onChange={(event) => setSelectedQuestionId(event.target.value)}><option value="">Choose a question</option>{assignableQuestions.map((question) => <option key={question.id} value={question.id}>{question.topic || QUESTION_LABELS[question.question_type]} · {question.prompt || "Audio-only sentence"}</option>)}</Select></Label><Label>Position<Input name="position" type="number" min="1" required defaultValue="1" /></Label></Fields>
                <Button type="submit"><PlusIcon />Add to section</Button>
              </Form>
            </Panel>
          </>}
        </Stack>
      </Layout>}
    </Shell>
  );
}
