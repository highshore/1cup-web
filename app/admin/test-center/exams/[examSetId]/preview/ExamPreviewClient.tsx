"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGlobalStyle } from "styled-components";

import { useAuth } from "../../../../../lib/contexts/auth_context";
import { loadExamSet } from "../../../../../lib/features/exam/services/exam_admin_client";
import type {
  ExamItem,
  ExamNarration,
  ExamSetDetail,
} from "../../../../../lib/features/exam/types";
import { useI18n } from "../../../../../lib/i18n/I18nProvider";

type SpeakingState =
  | "welcome"
  | "section_intro"
  | "listen_repeat_intro"
  | "listen_repeat_scenario"
  | "listen_repeat_playing"
  | "listen_repeat_recording"
  | "interview_intro"
  | "interview_scenario"
  | "interview_question_playing"
  | "interview_recording"
  | "complete";
type PlaybackState = "idle" | "playing" | "blocked";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const NARRATION_STAGE: Partial<
  Record<SpeakingState, ExamNarration["cue_key"]>
> = {
  section_intro: "section_intro",
  listen_repeat_intro: "listen_repeat_instructions",
  listen_repeat_scenario: "listen_repeat_scenario",
  interview_intro: "interview_instructions",
  interview_scenario: "interview_scenario",
};

const PreviewStyles = createGlobalStyle`
  .speaking-preview { display:flex; min-height:100dvh; height:100dvh; overflow:hidden; background:transparent; color:#211712; }
  .preview-topbar { display:grid; grid-template-columns:minmax(130px,1fr) auto minmax(130px,1fr); gap:18px; align-items:center; min-height:50px; padding:0 30px; border-bottom:4px solid #f47a4a; background:rgba(255,255,255,.84); box-shadow:0 1px 5px rgba(54,29,18,.13); backdrop-filter:blur(12px); }
  .preview-brand { color:#b74625; font-size:14px; font-weight:700; text-decoration:none; }.preview-topbar-center { display:flex; align-items:center; color:#6b5b54; font-size:12px; }.preview-divider { height:14px; margin:0 12px; border-left:1px solid #d8c9c2; }.preview-exit { justify-self:end; color:#4e3b34; font-size:12px; text-decoration:underline; text-underline-offset:3px; }
  .preview-welcome,.preview-loading,.preview-message { display:grid; min-height:0; flex:1; place-items:center; box-sizing:border-box; padding:clamp(20px,5vh,42px) 24px; }.preview-welcome-card,.preview-message { width:min(640px,100%); padding:0; border:0; background:transparent; box-shadow:none; text-align:center; }.preview-kicker { margin:0; color:#a34d37; font-size:10px; font-weight:800; letter-spacing:1px; }.preview-welcome-card h1,.preview-message h1 { margin:12px 0 14px; color:#211712; font-size:clamp(32px,5vw,48px); font-weight:650; letter-spacing:-1.8px; line-height:1.02; }.preview-lead,.preview-message > p:last-of-type { max-width:520px; margin:0 auto; color:#685951; font-size:15px; line-height:1.65; }
  .preview-overview { display:grid; grid-template-columns:repeat(3,1fr); gap:0; width:min(500px,100%); margin:34px auto; border:0; background:transparent; text-align:center; }.preview-overview div { padding:0 18px; background:transparent; }.preview-overview div + div { border-left:1px solid #dfd5cf; }.preview-overview dt { color:#89766e; font-size:10px; }.preview-overview dd { margin:6px 0 0; color:#3b2720; font-size:15px; font-weight:750; }.preview-instructions { max-width:500px; margin:0 auto; padding:0; border:0; background:transparent; color:#604f49; text-align:center; }.preview-instructions strong { font-size:13px; }.preview-instructions p { margin:5px 0 0; font-size:12px; line-height:1.5; }
  .preview-primary,.preview-secondary { min-height:42px; border:1px solid; font:inherit; font-weight:700; transition:background .15s,color .15s,border-color .15s; cursor:pointer; }.preview-primary { border-color:#a63f25; background:#d25431; color:#fff; }.preview-primary:hover { border-color:#83311d; background:#b94627; }.preview-welcome-card > .preview-primary { margin-top:30px; padding:0 26px; }.preview-secondary { padding:0 16px; border-color:#c8b6ae; background:transparent; color:#503a31; }.preview-secondary:hover { border-color:#c84932; color:#a63f25; }
  .preview-task-types { display:grid; gap:0; width:min(560px,100%); margin:30px auto 0; border:0; background:transparent; text-align:left; }.preview-task-types div { display:grid; grid-template-columns:155px 1fr; background:transparent; border-top:1px solid #e5d9d3; }.preview-task-types div:last-child { border-bottom:1px solid #e5d9d3; }.preview-task-types dt { padding:13px 0; border:0; color:#9a503d; font-size:11px; font-weight:800; }.preview-task-types dd { margin:0; padding:13px 0; color:#66534b; font-size:12px; line-height:1.45; }.preview-audio-status { display:inline-flex; align-items:center; gap:8px; margin-top:28px; color:#6a554a; font-size:12px; }.preview-audio-status > span { width:8px; height:8px; border-radius:999px; background:#d8c7c0; }.preview-audio-status > span.is-playing { background:#d25431; box-shadow:0 0 0 4px rgba(210,84,49,.1); }.preview-error { margin:18px 0 0; color:#aa3625; font-size:12px; line-height:1.45; }
  .preview-task-shell { display:grid; width:min(920px,calc(100% - 48px)); min-height:0; flex:1; align-content:center; margin:0 auto; padding:24px 0; box-sizing:border-box; transform:translateY(clamp(-52px,-6vh,-24px)); }.preview-progress { height:6px; overflow:hidden; border-radius:10px; background:#e4d6cf; }.preview-progress span { display:block; height:100%; background:#d25431; transition:width .25s ease; }.preview-task-heading { display:flex; align-items:end; justify-content:space-between; gap:20px; padding:25px 4px 21px; }.preview-task-heading h1 { margin:5px 0 0; color:#251914; font-size:clamp(27px,4vw,38px); font-weight:650; letter-spacing:-1.2px; }.preview-task-count { display:flex; align-items:baseline; gap:5px; color:#8e7d75; }.preview-task-count strong { color:#c84932; font-size:28px; }.preview-task-count span { font-size:12px; }
  .preview-prompt-area { min-height:355px; padding:0; border:0; background:transparent; box-shadow:none; }.preview-segmentation { width:min(710px,100%); margin:0 auto; }.preview-segmentation img { display:block; width:100%; height:auto; border:1px solid #d1bfb6; background:#e7ded9; }.preview-prompt-copy { max-width:650px; margin:20px auto 0; color:#5f4c44; font-size:14px; line-height:1.5; text-align:center; }.preview-interviewer-stage { position:relative; width:min(640px,100%); margin:4px auto 0; overflow:hidden; aspect-ratio:16 / 9; background:#eee3de; }.preview-interviewer-stage video { display:block; width:100%; height:100%; object-fit:cover; }.preview-interviewer-stage video.is-playing { animation:preview-video-active 8s linear both; } @keyframes preview-video-active { from { transform:scale(1); } to { transform:scale(1.025); } }
  .preview-response-panel { display:flex; gap:25px; align-items:center; justify-content:space-between; margin-top:20px; padding:17px 0; border:solid #decfc7; border-width:1px 0; background:transparent; }.preview-response-panel > div:first-child { display:grid; gap:3px; }.preview-response-panel strong { color:#3c2820; font-size:16px; }.preview-response-panel span { color:#84716a; font-size:11px; }.preview-countdown { color:#c84932 !important; font-size:27px !important; letter-spacing:.5px; }.preview-recording-indicator { display:flex !important; align-items:center; gap:8px; }.preview-recording-indicator > span { width:9px; height:9px; border-radius:999px; background:#d25431; }.preview-volume-meter { display:flex; align-items:center; gap:8px; min-width:118px; }.preview-volume-bars { display:flex; align-items:center; gap:3px; height:22px; }.preview-volume-bars i { display:block; width:4px; border-radius:999px; background:#dfd1cb; transition:background .09s ease,transform .09s ease; }.preview-volume-bars i:nth-child(1) { height:5px; }.preview-volume-bars i:nth-child(2) { height:8px; }.preview-volume-bars i:nth-child(3) { height:11px; }.preview-volume-bars i:nth-child(4) { height:14px; }.preview-volume-bars i:nth-child(5) { height:17px; }.preview-volume-bars i:nth-child(6) { height:20px; }.preview-volume-bars i.is-active { background:#d25431; transform:scaleY(1.08); }.preview-volume-meter > span { color:#8b756c; font-size:10px; font-weight:700; letter-spacing:.35px; text-transform:uppercase; }.preview-response-panel.is-recording { border-color:#d25431; }.preview-playback-help { display:flex; align-items:center; justify-content:space-between; gap:15px; margin-top:15px; padding:13px 0; border:solid #e8c6bb; border-width:1px 0; background:transparent; }.preview-playback-help p { margin:0; color:#814331; font-size:12px; }.preview-complete-actions { display:flex; justify-content:center; gap:10px; margin-top:28px; }.preview-complete-actions .preview-primary { padding:0 18px; }.preview-section-intro { transform:translateY(clamp(-44px,-5vh,-20px)); }.preview-narration-actions { display:flex; justify-content:center; margin-top:28px; padding-top:26px; border-top:1px solid #dfd5cf; }.preview-narration-actions .preview-primary { min-width:148px; margin:0; padding:0 24px; }.preview-primary:disabled { border-color:#d4c5bd; background:#ded3ce; color:#fff; cursor:not-allowed; }.preview-link-button { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }.preview-loading { color:#705e55; font-size:14px; }.preview-message { place-content:center; text-align:center; }.preview-message a { color:#bd4b2c; font-weight:700; }
  @media (max-width:720px) { .preview-topbar { grid-template-columns:1fr auto; min-height:56px; padding:0 16px; }.preview-topbar-center { display:none; }.preview-welcome,.preview-loading,.preview-message { padding:20px 14px; }.preview-welcome-card,.preview-message { padding:30px 21px; }.preview-overview,.preview-task-types { grid-template-columns:1fr; }.preview-task-types div { grid-template-columns:1fr; }.preview-task-types dt { border-right:0; border-bottom:1px solid #e5d9d3; }.preview-task-shell { width:min(100% - 28px,920px); margin:0 auto; padding:16px 0; }.preview-prompt-area { min-height:0; padding:13px; }.preview-task-heading { padding-inline:0; }.preview-response-panel { align-items:stretch; flex-direction:column; }.preview-response-panel.is-recording > span { margin-left:0; }.preview-playback-help { align-items:stretch; flex-direction:column; }.preview-complete-actions { align-items:stretch; flex-direction:column; }.preview-complete-actions > * { width:100%; min-height:42px; } }
  /* Assessment chrome: intentionally separate from the site navbar. */
  .speaking-preview { flex-direction:column; color:#17201f; }.preview-assessment-bar { display:grid; flex:none; min-height:28px; place-items:center; background:#0d7b80; color:#fff; font-size:10px; font-weight:800; letter-spacing:.7px; line-height:1; }.preview-welcome-card,.preview-message { width:min(600px,100%); }.preview-kicker { color:#0d7075; }.preview-welcome-card h1,.preview-message h1 { color:#17201f; font-size:clamp(29px,4.3vw,43px); letter-spacing:-1.55px; line-height:1.04; }.preview-lead,.preview-message > p:last-of-type { color:#586565; line-height:1.6; }
  .preview-overview { width:min(470px,100%); margin:31px auto; border:solid #d5ddda; border-width:1px 0; }.preview-overview div { padding:13px 15px; }.preview-overview div + div { border-color:#d5ddda; }.preview-overview dt { color:#72807d; }.preview-overview dd { color:#273230; font-size:14px; }.preview-instructions { max-width:470px; color:#586565; }.preview-instructions strong { color:#26302e; font-size:12px; }
  .preview-primary,.preview-secondary { min-height:38px; font-size:12px; }.preview-primary { border-color:#0d7277; background:#0d7b80; }.preview-primary:hover { border-color:#095e62; background:#096b70; }.preview-welcome-card > .preview-primary { min-width:182px; margin-top:27px; padding:0 20px; }.preview-secondary { border-color:#aebbb8; color:#3f4e4c; }.preview-secondary:hover { border-color:#0d7b80; color:#0d7075; }
  .preview-task-types { width:min(520px,100%); margin:27px auto 0; }.preview-task-types div { grid-template-columns:145px 1fr; border-color:#dce3e0; }.preview-task-types div:last-child { border-color:#dce3e0; }.preview-task-types dt { padding:12px 0; color:#1b6264; }.preview-task-types dd { padding:12px 0; color:#5d6968; }.preview-audio-status { margin-top:24px; color:#657270; font-size:11px; }.preview-audio-status > span { background:#c9d1cf; }.preview-audio-status > span.is-playing { background:#0d7b80; box-shadow:0 0 0 4px rgba(13,123,128,.12); }
  .preview-task-shell { width:min(760px,calc(100% - 48px)); padding:14px 0 24px; transform:translateY(clamp(-40px,-4vh,-16px)); }.preview-progress { height:4px; border-radius:0; background:#dce4e1; }.preview-progress span { background:#10a062; }.preview-task-heading { display:block; padding:20px 0 14px; text-align:center; }.preview-task-heading h1 { margin:5px 0 0; color:#1a2624; font-size:clamp(18px,2.35vw,23px); letter-spacing:-.5px; line-height:1.2; }
  .preview-prompt-area { display:grid; min-height:0; justify-items:center; padding:0; }.preview-segmentation { width:min(510px,100%); margin:0; }.preview-segmentation img { max-height:40dvh; border-color:#b8c5c1; background:#e6ece9; object-fit:contain; }.preview-interviewer-stage { width:min(560px,100%); max-height:40dvh; margin:0; background:#e7edeb; }.preview-interviewer-stage video.is-playing { animation:preview-video-active 8s linear both; }
  .preview-response-panel { display:grid; width:min(208px,100%); gap:0; align-items:stretch; justify-content:normal; margin:18px auto 0; padding:0; overflow:hidden; border:1px solid #b9c4c1; background:rgba(255,255,255,.76); text-align:center; }.preview-response-label { margin:0; padding:6px 8px 5px; border-bottom:1px solid #cbd3d0; background:#e3e6e4; color:#35413f; font-size:8px; font-weight:800; letter-spacing:.35px; text-transform:uppercase; }.preview-response-readout { display:flex; min-height:32px; align-items:center; justify-content:center; gap:7px; padding:5px 10px; }.preview-response-readout strong { color:#1e2d2b; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:15px; font-weight:500; letter-spacing:.2px; }.preview-countdown { color:#1e2d2b !important; font-size:15px !important; }.preview-response-dot { display:inline-block; flex:none; width:10px; height:10px; border:1px solid #8bb6b5; border-radius:50%; }.preview-response-dot.is-recording { border-color:#13a464; background:#13a464; box-shadow:0 0 0 3px rgba(19,164,100,.13); }.preview-volume-meter { justify-content:center; min-height:26px; padding:4px 8px; border-top:1px solid #e0e5e3; }.preview-volume-bars { gap:2px; height:15px; }.preview-volume-bars i { width:3px; background:#d5dedb; }.preview-volume-bars i:nth-child(1) { height:4px; }.preview-volume-bars i:nth-child(2) { height:6px; }.preview-volume-bars i:nth-child(3) { height:8px; }.preview-volume-bars i:nth-child(4) { height:10px; }.preview-volume-bars i:nth-child(5) { height:12px; }.preview-volume-bars i:nth-child(6) { height:14px; }.preview-volume-bars i.is-active { background:#13a464; }.preview-volume-meter > span { color:#65716f; font-size:9px; }.preview-response-panel.is-recording { border-color:#7aaf9a; }
  .preview-playback-help { justify-content:center; gap:11px; margin-top:13px; padding-top:12px; border-color:#dbe3e0; }.preview-playback-help p { color:#6c5750; font-size:11px; }.preview-section-intro { transform:translateY(clamp(-28px,-3vh,-12px)); }.preview-narration-actions { margin-top:24px; padding-top:0; border-top:0; }.preview-narration-actions .preview-primary { min-width:128px; padding:0 19px; }.preview-primary:disabled { border-color:#d5dcda; background:#dfe5e3; }.preview-message a { color:#0d7075; }
  @media (max-width:720px) { .speaking-preview { overflow-y:auto; }.preview-assessment-bar { min-height:26px; }.preview-welcome,.preview-loading,.preview-message { min-height:calc(100dvh - 26px); padding:26px 18px; }.preview-welcome-card,.preview-message { padding:0; }.preview-overview { margin:25px auto; }.preview-task-types div { grid-template-columns:1fr; }.preview-task-types dt { padding-bottom:4px; border:0; }.preview-task-types dd { padding-top:4px; }.preview-task-shell { width:min(100% - 28px,760px); padding:10px 0 20px; transform:none; }.preview-task-heading { padding:16px 0 12px; }.preview-segmentation img,.preview-interviewer-stage { max-height:36dvh; }.preview-response-panel { align-items:normal; flex-direction:initial; margin-top:14px; }.preview-playback-help { align-items:stretch; flex-direction:column; } }
`;

function responseTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function isRecordingState(stage: SpeakingState) {
  return stage === "listen_repeat_recording" || stage === "interview_recording";
}
function narrationScreenCopy(id: ExamNarration["cue_key"]) {
  if (id === "section_intro")
    return { eyebrow: "SPEAKING SECTION", title: "Speaking" };
  if (id === "listen_repeat_instructions")
    return { eyebrow: "TASK 1 OF 2", title: "Listen and Repeat" };
  if (id === "listen_repeat_scenario")
    return { eyebrow: "TASK 1 SCENARIO", title: "Your situation" };
  if (id === "interview_instructions")
    return { eyebrow: "TASK 2 OF 2", title: "Take an Interview" };
  return { eyebrow: "TASK 2 SCENARIO", title: "Your interview" };
}
function isReadyForPreview(examSet: ExamSetDetail) {
  return (
    examSet.narration.length === 5 &&
    examSet.narration.every(
      (cue) => cue.media_status === "ready" && cue.audio_url,
    ) &&
    examSet.items.length === 11 &&
    examSet.items.every((item) =>
      item.module === "listen_repeat"
        ? item.audio_status === "ready" &&
          item.visual_status === "ready" &&
          item.audio_url &&
          item.image_url
        : item.video_status === "ready" && item.video_url,
    ) &&
    Boolean(examSet.interviewer.video_url)
  );
}
function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export default function ExamPreviewClient({
  examSetId,
}: {
  examSetId: string;
}) {
  const router = useRouter();
  const { currentUser, accountStatus, isLoading } = useAuth();
  const { t } = useI18n();
  const [examSet, setExamSet] = useState<ExamSetDetail | null>(null);
  const [stage, setStage] = useState<SpeakingState>("welcome");
  const [responseIndex, setResponseIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [narrationComplete, setNarrationComplete] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [loadedVisualItemId, setLoadedVisualItemId] = useState<string | null>(
    null,
  );
  const [microphoneError, setMicrophoneError] = useState("");
  const [loadError, setLoadError] = useState("");
  const narrationAudioRef = useRef<HTMLAudioElement>(null);
  const sentenceAudioRef = useRef<HTMLAudioElement>(null);
  const questionVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const transitionRef = useRef<number | null>(null);
  const isTransitioningRef = useRef(false);
  const meterContextRef = useRef<AudioContext | null>(null);
  const meterFrameRef = useRef<number | null>(null);

  const stopInputMeter = useCallback(() => {
    if (meterFrameRef.current !== null)
      cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null;
    void meterContextRef.current?.close();
    meterContextRef.current = null;
    setInputLevel(0);
  }, []);

  const startInputMeter = useCallback(
    async (stream: MediaStream) => {
      stopInputMeter();
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      context.createMediaStreamSource(stream).connect(analyser);
      const values = new Uint8Array(analyser.fftSize);
      meterContextRef.current = context;

      try {
        await context.resume();
      } catch {
        // The recorder can continue even if a browser keeps the meter paused.
      }

      const updateLevel = () => {
        analyser.getByteTimeDomainData(values);
        const average =
          values.reduce((sum, value) => sum + Math.abs(value - 128), 0) /
          values.length;
        setInputLevel(Math.min(1, average / 36));
        meterFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    },
    [stopInputMeter],
  );

  useEffect(() => {
    if (!isLoading && (!currentUser || accountStatus !== "admin"))
      router.replace("/");
  }, [accountStatus, currentUser, isLoading, router]);
  useEffect(() => {
    if (!currentUser || accountStatus !== "admin") return;
    void loadExamSet(examSetId)
      .then(setExamSet)
      .catch((cause) =>
        setLoadError(
          cause instanceof Error
            ? cause.message
            : "Could not load the saved speaking test.",
        ),
      );
  }, [accountStatus, currentUser, examSetId]);
  useEffect(
    () => () => {
      if (transitionRef.current) window.clearTimeout(transitionRef.current);
      if (recorderRef.current?.state !== "inactive") recorderRef.current.stop();
      stopInputMeter();
      stopStream(streamRef.current);
    },
    [stopInputMeter],
  );
  const narration = useMemo(
    () =>
      examSet?.narration
        .slice()
        .sort((left, right) => left.position - right.position) ?? [],
    [examSet],
  );
  const responses = useMemo(
    () =>
      examSet
        ? [
            ...examSet.items
              .filter((item) => item.module === "listen_repeat")
              .sort((left, right) => left.position - right.position),
            ...examSet.items
              .filter((item) => item.module === "interview")
              .sort((left, right) => left.position - right.position),
          ]
        : [],
    [examSet],
  );
  const activeItem = responses[responseIndex] ?? null;
  const narrationId = NARRATION_STAGE[stage];
  const activeNarration = narrationId
    ? (narration.find((cue) => cue.cue_key === narrationId) ?? null)
    : null;
  const isRecording = isRecordingState(stage);
  const visualReady =
    activeItem?.module !== "listen_repeat" ||
    loadedVisualItemId === activeItem.id;
  const advanceNarration = useCallback(() => {
    setPlaybackState("idle");
    setNarrationComplete(false);
    if (stage === "section_intro") setStage("listen_repeat_intro");
    if (stage === "listen_repeat_intro") setStage("listen_repeat_scenario");
    if (stage === "listen_repeat_scenario") setStage("listen_repeat_playing");
    if (stage === "interview_intro") setStage("interview_scenario");
    if (stage === "interview_scenario") setStage("interview_question_playing");
  }, [stage]);
  const finishNarration = useCallback(() => {
    setPlaybackState("idle");
    setNarrationComplete(true);
  }, []);
  const playCurrentMedia = useCallback(async () => {
    const player = activeNarration
      ? narrationAudioRef.current
      : stage === "listen_repeat_playing"
        ? sentenceAudioRef.current
        : stage === "interview_question_playing"
          ? questionVideoRef.current
          : null;
    if (!player) return;
    setPlaybackState("playing");
    player.currentTime = 0;
    try {
      await player.play();
    } catch {
      setPlaybackState("blocked");
    }
  }, [activeNarration, stage]);
  useEffect(() => {
    if (
      !activeNarration &&
      stage !== "listen_repeat_playing" &&
      stage !== "interview_question_playing"
    )
      return;
    if (stage === "listen_repeat_playing" && !visualReady) return;
    void playCurrentMedia();
  }, [activeNarration, playCurrentMedia, stage, visualReady]);
  const finishResponse = useCallback(() => {
    if (!activeItem || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    stopInputMeter();
    if (recorderRef.current?.state !== "inactive") recorderRef.current.stop();
    setSecondsRemaining(0);
    transitionRef.current = window.setTimeout(() => {
      const nextIndex = responseIndex + 1;
      isTransitioningRef.current = false;
      if (nextIndex >= responses.length) {
        stopInputMeter();
        stopStream(streamRef.current);
        streamRef.current = null;
        setStage("complete");
        return;
      }
      setResponseIndex(nextIndex);
      setStage(
        nextIndex === 7
          ? "interview_intro"
          : responses[nextIndex].module === "listen_repeat"
            ? "listen_repeat_playing"
            : "interview_question_playing",
      );
    }, 650);
  }, [activeItem, responseIndex, responses, stopInputMeter]);
  const startResponseRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!activeItem || !stream || isTransitioningRef.current) return;
    try {
      const recorder = MediaRecorder.isTypeSupported("audio/webm")
        ? new MediaRecorder(stream, { mimeType: "audio/webm" })
        : new MediaRecorder(stream);
      recorder.start();
      recorderRef.current = recorder;
      void startInputMeter(stream);
      setPlaybackState("idle");
      setSecondsRemaining(activeItem.response_seconds);
      setStage(
        activeItem.module === "listen_repeat"
          ? "listen_repeat_recording"
          : "interview_recording",
      );
    } catch {
      setMicrophoneError(
        "Recording could not start. Check that your microphone is available, then restart the practice run.",
      );
      setStage("welcome");
    }
  }, [activeItem, startInputMeter]);
  useEffect(() => {
    if (!isRecording) return;
    if (secondsRemaining === 0) {
      finishResponse();
      return;
    }
    const timeout = window.setTimeout(
      () => setSecondsRemaining((current) => current - 1),
      1000,
    );
    return () => window.clearTimeout(timeout);
  }, [finishResponse, isRecording, secondsRemaining]);
  const startExam = useCallback(async () => {
    setMicrophoneError("");
    try {
      stopInputMeter();
      stopStream(streamRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      setResponseIndex(0);
      setSecondsRemaining(0);
      setPlaybackState("idle");
      setNarrationComplete(false);
      setStage("section_intro");
    } catch {
      setMicrophoneError(
        "Microphone access is required for this timed practice run. Allow access in your browser and try again.",
      );
    }
  }, [stopInputMeter]);
  if (isLoading || !examSet)
    return (
      <>
        <PreviewStyles />
        <main className="speaking-preview">
          <div className="preview-assessment-bar">1CUP ENGLISH</div>
          <div className="preview-loading">
            {loadError || "Loading saved speaking test…"}
          </div>
        </main>
      </>
    );
  if (!isReadyForPreview(examSet))
    return (
      <>
        <PreviewStyles />
        <main className="speaking-preview">
          <div className="preview-assessment-bar">1CUP ENGLISH</div>
          <div className="preview-message">
            <p className="preview-kicker">TEST PREVIEW LOCKED</p>
            <h1>Finish all media first.</h1>
            <p>
              The continuous run unlocks when the shared narration, sentence
              audio and masks, and interviewer videos are ready.
            </p>
            <Link href={`/admin/test-center/exams/${examSetId}`}>
              Return to item inspection
            </Link>
          </div>
        </main>
      </>
    );
  const responseNumber = Math.min(responseIndex + 1, responses.length);
  const promptIsPlaying =
    stage === "listen_repeat_playing" || stage === "interview_question_playing";
  return (
    <>
      <PreviewStyles />
      <main className="speaking-preview">
        <div className="preview-assessment-bar">1CUP ENGLISH</div>
        {stage === "welcome" && (
          <section className="preview-welcome">
            <div className="preview-welcome-card">
              <p className="preview-kicker">TOEFL SPEAKING PRACTICE</p>
              <h1>{examSet.title}</h1>
              <p className="preview-lead">
                This is one uninterrupted run: seven Listen and Repeat responses
                followed by four Take an Interview responses.
              </p>
              <dl className="preview-overview">
                <div>
                  <dt>Responses</dt>
                  <dd>11</dd>
                </div>
                <div>
                  <dt>Preparation</dt>
                  <dd>None</dd>
                </div>
                <div>
                  <dt>Recording</dt>
                  <dd>Automatic</dd>
                </div>
              </dl>
              <div className="preview-instructions">
                <strong>Before you begin</strong>
                <p>
                  Use headphones and allow microphone access. Prompts play once
                  only. Recording starts immediately after each prompt and stops
                  automatically.
                </p>
              </div>
              {microphoneError && (
                <p className="preview-error" role="alert">
                  {microphoneError}
                </p>
              )}
              <button
                className="preview-primary"
                onClick={() => void startExam()}
              >
                Begin speaking section
              </button>
            </div>
          </section>
        )}
        {activeNarration && (
          <section className="preview-welcome">
            <div className="preview-welcome-card preview-section-intro">
              <p className="preview-kicker">
                {narrationScreenCopy(activeNarration.cue_key).eyebrow}
              </p>
              <h1>{narrationScreenCopy(activeNarration.cue_key).title}</h1>
              <p className="preview-lead">{activeNarration.script}</p>
              {activeNarration.cue_key === "section_intro" ? (
                <dl
                  className="preview-task-types"
                  aria-label="Speaking task types"
                >
                  <div>
                    <dt>Listen and Repeat</dt>
                    <dd>
                      Listen to a short sentence and repeat it exactly once.
                    </dd>
                  </div>
                  <div>
                    <dt>Take an Interview</dt>
                    <dd>
                      Answer an interviewer&apos;s questions in the time
                      allowed.
                    </dd>
                  </div>
                </dl>
              ) : null}
              <div className="preview-audio-status">
                <span
                  className={playbackState === "playing" ? "is-playing" : ""}
                />
                {playbackState === "playing"
                  ? "Audio is playing"
                  : "Preparing audio"}
              </div>
              {playbackState === "blocked" && (
                <button
                  className="preview-secondary"
                  onClick={() => void playCurrentMedia()}
                >
                  Enable audio to continue
                </button>
              )}
              <div className="preview-narration-actions">
                <button
                  className="preview-primary"
                  disabled={!narrationComplete}
                  onClick={advanceNarration}
                >
                  {t.onboarding.next}
                </button>
              </div>
            </div>
            <audio
              ref={narrationAudioRef}
              src={activeNarration.audio_url ?? undefined}
              onEnded={finishNarration}
              onError={() => setPlaybackState("blocked")}
            />
          </section>
        )}
        {(promptIsPlaying || isRecording) && activeItem && (
          <section className="preview-task-shell">
            <div
              className="preview-progress"
              aria-label={`Response ${responseNumber} of 11`}
            >
              <span
                style={{
                  width: `${(responseNumber / responses.length) * 100}%`,
                }}
              />
            </div>
            <div className="preview-task-heading">
              <p className="preview-kicker">
                RESPONSE {responseNumber} OF {responses.length}
              </p>
              <h1>
                {isRecording
                  ? "Speak now."
                  : activeItem.module === "listen_repeat"
                    ? "Listen and repeat once."
                    : "Listen to the interviewer."}
              </h1>
            </div>
            <div className="preview-prompt-area">
              {activeItem.module === "listen_repeat" ? (
                <>
                  <figure className="preview-segmentation">
                    <Image
                      src={activeItem.image_url!}
                      alt="Listen and Repeat task illustration"
                      width={1200}
                      height={900}
                      priority
                      sizes="(max-width: 780px) calc(100vw - 48px), 710px"
                      onLoad={() => setLoadedVisualItemId(activeItem.id)}
                    />
                  </figure>
                  <audio
                    ref={sentenceAudioRef}
                    src={activeItem.audio_url ?? undefined}
                    onEnded={startResponseRecording}
                  />
                </>
              ) : (
                <>
                  <div
                    className={`preview-interviewer-stage ${isRecording ? "is-listening" : ""}`}
                  >
                    {isRecording ? (
                      <video
                        autoPlay
                        key={`${activeItem.id}-listening`}
                        className="preview-nodding-video is-playing"
                        loop
                        muted
                        playsInline
                        preload="auto"
                        poster={examSet.interviewer.image_url ?? undefined}
                        src={examSet.interviewer.video_url ?? undefined}
                        onPlaying={() => setPlaybackState("playing")}
                        onError={() => setPlaybackState("blocked")}
                      />
                    ) : (
                      <video
                        key={activeItem.id}
                        ref={questionVideoRef}
                        autoPlay
                        className={
                          playbackState === "playing" ? "is-playing" : undefined
                        }
                        playsInline
                        preload="auto"
                        poster={examSet.interviewer.image_url ?? undefined}
                        src={activeItem.video_url ?? undefined}
                        onEnded={startResponseRecording}
                        onCanPlay={() => {
                          const video = questionVideoRef.current;
                          if (video?.paused && video.currentTime === 0) {
                            void playCurrentMedia();
                          }
                        }}
                        onPlaying={() => setPlaybackState("playing")}
                        onError={() => setPlaybackState("blocked")}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
            <div
              className={`preview-response-panel ${isRecording ? "is-recording" : ""}`}
            >
              {isRecording ? (
                <>
                  <p className="preview-response-label">Response time</p>
                  <div className="preview-response-readout">
                    <span className="preview-response-dot is-recording" />
                    <strong className="preview-countdown">
                      {responseTime(secondsRemaining)}
                    </strong>
                  </div>
                  <div
                    className="preview-volume-meter"
                    aria-label={t.examCenter.recording}
                    role="status"
                  >
                    <span className="preview-volume-bars" aria-hidden="true">
                      {Array.from({ length: 6 }, (_, index) => (
                        <i
                          className={
                            inputLevel >= (index + 1) / 6
                              ? "is-active"
                              : undefined
                          }
                          key={index}
                        />
                      ))}
                    </span>
                    <span>{t.examCenter.recording}</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="preview-response-label">Response time</p>
                  <div className="preview-response-readout">
                    <span className="preview-response-dot" />
                    <strong>Waiting</strong>
                  </div>
                </>
              )}
            </div>
            {playbackState === "blocked" && (
              <div className="preview-playback-help">
                <p>This prompt needs browser permission before it can begin.</p>
                <button
                  className="preview-secondary"
                  onClick={() => void playCurrentMedia()}
                >
                  Enable audio to continue
                </button>
              </div>
            )}
          </section>
        )}
        {stage === "complete" && (
          <section className="preview-welcome">
            <div className="preview-welcome-card preview-complete">
              <p className="preview-kicker">PRACTICE COMPLETE</p>
              <h1>Speaking section finished.</h1>
              <p className="preview-lead">
                You completed all 11 timed responses. Your recordings were
                captured for this practice session.
              </p>
              <div className="preview-complete-actions">
                <button
                  className="preview-primary"
                  onClick={() => void startExam()}
                >
                  Run again
                </button>
                <Link
                  className="preview-secondary preview-link-button"
                  href={`/admin/test-center/exams/${examSetId}`}
                >
                  Review media
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
