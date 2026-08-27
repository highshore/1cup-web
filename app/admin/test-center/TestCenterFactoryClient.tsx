"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  FilmIcon,
  PhotoIcon,
  PlayCircleIcon,
  SparklesIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../lib/contexts/auth_context";

type QuestionType = "listen_repeat" | "picture_description" | "interview";
type AssetType = "image" | "audio" | "video";

type QuestionSet = {
  id: string;
  slug: string;
  title: string;
  description: string;
  format_version: string;
  is_published: boolean;
  generation_status?: string;
  generation_metadata?: Record<string, unknown>;
};

type Section = {
  id: string;
  question_set_id: string;
  question_type: QuestionType;
  position: number;
  title: string;
  directions: string;
  preparation_seconds: number;
  response_seconds: number;
  required_question_count: number;
  visual_asset_id?: string | null;
};

type Asset = {
  id: string;
  asset_type: AssetType;
  storage_path: string;
  alt_text: string;
  duration_seconds: number | null;
};

type Question = {
  id: string;
  question_type: QuestionType;
  topic: string;
  prompt: string;
  scenario: string;
  image_asset_id: string | null;
  audio_asset_id: string | null;
  video_asset_id?: string | null;
  is_active: boolean;
};

type PrivateQuestion = {
  question_id: string;
  expected_transcript: string | null;
  scoring_notes: Record<string, unknown>;
  internal_notes: string;
};

type QuestionLink = { section_id: string; question_id: string; position: number };

type BuilderData = {
  sets: QuestionSet[];
  sections: Section[];
  assets: Asset[];
  questions: Question[];
  privateRows: PrivateQuestion[];
  links: QuestionLink[];
};

type ProviderState = {
  factoryVersion: string;
  providers: {
    openai: boolean;
    interviewerVideo: boolean;
    interviewerVideoProvider: string;
  };
};

const emptyData: BuilderData = {
  sets: [],
  sections: [],
  assets: [],
  questions: [],
  privateRows: [],
  links: [],
};

const Shell = styled.main`
  width: min(1440px, calc(100% - 2.5rem));
  margin: 0 auto;
  padding: 0 0 4rem;
  color: #050505;

  @media (max-width: 640px) {
    width: min(100% - 1.25rem, 1440px);
  }
`;

const Header = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.35rem;

  @media (max-width: 760px) {
    flex-direction: column;
  }
`;

const Eyebrow = styled.p`
  margin: 0 0 0.45rem;
  color: #c84932;
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.085em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.55rem);
  font-weight: 900;
  letter-spacing: -0.045em;
`;

const Body = styled.p`
  max-width: 760px;
  margin: 0.65rem 0 0;
  color: rgba(5, 5, 5, 0.64);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.6;
`;

const HeaderLink = styled(Link)`
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 0.65rem 0.9rem;
  color: #050505;
  font-size: 0.78rem;
  font-weight: 850;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 3px 3px 0 #050505;
`;

const ProviderRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin: 0 0 1.25rem;
`;

const Provider = styled.span<{ $ok: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  border: 1px solid #050505;
  border-radius: 999px;
  padding: 0.38rem 0.62rem;
  background: ${({ $ok }) => ($ok ? "#e7f8e3" : "#fff0df")};
  font-size: 0.72rem;
  font-weight: 850;

  svg {
    width: 15px;
    height: 15px;
  }
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1.28fr);
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.section`
  border: 2px solid #050505;
  border-radius: 16px;
  background: #fff;
  box-shadow: 5px 5px 0 #050505;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  border-bottom: 2px solid #050505;
  padding: 1rem 1.1rem;
  background: #fff8dc;
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: 1rem;
  font-weight: 900;
`;

const PanelBody = styled.div`
  padding: 1.05rem;
`;

const Form = styled.form`
  display: grid;
  gap: 0.9rem;
`;

const Field = styled.label`
  display: grid;
  gap: 0.38rem;
  color: #050505;
  font-size: 0.76rem;
  font-weight: 850;
`;

const Input = styled.input`
  min-height: 42px;
  width: 100%;
  border: 1.5px solid #050505;
  border-radius: 9px;
  background: #fff;
  padding: 0.66rem 0.72rem;
  color: #050505;
  font: inherit;
  font-size: 0.84rem;
`;

const Textarea = styled.textarea`
  min-height: 86px;
  resize: vertical;
  width: 100%;
  border: 1.5px solid #050505;
  border-radius: 9px;
  background: #fff;
  padding: 0.68rem 0.72rem;
  color: #050505;
  font: inherit;
  font-size: 0.84rem;
  line-height: 1.5;
`;

const Checkbox = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  font-size: 0.78rem;
  font-weight: 750;
  line-height: 1.45;

  input {
    width: 18px;
    height: 18px;
    margin-top: 0.05rem;
    accent-color: #f47a4a;
  }
`;

const Button = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 0.48rem;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 0.65rem 0.9rem;
  background: ${({ $primary }) => ($primary ? "#f47a4a" : "#fff")};
  color: #050505;
  font: inherit;
  font-size: 0.79rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 3px 3px 0 #050505;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.52;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
`;

const Notice = styled.div<{ $error?: boolean }>`
  margin-bottom: 1rem;
  border: 1.5px solid #050505;
  border-radius: 10px;
  background: ${({ $error }) => ($error ? "#ffe5df" : "#e7f8e3")};
  padding: 0.72rem 0.82rem;
  font-size: 0.78rem;
  font-weight: 750;
  line-height: 1.5;
`;

const SetList = styled.div`
  display: grid;
  gap: 0.55rem;
  margin-top: 1.15rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(5, 5, 5, 0.22);
`;

const SetButton = styled.button<{ $active: boolean }>`
  display: grid;
  gap: 0.18rem;
  width: 100%;
  border: 1.5px solid #050505;
  border-radius: 10px;
  background: ${({ $active }) => ($active ? "#fff0c3" : "#fff")};
  padding: 0.7rem;
  color: #050505;
  text-align: left;
  cursor: pointer;

  strong {
    font-size: 0.82rem;
  }

  span {
    color: rgba(5, 5, 5, 0.58);
    font-size: 0.68rem;
    font-weight: 750;
  }
`;

const Empty = styled.div`
  min-height: 320px;
  display: grid;
  place-items: center;
  padding: 2rem;
  color: rgba(5, 5, 5, 0.52);
  text-align: center;
  font-size: 0.85rem;
  font-weight: 750;
`;

const Detail = styled.div`
  display: grid;
  gap: 1.1rem;
`;

const SetHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const SetTitle = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: -0.03em;
`;

const Status = styled.span<{ $published?: boolean }>`
  display: inline-flex;
  border: 1px solid #050505;
  border-radius: 999px;
  background: ${({ $published }) => ($published ? "#e7f8e3" : "#fff0c3")};
  padding: 0.34rem 0.58rem;
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
`;

const TaskCard = styled.article`
  border-top: 2px solid #050505;
  padding-top: 1.1rem;
`;

const TaskHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.8rem;

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 900;
  }

  span {
    color: rgba(5, 5, 5, 0.58);
    font-size: 0.72rem;
    font-weight: 800;
  }
`;

const Visual = styled.img`
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: cover;
  border: 1.5px solid #050505;
  border-radius: 12px;
  background: #f3f3f3;
`;

const InterviewVisual = styled(Visual)`
  max-height: 280px;
  object-fit: contain;
`;

const ItemList = styled.div`
  display: grid;
  gap: 0.65rem;
  margin-top: 0.85rem;
`;

const Item = styled.div`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) minmax(170px, 0.45fr);
  gap: 0.75rem;
  align-items: center;
  border-bottom: 1px solid rgba(5, 5, 5, 0.16);
  padding: 0.62rem 0;

  @media (max-width: 720px) {
    grid-template-columns: 32px 1fr;
  }
`;

const NumberBadge = styled.span`
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  border-radius: 50%;
  background: #050505;
  color: #fff;
  font-size: 0.69rem;
  font-weight: 900;
`;

const Prompt = styled.p`
  margin: 0;
  color: #050505;
  font-size: 0.81rem;
  font-weight: 720;
  line-height: 1.5;
`;

const Media = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.42rem;

  @media (max-width: 720px) {
    grid-column: 2;
    justify-content: flex-start;
  }

  audio {
    width: min(100%, 230px);
    height: 34px;
  }

  video {
    width: 160px;
    max-height: 90px;
    border: 1px solid #050505;
    border-radius: 7px;
    background: #050505;
  }
`;

const Missing = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: #c84932;
  font-size: 0.68rem;
  font-weight: 850;

  svg {
    width: 15px;
  }
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.52rem;
  color: rgba(5, 5, 5, 0.58);
  font-size: 0.7rem;
  font-weight: 750;
`;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function TestCenterFactoryClient() {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<BuilderData>(emptyData);
  const [providerState, setProviderState] = useState<ProviderState | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [listenSeed, setListenSeed] = useState("");
  const [interviewSeed, setInterviewSeed] = useState("");
  const [generateVideo, setGenerateVideo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dataResponse, providerResponse] = await Promise.all([
        fetch("/api/admin/test-center", { cache: "no-store" }),
        fetch("/api/admin/test-center/generate", { cache: "no-store" }),
      ]);
      const dataPayload = await dataResponse.json();
      const providerPayload = await providerResponse.json();
      if (!dataResponse.ok) throw new Error(dataPayload.error || "Could not load Test Center.");
      if (!providerResponse.ok) throw new Error(providerPayload.error || "Could not load factory configuration.");

      const next = dataPayload as BuilderData;
      setData(next);
      setProviderState(providerPayload as ProviderState);
      setGenerateVideo(Boolean(providerPayload?.providers?.interviewerVideo));
      setSelectedSetId((current) => {
        const factorySets = next.sets.filter((set) => set.format_version === "speaking-2026");
        return current && factorySets.some((set) => set.id === current) ? current : factorySets[0]?.id ?? null;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Test Center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (accountStatus !== "admin") {
      router.replace("/");
      return;
    }
    void load();
  }, [accountStatus, authLoading, currentUser, load, router]);

  const factorySets = useMemo(
    () => data.sets.filter((set) => set.format_version === "speaking-2026"),
    [data.sets],
  );
  const selectedSet = factorySets.find((set) => set.id === selectedSetId) ?? null;
  const selectedSections = useMemo(
    () => data.sections.filter((section) => section.question_set_id === selectedSetId).sort((a, b) => a.position - b.position),
    [data.sections, selectedSetId],
  );
  const assetById = useMemo(() => new Map(data.assets.map((asset) => [asset.id, asset])), [data.assets]);
  const questionById = useMemo(() => new Map(data.questions.map((question) => [question.id, question])), [data.questions]);
  const privateById = useMemo(() => new Map(data.privateRows.map((row) => [row.question_id, row])), [data.privateRows]);

  const sectionItems = useCallback((sectionId: string) => {
    return data.links
      .filter((link) => link.section_id === sectionId)
      .sort((a, b) => a.position - b.position)
      .map((link) => ({ link, question: questionById.get(link.question_id) }))
      .filter((item): item is { link: QuestionLink; question: Question } => Boolean(item.question));
  }, [data.links, questionById]);

  async function postFactory(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/test-center/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Factory request failed.");
    return result;
  }

  async function onGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy("generate");
    try {
      const result = await postFactory({
        action: "generate",
        title,
        slug,
        listenRepeatSeed: listenSeed,
        interviewSeed,
        generateVideo,
      });
      setMessage(
        result.hasAllVideos
          ? "Draft generated with all 11 audio clips, the scenario image, and four interviewer videos."
          : "Draft generated. Text, scene image, portrait, and audio are ready; interviewer video still needs completion.",
      );
      setTitle("");
      setSlug("");
      setListenSeed("");
      setInterviewSeed("");
      await load();
      setSelectedSetId(result.setId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the Speaking set.");
    } finally {
      setBusy("");
    }
  }

  async function togglePublish(published: boolean) {
    if (!selectedSet) return;
    setError("");
    setMessage("");
    setBusy("publish");
    try {
      await postFactory({ action: "publish", setId: selectedSet.id, published });
      setMessage(published ? "Speaking set published." : "Speaking set unpublished.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update publishing.");
    } finally {
      setBusy("");
    }
  }

  async function retryVideos() {
    if (!selectedSet) return;
    setError("");
    setMessage("");
    setBusy("videos");
    try {
      const result = await postFactory({ action: "retry-videos", setId: selectedSet.id });
      setMessage(`Rendered ${result.rendered} interviewer clip(s). ${result.remaining} still pending.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not render interviewer videos.");
    } finally {
      setBusy("");
    }
  }

  if (authLoading || loading) {
    return <Shell><Empty>Loading the 2026 Speaking factory…</Empty></Shell>;
  }

  return (
    <Shell>
      <Header>
        <div>
          <Eyebrow>Admin · Test Center</Eyebrow>
          <Title>TOEFL Speaking 2026 Factory</Title>
          <Body>
            Generate one complete practice set at a time: seven Listen &amp; Repeat items sharing one contextual scene,
            followed by four Take an Interview questions. Content is saved as a draft and can only be published after
            all required media passes the structural gate.
          </Body>
        </div>
        <HeaderLink href="/admin/speaking-test-builder">Open manual builder</HeaderLink>
      </Header>

      <ProviderRow>
        <Provider $ok={Boolean(providerState?.providers.openai)}>
          <SparklesIcon /> OpenAI text · image · TTS {providerState?.providers.openai ? "ready" : "missing"}
        </Provider>
        <Provider $ok={Boolean(providerState?.providers.interviewerVideo)}>
          <FilmIcon /> {providerState?.providers.interviewerVideoProvider || "Interviewer video"} {providerState?.providers.interviewerVideo ? "ready" : "needs API key"}
        </Provider>
        {providerState?.factoryVersion && <Provider $ok><CheckCircleIcon /> {providerState.factoryVersion}</Provider>}
      </ProviderRow>

      {error && <Notice $error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}

      <Layout>
        <Panel>
          <PanelHeader>
            <PanelTitle>Generate a new set</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <Form onSubmit={onGenerate}>
              <Field>
                Practice test title
                <Input
                  value={title}
                  onChange={(event) => {
                    const next = event.target.value;
                    setTitle(next);
                    setSlug(slugify(next));
                  }}
                  placeholder="Speaking Practice 001"
                  maxLength={140}
                  required
                />
              </Field>

              <Field>
                Slug
                <Input
                  value={slug}
                  onChange={(event) => setSlug(slugify(event.target.value))}
                  placeholder="speaking-practice-001"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  maxLength={80}
                  required
                />
              </Field>

              <Field>
                Listen &amp; Repeat scenario seed
                <Textarea
                  value={listenSeed}
                  onChange={(event) => setListenSeed(event.target.value)}
                  placeholder="Optional: campus library orientation, with checkout, printing, study areas, and staff help."
                  maxLength={500}
                />
              </Field>

              <Field>
                Interview topic seed
                <Textarea
                  value={interviewSeed}
                  onChange={(event) => setInterviewSeed(event.target.value)}
                  placeholder="Optional: how students choose extracurricular activities."
                  maxLength={500}
                />
              </Field>

              <Checkbox>
                <input
                  type="checkbox"
                  checked={generateVideo}
                  disabled={!providerState?.providers.interviewerVideo}
                  onChange={(event) => setGenerateVideo(event.target.checked)}
                />
                <span>
                  Render four talking-interviewer clips. {!providerState?.providers.interviewerVideo
                    ? "D-ID is not configured, so the factory will stop at portrait + TTS and keep the set unpublished."
                    : "The same generated interviewer portrait is reused across all four clips."}
                </span>
              </Checkbox>

              <Button $primary type="submit" disabled={busy !== "" || !providerState?.providers.openai}>
                {busy === "generate" ? <ArrowPathIcon /> : <SparklesIcon />}
                {busy === "generate" ? "Generating text + media…" : "Generate 7 + 4 draft"}
              </Button>
            </Form>

            <SetList>
              <strong style={{ fontSize: "0.78rem" }}>2026 draft bank · {factorySets.length}</strong>
              {factorySets.length === 0 && <Body style={{ margin: 0 }}>No generated sets yet.</Body>}
              {factorySets.map((set) => (
                <SetButton
                  key={set.id}
                  type="button"
                  $active={set.id === selectedSetId}
                  onClick={() => setSelectedSetId(set.id)}
                >
                  <strong>{set.title}</strong>
                  <span>{set.slug} · {set.generation_status || "draft"} · {set.is_published ? "published" : "unpublished"}</span>
                </SetButton>
              ))}
            </SetList>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Review and publish</PanelTitle>
          </PanelHeader>
          <PanelBody>
            {!selectedSet ? (
              <Empty>Generate or select a 2026 Speaking set to review its 11 items and media.</Empty>
            ) : (
              <Detail>
                <SetHeader>
                  <div>
                    <SetTitle>{selectedSet.title}</SetTitle>
                    <Meta>
                      <span>{selectedSet.format_version}</span>
                      <span>·</span>
                      <span>{selectedSet.generation_status || "draft"}</span>
                      <span>·</span>
                      <span>{selectedSet.slug}</span>
                    </Meta>
                  </div>
                  <Status $published={selectedSet.is_published}>
                    {selectedSet.is_published ? "Published" : "Draft"}
                  </Status>
                </SetHeader>

                {selectedSections.map((section) => {
                  const items = sectionItems(section.id);
                  const visual = section.visual_asset_id ? assetById.get(section.visual_asset_id) : null;
                  const isListen = section.question_type === "listen_repeat";
                  return (
                    <TaskCard key={section.id}>
                      <TaskHead>
                        <h3>{section.position}. {section.title}</h3>
                        <span>{items.length}/{section.required_question_count} items · {section.response_seconds}s response</span>
                      </TaskHead>

                      {visual?.storage_path
                        ? isListen
                          ? <Visual src={visual.storage_path} alt={visual.alt_text || "Listen and Repeat contextual scene"} />
                          : <InterviewVisual src={visual.storage_path} alt={visual.alt_text || "AI practice interviewer"} />
                        : <Missing><PhotoIcon /> contextual visual missing</Missing>}

                      <ItemList>
                        {items.map(({ link, question }) => {
                          const audio = question.audio_asset_id ? assetById.get(question.audio_asset_id) : null;
                          const video = question.video_asset_id ? assetById.get(question.video_asset_id) : null;
                          const privateRow = privateById.get(question.id);
                          const text = isListen ? privateRow?.expected_transcript || "(private transcript missing)" : question.prompt;
                          return (
                            <Item key={question.id}>
                              <NumberBadge>{link.position}</NumberBadge>
                              <Prompt>{text}</Prompt>
                              <Media>
                                {video?.storage_path && <video src={video.storage_path} controls preload="metadata" />}
                                {!video?.storage_path && !isListen && <Missing><FilmIcon /> video pending</Missing>}
                                {audio?.storage_path
                                  ? <audio src={audio.storage_path} controls preload="none" />
                                  : <Missing><SpeakerWaveIcon /> audio missing</Missing>}
                              </Media>
                            </Item>
                          );
                        })}
                      </ItemList>
                    </TaskCard>
                  );
                })}

                <ButtonRow>
                  {providerState?.providers.interviewerVideo && !selectedSet.is_published && (
                    <Button type="button" onClick={retryVideos} disabled={busy !== ""}>
                      {busy === "videos" ? <ArrowPathIcon /> : <FilmIcon />}
                      {busy === "videos" ? "Rendering…" : "Retry missing interview videos"}
                    </Button>
                  )}
                  <Button
                    $primary={!selectedSet.is_published}
                    type="button"
                    onClick={() => void togglePublish(!selectedSet.is_published)}
                    disabled={busy !== ""}
                  >
                    {busy === "publish" ? <ArrowPathIcon /> : selectedSet.is_published ? <PlayCircleIcon /> : <CloudArrowUpIcon />}
                    {selectedSet.is_published ? "Unpublish" : "Publish validated 2026 set"}
                  </Button>
                </ButtonRow>

                <Body style={{ margin: 0 }}>
                  Publishing is intentionally strict: exactly two sections, 7 Listen &amp; Repeat + 4 Interview,
                  a shared contextual visual for each section, audio for all 11 prompts, and talking-head video for all four interview questions.
                </Body>
              </Detail>
            )}
          </PanelBody>
        </Panel>
      </Layout>
    </Shell>
  );
}
