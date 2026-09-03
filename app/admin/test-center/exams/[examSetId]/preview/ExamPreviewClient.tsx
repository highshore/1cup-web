"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, MicrophoneIcon, PauseIcon, PlayIcon, SpeakerWaveIcon, StopIcon } from "@heroicons/react/24/outline";
import styled from "styled-components";

import { useAuth } from "../../../../../lib/contexts/auth_context";
import { loadExamSet } from "../../../../../lib/features/exam/services/exam_admin_client";
import type { ExamItem, ExamNarration, ExamSetDetail } from "../../../../../lib/features/exam/types";
import { useI18n } from "../../../../../lib/i18n/I18nProvider";
import { Button, ExamAvatar, GardenScene, Loading, Notice } from "../../../exam_ui";

const Shell = styled.main`
  min-height: 100vh;
  background: #fff8dc;
  color: #050505;
`;

const Topbar = styled.header`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 20px;
  border-bottom: 2px solid #050505;
  @media (max-width: 700px) { grid-template-columns: 1fr auto; .center { display: none; } }
`;

const Brand = styled(Link)`
  color: #050505;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
`;

const TopCenter = styled.div`
  color: rgba(5,5,5,.66);
  font-size: 11px;
  font-weight: 800;
  text-align: center;
`;

const Exit = styled(Link)`
  justify-self: end;
  color: #050505;
  font-size: 11px;
  font-weight: 850;
  text-decoration: underline;
  text-underline-offset: 3px;
`;

const Stage = styled.section`
  display: grid;
  min-height: calc(100vh - 67px);
  place-items: center;
  padding: 24px 20px 54px;
`;

const Welcome = styled.div`
  width: min(100%, 630px);
  border: 2px solid #050505;
  border-radius: 16px;
  padding: clamp(22px, 5vw, 42px);
  background: #fff;
  box-shadow: 7px 7px 0 #f47a4a;
`;

const Kicker = styled.p`
  margin: 0 0 8px;
  color: #c84932;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
`;

const Heading = styled.h1`
  margin: 0;
  font-size: clamp(29px, 6vw, 50px);
  font-weight: 900;
  letter-spacing: -.06em;
  line-height: 1.02;
`;

const Lead = styled.p`
  max-width: 540px;
  margin: 14px 0 0;
  color: rgba(5,5,5,.67);
  font-size: 14px;
  line-height: 1.65;
`;

const Overview = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  margin: 24px 0;
  border-top: 2px solid #050505;
  border-bottom: 2px solid #050505;
  div { padding: 13px 9px; &:not(:last-child) { border-right: 1px solid rgba(5,5,5,.35); } }
  dt { color: rgba(5,5,5,.62); font-size: 10px; font-weight: 800; text-transform: uppercase; }
  dd { margin: 4px 0 0; font-size: 15px; font-weight: 900; }
`;

const Run = styled(Button)`
  min-height: 49px;
  padding: 11px 17px;
  font-size: 13px;
`;

const Player = styled.div`
  width: min(100%, 810px);
`;

const Progress = styled.div`
  height: 8px;
  overflow: hidden;
  border: 1.5px solid #050505;
  background: #fff;
`;

const ProgressFill = styled.div<{ $value: number }>`
  width: ${({ $value }) => `${Math.max(0, Math.min($value, 100))}%`};
  height: 100%;
  background: #f47a4a;
  transition: width .35s ease;
`;

const TaskHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-top: 25px;
  border-bottom: 2px solid #050505;
  padding-bottom: 15px;
`;

const TaskTitle = styled.h1`
  margin: 0;
  font-size: clamp(26px, 4.5vw, 41px);
  font-weight: 900;
  letter-spacing: -.055em;
  line-height: 1.06;
`;

const Count = styled.div`
  flex: 0 0 auto;
  border: 2px solid #050505;
  border-radius: 999px;
  padding: 8px 11px;
  background: #fff;
  color: #050505;
  font-size: 11px;
  font-weight: 900;
`;

const PromptSurface = styled.div`
  margin-top: 20px;
  border: 2px solid #050505;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  box-shadow: 5px 5px 0 #050505;
`;

const NarrationSurface = styled(PromptSurface)`
  min-height: 270px;
  display: grid;
  place-items: center;
  padding: 27px;
  background: #fff;
  text-align: center;
`;

const NarrationCopy = styled.p`
  max-width: 620px;
  margin: 0;
  color: #050505;
  font-size: clamp(18px, 3vw, 26px);
  font-weight: 800;
  line-height: 1.5;
`;

const VisualSurface = styled.div`
  min-height: 310px;
  padding: 18px;
  background: #fff8dc;
`;

const InterviewSurface = styled.div<{ $listening?: boolean }>`
  display: grid;
  min-height: 310px;
  place-items: center;
  padding: 20px;
  background: ${({ $listening }) => $listening ? "#d8ead2" : "#fff8dc"};
  transition: background .2s ease;
`;

const PromptHint = styled.p`
  margin: 15px 18px 18px;
  color: rgba(5,5,5,.66);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.55;
  text-align: center;
`;

const ResponsePanel = styled.div<{ $recording: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-top: 20px;
  border-top: 2px solid #050505;
  border-bottom: 2px solid #050505;
  padding: 16px 0;
  color: #050505;
  .signal { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; border: 2px solid #050505; border-radius: 50%; background: ${({ $recording }) => $recording ? "#f47a4a" : "#fff"}; }
  .timer { margin-left: auto; font-size: 29px; font-variant-numeric: tabular-nums; font-weight: 900; letter-spacing: -.06em; }
  strong { display: block; font-size: 12px; font-weight: 900; }
  span { display: block; margin-top: 3px; color: rgba(5,5,5,.62); font-size: 11px; font-weight: 650; line-height: 1.4; }
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 17px;
`;

type SequenceEntry = { type: "narration"; value: ExamNarration } | { type: "item"; value: ExamItem };
type Phase = "welcome" | "playing" | "recording" | "complete";

function timer(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

function browserSpeech(text: string) {
  return new Promise<void>((resolve, reject) => {
    if (!("speechSynthesis" in window)) { reject(new Error("Browser speech is not available in this browser.")); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.lang = "en-US";
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("Browser speech could not play this prompt."));
    window.speechSynthesis.speak(utterance);
  });
}

export default function ExamPreviewClient({ examSetId }: { examSetId: string }) {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [examSet, setExamSet] = useState<ExamSetDetail | null>(null);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => { if (!isLoading && (!currentUser || accountStatus !== "admin")) router.replace("/"); }, [accountStatus, currentUser, isLoading, router]);
  useEffect(() => { if (currentUser && accountStatus === "admin") void loadExamSet(examSetId).then(setExamSet).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load the exam interface.")); }, [accountStatus, currentUser, examSetId]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); recorder.current?.stop(); stream.current?.getTracks().forEach((track) => track.stop()); }, []);

  const sequence = useMemo<SequenceEntry[]>(() => {
    if (!examSet) return [];
    const narration = new Map(examSet.narration.map((cue) => [cue.cue_key, cue]));
    const listening = examSet.items.filter((item) => item.module === "listen_repeat").sort((left, right) => left.position - right.position);
    const interview = examSet.items.filter((item) => item.module === "interview").sort((left, right) => left.position - right.position);
    const introduction: SequenceEntry[] = [
      "section_intro", "listen_repeat_instructions", "listen_repeat_scenario",
    ].flatMap((key) => narration.get(key as ExamNarration["cue_key"]) ? [{ type: "narration" as const, value: narration.get(key as ExamNarration["cue_key"])! }] : []);
    const transition: SequenceEntry[] = ["interview_instructions", "interview_scenario"]
      .flatMap((key) => narration.get(key as ExamNarration["cue_key"]) ? [{ type: "narration" as const, value: narration.get(key as ExamNarration["cue_key"])! }] : []);
    return [
      ...introduction,
      ...listening.map((value): SequenceEntry => ({ type: "item", value })),
      ...transition,
      ...interview.map((value): SequenceEntry => ({ type: "item", value })),
    ];
  }, [examSet]);
  const current = sequence[index];
  const responseItems = sequence.filter((entry) => entry.type === "item");
  const responsePosition = responseItems.findIndex((entry) => entry === current) + 1;

  const beginRecording = useCallback((item: ExamItem) => {
    try {
      recorder.current?.stop();
      if (stream.current && typeof MediaRecorder !== "undefined") {
        recorder.current = new MediaRecorder(stream.current);
        recorder.current.start();
      }
    } catch { /* The timed view remains usable when recording is unavailable. */ }
    setSeconds(item.response_seconds);
    setPhase("recording");
  }, []);

  const advance = useCallback(() => {
    window.speechSynthesis?.cancel();
    recorder.current?.state === "recording" && recorder.current.stop();
    if (index + 1 >= sequence.length) { setPhase("complete"); return; }
    setIndex((value) => value + 1);
    setPhase("playing");
  }, [index, sequence.length]);

  useEffect(() => {
    if (phase !== "playing" || !current) return;
    let cancelled = false;
    void browserSpeech(current.type === "item" ? current.value.prompt : current.value.script)
      .then(() => {
        if (cancelled) return;
        if (current.type === "item") beginRecording(current.value);
        else advance();
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Prompt audio could not play."); });
    return () => { cancelled = true; window.speechSynthesis?.cancel(); };
  }, [advance, beginRecording, current, phase]);

  useEffect(() => {
    if (phase !== "recording") return;
    if (seconds <= 0) { advance(); return; }
    const timeout = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [advance, phase, seconds]);

  async function start() {
    setError("");
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError("Microphone access was not granted. The preview will continue, but no local recording will be captured."); }
    setIndex(0); setPhase("playing");
  }

  if (isLoading || !examSet) return <Shell><Stage><Loading>{error || "Loading timed exam interface…"}</Loading></Stage></Shell>;
  if (examSet.status !== "published") return <Shell><Topbar><Brand href={`/admin/test-center/exams/${examSetId}`}>{t.examCenter.pipelineTitle}</Brand><TopCenter className="center">{t.examCenter.timedPreview}</TopCenter><Exit href={`/admin/test-center/exams/${examSetId}`}>{t.examCenter.returnInspection}</Exit></Topbar><Stage><Welcome><Kicker>{t.examCenter.previewLocked}</Kicker><Heading>{t.examCenter.publishFirst}</Heading><Lead>Return to individual inspection, complete all browser media checks, and publish the set before starting its timed run.</Lead><div style={{ marginTop: 22 }}><Button as={Link} href={`/admin/test-center/exams/${examSetId}`}><ArrowLeftIcon />{t.examCenter.returnInspection}</Button></div></Welcome></Stage></Shell>;

  return <Shell><Topbar><Brand href={`/admin/test-center/exams/${examSetId}`}>{t.examCenter.pipelineTitle}</Brand><TopCenter className="center">{phase === "welcome" ? "Speaking section · about 8 minutes" : `${t.examCenter.response} ${Math.max(0, responsePosition)} of 11`}</TopCenter><Exit href={`/admin/test-center/exams/${examSetId}`}>{t.examCenter.exitPractice}</Exit></Topbar>{error && <div style={{ maxWidth: 810, margin: "17px auto 0", padding: "0 20px" }}><Notice $error>{error}</Notice></div>}<Stage>
    {phase === "welcome" && <Welcome><Kicker>{t.examCenter.timedRun}</Kicker><Heading>{examSet.title}</Heading><Lead>One uninterrupted flow: Listen and Repeat comes first, followed by Take an Interview. Every prompt plays once. A microphone recording is kept only in this browser for this preview session.</Lead><Overview><div><dt>{t.examCenter.responses}</dt><dd>11</dd></div><div><dt>{t.examCenter.preparation}</dt><dd>{t.examCenter.none}</dd></div><div><dt>{t.examCenter.recording}</dt><dd>{t.examCenter.timed}</dd></div></Overview><Run onClick={() => void start()}><MicrophoneIcon />{t.examCenter.beginSpeaking}</Run></Welcome>}
    {(phase === "playing" || phase === "recording") && current && <Player><Progress><ProgressFill $value={((index + 1) / sequence.length) * 100} /></Progress><TaskHeading><div><Kicker>{current.type === "narration" ? "Speaking directions" : current.value.module === "listen_repeat" ? "Listen and Repeat" : "Take an Interview"}</Kicker><TaskTitle>{current.type === "narration" ? current.value.label : `${current.value.label} of ${current.value.module === "listen_repeat" ? 7 : 4}`}</TaskTitle></div><Count>{current.type === "item" ? `${responsePosition} / 11` : "Directions"}</Count></TaskHeading>
      {current.type === "narration" ? <NarrationSurface><div><SpeakerWaveIcon style={{ width: 34, height: 34, color: "#f47a4a", marginBottom: 15 }} /><NarrationCopy>{current.value.script}</NarrationCopy><p style={{ margin: "17px 0 0", color: "rgba(5,5,5,.59)", fontSize: 11, fontWeight: 750 }}>{phase === "playing" ? "Playing browser voice…" : ""}</p></div></NarrationSurface> : <PromptSurface>{current.value.module === "listen_repeat" ? <VisualSurface><GardenScene target={current.value.visual_target} /></VisualSurface> : <InterviewSurface $listening={phase === "recording"}><ExamAvatar interviewer={examSet.interviewer} large /><p style={{ margin: "13px 0 0", color: "rgba(5,5,5,.67)", fontSize: 12, fontWeight: 850 }}>{phase === "recording" ? `${examSet.interviewer.name} is listening` : `${examSet.interviewer.name} is asking a question`}</p></InterviewSurface>}<PromptHint>{phase === "playing" ? "Listen carefully. The prompt will play once, then recording starts immediately." : "Speak now. The recording stops automatically when time runs out."}</PromptHint></PromptSurface>}
      {current.type === "item" && <ResponsePanel $recording={phase === "recording"}><div className="signal">{phase === "recording" ? <MicrophoneIcon /> : <SpeakerWaveIcon />}</div><div><strong>{phase === "recording" ? "Recording response" : "Prompt playing"}</strong><span>{phase === "recording" ? "Use the remaining time to give a complete answer." : "Recording begins automatically after the voice finishes."}</span></div><div className="timer">{phase === "recording" ? timer(seconds) : "…"}</div></ResponsePanel>}
      <Controls>{phase === "playing" && <Button $tone="cream" onClick={() => { if (current.type === "item") beginRecording(current.value); else advance(); }}><PlayIcon />{t.examCenter.skipPlayback}</Button>}{phase === "recording" && <Button $tone="cream" onClick={advance}><StopIcon />{t.examCenter.finishResponse}</Button>}</Controls>
    </Player>}
    {phase === "complete" && <Welcome><Kicker>{t.examCenter.practiceComplete}</Kicker><Heading>{t.examCenter.sectionFinished}</Heading><Lead>You moved through all 11 timed responses. The next production step can attach secure transcription and scoring to the new `exam_attempts` model without exposing source prompts to other learners.</Lead><div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 23 }}><Run onClick={() => void start()}><ArrowLeftIcon />{t.examCenter.runAgain}</Run><Button as={Link} href={`/admin/test-center/exams/${examSetId}`} $tone="cream"><PauseIcon />{t.examCenter.reviewMedia}</Button></div></Welcome>}
  </Stage></Shell>;
}
