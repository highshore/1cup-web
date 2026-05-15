"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import styled from "styled-components";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase/firebase";

// Import extracted components and utilities
import {
  AzureWordPronunciationResult,
  VideoTimestamp,
  SentenceForAssessment,
  InternalizationSentence,
  SentenceCreationWord,
  Step,
  WordDefinitionModalState,
} from "../lib/features/shadow/types/shadow";
import {
  colors,
  ShadowContainer,
  Button,
  ColorCodedSentence,
  ErrorMessage,
  LoadingSpinner,
  LoadingContainer,
  VideoContainer,
  StatusIndicator,
} from "../lib/features/shadow/styles/shadow_styles";
import WordDefinitionModal from "../lib/features/shadow/components/word_definition_modal";
import SentenceAssessment from "../lib/features/shadow/components/sentence_assessment";
import AnalysisReport from "../lib/features/shadow/components/analysis_report";
import { convertToEmbedUrl } from "../lib/features/shadow/utils/shadow_utils";
import { PencilSquareIcon } from "@heroicons/react/24/outline";

// Remaining styled components that are specific to this page
const TranscriptContainer = styled.div`
  width: 100%;
  margin-top: 1rem;
  background: ${colors.surface};
  border-radius: 20px;
  line-height: 1.8;
  text-align: left;
  padding: 1.5rem;
  box-shadow: ${colors.shadow.sm};
`;

const TranscriptWord = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== "isActive",
})<{ isActive: boolean }>`
  transition: all 0s cubic-bezier(0.4, 0, 0.2, 1);
  background: ${(props) => (props.isActive ? "#fafa00" : "transparent")};
  color: ${(props) => (props.isActive ? "#000000" : colors.text.secondary)};
  font-weight: ${(props) => (props.isActive ? "400" : "400")};
  cursor: pointer;
  position: relative;
  padding: 0.1em 0.1em;
  border-radius: 4px;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${colors.primary};
    opacity: 0;
    border-radius: 8px;
    transition: opacity 0.2s ease;
    z-index: -1;
  }

  &:hover {
    &::before {
      opacity: ${(props) => (props.isActive ? "0" : "0.1")};
    }
    transform: ${(props) => (props.isActive ? "none" : "translateY(-1px)")};
  }
`;

const SentenceRow = styled.div`
  padding: 2rem;
  border: 1px solid ${colors.border.light};
  border-radius: 20px;
  background: ${colors.surface};
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: ${colors.shadow.md};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(180deg, ${colors.primary}, ${colors.accent});
    transition: width 0.3s ease;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${colors.shadow.xl};
    border-color: ${colors.primary}30;

    &::before {
      width: 8px;
    }
  }
`;

const SentenceControls = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

// Carousel components
const CarouselContainer = styled.div`
  width: 100%;
  position: relative;
  overflow: hidden;
`;

const CarouselContent = styled.div`
  display: flex;
  width: 100%;
  min-height: 400px;
`;

const CarouselSlide = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== "isActive",
})<{ isActive: boolean }>`
  width: 100%;
  flex-shrink: 0;
  display: ${(props) => (props.isActive ? "block" : "none")};
  animation: ${(props) => (props.isActive ? "slideIn 0.3s ease-out" : "none")};

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

const CarouselNavigation = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
  gap: 1rem;
`;

const NavigationButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;

  &:disabled {
    opacity: 0.5;
  }
`;

const ProgressBarContainer = styled.div`
  flex: 1;
  height: 8px;
  background: ${colors.border.light};
  border-radius: 4px;
  overflow: hidden;
  position: relative;
`;

const ProgressBarFill = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== "progress",
})<{ progress: number }>`
  height: 100%;
  width: ${(props) => props.progress}%;
  background: linear-gradient(90deg, ${colors.primary}, ${colors.accent});
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 20px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3));
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-20px);
    }
    100% {
      transform: translateX(20px);
    }
  }
`;

const ProgressInfo = styled.div`
  text-align: center;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: ${colors.text.muted};
  font-weight: 500;
`;

// Step indicator components
const StepProgressContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StepItem = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== "isActive" && prop !== "isCompleted",
})<{ isActive: boolean; isCompleted: boolean }>`
  display: flex;
  align-items: center;
  position: relative;

  &:not(:last-child) {
    margin-right: 2rem;

    &::after {
      content: "";
      position: absolute;
      right: -2rem;
      top: 50%;
      transform: translateY(-50%);
      width: 2rem;
      height: 2px;
      background: ${(props) =>
        props.isCompleted ? colors.primary : colors.border.light};
      transition: background 0.3s ease;
    }
  }
`;

const StepCircle = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== "isActive" && prop !== "isCompleted",
})<{ isActive: boolean; isCompleted: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  z-index: 1;

  ${(props) => {
    if (props.isActive) {
      return `
        background: linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark});
        color: ${colors.text.inverse};
        box-shadow: ${colors.shadow.md};
        transform: scale(1.1);
      `;
    } else if (props.isCompleted) {
      return `
        background: ${colors.primary};
        color: ${colors.text.inverse};
        &:hover {
          transform: scale(1.05);
          box-shadow: ${colors.shadow.sm};
        }
      `;
    } else {
      return `
        background: ${colors.border.light};
        color: ${colors.text.muted};
        &:hover {
          background: ${colors.border.medium};
        }
      `;
    }
  }}
`;

const StepLabel = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== "isActive",
})<{ isActive: boolean }>`
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 0.75rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: ${(props) => (props.isActive ? colors.primary : colors.text.muted)};
  white-space: nowrap;
  opacity: ${(props) => (props.isActive ? 1 : 0)};
  transition: opacity 0.3s ease;

  ${StepItem}:hover & {
    opacity: 1;
  }
`;

const StepContent = styled.div`
  width: 100%;
  margin-top: 1rem;
`;

const AudioModeToggle = styled(Button)`
  background: ${colors.primaryDark};
  margin-bottom: 1rem;

  &.active {
    background: ${colors.accent};
  }
`;

const ShadowClient: React.FC = () => {
  const [overallError, setOverallError] = useState<string | null>(null);

  // YouTube Player State
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState<boolean>(true);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Transcript & Sentence Assessment State
  const [videoTimestamps, setVideoTimestamps] = useState<VideoTimestamp[]>([]);
  const [activeTimestampIndex, setActiveTimestampIndex] = useState<
    number | null
  >(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const [sentencesToAssess, setSentencesToAssess] = useState<
    SentenceForAssessment[]
  >([]);
  const [currentRecordingSentenceIndex, setCurrentRecordingSentenceIndex] =
    useState<number | null>(null);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [audioToAutoplay, setAudioToAutoplay] = useState<number | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [isAudioMode, setIsAudioMode] = useState(false);
  const [wordDefinitionModal, setWordDefinitionModal] =
    useState<WordDefinitionModalState>({
      isOpen: false,
      word: "",
      apiData: null,
      gptDefinition: "",
      isLoading: false,
    });

  // Internalization state
  const [internalizationSentences] = useState<InternalizationSentence[]>([
    {
      id: "intern-1",
      text: "People with very high expectations have very low resilience.",
      blankIndex: 7, // "low"
      originalWord: "low",
    },
    {
      id: "intern-2",
      text: "You want to train, you want to refine the character of your company.",
      blankIndex: 7, // "refine" - corrected from 6 to 7
      originalWord: "refine",
    },
    {
      id: "intern-3",
      text: "Greatness comes from character.",
      blankIndex: 3, // "character"
      originalWord: "character",
    },
  ]);
  const [currentInternalizationIndex, setCurrentInternalizationIndex] =
    useState(0);
  const [internalizationResults, setInternalizationResults] = useState<
    InternalizationSentence[]
  >(internalizationSentences);

  // Sentence creation state
  const [sentenceCreationWords] = useState<SentenceCreationWord[]>([
    { id: "word-1", word: "Resilience", inputMode: "write" },
    { id: "word-2", word: "Refine", inputMode: "write" },
    { id: "word-3", word: "Character", inputMode: "write" },
    { id: "word-4", word: "Setback", inputMode: "write" },
    { id: "word-5", word: "Ample", inputMode: "write" },
  ]);
  const [sentenceCreationResults, setSentenceCreationResults] = useState<
    SentenceCreationWord[]
  >(sentenceCreationWords);
  const [currentCreationIndex, setCurrentCreationIndex] = useState(0);
  const [internalizationMode, setInternalizationMode] = useState<
    "fill-blank" | "create-sentences"
  >("fill-blank");

  // OpenAI WebSocket state
  const openaiWebSocketRef = useRef<WebSocket | null>(null);
  const [isOpenAIRecording, setIsOpenAIRecording] = useState(false);
  const [currentOpenAIRecordingIndex, setCurrentOpenAIRecordingIndex] =
    useState<number | null>(null);

  const recordedAudioChunksRef = useRef<Float32Array[]>([]);

  // Azure SDK state (recognizer and push stream)
  const [azureRecognizer, setAzureRecognizer] =
    useState<SpeechSDK.SpeechRecognizer | null>(null);
  const azurePushStreamRef = useRef<SpeechSDK.PushAudioInputStream | null>(
    null
  );

  // Refs for Azure SDK and recording state
  const azureRecognizerRef = useRef(azureRecognizer);
  const isRecordingRef = useRef(isRecordingActive);

  const audioContextRef = useRef<AudioContext | null>(null);
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const AZURE_SPEECH_KEY = process.env.NEXT_PUBLIC_AZURE_PRIMARY_KEY;
  const AZURE_SPEECH_REGION = "koreacentral";
  const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  // Step definitions
  const steps: Step[] = [
    { id: 1, name: "스크립트 공부", label: "Script Study" },
    { id: 2, name: "쉐도잉", label: "Shadowing" },
    { id: 3, name: "내재화", label: "Internalization" },
    { id: 4, name: "분석", label: "Analysis" },
  ];

  // Helper function to check if scores meet the criteria to proceed
  const checkScoreCriteria = (): boolean => {
    if (currentSentenceIndex === null || sentencesToAssess.length === 0) {
      return false;
    }
    const sentence = sentencesToAssess[currentSentenceIndex];
    if (
      !sentence ||
      !sentence.assessmentResult ||
      !sentence.assessmentResult.detailResult
    ) {
      return false; // Cannot proceed if not assessed or no detailResult
    }

    const originalTextWords = sentence.text.trim().split(/\s+/);
    const azureWords =
      (sentence.assessmentResult?.detailResult
        ?.Words as AzureWordPronunciationResult[]) || [];
    const threshold = 70;
    let azureWordIdx = 0;

    // Helper to normalize words for comparison
    const normalizeWord = (word: string) =>
      word.toLowerCase().replace(/[.,!?;:'"()[\]{}]|…/g, "");

    // Skip leading Azure insertions
    while (
      azureWordIdx < azureWords.length &&
      azureWords[azureWordIdx]?.PronunciationAssessment?.ErrorType ===
        "Insertion"
    ) {
      azureWordIdx++;
    }

    for (const originalWord of originalTextWords) {
      let matchedAzureWord: AzureWordPronunciationResult | null = null;
      let isExplicitOmissionByAzure = false;

      const normalizedOriginalWord = normalizeWord(originalWord);

      if (azureWordIdx < azureWords.length) {
        const currentAzureWord = azureWords[azureWordIdx];
        const normalizedAzureWord = normalizeWord(currentAzureWord.Word);
        const currentAzureErrorType =
          currentAzureWord.PronunciationAssessment?.ErrorType;

        if (
          currentAzureErrorType !== "Insertion" &&
          normalizedOriginalWord === normalizedAzureWord
        ) {
          matchedAzureWord = currentAzureWord;
          if (currentAzureErrorType === "Omission") {
            isExplicitOmissionByAzure = true;
          }
          azureWordIdx++; // Consume this Azure word
        } else if (
          currentAzureErrorType === "Omission" &&
          normalizedOriginalWord === normalizedAzureWord
        ) {
          isExplicitOmissionByAzure = true;
          azureWordIdx++; // Consume this Azure word
        }
      }

      if (isExplicitOmissionByAzure) {
        return false; // Explicit omission by Azure means this word fails criteria
      }

      if (matchedAzureWord) {
        const accuracyScore =
          matchedAzureWord.PronunciationAssessment?.AccuracyScore;
        if (accuracyScore === undefined || accuracyScore < threshold) {
          return false; // Score below threshold or undefined
        }
      } else {
        return false; // Implicit omission means this word fails criteria
      }

      // After processing an original word, skip any subsequent Azure insertions
      while (
        azureWordIdx < azureWords.length &&
        azureWords[azureWordIdx]?.PronunciationAssessment?.ErrorType ===
          "Insertion"
      ) {
        azureWordIdx++;
      }
    }

    // Check for trailing non-insertion Azure words
    while (azureWordIdx < azureWords.length) {
      if (
        azureWords[azureWordIdx]?.PronunciationAssessment?.ErrorType !==
        "Insertion"
      ) {
        // Found a non-insertion Azure word that wasn't matched
        // This could be considered a failure for strictness
      }
      azureWordIdx++;
    }

    return true; // All original words met the criteria
  };

  useEffect(() => {
    azureRecognizerRef.current = azureRecognizer;
  }, [azureRecognizer]);

  useEffect(() => {
    isRecordingRef.current = isRecordingActive;
  }, [isRecordingActive]);

  // Convert YouTube URL to embed URL using imported utility
  const convertToEmbedUrlCallback = useCallback(convertToEmbedUrl, []);

  // Autoplay effect
  useEffect(() => {
    if (audioToAutoplay !== null) {
      const audioElement = document.getElementById(
        `sentence-audio-${audioToAutoplay}`
      ) as HTMLAudioElement;
      if (audioElement) {
        audioElement.play().catch((err) => {
          console.error("Autoplay failed:", err);
        });
      }
      // Reset after attempting to play
      setAudioToAutoplay(null);
    }
  }, [audioToAutoplay]);

  useEffect(() => {
    const segmentSentences = (
      timestamps: VideoTimestamp[]
    ): SentenceForAssessment[] => {
      if (!timestamps || timestamps.length === 0) return [];
      const sentences: SentenceForAssessment[] = [];
      let currentSentenceText = "";
      let currentSentenceWords: VideoTimestamp[] = [];
      const sentenceEndPunctuations = [".", "?", "!"];
      timestamps.forEach((ts, index) => {
        currentSentenceText +=
          (currentSentenceWords.length > 0 ? " " : "") + ts.word;
        currentSentenceWords.push(ts);
        const lastChar = ts.word.charAt(ts.word.length - 1);
        const isEndOfSentence = sentenceEndPunctuations.includes(lastChar);
        const isLastTimestamp = index === timestamps.length - 1;
        if (
          (isEndOfSentence && currentSentenceWords.length > 0) ||
          (isLastTimestamp && currentSentenceWords.length > 0)
        ) {
          sentences.push({
            id: `sentence-${sentences.length}-${Date.now()}`,
            text: currentSentenceText.trim(),
            startTime: currentSentenceWords[0].start,
            endTime: currentSentenceWords[currentSentenceWords.length - 1].end,
            assessmentResult: null,
            isRecorded: false,
            audioUrl: null,
            recognizedText: "",
            rawJson: "",
            isAssessmentFinalized: false,
          });
          currentSentenceText = "";
          currentSentenceWords = [];
        }
      });
      return sentences;
    };

    const fetchYoutubeDataAndSegment = async () => {
      setYoutubeLoading(true);
      setYoutubeError(null);
      setVideoTimestamps([]);
      setSentencesToAssess([]);
      setActiveTimestampIndex(null);
      setIsPlayerReady(false);
      if (
        playerRef.current &&
        typeof playerRef.current.destroy === "function"
      ) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      try {
        const docRef = doc(db, "shadow", "sample");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.youtube_url) {
            const embedUrl = convertToEmbedUrl(data.youtube_url as string);
            if (embedUrl) setYoutubeUrl(embedUrl);
            else setYoutubeError("Invalid YouTube URL in Firestore.");
          } else
            setYoutubeError(
              "youtube_url field not found in Firestore document."
            );
          if (
            data &&
            data.audio_timestamps &&
            Array.isArray(data.audio_timestamps)
          ) {
            const ts = (data.audio_timestamps as VideoTimestamp[]).sort(
              (a, b) => a.start - b.start
            );
            setVideoTimestamps(ts);
            setSentencesToAssess(segmentSentences(ts));
          } else {
            setVideoTimestamps([]);
            setSentencesToAssess([]);
            console.warn(
              "audio_timestamps not found or not an array in Firestore."
            );
          }
        } else
          setYoutubeError(
            "Shadow learning content not found. Please ensure the 'shadow/sample' document exists in Firestore with youtube_url and audio_timestamps fields."
          );
      } catch (error: any) {
        console.error("Firestore fetch error:", error);
        setYoutubeError(`Failed to load video data: ${error.message}`);
      } finally {
        setYoutubeLoading(false);
      }
    };
    fetchYoutubeDataAndSegment();
    return () => {
      if (timeUpdateIntervalRef.current)
        clearInterval(timeUpdateIntervalRef.current);
    };
  }, [convertToEmbedUrlCallback]);

  useEffect(() => {
    if (!youtubeUrl || youtubeLoading || youtubeError) {
      if (
        playerRef.current &&
        typeof playerRef.current.destroy === "function"
      ) {
        playerRef.current.destroy();
        playerRef.current = null;
        setIsPlayerReady(false);
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      return;
    }

    const manageTimeUpdates = () => {
      if (
        !playerRef.current ||
        typeof playerRef.current.getCurrentTime !== "function" ||
        videoTimestamps.length === 0
      )
        return;
      const currentTime = playerRef.current.getCurrentTime();
      let newActiveIndex: number | null = null;
      // Find the first timestamp that matches the current time
      for (let i = 0; i < videoTimestamps.length; i++) {
        if (
          currentTime >= videoTimestamps[i].start &&
          currentTime <= videoTimestamps[i].end
        ) {
          newActiveIndex = i;
          break;
        }
      }

      if (activeTimestampIndex !== newActiveIndex) {
        setActiveTimestampIndex(newActiveIndex);
        if (newActiveIndex !== null && transcriptContainerRef.current) {
          const activeWordElement = transcriptContainerRef.current.children[
            newActiveIndex
          ] as HTMLElement;
          if (activeWordElement) {
            activeWordElement.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }
      }
    };

    const onPlayerReady = () => {
      setIsPlayerReady(true);
    };

    const onPlayerStateChange = (event: any) => {
      if (event.data === (window as any).YT.PlayerState.PLAYING) {
        if (timeUpdateIntervalRef.current)
          clearInterval(timeUpdateIntervalRef.current);
        // Only start interval if there are timestamps to sync with
        if (videoTimestamps.length > 0) {
          timeUpdateIntervalRef.current = window.setInterval(
            manageTimeUpdates,
            250
          ); // Check time frequently
        }
      } else {
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = null;
        }
        if (
          event.data === (window as any).YT.PlayerState.PAUSED ||
          event.data === (window as any).YT.PlayerState.ENDED
        ) {
          if (videoTimestamps.length > 0) manageTimeUpdates();
        }
      }
    };

    const initializePlayer = () => {
      if (playerRef.current && typeof playerRef.current.destroy === "function")
        playerRef.current.destroy();
      playerRef.current = new (window as any).YT.Player(
        "youtube-player-iframe",
        {
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
          },
        }
      );
    };

    if (!(window as any).YT || !(window as any).YT.Player) {
      (window as any).onYouTubeIframeAPIReady = initializePlayer;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode)
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      else document.head.appendChild(tag);
    } else {
      if (document.getElementById("youtube-player-iframe")) initializePlayer();
    }

    return () => {
      delete (window as any).onYouTubeIframeAPIReady;
      if (playerRef.current && typeof playerRef.current.destroy === "function")
        playerRef.current.destroy();
      playerRef.current = null;
      setIsPlayerReady(false);
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [youtubeUrl, youtubeLoading, youtubeError, videoTimestamps.length]);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close().catch(console.warn);
      }
      if (azureRecognizerRef.current) {
        console.log("[Cleanup] Closing Azure Recognizer on unmount.");
        azureRecognizerRef.current.close();
      }
      if (azurePushStreamRef.current) {
        console.log("[Cleanup] Closing Azure PushStream on unmount.");
        azurePushStreamRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    function writeString(offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    const numChannels = 1;
    const bitDepth = 16; // Convert Float32 to Int16 for WAV

    writeString(0, "RIFF"); // RIFF identifier
    view.setUint32(4, 36 + samples.length * 2, true); // RIFF chunk length
    writeString(8, "WAVE"); // WAVE identifier
    writeString(12, "fmt "); // fmt sub-chunk identifier
    view.setUint32(16, 16, true); // fmt chunk length
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, numChannels, true); // Number of channels
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // Byte rate
    view.setUint16(32, numChannels * (bitDepth / 8), true); // Block align
    view.setUint16(34, bitDepth, true); // Bits per sample
    writeString(36, "data"); // data sub-chunk identifier
    view.setUint32(40, samples.length * 2, true); // data chunk length

    // Convert Float32 samples to Int16
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([view], { type: "audio/wav" });
  }

  // Function to convert Float32Array PCM data to Int16Array ArrayBuffer (needed for Azure)
  function convertFloat32ToInt16(buffer: ArrayBuffer): ArrayBuffer {
    const l = buffer.byteLength / 4; // Float32 is 4 bytes
    const output = new Int16Array(l);
    const input = new Float32Array(buffer);
    for (let i = 0; i < l; i++) {
      output[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff; // Convert to 16-bit PCM
    }
    return output.buffer;
  }

  // Placeholder for startSentenceRecording - to be implemented in Step 2
  const startSentenceRecording = async (sentenceIndex: number) => {
    if (isRecordingActive) return;
    const sentenceToRecord = sentencesToAssess[sentenceIndex];
    if (!sentenceToRecord) {
      setOverallError("Cannot find sentence to record.");
      return;
    }

    setOverallError(null);
    setCurrentRecordingSentenceIndex(sentenceIndex);
    setIsRecordingActive(true);
    recordedAudioChunksRef.current = []; // Clear previous chunks

    // Update sentence state: clear previous results, set assessing flag
    setSentencesToAssess((prev) =>
      prev.map((s, i) =>
        i === sentenceIndex
          ? {
              ...s,
              assessmentResult: null,
              audioUrl: null,
              assessmentError: null,
              recognizedText: "",
              rawJson: "",
              isAssessing: true,
              isAssessmentFinalized: false,
            }
          : s
      )
    );

    try {
      // 1. Azure Speech SDK Setup
      if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
        throw new Error("Azure Speech Key or Region is not configured.");
      }

      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        AZURE_SPEECH_KEY,
        AZURE_SPEECH_REGION
      );
      speechConfig.speechRecognitionLanguage = "en-US";

      if (azurePushStreamRef.current) azurePushStreamRef.current.close();
      azurePushStreamRef.current = SpeechSDK.AudioInputStream.createPushStream(
        SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
      );
      const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(
        azurePushStreamRef.current
      );

      // CRUCIAL: Ensure PronunciationAssessmentConfig is created and applied BEFORE starting recognition
      const pronunciationAssessmentConfig =
        new SpeechSDK.PronunciationAssessmentConfig(
          sentenceToRecord.text,
          SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
          SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
          true
        );
      pronunciationAssessmentConfig.enableProsodyAssessment = true;
      pronunciationAssessmentConfig.enableMiscue = true; // Enable miscue calculation

      if (azureRecognizerRef.current) azureRecognizerRef.current.close();
      const recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        audioConfig
      );
      pronunciationAssessmentConfig.applyTo(recognizer);

      recognizer.recognizing = (
        _sender: SpeechSDK.Recognizer,
        event: SpeechSDK.SpeechRecognitionEventArgs
      ) => {
        // sentenceIndex is captured from the startSentenceRecording function's scope
        if (event.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
          const intermediatePronunciationResult =
            SpeechSDK.PronunciationAssessmentResult.fromResult(event.result);
          setSentencesToAssess((prev) =>
            prev.map((s, i) =>
              i === sentenceIndex
                ? {
                    ...s,
                    recognizedText: event.result.text,
                    assessmentResult: intermediatePronunciationResult,
                    assessmentError: null,
                    isAssessmentFinalized: false, // Keep false during recognizing
                  }
                : s
            )
          );
        }
      };

      recognizer.recognized = (_s, e) => {
        console.log(
          `[Azure Recognized Event] Result reason: ${
            SpeechSDK.ResultReason[e.result.reason]
          }`
        );
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          console.log(`[Azure Recognized] Text: ${e.result.text}`);
          const pronunciationResult =
            SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
          const resultJson = e.result.properties.getProperty(
            SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult
          );
          setSentencesToAssess((prev) =>
            prev.map((s, i) =>
              i === sentenceIndex
                ? {
                    ...s,
                    assessmentResult: pronunciationResult,
                    recognizedText: e.result.text,
                    rawJson: resultJson,
                    isAssessing: false,
                    isAssessmentFinalized: true,
                  }
                : s
            )
          );
        } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
          console.warn(
            "[Azure Recognized] NoMatch: Speech could not be recognized."
          );
          setSentencesToAssess((prev) =>
            prev.map((s, i) =>
              i === sentenceIndex
                ? {
                    ...s,
                    assessmentError: "Speech could not be recognized by Azure.",
                    isAssessing: false,
                    isAssessmentFinalized: true,
                  }
                : s
            )
          );
        } else {
          console.log(
            `[Azure Recognized] Other reason: ${
              SpeechSDK.ResultReason[e.result.reason]
            }`
          );
          setSentencesToAssess((prev) =>
            prev.map((s, i) =>
              i === sentenceIndex
                ? { ...s, isAssessing: false, isAssessmentFinalized: true }
                : s
            )
          );
        }
      };

      recognizer.canceled = (
        _s: SpeechSDK.Recognizer,
        e: SpeechSDK.SpeechRecognitionCanceledEventArgs
      ) => {
        console.error(
          `[Azure] CANCELED event. Reason: ${
            SpeechSDK.CancellationReason[e.reason]
          }`
        );
        let cancellationError = "Azure CANCELED: Unknown reason";
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          cancellationError = `Azure CANCELED: ${e.errorDetails} (Code: ${e.errorCode})`;
          console.error(
            `[Azure] CANCELED: ErrorCode=${e.errorCode} ( ${
              SpeechSDK.CancellationErrorCode[e.errorCode]
            } )`
          );
          console.error(`[Azure] CANCELED: ErrorDetails=${e.errorDetails}`);
        }
        setSentencesToAssess((prev) =>
          prev.map((s, i) =>
            i === sentenceIndex
              ? {
                  ...s,
                  assessmentError: cancellationError,
                  isAssessing: false,
                  isAssessmentFinalized: true,
                }
              : s
          )
        );
      };

      recognizer.sessionStarted = (
        _s: SpeechSDK.Recognizer,
        _e: SpeechSDK.SessionEventArgs
      ) => {
        console.log("[Azure] Session STARTED");
      };

      recognizer.sessionStopped = (
        _s: SpeechSDK.Recognizer,
        _e: SpeechSDK.SessionEventArgs
      ) => {
        console.log("[Azure] Session STOPPED");
        if (azurePushStreamRef.current) {
          console.log("[Azure] Closing push stream on session stop.");
          azurePushStreamRef.current.close();
        }
      };

      await recognizer.startContinuousRecognitionAsync(
        () => {
          console.log("[Azure] Continuous recognition successfully started.");
        },
        (err: string) => {
          console.error(
            `[Azure] Error starting Azure continuous recognition: ${err}`
          );
          setSentencesToAssess((prev) =>
            prev.map((s, i) =>
              i === sentenceIndex
                ? {
                    ...s,
                    assessmentError: `Azure SDK Error starting recognition: ${err}`,
                    isAssessing: false,
                    isAssessmentFinalized: false,
                  }
                : s
            )
          );
          if (azurePushStreamRef.current) azurePushStreamRef.current.close();
        }
      );
      setAzureRecognizer(recognizer); // Set the new recognizer instance
      console.log(
        "[Azure] Azure Recognizer instance created and recognition started."
      );

      // Ensure isAssessing is true and isAssessmentFinalized is false for the current sentence
      setSentencesToAssess((prev) =>
        prev.map((s, i) =>
          i === sentenceIndex
            ? {
                ...s,
                isAssessing: true,
                assessmentResult: null, // Clear previous results
                audioUrl: null,
                assessmentError: null,
                recognizedText: "",
                rawJson: "",
                isAssessmentFinalized: false, // Explicitly set to false on start
              }
            : s
        )
      );

      // 2. Web Audio API Setup
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });

      await audioContextRef.current.audioWorklet.addModule(
        "/scripts/audio-processor.js"
      );

      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      microphoneSourceRef.current =
        audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

      audioWorkletNodeRef.current = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
        {
          processorOptions: { sampleRate: audioContextRef.current.sampleRate },
        }
      );

      audioWorkletNodeRef.current.port.onmessage = (
        event: MessageEvent<ArrayBuffer>
      ) => {
        const dataIsArrayBuffer = event.data instanceof ArrayBuffer;
        const bufferByteLength = dataIsArrayBuffer ? event.data.byteLength : 0;

        if (dataIsArrayBuffer && bufferByteLength > 0) {
          const float32Data = new Float32Array(event.data.slice(0));
          recordedAudioChunksRef.current.push(float32Data);

          if (
            azurePushStreamRef.current &&
            azureRecognizerRef.current &&
            isRecordingRef.current &&
            bufferByteLength > 0
          ) {
            try {
              const int16Buffer = convertFloat32ToInt16(event.data.slice(0));
              azurePushStreamRef.current.write(int16Buffer);
            } catch (azurePushError: any) {
              console.error(
                "[AudioWorklet] Error writing audio to Azure push stream:",
                azurePushError.toString()
              );
              // This error is critical, try to update the specific sentence
              setSentencesToAssess((prev) =>
                prev.map((s, k) =>
                  k === sentenceIndex
                    ? {
                        ...s,
                        assessmentError:
                          "Azure audio stream closed unexpectedly during write.",
                        isAssessing: false,
                        isAssessmentFinalized: true,
                      }
                    : s
                )
              );
            }
          }
        }
      };
      microphoneSourceRef.current.connect(audioWorkletNodeRef.current);
    } catch (err: any) {
      console.error("Error starting sentence recording:", err);
      const errorMsg = err.message || "Failed to start recording.";
      setOverallError(errorMsg);
      setSentencesToAssess((prev) =>
        prev.map((s, i) =>
          i === sentenceIndex
            ? {
                ...s,
                assessmentError: errorMsg,
                isAssessing: false,
                isAssessmentFinalized: true,
              }
            : s
        )
      );
      setIsRecordingActive(false);
      setCurrentRecordingSentenceIndex(null);
      // Clean up Azure SDK resources if they were partially initialized
      if (azureRecognizerRef.current) azureRecognizerRef.current.close();
      if (azurePushStreamRef.current) azurePushStreamRef.current.close();
    }
  };

  const stopCurrentSentenceRecording = async () => {
    if (!isRecordingActive || currentRecordingSentenceIndex === null) {
      console.warn("Stop called but no active recording or sentence index.");
      return;
    }

    const recordingIdx = currentRecordingSentenceIndex; // Capture before resetting
    console.log(
      `[Stop] Attempting to stop recording for sentence index: ${recordingIdx}`
    );

    // 1. Stop Azure continuous recognition
    if (
      azureRecognizerRef.current &&
      typeof azureRecognizerRef.current.stopContinuousRecognitionAsync ===
        "function"
    ) {
      console.log("[Azure] Sending stopContinuousRecognitionAsync command.");
      try {
        await azureRecognizerRef.current.stopContinuousRecognitionAsync(
          () => {
            console.log(
              "[Azure] Continuous recognition stopped command sent successfully."
            );
          },
          (err: string) => {
            console.error(
              `[Azure] Error SENDING stop continuous recognition: ${err}`
            );
          }
        );
      } catch (err) {
        console.error(
          "[Azure] Exception during stopContinuousRecognitionAsync call:",
          err
        );
      }
    } else {
      console.warn(
        "[Azure] Recognizer or stopContinuousRecognitionAsync not available to stop."
      );
    }

    // 2. Stop Web Audio API recording parts
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.onmessage = null; // Remove listener
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
      console.log("[WebAudio] AudioWorkletNode disconnected.");
    }
    if (microphoneSourceRef.current) {
      microphoneSourceRef.current.disconnect();
      microphoneSourceRef.current = null;
      console.log("[WebAudio] MicrophoneSourceNode disconnected.");
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      console.log("[WebAudio] MediaStream tracks stopped.");
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        await audioContextRef.current.close();
        console.log("[WebAudio] AudioContext closed.");
      } catch (e) {
        console.warn("[WebAudio] Error closing AudioContext:", e);
      }
      audioContextRef.current = null;
    }

    // 3. Process recorded audio chunks to create WAV and get URL
    let newAudioUrl: string | null = null;
    if (recordedAudioChunksRef.current.length > 0) {
      try {
        const totalLength = recordedAudioChunksRef.current.reduce(
          (acc, val) => acc + val.length,
          0
        );
        const concatenatedPcm = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of recordedAudioChunksRef.current) {
          concatenatedPcm.set(chunk, offset);
          offset += chunk.length;
        }
        const sampleRate = 16000;
        const wavBlob = encodeWAV(concatenatedPcm, sampleRate);
        newAudioUrl = URL.createObjectURL(wavBlob);
        console.log(`[WebAudio] Recorded audio URL created: ${newAudioUrl}`);
      } catch (wavError) {
        console.error("Error encoding WAV:", wavError);
        setSentencesToAssess((prev) =>
          prev.map((s, i) =>
            i === recordingIdx
              ? { ...s, assessmentError: "Failed to process recorded audio." }
              : s
          )
        );
      }
    }
    recordedAudioChunksRef.current = []; // Clear chunks after processing

    // 4. Update state
    setIsRecordingActive(false);
    setCurrentRecordingSentenceIndex(null);
    setSentencesToAssess((prev) =>
      prev.map((s, i) =>
        i === recordingIdx
          ? {
              ...s,
              isAssessing: false, // Assessment attempt is complete
              audioUrl: newAudioUrl, // Set the new audio URL (or null if WAV failed)
              isRecorded: true,
              isAssessmentFinalized: false,
            }
          : s
      )
    );

    // 5. Autoplay the recorded audio for the specific sentence
    if (newAudioUrl) {
      console.log(
        `[Autoplay] Triggering autoplay for sentence ${recordingIdx}`
      );
      // Trigger autoplay using state
      setAudioToAutoplay(recordingIdx);
    }
  };

  // Get word definition function
  const getWordDefinition = async (
    word: string,
    context: string
  ): Promise<string> => {
    try {
      // For shadow page, we'll use a simpler approach without Firestore caching
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        return "API 키가 설정되지 않았습니다.";
      }

      const url = "https://api.openai.com/v1/chat/completions";

      const prompt = `다음 문장에서 '${word}'의 정의를 한국어로 제공해주세요. 단어의 의미를 문장의 맥락에 맞게 설명해주세요. 반드시 존대말로 작성해주세요.

문장: "${context}"

* 결과 형식:
뜻풀이: [문장 문맥에 맞는 단어 정의]
`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("GPT API Error:", error);
      return `뜻풀이를 가져오는 중 오류가 발생했습니다: ${error}`;
    }
  };

  // Function to fetch word definition from Free Dictionary API
  const fetchWordFromDictionaryApi = async (
    word: string
  ): Promise<any | null> => {
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
      );
      if (!response.ok) {
        // The API returns a specific JSON structure for "No Definitions Found"
        if (response.status === 404) {
          console.warn(`No definitions found for "${word}" from API.`);
          return null; // Or you could return the error JSON if you want to display it
        }
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      return data; // This will be an array of entries
    } catch (error) {
      console.error("Free Dictionary API Error:", error);
      return null;
    }
  };

  // Extract word from clicked position
  const extractWordFromText = (
    element: HTMLElement,
    clickX: number,
    clickY: number
  ): { word: string; rect?: DOMRect } => {
    try {
      const range = document.caretRangeFromPoint(clickX, clickY);
      if (!range) return { word: "" };

      const textContainer = element.closest(".transcript-text");
      if (!textContainer) return { word: "" };

      const fullText = textContainer.textContent || "";
      const clickedNode = range.startContainer;
      const clickOffset = range.startOffset;

      let currentPosition = 0;
      let clickPosition = -1;

      const findPosition = (node: Node) => {
        if (clickPosition >= 0) return;

        if (node === clickedNode) {
          clickPosition = currentPosition + clickOffset;
          return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          currentPosition += node.textContent?.length || 0;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          for (const child of Array.from(node.childNodes)) {
            findPosition(child);
          }
        }
      };

      findPosition(textContainer);

      if (clickPosition < 0) return { word: "" };

      let startPos = clickPosition;
      let endPos = clickPosition;

      while (
        startPos > 0 &&
        fullText[startPos - 1] !== " " &&
        fullText[startPos - 1] !== "—"
      ) {
        startPos--;
      }

      while (
        endPos < fullText.length &&
        fullText[endPos] !== " " &&
        fullText[endPos] !== "—"
      ) {
        endPos++;
      }

      let word = fullText.substring(startPos, endPos);
      word = word.replace(/[.,!?;:'"()[\]{}]|…/g, "").trim();

      return {
        word,
        rect:
          (range.startContainer.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : (range.startContainer as Element)
          )?.getBoundingClientRect() || undefined,
      };
    } catch (error) {
      console.error("Error extracting word from text:", error);
      return { word: "" };
    }
  };

  // Handle word click in transcript
  const handleTranscriptWordClick = async (e: React.MouseEvent) => {
    if (isAudioMode) {
      // In audio mode, handle YouTube seeking (existing functionality)
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const transcriptContainer = target.closest(
      ".transcript-text"
    ) as HTMLElement | null;
    if (!transcriptContainer) return;

    const fullText = transcriptContainer.textContent || "";
    if (!fullText) return;

    window.getSelection()?.removeAllRanges();

    const { word: clickedWord } = extractWordFromText(
      transcriptContainer,
      e.clientX,
      e.clientY
    );
    // Determine original form (lemma)
    const originalWord = getOriginalForm(clickedWord);

    if (
      !originalWord ||
      originalWord.length > 30 ||
      originalWord.split(/\s+/).length > 1
    ) {
      return;
    }

    // Get surrounding context
    const sentenceRegex = new RegExp(
      `[^.!?]*\b${originalWord.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      )}\b[^.!?]*[.!?]`,
      "i"
    );
    const sentenceMatch = fullText.match(sentenceRegex);
    const context = sentenceMatch ? sentenceMatch[0].trim() : fullText;

    // Open modal with original word
    setWordDefinitionModal({
      isOpen: true,
      word: originalWord,
      apiData: null,
      gptDefinition: "", // Initialize GPT definition
      isLoading: true,
    });

    document.body.style.overflow = "hidden";

    try {
      // Fetch definition from GPT (Korean)
      const gptDefinition = await getWordDefinition(originalWord, context);
      // Fetch dictionary data from the new API
      const dictionaryApiData = await fetchWordFromDictionaryApi(originalWord);

      setWordDefinitionModal((prev) => ({
        ...prev,
        gptDefinition: gptDefinition,
        apiData: dictionaryApiData,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Definition or API error:", error);
      setWordDefinitionModal((prev) => ({
        ...prev,
        gptDefinition:
          prev.gptDefinition || "뜻풀이를 가져오는 중 오류가 발생했습니다.",
        apiData: null,
        isLoading: false,
      }));
    }
  };

  // Toggle audio mode
  const toggleAudioMode = () => {
    setIsAudioMode(!isAudioMode);
  };

  // Clear highlight when audio mode is turned off
  useEffect(() => {
    if (!isAudioMode) {
      setActiveTimestampIndex(null);
    }
  }, [isAudioMode]);

  // Helper to get original form (basic lemmatization)
  const getOriginalForm = (word: string): string => {
    const w = word.toLowerCase();
    if (w.endsWith("ies") && w.length > 3) return w.slice(0, -3) + "y";
    if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3)
      return w.slice(0, -1);
    return w;
  };

  // Function to render internalization sentence with blank
  const renderInternalizationSentence = (
    sentence: InternalizationSentence,
    index: number
  ): React.ReactNode => {
    const words = sentence.text.split(" ");
    const displayElements: React.ReactNode[] = [];

    words.forEach((word, wordIndex) => {
      if (wordIndex === sentence.blankIndex) {
        // Show blank with underline
        displayElements.push(
          <span
            key={`blank-${wordIndex}`}
            style={{
              textDecoration: "underline",
              textDecorationStyle: "solid",
              textDecorationThickness: "2px",
              color: colors.primary,
              fontWeight: "bold",
              minWidth: "100px",
              display: "inline-block",
              textAlign: "center",
              margin: "0 4px",
            }}
          >
            {sentence.userResponse || "________"}
          </span>
        );
      } else {
        displayElements.push(
          <span key={`word-${wordIndex}`} style={{ margin: "0 4px" }}>
            {word}
          </span>
        );
      }
    });

    return (
      <ColorCodedSentence>
        <div
          style={{
            fontSize: "1.2rem",
            lineHeight: "1.8",
            marginBottom: "1rem",
          }}
        >
          {displayElements}
        </div>

        {sentence.isRecording && (
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.9rem",
              color: colors.text.muted,
            }}
          >
            <i>Recording... Say a word to fill the blank</i>
          </div>
        )}

        {sentence.userResponse && (
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "1rem",
              borderTop: `1px solid ${colors.border.light}`,
              fontSize: "0.9rem",
            }}
          >
            <p>
              <strong>Your Answer:</strong> "{sentence.userResponse}"
            </p>
            <p>
              <strong>Original Word:</strong> "{sentence.originalWord}"
            </p>
            {sentence.isCorrect !== undefined && (
              <StatusIndicator
                type={sentence.isCorrect ? "success" : "warning"}
              >
                {sentence.isCorrect
                  ? "✓ Good! You used a different word."
                  : "Try using a different word than the original."}
              </StatusIndicator>
            )}
          </div>
        )}

        {sentence.recordedAudioUrl && (
          <div style={{ marginTop: "0.75rem" }}>
            <audio
              id={`intern-audio-${index}`}
              controls
              src={sentence.recordedAudioUrl}
              style={{ width: "100%" }}
            />
          </div>
        )}
      </ColorCodedSentence>
    );
  };

  // Function to get OpenAI ephemeral token
  const getOpenAIEphemeralToken = async (): Promise<string> => {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    const response = await fetch(
      "https://api.openai.com/v1/realtime/transcription_sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get ephemeral token: ${response.status}`);
    }

    const data = await response.json();
    return data.client_secret;
  };

  // Function to start OpenAI recording
  const startOpenAIRecording = async (sentenceIndex: number) => {
    if (isOpenAIRecording) return;

    setIsOpenAIRecording(true);
    setCurrentOpenAIRecordingIndex(sentenceIndex);
    recordedAudioChunksRef.current = [];

    // Update sentence state
    setInternalizationResults((prev) =>
      prev.map((s, i) =>
        i === sentenceIndex
          ? {
              ...s,
              isRecording: true,
              userResponse: "",
              transcriptionError: "",
              isCorrect: undefined,
            }
          : s
      )
    );

    try {
      // Get ephemeral token for WebSocket authentication
      const token = await getOpenAIEphemeralToken();

      // Create WebSocket connection with authentication
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?intent=transcription&authorization=Bearer+${token}`
      );
      openaiWebSocketRef.current = ws;

      ws.onopen = () => {
        console.log("[OpenAI] WebSocket connected");

        // Send configuration (authentication is handled in the WebSocket URL)
        ws.send(
          JSON.stringify({
            type: "transcription_session.update",
            input_audio_format: "pcm16",
            input_audio_transcription: {
              model: "gpt-4o-mini-transcribe",
              prompt: "",
              language: "en",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            input_audio_noise_reduction: {
              type: "near_field",
            },
          })
        );
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("[OpenAI] Received message:", message);

        if (message.type === "input_audio_buffer.committed") {
          console.log("[OpenAI] Audio buffer committed");
        } else if (message.type === "transcription.text.delta") {
          // Update partial transcription
          setInternalizationResults((prev) =>
            prev.map((s, i) =>
              i === sentenceIndex
                ? { ...s, userResponse: message.text || "" }
                : s
            )
          );
        } else if (message.type === "transcription.text.done") {
          // Final transcription
          const transcribedText = message.text?.trim() || "";
          const originalWord =
            internalizationResults[sentenceIndex]?.originalWord;
          const isCorrect =
            transcribedText.toLowerCase() !== originalWord?.toLowerCase();

          setInternalizationResults((prev) =>
            prev.map((s, i) =>
              i === sentenceIndex
                ? {
                    ...s,
                    userResponse: transcribedText,
                    isCorrect,
                    isRecording: false,
                  }
                : s
            )
          );
        }
      };

      ws.onerror = (error) => {
        console.error("[OpenAI] WebSocket error:", error);
        setInternalizationResults((prev) =>
          prev.map((s, i) =>
            i === sentenceIndex
              ? {
                  ...s,
                  transcriptionError: "WebSocket connection error",
                  isRecording: false,
                }
              : s
          )
        );
      };

      ws.onclose = () => {
        console.log("[OpenAI] WebSocket closed");
        setIsOpenAIRecording(false);
        setCurrentOpenAIRecordingIndex(null);
      };

      // Start Web Audio API for recording
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      await audioContextRef.current.audioWorklet.addModule(
        "/scripts/audio-processor.js"
      );

      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      microphoneSourceRef.current =
        audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

      audioWorkletNodeRef.current = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
        { processorOptions: { sampleRate: audioContextRef.current.sampleRate } }
      );

      audioWorkletNodeRef.current.port.onmessage = (
        event: MessageEvent<ArrayBuffer>
      ) => {
        if (event.data instanceof ArrayBuffer && event.data.byteLength > 0) {
          const float32Data = new Float32Array(event.data.slice(0));
          recordedAudioChunksRef.current.push(float32Data);

          // Convert to PCM16 and send to OpenAI
          if (openaiWebSocketRef.current?.readyState === WebSocket.OPEN) {
            const int16Buffer = convertFloat32ToInt16(event.data.slice(0));
            const base64Audio = btoa(
              String.fromCharCode(...Array.from(new Uint8Array(int16Buffer)))
            );

            openaiWebSocketRef.current.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64Audio,
              })
            );
          }
        }
      };

      microphoneSourceRef.current.connect(audioWorkletNodeRef.current);
    } catch (error: any) {
      console.error("Error starting OpenAI recording:", error);
      setInternalizationResults((prev) =>
        prev.map((s, i) =>
          i === sentenceIndex
            ? { ...s, transcriptionError: error.message, isRecording: false }
            : s
        )
      );
      setIsOpenAIRecording(false);
      setCurrentOpenAIRecordingIndex(null);
    }
  };

  // Function to stop OpenAI recording
  const stopOpenAIRecording = async () => {
    if (!isOpenAIRecording || currentOpenAIRecordingIndex === null) return;

    const recordingIndex = currentOpenAIRecordingIndex;

    // Stop Web Audio API
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.onmessage = null;
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (microphoneSourceRef.current) {
      microphoneSourceRef.current.disconnect();
      microphoneSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close OpenAI WebSocket
    if (openaiWebSocketRef.current) {
      openaiWebSocketRef.current.close();
      openaiWebSocketRef.current = null;
    }

    // Create audio URL from recorded chunks
    let audioUrl: string | null = null;
    if (recordedAudioChunksRef.current.length > 0) {
      try {
        const totalLength = recordedAudioChunksRef.current.reduce(
          (acc, val) => acc + val.length,
          0
        );
        const concatenatedPcm = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of recordedAudioChunksRef.current) {
          concatenatedPcm.set(chunk, offset);
          offset += chunk.length;
        }
        const wavBlob = encodeWAV(concatenatedPcm, 16000);
        audioUrl = URL.createObjectURL(wavBlob);
      } catch (error) {
        console.error("Error encoding WAV:", error);
      }
    }
    recordedAudioChunksRef.current = [];

    // Update state
    setIsOpenAIRecording(false);
    setCurrentOpenAIRecordingIndex(null);
    setInternalizationResults((prev) =>
      prev.map((s, i) =>
        i === recordingIndex
          ? { ...s, recordedAudioUrl: audioUrl, isRecording: false }
          : s
      )
    );
  };

  // Function to render sentence creation exercise
  const renderSentenceCreation = (
    wordItem: SentenceCreationWord,
    index: number
  ): React.ReactNode => {
    return (
      <ColorCodedSentence>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h3
            style={{
              color: colors.primary,
              fontSize: "2rem",
              margin: "1rem 0",
            }}
          >
            {wordItem.word}
          </h3>
          <p style={{ color: colors.text.secondary, fontSize: "1rem" }}>
            Create a sentence using this word. You can write or speak your
            response.
          </p>
        </div>

        {/* Input Mode Toggle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <Button
            onClick={() => handleInputModeChange(index, "write")}
            style={{
              background:
                wordItem.inputMode === "write"
                  ? `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`
                  : colors.border.medium,
              color:
                wordItem.inputMode === "write"
                  ? colors.text.inverse
                  : colors.text.muted,
            }}
          >
            <span>
              <PencilSquareIcon width={16} height={16} />
              Write
            </span>
          </Button>
          <Button
            onClick={() => handleInputModeChange(index, "speak")}
            style={{
              background:
                wordItem.inputMode === "speak"
                  ? `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`
                  : colors.border.medium,
              color:
                wordItem.inputMode === "speak"
                  ? colors.text.inverse
                  : colors.text.muted,
            }}
          >
            <span>🎤 Speak</span>
          </Button>
        </div>

        {/* Input Area */}
        {wordItem.inputMode === "write" ? (
          <div style={{ marginBottom: "1rem" }}>
            <textarea
              value={wordItem.userSentence || ""}
              onChange={(e) => handleTextInput(index, e.target.value)}
              placeholder={`Write a sentence using "${wordItem.word}"...`}
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "1rem",
                fontSize: "1rem",
                border: `1px solid ${colors.border.medium}`,
                borderRadius: "8px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>
        ) : (
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <Button
                onClick={() => {
                  if (wordItem.isRecording) {
                    stopSentenceCreationRecording();
                  } else {
                    startSentenceCreationRecording(index);
                  }
                }}
                disabled={isOpenAIRecording && !wordItem.isRecording}
              >
                <span>
                  {wordItem.isRecording ? (
                    <>
                      <LoadingSpinner />
                      Stop Recording
                    </>
                  ) : (
                    "🎤 Record Sentence"
                  )}
                </span>
              </Button>
            </div>

            {wordItem.isRecording && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.9rem",
                  color: colors.text.muted,
                }}
              >
                <i>Recording... Speak your sentence using "{wordItem.word}"</i>
              </div>
            )}
          </div>
        )}

        {/* Display Results */}
        {(wordItem.userSentence || wordItem.spokenSentence) && (
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "1rem",
              borderTop: `1px solid ${colors.border.light}`,
              fontSize: "0.95rem",
            }}
          >
            <p>
              <strong>Your Sentence:</strong>
            </p>
            <div
              style={{
                background: colors.background,
                padding: "1rem",
                borderRadius: "8px",
                margin: "0.5rem 0",
                fontStyle: "italic",
              }}
            >
              "
              {wordItem.inputMode === "write"
                ? wordItem.userSentence
                : wordItem.spokenSentence}
              "
            </div>

            {wordItem.userSentence || wordItem.spokenSentence ? (
              <StatusIndicator type="success">
                ✓ Sentence created successfully!
              </StatusIndicator>
            ) : null}
          </div>
        )}

        {wordItem.recordedAudioUrl && (
          <div style={{ marginTop: "0.75rem" }}>
            <audio
              id={`creation-audio-${index}`}
              controls
              src={wordItem.recordedAudioUrl}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {wordItem.transcriptionError && (
          <StatusIndicator type="error">
            {wordItem.transcriptionError}
          </StatusIndicator>
        )}
      </ColorCodedSentence>
    );
  };

  // Function to handle input mode change
  const handleInputModeChange = (index: number, mode: "write" | "speak") => {
    setSentenceCreationResults((prev) =>
      prev.map((item, i) => (i === index ? { ...item, inputMode: mode } : item))
    );
  };

  // Function to handle text input
  const handleTextInput = (index: number, text: string) => {
    setSentenceCreationResults((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, userSentence: text, isCompleted: text.trim().length > 0 }
          : item
      )
    );
  };

  // Function to start sentence creation recording
  const startSentenceCreationRecording = async (wordIndex: number) => {
    if (isOpenAIRecording) return;

    setIsOpenAIRecording(true);
    setCurrentOpenAIRecordingIndex(wordIndex);
    recordedAudioChunksRef.current = [];

    // Update word state
    setSentenceCreationResults((prev) =>
      prev.map((word, i) =>
        i === wordIndex
          ? {
              ...word,
              isRecording: true,
              spokenSentence: "",
              transcriptionError: "",
            }
          : word
      )
    );

    try {
      // Get ephemeral token for WebSocket authentication
      const token = await getOpenAIEphemeralToken();

      // Create WebSocket connection with authentication
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?intent=transcription&authorization=Bearer+${token}`
      );
      openaiWebSocketRef.current = ws;

      ws.onopen = () => {
        console.log("[OpenAI] WebSocket connected for sentence creation");

        // Send configuration (authentication is handled in the WebSocket URL)
        ws.send(
          JSON.stringify({
            type: "transcription_session.update",
            input_audio_format: "pcm16",
            input_audio_transcription: {
              model: "gpt-4o-mini-transcribe",
              prompt: "",
              language: "en",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000, // Longer silence for sentences
            },
            input_audio_noise_reduction: {
              type: "near_field",
            },
          })
        );
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log(
          "[OpenAI] Received message for sentence creation:",
          message
        );

        if (message.type === "input_audio_buffer.committed") {
          console.log("[OpenAI] Audio buffer committed for sentence creation");
        } else if (message.type === "transcription.text.delta") {
          // Update partial transcription
          setSentenceCreationResults((prev) =>
            prev.map((word, i) =>
              i === wordIndex
                ? { ...word, spokenSentence: message.text || "" }
                : word
            )
          );
        } else if (message.type === "transcription.text.done") {
          // Final transcription
          const transcribedText = message.text?.trim() || "";

          setSentenceCreationResults((prev) =>
            prev.map((word, i) =>
              i === wordIndex
                ? {
                    ...word,
                    spokenSentence: transcribedText,
                    isCompleted: transcribedText.length > 0,
                    isRecording: false,
                  }
                : word
            )
          );
        }
      };

      ws.onerror = (error) => {
        console.error("[OpenAI] WebSocket error for sentence creation:", error);
        setSentenceCreationResults((prev) =>
          prev.map((word, i) =>
            i === wordIndex
              ? {
                  ...word,
                  transcriptionError: "WebSocket connection error",
                  isRecording: false,
                }
              : word
          )
        );
      };

      ws.onclose = () => {
        console.log("[OpenAI] WebSocket closed for sentence creation");
        setIsOpenAIRecording(false);
        setCurrentOpenAIRecordingIndex(null);
      };

      // Start Web Audio API for recording
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      await audioContextRef.current.audioWorklet.addModule(
        "/scripts/audio-processor.js"
      );

      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      microphoneSourceRef.current =
        audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

      audioWorkletNodeRef.current = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
        { processorOptions: { sampleRate: audioContextRef.current.sampleRate } }
      );

      audioWorkletNodeRef.current.port.onmessage = (
        event: MessageEvent<ArrayBuffer>
      ) => {
        if (event.data instanceof ArrayBuffer && event.data.byteLength > 0) {
          const float32Data = new Float32Array(event.data.slice(0));
          recordedAudioChunksRef.current.push(float32Data);

          // Convert to PCM16 and send to OpenAI
          if (openaiWebSocketRef.current?.readyState === WebSocket.OPEN) {
            const int16Buffer = convertFloat32ToInt16(event.data.slice(0));
            const base64Audio = btoa(
              String.fromCharCode(...Array.from(new Uint8Array(int16Buffer)))
            );

            openaiWebSocketRef.current.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64Audio,
              })
            );
          }
        }
      };

      microphoneSourceRef.current.connect(audioWorkletNodeRef.current);
    } catch (error: any) {
      console.error("Error starting sentence creation recording:", error);
      setSentenceCreationResults((prev) =>
        prev.map((word, i) =>
          i === wordIndex
            ? { ...word, transcriptionError: error.message, isRecording: false }
            : word
        )
      );
      setIsOpenAIRecording(false);
      setCurrentOpenAIRecordingIndex(null);
    }
  };

  // Function to stop sentence creation recording
  const stopSentenceCreationRecording = async () => {
    if (!isOpenAIRecording || currentOpenAIRecordingIndex === null) return;

    const recordingIndex = currentOpenAIRecordingIndex;

    // Stop Web Audio API
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.port.onmessage = null;
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (microphoneSourceRef.current) {
      microphoneSourceRef.current.disconnect();
      microphoneSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close OpenAI WebSocket
    if (openaiWebSocketRef.current) {
      openaiWebSocketRef.current.close();
      openaiWebSocketRef.current = null;
    }

    // Create audio URL from recorded chunks
    let audioUrl: string | null = null;
    if (recordedAudioChunksRef.current.length > 0) {
      try {
        const totalLength = recordedAudioChunksRef.current.reduce(
          (acc, val) => acc + val.length,
          0
        );
        const concatenatedPcm = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of recordedAudioChunksRef.current) {
          concatenatedPcm.set(chunk, offset);
          offset += chunk.length;
        }
        const wavBlob = encodeWAV(concatenatedPcm, 16000);
        audioUrl = URL.createObjectURL(wavBlob);
      } catch (error) {
        console.error("Error encoding WAV for sentence creation:", error);
      }
    }
    recordedAudioChunksRef.current = [];

    // Update state
    setIsOpenAIRecording(false);
    setCurrentOpenAIRecordingIndex(null);
    setSentenceCreationResults((prev) =>
      prev.map((word, i) =>
        i === recordingIndex
          ? { ...word, recordedAudioUrl: audioUrl, isRecording: false }
          : word
      )
    );
  };

  // The Azure recording functions are defined above in the flow

  return (
    <ShadowContainer>
      <VideoContainer>
        {youtubeLoading && (
          <LoadingContainer>
            <div className="spinner"></div>
            <div className="text">Loading YouTube video...</div>
          </LoadingContainer>
        )}
        {youtubeError && (
          <ErrorMessage>Error loading video: {youtubeError}</ErrorMessage>
        )}
        {!youtubeLoading && !youtubeError && youtubeUrl && (
          <iframe
            id="youtube-player-iframe"
            width="100%"
            height="100%"
            src={youtubeUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        )}
        {!youtubeLoading && !youtubeError && !youtubeUrl && (
          <StatusIndicator type="info">
            YouTube video URL not available.
          </StatusIndicator>
        )}
      </VideoContainer>

      {/* Step Progress Indicator */}
      <StepProgressContainer>
        {steps.map((step, _index) => (
          <StepItem
            key={step.id}
            isActive={currentStep === step.id}
            isCompleted={currentStep > step.id}
          >
            <StepCircle
              isActive={currentStep === step.id}
              isCompleted={currentStep > step.id}
              onClick={() => setCurrentStep(step.id)}
            >
              {step.id}
            </StepCircle>
            <StepLabel isActive={currentStep === step.id}>
              {step.name}
            </StepLabel>
          </StepItem>
        ))}
      </StepProgressContainer>

      {/* Step-based Content */}
      <StepContent>
        {/* Step 1: Script Study */}
        {currentStep === 1 &&
          !youtubeLoading &&
          !youtubeError &&
          videoTimestamps.length > 0 && (
            <>
              <AudioModeToggle
                onClick={toggleAudioMode}
                className={isAudioMode ? "active" : ""}
              >
                <span>
                  {isAudioMode ? "✕ 오디오 모드 해제" : "🎧 오디오 모드"}
                </span>
              </AudioModeToggle>
              <TranscriptContainer
                ref={transcriptContainerRef}
                className="transcript-text"
                onClick={handleTranscriptWordClick}
              >
                {videoTimestamps.map((item, index) => (
                  <React.Fragment key={`${item.word}-${index}-${item.start}`}>
                    <TranscriptWord
                      isActive={index === activeTimestampIndex}
                      onClick={(e) => {
                        if (isAudioMode && playerRef.current && isPlayerReady) {
                          e.stopPropagation();
                          playerRef.current.seekTo(item.start, true);
                          setActiveTimestampIndex(index);
                        }
                      }}
                    >
                      {item.word}
                    </TranscriptWord>
                    {index < videoTimestamps.length - 1 && " "}
                  </React.Fragment>
                ))}
              </TranscriptContainer>
            </>
          )}

        {/* Step 2: Shadowing Practice */}
        {currentStep === 2 && sentencesToAssess.length > 0 && (
          <>
            <CarouselContainer>
              <CarouselContent>
                {sentencesToAssess.map((sentence, index) => (
                  <CarouselSlide
                    key={sentence.id}
                    isActive={index === currentSentenceIndex}
                  >
                    <SentenceRow>
                      <SentenceAssessment sentence={sentence} index={index} />

                      <SentenceControls>
                        <Button
                          onClick={() => {
                            if (
                              isRecordingActive &&
                              currentRecordingSentenceIndex ===
                                currentSentenceIndex
                            ) {
                              stopCurrentSentenceRecording();
                            } else if (!isRecordingActive) {
                              startSentenceRecording(currentSentenceIndex);
                            }
                          }}
                          disabled={
                            isRecordingActive &&
                            currentRecordingSentenceIndex !==
                              currentSentenceIndex
                          }
                        >
                          <span>
                            {isRecordingActive &&
                            currentRecordingSentenceIndex ===
                              currentSentenceIndex ? (
                              <>
                                <LoadingSpinner />
                                Stop Recording
                              </>
                            ) : (
                              "Start Recording"
                            )}
                          </span>
                        </Button>
                      </SentenceControls>
                      {sentence.assessmentError && (
                        <StatusIndicator type="error">
                          {sentence.assessmentError}
                        </StatusIndicator>
                      )}
                    </SentenceRow>
                  </CarouselSlide>
                ))}
              </CarouselContent>
            </CarouselContainer>

            <CarouselNavigation>
              <NavigationButton
                onClick={() =>
                  setCurrentSentenceIndex(Math.max(0, currentSentenceIndex - 1))
                }
                disabled={currentSentenceIndex === 0}
              >
                <span>← Previous</span>
              </NavigationButton>

              <ProgressBarContainer>
                <ProgressBarFill
                  progress={
                    ((currentSentenceIndex + 1) / sentencesToAssess.length) *
                    100
                  }
                />
              </ProgressBarContainer>

              <NavigationButton
                onClick={() =>
                  setCurrentSentenceIndex(
                    Math.min(
                      sentencesToAssess.length - 1,
                      currentSentenceIndex + 1
                    )
                  )
                }
                disabled={
                  currentSentenceIndex === sentencesToAssess.length - 1 ||
                  !checkScoreCriteria()
                }
              >
                <span>Next →</span>
              </NavigationButton>
            </CarouselNavigation>

            <ProgressInfo>
              Sentence {currentSentenceIndex + 1} of {sentencesToAssess.length}
            </ProgressInfo>
          </>
        )}

        {/* Step 3: Internalization */}
        {currentStep === 3 && (
          <>
            {/* Mode Toggle */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "1rem",
                marginBottom: "2rem",
              }}
            >
              <Button
                onClick={() => setInternalizationMode("fill-blank")}
                style={{
                  background:
                    internalizationMode === "fill-blank"
                      ? `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`
                      : colors.border.medium,
                  color:
                    internalizationMode === "fill-blank"
                      ? colors.text.inverse
                      : colors.text.muted,
                }}
              >
                <span>Fill in the Blank</span>
              </Button>
              <Button
                onClick={() => setInternalizationMode("create-sentences")}
                style={{
                  background:
                    internalizationMode === "create-sentences"
                      ? `linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark})`
                      : colors.border.medium,
                  color:
                    internalizationMode === "create-sentences"
                      ? colors.text.inverse
                      : colors.text.muted,
                }}
              >
                <span>Create Sentences</span>
              </Button>
            </div>

            {/* Fill in the Blank Mode */}
            {internalizationMode === "fill-blank" && (
              <>
                <CarouselContainer>
                  <CarouselContent>
                    {internalizationResults.map((sentence, index) => (
                      <CarouselSlide
                        key={sentence.id}
                        isActive={index === currentInternalizationIndex}
                      >
                        <SentenceRow>
                          {renderInternalizationSentence(sentence, index)}

                          <SentenceControls>
                            <Button
                              onClick={() => {
                                if (
                                  isOpenAIRecording &&
                                  currentOpenAIRecordingIndex ===
                                    currentInternalizationIndex
                                ) {
                                  stopOpenAIRecording();
                                } else if (!isOpenAIRecording) {
                                  startOpenAIRecording(
                                    currentInternalizationIndex
                                  );
                                }
                              }}
                              disabled={
                                isOpenAIRecording &&
                                currentOpenAIRecordingIndex !==
                                  currentInternalizationIndex
                              }
                            >
                              <span>
                                {isOpenAIRecording &&
                                currentOpenAIRecordingIndex ===
                                  currentInternalizationIndex ? (
                                  <>
                                    <LoadingSpinner />
                                    Stop Recording
                                  </>
                                ) : (
                                  "Record Answer"
                                )}
                              </span>
                            </Button>
                          </SentenceControls>

                          {sentence.transcriptionError && (
                            <StatusIndicator type="error">
                              {sentence.transcriptionError}
                            </StatusIndicator>
                          )}
                        </SentenceRow>
                      </CarouselSlide>
                    ))}
                  </CarouselContent>
                </CarouselContainer>

                <CarouselNavigation>
                  <NavigationButton
                    onClick={() =>
                      setCurrentInternalizationIndex(
                        Math.max(0, currentInternalizationIndex - 1)
                      )
                    }
                    disabled={currentInternalizationIndex === 0}
                  >
                    <span>← Previous</span>
                  </NavigationButton>

                  <ProgressBarContainer>
                    <ProgressBarFill
                      progress={
                        ((currentInternalizationIndex + 1) /
                          internalizationResults.length) *
                        100
                      }
                    />
                  </ProgressBarContainer>

                  <NavigationButton
                    onClick={() =>
                      setCurrentInternalizationIndex(
                        Math.min(
                          internalizationResults.length - 1,
                          currentInternalizationIndex + 1
                        )
                      )
                    }
                    disabled={
                      currentInternalizationIndex ===
                      internalizationResults.length - 1
                    }
                  >
                    <span>Next →</span>
                  </NavigationButton>
                </CarouselNavigation>

                <ProgressInfo>
                  Sentence {currentInternalizationIndex + 1} of{" "}
                  {internalizationResults.length}
                </ProgressInfo>
              </>
            )}

            {/* Create Sentences Mode */}
            {internalizationMode === "create-sentences" && (
              <>
                <CarouselContainer>
                  <CarouselContent>
                    {sentenceCreationResults.map((wordItem, index) => (
                      <CarouselSlide
                        key={wordItem.id}
                        isActive={index === currentCreationIndex}
                      >
                        <SentenceRow>
                          {renderSentenceCreation(wordItem, index)}
                        </SentenceRow>
                      </CarouselSlide>
                    ))}
                  </CarouselContent>
                </CarouselContainer>

                <CarouselNavigation>
                  <NavigationButton
                    onClick={() =>
                      setCurrentCreationIndex(
                        Math.max(0, currentCreationIndex - 1)
                      )
                    }
                    disabled={currentCreationIndex === 0}
                  >
                    <span>← Previous</span>
                  </NavigationButton>

                  <ProgressBarContainer>
                    <ProgressBarFill
                      progress={
                        ((currentCreationIndex + 1) /
                          sentenceCreationResults.length) *
                        100
                      }
                    />
                  </ProgressBarContainer>

                  <NavigationButton
                    onClick={() =>
                      setCurrentCreationIndex(
                        Math.min(
                          sentenceCreationResults.length - 1,
                          currentCreationIndex + 1
                        )
                      )
                    }
                    disabled={
                      currentCreationIndex ===
                      sentenceCreationResults.length - 1
                    }
                  >
                    <span>Next →</span>
                  </NavigationButton>
                </CarouselNavigation>

                <ProgressInfo>
                  Word {currentCreationIndex + 1} of{" "}
                  {sentenceCreationResults.length}
                </ProgressInfo>
              </>
            )}
          </>
        )}

        {/* Step 4: Analysis */}
        {currentStep === 4 && <AnalysisReport sentences={sentencesToAssess} />}
      </StepContent>

      {overallError && <ErrorMessage>{overallError}</ErrorMessage>}

      {/* Word definition modal */}
      <WordDefinitionModal
        modalState={wordDefinitionModal}
        onClose={() => {
          setWordDefinitionModal((prev) => ({
            ...prev,
            isOpen: false,
            apiData: null,
            gptDefinition: "",
          }));
          document.body.style.overflow = "";
        }}
      />
    </ShadowContainer>
  );
};

export default ShadowClient;
