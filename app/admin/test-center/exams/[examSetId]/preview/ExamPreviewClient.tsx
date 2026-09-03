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
  .preview-welcome,.preview-loading,.preview-message { display:grid; min-height:0; flex:1; place-items:center; box-sizing:border-box; padding:clamp(20px,5vh,42px) 24px; }.preview-welcome-card,.preview-message { width:min(690px,100%); padding:clamp(30px,6vw,62px); border:1px solid rgba(80,53,42,.22); background:rgba(255,255,255,.92); box-shadow:0 14px 40px rgba(70,36,22,.12); text-align:center; backdrop-filter:blur(14px); }.preview-kicker { margin:0; color:#c84932; font-size:11px; font-weight:800; letter-spacing:.8px; }.preview-welcome-card h1,.preview-message h1 { margin:12px 0 16px; color:#1e1511; font-size:clamp(32px,5vw,48px); font-weight:650; letter-spacing:-1.8px; line-height:1.02; }.preview-lead,.preview-message > p:last-of-type { max-width:550px; margin:0 auto; color:#685951; font-size:15px; line-height:1.6; }
  .preview-overview { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; margin:30px 0; border:1px solid #e4d8d2; background:#e4d8d2; text-align:left; }.preview-overview div { padding:15px; background:rgba(255,250,247,.92); }.preview-overview dt { color:#89766e; font-size:10px; }.preview-overview dd { margin:5px 0 0; color:#3b2720; font-size:15px; font-weight:750; }.preview-instructions { padding:15px 17px; border-left:4px solid #f47a4a; background:#fff3e9; color:#60453a; text-align:left; }.preview-instructions strong { font-size:13px; }.preview-instructions p { margin:5px 0 0; font-size:12px; line-height:1.5; }
  .preview-primary,.preview-secondary { min-height:40px; border:1px solid; font:inherit; font-weight:700; transition:background .15s,color .15s,border-color .15s; cursor:pointer; }.preview-primary { border-color:#a63f25; background:#d25431; color:#fff; }.preview-primary:hover { border-color:#83311d; background:#b94627; }.preview-welcome-card > .preview-primary { margin-top:26px; padding:0 24px; }.preview-secondary { padding:0 16px; border-color:#c8b6ae; background:rgba(255,255,255,.88); color:#503a31; }.preview-secondary:hover { border-color:#c84932; color:#a63f25; }
  .preview-task-types { display:grid; gap:1px; margin:25px 0 0; border:1px solid #e5d9d3; background:#e5d9d3; text-align:left; }.preview-task-types div { display:grid; grid-template-columns:155px 1fr; background:rgba(255,250,247,.94); }.preview-task-types dt { padding:12px 14px; border-right:1px solid #e5d9d3; color:#bd4b2c; font-size:11px; font-weight:800; }.preview-task-types dd { margin:0; padding:12px 14px; color:#66534b; font-size:12px; line-height:1.45; }.preview-audio-status { display:inline-flex; align-items:center; gap:8px; margin-top:24px; color:#6a554a; font-size:12px; }.preview-audio-status > span { width:8px; height:8px; border-radius:999px; background:#d8c7c0; }.preview-audio-status > span.is-playing { background:#d25431; box-shadow:0 0 0 5px rgba(210,84,49,.13); }.preview-error { margin:18px 0 0; color:#aa3625; font-size:12px; line-height:1.45; }
  .preview-task-shell { display:grid; width:min(920px,calc(100% - 48px)); min-height:0; flex:1; align-content:center; margin:0 auto; padding:24px 0; box-sizing:border-box; }.preview-progress { height:6px; overflow:hidden; border-radius:10px; background:#e4d6cf; }.preview-progress span { display:block; height:100%; background:#d25431; transition:width .25s ease; }.preview-task-heading { display:flex; align-items:end; justify-content:space-between; gap:20px; padding:25px 4px 21px; }.preview-task-heading h1 { margin:5px 0 0; color:#251914; font-size:clamp(27px,4vw,38px); font-weight:650; letter-spacing:-1.2px; }.preview-task-count { display:flex; align-items:baseline; gap:5px; color:#8e7d75; }.preview-task-count strong { color:#c84932; font-size:28px; }.preview-task-count span { font-size:12px; }
  .preview-prompt-area { min-height:355px; padding:24px; border:1px solid #decfc7; background:rgba(255,255,255,.9); box-shadow:0 5px 17px rgba(74,40,27,.08); }.preview-segmentation { width:min(710px,100%); margin:0 auto; }.preview-segmentation img { display:block; width:100%; height:auto; border:1px solid #d1bfb6; background:#e7ded9; }.preview-prompt-copy { max-width:650px; margin:23px auto 0; color:#5f4c44; font-size:15px; line-height:1.5; text-align:center; }.preview-interviewer-stage { position:relative; width:min(640px,100%); margin:4px auto 0; overflow:hidden; aspect-ratio:16 / 9; background:#eee3de; }.preview-interviewer-stage video { display:block; width:100%; height:100%; object-fit:cover; }.preview-interviewer-stage video.is-playing { animation:preview-video-active 8s linear both; }.preview-interviewer-caption { position:absolute; right:0; bottom:0; left:0; display:flex; align-items:end; justify-content:space-between; padding:12px 14px; background:linear-gradient(transparent,rgba(43,23,16,.88)); color:#fff; }.preview-interviewer-caption span { font-size:10px; opacity:.83; }.preview-interviewer-caption strong { font-size:13px; } @keyframes preview-video-active { from { transform:scale(1); } to { transform:scale(1.025); } }
  .preview-response-panel { display:flex; gap:25px; align-items:center; justify-content:space-between; margin-top:20px; padding:17px 20px; border:1px solid #decfc7; background:rgba(255,250,247,.86); }.preview-response-panel > div:first-child { display:grid; gap:3px; }.preview-response-panel strong { color:#3c2820; font-size:16px; }.preview-response-panel span { color:#84716a; font-size:11px; }.preview-countdown { color:#c84932 !important; font-size:27px !important; letter-spacing:.5px; }.preview-recording-indicator { display:flex !important; align-items:center; gap:8px; }.preview-recording-indicator > span { width:9px; height:9px; border-radius:999px; background:#d25431; }.preview-response-panel.is-recording { border-color:#d25431; }.preview-playback-help { display:flex; align-items:center; justify-content:space-between; gap:15px; margin-top:15px; padding:13px 15px; border:1px solid #e8c6bb; background:#fff3ed; }.preview-playback-help p { margin:0; color:#814331; font-size:12px; }.preview-complete-actions { display:flex; justify-content:center; gap:10px; margin-top:28px; }.preview-complete-actions .preview-primary { padding:0 18px; }.preview-link-button { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }.preview-loading { color:#705e55; font-size:14px; }.preview-message { place-content:center; text-align:center; }.preview-message a { color:#bd4b2c; font-weight:700; }
  @media (max-width:720px) { .preview-topbar { grid-template-columns:1fr auto; min-height:56px; padding:0 16px; }.preview-topbar-center { display:none; }.preview-welcome,.preview-loading,.preview-message { padding:20px 14px; }.preview-welcome-card,.preview-message { padding:30px 21px; }.preview-overview,.preview-task-types { grid-template-columns:1fr; }.preview-task-types div { grid-template-columns:1fr; }.preview-task-types dt { border-right:0; border-bottom:1px solid #e5d9d3; }.preview-task-shell { width:min(100% - 28px,920px); margin:0 auto; padding:16px 0; }.preview-prompt-area { min-height:0; padding:13px; }.preview-task-heading { padding-inline:0; }.preview-response-panel { align-items:stretch; flex-direction:column; }.preview-response-panel.is-recording > span { margin-left:0; }.preview-playback-help { align-items:stretch; flex-direction:column; }.preview-complete-actions { align-items:stretch; flex-direction:column; }.preview-complete-actions > * { width:100%; min-height:42px; } }
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
  const [examSet, setExamSet] = useState<ExamSetDetail | null>(null);
  const [stage, setStage] = useState<SpeakingState>("welcome");
  const [responseIndex, setResponseIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
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
      stopStream(streamRef.current);
    },
    [],
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
    if (stage === "section_intro") setStage("listen_repeat_intro");
    if (stage === "listen_repeat_intro") setStage("listen_repeat_scenario");
    if (stage === "listen_repeat_scenario") setStage("listen_repeat_playing");
    if (stage === "interview_intro") setStage("interview_scenario");
    if (stage === "interview_scenario") setStage("interview_question_playing");
  }, [stage]);
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
    if (recorderRef.current?.state !== "inactive") recorderRef.current.stop();
    setSecondsRemaining(0);
    transitionRef.current = window.setTimeout(() => {
      const nextIndex = responseIndex + 1;
      isTransitioningRef.current = false;
      if (nextIndex >= responses.length) {
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
  }, [activeItem, responseIndex, responses]);
  const startResponseRecording = useCallback(() => {
    if (!activeItem || !streamRef.current || isTransitioningRef.current) return;
    try {
      const recorder = MediaRecorder.isTypeSupported("audio/webm")
        ? new MediaRecorder(streamRef.current, { mimeType: "audio/webm" })
        : new MediaRecorder(streamRef.current);
      recorder.start();
      recorderRef.current = recorder;
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
  }, [activeItem]);
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
      stopStream(streamRef.current);
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setResponseIndex(0);
      setSecondsRemaining(0);
      setPlaybackState("idle");
      setStage("section_intro");
    } catch {
      setMicrophoneError(
        "Microphone access is required for this timed practice run. Allow access in your browser and try again.",
      );
    }
  }, []);
  if (isLoading || !examSet)
    return (
      <>
        <PreviewStyles />
        <main className="speaking-preview">
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
            </div>
            <audio
              ref={narrationAudioRef}
              src={activeNarration.audio_url ?? undefined}
              onEnded={advanceNarration}
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
              <div>
                <p className="preview-kicker">
                  {activeItem.module === "listen_repeat"
                    ? "LISTEN AND REPEAT"
                    : "TAKE AN INTERVIEW"}
                </p>
                <h1>
                  {activeItem.module === "listen_repeat"
                    ? `Sentence ${activeItem.position} of 7`
                    : `Question ${activeItem.position} of 4`}
                </h1>
              </div>
              <div className="preview-task-count">
                <strong>{responseNumber}</strong>
                <span>of 11</span>
              </div>
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
                  <p className="preview-prompt-copy">
                    Listen carefully. The sentence will play once.
                  </p>
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
                    <div className="preview-interviewer-caption">
                      <span>{isRecording ? "Listening" : "Question"}</span>
                      <strong>{examSet.interviewer.name}</strong>
                    </div>
                  </div>
                  <p className="preview-prompt-copy">
                    Listen to the interviewer. Your response starts immediately
                    when the question ends.
                  </p>
                </>
              )}
            </div>
            <div
              className={`preview-response-panel ${isRecording ? "is-recording" : ""}`}
            >
              {isRecording ? (
                <>
                  <div className="preview-recording-indicator">
                    <span />
                    <p className="preview-kicker">RECORDING</p>
                  </div>
                  <strong className="preview-countdown">
                    {responseTime(secondsRemaining)}
                  </strong>
                  <span>Speak now. Recording stops automatically at zero.</span>
                </>
              ) : (
                <>
                  <p className="preview-kicker">PROMPT PLAYING</p>
                  <strong>Listening…</strong>
                  <span>Recording will start automatically.</span>
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
