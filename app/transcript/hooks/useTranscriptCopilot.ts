import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TranscriptResult = {
  alternatives?: Array<{
    content?: string;
    speaker?: string;
  }>;
  type?: string;
  start_time?: number;
  end_time?: number;
};

export type CopilotActionType =
  | "speech_correction"
  | "feedback"
  | "follow_up_question"
  | "none";

export type CopilotAction = {
  type: CopilotActionType;
  label: string;
  message: string;
  targetSpeaker: string;
  replacement: string;
};

export type CopilotTurn = {
  id: string;
  speaker: string;
  text: string;
  startTime?: number;
  endTime?: number;
  wordCount: number;
};

export type CopilotInsight = {
  summary: string;
  action: CopilotAction;
  feedback: string[];
  followUpQuestions: string[];
  facilitationNotes: string[];
};

export type CopilotTriggerReason = "manual" | "timer" | "turn-switch";

export type RefreshOptions = {
  force?: boolean;
  reason?: CopilotTriggerReason;
  turn?: CopilotTurn;
};

export type CopilotConversationMessage = {
  id: string;
  reason: CopilotTriggerReason;
  summary: string;
  action: CopilotAction;
  items: string[];
  error?: string | null;
  createdAt: number;
  transcriptItemCount: number;
};

const emptyInsight: CopilotInsight = {
  summary: "Waiting for enough conversation context.",
  action: {
    type: "none",
    label: "No intervention",
    message: "",
    targetSpeaker: "",
    replacement: "",
  },
  feedback: [],
  followUpQuestions: [],
  facilitationNotes: [],
};

const emptyParticipants: string[] = [];
const TURN_GAP_SECONDS = 0.9;
const MIN_TURN_WORDS = 3;
const MIN_TURN_CHARACTERS = 18;

const resultText = (results: TranscriptResult[]) =>
  results
    .map((result) => result.alternatives?.[0]?.content || "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSpeaker = (speaker?: string) => speaker || "UU";

const turnId = (turn: Omit<CopilotTurn, "id">) =>
  [
    turn.speaker,
    Math.round((turn.startTime || 0) * 1000),
    Math.round((turn.endTime || 0) * 1000),
    turn.text,
  ].join(":");

const buildFinalTurns = (results: TranscriptResult[]): CopilotTurn[] => {
  const turns: Array<Omit<CopilotTurn, "id">> = [];

  results.forEach((result) => {
    const alternative = result.alternatives?.[0];
    const content = alternative?.content || "";
    if (!content || content.trim() === "<end>") return;

    const speaker = normalizeSpeaker(alternative?.speaker);
    const previous = turns[turns.length - 1];
    const hasTimedGap =
      previous &&
      typeof result.start_time === "number" &&
      typeof previous.endTime === "number" &&
      result.start_time - previous.endTime > TURN_GAP_SECONDS;

    if (!previous || previous.speaker !== speaker || hasTimedGap) {
      turns.push({
        speaker,
        text: content,
        startTime: result.start_time,
        endTime: result.end_time,
        wordCount: content.trim() ? 1 : 0,
      });
      return;
    }

    previous.text += content;
    previous.endTime = result.end_time ?? previous.endTime;
    if (content.trim()) previous.wordCount += 1;
  });

  return turns.map((turn) => ({ ...turn, id: turnId(turn) }));
};

const isUsefulTurn = (turn: CopilotTurn) =>
  turn.wordCount >= MIN_TURN_WORDS && turn.text.trim().length >= MIN_TURN_CHARACTERS;

const hasInsight = (insight: CopilotInsight) => {
  return (
    insight.action.type !== "none" ||
    insight.feedback.length > 0 ||
    insight.followUpQuestions.length > 0 ||
    insight.facilitationNotes.length > 0
  );
};

const insightItems = (insight: CopilotInsight) =>
  insight.action.type !== "none" && insight.action.message
    ? [insight.action.message]
    : [];

export const useTranscriptCopilot = ({
  finalTranscript,
  isListening,
  participants = emptyParticipants,
  articleTitle,
}: {
  finalTranscript: TranscriptResult[];
  isListening: boolean;
  participants?: string[];
  articleTitle?: string;
}) => {
  const [insight, setInsight] = useState<CopilotInsight>(emptyInsight);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTrigger, setLastTrigger] = useState<RefreshOptions["reason"] | null>(null);
  const [messages, setMessages] = useState<CopilotConversationMessage[]>([]);
  const lastAnalyzedLengthRef = useRef(0);
  const isLoadingRef = useRef(false);
  const previousLoadingRef = useRef(false);
  const requestTranscriptItemCountRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const processedTurnIdsRef = useRef(new Set<string>());
  const listeningBaselineSetRef = useRef(false);
  const liveTranscriptStartRef = useRef(0);
  const pendingRefreshRef = useRef<RefreshOptions | null>(null);

  const transcriptText = useMemo(
    () => resultText(finalTranscript),
    [finalTranscript]
  );

  const recentTurns = useMemo(() => buildFinalTurns(finalTranscript).slice(-8), [finalTranscript]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const refreshCopilot = useCallback(async (options: RefreshOptions = {}) => {
    const minimumLength = options.force ? 80 : 120;
    if (!transcriptText || transcriptText.length < minimumLength) return;
    if (isLoadingRef.current) {
      // Preserve the newest turn while the current coaching request completes.
      pendingRefreshRef.current = options;
      return;
    }

    const growth = transcriptText.length - lastAnalyzedLengthRef.current;
    if (!options.force && growth < 120 && lastAnalyzedLengthRef.current > 0) {
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;

    setIsLoading(true);
    const reason = options.reason || "manual";
    const completedTurnIndex = options.turn
      ? recentTurns.findIndex((turn) => turn.id === options.turn?.id)
      : -1;
    const contextTurns =
      reason === "turn-switch" && completedTurnIndex >= 0
        ? recentTurns.slice(Math.max(0, completedTurnIndex - 7), completedTurnIndex + 1)
        : recentTurns;
    const contextText =
      reason === "turn-switch" && contextTurns.length > 0
        ? contextTurns.map((turn) => `${turn.speaker}: ${turn.text}`).join("\n")
        : transcriptText;
    requestTranscriptItemCountRef.current = finalTranscript.length;
    setLastTrigger(reason);
    setError(null);

    try {
      const response = await fetch("/api/transcript-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptText: contextText,
          recentText: contextText.slice(-1800),
          participants,
          articleTitle,
          turn: options.turn,
          recentTurns: contextTurns,
        }),
        signal: abortController.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "AI copilot could not generate feedback.");
      }

      setInsight({
        summary: data.summary || emptyInsight.summary,
        action: {
          type: ["speech_correction", "feedback", "follow_up_question", "none"].includes(data.action?.type)
            ? data.action.type
            : "none",
          label: data.action?.label || "No intervention",
          message: data.action?.message || "",
          targetSpeaker: data.action?.targetSpeaker || "",
          replacement: data.action?.replacement || "",
        },
        feedback: Array.isArray(data.feedback) ? data.feedback : [],
        followUpQuestions: Array.isArray(data.followUpQuestions)
          ? data.followUpQuestions
          : [],
        facilitationNotes: Array.isArray(data.facilitationNotes)
          ? data.facilitationNotes
          : [],
      });
      lastAnalyzedLengthRef.current = transcriptText.length;
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "AI copilot could not generate feedback.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [articleTitle, finalTranscript.length, participants, recentTurns, transcriptText]);

  useEffect(() => {
    const finishedLoading = previousLoadingRef.current && !isLoading;
    previousLoadingRef.current = isLoading;

    if (!finishedLoading || !lastTrigger) return;
    if (!error && !hasInsight(insight)) return;

    const nextItems = error ? [] : insightItems(insight);
    const nextSummary = error || insight.summary;
    const transcriptItemCount = requestTranscriptItemCountRef.current;

    setMessages((current) => {
      const last = current[current.length - 1];
      if (
        last &&
        last.summary === nextSummary &&
        last.reason === lastTrigger &&
        last.transcriptItemCount === transcriptItemCount &&
        last.items.join("\n") === nextItems.join("\n")
      ) {
        return current;
      }

      return [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          reason: lastTrigger,
          summary: nextSummary,
          action: error ? emptyInsight.action : insight.action,
          items: nextItems,
          error,
          createdAt: Date.now(),
          transcriptItemCount,
        },
      ].slice(-20);
    });
  }, [error, insight, isLoading, lastTrigger]);

  useEffect(() => {
    if (!isListening) {
      listeningBaselineSetRef.current = false;
      return;
    }

    // Do not send a saved transcript to the live agent when recording resumes.
    if (!listeningBaselineSetRef.current) {
      liveTranscriptStartRef.current = finalTranscript.length;
      listeningBaselineSetRef.current = true;
      return;
    }

    const turns = buildFinalTurns(finalTranscript.slice(liveTranscriptStartRef.current));

    // Coach only after a different, identified speaker begins talking. A pause
    // within one person's speech is not a turn switch, so it must never prompt
    // an intervention.
    turns.slice(0, -1).forEach((turn, index) => {
      const nextTurn = turns[index + 1];
      const isSpeakerHandoff =
        nextTurn &&
        turn.speaker !== "UU" &&
        nextTurn.speaker !== "UU" &&
        turn.speaker !== nextTurn.speaker;

      if (!isSpeakerHandoff) return;
      if (!isUsefulTurn(turn) || processedTurnIdsRef.current.has(turn.id)) return;
      processedTurnIdsRef.current.add(turn.id);
      refreshCopilot({ force: true, reason: "turn-switch", turn });
    });
  }, [finalTranscript, isListening, refreshCopilot]);

  useEffect(() => {
    if (isLoading || !pendingRefreshRef.current) return;
    const pending = pendingRefreshRef.current;
    pendingRefreshRef.current = null;
    refreshCopilot(pending);
  }, [isLoading, refreshCopilot]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return {
    insight,
    isLoading,
    error,
    lastTrigger,
    messages,
    isThinking: isLoading,
    refreshCopilot,
    transcriptText,
  };
};
