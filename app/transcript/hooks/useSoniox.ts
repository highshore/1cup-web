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
  const lastSpeakerRef = useRef("UU");

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
        return;
      }

      if (data.tokens && !isPaused) {
        const finalTokens = data.tokens.filter((token) => token.is_final);
        const partialTokens = data.tokens.filter((token) => !token.is_final);

        const finalizedResults = convertTokensToResults(finalTokens);
        if (finalizedResults.length > 0) {
          setFinalTranscript((prevFinal) => [...prevFinal, ...finalizedResults]);
        }

        setActivePartialSegment(
          convertTokensToResults(partialTokens).map((result) => ({
            ...result,
            isPartial: true,
          }))
        );
      }

      if (data.finished) {
        setActivePartialSegment([]);
        setIsSonioxSocketOpen(false);
      }
    },
    [convertTokensToResults, isPausedRef]
  );

  const setSavedTranscript = useCallback((savedData: SonioxResult[]) => {
    setFinalTranscript(
      savedData.filter(
        (result) => !isControlToken(result.alternatives?.[0]?.content)
      )
    );
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
                model: "stt-rt-v4",
                audio_format: "pcm_f32le",
                sample_rate: 16000,
                num_channels: 1,
                enable_speaker_diarization: true,
                enable_language_identification: true,
                enable_endpoint_detection: true,
                max_endpoint_delay_ms: 1200,
                context: terms?.length ? { terms } : undefined,
              })
            );
            setIsSonioxSocketOpen(true);
            resolve();
          };

          socket.onerror = () => {
            reject(new Error("Soniox WebSocket connection error."));
          };
        });

        socket.onclose = () => setIsSonioxSocketOpen(false);
        socket.onerror = () => {
          setIsSonioxSocketOpen(false);
          setSonioxError("Soniox WebSocket connection error.");
        };

        return true;
      } catch (err: any) {
        console.error("Error starting Soniox:", err);
        setSonioxError(err.message || "Failed to start Soniox.");
        setIsSonioxSocketOpen(false);
        return false;
      }
    },
    [handleMessage]
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
          socket.send(new ArrayBuffer(0));
        } else {
          socket.close();
        }
      } catch {
        setSonioxError("Error stopping Soniox recognition.");
      }
    }

    if (!sendEndOfStreamCmd) setActivePartialSegment([]);
  }, []);

  useEffect(() => {
    return () => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

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
  };
};
