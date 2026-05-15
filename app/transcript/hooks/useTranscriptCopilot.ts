import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TranscriptResult = {
  alternatives?: Array<{
    content?: string;
    speaker?: string;
  }>;
  type?: string;
};

export type CopilotInsight = {
  summary: string;
  feedback: string[];
  followUpQuestions: string[];
  facilitationNotes: string[];
};

export type CopilotTriggerReason = "manual" | "timer" | "turn-switch";

export type RefreshOptions = {
  force?: boolean;
  reason?: CopilotTriggerReason;
};

export type CopilotConversationMessage = {
  id: string;
  reason: CopilotTriggerReason;
  summary: string;
  items: string[];
  error?: string | null;
  createdAt: number;
  transcriptItemCount: number;
};

const emptyInsight: CopilotInsight = {
  summary: "Waiting for enough conversation context.",
  feedback: [],
  followUpQuestions: [],
  facilitationNotes: [],
};

const emptyParticipants: string[] = [];

const resultText = (results: TranscriptResult[]) =>
  results
    .map((result) => result.alternatives?.[0]?.content || "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();

const latestSpeaker = (results: TranscriptResult[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const speaker = results[index]?.alternatives?.[0]?.speaker;
    const content = results[index]?.alternatives?.[0]?.content;
    if (speaker && content && content.trim() && content.trim() !== "<end>") {
      return speaker;
    }
  }
  return null;
};

const hasInsight = (insight: CopilotInsight) => {
  return (
    insight.feedback.length > 0 ||
    insight.followUpQuestions.length > 0 ||
    insight.facilitationNotes.length > 0
  );
};

const insightItems = (insight: CopilotInsight) =>
  [
    ...insight.feedback.slice(0, 2),
    ...insight.followUpQuestions.slice(0, 2),
    ...insight.facilitationNotes.slice(0, 1),
  ].filter(Boolean);

export const useTranscriptCopilot = ({
  finalTranscript,
  activePartialSegment,
  isListening,
  participants = emptyParticipants,
  articleTitle,
}: {
  finalTranscript: TranscriptResult[];
  activePartialSegment: TranscriptResult[];
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
  const lastSpeakerRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const previousLoadingRef = useRef(false);
  const requestTranscriptItemCountRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const transcriptText = useMemo(
    () => resultText([...finalTranscript, ...activePartialSegment]),
    [finalTranscript, activePartialSegment]
  );

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const refreshCopilot = useCallback(async (options: RefreshOptions = {}) => {
    const minimumLength = options.force ? 80 : 120;
    if (!transcriptText || transcriptText.length < minimumLength) return;
    if (isLoadingRef.current) return;

    const growth = transcriptText.length - lastAnalyzedLengthRef.current;
    if (!options.force && growth < 120 && lastAnalyzedLengthRef.current > 0) {
      return;
    }

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    setIsLoading(true);
    const reason = options.reason || "manual";
    requestTranscriptItemCountRef.current = finalTranscript.length;
    setLastTrigger(reason);
    setError(null);

    try {
      const response = await fetch("/api/transcript-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptText,
          recentText: transcriptText.slice(-1800),
          participants,
          articleTitle,
        }),
        signal: abortController.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "AI copilot could not generate feedback.");
      }

      setInsight({
        summary: data.summary || emptyInsight.summary,
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
  }, [articleTitle, finalTranscript.length, participants, transcriptText]);

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
          items: nextItems,
          error,
          createdAt: Date.now(),
          transcriptItemCount,
        },
      ].slice(-20);
    });
  }, [error, insight, isLoading, lastTrigger]);

  useEffect(() => {
    if (!isListening) return;

    const speaker = latestSpeaker(finalTranscript);
    if (!speaker) return;

    if (!lastSpeakerRef.current) {
      lastSpeakerRef.current = speaker;
      return;
    }

    if (lastSpeakerRef.current !== speaker) {
      lastSpeakerRef.current = speaker;
      window.setTimeout(() => {
        refreshCopilot({ force: true, reason: "turn-switch" });
      }, 450);
    }
  }, [finalTranscript, isListening, refreshCopilot]);

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
