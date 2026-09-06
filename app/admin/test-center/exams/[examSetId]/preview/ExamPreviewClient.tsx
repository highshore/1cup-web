"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../../../../lib/contexts/auth_context";
import { loadExamSet } from "../../../../../lib/features/exam/services/exam_admin_client";
import type {
  ExamItem,
  ExamNarration,
  ExamSetDetail,
} from "../../../../../lib/features/exam/types";

import "./exam-preview.css";

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
    player.currentTime = 0;
    try {
      await player.play();
      setPlaybackState("playing");
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
      <main className="speaking-preview">
        <div className="preview-assessment-bar">1CUP ENGLISH</div>
        <div className="preview-loading">
          {loadError || "Loading saved speaking test…"}
        </div>
      </main>
    );
  if (!isReadyForPreview(examSet))
    return (
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
    );
  const responseNumber = Math.min(responseIndex + 1, responses.length);
  const promptIsPlaying =
    stage === "listen_repeat_playing" || stage === "interview_question_playing";
  return (
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
                Next
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
                  aria-label="Recording level"
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
                  <span>Recording</span>
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
  );
}
