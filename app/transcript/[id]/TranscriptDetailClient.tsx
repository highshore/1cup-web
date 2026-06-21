"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useParams, useRouter } from "next/navigation";
import styled from "styled-components";
import { db } from "../../lib/firebase/firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { useSoniox } from "../hooks/useSoniox";
import { colors } from "../../lib/constants/colors";
import { UserAvatar } from "../../lib/features/meetup/components/user_avatar";
import {
  fetchUserProfiles,
  UserProfile,
} from "../../lib/features/meetup/services/user_service";
import { useTranscriptCopilot } from "../hooks/useTranscriptCopilot";
import CopilotTranscriptSnippet from "../components/CopilotTranscriptSnippet";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase/firebase";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { DocumentTextIcon } from "@heroicons/react/24/outline";

ChartJS.register(ArcElement, Tooltip, Legend);

// Styled components matching the original RecordTranscriptClient
const ConversationDetailContainer = styled.div`
  width: 100%;
`;

const ConversationDetailLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
`;

const AppSpeechDetails = styled.section`
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  margin-bottom: 1.5rem;
`;

const SectionHeader = styled.h2`
  font-size: 1.125rem;
  font-weight: 900;
  color: #050505;
  margin: 0 0 1rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #050505;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const KeywordsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const KeywordTag = styled.span`
  background: #ffffff;
  color: #050505;
  border: 1.5px solid #050505;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 700;
`;

// Removed ProviderSelector (Soniox-only)

const SpeakersContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
`;

const SpeakerInfo = styled.div`
  font-size: 0.875rem;
  color: #475569;
`;

const TranscriptSnippet = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  width: 100%;
  transition: background-color 0.3s ease;
`;

const SpeakerAvatar = styled.button<{ $bgColor?: string; $textColor?: string }>`
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  border: none;
  background-color: ${(props) => props.$bgColor || "#e5e7eb"};
  color: ${(props) => props.$textColor || "#4b5563"};
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: box-shadow 0.2s;

  &:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
`;

const TranscriptContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  width: 100%;
  min-width: 0;
`;

const TranscriptHeadRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SpeakerName = styled.span<{ $color?: string }>`
  font-weight: 600;
  font-size: 1rem;
  color: ${(props) => props.$color || "#1e293b"};
`;

const Timestamp = styled.span`
  font-size: 0.875rem;
  color: #64748b;
`;

const TranscriptBody = styled.div`
  line-height: 1.7;
  color: #334155;
  cursor: default;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  margin-top: 0.25rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  width: 100%;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  white-space: normal;
`;

const WordSpan = styled.span<{
  $lowConfidence?: boolean;
  $isPartial?: boolean;
  $isCurrentlyPlaying?: boolean;
  $isPunctuation?: boolean;
}>`
  color: ${(props) => {
    if (props.$isCurrentlyPlaying) return "#ffffff";
    if (props.$lowConfidence) return "#b91c1c";
    if (props.$isPartial) return "#64748b";
    return "inherit";
  }};
  background-color: ${(props) => {
    if (props.$isCurrentlyPlaying) return "#3b82f6";
    return "transparent";
  }};
  font-weight: ${(props) => {
    if (props.$isCurrentlyPlaying) return "600";
    if (props.$lowConfidence) return "600";
    return "normal";
  }};
  font-style: ${(props) => (props.$isPartial ? "italic" : "normal")};
  text-decoration: ${(props) => (props.$lowConfidence ? "underline" : "none")};
  text-decoration-color: #fecaca;
  text-underline-offset: 2px;
  transition: all 0.2s ease;
  border-radius: 3px;
  word-break: break-word;
  opacity: ${(props) => (props.$isPartial ? "0.7" : "1")};
  padding: ${(props) => (props.$isCurrentlyPlaying ? "0.125rem 0.25rem" : "0")};
  cursor: pointer;

  &:hover {
    background-color: ${(props) =>
      props.$isCurrentlyPlaying ? "#2563eb" : "#eff6ff"};
  }
`;

const Container = styled.div`
  min-height: 100vh;
  color: #334155;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding-bottom: 80px;
`;

// Removed sticky header and page title for a cleaner detail view

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const BackButton = styled.button`
  padding: 0.5rem 1rem;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 800;
  box-shadow: 2px 2px 0 #050505;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;

  &:hover {
    background: #f47a4a;
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }
`;

const RecordButton = styled.button<{ $isRecording: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.4rem;
  border: 2px solid #050505;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 3px 3px 0 #050505;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;

  ${(props) =>
    props.$isRecording
      ? `
    background: #d64545;
    color: #ffffff;
  `
      : `
    background: #f47a4a;
    color: #050505;
  `}

  &:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    box-shadow: none;
    cursor: not-allowed;
  }
`;

const Content = styled.div`
  padding: 2rem 0;
  max-width: 900px;
  margin: 0 auto;
  background: transparent;
`;

const SessionInfo = styled.div`
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 16px;
  border: 3px solid #050505;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  margin-bottom: 2rem;
  height: 100%;
`;

const SessionInfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr minmax(260px, 360px);
  gap: 1rem;
  align-items: stretch;
  margin-bottom: 2rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ChartPanel = styled.div`
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 16px;
  border: 3px solid #050505;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  height: 100%;
`;

const ChartTitle = styled.h3`
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 900;
  color: #050505;
`;

const SessionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 900;
  color: #050505;
  margin: 0 0 1rem 0;
`;

const SessionDetail = styled.div`
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  color: #475569;

  strong {
    color: #1e293b;
  }
`;

const ParticipantsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const ParticipantChip = styled.div<{ $isLeader?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.8rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 800;
  background: ${(props) => (props.$isLeader ? "#f47a4a" : "#ffffff")};
  color: #050505;
  border: 2px solid #050505;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${(props) => (props.$isLeader ? "#bfdbfe" : "#e2e8f0")};
  }
`;

const LoadingMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #64748b;
  font-size: 1rem;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
`;

const ErrorMessage = styled.div`
  margin-bottom: 2rem;
  padding: 1rem 1.5rem;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 8px;
  border: 1px solid #fecaca;
  font-size: 0.875rem;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #64748b;
  font-style: italic;
  padding: 4rem 2rem;
  font-size: 1rem;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
`;

const CopilotPanel = styled.section`
  background: #ffffff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  padding: 1rem;
`;

const CopilotHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.75rem;
`;

const CopilotTitle = styled.h3`
  color: #1e3a8a;
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
`;

const CopilotRefreshButton = styled.button`
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

const CopilotSummary = styled.p`
  margin: 0 0 0.75rem 0;
  color: #334155;
  line-height: 1.5;
`;

const CopilotGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const CopilotColumnTitle = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 0.35rem;
  text-transform: uppercase;
`;

const CopilotList = styled.ul`
  margin: 0;
  padding-left: 1rem;
  color: #334155;
  line-height: 1.55;
  font-size: 0.875rem;
`;

const SavedDataIndicator = styled.div`
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #0369a1;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .indicator-icon {
    color: #0ea5e9;
    font-size: 1rem;
  }

  .metadata {
    font-size: 0.75rem;
    color: #0284c7;
    margin-top: 0.25rem;
  }
`;

const LegendContent = styled.div`
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 0.75rem;
`;

const LegendSpeakers = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: #64748b;
`;

const LegendColor = styled.div<{ $color: string }>`
  width: 8px;
  height: 8px;
  background-color: ${(props) => props.$color};
  border-radius: 50%;
  margin-right: 0.375rem;
`;

const ConfidenceNote = styled.div`
  font-size: 0.6875rem;
  color: #94a3b8;
`;

// Audio Player Components
const AudioPlayerContainer = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%)
    translateY(${(props) => (props.$isVisible ? "0" : "100%")});
  width: 100%;
  max-width: 850px;
  background: #1e293b;
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  z-index: 100;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: 0.8rem;
    flex-wrap: wrap;
  }
`;

const AudioControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin: 0 0.3rem;
  flex-wrap: nowrap;

  @media (max-width: 768px) {
    gap: 0.5rem;
    margin: 0 0.2rem;
  }
`;

const AudioButton = styled.button`
  background: transparent;
  color: white;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  width: 40px;
  height: 40px;
  border-radius: 50%;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &:active {
    background: rgba(255, 255, 255, 0.2);
  }

  @media (max-width: 768px) {
    font-size: 1.3rem;
    width: 36px;
    height: 36px;
  }
`;

const AudioProgress = styled.div`
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  margin: 0 1rem;
  cursor: pointer;

  @media (max-width: 768px) {
    margin: 0 0.8rem;
  }
`;

const AudioProgressFill = styled.div<{ $progress: number }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${(props) => props.$progress}%;
  background: #3b82f6;
  border-radius: 3px;
`;

const AudioTime = styled.div`
  font-size: 0.9rem;
  color: white;
  margin: 0 0.5rem;
  min-width: 50px;
  text-align: center;

  @media (max-width: 768px) {
    font-size: 0.8rem;
    min-width: 44px;
  }
`;

const SpeedButton = styled.button<{ $active: boolean }>`
  background: ${(props) => (props.$active ? "#3b82f6" : "transparent")};
  color: white;
  border: 1px solid #3b82f6;
  border-radius: 20px;
  padding: 0.3rem 0.6rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #3b82f6;
  }

  &:active {
    transform: scale(0.95);
  }

  @media (max-width: 768px) {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
`;

// Keyword Management Components
const KeywordManagementSection = styled.div`
  margin-bottom: 1rem;
`;

const KeywordInputContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const KeywordInput = styled.input`
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const AddKeywordButton = styled.button`
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: #2563eb;
  }

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
`;

const KeywordsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const KeywordChip = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: #f1f5f9;
  color: #475569;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
`;

const RemoveKeywordButton = styled.button`
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
  }
`;

const ArticleLink = styled.a`
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
`;

// Speaker Assignment Modal Components
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

const ModalTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;
  text-align: center;
`;

const ModalSubtitle = styled.p`
  color: #64748b;
  margin: 0 0 2rem 0;
  text-align: center;
  font-size: 0.875rem;
`;

const ParticipantGrid = styled.div`
  display: grid;
  gap: 0.75rem;
  margin-bottom: 2rem;
`;

const ParticipantOption = styled.button`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;

  &:hover {
    border-color: #3b82f6;
    background: #f8fafc;
  }

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const ParticipantInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ParticipantName = styled.div`
  font-weight: 600;
  color: #1e293b;
  font-size: 1rem;
`;

const ParticipantRole = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 500;
`;

const ModalActions = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
`;

const ModalButton = styled.button<{ $variant?: "primary" | "secondary" }>`
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  ${(props) =>
    props.$variant === "primary"
      ? `
    background: #3b82f6;
    color: white;
    &:hover {
      background: #2563eb;
    }
  `
      : `
    background: #f1f5f9;
    color: #475569;
    &:hover {
      background: #e2e8f0;
    }
  `}

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  padding: 0.5rem 0.9rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid ${props => (props.$active ? 'rgba(0,0,0,0.08)' : '#e5e7eb')};

  ${props =>
    props.$active
      ? `
    background: linear-gradient(180deg, #1f2937 0%, #0b0f14 100%);
    color: #ffffff;
    box-shadow: 0 6px 18px rgba(2, 6, 12, 0.25), inset 0 1px rgba(255, 255, 255, 0.06);
    &:hover { filter: brightness(1.05); transform: translateY(-1px); }
  `
      : `
    background: #f4f6f8;
    color: #111827;
    &:hover { background: #eef2f6; transform: translateY(-1px); }
  `}

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
  }
`;

const RecordButtonContainer = styled.div`
  position: relative;
  display: flex;
`;

const SplitRecordButton = styled.div<{ $isRecording: boolean }>`
  display: flex;
  border-radius: 9999px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12), inset 0 1px rgba(255,255,255,0.06);

  ${(props) =>
    props.$isRecording
      ? `
    background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
  `
      : `
    background: linear-gradient(180deg, #111827 0%, #0b0f14 100%);
  `}
`;

const RecordButtonMain = styled.button<{ $isRecording: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
  background: transparent;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const RecordButtonDropdown = styled.button<{ $isRecording: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 0.75rem;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  min-width: 40px;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const DropdownMenu = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.75rem;
  background: #ffffff;
  border: 1px solid rgba(2,6,12,0.08);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(2,6,12,0.14);
  z-index: 1000;
  min-width: 180px;
  display: ${(props) => (props.$isOpen ? "block" : "none")};
  overflow: hidden;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  &::before {
    content: "";
    position: absolute;
    top: -8px;
    right: 20px;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid #ffffff;
    filter: drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.05));
  }
`;

const DropdownItem = styled.button`
  width: 100%;
  padding: 0.9rem 1.1rem;
  border: none;
  background: #ffffff;
  color: #b91c1c;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.65rem;

  &:hover {
    background: #fff7f7;
    color: #991b1b;
    transform: translateX(1px);
  }

  &:active {
    background: #fee2e2;
    transform: translateX(0);
  }

  &:first-child {
    border-radius: 12px 12px 0 0;
  }

  &:last-child {
    border-radius: 0 0 12px 12px;
  }
`;

// Speaking Metrics styled components
const MetricsContainer = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 2rem;
  overflow: hidden;
`;

const MetricsHeader = styled.div`
  padding: 1rem 1.5rem;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s ease;

  &:hover {
    background: #f8fafc;
  }
`;

const MetricsTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const MetricsToggle = styled.span<{ $isOpen: boolean }>`
  font-size: 1.2rem;
  color: #64748b;
  transform: ${(props) => (props.$isOpen ? "rotate(180deg)" : "rotate(0deg)")};
  transition: transform 0.2s ease;
`;

const MetricsContent = styled.div<{ $isVisible: boolean }>`
  max-height: ${(props) => (props.$isVisible ? "600px" : "0")};
  overflow: ${(props) => (props.$isVisible ? "auto" : "hidden")};
  transition: max-height 0.3s ease;

  /* Custom scrollbar styling for better UX */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;

    &:hover {
      background: #94a3b8;
    }
  }

  /* Firefox scrollbar styling */
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
`;

const MetricsGrid = styled.div`
  padding: 1.5rem;
  display: grid;
  gap: 1.5rem;
`;

const SpeakerMetricsCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const SpeakerMetricsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
`;

const MetricsSpeakerName = styled.div`
  font-weight: 600;
  font-size: 1rem;
  color: #1e293b;
`;

const MetricsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const MetricItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const MetricLabel = styled.span`
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
`;

const MetricValue = styled.span`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
`;

const MetricUnit = styled.span`
  font-size: 0.875rem;
  color: #94a3b8;
  margin-left: 0.25rem;
`;

// Qualitative Analysis styled components
const QualitativeSection = styled.div`
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
`;

const QualitativeSectionTitle = styled.h4`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const QualitativeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
`;

const QualitativeCard = styled.div`
  background: #fafbfc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s ease;

  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
`;

const QualitativeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const QualitativeTitle = styled.h5`
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
`;

const QualitativeLevel = styled.span<{ $level: string }>`
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  background: ${(props) => {
    if (props.$level.includes("6+")) return "#059669";
    if (props.$level.includes("5")) return "#0891b2";
    if (props.$level.includes("4")) return "#7c3aed";
    if (props.$level.includes("3")) return "#ea580c";
    return "#dc2626";
  }};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const QualitativeScore = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const QualitativeDescription = styled.p`
  font-size: 0.8rem;
  color: #64748b;
  line-height: 1.4;
  margin: 0 0 0.75rem 0;
`;

const QualitativeDetails = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.3;
`;

// Report Dialog styled components
const ReportDialogOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ReportDialogContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

const ReportDialogTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 1rem 0;
  text-align: center;
`;

const ReportDialogContent = styled.div`
  color: #64748b;
  margin: 0 0 2rem 0;
  text-align: center;
  line-height: 1.6;
`;

const ReportDialogActions = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
`;

const ReportDialogButton = styled.button<{
  $variant?: "primary" | "secondary";
}>`
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  ${(props) =>
    props.$variant === "primary"
      ? `
    background: #3b82f6;
    color: white;
    &:hover {
      background: #2563eb;
    }
    &:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
  `
      : `
    background: #f1f5f9;
    color: #475569;
    &:hover {
      background: #e2e8f0;
    }
  `}

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

// Report display styled components
const ReportsSection = styled.div`
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
`;

const ReportCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const ReportHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const ReportUserName = styled.h4`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ReportScore = styled.div<{ $score: number }>`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${(props) => {
    if (props.$score >= 8) return "#10b981";
    if (props.$score >= 6) return "#f59e0b";
    return "#ef4444";
  }};
`;

const ReportMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const ReportMetric = styled.div`
  text-align: center;
`;

const ReportMetricValue = styled.div`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
`;

const ReportMetricLabel = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 500;
`;

const ReportPreview = styled.div`
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.5;
`;

// Detailed report modal styled components
const DetailedReportModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  padding: 1rem;
`;

const DetailedReportContainer = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

const DetailedReportTitle = styled.h2`
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 2rem 0;
  text-align: center;
`;

const ScoreGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const ScoreCard = styled.div`
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
`;

const ScoreTitle = styled.h4`
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
`;

const ScoreValue = styled.div<{ $score: number }>`
  font-size: 2rem;
  font-weight: 700;
  color: ${(props) => {
    if (props.$score >= 8) return "#10b981";
    if (props.$score >= 6) return "#f59e0b";
    return "#ef4444";
  }};
  margin-bottom: 0.5rem;
`;

const ScoreFeedback = styled.p`
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
`;

const FeedbackSection = styled.div`
  margin-bottom: 2rem;
`;

const FeedbackTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;
`;

const FeedbackList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const FeedbackItem = styled.li`
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #475569;

  &:last-child {
    margin-bottom: 0;
  }
`;

const TranscriptSection = styled.div`
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
`;

const TranscriptTitle = styled.h3`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

const TranscriptText = styled.div`
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  font-family: "Courier New", monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #475569;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
`;

// Icon components
const RecordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="8" />
  </svg>
);

const PulseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="3">
      <animate
        attributeName="r"
        values="3;5;3"
        dur="1.5s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="1;0.5;1"
        dur="1.5s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
);

// Interfaces
interface TranscriptData {
  id: string;
  eventId: string;
  sessionNumber: number;
  articleId: string;
  leaderUids: string[];
  participantUids: string[];
  createdAt: Date;
  createdBy: string;
  speakerMappings?: Record<string, string>; // speaker ID -> participant UID
  customKeywords?: string[]; // Custom keywords for this transcript
  transcriptContent?: any[]; // Soniox results
  hideUnidentifiedSpeakers?: boolean; // UI preference
  transcriptMetadata?: {
    totalWords: number;
    uniqueSpeakers: string[];
    speakerCount: number;
    latestTimestamp: number;
    lastRecordingSession: Date;
    totalRecordingDuration: number;
  };
}

interface ArticleData {
  title: {
    english: string;
    korean: string;
  };
  pronunciation_keywords?: string[];
}

// Interface for user data including phone numbers
interface UserWithDetails {
  uid: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  phoneLast4?: string;
}

interface EnhancedUserProfile extends UserProfile {
  isLeader: boolean;
  phoneNumber?: string;
  phoneLast4?: string;
}

interface SpeakerMapping {
  speakerId: string;
  participantUid: string;
}

interface UserSpeakingReport {
  userId: string;
  transcriptId: string;
  speakerId: string;
  userScript: string;
  analysis: {
    overallScore: number;
    fluency: {
      score: number;
      feedback: string;
    };
    vocabulary: {
      score: number;
      feedback: string;
    };
    grammar: {
      score: number;
      feedback: string;
    };
    pronunciation: {
      score: number;
      feedback: string;
    };
    engagement: {
      score: number;
      feedback: string;
    };
    strengths: string[];
    areasForImprovement: string[];
    specificSuggestions: string[];
  };
  metadata: {
    wordCount: number;
    speakingDuration: number;
    averageWordsPerMinute: number;
    createdAt: Date;
    articleId?: string;
    sessionNumber?: number;
  };
}

export default function TranscriptDetailClient() {
  const params = useParams();
  const router = useRouter();
  const transcriptId = params?.id as string;

  // Soniox-only

  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(
    null
  );
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [participants, setParticipants] = useState<EnhancedUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the existing speech hooks
  // Keep track of when we were paused to filter out results during pause periods
  const pausePeriodsRef = useRef<Array<{ start: number; end?: number }>>([]);
  // Ref to track pause state for audio processing callback
  const isPausedRef = useRef<boolean>(false);

  const {
    sonioxResults,
    sonioxError,
    isSonioxSocketOpen,
    startSoniox,
    stopSoniox,
    sendSonioxAudio,
    setSavedTranscript: setSavedSonioxTranscript,
  } = useSoniox(isPausedRef);

  // Unified transcript states (Soniox-only)
  const activePartialSegment = sonioxResults.activePartialSegment;
  const finalTranscript = sonioxResults.finalTranscript;
  const transcriptionError = sonioxError;
  const isSocketOpen = isSonioxSocketOpen;

  // Firestore transcript data (source of truth for saved transcript)
  const [savedTranscriptData, setSavedTranscriptData] = useState<any[]>([]);

  // Audio recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null
  );
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [totalRecordingDuration, setTotalRecordingDuration] =
    useState<number>(0);
  const [totalPausedDuration, setTotalPausedDuration] = useState<number>(0);
  const [currentSpeaker, setCurrentSpeaker] = useState<string>("");
  const [customSpeakers, setCustomSpeakers] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordsLoaded, setKeywordsLoaded] = useState<boolean>(false);
  const keywordsLoadedRef = useRef<boolean>(false);
  const keywordsRef = useRef<string[]>([]);
  const [newKeyword, setNewKeyword] = useState<string>("");

  const participantLabels = useMemo(
    () =>
      participants.map(
        (participant) =>
          participant.displayName ||
          participant.phoneLast4 ||
          participant.phoneNumber ||
          participant.uid
      ),
    [participants]
  );

  const {
    messages: copilotMessages,
    isThinking: isCopilotThinking,
  } = useTranscriptCopilot({
    finalTranscript,
    activePartialSegment,
    isListening: isRecording && !isPaused,
    participants: participantLabels,
    articleTitle: articleData?.title?.english || articleData?.title?.korean,
  });

  // Audio storage and playback state
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentlyHighlightedSnippet, setCurrentlyHighlightedSnippet] =
    useState<number | null>(null);
  const [currentlyHighlightedWord, setCurrentlyHighlightedWord] = useState<{
    snippetIndex: number;
    wordIndex: number;
  } | null>(null);

  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const lastAudioSentAtRef = useRef<number>(0);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Speaker assignment state
  const [speakerMappings, setSpeakerMappings] = useState<
    Record<string, string>
  >({});
  const [showSpeakerModal, setShowSpeakerModal] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);
  const [showRecordingDropdown, setShowRecordingDropdown] = useState(false);

  const [hideUnidentifiedSpeakers, setHideUnidentifiedSpeakers] =
    useState(false);

  // Report generation state
  const [showCreateReportDialog, setShowCreateReportDialog] = useState(false);

  // Speaking metrics state
  const [showMetrics, setShowMetrics] = useState(false);

  // Qualitative analysis state
  const [qualitativeAnalysis, setQualitativeAnalysis] = useState<
    Record<string, any>
  >({});
  const [isLoadingQualitativeAnalysis, setIsLoadingQualitativeAnalysis] =
    useState(false);
  const [isGeneratingReports, setIsGeneratingReports] = useState(false);
  const [reports, setReports] = useState<UserSpeakingReport[]>([]);
  const [selectedReport, setSelectedReport] =
    useState<UserSpeakingReport | null>(null);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [reportsGenerated, setReportsGenerated] = useState(false);

  // Function to get user details with phone numbers
  const fetchUserDetails = async (
    uids: string[]
  ): Promise<UserWithDetails[]> => {
    try {
      const getUserDisplayNames = httpsCallable(
        functions,
        "getUserDisplayNames"
      );
      const response = await getUserDisplayNames({ userIds: uids });
      const result = response.data as {
        displayNames: Record<string, string>;
        phoneNumbers: Record<string, string>;
      };

      return uids.map((uid) => ({
        uid,
        displayName: result.displayNames[uid] || `User ${uid.substring(0, 6)}`,
        phoneNumber: result.phoneNumbers[uid] || "",
        phoneLast4: result.phoneNumbers[uid]
          ? result.phoneNumbers[uid].replace(/\D/g, "").slice(-4)
          : "",
      }));
    } catch (error) {
      console.error("Error fetching user details:", error);
      return uids.map((uid) => ({
        uid,
        displayName: `User ${uid.substring(0, 6)}`,
        phoneNumber: "",
        phoneLast4: "",
      }));
    }
  };

  // Helper functions for formatting names
  const isValidDisplayName = (displayName?: string): boolean => {
    if (!displayName) return false;
    const userPattern = /^User [a-zA-Z0-9]{6}$/;
    return !userPattern.test(displayName);
  };

  const formatParticipantDisplay = (user: EnhancedUserProfile): string => {
    const validName = isValidDisplayName(user.displayName);
    if (!validName) return `익명 (${user.phoneLast4 || "****"})`;

    return `${user.displayName} (${user.phoneLast4 || "****"})`;
  };

  const formatLeaderDisplay = (user: EnhancedUserProfile): string => {
    const validName = isValidDisplayName(user.displayName);
    return validName ? user.displayName! : "익명";
  };

  // Helper function to determine if a word is punctuation or should be attached to previous word
  const isPunctuationOrAttached = (word: any): boolean => {
    if (!word) return false;

    // Check the type field first
    if (word.type && word.type !== "word") {
      return true;
    }

    // Common punctuation patterns
    const punctuationPattern = /^[.,!?;:'")\]}>-]+$/;
    const contractionPattern = /^'[a-z]+$/i; // 's, 't, 'll, etc.

    return (
      punctuationPattern.test(word.content) ||
      contractionPattern.test(word.content)
    );
  };

  // Filter out results that occurred during pause periods
  const filterPausedResults = useCallback((results: any[]) => {
    if (pausePeriodsRef.current.length === 0) return results;

    return results.filter((result) => {
      if (!result.start_time) return true; // Include results without timestamps

      // Check if this result's timestamp falls within any pause period
      for (const pausePeriod of pausePeriodsRef.current) {
        const isAfterPauseStart = result.start_time >= pausePeriod.start;
        const isBeforePauseEnd = pausePeriod.end
          ? result.start_time <= pausePeriod.end
          : false;

        // If result is during a pause period, filter it out
        if (isAfterPauseStart && (isBeforePauseEnd || !pausePeriod.end)) {
          console.log(
            `[Filter] Filtering out result at ${
              result.start_time
            }s (pause period: ${pausePeriod.start}-${
              pausePeriod.end || "ongoing"
            })`
          );
          return false;
        }
      }

      return true;
    });
  }, []);

  // Group transcript results into snippets for rendering (copied from original RecordTranscriptClient)
  const createTranscriptSnippets = useCallback((results: any[]) => {
    const validResults = results.filter(
      (result) => {
        const content = result.alternatives?.[0]?.content;
        return content && content.trim().toLowerCase() !== "<end>";
      }
    );
    if (validResults.length === 0) return [];

    const snippets: Array<{
      speaker: string;
      startTime: number;
      words: Array<{
        content: string;
        confidence?: number;
        isPartial?: boolean;
        type?: string;
        preserveSpacing?: boolean;
      }>;
    }> = [];

    let currentSnippet: {
      speaker: string;
      startTime: number;
      words: Array<{
        content: string;
        confidence?: number;
        isPartial?: boolean;
        type?: string;
        preserveSpacing?: boolean;
      }>;
    } | null = null;

    validResults.forEach((result, index) => {
      const word = result.alternatives[0];
      const speaker = word.speaker || "UU";

      if (!currentSnippet || currentSnippet.speaker !== speaker) {
        if (currentSnippet) {
          snippets.push(currentSnippet);
        }
        currentSnippet = {
          speaker,
          startTime: result.start_time,
          words: [
            {
              content: word.content,
              confidence: word.confidence,
              type: result.type || "word",
              preserveSpacing: result.preserveSpacing,
            },
          ],
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

  // Get new live data that hasn't been saved yet
  const newLiveData = useMemo(() => {
    const currentFinalTranscript = finalTranscript || [];
    const savedDataLength = savedTranscriptData.length;

    // Only show new data that's beyond what's already saved
    return currentFinalTranscript.slice(savedDataLength);
  }, [finalTranscript, savedTranscriptData.length]);

  // Combine saved Firestore data with new live data
  const combinedFinalTranscript = useMemo(() => {
    return [...savedTranscriptData, ...newLiveData];
  }, [savedTranscriptData, newLiveData]);

  // Apply filtering to remove paused periods from the combined data
  const filteredFinalTranscript = isPaused
    ? filterPausedResults(combinedFinalTranscript)
    : combinedFinalTranscript;

  const filteredActivePartialSegment = isPaused
    ? [] // Don't show active partials when paused
    : activePartialSegment || [];

  const finalSnippets = createTranscriptSnippets(filteredFinalTranscript);
  const partialSnippets = createTranscriptSnippets(
    filteredActivePartialSegment.map((r) => ({
      ...r,
      isPartial: true,
    }))
  );

  // Combine final and partial snippets for a seamless display (copied from original RecordTranscriptClient)
  const displaySnippets = useMemo(() => {
    // Start with a deep copy of final snippets to avoid mutation
    const combined = finalSnippets.map((snippet) => ({
      ...snippet,
      words: [...snippet.words],
    }));

    // Only process partials if they exist
    if (partialSnippets.length === 0) {
      return combined;
    }

    const lastFinalSnippet = combined[combined.length - 1];
    const firstPartialSnippet = partialSnippets[0];

    if (
      lastFinalSnippet &&
      firstPartialSnippet &&
      lastFinalSnippet.speaker === firstPartialSnippet.speaker
    ) {
      // If the same speaker is continuing, merge the words
      const partialWords = firstPartialSnippet.words.map((w) => ({
        ...w,
        isPartial: true,
      }));
      lastFinalSnippet.words = [...lastFinalSnippet.words, ...partialWords];

      // Add any additional partial snippets from other speakers
      for (let i = 1; i < partialSnippets.length; i++) {
        const additionalPartial = partialSnippets[i];
        combined.push({
          ...additionalPartial,
          words: additionalPartial.words.map((w) => ({
            ...w,
            isPartial: true,
          })),
        });
      }
    } else {
      // If it's a new speaker or no final snippets, add all partial snippets
      partialSnippets.forEach((partialSnippet) => {
        combined.push({
          ...partialSnippet,
          words: partialSnippet.words.map((w) => ({ ...w, isPartial: true })),
        });
      });
    }

    return combined;
  }, [finalSnippets, partialSnippets]);

  // Speaker display info function
  const getSpeakerDisplayInfo = (speakerId: string) => {
    const participantUid = speakerMappings[speakerId];
    if (participantUid) {
      const participant = participants.find((p) => p.uid === participantUid);
      if (participant) {
        const formattedName = participant.isLeader
          ? formatLeaderDisplay(participant)
          : formatParticipantDisplay(participant);

        return {
          name: formattedName,
          avatar: participant.uid,
          isAssigned: true,
          isLeader: participant.isLeader,
        };
      }
    }

    return {
      name:
        speakerId === "UU"
          ? "Unknown Speaker"
          : `Speaker ${speakerId.slice(1)}`,
      avatar: null,
      isAssigned: false,
      isLeader: false,
    };
  };

  // Filter snippets based on hideUnidentifiedSpeakers setting
  const filteredDisplaySnippets = useMemo(() => {
    if (!hideUnidentifiedSpeakers) {
      return displaySnippets;
    }

    return displaySnippets.filter((snippet) => {
      const speakerInfo = getSpeakerDisplayInfo(snippet.speaker);
      return speakerInfo.isAssigned;
    });
  }, [
    displaySnippets,
    hideUnidentifiedSpeakers,
    speakerMappings,
    participants,
  ]);

  const conversationItems = useMemo(() => {
    const sortedMessages = [...copilotMessages].sort(
      (a, b) =>
        a.transcriptItemCount - b.transcriptItemCount ||
        a.createdAt - b.createdAt
    );
    const items: Array<
      | { type: "transcript"; snippet: (typeof filteredDisplaySnippets)[number]; snippetIndex: number }
      | { type: "copilot"; message: (typeof copilotMessages)[number] }
      | { type: "copilot-thinking" }
    > = [];
    let cumulativeItems = 0;
    let messageIndex = 0;

    filteredDisplaySnippets.forEach((snippet, snippetIndex) => {
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
  }, [copilotMessages, filteredDisplaySnippets, isCopilotThinking]);

  // Speaker color mapping
  const getSpeakerColor = (speaker: string) => {
    const colors = {
      S1: { avatar: "#4f46e5" },
      S2: { avatar: "#e11d48" },
      S3: { avatar: "#059669" },
      S4: { avatar: "#d97706" },
      S5: { avatar: "#9333ea" },
      UU: { avatar: "#6b7280" },
    };
    return colors[speaker as keyof typeof colors] || { avatar: "#6b7280" };
  };

  // Label resolver combining mapped users and unmapped speakers
  const displayLabelForSpeaker = useCallback(
    (speakerId: string): string => {
      const participantUid = speakerMappings[speakerId];
      if (participantUid) {
        const participant = participants.find((p) => p.uid === participantUid);
        if (participant) return formatParticipantDisplay(participant);
      }
      return speakerId === "UU" ? "Unknown" : `Speaker ${speakerId.slice(1)}`;
    },
    [speakerMappings, participants]
  );

  // Speaking Metrics Calculation Functions
  const calculateSpeakingMetrics = useMemo(() => {
    if (filteredFinalTranscript.length === 0) return {};

    const speakerMetrics: Record<string, any> = {};
    const speakingSegments: Record<
      string,
      Array<{ startTime: number; endTime: number; words: string[] }>
    > = {};

    // Group by speakers and calculate segments
    filteredFinalTranscript.forEach((result, index) => {
      if (!result.alternatives || !result.alternatives[0]) return;

      const word = result.alternatives[0];
      const speaker = word.speaker || "UU";
      const startTime = result.start_time || 0;
      const endTime = result.end_time || startTime + 0.5; // Default 0.5s if no end time
      const content = word.content || "";

      if (!speakingSegments[speaker]) {
        speakingSegments[speaker] = [];
      }

      // Check if this continues the current segment (same speaker within 2 seconds)
      const lastSegment =
        speakingSegments[speaker][speakingSegments[speaker].length - 1];
      if (lastSegment && startTime - lastSegment.endTime <= 2) {
        // Continue existing segment
        lastSegment.endTime = endTime;
        lastSegment.words.push(content);
      } else {
        // Start new segment
        speakingSegments[speaker].push({
          startTime,
          endTime,
          words: [content],
        });
      }
    });

    // Calculate metrics for each speaker
    Object.keys(speakingSegments).forEach((speaker) => {
      const segments = speakingSegments[speaker];

      // 1. Total Speaking Time
      const totalSpeakingTime = segments.reduce(
        (sum, segment) => sum + (segment.endTime - segment.startTime),
        0
      );

      // 3. Speaking Turn Count
      const speakingTurns = segments.length;

      // 4. Average Speaking Duration
      const avgSpeakingDuration =
        speakingTurns > 0 ? totalSpeakingTime / speakingTurns : 0;

      // 5. Longest Speaking Turn
      const longestSpeakingTurn =
        segments.length > 0
          ? Math.max(...segments.map((seg) => seg.endTime - seg.startTime))
          : 0;

      // Get all words for this speaker
      const allWords = segments
        .flatMap((seg) => seg.words)
        .filter((word) => word.trim().length > 0);
      const totalWords = allWords.length;

      // 6. Unique Words Used / Lexical Diversity
      const wordsLowerCase = allWords
        .map(
          (word) => word.toLowerCase().replace(/[^\w\s]/g, "") // Remove punctuation
        )
        .filter((word) => word.length > 0);

      const uniqueWords = new Set(wordsLowerCase);
      const lexicalDiversity =
        totalWords > 0 ? (uniqueWords.size / totalWords) * 100 : 0;

      // 7. Questions Asked
      const allText = segments.map((seg) => seg.words.join(" ")).join(" ");
      const questionMarks = (allText.match(/\?/g) || []).length;
      const questionWords = [
        "who",
        "what",
        "when",
        "where",
        "why",
        "how",
        "do",
        "did",
        "can",
        "could",
        "would",
        "will",
        "should",
        "is",
        "are",
        "was",
        "were",
      ];
      const questionStarters = questionWords.reduce((count, qWord) => {
        const regex = new RegExp(`\\b${qWord}\\b`, "gi");
        const matches = allText.match(regex) || [];
        return count + matches.length;
      }, 0);
      const questionsAsked = questionMarks + Math.floor(questionStarters / 3); // Rough estimate

      speakerMetrics[speaker] = {
        totalSpeakingTime: Math.round(totalSpeakingTime * 10) / 10, // Round to 1 decimal
        speakingTurns,
        avgSpeakingDuration: Math.round(avgSpeakingDuration * 10) / 10,
        longestSpeakingTurn: Math.round(longestSpeakingTurn * 10) / 10,
        totalWords,
        uniqueWords: uniqueWords.size,
        lexicalDiversity: Math.round(lexicalDiversity * 10) / 10,
        questionsAsked,
      };
    });

    // 2. Calculate Speaking Time Share (%)
    const totalSessionTime = Object.values(speakerMetrics).reduce(
      (sum: number, metrics: any) => sum + metrics.totalSpeakingTime,
      0
    );

    Object.keys(speakerMetrics).forEach((speaker) => {
      const timeShare =
        totalSessionTime > 0
          ? (speakerMetrics[speaker].totalSpeakingTime / totalSessionTime) * 100
          : 0;
      speakerMetrics[speaker].speakingTimeShare =
        Math.round(timeShare * 10) / 10;
    });

    return speakerMetrics;
  }, [filteredFinalTranscript]);

  // Aggregate total speaking time by display label (merging mapped speakers)
  const pieChartData = useMemo(() => {
    const metrics = (calculateSpeakingMetrics || {}) as Record<string, any>;
    const labelToTime: Record<string, number> = {};
    const labelToColor: Record<string, string> = {};

    Object.keys(metrics).forEach((speakerId) => {
      const label = displayLabelForSpeaker(speakerId);
      const time = metrics[speakerId]?.totalSpeakingTime || 0;
      labelToTime[label] = (labelToTime[label] || 0) + time;

      if (!labelToColor[label]) {
        labelToColor[label] = getSpeakerColor(speakerId).avatar;
      }
    });

    const labels = Object.keys(labelToTime);
    const data = labels.map((l) => Math.round(labelToTime[l] * 10) / 10);
    const backgroundColor = labels.map((l) => labelToColor[l] || "#6b7280");

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    };
  }, [calculateSpeakingMetrics, displayLabelForSpeaker]);

  // Analysis helper functions (defined before the useMemo to avoid hoisting issues)
  const getComplexityLevel = (score: number) => {
    if (score >= 80) return "C6+";
    if (score >= 70) return "C5";
    if (score >= 60) return "C4";
    if (score >= 50) return "C3";
    if (score >= 40) return "C2";
    return "C1";
  };

  const getAccuracyLevel = (score: number) => {
    if (score >= 85) return "A6+";
    if (score >= 75) return "A5";
    if (score >= 65) return "A4";
    if (score >= 55) return "A3";
    if (score >= 45) return "A2";
    return "A1";
  };

  const getFluencyLevel = (score: number) => {
    if (score >= 80) return "F6+";
    if (score >= 70) return "F5";
    if (score >= 60) return "F4";
    if (score >= 50) return "F3";
    if (score >= 40) return "F2";
    return "F1";
  };

  const getComplexityDescription = (level: string, score: number) => {
    if (level.includes("6+"))
      return "상위 25% 수준 - 주제에 대해 길고 분명하게 전달할 만큼의 어휘력 보유";
    if (level.includes("5")) return "고급 수준 - 다양하고 정교한 어휘 구사";
    if (level.includes("4"))
      return "중상급 수준 - 적절한 어휘 선택과 문장 구성";
    if (level.includes("3")) return "중급 수준 - 기본적인 복잡성 표현 가능";
    return "초급 수준 - 단순한 어휘와 문장 구조 사용";
  };

  const getAccuracyDescription = (level: string, score: number) => {
    if (level.includes("6+"))
      return "상위 20% 수준 - 복잡한 문법 구조 혼합 사용, 고급 문법에서 간헐적 실수";
    if (level.includes("5"))
      return "고급 수준 - 대부분의 문법 구조를 정확하게 사용";
    if (level.includes("4"))
      return "중상급 수준 - 기본 문법은 안정적, 복잡한 구조에서 실수";
    if (level.includes("3")) return "중급 수준 - 문법적 정확성에 개선 여지";
    return "초급 수준 - 기본 문법 학습 필요";
  };

  const getFluencyDescription = (level: string, score: number) => {
    if (level.includes("6+"))
      return "상위 20% 수준 - 불편함 없이 영어 대화 가능, 자연스러운 속도와 흐름";
    if (level.includes("5"))
      return "고급 수준 - 대체로 자연스러운 말하기, 가끔 망설임";
    if (level.includes("4"))
      return "중상급 수준 - 의사소통 가능하나 간헐적 정체";
    if (level.includes("3"))
      return "중급 수준 - 말하기 속도와 유창함 개선 필요";
    return "초급 수준 - 말하기 연습과 속도 향상 필요";
  };

  // Analysis functions (defined before the useMemo that uses them)
  const analyzeComplexity = (text: string, metrics: any) => {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Vocabulary difficulty (basic heuristic - can be enhanced with AI)
    const complexWords = words.filter((word) => word.length > 6).length;
    const vocabularyDifficulty =
      words.length > 0 ? (complexWords / words.length) * 100 : 0;

    // Sentence variety (simple heuristic)
    const avgSentenceLength =
      sentences.length > 0 ? words.length / sentences.length : 0;
    const sentenceVariety = Math.min((avgSentenceLength / 15) * 100, 100);

    // Vocabulary diversity (already calculated)
    const vocabularyDiversity = metrics.lexicalDiversity || 0;

    // Overall complexity score (weighted average)
    const complexityScore = Math.round(
      vocabularyDifficulty * 0.4 +
        sentenceVariety * 0.3 +
        vocabularyDiversity * 0.3
    );

    const level = getComplexityLevel(complexityScore);
    const description = getComplexityDescription(level, complexityScore);

    return {
      score: complexityScore,
      level,
      description,
      details: {
        vocabularyDifficulty: Math.round(vocabularyDifficulty),
        sentenceVariety: Math.round(sentenceVariety),
        vocabularyDiversity: Math.round(vocabularyDiversity),
      },
    };
  };

  const analyzeAccuracy = (text: string) => {
    const words = text.split(/\s+/).filter((w) => w.length > 0);

    // Basic grammar error detection (placeholder - will be enhanced with AI)
    const commonErrors = [
      /\ba\s+[aeiou]/gi, // a + vowel sound
      /\ban\s+[^aeiou]/gi, // an + consonant sound
      /\bdon't\s+never\b/gi, // double negative
      /\bmore\s+better\b/gi, // double comparative
      /\bmuch\s+many\b/gi, // countable/uncountable confusion
    ];

    let errorCount = 0;
    commonErrors.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) errorCount += matches.length;
    });

    // Calculate accuracy score
    const errorRate = words.length > 0 ? (errorCount / words.length) * 100 : 0;
    const accuracyScore = Math.max(0, Math.round(100 - errorRate * 10));

    const level = getAccuracyLevel(accuracyScore);
    const description = getAccuracyDescription(level, accuracyScore);

    return {
      score: accuracyScore,
      level,
      description,
      details: {
        totalWords: words.length,
        detectedErrors: errorCount,
        errorRate: Math.round(errorRate * 100) / 100,
      },
    };
  };

  const analyzeFluency = (text: string, metrics: any) => {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    // Filler words detection
    const fillerWords = [
      "um",
      "uh",
      "er",
      "ah",
      "like",
      "you know",
      "actually",
      "basically",
    ];
    const fillerCount = words.filter((word) =>
      fillerWords.some((filler) => word.includes(filler))
    ).length;

    // Word repetition analysis
    const wordCounts = words.reduce((acc: Record<string, number>, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

    const repetitions = Object.values(wordCounts).filter(
      (count) => count > 2
    ).length;

    // Speaking rate analysis (from existing metrics)
    const avgSpeakingRate =
      metrics.totalWords && metrics.totalSpeakingTime
        ? (metrics.totalWords / metrics.totalSpeakingTime) * 60
        : 0; // words per minute

    // Calculate fluency score
    const fillerPenalty =
      words.length > 0 ? (fillerCount / words.length) * 30 : 0;
    const repetitionPenalty =
      words.length > 0 ? (repetitions / words.length) * 20 : 0;
    const rateScore = Math.min((avgSpeakingRate / 150) * 50, 50); // optimal rate ~150 WPM

    const fluencyScore = Math.max(
      0,
      Math.round(100 - fillerPenalty - repetitionPenalty + rateScore - 50)
    );

    const level = getFluencyLevel(fluencyScore);
    const description = getFluencyDescription(level, fluencyScore);

    return {
      score: fluencyScore,
      level,
      description,
      details: {
        speakingRate: Math.round(avgSpeakingRate),
        fillerWords: fillerCount,
        repetitions,
        fillerPercentage:
          words.length > 0 ? Math.round((fillerCount / words.length) * 100) : 0,
      },
    };
  };

  // Async Qualitative Analysis with OpenAI GPT-4o-mini
  const generateQualitativeAnalysis = useCallback(async () => {
    if (
      filteredFinalTranscript.length === 0 ||
      Object.keys(calculateSpeakingMetrics).length === 0
    ) {
      return;
    }

    setIsLoadingQualitativeAnalysis(true);

    try {
      const speakerAnalysis: Record<string, any> = {};

      // Process each speaker
      for (const speaker of Object.keys(calculateSpeakingMetrics)) {
        const speakerSegments = filteredFinalTranscript.filter(
          (result) => result.alternatives?.[0]?.speaker === speaker
        );

        const allText = speakerSegments
          .map((result) => result.alternatives?.[0]?.content || "")
          .join(" ");

        if (!allText.trim() || allText.split(" ").length < 10) {
          speakerAnalysis[speaker] = {
            complexity: {
              score: 0,
              level: "N/A",
              description: "Insufficient data for AI analysis",
            },
            accuracy: {
              score: 0,
              level: "N/A",
              description: "Insufficient data for AI analysis",
            },
            fluency: {
              score: 0,
              level: "N/A",
              description: "Insufficient data for AI analysis",
            },
          };
          continue;
        }

        // Call OpenAI API for each speaker
        const analysis = await analyzeWithOpenAI(
          allText,
          calculateSpeakingMetrics[speaker]
        );
        speakerAnalysis[speaker] = analysis;
      }

      setQualitativeAnalysis(speakerAnalysis);
    } catch (error) {
      console.error("Error generating qualitative analysis:", error);
      // Fallback to basic analysis if API fails
      const fallbackAnalysis = generateFallbackAnalysis();
      setQualitativeAnalysis(fallbackAnalysis);
    } finally {
      setIsLoadingQualitativeAnalysis(false);
    }
  }, [filteredFinalTranscript, calculateSpeakingMetrics]);

  // OpenAI analysis using Firebase Function
  const analyzeWithOpenAI = async (text: string, metrics: any) => {
    const prompt = `Analyze this English speaking sample for a Korean learner. Provide scores (0-100) and levels for:

1. COMPLEXITY (복잡성) - C1 to C6+ levels:
- Vocabulary difficulty and variety
- Sentence structure sophistication
- Topic development depth

2. ACCURACY (정확성) - A1 to A6+ levels:  
- Grammar correctness
- Proper word usage
- Error frequency

3. FLUENCY (유창성) - F1 to F6+ levels:
- Speaking pace and rhythm
- Hesitations and fillers
- Natural flow

Speaking sample: "${text}"
Word count: ${metrics.totalWords}
Speaking time: ${metrics.totalSpeakingTime}s
Speaking rate: ${Math.round(
      (metrics.totalWords / metrics.totalSpeakingTime) * 60
    )} WPM

Respond in JSON format:
{
  "complexity": {"score": 0-100, "level": "C1-C6+", "description": "Korean description"},
  "accuracy": {"score": 0-100, "level": "A1-A6+", "description": "Korean description"}, 
  "fluency": {"score": 0-100, "level": "F1-F6+", "description": "Korean description"}
}`;

    try {
      const { httpsCallable } = await import("firebase/functions");
      const { functions } = await import("../../lib/firebase/firebase");

      const generateSpeakingReports = httpsCallable(
        functions,
        "generateSpeakingReports"
      );

      const result = await generateSpeakingReports({
        analysisType: "simple",
        prompt,
        model: "gpt-4o-mini",
      });

      const data = result.data as {
        success: boolean;
        analysis: any;
        model: string;
        usage: any;
      };

      if (!data.success) {
        throw new Error("Analysis failed");
      }

      return data.analysis;
    } catch (error) {
      throw new Error(
        `Firebase Function error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Fallback analysis function (uses existing local analysis)
  const generateFallbackAnalysis = () => {
    const speakerAnalysis: Record<string, any> = {};

    Object.keys(calculateSpeakingMetrics).forEach((speaker) => {
      const speakerSegments = filteredFinalTranscript.filter(
        (result) => result.alternatives?.[0]?.speaker === speaker
      );

      const allText = speakerSegments
        .map((result) => result.alternatives?.[0]?.content || "")
        .join(" ");

      if (!allText.trim()) {
        speakerAnalysis[speaker] = {
          complexity: {
            score: 0,
            level: "N/A",
            description: "Insufficient data",
          },
          accuracy: {
            score: 0,
            level: "N/A",
            description: "Insufficient data",
          },
          fluency: { score: 0, level: "N/A", description: "Insufficient data" },
        };
        return;
      }

      // Use existing local analysis as fallback
      const complexity = analyzeComplexity(
        allText,
        calculateSpeakingMetrics[speaker]
      );
      const accuracy = analyzeAccuracy(allText);
      const fluency = analyzeFluency(
        allText,
        calculateSpeakingMetrics[speaker]
      );

      speakerAnalysis[speaker] = { complexity, accuracy, fluency };
    });

    return speakerAnalysis;
  };

  // Check microphone permission on component mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        // First check if we can get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop()); // Stop the test stream
        setHasPermission(true);
      } catch (error) {
        console.error("Microphone permission denied:", error);
        setHasPermission(false);
      }
    };

    checkPermission();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const dropdownContainer = target.closest("[data-dropdown-container]");

      if (showRecordingDropdown && !dropdownContainer) {
        setShowRecordingDropdown(false);
      }
    };

    if (showRecordingDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showRecordingDropdown]);

  // Set up audio processing and recording
  const setupAudioProcessing = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Set up audio context for Soniox
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/scripts/audio-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(
        audioContext,
        "audio-processor",
        {
          processorOptions: {
            sampleRate: 16000,
          },
        }
      );
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        const audioData = event.data;
        if (audioData && audioData.byteLength > 0) {
          // Only send audio when not paused
          if (!isPausedRef.current) {
            lastAudioSentAtRef.current = Date.now();
            sendSonioxAudio(audioData);
          }
        }
      };

      source.connect(workletNode);

      // Set up MediaRecorder for continuous audio recording
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;

      // DON'T clear previous recording chunks - we want to accumulate across sessions
      // recordedAudioChunksRef.current = []; // REMOVED

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedAudioChunksRef.current.push(event.data);
          console.log(
            `[Audio] Added chunk ${recordedAudioChunksRef.current.length}, size: ${event.data.size} bytes`
          );
        }
      };

      // Start continuous recording
      recordingStartTimeRef.current = Date.now();
      mediaRecorder.start();

      console.log(
        `[Audio] Started recording session with ${recordedAudioChunksRef.current.length} existing chunks`
      );

      // Reacquire mic if track ends
      const [track] = stream.getAudioTracks();
      if (track) {
        track.onended = async () => {
          if (!isRecording) return;
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = newStream;
            const newSource = audioContext.createMediaStreamSource(newStream);
            newSource.connect(workletNode);

            const newRecorder = new MediaRecorder(newStream, { mimeType: "audio/webm;codecs=opus" });
            mediaRecorderRef.current = newRecorder;
            newRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) recordedAudioChunksRef.current.push(e.data);
            };
            newRecorder.start();
          } catch (reErr) {
            console.error("Failed to reacquire microphone after track ended:", reErr);
          }
        };
      }

      return true;
    } catch (error) {
      console.error("Error setting up audio processing:", error);
      return false;
    }
  }, [sendSonioxAudio]);

  const handleStartRecording = async () => {
    try {
      setIsStarting(true);

      // When starting fresh (not resuming), clear all existing transcript data
      if (!isRecording) {
        console.log(
          "[Recording] Starting fresh - clearing existing transcript data"
        );

        // Clear the hook's saved transcript data
        setSavedSonioxTranscript([]);

        // Clear pause periods and duration tracking
        pausePeriodsRef.current = [];
        setTotalPausedDuration(0);
        setTotalRecordingDuration(0);
        setIsPaused(false);
        setPauseStartTime(null);

        // Clear audio chunks to start fresh
        recordedAudioChunksRef.current = [];
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
          setRecordedAudioUrl(null);
        }

        // Clear the transcript data in Firestore
        if (transcriptId) {
          try {
            const transcriptRef = doc(db, "transcripts", transcriptId);
            await updateDoc(transcriptRef, {
              transcriptContent: [],
              transcriptMetadata: {
                totalWords: 0,
                uniqueSpeakers: [],
                speakerCount: 0,
                latestTimestamp: 0,
                lastRecordingSession: new Date(),
                totalRecordingDuration: 0,
                totalPausedDuration: 0,
                pausePeriods: [],
              },
            });
            console.log(
              "[Recording] Cleared existing transcript data from Firestore"
            );
          } catch (error) {
            console.error("[Recording] Error clearing Firestore data:", error);
          }
        }
      }

      // Re-check permission when user actually tries to record
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        testStream.getTracks().forEach((track) => track.stop());
        setHasPermission(true);
      } catch (permError) {
        console.error("Microphone permission denied:", permError);
        setHasPermission(false);
        alert(
          "Microphone permission is required for transcription. Please allow microphone access and try again."
        );
        setIsStarting(false);
        return;
      }

      // Wait for keywords to be loaded before starting recording
      if (!keywordsLoaded) {
        console.log("[Recording] Waiting for keywords to load...");
        // Wait up to 5 seconds for keywords to load
        const maxWaitTime = 5000;
        const checkInterval = 100;
        let waitTime = 0;

        while (!keywordsLoadedRef.current && waitTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, checkInterval));
          waitTime += checkInterval;
          console.log(
            "[Recording] Waiting for keywords... time:",
            waitTime,
            "loaded:",
            keywordsLoadedRef.current
          );
        }

        if (!keywordsLoadedRef.current) {
          console.warn(
            "[Recording] Keywords not loaded in time, starting without custom dictionary"
          );
        } else {
          console.log("[Recording] Keywords loaded successfully after waiting");
        }
      }

      console.log("[Recording] Final keywordsLoaded state:", keywordsLoaded);
      console.log("[Recording] Current keywords state:", keywords);
      const customDictionary = prepareCustomDictionary();
      console.log(
        "[Recording] Starting with custom dictionary length:",
        customDictionary.length
      );
      console.log("[Recording] Custom dictionary entries:", customDictionary);

      // Start provider (Soniox)
      let providerStarted = await startSoniox(customDictionary);

      if (!providerStarted) {
        setIsStarting(false);
        return;
      }

      const audioSetup = await setupAudioProcessing();
      if (!audioSetup) {
        await stopSoniox(false);
        setIsStarting(false);
        return;
      }

      setIsRecording(true);
      setIsStarting(false);
      setRecordingStartTime(Date.now());
      // Start keepalive to avoid provider timeout
      lastAudioSentAtRef.current = Date.now();
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = setInterval(() => {
        if (!isSonioxSocketOpen) return;
        const now = Date.now();
        if (now - lastAudioSentAtRef.current > 1500) {
          const silent = new Float32Array(4096);
          try {
            sendSonioxAudio(silent.buffer);
            lastAudioSentAtRef.current = now;
          } catch {}
        }
      }, 800);
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsStarting(false);
    }
  };

  const handleStopRecording = async () => {
    // Close the dropdown first
    setShowRecordingDropdown(false);

    setIsRecording(false);
    setIsPaused(false); // Reset pause state when stopping

    // Calculate recording duration for this session
    if (recordingStartTime) {
      const sessionDuration = (Date.now() - recordingStartTime) / 1000; // Convert to seconds
      setTotalRecordingDuration((prev) => prev + sessionDuration);
      setRecordingStartTime(null);
    }

    // Close any open pause period
    if (pauseStartTime) {
      const pauseDuration = (Date.now() - pauseStartTime) / 1000;
      setTotalPausedDuration((prev) => prev + pauseDuration);
      setPauseStartTime(null);

      // Close the current pause period
      const lastPause =
        pausePeriodsRef.current[pausePeriodsRef.current.length - 1];
      if (lastPause && !lastPause.end) {
        const currentTimestamp =
          (Date.now() - (recordingStartTime || Date.now())) / 1000;
        lastPause.end = currentTimestamp;
      }
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();

      // Set up the onstop handler to create the audio URL
      mediaRecorderRef.current.onstop = () => {
        // Create a single audio blob from all accumulated chunks (across all sessions)
        const audioBlob = new Blob(recordedAudioChunksRef.current, {
          type: "audio/webm;codecs=opus",
        });

        // Clean up the previous audio URL to avoid memory leaks
        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);

        console.log(
          `[Audio] Updated audio URL with ${recordedAudioChunksRef.current.length} chunks`
        );
      };
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Stop provider (Soniox)
    await stopSoniox(true);
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    // Immediately save transcript when recording stops
    setTimeout(() => {
      saveTranscriptToFirestore();
    }, 1000); // Give a moment for final transcript to be processed
  };

  const handlePauseRecording = async () => {
    setIsPaused(true);
    setPauseStartTime(Date.now());

    // Add a new pause period
    const pauseStartTimestamp =
      (Date.now() - (recordingStartTime || Date.now())) / 1000;
    pausePeriodsRef.current.push({ start: pauseStartTimestamp });

    console.log("[Recording] Paused at timestamp:", pauseStartTimestamp);
  };

  const handleResumeRecording = async () => {
    setIsPaused(false);

    // Update pause duration
    if (pauseStartTime) {
      const pauseDuration = (Date.now() - pauseStartTime) / 1000;
      setTotalPausedDuration((prev) => prev + pauseDuration);
      setPauseStartTime(null);

      // Close the current pause period
      const currentPauseStartTimestamp =
        (Date.now() - (recordingStartTime || Date.now())) / 1000;
      const lastPause =
        pausePeriodsRef.current[pausePeriodsRef.current.length - 1];
      if (lastPause && !lastPause.end) {
        lastPause.end = currentPauseStartTimestamp;
      }

      console.log(
        "[Recording] Resumed at timestamp:",
        currentPauseStartTimestamp
      );
    }
  };

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      if (isPaused) {
        await handleResumeRecording();
      } else {
        await handlePauseRecording();
      }
    } else {
      await handleStartRecording();
    }
  }, [isRecording, isPaused]);

  // Sync pause state with ref for audio processing callback
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Speaker assignment functions
  const handleSpeakerClick = (speakerId: string) => {
    setSelectedSpeaker(speakerId);
    setShowSpeakerModal(true);
  };

  const handleAssignSpeaker = async (participantUid: string) => {
    if (!selectedSpeaker || !transcriptId) return;

    try {
      const newMappings = {
        ...speakerMappings,
        [selectedSpeaker]: participantUid,
      };

      setSpeakerMappings(newMappings);

      // Save to Firestore
      const transcriptRef = doc(db, "transcripts", transcriptId);
      await updateDoc(transcriptRef, {
        speakerMappings: newMappings,
      });

      setShowSpeakerModal(false);
      setSelectedSpeaker(null);
    } catch (error) {
      console.error("Error saving speaker assignment:", error);
      alert("Failed to save speaker assignment. Please try again.");
    }
  };

  // Auto-save transcript to Firestore with comprehensive data
  const saveTranscriptToFirestore = useCallback(async () => {
    if (!transcriptId || !combinedFinalTranscript) return;

    try {
      const transcriptRef = doc(db, "transcripts", transcriptId);

      // Use filtered transcript data (excluding paused periods)
      const transcriptData = filterPausedResults(combinedFinalTranscript);
      const totalWords = transcriptData.reduce((count, result) => {
        return count + (result.alternatives?.[0]?.content ? 1 : 0);
      }, 0);

      const speakers = new Set();
      transcriptData.forEach((result) => {
        if (result.alternatives?.[0]?.speaker) {
          speakers.add(result.alternatives[0].speaker);
        }
      });

      // Get the latest timestamp to know how far we've progressed
      const latestTimestamp =
        transcriptData.length > 0
          ? Math.max(
              ...transcriptData
                .filter((r) => r.end_time)
                .map((r) => r.end_time!)
            )
          : 0;

      await updateDoc(transcriptRef, {
        transcriptContent: transcriptData,
        lastUpdated: new Date(),
        transcriptMetadata: {
          totalWords,
          uniqueSpeakers: Array.from(speakers),
          speakerCount: speakers.size,
          latestTimestamp,
          lastRecordingSession: new Date(),
          totalRecordingDuration,
          totalPausedDuration,
          pausePeriods: pausePeriodsRef.current,
        },
      });

      // Update our local saved data to match what was just saved
      setSavedTranscriptData(transcriptData);

      console.log(
        `[Auto-save] Transcript saved: ${totalWords} words, ${speakers.size} speakers, latest: ${latestTimestamp}s, paused: ${totalPausedDuration}s`
      );
    } catch (error) {
      console.error("[Auto-save] Error saving transcript:", error);
    }
  }, [
    transcriptId,
    combinedFinalTranscript,
    filterPausedResults,
    totalPausedDuration,
  ]);

  // Toggle hide unidentified speakers and save preference
  const toggleHideUnidentifiedSpeakers = useCallback(async () => {
    const newValue = !hideUnidentifiedSpeakers;
    setHideUnidentifiedSpeakers(newValue);

    if (transcriptId) {
      try {
        const transcriptRef = doc(db, "transcripts", transcriptId);
        await updateDoc(transcriptRef, {
          hideUnidentifiedSpeakers: newValue,
        });
      } catch (error) {
        console.error("Error saving hide preference:", error);
      }
    }
  }, [hideUnidentifiedSpeakers, transcriptId]);

  // Generate speaking analysis reports
  const handleGenerateReports = async () => {
    if (!transcriptId || savedTranscriptData.length === 0) {
      alert("No saved transcript data available for analysis");
      return;
    }

    // Check if there are any mapped speakers
    const mappedSpeakers = Object.keys(speakerMappings).filter(
      (speakerId) => speakerMappings[speakerId]
    );

    if (mappedSpeakers.length === 0) {
      alert("Please assign speakers to participants before generating reports");
      return;
    }

    setIsGeneratingReports(true);
    setShowCreateReportDialog(false);

    try {
      // Capture current eventId before local variable shadowing below
      const currentEventId = transcriptData?.eventId;
      const generateSpeakingReports = httpsCallable(
        functions,
        "generateSpeakingReports"
      );

      // Use saved Firestore transcript data (source of truth)
      const filteredTranscriptData = filterPausedResults(savedTranscriptData);

      const result = await generateSpeakingReports({
        transcriptId,
        speakerMappings,
        transcriptContent: filteredTranscriptData,
      });

      const data = result.data as {
        success: boolean;
        reportCount: number;
        reports: Array<{
          userId: string;
          overallScore: number;
          wordCount: number;
        }>;
      };

      if (data.success) {
        const message = `Successfully generated ${data.reportCount} speaking analysis reports!\n\nView the reports in the Speaking Analysis Reports section below, or visit:\n${window.location.href}`;
        alert(message);
        setReportsGenerated(true);
        // Load the generated reports
        await loadReports();

        // Also aggregate reports across all transcripts for this meetup event
        if (currentEventId) {
          try {
            const aggregateMeetupReports = httpsCallable(
              functions,
              "aggregateMeetupReports"
            );
            await aggregateMeetupReports({ eventId: currentEventId });
          } catch (aggErr) {
            console.error("Error aggregating meetup reports:", aggErr);
          }
        }
      } else {
        alert("Failed to generate reports. Please try again.");
      }
    } catch (error) {
      console.error("Error generating reports:", error);
      alert(
        "Failed to generate reports: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsGeneratingReports(false);
    }
  };

  // Load existing reports for this transcript
  const loadReports = useCallback(async () => {
    if (!transcriptId) return;

    try {
      // Query without orderBy to avoid composite index surprises, then sort client-side
      const reportsQuery = query(
        collection(db, "reports"),
        where("transcriptId", "==", transcriptId)
      );

      const querySnapshot = await getDocs(reportsQuery);
      const dedupMap = new Map<string, UserSpeakingReport>();

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const report = {
          ...data,
          metadata: {
            ...data.metadata,
            createdAt: data.metadata.createdAt.toDate(),
          },
        } as UserSpeakingReport;

        // Deduplicate by userId within this transcript (keep latest by createdAt)
        const existing = dedupMap.get(report.userId);
        if (!existing || existing.metadata.createdAt < report.metadata.createdAt) {
          dedupMap.set(report.userId, report);
        }
      });

      const loadedReports = Array.from(dedupMap.values());

      // Sort by createdAt desc in client
      loadedReports.sort(
        (a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      );
      setReports(loadedReports);
      setReportsGenerated(loadedReports.length > 0);
    } catch (error) {
      console.error("Error loading reports:", error);
    }
  }, [transcriptId]);

  // Get participant name for report display
  const getParticipantName = (userId: string): string => {
    const participant = participants.find((p) => p.uid === userId);
    if (!participant) return `User ${userId.substring(0, 6)}`;

    return participant.isLeader
      ? formatLeaderDisplay(participant)
      : formatParticipantDisplay(participant);
  };

  // Load transcript data
  useEffect(() => {
    if (!transcriptId) {
      setError("No transcript ID provided");
      setLoading(false);
      return;
    }

    const transcriptRef = doc(db, "transcripts", transcriptId);

    const unsubscribe = onSnapshot(
      transcriptRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const transcriptInfo = {
            id: docSnapshot.id,
            eventId: data.eventId,
            sessionNumber: data.sessionNumber,
            articleId: data.articleId,
            leaderUids: data.leaderUids || [],
            participantUids: data.participantUids || [],
            createdAt: data.createdAt?.toDate() || new Date(),
            createdBy: data.createdBy,
            speakerMappings: data.speakerMappings || {},
            transcriptContent: data.transcriptContent || [],
            hideUnidentifiedSpeakers: data.hideUnidentifiedSpeakers || false,
          };

          setTranscriptData(transcriptInfo);
          setSpeakerMappings(data.speakerMappings || {});
          setHideUnidentifiedSpeakers(data.hideUnidentifiedSpeakers || false);
          setReportsGenerated(data.reportsGenerated || false);

          // Load saved transcript data - this is the source of truth
          if (
            data.transcriptContent &&
            Array.isArray(data.transcriptContent) &&
            data.transcriptContent.length > 0
          ) {
            console.log(
              "[Transcript Loading] Restoring",
              data.transcriptContent.length,
              "saved transcript items"
            );
            setSavedTranscriptData(data.transcriptContent);
            setSavedSonioxTranscript(data.transcriptContent);
          } else {
            setSavedTranscriptData([]);
          }

          // Load saved recording duration
          if (data.transcriptMetadata?.totalRecordingDuration) {
            setTotalRecordingDuration(
              data.transcriptMetadata.totalRecordingDuration
            );
          }

          // Initialize keywords from transcript data and article
          const initializeKeywords = async () => {
            try {
              let allKeywords: string[] = [];

              // Get keywords from transcript custom keywords
              if (data.customKeywords && Array.isArray(data.customKeywords)) {
                allKeywords = [...data.customKeywords];
              }

              // Fetch article data and pronunciation keywords
              if (transcriptInfo.articleId) {
                const articleRef = doc(
                  db,
                  "articles",
                  transcriptInfo.articleId
                );
                const articleSnap = await getDoc(articleRef);

                if (articleSnap.exists()) {
                  const articleData = articleSnap.data() as ArticleData;
                  setArticleData(articleData);

                  // Add pronunciation keywords from article
                  if (
                    articleData.pronunciation_keywords &&
                    Array.isArray(articleData.pronunciation_keywords)
                  ) {
                    articleData.pronunciation_keywords.forEach((keyword) => {
                      if (!allKeywords.includes(keyword)) {
                        allKeywords.push(keyword);
                      }
                    });
                  }
                }
              }

              // Add leader names as keywords
              if (transcriptInfo.leaderUids.length > 0) {
                const userProfiles = await fetchUserProfiles(
                  transcriptInfo.leaderUids
                );
                userProfiles.forEach((profile) => {
                  if (
                    profile.displayName &&
                    !allKeywords.includes(profile.displayName)
                  ) {
                    allKeywords.push(profile.displayName);
                  }
                });
              }

              setKeywords(allKeywords);
              keywordsRef.current = allKeywords;
              console.log("[Keywords] Initialized keywords:", allKeywords);
              console.log("[Keywords] About to set keywordsLoaded to true");
              setKeywordsLoaded(true);
              keywordsLoadedRef.current = true;
              console.log("[Keywords] Keywords loaded state set to true");
            } catch (error) {
              console.error("Error initializing keywords:", error);
              // Even if there's an error, mark keywords as loaded so recording can proceed
              console.log(
                "[Keywords] Error occurred, but marking keywords as loaded anyway"
              );
              setKeywordsLoaded(true);
              keywordsLoadedRef.current = true;
            }
          };

          initializeKeywords();

          // Fetch user details for participants and leaders with phone numbers
          const fetchParticipantDetails = async () => {
            try {
              const allUids = [
                ...transcriptInfo.leaderUids,
                ...transcriptInfo.participantUids,
              ];
              if (allUids.length > 0) {
                const userDetailsWithPhone = await fetchUserDetails(allUids);
                const enhancedProfiles = userDetailsWithPhone.map((user) => ({
                  uid: user.uid,
                  displayName: user.displayName,
                  photoURL: user.photoURL,
                  phoneNumber: user.phoneNumber,
                  phoneLast4: user.phoneLast4,
                  isLeader: transcriptInfo.leaderUids.includes(user.uid),
                }));
                setParticipants(enhancedProfiles);
              }
            } catch (error) {
              console.error("Error fetching user details:", error);
            }
          };

          fetchParticipantDetails();
        } else {
          setError("Transcript not found");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching transcript:", err);
        setError("Failed to load transcript");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [transcriptId]);

  // Load reports when transcript data is available
  useEffect(() => {
    if (transcriptData && reportsGenerated) {
      loadReports();
    }
  }, [transcriptData, reportsGenerated, loadReports]);

  // Auto-save transcript when it changes - ONLY during active recording
  useEffect(() => {
    if (isRecording && !isPaused && newLiveData.length > 0) {
      // Save every 2 seconds during active recording when there's new live data
      const saveTimer = setTimeout(() => {
        saveTranscriptToFirestore();
      }, 2000);

      return () => clearTimeout(saveTimer);
    }
  }, [newLiveData.length, saveTranscriptToFirestore, isRecording, isPaused]);

  // Generate qualitative analysis after transcript data is loaded and stable
  useEffect(() => {
    if (
      filteredFinalTranscript.length > 0 &&
      Object.keys(calculateSpeakingMetrics).length > 0 &&
      !isRecording && // Only run when not actively recording
      !isLoadingQualitativeAnalysis &&
      Object.keys(qualitativeAnalysis).length === 0 // Only run if not already generated
    ) {
      // Delay the analysis to ensure UI has loaded first
      const analysisTimer = setTimeout(() => {
        generateQualitativeAnalysis();
      }, 1000);

      return () => clearTimeout(analysisTimer);
    }
  }, [
    filteredFinalTranscript.length,
    calculateSpeakingMetrics,
    isRecording,
    isLoadingQualitativeAnalysis,
    qualitativeAnalysis,
    generateQualitativeAnalysis,
  ]);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const formatTimestamp = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

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
    const clickPosition =
      (e.clientX - progressBar.getBoundingClientRect().left) /
      progressBar.clientWidth;
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

  // Jump to specific timestamp
  const jumpToTimestamp = useCallback(
    (timestamp: number) => {
      if (!audioPlayerRef.current) return;
      audioPlayerRef.current.currentTime = timestamp;
      setAudioCurrentTime(timestamp);

      if (!isAudioPlaying) {
        audioPlayerRef.current.play();
        setIsAudioPlaying(true);
      }
    },
    [isAudioPlaying]
  );

  // Create a flat array of words with timestamps for word-level syncing
  const flatWordsWithTimestamps = useMemo(() => {
    return filteredFinalTranscript
      .filter((item) => item.alternatives && item.alternatives[0])
      .map((item, originalIndex) => ({
        content: item.alternatives[0].content,
        startTime: item.start_time || 0,
        endTime: item.end_time || 0,
        speaker: item.alternatives[0].speaker || "UU",
        confidence: item.alternatives[0].confidence || 1,
        originalIndex,
      }));
  }, [filteredFinalTranscript]);

  // Jump to specific word timestamp
  const jumpToWordTimestamp = useCallback(
    (snippetIndex: number, wordIndex: number) => {
      if (!audioPlayerRef.current || !filteredDisplaySnippets[snippetIndex])
        return;

      const snippet = filteredDisplaySnippets[snippetIndex];
      const word = snippet.words[wordIndex];

      // Find the word in flat words data to get exact timing
      const wordFromFlat = flatWordsWithTimestamps.find(
        (flatWord) =>
          flatWord.content === word.content &&
          Math.abs(flatWord.startTime - snippet.startTime) < 10 // Within 10 seconds of snippet start
      );

      const targetTime = wordFromFlat
        ? wordFromFlat.startTime
        : snippet.startTime;
      jumpToTimestamp(targetTime);
    },
    [filteredDisplaySnippets, flatWordsWithTimestamps, jumpToTimestamp]
  );

  // Handle audio time updates for word-level transcript highlighting
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
      return (
        currentTime >= snippet.startTime &&
        (!nextSnippet || currentTime < nextSnippet.startTime)
      );
    });

    // Map to filtered index if needed
    let mappedSnippetIndex = -1;
    if (currentSnippetIndex !== -1) {
      const currentSnippet = displaySnippets[currentSnippetIndex];
      mappedSnippetIndex = filteredDisplaySnippets.findIndex(
        (snippet) =>
          snippet.speaker === currentSnippet.speaker &&
          snippet.startTime === currentSnippet.startTime
      );
    }

    if (
      mappedSnippetIndex !== -1 &&
      mappedSnippetIndex !== currentlyHighlightedSnippet
    ) {
      setCurrentlyHighlightedSnippet(mappedSnippetIndex);
    }

    // Find currently playing word for word-level highlighting
    if (
      mappedSnippetIndex !== -1 &&
      filteredDisplaySnippets[mappedSnippetIndex]
    ) {
      const currentSnippet = filteredDisplaySnippets[mappedSnippetIndex];

      // Find which word in the snippet is currently playing
      let cumulativeTime = currentSnippet.startTime;
      let currentWordIndex = -1;

      // Use flat words data to find exact word timing
      const currentWordFromFlat = flatWordsWithTimestamps.find(
        (word) => word.startTime <= currentTime && word.endTime >= currentTime
      );

      if (currentWordFromFlat) {
        // Find this word in the current snippet
        currentWordIndex = currentSnippet.words.findIndex((word, index) => {
          // Match by content and approximate timing
          return word.content === currentWordFromFlat.content;
        });
      }

      // Update word highlighting
      const newWordHighlight =
        currentWordIndex !== -1
          ? {
              snippetIndex: mappedSnippetIndex,
              wordIndex: currentWordIndex,
            }
          : null;

      if (
        JSON.stringify(newWordHighlight) !==
        JSON.stringify(currentlyHighlightedWord)
      ) {
        setCurrentlyHighlightedWord(newWordHighlight);
      }
    } else {
      // Clear word highlighting if no snippet is active
      if (currentlyHighlightedWord) {
        setCurrentlyHighlightedWord(null);
      }
    }
  }, [
    displaySnippets,
    filteredDisplaySnippets,
    currentlyHighlightedSnippet,
    currentlyHighlightedWord,
    flatWordsWithTimestamps,
  ]);

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
        setCurrentlyHighlightedWord(null);
      };

      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", handleEnded);
      };
    }
  }, [recordedAudioUrl, handleAudioTimeUpdate]);

  // Keyword management functions
  const addKeyword = async () => {
    if (!newKeyword.trim() || !transcriptId) return;

    const trimmedKeyword = newKeyword.trim();
    if (keywords.includes(trimmedKeyword)) {
      alert("Keyword already exists!");
      return;
    }

    try {
      const updatedKeywords = [...keywords, trimmedKeyword];
      setKeywords(updatedKeywords);
      keywordsRef.current = updatedKeywords;
      setNewKeyword("");
      console.log(
        "[Keywords] Added keyword:",
        trimmedKeyword,
        "Total keywords:",
        updatedKeywords.length
      );

      // Save to Firestore
      const transcriptRef = doc(db, "transcripts", transcriptId);
      await updateDoc(transcriptRef, {
        customKeywords: updatedKeywords,
      });
    } catch (error) {
      console.error("Error adding keyword:", error);
      alert("Failed to add keyword. Please try again.");
    }
  };

  const removeKeyword = async (keywordToRemove: string) => {
    if (!transcriptId) return;

    try {
      const updatedKeywords = keywords.filter(
        (keyword) => keyword !== keywordToRemove
      );
      setKeywords(updatedKeywords);
      keywordsRef.current = updatedKeywords;

      // Save to Firestore
      const transcriptRef = doc(db, "transcripts", transcriptId);
      await updateDoc(transcriptRef, {
        customKeywords: updatedKeywords,
      });
    } catch (error) {
      console.error("Error removing keyword:", error);
      alert("Failed to remove keyword. Please try again.");
    }
  };

  // Prepare custom dictionary for Soniox
  const prepareCustomDictionary = useCallback(() => {
    const currentKeywords = keywordsRef.current;
    console.log(
      "[Custom Dictionary] Using keywords from ref:",
      currentKeywords
    );
    const dictionary = currentKeywords.map((keyword) => {
      // Add sounds_like for better recognition
      const entry: { content: string; sounds_like?: string[] } = {
        content: keyword,
        sounds_like: [keyword], // Add the exact word as sounds_like
      };

      // Add common variations for better recognition
      if (keyword.includes(" ")) {
        // For phrases, add variations without spaces
        entry.sounds_like!.push(keyword.replace(/\s+/g, ""));
      }

      // Add variations for names (capitalize first letter)
      if (keyword.toLowerCase() !== keyword) {
        entry.sounds_like!.push(keyword.toLowerCase());
      }

      return entry;
    });

    console.log(
      "[Custom Dictionary] Prepared dictionary:",
      JSON.stringify(dictionary, null, 2)
    );
    return dictionary;
  }, []); // No longer depends on keywords state since we use ref

  if (loading) {
    return (
      <Container>
        <LoadingMessage>Loading transcript...</LoadingMessage>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorMessage>{error}</ErrorMessage>
      </Container>
    );
  }

  if (!transcriptData) {
    return (
      <Container>
        <ErrorMessage>Transcript data not available</ErrorMessage>
      </Container>
    );
  }

  return (
    <Container>
      <Content>
        {/* Provider Selection removed (Soniox-only) */}

        {transcriptionError && (
          <ErrorMessage>{transcriptionError}</ErrorMessage>
        )}

        <SessionInfoGrid>
          <SessionInfo>
            <SessionTitle>Session {transcriptData.sessionNumber}</SessionTitle>
            <SessionDetail>
              <strong>Article:</strong>{" "}
              {articleData?.title?.english ? (
                <ArticleLink
                  href={`/article/${transcriptData.articleId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {articleData.title.english}
                </ArticleLink>
              ) : (
                <ArticleLink
                  href={`/article/${transcriptData.articleId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {transcriptData.articleId}
                </ArticleLink>
              )}
            </SessionDetail>
            <SessionDetail>
              <strong>Leaders:</strong>
              <ParticipantsList>
                {participants
                  .filter((participant) => participant.isLeader)
                  .map((leader) => (
                    <ParticipantChip key={leader.uid} $isLeader>
                      <UserAvatar uid={leader.uid} size={24} isLeader={true} />
                      <span>{formatLeaderDisplay(leader)}</span>
                    </ParticipantChip>
                  ))}
                {participants.filter((p) => p.isLeader).length === 0 &&
                  transcriptData.leaderUids.map((uid) => (
                    <ParticipantChip key={uid} $isLeader>
                      <UserAvatar uid={uid} size={24} isLeader={true} />
                      <span>Loading...</span>
                    </ParticipantChip>
                  ))}
              </ParticipantsList>
            </SessionDetail>
            <SessionDetail>
              <strong>Participants:</strong>
              <ParticipantsList>
                {participants
                  .filter((participant) => !participant.isLeader)
                  .map((participant) => (
                    <ParticipantChip key={participant.uid}>
                      <UserAvatar
                        uid={participant.uid}
                        size={24}
                        isLeader={false}
                      />
                      <span>{formatParticipantDisplay(participant)}</span>
                    </ParticipantChip>
                  ))}
                {participants.filter((p) => !p.isLeader).length === 0 &&
                  transcriptData.participantUids.map((uid) => (
                    <ParticipantChip key={uid}>
                      <UserAvatar uid={uid} size={24} isLeader={false} />
                      <span>Loading...</span>
                    </ParticipantChip>
                  ))}
              </ParticipantsList>
            </SessionDetail>
          </SessionInfo>

          <ChartPanel>
            <ChartTitle>Speaking Time Share</ChartTitle>
            <Pie
              data={pieChartData}
              options={{
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      usePointStyle: true,
                      pointStyle: "circle",
                      boxWidth: 10,
                      boxHeight: 10,
                      padding: 14,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: (ctx: any) => {
                        const label = ctx.label || "";
                        const value = ctx.parsed || 0;
                        return `${label}: ${value}s`;
                      },
                    },
                  },
                },
              }}
            />
          </ChartPanel>
        </SessionInfoGrid>

        <ConversationDetailContainer>
          <ConversationDetailLeft>
            <AppSpeechDetails>
              <SectionHeader>Keywords</SectionHeader>
              <KeywordManagementSection>
                <KeywordInputContainer>
                  <KeywordInput
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Add a custom keyword..."
                    onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                  />
                  <AddKeywordButton
                    onClick={addKeyword}
                    disabled={!newKeyword.trim()}
                  >
                    Add
                  </AddKeywordButton>
                </KeywordInputContainer>
                <KeywordsList>
                  {keywords.map((keyword) => (
                    <KeywordChip key={keyword}>
                      {keyword}
                      <RemoveKeywordButton
                        onClick={() => removeKeyword(keyword)}
                        title="Remove keyword"
                      >
                        ×
                      </RemoveKeywordButton>
                    </KeywordChip>
                  ))}
                </KeywordsList>
              </KeywordManagementSection>
            </AppSpeechDetails>

            <AppSpeechDetails>
              <SectionHeader>
                <span>Speakers</span>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <ToggleButton
                    $active={hideUnidentifiedSpeakers}
                    onClick={() => setHideUnidentifiedSpeakers(!hideUnidentifiedSpeakers)}
                    title={hideUnidentifiedSpeakers ? "Show all speakers including Unknown" : "Hide Unknown speakers"}
                  >
                    {hideUnidentifiedSpeakers ? "Show All" : "Hide Unknown"}
                  </ToggleButton>

                  {/* Recording controls with dropdown */}
                  <div data-dropdown-container style={{ position: "relative" }}>
                    {isRecording ? (
                      <SplitRecordButton $isRecording={isRecording && !isPaused}>
                        <RecordButtonMain
                          $isRecording={isRecording && !isPaused}
                          onClick={toggleRecording}
                          disabled={isStarting}
                        >
                          {isPaused ? (
                            <>
                              <RecordIcon />
                              Resume Recording
                            </>
                          ) : (
                            <>
                              <PulseIcon />
                              Pause Recording
                            </>
                          )}
                        </RecordButtonMain>
                        <RecordButtonDropdown
                          $isRecording={isRecording && !isPaused}
                          onClick={() => setShowRecordingDropdown(!showRecordingDropdown)}
                          disabled={isStarting}
                        >
                          ▼
                        </RecordButtonDropdown>
                        <DropdownMenu $isOpen={showRecordingDropdown}>
                          <DropdownItem onClick={handleStopRecording}>
                            Stop Recording
                          </DropdownItem>
                        </DropdownMenu>
                      </SplitRecordButton>
                    ) : (
                      <RecordButton
                        $isRecording={false}
                        onClick={toggleRecording}
                        disabled={isStarting || !keywordsLoaded}
                      >
                        {isStarting ? (
                          <>
                            <PulseIcon />
                            Starting...
                          </>
                        ) : !keywordsLoaded ? (
                          <>
                            <PulseIcon />
                            Loading Keywords...
                          </>
                        ) : (
                          <>
                            <RecordIcon />
                            Start Recording
                          </>
                        )}
                      </RecordButton>
                    )}
                  </div>
                </div>
              </SectionHeader>
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
                  Low confidence words appear underlined • Click timestamps to
                  jump to audio position • Keywords are used as custom
                  dictionary for better recognition
                  {hideUnidentifiedSpeakers &&
                    " • Unidentified speakers are hidden"}
                </ConfidenceNote>
              </LegendContent>
            </AppSpeechDetails>

            {/* Render transcript snippets */}
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
              const speakerInfo = getSpeakerDisplayInfo(snippet.speaker);
              const hasAudio = !!recordedAudioUrl;
              const isHighlighted = currentlyHighlightedSnippet === index;

              return (
                <TranscriptSnippet
                  key={`snippet-${index}`}
                  style={{
                    backgroundColor: isHighlighted ? "#fff2cc" : "transparent",
                    transition: "background-color 0.3s ease",
                  }}
                >
                  <div>
                    {speakerInfo.isAssigned && speakerInfo.avatar ? (
                      <UserAvatar
                        uid={speakerInfo.avatar}
                        size={40}
                        isLeader={speakerInfo.isLeader}
                        onClick={() => handleSpeakerClick(snippet.speaker)}
                      />
                    ) : (
                      <SpeakerAvatar
                        $bgColor={speakerColor.avatar}
                        $textColor="#ffffff"
                        onClick={() => handleSpeakerClick(snippet.speaker)}
                      >
                        {snippet.speaker === "UU"
                          ? "U"
                          : snippet.speaker.slice(1)}
                      </SpeakerAvatar>
                    )}
                  </div>
                  <TranscriptContent>
                    <TranscriptHeadRow>
                      <SpeakerName $color={speakerColor.avatar}>
                        {speakerInfo.name}
                      </SpeakerName>
                      <Timestamp
                        style={{ cursor: hasAudio ? "pointer" : "default" }}
                        onClick={() =>
                          hasAudio && jumpToTimestamp(snippet.startTime)
                        }
                      >
                        {formatTimestamp(snippet.startTime)}
                      </Timestamp>
                    </TranscriptHeadRow>
                    <TranscriptBody>
                      {snippet.words.map((word, wordIndex) => {
                        const isCurrentlyPlaying =
                          currentlyHighlightedWord &&
                          currentlyHighlightedWord.snippetIndex === index &&
                          currentlyHighlightedWord.wordIndex === wordIndex;

                        const isPunctuation = isPunctuationOrAttached(word);

                        return (
                          <WordSpan
                            key={`word-${index}-${wordIndex}`}
                            $lowConfidence={
                              word.confidence !== undefined &&
                              word.confidence < 0.9
                            }
                            $isPartial={word.isPartial}
                            $isCurrentlyPlaying={isCurrentlyPlaying}
                            $isPunctuation={isPunctuation}
                            onClick={() =>
                              jumpToWordTimestamp(index, wordIndex)
                            }
                            title={`Click to jump to this word${
                              hasAudio ? "" : " (no audio available)"
                            }`}
                            style={{
                              cursor: hasAudio ? "pointer" : "default",
                              pointerEvents: hasAudio ? "auto" : "none",
                            }}
                          >
                            {word.content}
                            {/* Add space after word unless it's punctuation */}
                            {!word.preserveSpacing && !isPunctuationOrAttached(word) ? " " : ""}
                          </WordSpan>
                        );
                      })}
                    </TranscriptBody>
                  </TranscriptContent>
                </TranscriptSnippet>
              );
            })}

            {conversationItems.length === 0 && (
              <EmptyState>
                {displaySnippets.length === 0
                  ? isRecording
                    ? isPaused
                      ? "Recording is paused. Audio continues but transcript processing is stopped."
                      : "Listening..."
                    : 'Click "Start Recording" to begin.'
                  : 'All speakers are hidden. Toggle "Show All" to see unidentified speakers.'}
              </EmptyState>
            )}

            {/* Speaking Analysis Reports Section */}
            <ReportsSection>
              <SectionHeader>
                <span>Speaking Analysis Reports</span>
                <ToggleButton
                  $active={false}
                  onClick={() => setShowCreateReportDialog(true)}
                  title="Generate speaking reports for participants"
                >
                  📊 Generate Reports
                </ToggleButton>
              </SectionHeader>

              {reports.length === 0 ? (
                <EmptyState>
                  No reports yet. Click "Generate Reports" to analyze this transcript and create per-participant reports.
                </EmptyState>
              ) : (
                reports.map((report) => (
                  <ReportCard
                    key={`${report.userId}_${report.metadata.createdAt.getTime()}`}
                    onClick={() => {
                      setSelectedReport(report);
                      setShowDetailedReport(true);
                    }}
                  >
                    <ReportHeader>
                      <ReportUserName>
                        <UserAvatar
                          uid={report.userId}
                          size={32}
                          isLeader={
                            participants.find((p) => p.uid === report.userId)
                              ?.isLeader || false
                          }
                        />
                        {getParticipantName(report.userId)}
                      </ReportUserName>
                      <ReportScore $score={report.analysis.overallScore}>
                        {report.analysis.overallScore.toFixed(1)}/10
                      </ReportScore>
                    </ReportHeader>

                    <ReportMetrics>
                      <ReportMetric>
                        <ReportMetricValue>
                          {report.metadata.wordCount}
                        </ReportMetricValue>
                        <ReportMetricLabel>Words</ReportMetricLabel>
                      </ReportMetric>
                      <ReportMetric>
                        <ReportMetricValue>
                          {Math.round(report.metadata.speakingDuration)}s
                        </ReportMetricValue>
                        <ReportMetricLabel>Duration</ReportMetricLabel>
                      </ReportMetric>
                      <ReportMetric>
                        <ReportMetricValue>
                          {Math.round(report.metadata.averageWordsPerMinute)}
                        </ReportMetricValue>
                        <ReportMetricLabel>WPM</ReportMetricLabel>
                      </ReportMetric>
                    </ReportMetrics>

                    <ReportPreview>
                      <strong>Top Strength:</strong> {report.analysis.strengths[0] || "Good participation"}
                      <br />
                      <strong>Focus Area:</strong> {report.analysis.areasForImprovement[0] || "Continue practicing"}
                    </ReportPreview>
                  </ReportCard>
                ))
              )}
            </ReportsSection>
          </ConversationDetailLeft>
        </ConversationDetailContainer>
      </Content>

      {/* Create Report Dialog */}
      {showCreateReportDialog && (
        <ReportDialogOverlay onClick={() => setShowCreateReportDialog(false)}>
          <ReportDialogContainer onClick={(e) => e.stopPropagation()}>
            <ReportDialogTitle>
              Create Speaking Analysis Reports
            </ReportDialogTitle>
            <ReportDialogContent>
              <p>
                Generate AI-powered speaking analysis reports for all
                participants who were assigned to speakers during this session.
              </p>
              <p>
                The analysis will include scores for fluency, vocabulary,
                grammar, pronunciation, and engagement, along with personalized
                feedback and improvement suggestions.
              </p>
              {Object.keys(speakerMappings).filter((id) => speakerMappings[id])
                .length === 0 && (
                <p style={{ color: "#ef4444", fontWeight: "600" }}>
                  ⚠️ No speakers have been assigned to participants yet. Please
                  assign speakers before generating reports.
                </p>
              )}
            </ReportDialogContent>
            <ReportDialogActions>
              <ReportDialogButton
                onClick={() => setShowCreateReportDialog(false)}
              >
                Cancel
              </ReportDialogButton>
              <ReportDialogButton
                $variant="primary"
                onClick={handleGenerateReports}
                disabled={
                  Object.keys(speakerMappings).filter(
                    (id) => speakerMappings[id]
                  ).length === 0
                }
              >
                {isGeneratingReports ? (
                  <>
                    <PulseIcon />
                    Generating Reports...
                  </>
                ) : (
                  <>📊 Generate Reports</>
                )}
              </ReportDialogButton>
            </ReportDialogActions>
          </ReportDialogContainer>
        </ReportDialogOverlay>
      )}

      {/* Speaker Assignment Modal */}
      {showSpeakerModal && selectedSpeaker && (
        <ModalOverlay onClick={() => setShowSpeakerModal(false)}>
          <ModalContainer onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Assign Speaker</ModalTitle>
            <ModalSubtitle>
              Who is{" "}
              {selectedSpeaker === "UU"
                ? "Unknown Speaker"
                : `Speaker ${selectedSpeaker.slice(1)}`}
              ? Click on a participant to assign them to this speaker.
            </ModalSubtitle>

            <ParticipantGrid>
              {participants.map((participant) => (
                <ParticipantOption
                  key={participant.uid}
                  onClick={() => handleAssignSpeaker(participant.uid)}
                >
                  <UserAvatar
                    uid={participant.uid}
                    size={40}
                    isLeader={participant.isLeader}
                  />
                  <ParticipantInfo>
                    <ParticipantName>
                      {participant.isLeader
                        ? formatLeaderDisplay(participant)
                        : formatParticipantDisplay(participant)}
                    </ParticipantName>
                    <ParticipantRole>
                      {participant.isLeader ? "Leader" : "Participant"}
                    </ParticipantRole>
                  </ParticipantInfo>
                </ParticipantOption>
              ))}
            </ParticipantGrid>

            <ModalActions>
              <ModalButton onClick={() => setShowSpeakerModal(false)}>
                Cancel
              </ModalButton>
            </ModalActions>
          </ModalContainer>
        </ModalOverlay>
      )}

      {/* Audio Player */}
      {recordedAudioUrl && (
        <>
          <AudioPlayerContainer $isVisible={!!recordedAudioUrl}>
            <AudioControls>
              <AudioButton onClick={toggleAudioPlayback}>
                {isAudioPlaying ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    style={{ width: "1.5rem", height: "1.5rem" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 5.25v13.5m-7.5-13.5v13.5"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    style={{ width: "1.5rem", height: "1.5rem" }}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                    />
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
            style={{ display: "none" }}
          />
        </>
      )}

      {/* Detailed Report Modal */}
      {showDetailedReport && selectedReport && (
        <DetailedReportModal onClick={() => setShowDetailedReport(false)}>
          <DetailedReportContainer onClick={(e) => e.stopPropagation()}>
            <DetailedReportTitle>
              Speaking Analysis Report -{" "}
              {getParticipantName(selectedReport.userId)}
            </DetailedReportTitle>

            {/* Overall Score and Category Scores */}
            <ScoreGrid>
              <ScoreCard>
                <ScoreTitle>Overall Score</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.overallScore}>
                  {selectedReport.analysis.overallScore.toFixed(1)}/10
                </ScoreValue>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Fluency</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.fluency.score}>
                  {selectedReport.analysis.fluency.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.fluency.feedback}
                </ScoreFeedback>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Vocabulary</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.vocabulary.score}>
                  {selectedReport.analysis.vocabulary.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.vocabulary.feedback}
                </ScoreFeedback>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Grammar</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.grammar.score}>
                  {selectedReport.analysis.grammar.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.grammar.feedback}
                </ScoreFeedback>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Pronunciation</ScoreTitle>
                <ScoreValue
                  $score={selectedReport.analysis.pronunciation.score}
                >
                  {selectedReport.analysis.pronunciation.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.pronunciation.feedback}
                </ScoreFeedback>
              </ScoreCard>
              <ScoreCard>
                <ScoreTitle>Engagement</ScoreTitle>
                <ScoreValue $score={selectedReport.analysis.engagement.score}>
                  {selectedReport.analysis.engagement.score}/10
                </ScoreValue>
                <ScoreFeedback>
                  {selectedReport.analysis.engagement.feedback}
                </ScoreFeedback>
              </ScoreCard>
            </ScoreGrid>

            {/* Strengths */}
            <FeedbackSection>
              <FeedbackTitle>Strengths</FeedbackTitle>
              <FeedbackList>
                {selectedReport.analysis.strengths.map((strength, index) => (
                  <FeedbackItem key={index}>{strength}</FeedbackItem>
                ))}
              </FeedbackList>
            </FeedbackSection>

            {/* Areas for Improvement */}
            <FeedbackSection>
              <FeedbackTitle>Areas for Improvement</FeedbackTitle>
              <FeedbackList>
                {selectedReport.analysis.areasForImprovement.map(
                  (area, index) => (
                    <FeedbackItem key={index}>{area}</FeedbackItem>
                  )
                )}
              </FeedbackList>
            </FeedbackSection>

            {/* Specific Suggestions */}
            <FeedbackSection>
              <FeedbackTitle>Specific Suggestions</FeedbackTitle>
              <FeedbackList>
                {selectedReport.analysis.specificSuggestions.map(
                  (suggestion, index) => (
                    <FeedbackItem key={index}>{suggestion}</FeedbackItem>
                  )
                )}
              </FeedbackList>
            </FeedbackSection>

            {/* Speaking Statistics */}
            <FeedbackSection>
              <FeedbackTitle>📊 Speaking Statistics</FeedbackTitle>
              <ReportMetrics>
                <ReportMetric>
                  <ReportMetricValue>
                    {selectedReport.metadata.wordCount}
                  </ReportMetricValue>
                  <ReportMetricLabel>Total Words</ReportMetricLabel>
                </ReportMetric>
                <ReportMetric>
                  <ReportMetricValue>
                    {Math.round(selectedReport.metadata.speakingDuration)}s
                  </ReportMetricValue>
                  <ReportMetricLabel>Speaking Duration</ReportMetricLabel>
                </ReportMetric>
                <ReportMetric>
                  <ReportMetricValue>
                    {Math.round(selectedReport.metadata.averageWordsPerMinute)}
                  </ReportMetricValue>
                  <ReportMetricLabel>Words Per Minute</ReportMetricLabel>
                </ReportMetric>
                <ReportMetric>
                  <ReportMetricValue>
                    {selectedReport.metadata.createdAt.toLocaleDateString()}
                  </ReportMetricValue>
                  <ReportMetricLabel>Report Date</ReportMetricLabel>
                </ReportMetric>
              </ReportMetrics>
            </FeedbackSection>

            {/* User's Transcript */}
            <TranscriptSection>
              <TranscriptTitle>
                <DocumentTextIcon />
                Your Speaking Transcript
              </TranscriptTitle>
              <TranscriptText>{selectedReport.userScript}</TranscriptText>
            </TranscriptSection>

            <ReportDialogActions>
              <ReportDialogButton onClick={() => setShowDetailedReport(false)}>
                Close
              </ReportDialogButton>
            </ReportDialogActions>
          </DetailedReportContainer>
        </DetailedReportModal>
      )}
    </Container>
  );
}
