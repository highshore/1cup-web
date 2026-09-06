"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  MicrophoneIcon,
  PauseCircleIcon,
  PlayIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../lib/contexts/auth_context";
import { supabase } from "../lib/supabase/client";
import { useI18n } from "../lib/i18n/I18nProvider";
import {
  SPEAKING_TEST_CATEGORIES,
  type DeployedExam,
  type DeployedExamDetail,
  type DeployedExamItem,
  type SpeakingTestAttempt,
  type SpeakingTestCategory,
  type SpeakingTestReport,
} from "../lib/features/speaking-test/types";

type Screen = "categories" | "catalog" | "test" | "scoring" | "report";
type CapturedResponse = {
  itemId: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
};
type StartedAttempt = { attemptId: string; uploadPrefix: string };

const page: CSSProperties = {
  width: "min(980px, calc(100% - 32px))",
  minHeight: "68vh",
  margin: "0 auto",
  padding: "48px 0 72px",
  color: "#303030",
};
const card: CSSProperties = {
  border: "1px solid #e3e3e3",
  borderRadius: 10,
  background: "#fff",
};
const primary: CSSProperties = {
  display: "inline-flex",
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px solid #2d2d2d",
  borderRadius: 8,
  padding: "8px 14px",
  background: "#2d2d2d",
  color: "#fff",
  font: "inherit",
  fontSize: 13,
  fontWeight: 850,
  cursor: "pointer",
};
const secondary: CSSProperties = { ...primary, border: "1px solid #dedede", background: "#fff", color: "#404040" };

function ActionButton({
  children,
  onClick,
  disabled = false,
  secondaryTone = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  secondaryTone?: boolean;
}) {
  return <button type="button" style={{ ...(secondaryTone ? secondary : primary), opacity: disabled ? 0.55 : 1, cursor: disabled ? "wait" : "pointer" }} disabled={disabled} onClick={onClick}>{children}</button>;
}

function categoryLabel(category: SpeakingTestCategory, _copy: { topic: string; toefl: string; free: string }) {
  return {
    topic: "Opic",
    toefl: "Toefl Speaking",
    free: "Free style",
  }[category];
}

function audioExtension(mimeType: string) {
  const type = mimeType.split(";")[0].toLowerCase();
  if (type === "audio/mp4") return "mp4";
  if (type === "audio/mpeg") return "mpeg";
  if (type === "audio/ogg") return "ogg";
  if (type === "audio/wav") return "wav";
  return "webm";
}

function normalizedAudioMime(mimeType: string) {
  const type = mimeType.split(";")[0].toLowerCase();
  return ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"].includes(type) ? type : "audio/webm";
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}

export default function SpeakingTestClient() {
  const { currentUser } = useAuth();
  const { locale, t } = useI18n();
  const copy = t.speakingTest.deployed;
  const [screen, setScreen] = useState<Screen>("categories");
  const [category, setCategory] = useState<SpeakingTestCategory | null>(null);
  const [tests, setTests] = useState<DeployedExam[]>([]);
  const [exam, setExam] = useState<DeployedExamDetail | null>(null);
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [recording, setRecording] = useState(false);
  const [captured, setCaptured] = useState<CapturedResponse[]>([]);
  const [report, setReport] = useState<SpeakingTestReport | null>(null);
  const [attempts, setAttempts] = useState<SpeakingTestAttempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mediaIssue, setMediaIssue] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const task = exam?.items[taskIndex] ?? null;

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    try { recorderRef.current?.stop(); } catch { /* recorder already stopped */ }
    stopTracks();
  }, [stopTracks]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => current > 1 ? current - 1 : 0);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const submitAttempt = useCallback(async (responses: CapturedResponse[]) => {
    if (!attempt || !exam) return;
    setScreen("scoring");
    setBusy(true);
    setMessage("");
    try {
      const uploaded = await Promise.all(responses.map(async (response) => {
        const mimeType = normalizedAudioMime(response.mimeType);
        const path = attempt.uploadPrefix + "/" + response.itemId + "." + audioExtension(mimeType);
        const { error } = await supabase.storage.from("speaking-test-audio").upload(path, response.blob, {
          contentType: mimeType,
          upsert: true,
        });
        if (error) throw new Error("A recorded response could not be uploaded.");
        return {
          itemId: response.itemId,
          audioPath: path,
          audioMimeType: mimeType,
          durationSeconds: response.durationSeconds,
        };
      }));
      const payload = await responseJson<{ report: SpeakingTestReport }>(await fetch("/api/speaking-test/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.attemptId, responses: uploaded }),
      }));
      setReport(payload.report);
      setAttempts((current) => [{
        id: attempt.attemptId,
        examSetId: exam.id,
        examTitle: exam.title,
        status: "completed",
        score: payload.report.overall.rawScore,
        band: payload.report.overall.band,
        cefr: payload.report.overall.cefr,
        report: payload.report,
        completedAt: new Date().toISOString(),
      }, ...current.filter((entry) => entry.id !== attempt.attemptId)]);
      setScreen("report");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.scoreFailed);
      setScreen("test");
    } finally {
      setBusy(false);
    }
  }, [attempt, copy.scoreFailed, exam]);

  const captureCurrentResponse = useCallback((activeTask: DeployedExamItem) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.onstop = () => {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1_000));
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mimeType });
      recorderRef.current = null;
      chunksRef.current = [];
      stopTracks();
      setRecording(false);
      const next = [
        ...captured.filter((response) => response.itemId !== activeTask.id),
        { itemId: activeTask.id, blob, mimeType, durationSeconds },
      ];
      setCaptured(next);
      if (!exam) return;
      if (taskIndex >= exam.items.length - 1) {
        void submitAttempt(next);
      } else {
        setTaskIndex((current) => current + 1);
      }
    };
    recorder.stop();
  }, [captured, exam, stopTracks, submitAttempt, taskIndex]);

  const startRecording = useCallback(async () => {
    if (!task || recording || recorderRef.current?.state === "recording") return;
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 24_000 } : undefined);
      streamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setSecondsLeft(task.responseSeconds);
      setRecording(true);
    } catch {
      setMessage(copy.microphoneError);
      stopTracks();
    }
  }, [copy.microphoneError, recording, stopTracks, task]);

  useEffect(() => {
    if (recording && secondsLeft === 0 && task) captureCurrentResponse(task);
  }, [captureCurrentResponse, recording, secondsLeft, task]);

  useEffect(() => {
    if (!task) return;
    setSecondsLeft(task.responseSeconds);
    setMediaIssue(false);
  }, [task]);

  const loadHistory = useCallback(async () => {
    try {
      const payload = await responseJson<{ attempts: SpeakingTestAttempt[] }>(await fetch("/api/speaking-test/history"));
      setAttempts(payload.attempts);
    } catch {
      setAttempts([]);
    }
  }, []);

  const chooseCategory = useCallback(async (nextCategory: SpeakingTestCategory) => {
    setCategory(nextCategory);
    setScreen("catalog");
    setBusy(true);
    setMessage("");
    try {
      const payload = await responseJson<{ tests: DeployedExam[] }>(await fetch("/api/speaking-test/catalog?category=" + nextCategory));
      setTests(payload.tests);
      void loadHistory();
    } catch (error) {
      setTests([]);
      setMessage(error instanceof Error ? error.message : "Tests are temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }, [loadHistory]);

  const openTest = useCallback(async (examSetId: string) => {
    setBusy(true);
    setMessage("");
    try {
      if (!currentUser) throw new Error(copy.signInRequired);
      const detail = await responseJson<DeployedExamDetail>(await fetch("/api/speaking-test/exams/" + examSetId));
      const started = await responseJson<StartedAttempt>(await fetch("/api/speaking-test/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examSetId }),
      }));
      setExam(detail);
      setAttempt(started);
      setTaskIndex(0);
      setCaptured([]);
      setReport(null);
      setScreen("test");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.signInRequired);
    } finally {
      setBusy(false);
    }
  }, [copy.signInRequired, currentUser]);

  const returnToCategories = () => {
    try { recorderRef.current?.stop(); } catch { /* no active recorder */ }
    stopTracks();
    setRecording(false);
    setExam(null);
    setAttempt(null);
    setReport(null);
    setMessage("");
    setScreen("categories");
  };

  if (screen === "categories") {
    return <main style={page}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
        {SPEAKING_TEST_CATEGORIES.map((item) => <button key={item} type="button" onClick={() => void chooseCategory(item)} style={{ ...card, minHeight: 178, padding: 20, color: "#303030", cursor: "pointer", font: "inherit", fontSize: "clamp(23px, 4vw, 34px)", fontWeight: 720, letterSpacing: "-0.055em", textAlign: "left" }}>{categoryLabel(item, copy)}</button>)}
      </div>
    </main>;
  }

  if (screen === "catalog") {
    return <main style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 26 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 46px)", letterSpacing: "-0.06em" }}>{category ? categoryLabel(category, copy) : ""} {copy.tests}</h1>
        <ActionButton secondaryTone onClick={returnToCategories}><ArrowLeftIcon width={17} />{copy.back}</ActionButton>
      </div>
      {message && <p style={{ margin: "0 0 16px", color: "#a63322", fontWeight: 750 }}>{message}</p>}
      {busy ? <p>Loading…</p> : tests.length === 0 ? <div style={{ ...card, padding: 24 }}>{copy.noTests}</div> : <div style={{ display: "grid", gap: 14 }}>{tests.map((test) => <button key={test.id} type="button" disabled={busy} onClick={() => void openTest(test.id)} style={{ ...card, display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 16, padding: 20, color: "#050505", font: "inherit", textAlign: "left", cursor: "pointer" }}><span><strong style={{ display: "block", fontSize: 19 }}>{test.title}</strong><span style={{ display: "block", marginTop: 7, color: "rgba(5,5,5,.64)", fontSize: 12 }}>{test.listenRepeatCount} {copy.listenRepeat} · {test.interviewCount} {copy.interview}</span></span><PlayIcon width={23} /></button>)}</div>}
      <section style={{ marginTop: 44 }}>
        <h2 style={{ fontSize: 20, letterSpacing: "-0.04em" }}>{copy.savedScores}</h2>
        {attempts.length === 0 ? <p style={{ color: "rgba(5,5,5,.62)" }}>{copy.noSavedScores}</p> : <div style={{ display: "grid", gap: 9 }}>{attempts.filter((entry) => entry.report).map((entry) => <button type="button" key={entry.id} onClick={() => { setReport(entry.report); setExam(null); setScreen("report"); }} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 13, color: "#050505", font: "inherit", cursor: "pointer", textAlign: "left" }}><span><strong>{entry.examTitle}</strong><span style={{ display: "block", marginTop: 3, color: "rgba(5,5,5,.6)", fontSize: 11 }}>{entry.completedAt ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium" }).format(new Date(entry.completedAt)) : ""}</span></span><strong>{entry.score}/55 · {entry.band}</strong></button>)}</div>}
      </section>
    </main>;
  }

  if (screen === "scoring") {
    return <main style={{ ...page, display: "grid", placeItems: "center" }}><div style={{ textAlign: "center" }}><ArrowPathIcon width={34} style={{ animation: "spin 1s linear infinite" }} /><h1 style={{ fontSize: 26 }}>{copy.scoring}</h1><p style={{ color: "rgba(5,5,5,.62)" }}>{copy.audioSaved}</p></div></main>;
  }

  if (screen === "report" && report) {
    return <main style={page}>
      <div style={{ ...card, padding: "clamp(20px, 5vw, 42px)", background: "#fff8dc" }}>
        <p style={{ margin: 0, color: "#c65b36", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>{copy.reportTitle}</p>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "end", gap: 18, marginTop: 12 }}><div><h1 style={{ margin: 0, fontSize: "clamp(38px, 7vw, 64px)", letterSpacing: "-0.07em" }}>{report.overall.band} · {report.overall.cefr}</h1><p style={{ maxWidth: 590, margin: "10px 0 0", lineHeight: 1.55 }}>{report.overall.summary}</p></div><strong style={{ fontSize: 23 }}>{copy.rawScore} {report.overall.rawScore}/55</strong></div>
        <p style={{ margin: "20px 0 0", lineHeight: 1.55 }}><b>{copy.scoreRationale}:</b> {report.overall.rationale}</p>
      </div>
      <section style={{ marginTop: 34 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>{report.taskScores.map((score) => <div key={score.itemId} style={{ ...card, padding: 17 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{copy.task} {score.taskNumber} · {score.module === "listen_repeat" ? copy.listenRepeat : copy.interview}</strong><strong>{score.score}/5</strong></div><p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.52 }}><b>{copy.scoreRationale}:</b> {score.rationale}</p><p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.52 }}><b>{copy.evidence}:</b> {score.evidence}</p><p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.52 }}><b>{copy.feedback}:</b> {score.feedback}</p><div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>{Object.entries(score.rubricScores).map(([name, value]) => <span key={name} style={{ border: "1px solid #050505", borderRadius: 999, padding: "3px 7px", fontSize: 10, fontWeight: 800 }}>{name} {value.score}/5</span>)}</div></div>)}</div></section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 28 }}><div style={{ ...card, padding: 18 }}><h2 style={{ marginTop: 0, fontSize: 19 }}>{copy.strengths}</h2><ul>{report.strengths.map((item) => <li key={item} style={{ marginTop: 8 }}>{item}</li>)}</ul></div><div style={{ ...card, padding: 18 }}><h2 style={{ marginTop: 0, fontSize: 19 }}>{copy.focusAreas}</h2><ul>{report.focusAreas.map((item) => <li key={item} style={{ marginTop: 8 }}>{item}</li>)}</ul></div></section>
      <p style={{ marginTop: 22, color: "rgba(5,5,5,.62)", fontSize: 12, lineHeight: 1.5 }}>{copy.reportNote}</p>
      <ActionButton onClick={returnToCategories}><ArrowLeftIcon width={17} />{copy.takeAnother}</ActionButton>
    </main>;
  }

  if (!exam || !task) return <main style={page}><ActionButton onClick={returnToCategories}>{copy.back}</ActionButton></main>;

  const progress = Math.round(((taskIndex + 1) / exam.items.length) * 100);
  return <main style={page}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 16 }}><span style={{ color: "rgba(5,5,5,.6)", fontSize: 12, fontWeight: 800 }}>{copy.task} {taskIndex + 1} {copy.of} {exam.items.length}</span><strong style={{ fontSize: 22 }}>{recording ? secondsLeft + " " + copy.seconds : ""}</strong></div>
    <div style={{ height: 6, overflow: "hidden", borderRadius: 99, background: "#e8e8e8", marginBottom: 20 }}><div style={{ width: progress + "%", height: "100%", borderRadius: 99, background: "#df6639" }} /></div>
    <div style={{ ...card, overflow: "hidden" }}>
      <div style={{ minHeight: 320, position: "relative", display: "grid", placeItems: "center", background: "#fafafa" }}>
        {task.module === "listen_repeat" && task.imageUrl && <Image src={task.imageUrl} alt="" width={900} height={520} sizes="(max-width: 980px) 100vw, 980px" style={{ width: "100%", height: "auto", objectFit: "cover" }} />}
        {task.module === "listen_repeat" && !task.imageUrl && <SpeakerWaveIcon width={58} />}
        {task.module === "interview" && task.videoUrl && <video key={task.id} autoPlay playsInline preload="auto" src={task.videoUrl} onEnded={() => void startRecording()} onError={() => setMediaIssue(true)} style={{ width: "100%", maxHeight: 520, objectFit: "cover" }} />}
        {task.module === "interview" && !task.videoUrl && <SpeakerWaveIcon width={58} />}
      </div>
      {task.module === "listen_repeat" && task.audioUrl && <audio key={task.id} autoPlay preload="auto" src={task.audioUrl} onEnded={() => void startRecording()} onError={() => setMediaIssue(true)} />}
      <div style={{ padding: "20px clamp(18px, 4vw, 32px) 26px" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(25px, 4vw, 37px)", letterSpacing: "-.055em" }}>{task.module === "listen_repeat" ? copy.listenRepeat : task.prompt}</h1>
        {message && <p style={{ margin: "12px 0 0", color: "#a63322", fontWeight: 750 }}>{message}</p>}
        {mediaIssue && <p style={{ margin: "12px 0 0", color: "#a63322", fontWeight: 750 }}>{copy.mediaError}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 22 }}>
          {!recording ? <ActionButton onClick={() => void startRecording()}><MicrophoneIcon width={18} />{copy.record}</ActionButton> : <ActionButton secondaryTone onClick={() => captureCurrentResponse(task)}><PauseCircleIcon width={18} />{copy.finishResponse}</ActionButton>}
          {recording && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#d43624" }} />{copy.recording}</span>}
        </div>
        <p style={{ margin: "15px 0 0", color: "rgba(5,5,5,.6)", fontSize: 11, lineHeight: 1.5 }}>{copy.audioSaved}</p>
      </div>
    </div>
    {message && captured.length === exam.items.length && <div style={{ marginTop: 18 }}><ActionButton onClick={() => void submitAttempt(captured)}><ArrowPathIcon width={17} />{copy.scoreAgain}</ActionButton></div>}
  </main>;
}
