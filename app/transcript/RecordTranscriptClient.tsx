'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSoniox } from './hooks/useSoniox';
import { useTranscriptCopilot } from './hooks/useTranscriptCopilot';
import CopilotTranscriptSnippet from './components/CopilotTranscriptSnippet';

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type SectionProps = React.HTMLAttributes<HTMLElement>;
type SpanProps = React.HTMLAttributes<HTMLSpanElement>;
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

function ConversationDetailContainer({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`w-full ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ConversationDetailLeft({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-col gap-8 w-full ${className}`} {...rest}>
      {children}
    </div>
  );
}

function AppSpeechDetails({ className = "", children, ...rest }: SectionProps) {
  return (
    <section className={`bg-transparent border-none rounded-none p-0 mb-6 ${className}`} {...rest}>
      {children}
    </section>
  );
}

function SectionHeader({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h2
      className={`text-[1.125rem] font-black text-[#050505] m-0 mb-4 pb-3 border-b-2 border-[#050505] ${className}`}
      {...rest}
    >
      {children}
    </h2>
  );
}

function KeywordsContainer({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function KeywordTag({ className = "", children, ...rest }: SpanProps) {
  return (
    <span
      className={`bg-white text-[#050505] border-[1.5px] border-[#050505] py-1 px-3 rounded-full text-[0.875rem] font-bold ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

function TranscriptSnippet({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex gap-4 items-start mb-6 w-full ${className}`} {...rest}>
      {children}
    </div>
  );
}

function SpeakerAvatar({
  $bgColor,
  $textColor,
  className = "",
  style,
  children,
  ...rest
}: { $bgColor?: string; $textColor?: string } & ButtonProps) {
  return (
    <button
      className={`w-10 h-10 shrink-0 rounded-full border-2 border-[#050505] text-[1rem] font-extrabold flex items-center justify-center cursor-pointer shadow-[2px_2px_0_rgba(5,5,5,0.9)] [transition:transform_0.16s_ease,box-shadow_0.16s_ease] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_rgba(5,5,5,0.9)] focus-visible:outline-2 focus-visible:outline-[#f47a4a] focus-visible:outline-offset-2 ${className}`}
      style={{
        backgroundColor: $bgColor || "#e5e7eb",
        color: $textColor || "#4b5563",
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function TranscriptContent({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-col gap-1 w-full min-w-0 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function TranscriptHeadRow({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function SpeakerName({
  $color,
  className = "",
  style,
  children,
  ...rest
}: { $color?: string } & SpanProps) {
  return (
    <span
      className={`font-extrabold text-[1rem] ${className}`}
      style={{ color: $color || "#050505", ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}

function Timestamp({ className = "", children, ...rest }: SpanProps) {
  return (
    <span className={`text-[0.875rem] text-[rgba(5,5,5,0.6)] ${className}`} {...rest}>
      {children}
    </span>
  );
}

function TranscriptBody({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`leading-[1.7] text-[#050505] cursor-default bg-transparent border-none rounded-none p-0 mt-2 break-words hyphens-auto w-full ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function WordSpan({
  $lowConfidence,
  $isPartial,
  className = "",
  children,
  ...rest
}: { $lowConfidence?: boolean; $isPartial?: boolean } & SpanProps) {
  const colorClass = $lowConfidence
    ? "text-[#b91c1c] font-bold underline"
    : $isPartial
      ? "text-[rgba(5,5,5,0.55)] font-normal no-underline"
      : "font-normal no-underline";
  return (
    <span
      className={`${colorClass} ${$isPartial ? "italic opacity-70" : "not-italic opacity-100"} decoration-[#fecaca] underline-offset-2 [transition:background-color_0.2s_ease] rounded-[4px] mr-0 [word-break:break-word] hover:bg-[rgba(244,122,74,0.18)] ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

function Container({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`min-h-screen text-[#050505] bg-transparent [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] pb-[80px] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function Controls({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function RecordButton({
  $isRecording,
  className = "",
  children,
  ...rest
}: { $isRecording: boolean } & ButtonProps) {
  return (
    <button
      className={`flex items-center gap-2 py-[0.7rem] px-[1.4rem] border-2 border-[#050505] rounded-full text-[0.875rem] font-extrabold cursor-pointer shadow-[3px_3px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] ${
        $isRecording ? "bg-[#d64545] text-white" : "bg-[#f47a4a] text-[#050505]"
      } hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#050505] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Content({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`pt-0 px-0 pb-8 max-w-[900px] mx-auto bg-transparent ${className}`} {...rest}>
      {children}
    </div>
  );
}

function ErrorMessage({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`mb-8 py-4 px-6 bg-[#fef2f2] text-[#991b1b] rounded-[12px] border-2 border-[#d64545] shadow-[4px_4px_0_rgba(214,69,69,0.4)] text-[0.875rem] font-bold ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function LegendContent({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-start flex-col gap-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function LegendSpeakers({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex gap-4 flex-wrap ${className}`} {...rest}>
      {children}
    </div>
  );
}

function LegendItem({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-center text-[0.75rem] font-bold text-[rgba(5,5,5,0.6)] ${className}`} {...rest}>
      {children}
    </div>
  );
}

function LegendColor({
  $color,
  className = "",
  style,
  ...rest
}: { $color: string } & DivProps) {
  return (
    <div
      className={`w-[10px] h-[10px] border-[1.5px] border-[#050505] rounded-full mr-[0.375rem] ${className}`}
      style={{ backgroundColor: $color, ...style }}
      {...rest}
    />
  );
}

function ConfidenceNote({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`text-[0.6875rem] text-[rgba(5,5,5,0.55)] ${className}`} {...rest}>
      {children}
    </div>
  );
}

function EmptyState({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`text-center text-[rgba(5,5,5,0.6)] italic font-bold py-16 px-8 text-[1rem] bg-white rounded-[12px] border-2 border-[#050505] shadow-[4px_4px_0_rgba(5,5,5,0.9)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// --- Decibel monitor (live mic level + per-speaker loudness) ---
function DecibelPanel({ className = "", children, ...rest }: SectionProps) {
  return (
    <section
      className={`border-2 border-[#050505] rounded-[14px] bg-white pt-4 px-[1.1rem] pb-[1.15rem] shadow-[4px_4px_0_#050505] ${className}`}
      {...rest}
    >
      {children}
    </section>
  );
}

function DecibelHeader({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-[0.85rem] ${className}`} {...rest}>
      {children}
    </div>
  );
}

function DecibelTitle({ className = "", children, ...rest }: HeadingProps) {
  return (
    <h3
      className={`inline-flex items-center m-0 border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] py-[0.26rem] px-[0.62rem] text-[0.82rem] font-black ${className}`}
      {...rest}
    >
      {children}
    </h3>
  );
}

function DecibelReadout({
  $active,
  className = "",
  children,
  ...rest
}: { $active: boolean } & SpanProps) {
  return (
    <span
      className={`text-[0.82rem] font-extrabold tabular-nums ${
        $active ? "text-[#050505]" : "text-[rgba(5,5,5,0.4)]"
      } ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

function Meter({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`relative h-[18px] border-2 border-[#050505] rounded-full bg-[#f3f3f1] overflow-hidden ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function MeterFill({
  $level,
  className = "",
  style,
  ...rest
}: { $level: number } & DivProps) {
  return (
    <div
      className={`h-full bg-[linear-gradient(90deg,#2f8f86_0%,#2f8f86_55%,#e0992b_78%,#d64545_100%)] [transition:width_70ms_linear] ${className}`}
      style={{ width: `${clampPct($level)}%`, ...style }}
      {...rest}
    />
  );
}

function MeterPeak({
  $peak,
  className = "",
  style,
  ...rest
}: { $peak: number } & DivProps) {
  return (
    <div
      className={`absolute top-[-2px] bottom-[-2px] w-[2px] bg-[#050505] ${className}`}
      style={{ left: `${clampPct($peak)}%`, ...style }}
      {...rest}
    />
  );
}

function SpeakerLoudList({ className = "", children, ...rest }: DivProps) {
  return (
    <div className={`flex flex-col gap-[0.55rem] mt-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

function SpeakerLoudRow({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`grid grid-cols-[1.6rem_minmax(0,1fr)_auto] items-center gap-[0.55rem] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function SpeakerDot({
  $color,
  className = "",
  style,
  ...rest
}: { $color: string } & SpanProps) {
  return (
    <span
      className={`w-[1.1rem] h-[1.1rem] border-2 border-[#050505] rounded-full ${className}`}
      style={{ background: $color, ...style }}
      {...rest}
    />
  );
}

function SpeakerBarTrack({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`h-[10px] border-[1.5px] border-[#050505] rounded-full bg-[#f3f3f1] overflow-hidden ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function SpeakerBarFill({
  $level,
  $color,
  className = "",
  style,
  ...rest
}: { $level: number; $color: string } & DivProps) {
  return (
    <div
      className={`h-full ${className}`}
      style={{ width: `${clampPct($level)}%`, background: $color, ...style }}
      {...rest}
    />
  );
}

function SpeakerLoudValue({ className = "", children, ...rest }: SpanProps) {
  return (
    <span
      className={`text-[0.72rem] font-bold tabular-nums text-[rgba(5,5,5,0.6)] whitespace-nowrap ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}

const RecordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="8"/>
  </svg>
);

const PulseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="3">
      <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>
    </circle>
  </svg>
);

// Audio Player Components
function AudioPlayerContainer({
  $isVisible,
  className = "",
  style,
  children,
  ...rest
}: { $isVisible: boolean } & DivProps) {
  return (
    <div
      className={`fixed bottom-0 left-1/2 w-full max-w-[850px] bg-white text-[#050505] p-4 flex items-center justify-between border-[3px] border-[#050505] border-b-0 shadow-[0_-6px_0_rgba(5,5,5,0.9)] [transition:transform_0.3s_ease] z-[100] rounded-tl-[16px] rounded-tr-[16px] box-border max-[768px]:p-[0.8rem] max-[768px]:flex-wrap ${className}`}
      style={{
        transform: `translateX(-50%) translateY(${$isVisible ? "0" : "100%"})`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function AudioControls({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`flex items-center gap-[0.8rem] my-0 mx-[0.3rem] flex-nowrap max-[768px]:gap-2 max-[768px]:mx-[0.2rem] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function AudioButton({ className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`bg-[#f47a4a] text-[#050505] border-2 border-[#050505] text-[1.5rem] cursor-pointer flex items-center justify-center [transition:transform_0.16s_ease,box-shadow_0.16s_ease] w-10 h-10 rounded-full shadow-[2px_2px_0_#050505] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505] active:translate-x-0 active:translate-y-0 active:shadow-[1px_1px_0_#050505] max-[768px]:text-[1.3rem] max-[768px]:w-9 max-[768px]:h-9 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function AudioProgress({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`flex-1 h-[10px] bg-[#f3f3f1] border-2 border-[#050505] rounded-full overflow-hidden relative my-0 mx-4 cursor-pointer max-[768px]:mx-[0.8rem] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function AudioProgressFill({
  $progress,
  className = "",
  style,
  ...rest
}: { $progress: number } & DivProps) {
  return (
    <div
      className={`absolute top-0 left-0 h-full bg-[#f47a4a] rounded-full ${className}`}
      style={{ width: `${$progress}%`, ...style }}
      {...rest}
    />
  );
}

function AudioTime({ className = "", children, ...rest }: DivProps) {
  return (
    <div
      className={`text-[0.9rem] text-[#050505] font-extrabold tabular-nums my-0 mx-2 min-w-[50px] text-center max-[768px]:text-[0.8rem] max-[768px]:min-w-[44px] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function SpeedButton({
  $active,
  className = "",
  children,
  ...rest
}: { $active: boolean } & ButtonProps) {
  return (
    <button
      className={`${
        $active ? "bg-[#f47a4a]" : "bg-white"
      } text-[#050505] border-2 border-[#050505] rounded-full py-[0.3rem] px-[0.6rem] text-[0.85rem] font-extrabold cursor-pointer shadow-[2px_2px_0_#050505] [transition:transform_0.16s_ease,box-shadow_0.16s_ease,background_0.16s_ease] hover:bg-[#f47a4a] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#050505] active:translate-x-0 active:translate-y-0 active:shadow-[1px_1px_0_#050505] max-[768px]:text-[0.75rem] max-[768px]:py-1 max-[768px]:px-2 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default function RecordTranscriptClient() {
  // Soniox-only
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isStopping, setIsStopping] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  // Audio storage and playback state
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentlyHighlightedSnippet, setCurrentlyHighlightedSnippet] = useState<number | null>(null);
  
  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const lastAudioSentAtRef = useRef<number>(0);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Decibel monitoring (live meter + per-speaker loudness)
  const [liveLevel, setLiveLevel] = useState<number>(0); // 0..100 meter fill
  const [liveDb, setLiveDb] = useState<number>(-100); // dBFS
  const [peakLevel, setPeakLevel] = useState<number>(0); // 0..100 session peak
  const [speakerLoudness, setSpeakerLoudness] = useState<
    Record<string, { avg: number; peak: number }>
  >({});
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const dbRafRef = useRef<number | null>(null);
  const peakLevelRef = useRef<number>(0);
  const currentSpeakerRef = useRef<string>("UU");
  const speakerAccumRef = useRef<
    Record<string, { sum: number; count: number; peak: number }>
  >({});

  // Soniox hook
  const {
    sonioxResults: { activePartialSegment: sonioxPartial, finalTranscript: sonioxFinal },
    sonioxError,
    isSonioxSocketOpen,
    startSoniox,
    stopSoniox,
    sendSonioxAudio,
  } = useSoniox();

  // Unified state (Soniox)
  const activePartialSegment = sonioxPartial;
  const finalTranscript = sonioxFinal;
  const transcriptionError = sonioxError;
  const isSocketOpen = isSonioxSocketOpen;

  const {
    messages: copilotMessages,
    isThinking: isCopilotThinking,
  } = useTranscriptCopilot({
    finalTranscript,
    isListening: isRecording,
  });

  // Request microphone permission on component mount
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => setHasPermission(true))
      .catch(() => setHasPermission(false));
  }, []);

  // Track the active speaker so the decibel meter can attribute loudness.
  useEffect(() => {
    const latest =
      activePartialSegment[activePartialSegment.length - 1] ||
      finalTranscript[finalTranscript.length - 1];
    const sp = latest?.alternatives?.[0]?.speaker;
    if (sp) currentSpeakerRef.current = sp.startsWith("S") ? sp : `S${sp}`;
  }, [activePartialSegment, finalTranscript]);

  // Stop the decibel loop if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (dbRafRef.current !== null) cancelAnimationFrame(dbRafRef.current);
    };
  }, []);

  // Set up audio processing and recording
  const setupAudioProcessing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Set up audio context for Soniox
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule('/scripts/audio-processor.js');

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
        processorOptions: {
          sampleRate: 16000
        }
      });
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        const audioData = event.data;
        if (audioData && audioData.byteLength > 0) {
          lastAudioSentAtRef.current = Date.now();
          sendSonioxAudio(audioData);
        }
      };

      source.connect(workletNode);

      // Decibel meter: tap the same stream with an analyser (no output connection).
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserNodeRef.current = analyser;

      const buf = new Float32Array(analyser.fftSize);
      peakLevelRef.current = 0;
      speakerAccumRef.current = {};
      let lastUi = 0;
      const tick = () => {
        const a = analyserNodeRef.current;
        if (!a) return;
        a.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100; // dBFS
        const level = Math.max(0, Math.min(100, ((db + 60) / 60) * 100)); // map -60..0 → 0..100

        if (db > -100) {
          const sp = currentSpeakerRef.current || "UU";
          const acc = speakerAccumRef.current;
          const e = acc[sp] || (acc[sp] = { sum: 0, count: 0, peak: -100 });
          e.sum += db;
          e.count += 1;
          if (db > e.peak) e.peak = db;
        }
        if (level > peakLevelRef.current) peakLevelRef.current = level;

        const now = performance.now();
        if (now - lastUi > 60) {
          lastUi = now;
          setLiveLevel(level);
          setLiveDb(db);
          setPeakLevel(peakLevelRef.current);
          const acc = speakerAccumRef.current;
          const snap: Record<string, { avg: number; peak: number }> = {};
          for (const k in acc) {
            const e = acc[k];
            snap[k] = { avg: e.sum / Math.max(1, e.count), peak: e.peak };
          }
          setSpeakerLoudness(snap);
        }
        dbRafRef.current = requestAnimationFrame(tick);
      };
      dbRafRef.current = requestAnimationFrame(tick);

      // Reacquire mic if track ends (e.g., device switch)
      const [track] = stream.getAudioTracks();
      if (track) {
        track.onended = async () => {
          if (!isRecordingRef.current) return;
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = newStream;
            const newSource = audioContext.createMediaStreamSource(newStream);
            newSource.connect(workletNode);

            // Recreate MediaRecorder for local recording
            const newRecorder = new MediaRecorder(newStream, { mimeType: 'audio/webm;codecs=opus' });
            mediaRecorderRef.current = newRecorder;
            newRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) recordedAudioChunksRef.current.push(e.data);
            };
            newRecorder.onstop = () => {
              const audioBlob = new Blob(recordedAudioChunksRef.current, { type: 'audio/webm;codecs=opus' });
              const audioUrl = URL.createObjectURL(audioBlob);
              setRecordedAudioUrl((previousUrl) => {
                if (previousUrl) URL.revokeObjectURL(previousUrl);
                return audioUrl;
              });
            };
            newRecorder.start();
          } catch (reErr) {
            console.error('Failed to reacquire microphone after track ended:', reErr);
          }
        };
      }

      // Set up MediaRecorder for continuous audio recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      // Clear previous recording chunks
      recordedAudioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedAudioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Create a single audio blob from all chunks
        const audioBlob = new Blob(recordedAudioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl((previousUrl) => {
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          return audioUrl;
        });
      };
      
      // Start continuous recording
      recordingStartTimeRef.current = Date.now();
      mediaRecorder.start();
      
      return true;
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      return false;
    }
  }, [sendSonioxAudio]);

  // Audio player control functions
  const toggleAudioPlayback = useCallback(() => {
    if (!audioPlayerRef.current) return;

    if (isAudioPlaying) {
      audioPlayerRef.current.pause();
    } else {
      audioPlayerRef.current.play();
    }
    setIsAudioPlaying(!isAudioPlaying);
  }, [isAudioPlaying]);

  const seekAudio = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioPlayerRef.current) return;
    
    const progressBar = e.currentTarget;
    const clickPosition = (e.clientX - progressBar.getBoundingClientRect().left) / progressBar.clientWidth;
    const seekTime = clickPosition * (audioPlayerRef.current.duration || 0);
    
    audioPlayerRef.current.currentTime = seekTime;
    setAudioCurrentTime(seekTime);
    setAudioProgress(clickPosition * 100);
  }, []);

  const changePlaybackSpeed = useCallback((speed: number) => {
    if (!audioPlayerRef.current) return;
    audioPlayerRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  }, []);

  // Format time helper
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

  // Determine if a token is punctuation or should be attached to previous word
  const isPunctuationOrAttached = (word: { content: string; confidence?: number } | any): boolean => {
    if (!word || !word.content) return false;
    const punctuationPattern = /^[.,!?;:'")\]}>-]+$/;
    const contractionPattern = /^'[a-z]+$/i; // 's, 't, 'll, etc.
    return punctuationPattern.test(word.content) || contractionPattern.test(word.content);
  };

  // Jump to specific timestamp
  const jumpToTimestamp = useCallback((timestamp: number) => {
    if (!audioPlayerRef.current) return;
    audioPlayerRef.current.currentTime = timestamp;
    setAudioCurrentTime(timestamp);
    
    if (!isAudioPlaying) {
      audioPlayerRef.current.play();
      setIsAudioPlaying(true);
    }
  }, [isAudioPlaying]);

  // Toggle recording function
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      if (isStopping) return;

      // Stop recording
      setIsStopping(true);
      isRecordingRef.current = false;
      setIsRecording(false);

      try {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
          await new Promise<void>((resolve) => {
            const previousOnStop = recorder.onstop;
            recorder.onstop = (event) => {
              previousOnStop?.call(recorder, event);
              resolve();
            };
            try {
              recorder.requestData();
              recorder.stop();
            } catch (error) {
              console.error('Error stopping local audio recording:', error);
              resolve();
            }
          });
        }
        mediaRecorderRef.current = null;

        if (dbRafRef.current !== null) {
          cancelAnimationFrame(dbRafRef.current);
          dbRafRef.current = null;
        }
        if (analyserNodeRef.current) {
          analyserNodeRef.current.disconnect();
          analyserNodeRef.current = null;
        }
        setLiveLevel(0);
        setLiveDb(-100);

        if (workletNodeRef.current) {
          // Send the final partial PCM buffer before ending the Soniox stream.
          workletNodeRef.current.port.postMessage({ type: 'flush' });
          await new Promise((resolve) => setTimeout(resolve, 60));
          workletNodeRef.current.disconnect();
          workletNodeRef.current = null;
        }

        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }

        await stopSoniox(true);
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
          keepAliveIntervalRef.current = null;
        }
      } finally {
        setIsStopping(false);
      }
    } else {
      // Start recording
      if (isStarting || isStopping) return;
      if (!hasPermission) {
        alert('Microphone permission is required for transcription.');
        return;
      }

      try {
        setIsStarting(true);
        
        // Clear previous recording data
        setRecordedAudioUrl(null);
        setCurrentlyHighlightedSnippet(null);
        setIsAudioPlaying(false);
        
        let providerStarted = await startSoniox();
        
        if (!providerStarted) {
          isRecordingRef.current = false;
          setIsStarting(false);
          return;
        }

        const audioSetup = await setupAudioProcessing();
        if (!audioSetup) {
          await stopSoniox(false);
          isRecordingRef.current = false;
          setIsStarting(false);
          return;
        }

        isRecordingRef.current = true;
        setIsRecording(true);
        setIsStarting(false);

        // Start keepalive to avoid provider timeout when tab is backgrounded
        lastAudioSentAtRef.current = Date.now();
        if (keepAliveIntervalRef.current) {
          clearInterval(keepAliveIntervalRef.current);
        }
        keepAliveIntervalRef.current = setInterval(() => {
          if (!isSonioxSocketOpen) return;
          const now = Date.now();
          if (now - lastAudioSentAtRef.current > 1500) {
            // Send ~256ms of silence
            const silent = new Float32Array(4096); // 4096 samples at 16kHz ≈ 256ms
            try {
              sendSonioxAudio(silent.buffer);
              lastAudioSentAtRef.current = now;
            } catch (e) {
              // noop
            }
          }
        }, 800);
      } catch (error) {
        console.error('Error starting recording:', error);
        isRecordingRef.current = false;
        setIsStarting(false);
      }
    }
  }, [isRecording, isStarting, isStopping, hasPermission, startSoniox, setupAudioProcessing, stopSoniox, isSonioxSocketOpen, sendSonioxAudio]);

  // Resume AudioContext when tab becomes visible
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
        lastAudioSentAtRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Speaker colors for diarization
  const getSpeakerColor = useCallback((speaker: string) => {
    // A more distinct and modern color palette
    const colors = {
      'S1': { bg: '#e0e7ff', text: '#4338ca', avatar: '#4f46e5' }, // Indigo
      'S2': { bg: '#ffe4e6', text: '#be123c', avatar: '#e11d48' }, // Rose
      'S3': { bg: '#d1fae5', text: '#047857', avatar: '#059669' }, // Emerald
      'S4': { bg: '#fef3c7', text: '#b45309', avatar: '#d97706' }, // Amber
      'S5': { bg: '#f3e8ff', text: '#7e22ce', avatar: '#9333ea' }, // Purple
      'UU': { bg: '#e5e7eb', text: '#4b5563', avatar: '#6b7280' }, // Gray
    };
    return colors[speaker as keyof typeof colors] || colors['UU'];
  }, []);

  // Group transcript results into snippets for rendering
  const createTranscriptSnippets = useCallback((results: any[]) => {
    const validResults = results.filter(result => {
      const content = result.alternatives?.[0]?.content;
      return content && content.trim().toLowerCase() !== "<end>";
    });
    if (validResults.length === 0) return [];
    
    const snippets: Array<{ 
      speaker: string;
      startTime: number;
      words: Array<{ content: string; confidence?: number; type?: string; preserveSpacing?: boolean; }>;
    }> = [];
    
    let currentSnippet: { 
      speaker: string;
      startTime: number;
      words: Array<{ content: string; confidence?: number; type?: string; preserveSpacing?: boolean; }>;
    } | null = null;
    
    validResults.forEach(result => {
      const word = result.alternatives[0];
      const speaker = word.speaker || 'UU';

      if (!currentSnippet || currentSnippet.speaker !== speaker) {
        if (currentSnippet) {
          snippets.push(currentSnippet);
        }
        currentSnippet = { 
          speaker, 
          startTime: result.start_time,
          words: [{
            content: word.content,
            confidence: word.confidence,
            type: result.type || "word",
            preserveSpacing: result.preserveSpacing,
          }]
        };
      } else {
        currentSnippet.words.push({
          content: word.content,
          confidence: word.confidence,
          type: result.type || "word",
          preserveSpacing: result.preserveSpacing,
        });
      }
    });
    
    if (currentSnippet) {
      snippets.push(currentSnippet);
    }
    
    return snippets;
  }, []);

  const formatTimestamp = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const finalSnippets = createTranscriptSnippets(finalTranscript);
  const partialSnippets = createTranscriptSnippets(activePartialSegment.map(r => ({...r, isPartial: true})));

  // Combine final and partial snippets for a seamless display
  const displaySnippets = useMemo(() => {
    // Start with a deep copy of final snippets to avoid mutation
    const combined = finalSnippets.map(snippet => ({
      ...snippet,
      words: [...snippet.words]
    }));
    
    // Only process partials if they exist
    if (partialSnippets.length === 0) {
      return combined;
    }
    
    const lastFinalSnippet = combined[combined.length - 1];
    const firstPartialSnippet = partialSnippets[0];

    if (lastFinalSnippet && firstPartialSnippet && lastFinalSnippet.speaker === firstPartialSnippet.speaker) {
      // If the same speaker is continuing, merge the words
      const partialWords = firstPartialSnippet.words.map(w => ({ 
        ...w, 
        isPartial: true 
      }));
      lastFinalSnippet.words = [...lastFinalSnippet.words, ...partialWords];
      
      // Add any additional partial snippets from other speakers
      for (let i = 1; i < partialSnippets.length; i++) {
        const additionalPartial = partialSnippets[i];
        combined.push({
          ...additionalPartial,
          words: additionalPartial.words.map(w => ({ ...w, isPartial: true }))
        });
      }
    } else {
      // If it's a new speaker or no final snippets, add all partial snippets
      partialSnippets.forEach(partialSnippet => {
        combined.push({
          ...partialSnippet,
          words: partialSnippet.words.map(w => ({ ...w, isPartial: true }))
        });
      });
    }

    return combined;
  }, [finalSnippets, partialSnippets]);

  const conversationItems = useMemo(() => {
    const sortedMessages = [...copilotMessages].sort(
      (a, b) =>
        a.transcriptItemCount - b.transcriptItemCount ||
        a.createdAt - b.createdAt
    );
    const items: Array<
      | { type: "transcript"; snippet: (typeof displaySnippets)[number]; snippetIndex: number }
      | { type: "copilot"; message: (typeof copilotMessages)[number] }
      | { type: "copilot-thinking" }
    > = [];
    let cumulativeItems = 0;
    let messageIndex = 0;

    displaySnippets.forEach((snippet, snippetIndex) => {
      items.push({ type: "transcript", snippet, snippetIndex });
      cumulativeItems += snippet.words.length;

      while (
        messageIndex < sortedMessages.length &&
        sortedMessages[messageIndex].transcriptItemCount <= cumulativeItems
      ) {
        items.push({ type: "copilot", message: sortedMessages[messageIndex] });
        messageIndex += 1;
      }
    });

    while (messageIndex < sortedMessages.length) {
      items.push({ type: "copilot", message: sortedMessages[messageIndex] });
      messageIndex += 1;
    }

    if (isCopilotThinking) {
      items.push({ type: "copilot-thinking" });
    }

    return items;
  }, [copilotMessages, displaySnippets, isCopilotThinking]);

  // Handle audio time updates for transcript highlighting
  const handleAudioTimeUpdate = useCallback(() => {
    if (!audioPlayerRef.current) return;
    
    const currentTime = audioPlayerRef.current.currentTime;
    setAudioCurrentTime(currentTime);
    
    // Calculate progress
    const duration = audioPlayerRef.current.duration || 1;
    setAudioProgress((currentTime / duration) * 100);
    
    // Find which snippet should be highlighted based on current time
    const currentSnippetIndex = displaySnippets.findIndex((snippet, index) => {
      const nextSnippet = displaySnippets[index + 1];
      return currentTime >= snippet.startTime && 
             (!nextSnippet || currentTime < nextSnippet.startTime);
    });
    
    if (currentSnippetIndex !== -1 && currentSnippetIndex !== currentlyHighlightedSnippet) {
      setCurrentlyHighlightedSnippet(currentSnippetIndex);
    }
  }, [displaySnippets, currentlyHighlightedSnippet]);

  // Set up audio player event listeners
  useEffect(() => {
    if (recordedAudioUrl && audioPlayerRef.current) {
      const audio = audioPlayerRef.current;
      
      const handleLoadedMetadata = () => {
        setAudioDuration(audio.duration);
      };

      const handleTimeUpdate = () => {
        handleAudioTimeUpdate();
      };

      const handleEnded = () => {
        setIsAudioPlaying(false);
        setCurrentlyHighlightedSnippet(null);
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [recordedAudioUrl, handleAudioTimeUpdate]);

  // Placeholder data for Keywords and Speakers sections
  const keywords = ["Soniox", "Real-time", "Diarization", "Language ID", "Transcription"];
  const speakers = [{ name: "Speaker 1", percentage: "60%" }, { name: "Speaker 2", percentage: "40%" }];

  return (
    <Container>
      <Content>
        
        {transcriptionError && (
          <ErrorMessage>
            {transcriptionError}
          </ErrorMessage>
        )}

        <ConversationDetailContainer>
          <ConversationDetailLeft>
            <AppSpeechDetails>
              <SectionHeader>Keywords</SectionHeader>
              <KeywordsContainer>
                {keywords.map(kw => <KeywordTag key={kw}>{kw}</KeywordTag>)}
              </KeywordsContainer>
            </AppSpeechDetails>
            
            <AppSpeechDetails>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem'}}>
                <SectionHeader style={{margin:0,borderBottom:'none',paddingBottom:0}}>Speakers</SectionHeader>
                <Controls>
                  <RecordButton
                    $isRecording={isRecording}
                    onClick={toggleRecording}
                    disabled={hasPermission === false || isStarting || isStopping}
                  >
                    {isStopping ? (
                      <>
                        <PulseIcon />
                        Stopping...
                      </>
                    ) : isStarting ? (
                      <>
                        <PulseIcon />
                        Starting...
                      </>
                    ) : isRecording ? (
                      <>
                        <PulseIcon />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <RecordIcon />
                        Start Recording
                      </>
                    )}
                  </RecordButton>
                </Controls>
              </div>
              <LegendContent>
                <LegendSpeakers>
                  <LegendItem>
                    <LegendColor $color="#4f46e5" />
                    Speaker 1
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#e11d48" />
                    Speaker 2
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#059669" />
                    Speaker 3
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#d97706" />
                    Speaker 4
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#9333ea" />
                    Speaker 5
                  </LegendItem>
                  <LegendItem>
                    <LegendColor $color="#6b7280" />
                    Unknown
                  </LegendItem>
                </LegendSpeakers>
                <ConfidenceNote>
                  Low confidence words appear underlined • Click timestamps to jump to audio position
                </ConfidenceNote>
              </LegendContent>
            </AppSpeechDetails>

            <DecibelPanel>
              <DecibelHeader>
                <DecibelTitle>데시벨 모니터</DecibelTitle>
                <DecibelReadout $active={isRecording}>
                  {isRecording
                    ? `${liveDb <= -100 ? "-∞" : liveDb.toFixed(0)} dBFS`
                    : "대기 중"}
                </DecibelReadout>
              </DecibelHeader>
              <Meter>
                <MeterFill $level={liveLevel} />
                <MeterPeak $peak={peakLevel} />
              </Meter>
              {Object.keys(speakerLoudness).length > 0 && (
                <SpeakerLoudList>
                  {Object.entries(speakerLoudness)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([sp, v]) => {
                      const c = getSpeakerColor(sp);
                      const lvl = Math.max(
                        0,
                        Math.min(100, ((v.avg + 60) / 60) * 100)
                      );
                      return (
                        <SpeakerLoudRow key={sp}>
                          <SpeakerDot $color={c.avatar} />
                          <SpeakerBarTrack>
                            <SpeakerBarFill $level={lvl} $color={c.avatar} />
                          </SpeakerBarTrack>
                          <SpeakerLoudValue>
                            avg {v.avg.toFixed(0)} · peak {v.peak.toFixed(0)} dB
                          </SpeakerLoudValue>
                        </SpeakerLoudRow>
                      );
                    })}
                </SpeakerLoudList>
              )}
            </DecibelPanel>

            {/* Render combined transcript snippets */}
            {conversationItems.map((item) => {
              if (item.type === "copilot-thinking") {
                return <CopilotTranscriptSnippet key="copilot-thinking" isThinking />;
              }

              if (item.type === "copilot") {
                return (
                  <CopilotTranscriptSnippet
                    key={`copilot-${item.message.id}`}
                    message={item.message}
                  />
                );
              }

              const { snippet, snippetIndex: index } = item;
              const speakerColor = getSpeakerColor(snippet.speaker);
              const hasAudio = !!recordedAudioUrl;
              const isHighlighted = currentlyHighlightedSnippet === index;
              
              return (
                <TranscriptSnippet 
                  key={`snippet-${index}`}
                  style={{ 
                    backgroundColor: isHighlighted ? '#fff2cc' : 'transparent',
                    transition: 'background-color 0.3s ease'
                  }}
                >
                  <SpeakerAvatar $bgColor={speakerColor.avatar} $textColor="#ffffff">
                    {snippet.speaker === 'UU' ? 'U' : snippet.speaker.slice(1)}
                  </SpeakerAvatar>
                  <TranscriptContent>
                    <TranscriptHeadRow>
                      <SpeakerName $color={speakerColor.avatar}>
                        {snippet.speaker === 'UU' ? 'Unknown Speaker' : `Speaker ${snippet.speaker.slice(1)}`}
                      </SpeakerName>
                      <Timestamp 
                        style={{ cursor: hasAudio ? 'pointer' : 'default' }}
                        onClick={() => hasAudio && jumpToTimestamp(snippet.startTime)}
                      >
                        {formatTimestamp(snippet.startTime)}
                      </Timestamp>
                    </TranscriptHeadRow>
                    <TranscriptBody>
                      {snippet.words.map((word, wordIndex) => (
                        <WordSpan
                          key={`word-${index}-${wordIndex}`}
                          $lowConfidence={word.confidence !== undefined && word.confidence < 0.9}
                          $isPartial={(word as any).isPartial}
                        >
                          {word.content}
                          {!word.preserveSpacing && !isPunctuationOrAttached(word) ? ' ' : ''}
                        </WordSpan>
                      ))}
                    </TranscriptBody>
                  </TranscriptContent>
                </TranscriptSnippet>
              );
            })}

            {conversationItems.length === 0 && (
              <EmptyState>
                {isRecording ? 'Listening...' : 'Click "Start Recording" to begin.'}
              </EmptyState>
            )}

          </ConversationDetailLeft>
        </ConversationDetailContainer>
      </Content>

      {/* Audio Player */}
      {recordedAudioUrl && (
        <>
          <AudioPlayerContainer $isVisible={!!recordedAudioUrl}>
            <AudioControls>
              <AudioButton onClick={toggleAudioPlayback}>
                {isAudioPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                )}
              </AudioButton>
              <AudioTime>{formatTime(audioCurrentTime)}</AudioTime>
            </AudioControls>

            <AudioProgress onClick={seekAudio}>
              <AudioProgressFill $progress={audioProgress} />
            </AudioProgress>

            <AudioControls>
              <AudioTime>{formatTime(audioDuration)}</AudioTime>
              <SpeedButton 
                $active={playbackSpeed === 0.75} 
                onClick={() => changePlaybackSpeed(0.75)}
              >
                0.75×
              </SpeedButton>
              <SpeedButton 
                $active={playbackSpeed === 1} 
                onClick={() => changePlaybackSpeed(1)}
              >
                1×
              </SpeedButton>
              <SpeedButton 
                $active={playbackSpeed === 1.25} 
                onClick={() => changePlaybackSpeed(1.25)}
              >
                1.25×
              </SpeedButton>
              <SpeedButton 
                $active={playbackSpeed === 1.5} 
                onClick={() => changePlaybackSpeed(1.5)}
              >
                1.5×
              </SpeedButton>
            </AudioControls>
          </AudioPlayerContainer>

          {/* Hidden audio element */}
          <audio
            ref={audioPlayerRef}
            src={recordedAudioUrl}
            preload="metadata"
            style={{ display: 'none' }}
          />
        </>
      )}
    </Container>
  );
}
