"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { buildMockToeflSteps, MOCK_TOEFL, type ExamStep, type MockOption } from "./mock-toefl";
import "./toefl-mock.css";

type Mode = "center" | "exam";
type ModalState = null | "answer_required" | "time_remaining";

function useCanvasScale(active: boolean) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!active) return;
    const update = () => {
      const next = Math.min(window.innerWidth / 1024, window.innerHeight / 768);
      setScale(Math.max(0.48, next));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active]);

  return scale;
}

function TopBar({
  section,
  progress,
  time,
  showVolume = true,
  action,
  onAction,
  onVolume,
}: {
  section: string;
  progress?: string;
  time?: string;
  showVolume?: boolean;
  action?: string;
  onAction?: () => void;
  onVolume?: () => void;
}) {
  return (
    <div className="toefl-topbar">
      <div className="toefl-topbar-section">{section}</div>
      <div className="toefl-topbar-progress">{progress}</div>
      {time && <div className="toefl-topbar-time">{time}</div>}
      {showVolume && (
        <button type="button" className="toefl-topbar-volume" onClick={onVolume}>
          Volume
        </button>
      )}
      {action && (
        <button type="button" className="toefl-topbar-action" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="toefl-primary" onClick={onClick}>
      {children}
    </button>
  );
}

function SpeakerGlyph({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 48" aria-hidden="true">
      <path d="M4 17h12L30 6v36L16 31H4z" fill="currentColor" />
      <path d="M39 14c4 4 6 8 6 10s-2 6-6 10M46 8c6 6 9 11 9 16s-3 10-9 16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function HardwareIcons() {
  return (
    <div className="toefl-hardware-icons" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <rect x="25" y="5" width="14" height="34" rx="7" fill="none" stroke="currentColor" strokeWidth="6" />
        <path d="M15 29c0 11 7 18 17 18s17-7 17-18M32 47v12M23 59h18" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 64 64">
        <path d="M10 34v-8C10 14 20 5 32 5s22 9 22 21v8" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <rect x="7" y="29" width="12" height="25" rx="6" fill="currentColor" />
        <rect x="45" y="29" width="12" height="25" rx="6" fill="currentColor" />
      </svg>
      <SpeakerGlyph />
    </div>
  );
}

function LevelSegments({ color, filled = 11 }: { color: "teal" | "red" | "yellow"; filled?: number }) {
  return (
    <div className={`toefl-segments ${color}`}>
      {Array.from({ length: 16 }, (_, index) => (
        <span key={index} className={index < filled ? "filled" : ""} />
      ))}
    </div>
  );
}

function MeterExample({ color, filled }: { color: "teal" | "red"; filled: number }) {
  return (
    <div className="toefl-meter-example">
      <LevelSegments color={color} filled={filled} />
      <div className="toefl-meter-guides" aria-hidden="true"><i /><i /></div>
      <div className="toefl-meter-labels"><span>Too Quiet</span><span>Good</span><span>Too Loud</span></div>
    </div>
  );
}

function MicInstructionVisual({ body }: { body?: string[] }) {
  return (
    <div className="toefl-mic-instruction-content">
      <h1>Adjusting the Microphone</h1>
      <div className="toefl-title-rule" />
      <div className="toefl-copy-paragraphs">
        {body?.map((line) => <p key={line}>{line}</p>)}
      </div>
      <h3>Example:</h3>
      <div className="toefl-mic-examples">
        <MeterExample color="teal" filled={9} />
        <MeterExample color="red" filled={15} />
      </div>
      <div className="toefl-mic-verdicts">
        <div className="good"><span className="toefl-checkmark" />Good</div>
        <div className="loud"><span className="toefl-crossmark" />Too Loud</div>
      </div>
    </div>
  );
}

function RecordMicButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="toefl-record-circle" onClick={onClick} aria-label="Record microphone test">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="25" y="8" width="14" height="30" rx="7" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M15 29c0 11 7 18 17 18s17-7 17-18M32 47v10M24 57h16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function OptionList({
  options = [],
  selected,
  onSelect,
}: {
  options?: MockOption[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="toefl-options">
      {options.map((option) => (
        <label key={option.id} className="toefl-option">
          <input
            type="radio"
            name="mock-answer"
            checked={selected === option.id}
            onChange={() => onSelect(option.id)}
          />
          <span className="toefl-radio" aria-hidden="true" />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function MediaPlaceholder({
  label,
  type = "audio",
  className = "",
  onClick,
}: {
  label?: string;
  type?: "audio" | "image" | "video" | "avatar";
  className?: string;
  onClick?: () => void;
}) {
  const icon = type === "audio" ? "♪" : type === "video" ? "▶" : type === "avatar" ? "◉" : "▧";
  return (
    <button
      type="button"
      className={`toefl-media-placeholder ${className}`}
      onClick={onClick}
      aria-label={label || "Media placeholder"}
    >
      <span className="toefl-media-icon" aria-hidden="true">{icon}</span>
      <strong>{label || "Media placeholder"}</strong>
      <span>Asset to be supplied later</span>
    </button>
  );
}

function IntroTable({ rows }: { rows?: Array<[string, string]> }) {
  if (!rows?.length) return null;
  return (
    <div className="toefl-intro-table">
      <div className="toefl-intro-table-head">
        <strong>Type of Task</strong>
        <strong>Description</strong>
      </div>
      {rows.map(([name, description]) => (
        <div className="toefl-intro-row" key={name}>
          <span>{name}</span>
          <span>{description}</span>
        </div>
      ))}
    </div>
  );
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function ExamModal({
  kind,
  onBack,
  onContinue,
}: {
  kind: Exclude<ModalState, null>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const required = kind === "answer_required";
  return (
    <div className="toefl-modal-scrim">
      <div className="toefl-modal">
        <h2>{required ? "You Must Answer" : "Time Remaining"}</h2>
        <p>
          {required
            ? "You must enter an answer before you can leave this question."
            : "You still have time to respond. You can keep writing or revise your response."}
        </p>
        <div className="toefl-modal-actions">
          <PrimaryButton onClick={onBack}>{required ? "Return to Question" : "Back"}</PrimaryButton>
          {!required && (
            <button type="button" className="toefl-link-button" onClick={onContinue}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ToeflMockTestClient({ onExit }: { onExit: () => void }) {
  const steps = useMemo(() => buildMockToeflSteps(), []);
  const [mode, setMode] = useState<Mode>("exam");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [clozeValues, setClozeValues] = useState<Record<string, string[]>>({});
  const [sentencePlaced, setSentencePlaced] = useState<Record<string, string[]>>({});
  const [emailText, setEmailText] = useState("");
  const [discussionText, setDiscussionText] = useState("");
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volume, setVolume] = useState(62);
  const [modal, setModal] = useState<ModalState>(null);
  const [writingSeconds, setWritingSeconds] = useState(0);
  const [speakingSeconds, setSpeakingSeconds] = useState(0);
  const [completed, setCompleted] = useState(false);

  const scale = useCanvasScale(mode === "exam");
  const step = steps[stepIndex];

  const isChoiceStep =
    step?.kind === "reading_daily" ||
    step?.kind === "reading_academic" ||
    step?.kind === "listening_response" ||
    step?.kind === "listening_question";

  const advance = (force = false) => {
    if (!step) return;

    if (!force && isChoiceStep && !answers[step.id]) {
      setModal("answer_required");
      return;
    }
    if (!force && (step.kind === "email" || step.kind === "discussion")) {
      setModal("time_remaining");
      return;
    }

    setModal(null);
    setVolumeOpen(false);

    if (stepIndex >= steps.length - 1) {
      setCompleted(true);
      setStepIndex(0);
      onExit();
      return;
    }
    setStepIndex((value) => value + 1);
  };

  const goBack = () => {
    setModal(null);
    setVolumeOpen(false);
    setStepIndex((value) => Math.max(0, value - 1));
  };

  useEffect(() => {
    if (mode !== "exam") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onExit();
        return;
      }
      if (event.key === "ArrowRight" && !modal) advance();
      if (event.key === "ArrowLeft" && !modal) goBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (!step) return;
    if (step.kind === "email") setWritingSeconds(7 * 60);
    if (step.kind === "discussion") setWritingSeconds(10 * 60);
    if (step.kind === "speaking_record") setSpeakingSeconds(step.responseSeconds ?? 45);
  }, [step?.id]);

  useEffect(() => {
    if (!step) return;
    if (step.kind === "volume_adjusted") setVolumeOpen(true);
  }, [step?.id, step?.kind]);

  useEffect(() => {
    if (mode !== "exam" || step?.kind !== "mic_instructions") return;
    const timer = window.setTimeout(() => {
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [mode, step?.id, step?.kind, steps.length]);

  useEffect(() => {
    if (mode !== "exam") return;
    if (step?.kind !== "email" && step?.kind !== "discussion") return;
    const timer = window.setInterval(() => {
      setWritingSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, step?.id, step?.kind]);

  useEffect(() => {
    if (mode !== "exam" || step?.kind !== "speaking_record") return;
    const timer = window.setInterval(() => {
      setSpeakingSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            setVolumeOpen(false);
            setStepIndex((current) => Math.min(current + 1, steps.length - 1));
          }, 120);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, step?.id, step?.kind, steps.length]);

  const startMock = () => {
    setCompleted(false);
    setStepIndex(0);
    setAnswers({});
    setClozeValues({});
    setSentencePlaced({});
    setEmailText("");
    setDiscussionText("");
    setMode("exam");
  };

  const selectAnswer = (id: string) => {
    if (!step) return;
    setAnswers((current) => ({ ...current, [step.id]: id }));
  };

  const placeSentenceToken = (token: string) => {
    if (!step) return;
    const current = sentencePlaced[step.id] ?? [];
    if (current.includes(token)) {
      setSentencePlaced((all) => ({
        ...all,
        [step.id]: current.filter((item) => item !== token),
      }));
      return;
    }
    setSentencePlaced((all) => ({ ...all, [step.id]: [...current, token] }));
  };

  if (mode === "center") {
    return (
      <main className="exam-center-page">
        <section className="exam-center-hero">
          <div className="exam-center-wrap">
            <div className="exam-center-copy">
              <span className="exam-center-kicker">EXAM CENTER</span>
              <h1>Take a full English mock exam.</h1>
              <p>
                The first test is a front-end TOEFL iBT mock built for interface review.
                Questions and answers are sample data, and media-heavy screens use placeholders.
              </p>
              <button type="button" className="exam-center-cta" onClick={startMock}>
                Start TOEFL mock
              </button>
              <small>During the exam: ← previous state · → next state · Esc exit preview</small>
            </div>
            <div className="exam-center-preview">
              <span>TOEFL UI PREVIEW</span>
              <div className="exam-center-preview-screen">
                <div className="exam-center-preview-top">Speaking <em>Question 1 of 11</em></div>
                <strong>Listen and repeat only once.</strong>
                <div className="exam-center-preview-media">MEDIA PLACEHOLDER</div>
                <div className="exam-center-preview-time">RESPONSE TIME<br /><b>00:00:06</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="exam-center-tests">
          <div className="exam-center-wrap exam-center-tests-inner">
            <span className="exam-center-kicker orange">AVAILABLE TESTS</span>
            <h2>Mock exams</h2>
            <p>For now, this catalog contains one local mock test with no backend dependency.</p>

            {completed && (
              <div className="exam-center-success">
                UI preview completed. No score was saved.
              </div>
            )}

            <button type="button" className="exam-card" onClick={startMock}>
              <div className="exam-card-number">01</div>
              <div className="exam-card-badge">{MOCK_TOEFL.badge}</div>
              <h3>{MOCK_TOEFL.title}</h3>
              <p>{MOCK_TOEFL.subtitle}</p>
              <div className="exam-card-meta">
                <span>Reading · Listening · Writing · Speaking</span>
                <span>~{MOCK_TOEFL.estimatedMinutes} min</span>
              </div>
              <strong>Start →</strong>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="toefl-overlay">
      <div
        className="toefl-canvas"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <ExamScreen
          step={step}
          selected={step ? answers[step.id] : undefined}
          clozeValues={step ? clozeValues[step.id] ?? [] : []}
          sentencePlaced={step ? sentencePlaced[step.id] ?? [] : []}
          emailText={emailText}
          discussionText={discussionText}
          writingSeconds={writingSeconds}
          speakingSeconds={speakingSeconds}
          volumeOpen={volumeOpen}
          volume={volume}
          onVolume={() => setVolumeOpen((open) => !open)}
          onVolumeChange={setVolume}
          onAnswer={selectAnswer}
          onClozeChange={(index, value) => {
            if (!step) return;
            const values = [...(clozeValues[step.id] ?? [])];
            values[index] = value;
            setClozeValues((current) => ({ ...current, [step.id]: values }));
          }}
          onSentenceToken={placeSentenceToken}
          onEmailText={setEmailText}
          onDiscussionText={setDiscussionText}
          onNext={() => advance()}
          onForceNext={() => advance(true)}
          onBack={goBack}
        />

        {modal && (
          <ExamModal
            kind={modal}
            onBack={() => setModal(null)}
            onContinue={() => advance(true)}
          />
        )}
      </div>
    </div>
  );
}

function ExamScreen({
  step,
  selected,
  clozeValues,
  sentencePlaced,
  emailText,
  discussionText,
  writingSeconds,
  speakingSeconds,
  volumeOpen,
  volume,
  onVolume,
  onVolumeChange,
  onAnswer,
  onClozeChange,
  onSentenceToken,
  onEmailText,
  onDiscussionText,
  onNext,
  onForceNext,
  onBack,
}: {
  step: ExamStep;
  selected?: string;
  clozeValues: string[];
  sentencePlaced: string[];
  emailText: string;
  discussionText: string;
  writingSeconds: number;
  speakingSeconds: number;
  volumeOpen: boolean;
  volume: number;
  onVolume: () => void;
  onVolumeChange: (value: number) => void;
  onAnswer: (id: string) => void;
  onClozeChange: (index: number, value: string) => void;
  onSentenceToken: (token: string) => void;
  onEmailText: (value: string) => void;
  onDiscussionText: (value: string) => void;
  onNext: () => void;
  onForceNext: () => void;
  onBack: () => void;
}) {
  const section = step.section === "Pre-test" ? "Reading" : step.section;
  const speakingNoNext =
    step.kind === "speaking_prompt" ||
    step.kind === "speaking_record" ||
    step.kind === "speaking_save";

  const topAction =
    step.kind === "welcome" ||
    step.kind === "hardware" ||
    step.kind === "volume_instructions" ||
    step.kind === "volume_adjusted"
      ? "Continue"
      : step.kind === "mic_instructions" ||
          step.kind === "mic_record" ||
          step.kind === "mic_success" ||
          step.kind === "section_intro" ||
          step.kind === "section_end" ||
          step.kind === "writing_instructions" ||
          step.kind === "speaking_instructions" ||
          step.kind === "speaking_scenario"
        ? undefined
        : speakingNoNext
          ? undefined
          : "Next >";

  const time =
    step.kind === "email" || step.kind === "discussion"
      ? formatTime(writingSeconds)
      : undefined;

  const showTopBar = true;

  return (
    <div className="toefl-screen">
      {showTopBar && (
        <TopBar
          section={step.kind === "welcome" || step.kind === "hardware" ? "" : section}
          progress={step.progressLabel}
          time={time}
          showVolume={
            step.kind !== "welcome" &&
            step.kind !== "hardware" &&
            step.section !== "Writing"
          }
          action={topAction}
          onAction={onNext}
          onVolume={onVolume}
        />
      )}

      {showTopBar && volumeOpen && (
        <div className="toefl-volume-popover">
          <button type="button" className="toefl-volume-close" onClick={onVolume} aria-label="Close volume control">×</button>
          <LevelSegments color="teal" filled={13} />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
            aria-label="Volume"
          />
        </div>
      )}

      <div className="toefl-hidden-back" onDoubleClick={onBack} />

      {step.kind === "welcome" && (
        <div className="toefl-pretest-copy toefl-welcome-screen">
          <h1>{step.title}</h1>
          <div className="toefl-title-rule" />
          <p>{step.body?.[0]}</p>
        </div>
      )}

      {step.kind === "hardware" && (
        <div className="toefl-pretest-copy toefl-hardware-screen">
          <h1>{step.title}</h1>
          <div className="toefl-title-rule" />
          <p>{step.body?.[0]}</p>
          <HardwareIcons />
          <p className="toefl-hardware-note">{step.body?.[1]}</p>
        </div>
      )}

      {(step.kind === "volume_instructions" || step.kind === "volume_adjusted") && (
        <div className="toefl-pretest-copy toefl-volume-screen">
          <h1>{step.title}</h1>
          <div className="toefl-title-rule" />
          <div className="toefl-copy-paragraphs">
            {step.body?.map((line) => <p key={line}>{line}</p>)}
          </div>
          <div className="toefl-volume-note">
            <SpeakerGlyph className="toefl-volume-note-icon" />
            <span>You now have the option to adjust the volume.</span>
          </div>
        </div>
      )}

      {step.kind === "mic_instructions" && (
        <MicInstructionVisual body={step.body} />
      )}

      {step.kind === "mic_record" && (
        <>
          <div className="toefl-mic-record-backdrop">
            <div className="toefl-mic-record-card">
              <RecordMicButton onClick={onNext} />
              <div className="toefl-mic-record-copy">
                <p>Select the 'Record' button. A timer will count down until the system is ready to record.</p>
                <p>To check your microphone level, you will record the following paragraph using your normal tone and volume.</p>
                <p>{step.body?.[0]}</p>
                <div className="toefl-record-level">
                  <LevelSegments color="yellow" filled={2} />
                  <div className="toefl-record-guide" aria-hidden="true" />
                  <div className="toefl-record-labels"><span>Too<br />Quiet</span><span>Good</span><span>Too Loud</span></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {step.kind === "mic_success" && (
        <>
          <MicInstructionVisual body={["In order to check your microphone volume, you will speak into the microphone using your normal tone and volume. For best recording results, your voice level should remain generally within the Good Range. While you speak the microphone will adjust automatically."]} />
          <div className="toefl-success-scrim">
            <div className="toefl-success-modal">
              <h2><span className="toefl-success-dot">✓</span>Success</h2>
              <div className="toefl-success-rule" />
              <p>{step.body?.[0]}</p>
              <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
            </div>
          </div>
        </>
      )}

      {step.kind === "section_intro" && (
        <div className="toefl-section-intro">
          <h1>{step.title}</h1>
          {step.body?.map((line) => <p key={line}>{line}</p>)}
          <IntroTable rows={step.taskRows} />
          <PrimaryButton onClick={onNext}>{step.actionLabel || "Begin"}</PrimaryButton>
        </div>
      )}

      {step.kind === "reading_cloze" && (
        <div className="toefl-cloze">
          <h1>Fill in the missing letters in the paragraph.</h1>
          <p>
            {step.clozeParts?.map((part, index) => (
              <span key={`${step.id}-${index}`}>
                {part}
                {index < (step.clozeParts?.length ?? 0) - 1 && (
                  <input
                    value={clozeValues[index] ?? ""}
                    onChange={(event) => onClozeChange(index, event.target.value)}
                    aria-label={`Missing word ${index + 1}`}
                    maxLength={14}
                  />
                )}
              </span>
            ))}
          </p>
        </div>
      )}

      {step.kind === "reading_daily" && (
        <div className="toefl-reading-daily">
          <h1>Read a notice.</h1>
          <div className="toefl-daily-stimulus">
            <strong>{step.stimulusTitle}</strong>
            {step.stimulusBody?.map((line) => <p key={line}>{line}</p>)}
            <div className="toefl-stimulus-placeholder">IMAGE / NOTICE PLACEHOLDER</div>
          </div>
          <div className="toefl-daily-question">
            <h2>{step.questionText}</h2>
            <OptionList options={step.options} selected={selected} onSelect={onAnswer} />
          </div>
        </div>
      )}

      {step.kind === "reading_academic" && (
        <div className="toefl-reading-academic">
          <h1>{step.passageTitle}</h1>
          <div className="toefl-passage">
            {step.passage?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <div className="toefl-academic-question">
            <h2>{step.questionText}</h2>
            <OptionList options={step.options} selected={selected} onSelect={onAnswer} />
          </div>
        </div>
      )}

      {step.kind === "section_end" && (
        <div className="toefl-end-screen">
          <h1>{step.title}</h1>
          <p>{step.body?.[0]}</p>
          <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
        </div>
      )}

      {step.kind === "listening_response" && (
        <div className="toefl-listening-response">
          <h1>Listen and choose the best response.</h1>
          <MediaPlaceholder label={step.mediaLabel} type="audio" className="response-audio" />
          <div className="toefl-response-question">
            <h2>{step.questionText}</h2>
            <OptionList options={step.options} selected={selected} onSelect={onAnswer} />
          </div>
        </div>
      )}

      {step.kind === "listening_stimulus" && (
        <div className="toefl-listening-stimulus">
          <h1>Listen to {step.stimulusTitle?.toLowerCase()}.</h1>
          <MediaPlaceholder
            label={step.mediaLabel}
            type="audio"
            className="large-audio"
            onClick={onForceNext}
          />
          <p>Click the placeholder to simulate the audio ending.</p>
        </div>
      )}

      {step.kind === "listening_question" && (
        <div className="toefl-listening-question">
          <h1>{step.questionText}</h1>
          <OptionList options={step.options} selected={selected} onSelect={onAnswer} />
        </div>
      )}

      {step.kind === "writing_instructions" && (
        <div className="toefl-writing-instructions">
          <h1>{step.title}</h1>
          {step.body?.map((line) => <p key={line}>{line}</p>)}
          <PrimaryButton onClick={onNext}>{step.actionLabel || "Begin"}</PrimaryButton>
        </div>
      )}

      {step.kind === "build_sentence" && (
        <div className="toefl-sentence">
          <h1>{step.instruction}</h1>
          <div className="toefl-sentence-answer">
            {sentencePlaced.length === 0 ? (
              <span>Click words below to build the sentence.</span>
            ) : (
              sentencePlaced.map((token) => (
                <button key={token} type="button" onClick={() => onSentenceToken(token)}>
                  {token}
                </button>
              ))
            )}
          </div>
          <div className="toefl-token-bank">
            {step.tokens?.map((token) => (
              <button
                key={token}
                type="button"
                className={sentencePlaced.includes(token) ? "placed" : ""}
                onClick={() => onSentenceToken(token)}
              >
                {token}
              </button>
            ))}
          </div>
        </div>
      )}

      {step.kind === "email" && (
        <div className="toefl-email">
          <div className="toefl-email-prompt">
            {step.emailScenario?.map((line) => <p key={line}>{line}</p>)}
            <h2>Write an email to the editor of the magazine.</h2>
            <h3>In your email, do the following.</h3>
            <ul>
              {step.requirements?.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p>Write as much as you can and in complete sentences.</p>
          </div>
          <div className="toefl-email-editor">
            <strong>Your Response:</strong>
            <div className="toefl-email-line">To: {step.recipient}</div>
            <div className="toefl-email-line">Subject: {step.subject}</div>
            <div className="toefl-editor-tools">Cut&nbsp;&nbsp;&nbsp;Paste&nbsp;&nbsp;&nbsp;Undo&nbsp;&nbsp;&nbsp;Redo <span>Hide Word Count</span></div>
            <textarea
              value={emailText}
              onChange={(event) => onEmailText(event.target.value)}
              placeholder="Type your response here..."
            />
          </div>
        </div>
      )}

      {step.kind === "discussion" && (
        <div className="toefl-discussion">
          <div className="toefl-discussion-feed">
            <h1>Write for an Academic Discussion</h1>
            <div className="toefl-professor">
              <strong>Professor</strong>
              {step.professorPrompt?.map((line) => <p key={line}>{line}</p>)}
            </div>
            {step.posts?.map((post) => (
              <div className="toefl-student-post" key={post.name}>
                <div className="toefl-avatar-placeholder">AVATAR</div>
                <div><strong>{post.name}</strong><p>{post.text}</p></div>
              </div>
            ))}
          </div>
          <div className="toefl-discussion-editor">
            <strong>Your Response:</strong>
            <div className="toefl-editor-tools">Cut&nbsp;&nbsp;&nbsp;Paste&nbsp;&nbsp;&nbsp;Undo&nbsp;&nbsp;&nbsp;Redo <span>Hide Word Count</span></div>
            <textarea
              value={discussionText}
              onChange={(event) => onDiscussionText(event.target.value)}
              placeholder="Type your response here..."
            />
          </div>
        </div>
      )}

      {step.kind === "speaking_instructions" && (
        <div className="toefl-speaking-instructions">
          <h1>{step.title}</h1>
          {step.body?.map((line) => <p key={line}>{line}</p>)}
          <PrimaryButton onClick={onNext}>{step.actionLabel || "Begin"}</PrimaryButton>
        </div>
      )}

      {step.kind === "speaking_scenario" && (
        <div className="toefl-speaking-scenario">
          <h1>{step.title}</h1>
          {step.body?.map((line) => <p key={line}>{line}</p>)}
          <MediaPlaceholder label={step.mediaLabel} type={step.mediaType} className="scenario-media" onClick={onForceNext} />
          <small>Click the placeholder to continue the UI preview.</small>
        </div>
      )}

      {step.kind === "speaking_prompt" && (
        <div className="toefl-speaking-prompt">
          <h1>{step.questionNumber && step.questionNumber >= 8 ? "Please answer the interviewer's questions." : "Listen and repeat only once."}</h1>
          <MediaPlaceholder
            label={step.mediaLabel}
            type={step.questionNumber && step.questionNumber >= 8 ? "video" : "image"}
            className={step.questionNumber && step.questionNumber >= 8 ? "interview-media" : "repeat-media"}
            onClick={onForceNext}
          />
          <small>Click the media placeholder to simulate playback ending.</small>
        </div>
      )}

      {step.kind === "speaking_record" && (
        <div className="toefl-speaking-record">
          <h1>{step.questionNumber && step.questionNumber >= 8 ? "Please answer the interviewer's questions." : "Listen and repeat only once."}</h1>
          <MediaPlaceholder
            label={step.mediaLabel}
            type={step.questionNumber && step.questionNumber >= 8 ? "video" : "image"}
            className={step.questionNumber && step.questionNumber >= 8 ? "interview-media" : "repeat-media"}
            onClick={onForceNext}
          />
          <div className={step.questionNumber && step.questionNumber >= 8 ? "toefl-response-time interview" : "toefl-response-time"}>
            <strong>RESPONSE TIME</strong>
            <span>{`00:00:${String(speakingSeconds).padStart(2, "0")}`}</span>
          </div>
        </div>
      )}

      {step.kind === "speaking_save" && (
        <div className="toefl-speaking-save">
          <h1>Stop Speaking</h1>
          <p>Response time has ended.</p>
          <p>Please wait. We are currently saving your response.</p>
          <MediaPlaceholder
            label={step.mediaLabel}
            type={step.questionNumber && step.questionNumber >= 8 ? "video" : "image"}
            className={step.questionNumber && step.questionNumber >= 8 ? "interview-media saving" : "repeat-media saving"}
            onClick={onForceNext}
          />
          <div className={step.questionNumber && step.questionNumber >= 8 ? "toefl-response-time interview" : "toefl-response-time save"}>
            <strong>RESPONSE TIME</strong>
            <span>00:00:00</span>
          </div>
        </div>
      )}
    </div>
  );
}
