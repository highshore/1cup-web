import { useState, useRef, useEffect, useCallback } from "react";

export interface SonioxAlternative {
  content: string;
  confidence?: number;
  speaker?: string;
  language?: string;
}

export interface SonioxResult {
  alternatives?: SonioxAlternative[];
  start_time?: number;
  end_time?: number;
  type?: string;
  isPartial?: boolean;
  preserveSpacing?: boolean;
}

interface SonioxToken {
  text?: string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
  is_final?: boolean;
  speaker?: string;
  language?: string;
  translation_status?: string;
}

interface SonioxMessage {
  tokens?: SonioxToken[];
  finished?: boolean;
  error_code?: number;
  error_message?: string;
}

const SONIOX_WEBSOCKET_URL = "wss://stt-rt.soniox.com/transcribe-websocket";
const SONIOX_CONTROL_TOKENS = new Set(["<end>"]);

async function fetchTemporaryKey(): Promise<string> {
  const response = await fetch("/api/soniox-token", { method: "POST" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.apiKey) {
    throw new Error(data.error || "Failed to create Soniox temporary key.");
  }

  return data.apiKey;
}

const normalizeSpeaker = (speaker?: string): string => {
  if (!speaker) return "UU";
  return speaker.startsWith("S") ? speaker : `S${speaker}`;
};

const tokenType = (text: string): string => {
  if (/^\s+$/.test(text)) return "space";
  if (/^[.,!?;:'")\]}>-]+$/.test(text)) return "punctuation";
  return "word";
};

const isControlToken = (text?: string): boolean => {
  return SONIOX_CONTROL_TOKENS.has((text || "").trim().toLowerCase());
};

export const useSoniox = (isPausedRef?: React.RefObject<boolean>) => {
  const [activePartialSegment, setActivePartialSegment] = useState<SonioxResult[]>([]);
  const [finalTranscript, setFinalTranscript] = useState<SonioxResult[]>([]);
  const [sonioxError, setSonioxError] = useState<string | null>(null);
  const [isSonioxSocketOpen, setIsSonioxSocketOpen] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const isSocketOpenRef = useRef(false);
  const activePartialSegmentRef = useRef<SonioxResult[]>([]);
  const finalTranscriptRef = useRef<SonioxResult[]>([]);
  const lastSpeakerRef = useRef("UU");
  const finishStreamRef = useRef<(() => void) | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishStream = useCallback(() => {
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
    const resolve = finishStreamRef.current;
    finishStreamRef.current = null;
    resolve?.();
  }, []);

  useEffect(() => {
    isSocketOpenRef.current = isSonioxSocketOpen;
  }, [isSonioxSocketOpen]);

  useEffect(() => {
    activePartialSegmentRef.current = activePartialSegment;
  }, [activePartialSegment]);

  const convertTokensToResults = useCallback((tokens: SonioxToken[]): SonioxResult[] => {
    return tokens
      .filter(
        (token) =>
          token.translation_status !== "translation" &&
          !isControlToken(token.text)
      )
      .map((token) => {
        const content = token.text || "";
        const speaker = /^\s+$/.test(content)
          ? lastSpeakerRef.current
          : normalizeSpeaker(token.speaker);

        if (!/^\s+$/.test(content)) {
          lastSpeakerRef.current = speaker;
        }

        return {
          alternatives: [
            {
              content,
              confidence: token.confidence,
              speaker,
              language: token.language,
            },
          ],
          start_time:
            typeof token.start_ms === "number" ? token.start_ms / 1000 : undefined,
          end_time:
            typeof token.end_ms === "number" ? token.end_ms / 1000 : undefined,
          type: tokenType(content),
          preserveSpacing: true,
        };
      })
      .filter((result) => result.alternatives?.[0]?.content);
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const isPaused = isPausedRef?.current;
      let data: SonioxMessage;

      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.error_code) {
        setSonioxError(`Soniox API Error: ${data.error_code} - ${data.error_message}`);
        setIsSonioxSocketOpen(false);
        isSocketOpenRef.current = false;
        return;
      }

      if (data.tokens) {
        const finalTokens = data.tokens.filter((token) => token.is_final);
        const partialTokens = data.tokens.filter((token) => !token.is_final);

        const finalizedResults = convertTokensToResults(finalTokens);
        if (finalizedResults.length > 0) {
          setFinalTranscript((prevFinal) => {
            const nextFinal = [...prevFinal, ...finalizedResults];
            finalTranscriptRef.current = nextFinal;
            return nextFinal;
          });
        }

        // A pause can happen while the provider is finalizing the sentence that
        // was spoken immediately before it. Keep those final tokens; timestamp
        // filtering in the transcript UI still removes audio from the pause.
        setActivePartialSegment(
          isPaused
            ? []
            : convertTokensToResults(partialTokens).map((result) => ({
                ...result,
                isPartial: true,
              }))
        );
      }

      if (data.finished) {
        setActivePartialSegment([]);
        setIsSonioxSocketOpen(false);
        isSocketOpenRef.current = false;
        socketRef.current?.close();
        finishStream();
      }
    },
    [convertTokensToResults, finishStream, isPausedRef]
  );

  const setSavedTranscript = useCallback((savedData: SonioxResult[]) => {
    const filteredSavedData = savedData.filter(
      (result) => !isControlToken(result.alternatives?.[0]?.content)
    );
    finalTranscriptRef.current = filteredSavedData;
    setFinalTranscript(filteredSavedData);
    setActivePartialSegment([]);
  }, []);

  const startSoniox = useCallback(
    async (customDictionary?: Array<{ content: string; sounds_like?: string[] }>) => {
      setSonioxError(null);
      setFinalTranscript((prev) => (prev.length > 0 ? prev : []));
      setActivePartialSegment([]);
      setIsSonioxSocketOpen(false);
      lastSpeakerRef.current = "UU";

      try {
        const apiKey = await fetchTemporaryKey();
        const socket = new WebSocket(SONIOX_WEBSOCKET_URL);
        socket.binaryType = "arraybuffer";
        socket.onmessage = handleMessage;
        socketRef.current = socket;

        await new Promise<void>((resolve, reject) => {
          socket.onopen = () => {
            const terms = customDictionary
              ?.map((entry) => entry.content)
              .filter(Boolean);

            socket.send(
              JSON.stringify({
                api_key: apiKey,
                // v5 supports diarization, endpoint tuning, and structured context.
                model: "stt-rt-v5",
                audio_format: "pcm_f32le",
                sample_rate: 16000,
                num_channels: 1,
                language_hints: ["en", "ko"],
                enable_speaker_diarization: true,
                enable_language_identification: true,
                enable_endpoint_detection: true,
                // A short, but conversational, delay lets the copilot respond at
                // a natural turn boundary without clipping a speaker mid-thought.
                max_endpoint_delay_ms: 1100,
                endpoint_sensitivity: 0.3,
                context: terms?.length ? { terms } : undefined,
              })
            );
            isSocketOpenRef.current = true;
            setIsSonioxSocketOpen(true);
            resolve();
          };

          socket.onerror = () => {
            reject(new Error("Soniox WebSocket connection error."));
          };
        });

        socket.onclose = () => {
          isSocketOpenRef.current = false;
          setIsSonioxSocketOpen(false);
          finishStream();
        };
        socket.onerror = () => {
          isSocketOpenRef.current = false;
          setIsSonioxSocketOpen(false);
          setSonioxError("Soniox WebSocket connection error.");
          finishStream();
        };

        return true;
      } catch (err: any) {
        console.error("Error starting Soniox:", err);
        setSonioxError(err.message || "Failed to start Soniox.");
        isSocketOpenRef.current = false;
        setIsSonioxSocketOpen(false);
        return false;
      }
    },
    [finishStream, handleMessage]
  );

  const sendSonioxAudio = useCallback((audioData: ArrayBuffer) => {
    const socket = socketRef.current;
    if (socket && isSocketOpenRef.current && socket.readyState === WebSocket.OPEN && audioData.byteLength > 0) {
      try {
        socket.send(audioData);
      } catch (error: any) {
        setSonioxError(`Error sending audio to Soniox: ${error.message || "Unknown error"}`);
      }
    }
  }, []);

  const stopSoniox = useCallback(async (sendEndOfStreamCmd: boolean) => {
    const socket = socketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        if (sendEndOfStreamCmd) {
          const streamFinished = new Promise<void>((resolve) => {
            finishStreamRef.current = resolve;
            // Do not block a stopped UI forever if the provider never returns its
            // final message. The socket is still closed to release the mic session.
            finishTimeoutRef.current = setTimeout(() => {
              socket.close();
              finishStream();
            }, 3000);
          });
          socket.send(new ArrayBuffer(0));
          await streamFinished;
        } else {
          socket.close();
          finishStream();
        }
      } catch {
        setSonioxError("Error stopping Soniox recognition.");
        socket.close();
        finishStream();
      }
    }

    if (!sendEndOfStreamCmd) setActivePartialSegment([]);
  }, [finishStream]);

  useEffect(() => {
    return () => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      finishStream();
    };
  }, [finishStream]);

  return {
    sonioxResults: {
      activePartialSegment,
      finalTranscript,
    },
    sonioxError,
    isSonioxSocketOpen,
    startSoniox,
    stopSoniox,
    sendSonioxAudio,
    setSavedTranscript,
    getFinalTranscript: () => finalTranscriptRef.current,
  };
};
