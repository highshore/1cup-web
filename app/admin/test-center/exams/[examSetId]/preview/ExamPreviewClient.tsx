"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, MicrophoneIcon, PauseIcon, PlayIcon, SpeakerWaveIcon, StopIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../../../../../lib/contexts/auth_context";
import { loadExamSet } from "../../../../../lib/features/exam/services/exam_admin_client";
import type { ExamItem, ExamNarration, ExamSetDetail } from "../../../../../lib/features/exam/types";
import { useI18n } from "../../../../../lib/i18n/I18nProvider";
import { Button, ExamAvatar, GardenScene, Loading, Notice } from "../../../exam_ui";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#fff8dc] text-[#050505]">{children}</main>;
}

function Topbar({ children }: { children: React.ReactNode }) {
  return <header className="mx-auto grid max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-[14px] border-b-2 border-[#050505] px-5 py-4 max-[700px]:grid-cols-[1fr_auto]">{children}</header>;
}

function Brand(props: ComponentProps<typeof Link>) {
  return <Link className="text-[13px] font-black text-[#050505] no-underline" {...props} />;
}

function TopCenter({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`text-center text-[11px] font-extrabold text-[rgba(5,5,5,.66)] max-[700px]:hidden ${className}`}>{children}</div>;
}

function Exit(props: ComponentProps<typeof Link>) {
  return <Link className="justify-self-end text-[11px] font-[850] text-[#050505] underline underline-offset-[3px]" {...props} />;
}

function Stage({ children }: { children: React.ReactNode }) {
  return <section className="grid min-h-[calc(100vh-67px)] place-items-center px-5 pb-[54px] pt-6">{children}</section>;
}

function Welcome({ children }: { children: React.ReactNode }) {
  return <div className="w-[min(100%,630px)] rounded-2xl border-2 border-[#050505] bg-white p-[clamp(22px,5vw,42px)] shadow-[7px_7px_0_#f47a4a]">{children}</div>;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mb-2 text-[11px] font-black uppercase tracking-[.12em] text-[#c84932]">{children}</p>;
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h1 className="m-0 text-[clamp(29px,6vw,50px)] font-black leading-[1.02] tracking-[-.06em]">{children}</h1>;
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mt-[14px] max-w-[540px] text-[14px] leading-[1.65] text-[rgba(5,5,5,.67)]">{children}</p>;
}

function Run(props: ComponentProps<typeof Button>) {
  return <Button sizeClassName="min-h-[49px] px-[17px] py-[11px] text-[13px] shadow-[3px_3px_0_#050505]" {...props} />;
}

const promptSurfaceClass = "mt-5 overflow-hidden rounded-[14px] border-2 border-[#050505] bg-white shadow-[5px_5px_0_#050505]";

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
    {phase === "welcome" && <Welcome><Kicker>{t.examCenter.timedRun}</Kicker><Heading>{examSet.title}</Heading><Lead>One uninterrupted flow: Listen and Repeat comes first, followed by Take an Interview. Every prompt plays once. A microphone recording is kept only in this browser for this preview session.</Lead><dl className="my-6 grid grid-cols-3 gap-0 border-b-2 border-t-2 border-[#050505] [&_dd]:m-0 [&_dd]:mt-1 [&_dd]:text-[15px] [&_dd]:font-black [&_dt]:text-[10px] [&_dt]:font-extrabold [&_dt]:uppercase [&_dt]:text-[rgba(5,5,5,.62)] [&_div:not(:last-child)]:border-r [&_div:not(:last-child)]:border-[rgba(5,5,5,.35)] [&_div]:px-[9px] [&_div]:py-[13px]"><div><dt>{t.examCenter.responses}</dt><dd>11</dd></div><div><dt>{t.examCenter.preparation}</dt><dd>{t.examCenter.none}</dd></div><div><dt>{t.examCenter.recording}</dt><dd>{t.examCenter.timed}</dd></div></dl><Run onClick={() => void start()}><MicrophoneIcon />{t.examCenter.beginSpeaking}</Run></Welcome>}
    {(phase === "playing" || phase === "recording") && current && <div className="w-[min(100%,810px)]"><div className="h-2 overflow-hidden border-[1.5px] border-[#050505] bg-white"><div className="h-full bg-[#f47a4a] [transition:width_.35s_ease]" style={{ width: `${Math.max(0, Math.min(((index + 1) / sequence.length) * 100, 100))}%` }} /></div><div className="mt-[25px] flex items-start justify-between gap-[18px] border-b-2 border-[#050505] pb-[15px]"><div><Kicker>{current.type === "narration" ? "Speaking directions" : current.value.module === "listen_repeat" ? "Listen and Repeat" : "Take an Interview"}</Kicker><h1 className="m-0 text-[clamp(26px,4.5vw,41px)] font-black leading-[1.06] tracking-[-.055em]">{current.type === "narration" ? current.value.label : `${current.value.label} of ${current.value.module === "listen_repeat" ? 7 : 4}`}</h1></div><div className="flex-none rounded-full border-2 border-[#050505] bg-white px-[11px] py-2 text-[11px] font-black text-[#050505]">{current.type === "item" ? `${responsePosition} / 11` : "Directions"}</div></div>
      {current.type === "narration" ? <div className={`${promptSurfaceClass} grid min-h-[270px] place-items-center p-[27px] text-center`}><div><SpeakerWaveIcon style={{ width: 34, height: 34, color: "#f47a4a", marginBottom: 15 }} /><p className="m-0 max-w-[620px] text-[clamp(18px,3vw,26px)] font-extrabold leading-[1.5] text-[#050505]">{current.value.script}</p><p style={{ margin: "17px 0 0", color: "rgba(5,5,5,.59)", fontSize: 11, fontWeight: 750 }}>{phase === "playing" ? "Playing browser voice…" : ""}</p></div></div> : <div className={promptSurfaceClass}>{current.value.module === "listen_repeat" ? <div className="min-h-[310px] bg-[#fff8dc] p-[18px]"><GardenScene target={current.value.visual_target} /></div> : <div className={`grid min-h-[310px] place-items-center p-5 [transition:background_.2s_ease] ${phase === "recording" ? "bg-[#d8ead2]" : "bg-[#fff8dc]"}`}><ExamAvatar interviewer={examSet.interviewer} large /><p style={{ margin: "13px 0 0", color: "rgba(5,5,5,.67)", fontSize: 12, fontWeight: 850 }}>{phase === "recording" ? `${examSet.interviewer.name} is listening` : `${examSet.interviewer.name} is asking a question`}</p></div>}<p className="mx-[18px] mb-[18px] mt-[15px] text-center text-[12px] font-[650] leading-[1.55] text-[rgba(5,5,5,.66)]">{phase === "playing" ? "Listen carefully. The prompt will play once, then recording starts immediately." : "Speak now. The recording stops automatically when time runs out."}</p></div>}
      {current.type === "item" && <div className="mt-5 flex items-center justify-between gap-[15px] border-b-2 border-t-2 border-[#050505] py-4 text-[#050505]"><div className={`signal grid h-[42px] w-[42px] flex-none place-items-center rounded-full border-2 border-[#050505] ${phase === "recording" ? "bg-[#f47a4a]" : "bg-white"}`}>{phase === "recording" ? <MicrophoneIcon /> : <SpeakerWaveIcon />}</div><div><strong className="block text-[12px] font-black">{phase === "recording" ? "Recording response" : "Prompt playing"}</strong><span className="mt-[3px] block text-[11px] font-[650] leading-[1.4] text-[rgba(5,5,5,.62)]">{phase === "recording" ? "Use the remaining time to give a complete answer." : "Recording begins automatically after the voice finishes."}</span></div><div className="timer ml-auto text-[29px] font-black tabular-nums tracking-[-.06em]">{phase === "recording" ? timer(seconds) : "…"}</div></div>}
      <div className="mt-[17px] flex flex-wrap justify-end gap-[9px]">{phase === "playing" && <Button $tone="cream" onClick={() => { if (current.type === "item") beginRecording(current.value); else advance(); }}><PlayIcon />{t.examCenter.skipPlayback}</Button>}{phase === "recording" && <Button $tone="cream" onClick={advance}><StopIcon />{t.examCenter.finishResponse}</Button>}</div>
    </div>}
    {phase === "complete" && <Welcome><Kicker>{t.examCenter.practiceComplete}</Kicker><Heading>{t.examCenter.sectionFinished}</Heading><Lead>You moved through all 11 timed responses. The next production step can attach secure transcription and scoring to the new `exam_attempts` model without exposing source prompts to other learners.</Lead><div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 23 }}><Run onClick={() => void start()}><ArrowLeftIcon />{t.examCenter.runAgain}</Run><Button as={Link} href={`/admin/test-center/exams/${examSetId}`} $tone="cream"><PauseIcon />{t.examCenter.reviewMedia}</Button></div></Welcome>}
  </Stage></Shell>;
}
