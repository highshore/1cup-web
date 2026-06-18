"use client";

import { styled } from "styled-components";
import { auth, storage, db, functions } from "../lib/firebase/firebase";
import { useState, useEffect } from "react";
import {
  getDownloadURL,
  ref,
  uploadBytes,
  deleteObject,
} from "firebase/storage";
import { updateProfile, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import { httpsCallable } from "firebase/functions";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import { saveFeedback } from "../lib/services/feedback_service";
import { appLayout } from "../lib/constants/app_layout";
import {
  AcademicCapIcon,
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CameraIcon,
  ChevronRightIcon,
  CheckBadgeIcon,
  CreditCardIcon,
  EyeIcon,
  MapPinIcon,
  PencilSquareIcon,
  PhoneIcon,
  ShareIcon,
  SparklesIcon,
  TrashIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Updated Wrapper to use full width and follow layout guidelines
const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 0;
  padding: 0;
  max-width: none;
  margin: 0 auto;
`;

// Transparent bordered card
const TransparentCard = styled.div`
  background-color: transparent;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 20px;
  width: 100%;
  margin-bottom: 20px;
  font-family: inherit; /* Ensure consistent font */
`;

// Set consistent card width according to layout's content width
const Card = styled.div`
  background-color: transparent;
  border-radius: 8px;
  padding: 20px;
  width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  font-family: inherit; /* Ensure consistent font */
`;

// Responsive wrapper for main sections
const MainSectionsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;

  @media (min-width: 768px) {
    flex-direction: row;
    gap: 20px;

    > * {
      flex: 1;
    }
  }
`;

// User Info section with avatar on right
const UserInfoSection = styled(TransparentCard)`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const UserInfoContent = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
`;

const UserDetails = styled.div`
  flex: 1;
`;

const UserAvatarSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-left: 20px;
`;

const AvatarActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 8px;
`;

const AvatarActionButton = styled.div`
  font-size: 12px;
  color: #777;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: #2c1810;
    text-decoration: underline;
  }
`;

const InfoLabel = styled.span`
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.25rem;
  width: 80px;
  display: inline-block;
  text-align: left;
`;

const InfoValue = styled.span`
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-family: inherit; /* Ensure consistent font */
`;

const InfoValueWithIcon = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #f8f9fa;
  }

  .username-text {
    font-size: 0.9rem;
    font-weight: 500;
    font-family: inherit;
  }
`;

const PencilIcon = styled.svg`
  width: 14px;
  height: 14px;
  color: #666;
  transition: color 0.2s ease;

  ${InfoValueWithIcon}:hover & {
    color: #2c1810;
  }
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 16px;
`;

const SectionTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #333;
  border-bottom: 1px solid #ddd;
  padding-bottom: 15px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionContent = styled.div`
  padding-top: 10px;
  width: 100%;
`;

const AvatarUpload = styled.label`
  width: 80px;
  height: 80px;
  overflow: hidden;
  border-radius: 50%;
  background-color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &:hover::after {
    content: "변경";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    font-size: 12px;
    text-align: center;
    padding: 4px 0;
  }

  svg {
    width: 50px;
  }
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const AvatarInput = styled.input`
  display: none;
`;

const NameInput = styled.input`
  font-size: 16px;
  font-weight: 500;
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  width: 200px;
  outline: none;

  &:focus {
    border-color: #4caf50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
  }
`;

const NameEditContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const CheckmarkIcon = styled.span`
  position: absolute;
  right: 10px;
  color: #4caf50;
  font-size: 18px;
  cursor: pointer;
`;

// Subscription styles
const StatusBadge = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>`
  display: inline-block;
  background-color: ${(props) => (props.active ? "#00a000" : "#808080")};
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 1rem;
  font-weight: 600;
  margin-left: 10px;
`;

const Button = styled.button`
  background-color: #2c1810;
  color: white;
  font-weight: 600;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 20px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    background-color: #3a66e5;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    background-color: #a0b0e0;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const DangerButton = styled(Button)`
  background-color: #e74c3c;
  &:hover {
    background-color: #c0392b;
  }
`;

const ConfirmationOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ConfirmationDialog = styled.div`
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
`;

const CancelButton = styled(Button)`
  background-color: #757575;

  &:hover {
    background-color: #616161;
  }
`;

const LogoutButton = styled.button`
  background-color: #d73a49;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 10px;
  width: auto;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    background-color: #c92532;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

// Enhanced article list styles
const ArticlesList = styled.div`
  margin: -10px 0;
  max-height: 300px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(44, 24, 16, 0.5) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(44, 24, 16, 0.3);
    border-radius: 6px;
  }
`;

const ArticleItem = styled.div`
  padding: 12px;
  border-radius: 6px;
  background-color: transparent;
  border: 1px solid #eee;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
`;

const ArticleTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 5px;
`;

const ArticleDate = styled.div`
  font-size: 12px;
  color: #777;
`;

const WordItem = styled.div`
  padding: 8px 12px;
  margin: 6px 0;
  border-radius: 4px;
  background-color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  }
`;

const WordsList = styled.div`
  max-height: 200px;
  overflow-y: auto;
  margin-top: 15px;
`;

const AlertCard = styled(Card).withConfig({
  shouldForwardProp: (prop) => prop !== "type",
})<{ type: "error" | "success" }>`
  background-color: ${(props) =>
    props.type === "success" ? "#e8f5e9" : "#ffebee"};
  margin-bottom: 1rem;
  border-radius: 20px;

  p {
    color: ${(props) => (props.type === "success" ? "#2e7d32" : "#c62828")};
  }
`;

// Define SubscriptionInfo section
const SubscriptionInfo = styled(TransparentCard)``;

const SubscribeAgainButton = styled(Button)`
  background-color: #2c1810;
  width: 100%;
  &:hover {
    background-color: #4a2d1d;
  }
`;

// New style for the cancel subscription link
const CancelLinkButton = styled.button`
  background-color: transparent;
  color: #808080; // Muted gray color
  padding: 0.5rem; // Minimal padding
  border: none;
  border-radius: 4px; // Slight rounding
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;

  &:hover {
    color: #c0392b; // Subtle danger color on hover
    text-decoration: underline;
  }

  &:disabled {
    color: #bdbdbd; // Disabled color
    cursor: not-allowed;
    text-decoration: none;
  }
`;

// Define subscription status type
type SubscriptionStatus = "active" | "canceled" | "pending" | "unknown";

interface SubscriptionData {
  status: SubscriptionStatus;
  startDate?: Date;
  nextBillingDate?: Date | null;
  cancelledDate?: Date;
  paymentMethod?: string;
  billingKey?: string;
  billingCancelled?: boolean;
}

interface UserData {
  last_received: Date;
  received_articles: string[];
  saved_words: string[];
  createdAt: Date;
  hasActiveSubscription?: boolean;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  billingKey?: string;
  paymentMethod?: string;
  billingCancelled?: boolean;
  account_status?: string;
  gdg_member?: boolean;
  referralCode?: string;
  referralGeneratedAt?: Date;
  bio?: string;
  work?: string;
  school?: string;
  location?: string;
  interests?: string;
  profilePublic?: boolean;
}

const defaultUserImage = "/images/default_user.jpg"; // Using public folder

// Kakao SDK loader
const loadKakaoSdk = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject();
    if ((window as any).Kakao) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://developers.kakao.com/sdk/js/kakao.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// Survey options
const cancellationReasons = [
  "모임 시간이 저와 맞지 않았어요",
  "모임 장소가 불편했어요",
  "기대했던 만큼의 가치를 느끼지 못했어요",
  "좀 더 체계적인 학습을 원했어요",
  "혼자 공부하는 걸 더 선호해요",
  "개인 사정으로 참여가 어려워졌어요",
  "단기 목표를 달성했어요",
  "가격이 지속적으로 부담되었어요",
  "모임 분위기나 멤버 구성과 잘 맞지 않았어요",
];

const refundReasons = [
  "결제 후 마음이 바뀌었어요 (단순 변심)",
  "결제/이용 과정에서 문제가 있었어요",
  "모임 시간이 저와 맞지 않았어요",
  "모임 장소가 불편했어요",
  "기대했던 만큼의 가치를 느끼지 못했어요",
  "좀 더 체계적인 학습을 원했어요",
  "혼자 공부하는 걸 더 선호해요",
  "개인 사정으로 참여가 어려워졌어요",
  "단기 목표를 달성했어요",
  "가격이 지속적으로 부담되었어요",
  "모임 분위기나 멤버 구성과 잘 맞지 않았어요",
];

// Add new styled components for the updated cancellation flow
const CancellationOptionsDialog = styled.div`
  background: white;
  padding: 2.5rem;
  border-radius: 20px;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.05);
`;

const OptionButton = styled.button`
  width: 100%;
  padding: 1.25rem 1.5rem;
  margin: 0.75rem 0;
  border: 1px solid #e8eaed;
  border-radius: 12px;
  background: #fafbfc;
  color: #333;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  position: relative;

  &:hover {
    border-color: #2c1810;
    background: #f8f9fa;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(44, 24, 16, 0.1);
  }

  &:active {
    transform: translateY(0);
  }

  .option-title {
    display: block;
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: #1f2937;
    font-size: 1rem;
  }

  .option-description {
    display: block;
    font-size: 0.85rem;
    color: #6b7280;
    line-height: 1.5;
    font-weight: 400;
  }
`;

const RefundOptionButton = styled(OptionButton)`
  border-color: #f3f4f6;
  background: #f9fafb;

  &:hover {
    border-color: #d1d5db;
    background: #f3f4f6;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  }

  .option-title {
    color: #6b7280;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .option-description {
    color: #9ca3af;
    font-size: 0.8rem;
  }
`;

// Survey Dialog Components
const SurveyDialog = styled.div`
  background: white;
  padding: 2.5rem;
  border-radius: 20px;
  max-width: 520px;
  width: 90%;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.05);
  max-height: 80vh;
  overflow-y: auto;
`;

const SurveyQuestion = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

const SurveyOptions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
`;

const SurveyOption = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-size: 0.9rem;
  line-height: 1.4;

  &:hover {
    background-color: #f8f9fa;
  }

  input[type="checkbox"] {
    margin: 0;
    transform: scale(1.1);
  }
`;

const OtherReasonInput = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  resize: vertical;
  font-family: inherit;
  margin-top: 0.5rem;

  &:focus {
    outline: none;
    border-color: #2c1810;
    box-shadow: 0 0 0 3px rgba(44, 24, 16, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const SurveyButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 2rem;
`;

const SurveySubmitButton = styled.button`
  background-color: #2c1810;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background-color: #4a2d1d;
    transform: translateY(-1px);
  }

  &:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
    transform: none;
  }
`;

const SurveyCancelButton = styled.button`
  background-color: #f3f4f6;
  color: #6b7280;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: #e5e7eb;
    color: #374151;
  }
`;

const ProfilePageShell = styled.div`
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 3rem;

  @media (max-width: 768px) {
    padding: 1rem 1rem 2rem;
  }
`;

const ProfileTopCard = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
  gap: 1.25rem;
  align-items: stretch;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  padding: clamp(1.2rem, 4vw, 2rem);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    border-radius: 20px;
  }
`;

const IdentityBlock = styled.div`
  display: flex;
  gap: 1.2rem;
  align-items: center;

  @media (max-width: 560px) {
    flex-direction: column;
    text-align: center;
  }
`;

const ModernAvatarWrap = styled.div`
  position: relative;
  flex: 0 0 auto;
`;

const ModernAvatarUpload = styled(AvatarUpload)`
  width: 132px;
  height: 132px;
  border: 0;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);

  @media (max-width: 560px) {
    width: 118px;
    height: 118px;
  }
`;

const VerifiedBadge = styled.span`
  position: absolute;
  right: -2px;
  bottom: 8px;
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border: 4px solid #ffffff;
  border-radius: 999px;
  background: #0f172a;
  color: #ffffff;

  svg {
    width: 21px;
    height: 21px;
  }
`;

const IdentityText = styled.div`
  min-width: 0;
`;

const ProfileName = styled.h1`
  margin: 0;
  color: #111827;
  font-size: clamp(2.1rem, 6vw, 3.5rem);
  font-weight: 760;
  line-height: 1.05;
  letter-spacing: 0;
`;

const ProfileSubline = styled.p`
  margin: 0.75rem 0 0;
  color: #6b7280;
  font-size: 1rem;
  line-height: 1.5;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.9rem;

  @media (max-width: 560px) {
    justify-content: center;
  }
`;

const PillBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f8fafc;
  color: #334155;
  padding: 0.4rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 800;

  svg {
    width: 15px;
    height: 15px;
  }
`;

const HeroStatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
`;

const HeroStat = styled.div`
  border-top: 1px solid #e5e7eb;
  padding-top: 0.9rem;
`;

const HeroStatValue = styled.div`
  color: #111827;
  font-size: clamp(1.7rem, 6vw, 2.45rem);
  font-weight: 820;
  line-height: 1;
`;

const HeroStatLabel = styled.div`
  margin-top: 0.35rem;
  color: #475569;
  font-size: 0.9rem;
  font-weight: 700;
`;

const TileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const InsightTile = styled.section`
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #ffffff;
  padding: 1.1rem;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
`;

const TileHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
`;

const TileTitle = styled.h2`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: #111827;
  font-size: 1rem;
  font-weight: 800;

  svg {
    width: 19px;
    height: 19px;
  }
`;

const TextButton = styled.button`
  border: 0;
  border-radius: 999px;
  background: #f1f5f9;
  color: #0f172a;
  padding: 0.42rem 0.7rem;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
`;

const DetailList = styled.div`
  display: grid;
  gap: 0.72rem;
`;

const DetailItem = styled.div`
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
  color: #1f2937;
  font-size: 0.94rem;
  line-height: 1.45;

  svg {
    width: 21px;
    height: 21px;
    color: #475569;
  }
`;

const EditGrid = styled.div`
  display: grid;
  gap: 0.7rem;
`;

const EditInput = styled.input`
  width: 100%;
  border: 1px solid #dddddd;
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  font-family: inherit;
  font-size: 0.9rem;
  color: #222222;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;

  &:focus {
    border-color: #222222;
  }
`;

const EditTextArea = styled.textarea`
  width: 100%;
  min-height: 84px;
  border: 1px solid #dddddd;
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  font-family: inherit;
  font-size: 0.9rem;
  color: #222222;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;

  &:focus {
    border-color: #222222;
  }
`;

const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const PrimaryAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: #222222;
  color: #ffffff;
  padding: 0.7rem 1.25rem;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #444444;
  }

  &:disabled {
    background: #b0b0b0;
    cursor: not-allowed;
  }
`;

const SecondaryAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dddddd;
  border-radius: 999px;
  background: #ffffff;
  color: #222222;
  padding: 0.7rem 1.25rem;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f7f7f5;
  }
`;

const MetricLine = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  border-top: 1px solid #f1f5f9;
  padding-top: 0.72rem;
  color: #475569;
  font-size: 0.9rem;

  strong {
    color: #111827;
    font-size: 1.15rem;
  }
`;

const ProfileRouteShell = styled.main`
  width: 100%;
  max-width: ${appLayout.pageMaxWidth};
  margin: 0 auto;
  padding: 1.5rem ${appLayout.pageGutterDesktop} 3rem;

  @media (max-width: 768px) {
    padding: 1rem ${appLayout.pageGutterMobile} 2.25rem;
  }
`;

const ProfileHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: clamp(1rem, 4vw, 1.5rem);
`;

const ProfileHeading = styled.h1`
  margin: 0;
  color: #111111;
  font-size: clamp(2.45rem, 8vw, 4.1rem);
  font-weight: 760;
  line-height: 0.98;
  letter-spacing: 0;
`;

const IconCircleButton = styled.button`
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 999px;
  background: #f1f1f1;
  color: #1f1f1f;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  svg {
    width: 25px;
    height: 25px;
  }
`;

const ProfileStack = styled.div`
  display: grid;
  gap: 1rem;
`;

const ProfileHeroPanel = styled.section`
  border: 1px solid #dddddd;
  border-radius: 24px;
  background: #ffffff;
  padding: 2rem;

  @media (max-width: 640px) {
    padding: 1.25rem;
    border-radius: 20px;
  }
`;

const ProfileIdentity = styled.div`
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;

  @media (max-width: 560px) {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
`;

const ProfileAvatarFrame = styled.div`
  position: relative;
  width: fit-content;
`;

const LargeAvatarUpload = styled(AvatarUpload)`
  width: 112px;
  height: 112px;
  border: 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  flex: 0 0 auto;
`;

const ProfileVerifiedBadge = styled.span`
  position: absolute;
  right: -2px;
  bottom: 10px;
  display: inline-flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border: 4px solid #ffffff;
  border-radius: 999px;
  background: #111111;
  color: #ffffff;

  svg {
    width: 20px;
    height: 20px;
  }
`;

const AvatarEditButton = styled.button`
  position: absolute;
  right: 0;
  bottom: 6px;
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 3px solid #ffffff;
  border-radius: 999px;
  background: #222222;
  color: #ffffff;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #444444;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const AvatarDeleteButton = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
  border-radius: 999px;
  background: rgba(34, 34, 34, 0.75);
  color: #ffffff;
  cursor: pointer;

  svg {
    width: 13px;
    height: 13px;
  }
`;

const ProfileNameBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const ProfileDisplayName = styled.h2`
  margin: 0;
  color: #222222;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
`;

const ProfileNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 560px) {
    justify-content: center;
  }
`;

const NameIconButton = styled.button`
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid #dddddd;
  border-radius: 999px;
  background: #ffffff;
  color: #717171;
  cursor: pointer;
  transition: border-color 0.15s;

  &:hover {
    border-color: #222222;
    color: #222222;
  }

  svg {
    width: 15px;
    height: 15px;
  }
`;

const ProfileMetaLine = styled.p`
  margin: 0.35rem 0 0;
  color: #717171;
  font-size: 0.875rem;
  line-height: 1.4;
`;

const ProfileBadgeStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;

  @media (max-width: 560px) {
    justify-content: center;
  }
`;

const ProfileChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #dddddd;
  border-radius: 999px;
  background: #ffffff;
  color: #222222;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;

  svg {
    width: 15px;
    height: 15px;
    color: #717171;
    flex: 0 0 auto;
  }
`;

const GdgChip = styled(ProfileChip)`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: inset 0 -2px 0 #fbbc04;

  &::before {
    content: "";
    width: 15px;
    height: 15px;
    border-radius: 999px;
    flex: 0 0 auto;
    background: conic-gradient(
      #4285f4 0 25%,
      #34a853 0 50%,
      #fbbc04 0 75%,
      #ea4335 0 100%
    );
    box-shadow: inset 0 0 0 4px #ffffff;
  }
`;

const SummaryActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;

  @media (max-width: 560px) {
    justify-content: center;
  }
`;

const SummaryActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid #222222;
  border-radius: 999px;
  background: #ffffff;
  color: #222222;
  padding: 0.6rem 1.1rem;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f7f7f5;
  }

  &:disabled {
    border-color: #dddddd;
    color: #717171;
    cursor: not-allowed;
  }

  svg {
    width: 15px;
    height: 15px;
  }
`;

const StatsStrip = styled.div`
  display: flex;
  border-top: 1px solid #eeeeec;
  border-bottom: 1px solid #eeeeec;
  margin: 1rem 0;

  @media (max-width: 560px) {
    justify-content: center;
  }
`;

const StatCell = styled.div`
  padding: 0.75rem 1.25rem;
  min-width: 80px;

  & + & {
    border-left: 1px solid #dddddd;
  }

  &:first-child {
    padding-left: 0;
  }

  @media (max-width: 560px) {
    padding: 0.65rem 1rem;
    text-align: center;

    &:first-child {
      padding-left: 1rem;
    }
  }
`;

const StatValue = styled.div`
  color: #222222;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
`;

const StatLabel = styled.div`
  color: #717171;
  font-size: 0.72rem;
  margin-top: 0.2rem;
  white-space: nowrap;
`;

const BadgeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: 0.25rem;

  @media (max-width: 560px) {
    align-items: center;
  }
`;

const BadgeItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;

  svg {
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
    color: #717171;
    margin-top: 1px;
  }
`;

const BadgeItemText = styled.div``;

const BadgeItemTitle = styled.div`
  color: #222222;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
`;

const BadgeItemSub = styled.div`
  color: #717171;
  font-size: 0.78rem;
  margin-top: 0.1rem;
`;

const SubscriptionRail = styled.aside`
  display: none;
`;

const HeroStatsRail = styled.div`
  display: grid;
  gap: 0;
  border-left: 1px solid #e1e1df;
  padding-left: clamp(1rem, 3vw, 1.5rem);

  @media (max-width: 700px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-left: 0;
    border-top: 1px solid #e1e1df;
    padding-left: 0;
    padding-top: 0.85rem;
  }
`;

const HeroStatRow = styled.div`
  padding: 0.78rem 0;
  border-bottom: 1px solid #e1e1df;

  &:last-child {
    border-bottom: 0;
  }

  @media (max-width: 700px) {
    padding: 0.4rem 0.25rem;
    border-bottom: 0;
    text-align: center;
  }
`;

const HeroStatNumber = styled.div`
  color: #202020;
  font-size: clamp(1.55rem, 6vw, 2.25rem);
  font-weight: 780;
  line-height: 1;
`;

const HeroStatCaption = styled.div`
  margin-top: 0.3rem;
  color: #535353;
  font-size: 0.88rem;
  font-weight: 650;
`;

const ProfilePanel = styled.section`
  border: 1px solid #dddddd;
  border-radius: 24px;
  background: #ffffff;
  padding: 1.75rem 2rem;

  @media (max-width: 640px) {
    padding: 1.25rem;
    border-radius: 20px;
  }
`;

const ProfileSectionLabel = styled.h3`
  margin: 0 0 0.6rem;
  color: #717171;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const ProfileBioText = styled.p`
  margin: 0;
  color: #222222;
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.65;
`;

const ProfileSubsection = styled.div`
  margin-top: 1.5rem;
`;

const SubscriptionManagementPanel = styled(ProfilePanel)`
  display: grid;
  gap: 1rem;
`;

const SubscriptionDetailGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const SubscriptionDetailItem = styled.div`
  border: 1px solid #eeeeec;
  border-radius: 16px;
  background: #f7f7f5;
  padding: 0.9rem;

  span {
    display: block;
    color: #717171;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  strong {
    display: block;
    margin-top: 0.35rem;
    color: #222222;
    font-size: 0.95rem;
    font-weight: 700;
  }
`;

const SubscriptionActionNote = styled.p`
  margin: 0;
  color: #717171;
  font-size: 0.84rem;
  line-height: 1.5;
`;

const ChipCloud = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const SoftChipBox = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  border-radius: 16px;
  background: #f7f7f5;
  padding: 0.85rem;
`;

const EditRowsPanel = styled.section`
  border: 1px solid #dddddd;
  border-radius: 24px;
  background: #ffffff;
  padding: 1.75rem 2rem;

  @media (max-width: 640px) {
    padding: 1.25rem;
    border-radius: 20px;
  }
`;

const EditSectionHeading = styled.h2`
  margin: 0 0 0.25rem;
  color: #222222;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.2;
`;

const EditSectionDescription = styled.p`
  margin: 0 0 0.25rem;
  color: #717171;
  font-size: 0.875rem;
  line-height: 1.5;
`;

const ProfileEditRow = styled.button`
  width: 100%;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto 18px;
  gap: 0.75rem;
  align-items: center;
  border: 0;
  border-top: 1px solid #f0f0f0;
  background: transparent;
  padding: 0.9rem 0;
  color: #222222;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.7;
  }

  svg {
    width: 20px;
    height: 20px;
    color: #717171;
  }

  span {
    font-size: 0.9rem;
    font-weight: 500;
  }

  strong {
    min-width: 0;
    color: #717171;
    font-size: 0.875rem;
    font-weight: 400;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 520px) {
    grid-template-columns: 20px minmax(0, 1fr) minmax(0, 0.8fr) 16px;
  }
`;

const FloatingEditButton = styled.button`
  width: 100%;
  border: 1px solid #222222;
  border-radius: 999px;
  background: #ffffff;
  color: #222222;
  padding: 0.9rem 1.25rem;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f7f7f5;
  }
`;

const ProfileFormPanel = styled.section`
  border: 1px solid #dddddd;
  border-radius: 24px;
  background: #ffffff;
  padding: 1.75rem 2rem;
  display: grid;
  gap: 0.75rem;

  @media (max-width: 640px) {
    padding: 1.25rem;
    border-radius: 20px;
  }
`;

const PublicPreviewDialog = styled(ConfirmationDialog)`
  width: min(92vw, 500px);
  max-height: min(86vh, 760px);
  overflow: auto;
  border-radius: 24px;
  padding: 1.25rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
`;

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const PreviewTitle = styled.h2`
  margin: 0;
  color: #222222;
  font-size: 1rem;
  font-weight: 700;
`;

const PreviewCloseButton = styled.button`
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: #f7f7f5;
  color: #222222;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #eeeeec;
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const PublicPreviewCard = styled.div`
  border: 1px solid #dddddd;
  border-radius: 20px;
  background: #ffffff;
  padding: 1.25rem;
`;

const PreviewIdentity = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const PreviewAvatar = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 999px;
  object-fit: cover;
  background: #f7f7f5;
  flex: 0 0 auto;
`;

const PreviewName = styled.h3`
  margin: 0;
  color: #222222;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.15;
`;

const PreviewMeta = styled.p`
  margin: 0.35rem 0 0;
  color: #717171;
  font-size: 0.85rem;
`;

const PreviewBio = styled.p`
  margin: 1rem 0 0;
  color: #222222;
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.6;
`;

export default function ProfileClient() {
  const user = auth.currentUser;
  const [avatar, setAvatar] = useState(user?.photoURL || "");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [receivedArticles, setReceivedArticles] = useState<
    { id: string; title?: string; date?: Date }[]
  >([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [showPublicPreview, setShowPublicPreview] = useState(false);
  const [profileForm, setProfileForm] = useState({
    bio: "",
    work: "",
    school: "",
    location: "",
    interests: "",
  });
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCancellationOptions, setShowCancellationOptions] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [cancelInProgress, setCancelInProgress] = useState(false);
  const [stopBillingInProgress, setStopBillingInProgress] = useState(false);

  // Survey states
  const [showCancellationSurvey, setShowCancellationSurvey] = useState(false);
  const [showRefundSurvey, setShowRefundSurvey] = useState(false);
  const [cancellationSurveyReasons, setCancellationSurveyReasons] = useState<
    string[]
  >([]);
  const [refundSurveyReasons, setRefundSurveyReasons] = useState<string[]>([]);
  const [cancellationOtherReason, setCancellationOtherReason] = useState("");
  const [refundOtherReason, setRefundOtherReason] = useState("");
  const [surveyInProgress, setSurveyInProgress] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    status: "unknown",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [referralGenerating, setReferralGenerating] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        router.push("/auth");
        return;
      }

      try {
        setLoading(true);

        // Set avatar here instead of waiting for user data
        if (user.photoURL) {
          console.log("Profile - Found photoURL:", user.photoURL);

          try {
            // Just add a cache-busting parameter and use the URL directly
            const url = new URL(user.photoURL);
            url.searchParams.set("t", Date.now().toString());
            setAvatar(url.toString());
          } catch (error) {
            console.log("Profile - Invalid URL format:", user.photoURL, error);
            // Even if URL format is invalid, still use the photoURL as-is
            setAvatar(user.photoURL);
          }
        } else {
          console.log("Profile - No photoURL found for user");
          setAvatar("");
        }

        const userDocRef = doc(db, `users/${user.uid}`);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const data = userDoc.data();
          const userDataObj = {
            last_received: data.last_received?.toDate() || new Date(0),
            received_articles: data.received_articles || [],
            saved_words: data.saved_words || [],
            createdAt: data.createdAt?.toDate() || new Date(),
            hasActiveSubscription: data.hasActiveSubscription || false,
            subscriptionStartDate: data.subscriptionStartDate?.toDate(),
            subscriptionEndDate: data.subscriptionEndDate?.toDate(),
            billingKey: data.billingKey,
            paymentMethod: data.paymentMethod,
            billingCancelled: data.billingCancelled || false,
            account_status: data.account_status,
            gdg_member: data.gdg_member || false,
            referralCode: data.referralCode,
            referralGeneratedAt: data.referralGeneratedAt?.toDate
              ? data.referralGeneratedAt.toDate()
              : undefined,
            bio: data.bio || "",
            work: data.work || "",
            school: data.school || "",
            location: data.location || "",
            interests: data.interests || "",
            profilePublic: data.profilePublic !== false,
          };

          setUserData(userDataObj);
          setProfileForm({
            bio: userDataObj.bio || "",
            work: userDataObj.work || "",
            school: userDataObj.school || "",
            location: userDataObj.location || "",
            interests: userDataObj.interests || "",
          });

          // Set subscription data
          const subData: SubscriptionData = {
            status: userDataObj.hasActiveSubscription ? "active" : "canceled",
            startDate: userDataObj.subscriptionStartDate,
            cancelledDate: userDataObj.subscriptionEndDate,
            paymentMethod: userDataObj.paymentMethod || "카드",
            billingKey: userDataObj.billingKey,
            billingCancelled: userDataObj.billingCancelled || false,
          };

          // Calculate next billing date (one month from start date) only if billing is not cancelled
          if (
            subData.startDate &&
            subData.status === "active" &&
            !subData.billingCancelled
          ) {
            const nextBillingDate = new Date(subData.startDate);
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            subData.nextBillingDate = nextBillingDate;
          } else {
            subData.nextBillingDate = null;
          }

          setSubscriptionData(subData);

          // Fetch article titles for received articles - only if we have articles
          if (data.received_articles && data.received_articles.length > 0) {
            // Limit the number of articles we fetch to improve performance
            const recentArticles = data.received_articles.slice(-10); // Just get the 10 most recent articles
            await fetchArticleTitles(recentArticles);
          }
        } else {
          setError("페이지를 새로고침해주세요!");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load user data.");
      } finally {
        setLoading(false);
      }
    };

    // Optimized fetchArticleTitles to batch requests
    const fetchArticleTitles = async (articleIds: string[]) => {
      try {
        const articlesData = [];
        for (const id of articleIds) {
          const articleDoc = await getDoc(doc(db, "articles", id));
          if (articleDoc.exists()) {
            const data = articleDoc.data();
            articlesData.push({
              id: id,
              title: data.title?.english || data.title?.korean || "Untitled",
              date: data.timestamp?.toDate() || null,
            });
          } else {
            articlesData.push({ id: id });
          }
        }
        setReceivedArticles(articlesData);
      } catch (error) {
        console.error("Error fetching article titles:", error);
      }
    };

    fetchUserData();
  }, [user, router]);

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (!user) {
      setError("Please log in again to upload avatar");
      return;
    }

    if (files && files.length === 1) {
      const file = files[0];

      // Check file size (limit to 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("File too large. Please select an image under 2MB");
        e.target.value = "";
        return;
      }

      try {
        setError("");
        setSuccessMessage(null);
        setIsLoading(true);

        // Create storage reference
        const locationRef = ref(storage, `avatars/user_${user.uid}`);

        // Upload the file
        const result = await uploadBytes(locationRef, file);
        const avatarUrl = await getDownloadURL(result.ref);

        console.log("Profile - Uploaded new avatar:", avatarUrl);

        // Update the profile
        await updateProfile(user, {
          photoURL: avatarUrl,
        });

        console.log("Profile - Updated user profile with new photoURL");

        // Add cache-busting parameter and update local state
        const urlWithCacheBuster = new URL(avatarUrl);
        urlWithCacheBuster.searchParams.set("t", Date.now().toString());
        setAvatar(urlWithCacheBuster.toString());

        setSuccessMessage("Profile picture updated successfully!");

        // Clear file input
        e.target.value = "";
      } catch (error) {
        console.error("Profile - Error uploading avatar:", error);
        setError("Failed to upload image. Please try again.");
        e.target.value = "";
      } finally {
        setIsLoading(false);
      }
    }
  };

  const deleteAvatar = async () => {
    if (!user || !avatar) return;

    try {
      setError("");
      setSuccessMessage(null);
      setIsLoading(true);

      // Delete from storage
      const locationRef = ref(storage, `avatars/user_${user.uid}`);
      await deleteObject(locationRef);

      console.log("Profile - Deleted avatar from storage");

      // Update the profile to remove photoURL
      await updateProfile(user, {
        photoURL: "",
      });

      console.log("Profile - Updated user profile to remove photoURL");

      // Update local state
      setAvatar("");
      setSuccessMessage("Profile picture deleted successfully!");
    } catch (error) {
      console.error("Profile - Error deleting avatar:", error);
      if (
        error instanceof Error &&
        error.message.includes("object-not-found")
      ) {
        // If the file doesn't exist in storage, still update the profile
        try {
          await updateProfile(user, {
            photoURL: "",
          });
          setAvatar("");
          setSuccessMessage("Profile picture removed successfully!");
        } catch (updateError) {
          console.error(
            "Profile - Error updating profile after delete:",
            updateError
          );
          setError("Failed to remove profile picture. Please try again.");
        }
      } else {
        setError("Failed to delete profile picture. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("User signed out successfully");
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out. Please try again.");
    }
  };

  const navigateToArticle = (articleId: string) => {
    router.push(`/blog/${articleId}`);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const saveDisplayName = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: displayName,
      });

      // Update Firestore users collection
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        displayName: displayName,
        updatedAt: new Date(),
      });

      setIsEditingName(false);
      setSuccessMessage("유저명이 성공적으로 변경되었습니다!");
    } catch (error) {
      console.error("Error updating display name:", error);
      setError("유저명 변경에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfileDetails = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        ...profileForm,
        profilePublic: true,
        updatedAt: new Date(),
      });
      setUserData((prev) => (prev ? { ...prev, ...profileForm, profilePublic: true } : prev));
      setIsEditingDetails(false);
      setSuccessMessage("프로필 정보가 업데이트되었습니다.");
    } catch (error) {
      console.error("Error updating profile details:", error);
      setError("프로필 정보 저장에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveDisplayName();
    }
  };

  const handleGenerateReferral = async () => {
    if (!user) return;
    try {
      setReferralGenerating(true);
      const generateReferralCodeFn = httpsCallable(functions, "generateReferralCode");
      const result = await generateReferralCodeFn({});
      const code = (result.data as any)?.referralCode;
      if (code) {
        setUserData((prev) =>
          prev ? { ...prev, referralCode: code, referralGeneratedAt: new Date() } : prev
        );
        setSuccessMessage("추천 코드가 생성되었습니다.");
      } else {
        setError("추천 코드를 생성하지 못했습니다. 다시 시도해주세요.");
      }
    } catch (err) {
      console.error(err);
      setError("추천 코드 생성 중 오류가 발생했습니다.");
    } finally {
      setReferralGenerating(false);
    }
  };

  const handleShareReferral = async () => {
    if (!userData?.referralCode) return;
    const shareText = `영어 한잔 추천 코드: ${userData.referralCode}\nhttps://1cupenglish.com/payment?ref=${userData.referralCode}`;
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;

    // Try Kakao share first if key exists
    if (kakaoKey) {
      try {
        if (!kakaoReady) {
          await loadKakaoSdk();
          if (!(window as any).Kakao?.isInitialized?.()) {
            (window as any).Kakao?.init?.(kakaoKey);
          }
          setKakaoReady(true);
        }
        const Kakao = (window as any).Kakao;
        if (Kakao && Kakao.Share && Kakao.Share.sendDefault) {
          Kakao.Share.sendDefault({
            objectType: "feed",
            content: {
              title: "영어 한잔 추천 코드",
              description: `코드: ${userData.referralCode}`,
              imageUrl: "https://1cupenglish.com/images/logos/1cup_logo_new.svg",
              link: {
                mobileWebUrl: `https://1cupenglish.com/payment?ref=${userData.referralCode}`,
                webUrl: `https://1cupenglish.com/payment?ref=${userData.referralCode}`,
              },
            },
            buttons: [
              {
                title: "바로 사용하기",
                link: {
                  mobileWebUrl: `https://1cupenglish.com/payment?ref=${userData.referralCode}`,
                  webUrl: `https://1cupenglish.com/payment?ref=${userData.referralCode}`,
                },
              },
            ],
          });
          setSuccessMessage("카카오톡 공유를 시도했습니다.");
          return;
        }
      } catch (e) {
        console.error("Kakao share failed, falling back to copy", e);
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setSuccessMessage("추천 코드가 복사되었습니다. 카카오톡에 붙여넣어 공유해주세요.");
    } catch (e) {
      setError("클립보드 복사에 실패했습니다. 직접 복사하여 공유해주세요.");
    }
  };

  const handleStopNextBilling = async () => {
    // Show survey first
    setShowCancellationOptions(false);
    setShowCancellationSurvey(true);
  };

  const submitCancellationSurvey = async () => {
    if (!user) {
      setError("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    setSurveyInProgress(true);
    setError("");

    try {
      // Save survey data first
      await saveFeedback(
        "cancellation",
        cancellationSurveyReasons,
        cancellationOtherReason
      );

      // Call the stop next billing function
      const stopNextBilling = httpsCallable(functions, "stopNextBilling");
      const result = await stopNextBilling({
        reason: "User requested stop billing",
      });

      console.log("Stop billing result:", result.data);

      if (result.data && (result.data as any).success) {
        // Update local state - subscription is still active but billing is cancelled
        setSubscriptionData((prev) => ({
          ...prev,
          status: "active", // Keep as active since user retains membership
          billingCancelled: true, // Billing is cancelled but key is preserved
          nextBillingDate: null, // No next billing date since billing is cancelled
        }));

        setSuccessMessage((result.data as any).message);
        setShowCancellationSurvey(false);

        // Reset survey data
        setCancellationSurveyReasons([]);
        setCancellationOtherReason("");
      } else {
        throw new Error(
          (result.data as any)?.message || "결제 중단에 실패했습니다."
        );
      }
    } catch (error) {
      console.error("Error stopping next billing:", error);
      setError(
        error instanceof Error
          ? error.message
          : "결제 중단 중 오류가 발생했습니다. 고객 서비스에 문의해주세요."
      );
    } finally {
      setSurveyInProgress(false);
    }
  };

  const handleReactivateBilling = async () => {
    if (!user) {
      setError("사용자 정보를 찾을 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Update user data in Firestore to reactivate billing
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        billingCancelled: false, // Reactivate billing
        reactivatedAt: new Date(),
      });

      // Update local state and recalculate next billing date
      setSubscriptionData((prev) => {
        const nextBillingDate = prev.startDate
          ? (() => {
              const date = new Date(prev.startDate);
              date.setMonth(date.getMonth() + 1);
              return date;
            })()
          : null;

        return {
          ...prev,
          billingCancelled: false,
          nextBillingDate,
        };
      });

      setSuccessMessage(
        "결제가 성공적으로 재활성화되었습니다. 다음 결제일부터 정기결제가 재개됩니다."
      );
    } catch (error) {
      console.error("Error reactivating billing:", error);
      setError(
        error instanceof Error
          ? error.message
          : "결제 재활성화 중 오류가 발생했습니다. 고객 서비스에 문의해주세요."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    // Show survey first
    setShowRefundDialog(false);
    setShowRefundSurvey(true);
  };

  const submitRefundSurvey = async () => {
    if (!user || !subscriptionData.billingKey) {
      setError("구독 정보를 찾을 수 없습니다.");
      return;
    }

    setSurveyInProgress(true);
    setError("");

    try {
      // Save survey data first
      await saveFeedback("refund", refundSurveyReasons, refundOtherReason);

      // Call the cancel subscription function (original refund logic)
      const cancelSubscription = httpsCallable(functions, "cancelSubscription");
      const result = await cancelSubscription({
        userId: user.uid,
        billingKey: subscriptionData.billingKey,
      });

      console.log("Subscription cancellation result:", result.data);

      if (result.data && (result.data as any).success) {
        // Update local state
        setSubscriptionData((prev) => ({
          ...prev,
          status: "canceled",
          cancelledDate: new Date(),
        }));

        // Update user data in Firestore
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          hasActiveSubscription: false,
          subscriptionEndDate: new Date(),
        });

        setSuccessMessage("구독이 성공적으로 해지되고 환불 처리되었습니다.");
        setShowRefundSurvey(false);

        // Reset survey data
        setRefundSurveyReasons([]);
        setRefundOtherReason("");
      } else {
        throw new Error(
          (result.data as any)?.message || "구독 해지에 실패했습니다."
        );
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
      setError(
        error instanceof Error
          ? error.message
          : "구독 해지 중 오류가 발생했습니다. 고객 서비스에 문의해주세요."
      );
    } finally {
      setSurveyInProgress(false);
    }
  };

  // Survey helper functions
  const handleCancellationReasonChange = (reason: string, checked: boolean) => {
    if (checked) {
      setCancellationSurveyReasons((prev) => [...prev, reason]);
    } else {
      setCancellationSurveyReasons((prev) => prev.filter((r) => r !== reason));
    }
  };

  const handleRefundReasonChange = (reason: string, checked: boolean) => {
    if (checked) {
      setRefundSurveyReasons((prev) => [...prev, reason]);
    } else {
      setRefundSurveyReasons((prev) => prev.filter((r) => r !== reason));
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return "-";
    return format(date, "yyyy년 MM월 dd일", { locale: ko });
  };

  if (loading) {
    return <GlobalLoadingScreen />;
  }

  const profileInterests = (userData?.interests || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  const daysWithOneCup = userData?.createdAt
    ? Math.max(1, Math.ceil((Date.now() - userData.createdAt.getTime()) / 86400000))
    : "-";
  const profileBio =
    userData?.bio || "영어 한잔에서 비즈니스 영어와 좋은 대화를 꾸준히 쌓고 있습니다.";
  const membershipStatus =
    subscriptionData.status === "active"
      ? subscriptionData.billingCancelled
        ? "결제 중단 예정"
        : "이용 중"
      : "비활성";
  const isManagedMembership =
    userData?.account_status !== "admin" &&
    (userData?.gdg_member || userData?.account_status === "leader");
  const recentPaymentLabel = isManagedMembership
    ? "해당 없음"
    : formatDate(subscriptionData.startDate);
  const nextBillingLabel = isManagedMembership
    ? "해당 없음"
    : subscriptionData.status === "active" &&
        !subscriptionData.billingCancelled &&
        subscriptionData.nextBillingDate
      ? formatDate(subscriptionData.nextBillingDate)
      : subscriptionData.billingCancelled
        ? "결제 중단됨"
        : "-";
  const subscriptionActionLabel = isManagedMembership
    ? "관리 필요 없음"
    : subscriptionData.status === "active"
      ? subscriptionData.billingCancelled
        ? "결제 재활성화하기"
        : "멤버십 중지하기"
      : "멤버십 시작하기";
  const subscriptionActionNote = isManagedMembership
    ? "리더 또는 GDG 멤버십은 별도 결제 관리가 필요하지 않습니다."
    : subscriptionData.status === "active" && subscriptionData.billingCancelled
      ? "다음 결제가 중단되었습니다. 현재 구독 기간 만료 시까지 서비스를 이용할 수 있습니다."
      : subscriptionData.status === "active"
        ? "다음 결제 중단 또는 환불 요청을 진행할 수 있습니다."
        : "멤버십을 시작하면 영어 한잔 서비스를 이용할 수 있습니다.";

  const handleSubscriptionAction = () => {
    if (isManagedMembership) return;

    if (subscriptionData.status !== "active") {
      router.push("/payment");
      return;
    }

    if (subscriptionData.billingCancelled) {
      handleReactivateBilling();
      return;
    }

    setShowCancellationOptions(true);
  };

  return (
    <>
      {isLoading && <GlobalLoadingScreen />}
      <Wrapper>
        <ProfileRouteShell>
          <ProfileStack>
            {error && (
              <AlertCard type="error">
                <p>{error}</p>
              </AlertCard>
            )}
            {successMessage && (
              <AlertCard type="success">
                <p>{successMessage}</p>
              </AlertCard>
            )}
            <ProfileHeroPanel>
              <ProfileIdentity>
                <ProfileAvatarFrame>
                  <LargeAvatarUpload as="div">
                    <AvatarImg
                      src={avatar || defaultUserImage}
                      alt="Profile"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = defaultUserImage;
                      }}
                    />
                  </LargeAvatarUpload>
                  <AvatarEditButton
                    type="button"
                    aria-label="프로필 사진 변경"
                    onClick={() => document.getElementById("avatar")?.click()}
                  >
                    <CameraIcon />
                  </AvatarEditButton>
                  {avatar && (
                    <AvatarDeleteButton
                      type="button"
                      aria-label="프로필 사진 삭제"
                      onClick={deleteAvatar}
                    >
                      <TrashIcon />
                    </AvatarDeleteButton>
                  )}
                  <AvatarInput
                    onChange={onAvatarChange}
                    id="avatar"
                    type="file"
                    accept="image/*"
                  />
                </ProfileAvatarFrame>

                <ProfileNameBlock>
                  {isEditingName ? (
                    <EditGrid>
                      <NameInput
                        type="text"
                        value={displayName}
                        onChange={handleNameChange}
                        placeholder="이름 입력"
                        autoFocus
                        onKeyDown={handleKeyPress}
                      />
                      <ActionRow>
                        <PrimaryAction type="button" onClick={saveDisplayName}>
                          저장
                        </PrimaryAction>
                        <SecondaryAction
                          type="button"
                          onClick={() => {
                            setDisplayName(user?.displayName || "");
                            setIsEditingName(false);
                          }}
                        >
                          취소
                        </SecondaryAction>
                      </ActionRow>
                    </EditGrid>
                  ) : (
                    <ProfileNameRow>
                      <ProfileDisplayName>
                        {user?.displayName || "이름 없는 멤버"}
                      </ProfileDisplayName>
                      <NameIconButton
                        type="button"
                        aria-label="이름 수정"
                        onClick={() => setIsEditingName(true)}
                      >
                        <PencilSquareIcon />
                      </NameIconButton>
                    </ProfileNameRow>
                  )}
                  <ProfileMetaLine>
                    {userData?.location || "서울"}에서 영어 루틴을 쌓는 멤버
                  </ProfileMetaLine>

                  <StatsStrip>
                    <StatCell>
                      <StatValue>{daysWithOneCup}일</StatValue>
                      <StatLabel>함께한 기간</StatLabel>
                    </StatCell>
                    <StatCell>
                      <StatValue>{membershipStatus}</StatValue>
                      <StatLabel>멤버십 상태</StatLabel>
                    </StatCell>
                    <StatCell>
                      <StatValue>
                        {subscriptionData.startDate
                          ? format(subscriptionData.startDate, "MM/dd", { locale: ko })
                          : "-"}
                      </StatValue>
                      <StatLabel>최근 결제일</StatLabel>
                    </StatCell>
                  </StatsStrip>

                  {(userData?.hasActiveSubscription || userData?.gdg_member || userData?.account_status) && (
                    <BadgeList>
                      {userData?.hasActiveSubscription && (
                        <BadgeItem>
                          <CheckBadgeIcon />
                          <BadgeItemText>
                            <BadgeItemTitle>Active Member</BadgeItemTitle>
                            <BadgeItemSub>영어 한잔 구독 멤버십 이용 중</BadgeItemSub>
                          </BadgeItemText>
                        </BadgeItem>
                      )}
                      {userData?.gdg_member && (
                        <BadgeItem>
                          <SparklesIcon />
                          <BadgeItemText>
                            <BadgeItemTitle>GDG Member</BadgeItemTitle>
                            <BadgeItemSub>Google Developer Groups 멤버</BadgeItemSub>
                          </BadgeItemText>
                        </BadgeItem>
                      )}
                      {userData?.account_status && (
                        <BadgeItem>
                          <UserCircleIcon />
                          <BadgeItemText>
                            <BadgeItemTitle>{userData.account_status}</BadgeItemTitle>
                            <BadgeItemSub>영어 한잔 멤버 역할</BadgeItemSub>
                          </BadgeItemText>
                        </BadgeItem>
                      )}
                    </BadgeList>
                  )}

                  <SummaryActions>
                    <SummaryActionButton
                      type="button"
                      onClick={() => setShowPublicPreview(true)}
                    >
                      <EyeIcon />
                      공개 프로필 보기
                    </SummaryActionButton>
                    <SummaryActionButton
                      type="button"
                      onClick={userData?.referralCode ? handleShareReferral : handleGenerateReferral}
                      disabled={referralGenerating}
                    >
                      <ShareIcon />
                      {userData?.referralCode
                        ? "추천 코드 공유"
                        : referralGenerating
                          ? "생성 중"
                          : "추천 코드 생성"}
                    </SummaryActionButton>
                  </SummaryActions>
                </ProfileNameBlock>
              </ProfileIdentity>
            </ProfileHeroPanel>

            <ProfilePanel>
              <ProfileSectionLabel>My bio</ProfileSectionLabel>
              <ProfileBioText>{profileBio}</ProfileBioText>

              <ProfileSubsection>
                <ProfileSectionLabel>About me</ProfileSectionLabel>
                <ChipCloud>
                  <ProfileChip>
                    <BriefcaseIcon /> {userData?.work || "직업/소속 추가"}
                  </ProfileChip>
                  <ProfileChip>
                    <AcademicCapIcon /> {userData?.school || "학교/전공 추가"}
                  </ProfileChip>
                  <ProfileChip>
                    <MapPinIcon /> {userData?.location || "지역 추가"}
                  </ProfileChip>
                  <ProfileChip>
                    <PhoneIcon /> {user?.phoneNumber || "전화번호 없음"}
                  </ProfileChip>
                </ChipCloud>
              </ProfileSubsection>

              <ProfileSubsection>
                <ProfileSectionLabel>I&apos;m looking for</ProfileSectionLabel>
                <SoftChipBox>
                  <ProfileChip>
                    <BookOpenIcon /> 비즈니스 영어 루틴
                  </ProfileChip>
                  <ProfileChip>깊이 있는 토론</ProfileChip>
                  <ProfileChip>좋은 사람들과의 네트워크</ProfileChip>
                  <ProfileChip>스피킹 자신감</ProfileChip>
                </SoftChipBox>
              </ProfileSubsection>

              <ProfileSubsection>
                <ProfileSectionLabel>My interests</ProfileSectionLabel>
                <ChipCloud>
                  {(profileInterests.length
                    ? profileInterests
                    : ["Business news", "Speaking practice", "Networking"]
                  ).map((interest) => (
                    <ProfileChip key={interest}>
                      <SparklesIcon /> {interest}
                    </ProfileChip>
                  ))}
                </ChipCloud>
              </ProfileSubsection>
            </ProfilePanel>

            <SubscriptionManagementPanel>
              <div>
                <ProfileSectionLabel>Membership</ProfileSectionLabel>
                <EditSectionHeading>멤버십 관리</EditSectionHeading>
                <EditSectionDescription>
                  현재 멤버십 상태와 다음 결제 일정을 확인하고 결제를 관리합니다.
                </EditSectionDescription>
              </div>

              <SubscriptionDetailGrid>
                <SubscriptionDetailItem>
                  <span>상태</span>
                  <strong>{membershipStatus}</strong>
                </SubscriptionDetailItem>
                <SubscriptionDetailItem>
                  <span>최근 결제일</span>
                  <strong>{recentPaymentLabel}</strong>
                </SubscriptionDetailItem>
                <SubscriptionDetailItem>
                  <span>다음 결제일</span>
                  <strong>{nextBillingLabel}</strong>
                </SubscriptionDetailItem>
                <SubscriptionDetailItem>
                  <span>결제 수단</span>
                  <strong>
                    {isManagedMembership
                      ? "해당 없음"
                      : subscriptionData.paymentMethod || "카드"}
                  </strong>
                </SubscriptionDetailItem>
              </SubscriptionDetailGrid>

              <SubscriptionActionNote>
                {subscriptionActionNote}
              </SubscriptionActionNote>

              {!isManagedMembership && (
                <ActionRow>
                  {subscriptionData.status === "active" &&
                  !subscriptionData.billingCancelled ? (
                    <SecondaryAction
                      type="button"
                      onClick={() => setShowCancellationOptions(true)}
                    >
                      멤버십 중지하기
                    </SecondaryAction>
                  ) : (
                    <PrimaryAction
                      type="button"
                      onClick={handleSubscriptionAction}
                      disabled={isLoading}
                    >
                      {subscriptionActionLabel}
                    </PrimaryAction>
                  )}
                </ActionRow>
              )}
            </SubscriptionManagementPanel>

            {isEditingDetails && (
              <ProfileFormPanel>
                <EditSectionHeading>프로필 편집</EditSectionHeading>
                <EditSectionDescription>
                  공개 프로필에 보여줄 소개와 기본 정보를 정리해 주세요.
                </EditSectionDescription>
                <EditTextArea
                  value={profileForm.bio}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  placeholder="짧은 자기소개"
                />
                <EditInput
                  value={profileForm.work}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, work: e.target.value }))
                  }
                  placeholder="직업/소속"
                />
                <EditInput
                  value={profileForm.school}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, school: e.target.value }))
                  }
                  placeholder="학교/전공"
                />
                <EditInput
                  value={profileForm.location}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, location: e.target.value }))
                  }
                  placeholder="지역"
                />
                <EditInput
                  value={profileForm.interests}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, interests: e.target.value }))
                  }
                  placeholder="관심사, 쉼표로 구분"
                />
                <ActionRow>
                  <PrimaryAction type="button" onClick={saveProfileDetails}>
                    저장
                  </PrimaryAction>
                  <SecondaryAction
                    type="button"
                    onClick={() => {
                      setProfileForm({
                        bio: userData?.bio || "",
                        work: userData?.work || "",
                        school: userData?.school || "",
                        location: userData?.location || "",
                        interests: userData?.interests || "",
                      });
                      setIsEditingDetails(false);
                    }}
                  >
                    취소
                  </SecondaryAction>
                </ActionRow>
              </ProfileFormPanel>
            )}

            <EditRowsPanel>
              <EditSectionHeading>About you</EditSectionHeading>
              <EditSectionDescription>
                프로필, 멤버십, 학습 기록을 한 곳에서 관리합니다.
              </EditSectionDescription>
              <ProfileEditRow type="button" onClick={() => setIsEditingDetails(true)}>
                <BriefcaseIcon />
                <span>Work</span>
                <strong>{userData?.work || "Add"}</strong>
                <ChevronRightIcon />
              </ProfileEditRow>
              <ProfileEditRow type="button" onClick={() => setIsEditingDetails(true)}>
                <AcademicCapIcon />
                <span>Education</span>
                <strong>{userData?.school || "Add"}</strong>
                <ChevronRightIcon />
              </ProfileEditRow>
              <ProfileEditRow type="button" onClick={() => setIsEditingDetails(true)}>
                <MapPinIcon />
                <span>Location</span>
                <strong>{userData?.location || "Add"}</strong>
                <ChevronRightIcon />
              </ProfileEditRow>
              <ProfileEditRow type="button" onClick={handleSubscriptionAction}>
                <CreditCardIcon />
                <span>Subscription</span>
                <strong>{subscriptionActionLabel}</strong>
                <ChevronRightIcon />
              </ProfileEditRow>
              <ProfileEditRow type="button" onClick={handleLogout}>
                <UserCircleIcon />
                <span>Account</span>
                <strong>로그아웃</strong>
                <ChevronRightIcon />
              </ProfileEditRow>
            </EditRowsPanel>

            <FloatingEditButton
              type="button"
              onClick={() => setIsEditingDetails((value) => !value)}
            >
              {isEditingDetails ? "편집 닫기" : "Edit profile"}
            </FloatingEditButton>
          </ProfileStack>
        </ProfileRouteShell>

        {showPublicPreview && (
          <ConfirmationOverlay onClick={() => setShowPublicPreview(false)}>
            <PublicPreviewDialog onClick={(event) => event.stopPropagation()}>
              <PreviewHeader>
                <PreviewTitle>공개 프로필 미리보기</PreviewTitle>
                <PreviewCloseButton
                  type="button"
                  aria-label="미리보기 닫기"
                  onClick={() => setShowPublicPreview(false)}
                >
                  <XMarkIcon />
                </PreviewCloseButton>
              </PreviewHeader>
              <PublicPreviewCard>
                <PreviewIdentity>
                  <PreviewAvatar
                    src={avatar || defaultUserImage}
                    alt="Public profile preview"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = defaultUserImage;
                    }}
                  />
                  <div>
                    <PreviewName>{user?.displayName || "이름 없는 멤버"}</PreviewName>
                    <PreviewMeta>
                      {userData?.location || "서울"}에서 활동 중
                    </PreviewMeta>
                    <ProfileBadgeStrip>
                      {userData?.gdg_member && <GdgChip>GDG member</GdgChip>}
                      {userData?.account_status && (
                        <ProfileChip>
                          <UserCircleIcon /> {userData.account_status}
                        </ProfileChip>
                      )}
                    </ProfileBadgeStrip>
                  </div>
                </PreviewIdentity>
                <PreviewBio>{profileBio}</PreviewBio>
                <ProfileSubsection>
                  <ProfileSectionLabel>About me</ProfileSectionLabel>
                  <ChipCloud>
                    {userData?.work && (
                      <ProfileChip>
                        <BriefcaseIcon /> {userData.work}
                      </ProfileChip>
                    )}
                    {userData?.school && (
                      <ProfileChip>
                        <AcademicCapIcon /> {userData.school}
                      </ProfileChip>
                    )}
                    {userData?.location && (
                      <ProfileChip>
                        <MapPinIcon /> {userData.location}
                      </ProfileChip>
                    )}
                  </ChipCloud>
                </ProfileSubsection>
                <ProfileSubsection>
                  <ProfileSectionLabel>My interests</ProfileSectionLabel>
                  <ChipCloud>
                    {(profileInterests.length
                      ? profileInterests
                      : ["Business news", "Speaking practice", "Networking"]
                    ).map((interest) => (
                      <ProfileChip key={interest}>
                        <SparklesIcon /> {interest}
                      </ProfileChip>
                    ))}
                  </ChipCloud>
                </ProfileSubsection>
              </PublicPreviewCard>
            </PublicPreviewDialog>
          </ConfirmationOverlay>
        )}

        {false && <div style={{ display: "none" }}>
        <MainSectionsWrapper>
          {/* User Information Section */}
          <UserInfoSection>
            <SectionTitle>기본 정보</SectionTitle>
            <SectionContent>
              <UserInfoContent>
                <UserDetails>
                  <InfoRow>
                    <InfoLabel>유저명</InfoLabel>
                    {isEditingName ? (
                      <NameEditContainer>
                        <NameInput
                          type="text"
                          value={displayName}
                          onChange={handleNameChange}
                          placeholder="이름 입력"
                          autoFocus
                          onKeyPress={handleKeyPress}
                        />
                        <CheckmarkIcon onClick={saveDisplayName}>
                          ✓
                        </CheckmarkIcon>
                      </NameEditContainer>
                    ) : (
                      <InfoValueWithIcon onClick={() => setIsEditingName(true)}>
                        <span className="username-text">
                          {user?.displayName
                            ? user.displayName
                            : "유저명을 정해주세요"}
                        </span>
                        <PencilIcon
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </PencilIcon>
                      </InfoValueWithIcon>
                    )}
                  </InfoRow>

                  <InfoRow>
                    <InfoLabel>휴대폰</InfoLabel>
                    <InfoValue>{user?.phoneNumber || "번호 없음"}</InfoValue>
                  </InfoRow>

                  <InfoRow>
                    <InfoLabel>가입일</InfoLabel>
                    <InfoValue>
                      {userData?.createdAt
                        ? formatDate(userData.createdAt)
                        : "-"}
                    </InfoValue>
                  </InfoRow>
                </UserDetails>

                <UserAvatarSection>
                  <AvatarUpload htmlFor="avatar">
                    {avatar ? (
                      <AvatarImg
                        src={avatar}
                        alt="Profile"
                        onError={(e) => {
                          // If image fails to load, fall back to default
                          const target = e.target as HTMLImageElement;
                          target.onerror = null; // Prevent infinite error loop
                          target.src = defaultUserImage;
                          console.log(
                            "Profile - Image failed to load, using default"
                          );
                          // Don't update avatar state - keep the URL even if it doesn't load
                        }}
                      />
                    ) : (
                      <img
                        src={defaultUserImage}
                        alt="Default Profile"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </AvatarUpload>
                  <AvatarActions>
                    <AvatarActionButton
                      onClick={() => document.getElementById("avatar")?.click()}
                    >
                      변경
                    </AvatarActionButton>
                    {avatar && (
                      <AvatarActionButton onClick={deleteAvatar}>
                        삭제
                      </AvatarActionButton>
                    )}
                  </AvatarActions>
                  <AvatarInput
                    onChange={onAvatarChange}
                    id="avatar"
                    type="file"
                    accept="image/*"
                  />
                </UserAvatarSection>
              </UserInfoContent>
            </SectionContent>
          </UserInfoSection>

          {/* Subscription Information Section */}
          <SubscriptionInfo>
            <SectionTitle>
              구독 정보
              {userData?.account_status !== "admin" &&
                userData?.account_status === "leader" && (
                  <StatusBadge active>상태: 영어 한잔 리더</StatusBadge>
                )}
              {userData?.account_status !== "admin" && userData?.gdg_member && (
                <StatusBadge active>상태: GDG 멤버</StatusBadge>
              )}
              {((!userData?.gdg_member &&
                userData?.account_status !== "leader") ||
                userData?.account_status === "admin") && (
                <StatusBadge active={subscriptionData.status === "active"}>
                  {subscriptionData.status === "active"
                    ? subscriptionData.billingCancelled
                      ? "상태: 이용 중 (결제 중단됨)"
                      : "상태: 이용 중"
                    : "상태: 비활성화"}
                </StatusBadge>
              )}
            </SectionTitle>

            <SectionContent>
              <InfoRow>
                <InfoLabel>최근 결제일</InfoLabel>
                <InfoValue>
                  {userData?.account_status !== "admin" &&
                  (userData?.gdg_member ||
                    userData?.account_status === "leader")
                    ? "해당 없음"
                    : formatDate(subscriptionData.startDate)}
                </InfoValue>
              </InfoRow>

              <InfoRow>
                <InfoLabel>다음 결제일</InfoLabel>
                <InfoValue>
                  {userData?.account_status !== "admin" &&
                  (userData?.gdg_member ||
                    userData?.account_status === "leader")
                    ? "해당 없음"
                    : subscriptionData.status === "active" &&
                      !subscriptionData.billingCancelled &&
                      subscriptionData.nextBillingDate
                    ? formatDate(subscriptionData.nextBillingDate)
                    : subscriptionData.billingCancelled
                    ? "결제 중단됨"
                    : "-"}
                </InfoValue>
              </InfoRow>

              <div
                style={{
                  marginTop: "1.5rem",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                {!(
                  userData?.account_status !== "admin" &&
                  (userData?.gdg_member ||
                    userData?.account_status === "leader")
                ) &&
                  subscriptionData.status === "active" &&
                  !subscriptionData.billingCancelled && (
                    <CancelLinkButton
                      onClick={() => setShowCancellationOptions(true)}
                    >
                      멤버십 중지하기
                    </CancelLinkButton>
                  )}

                {subscriptionData.status === "active" &&
                  subscriptionData.billingCancelled && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.9rem",
                          color: "#666",
                          textAlign: "right",
                        }}
                      >
                        다음 결제가 중단되었습니다. 구독 기간 만료 시까지
                        서비스를 이용하실 수 있습니다.
                      </div>
                      <SubscribeAgainButton
                        onClick={() => handleReactivateBilling()}
                      >
                        결제 재활성화하기
                      </SubscribeAgainButton>
                    </div>
                  )}

                {subscriptionData.status === "canceled" && (
                  <SubscribeAgainButton onClick={() => router.push("/payment")}>
                    멤버십 시작하기
                  </SubscribeAgainButton>
                )}
              </div>
            </SectionContent>
          </SubscriptionInfo>
        </MainSectionsWrapper>

        {/* Referral Code Section */}
        <TransparentCard>
          <SectionTitle>추천 코드</SectionTitle>
          <SectionContent>
            {userData?.referralCode ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                  내 추천 코드: {userData.referralCode}
                </div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>
                  친구가 결제 시 혜택이 적용될 수 있습니다.
                </div>
                <Button onClick={handleShareReferral}>카카오톡으로 공유하기</Button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ color: "#666", fontSize: "0.9rem" }}>
                  아직 추천 코드가 없습니다. 생성하면 친구에게 추천 코드를 공유할 수 있어요.
                </div>
                <Button onClick={handleGenerateReferral} disabled={referralGenerating}>
                  {referralGenerating ? "생성 중..." : "추천 코드 생성하기"}
                </Button>
              </div>
            )}
          </SectionContent>
        </TransparentCard>

        {/* Vocabulary Section */}
        {userData?.saved_words && userData.saved_words.length > 0 && (
          <TransparentCard>
            <SectionTitle>저장한 단어</SectionTitle>
            <SectionContent>
              <WordsList>
                {userData.saved_words.map((word, index) => (
                  <WordItem key={index}>
                    <span>{word}</span>
                  </WordItem>
                ))}
              </WordsList>
            </SectionContent>
          </TransparentCard>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <LogoutButton onClick={handleLogout}>로그아웃</LogoutButton>
        </div>
        </div>}

        {/* Cancellation Options Dialog */}
        {showCancellationOptions && (
          <ConfirmationOverlay>
            <CancellationOptionsDialog>
              <SectionTitle
                style={{
                  fontSize: "1.3rem",
                  marginBottom: "0.5rem",
                  color: "#1f2937",
                }}
              >
                멤버십 중지 옵션
              </SectionTitle>
              <p
                style={{
                  marginBottom: "1.75rem",
                  color: "#6b7280",
                  lineHeight: "1.6",
                  fontSize: "0.95rem",
                  textAlign: "center",
                }}
              >
                어떤 방식으로 멤버십을 중지하시겠습니까?
              </p>

              <OptionButton
                onClick={handleStopNextBilling}
                disabled={stopBillingInProgress}
              >
                <span className="option-title">다음 결제 중단하기 (권장)</span>
                <span className="option-description">
                  현재 구독 기간까지는 서비스를 계속 이용하고, 다음 결제부터
                  중단됩니다. 환불은 없지만 남은 기간 동안 서비스를 모두 사용할
                  수 있습니다.
                </span>
              </OptionButton>

              <div
                style={{
                  margin: "1.75rem 0 0.75rem 0",
                  padding: "1.25rem 0 0 0",
                  borderTop: "1px solid #f3f4f6",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    marginBottom: "0.75rem",
                    fontSize: "0.8rem",
                    color: "#9ca3af",
                    fontWeight: "500",
                  }}
                >
                  또는
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#6b7280",
                    cursor: "pointer",
                    textDecoration: "underline",
                    lineHeight: "1.4",
                    transition: "color 0.2s ease",
                  }}
                  onClick={() => {
                    setShowCancellationOptions(false);
                    setShowRefundDialog(true);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#374151";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#6b7280";
                  }}
                >
                  결제 취소하고 환불받기
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#9ca3af",
                      marginTop: "0.25rem",
                      textDecoration: "none",
                    }}
                  >
                    (즉시 서비스 중단, 이용 기간에 따라 환불)
                  </div>
                </div>
              </div>

              <ButtonGroup style={{ marginTop: "1.5rem" }}>
                <CancelButton
                  onClick={() => setShowCancellationOptions(false)}
                  disabled={stopBillingInProgress}
                  style={{
                    background: "#f3f4f6",
                    color: "#6b7280",
                    border: "none",
                    borderRadius: "10px",
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.95rem",
                    fontWeight: "500",
                  }}
                >
                  취소
                </CancelButton>
              </ButtonGroup>
            </CancellationOptionsDialog>
          </ConfirmationOverlay>
        )}

        {/* Refund Confirmation Dialog */}
        {showRefundDialog && (
          <ConfirmationOverlay>
            <ConfirmationDialog>
              <SectionTitle>환불 처리</SectionTitle>
              <p style={{ marginBottom: "1rem" }}>
                정말로 구독을 해지하고 환불받으시겠습니까?
              </p>
              <p style={{ marginBottom: "1rem", color: "#e74c3c" }}>
                해지 시 즉시 서비스 이용이 중단되며, 이용 기간에 따라 환불
                처리됩니다.
              </p>
              <ButtonGroup>
                <CancelButton
                  onClick={() => {
                    setShowRefundDialog(false);
                    setShowCancellationOptions(true);
                  }}
                  disabled={cancelInProgress}
                >
                  뒤로가기
                </CancelButton>
                <DangerButton
                  onClick={handleCancelSubscription}
                  disabled={cancelInProgress}
                >
                  {cancelInProgress ? "처리 중..." : "환불 처리하기"}
                </DangerButton>
              </ButtonGroup>
            </ConfirmationDialog>
          </ConfirmationOverlay>
        )}

        {/* Cancellation Survey Dialog */}
        {showCancellationSurvey && (
          <ConfirmationOverlay>
            <SurveyDialog>
              <SurveyQuestion>
                서비스를 해지하신 이유가 무엇인가요? (해당되는 항목을 모두
                선택해 주세요.)
              </SurveyQuestion>

              <SurveyOptions>
                {cancellationReasons.map((reason, index) => (
                  <SurveyOption key={index}>
                    <input
                      type="checkbox"
                      checked={cancellationSurveyReasons.includes(reason)}
                      onChange={(e) =>
                        handleCancellationReasonChange(reason, e.target.checked)
                      }
                    />
                    <span>{reason}</span>
                  </SurveyOption>
                ))}

                <SurveyOption>
                  <input
                    type="checkbox"
                    checked={cancellationOtherReason !== ""}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setCancellationOtherReason("");
                      }
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span>기타 (자유롭게 작성해 주세요):</span>
                    <OtherReasonInput
                      value={cancellationOtherReason}
                      onChange={(e) =>
                        setCancellationOtherReason(e.target.value)
                      }
                      placeholder="기타 사유를 입력해주세요..."
                    />
                  </div>
                </SurveyOption>
              </SurveyOptions>

              <SurveyButtonGroup>
                <SurveyCancelButton
                  onClick={() => {
                    setShowCancellationSurvey(false);
                    setShowCancellationOptions(true);
                    setCancellationSurveyReasons([]);
                    setCancellationOtherReason("");
                  }}
                  disabled={surveyInProgress}
                >
                  뒤로가기
                </SurveyCancelButton>
                <SurveySubmitButton
                  onClick={submitCancellationSurvey}
                  disabled={
                    surveyInProgress ||
                    (cancellationSurveyReasons.length === 0 &&
                      cancellationOtherReason.trim() === "")
                  }
                >
                  {surveyInProgress ? "처리 중..." : "다음 결제 중단하기"}
                </SurveySubmitButton>
              </SurveyButtonGroup>
            </SurveyDialog>
          </ConfirmationOverlay>
        )}

        {/* Refund Survey Dialog */}
        {showRefundSurvey && (
          <ConfirmationOverlay>
            <SurveyDialog>
              <SurveyQuestion>
                환불을 요청하신 이유가 무엇인가요? (해당되는 항목을 모두 선택해
                주세요.)
              </SurveyQuestion>

              <SurveyOptions>
                {refundReasons.map((reason, index) => (
                  <SurveyOption key={index}>
                    <input
                      type="checkbox"
                      checked={refundSurveyReasons.includes(reason)}
                      onChange={(e) =>
                        handleRefundReasonChange(reason, e.target.checked)
                      }
                    />
                    <span>{reason}</span>
                  </SurveyOption>
                ))}

                <SurveyOption>
                  <input
                    type="checkbox"
                    checked={refundOtherReason !== ""}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setRefundOtherReason("");
                      }
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span>기타 (자유롭게 작성해 주세요):</span>
                    <OtherReasonInput
                      value={refundOtherReason}
                      onChange={(e) => setRefundOtherReason(e.target.value)}
                      placeholder="기타 사유를 입력해주세요..."
                    />
                  </div>
                </SurveyOption>
              </SurveyOptions>

              <SurveyButtonGroup>
                <SurveyCancelButton
                  onClick={() => {
                    setShowRefundSurvey(false);
                    setShowRefundDialog(true);
                    setRefundSurveyReasons([]);
                    setRefundOtherReason("");
                  }}
                  disabled={surveyInProgress}
                >
                  뒤로가기
                </SurveyCancelButton>
                <SurveySubmitButton
                  onClick={submitRefundSurvey}
                  disabled={
                    surveyInProgress ||
                    (refundSurveyReasons.length === 0 &&
                      refundOtherReason.trim() === "")
                  }
                >
                  {surveyInProgress ? "처리 중..." : "환불 처리하기"}
                </SurveySubmitButton>
              </SurveyButtonGroup>
            </SurveyDialog>
          </ConfirmationOverlay>
        )}
      </Wrapper>
    </>
  );
}
