"use client";

import "./profile.css";
import { supabase, invokeFunction } from "../lib/supabase/client";
import { useAuth } from "../lib/contexts/auth_context";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";
import { useI18n } from "../lib/i18n/I18nProvider";
import { saveFeedback } from "../lib/services/feedback_service";
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
  GlobeAltIcon,
  MapPinIcon,
  PencilSquareIcon,
  PhoneIcon,
  ShareIcon,
  SparklesIcon,
  TrashIcon,
  UserCircleIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

// Transparent bordered card
const transparentCardClass =
  "mb-5 w-full rounded-[20px] border border-[#ddd] bg-transparent p-5";

// Avatar upload frame (sizes are added per usage)
const avatarUploadClass =
  "relative flex cursor-pointer items-center justify-center overflow-hidden rounded-full bg-black after:absolute after:bottom-0 after:left-0 after:right-0 after:bg-[rgba(0,0,0,0.5)] after:py-1 after:text-center after:text-[12px] after:text-white after:content-none hover:after:content-['변경'] [&_svg]:w-[50px]";

function SectionTitle({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`mb-5 flex w-full items-center justify-between border-b border-[#ddd] pb-[15px] text-[18px] font-semibold text-[#333] ${className}`}
      {...rest}
    >
      {children}
    </h3>
  );
}

function SectionContent({ children, ...rest }: DivProps) {
  return (
    <div className="w-full pt-2.5" {...rest}>
      {children}
    </div>
  );
}

function InfoRow({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex items-center text-[16px]">{children}</div>;
}

function InfoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 inline-block w-20 text-left text-[0.9rem] text-[#666]">
      {children}
    </span>
  );
}

function InfoValue({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 text-[0.9rem] font-medium">{children}</span>;
}

function AvatarImg(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  return <img className="h-full w-full object-cover" {...props} />;
}

// Subscription styles
function StatusBadge({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`ml-2.5 inline-block rounded-[20px] px-4 py-2 text-[1rem] font-semibold text-white ${
        active ? "bg-[#00a000]" : "bg-[#808080]"
      }`}
    >
      {children}
    </span>
  );
}

const buttonSharedClass =
  "cursor-pointer rounded-[20px] border-none px-6 py-3.5 text-[1rem] font-semibold text-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-200 ease-[ease] hover:-translate-y-[2px] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)] disabled:cursor-not-allowed disabled:translate-none disabled:shadow-none disabled:bg-[#a0b0e0]";

function Button({ className = "", ...rest }: BtnProps) {
  return (
    <button
      className={`${buttonSharedClass} bg-primary hover:bg-[#3a66e5] ${className}`}
      {...rest}
    />
  );
}

function DangerButton({ className = "", ...rest }: BtnProps) {
  return (
    <button
      className={`${buttonSharedClass} bg-[#e74c3c] hover:bg-[#c0392b] ${className}`}
      {...rest}
    />
  );
}

function CancelButton({ className = "", ...rest }: BtnProps) {
  return (
    <button
      className={`${buttonSharedClass} bg-[#757575] hover:bg-[#616161] ${className}`}
      {...rest}
    />
  );
}

function SubscribeAgainButton({ className = "", ...rest }: BtnProps) {
  return (
    <button
      className={`${buttonSharedClass} w-full bg-primary hover:bg-[#4a2d1d] ${className}`}
      {...rest}
    />
  );
}

function ConfirmationOverlay({ children, ...rest }: DivProps) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,0.5)]"
      {...rest}
    >
      {children}
    </div>
  );
}

function ButtonGroup({ children, ...rest }: DivProps) {
  return (
    <div className="mt-6 flex justify-end gap-4" {...rest}>
      {children}
    </div>
  );
}

const alertDismissClass =
  "shrink-0 cursor-pointer border-0 bg-transparent p-0 text-inherit opacity-55 hover:opacity-100 [&_svg]:h-[18px] [&_svg]:w-[18px]";

/* The subscription controls sit in the 4th of 5 sections, so an alert in normal
   flow at the top of the shell lands off-screen for the person who triggered it.
   Pin the alerts to the viewport instead, above the confirmation overlay (z-index 1000)
   so failures raised while a dialog is still open stay readable. */
const alertLayerClass =
  "pointer-events-none fixed left-0 right-0 top-[86px] z-[1100] flex flex-col items-center gap-2 px-5 max-[768px]:top-20 max-[768px]:px-4";

const alertCardClass =
  "pointer-events-auto flex w-full max-w-[560px] items-start gap-3 rounded-[14px] border-2 border-[#050505] px-4 py-[0.85rem] shadow-[3px_3px_0_rgba(5,5,5,0.9)] animate-[profile-alert-slide-in_200ms_ease-out]";

const alertTextClass =
  "m-0 flex-1 text-left text-[0.9rem] font-semibold leading-[1.5]";

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
  nationality?: string;
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

// Survey Dialog Components
function SurveyDialog({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-[80vh] w-[90%] max-w-[520px] overflow-y-auto rounded-[20px] border border-[rgba(0,0,0,0.05)] bg-white p-10 shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
      {children}
    </div>
  );
}

function SurveyQuestion({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-6 text-[1.1rem] font-semibold leading-[1.5] text-[#1f2937]">
      {children}
    </h3>
  );
}

function SurveyOptions({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-3">{children}</div>;
}

function SurveyOption({ children }: { children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-3 text-[0.9rem] leading-[1.4] transition-[background-color] duration-200 ease-[ease] hover:bg-gray-light [&_input]:m-0 [&_input]:scale-[1.1]">
      {children}
    </label>
  );
}

function OtherReasonInput(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      className="mt-2 min-h-20 w-full resize-y rounded-lg border border-[#d1d5db] p-3 text-[0.9rem] placeholder:text-[#9ca3af] focus:border-primary focus:shadow-[0_0_0_3px_rgba(44,24,16,0.1)] focus:outline-none"
      {...props}
    />
  );
}

function SurveyButtonGroup({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 flex justify-end gap-3">{children}</div>;
}

function SurveySubmitButton(props: BtnProps) {
  return (
    <button
      className="cursor-pointer rounded-lg border-none bg-primary px-6 py-3 text-[0.9rem] font-medium text-white transition-all duration-200 ease-[ease] hover:enabled:-translate-y-px hover:enabled:bg-[#4a2d1d] disabled:cursor-not-allowed disabled:translate-none disabled:bg-[#9ca3af]"
      {...props}
    />
  );
}

function SurveyCancelButton(props: BtnProps) {
  return (
    <button
      className="cursor-pointer rounded-lg border-none bg-[#f3f4f6] px-6 py-3 text-[0.9rem] font-medium text-[#6b7280] transition-all duration-200 ease-[ease] hover:bg-[#e5e7eb] hover:text-[#374151]"
      {...props}
    />
  );
}

function ProfileChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[0.35rem] whitespace-nowrap rounded-full border border-[#ddd] bg-white px-3 py-[0.4rem] text-[0.85rem] font-medium leading-none text-[#222222] [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:flex-none [&_svg]:text-[#717171]">
      {children}
    </span>
  );
}

function ProfileSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mx-0 mb-[0.6rem] mt-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#717171]">
      {children}
    </h3>
  );
}

function ProfileSubsection({ children }: { children: React.ReactNode }) {
  return <div className="mt-6">{children}</div>;
}

function ChipCloud({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function AvatarActionButton({ children, ...rest }: DivProps) {
  return (
    <div
      className="cursor-pointer text-[12px] text-[#777] transition-[color] duration-200 ease-[ease] hover:text-primary hover:underline"
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Neo-brutalist private profile layout                                */
/* ------------------------------------------------------------------ */

const nbCardClass =
  "rounded-[14px] border-2 border-[#050505] bg-white px-[1.35rem] py-5 shadow-[3px_3px_0_rgba(5,5,5,0.9)] max-[600px]:p-[1.1rem]";

function NbManageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mx-0 mb-[0.6rem] mt-0 text-[1rem] font-[900] tracking-[-0.01em] text-[#050505]">
      {children}
    </h2>
  );
}

function NbManageSub({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-0 mb-[1.1rem] mt-0 text-[0.88rem] leading-[1.5] text-[rgba(5,5,5,0.6)]">
      {children}
    </p>
  );
}

const nbManageRowClass =
  "grid w-full cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto_18px] items-center gap-[0.7rem] border-0 border-t-[1.5px] border-t-[rgba(5,5,5,0.12)] bg-transparent px-0 py-[0.7rem] text-left text-[#050505] transition-opacity duration-[120ms] ease-[ease] first-of-type:border-t-0 hover:opacity-65 [&>svg:first-child]:h-[18px] [&>svg:first-child]:w-[18px] [&>svg:first-child]:text-[#050505] [&>svg:last-child]:h-[18px] [&>svg:last-child]:w-[18px] [&>svg:last-child]:text-[rgba(5,5,5,0.45)] [&_.nb-row-label]:text-[0.92rem] [&_.nb-row-label]:font-bold [&_.nb-row-value]:min-w-0 [&_.nb-row-value]:overflow-hidden [&_.nb-row-value]:text-ellipsis [&_.nb-row-value]:whitespace-nowrap [&_.nb-row-value]:text-right [&_.nb-row-value]:text-[0.85rem] [&_.nb-row-value]:font-semibold [&_.nb-row-value]:text-[rgba(5,5,5,0.55)]";

function NbManageRow({
  as,
  children,
  ...rest
}: BtnProps & { as?: "div" }) {
  if (as === "div") {
    return <div className={nbManageRowClass}>{children}</div>;
  }
  return (
    <button className={nbManageRowClass} {...rest}>
      {children}
    </button>
  );
}

function NbStatusPill({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-[1.5px] border-[#050505] px-[0.6rem] py-1 text-[0.72rem] font-extrabold text-[#050505] ${
        active ? "bg-[#f47a4a]" : "bg-white"
      }`}
    >
      {children}
    </span>
  );
}

function NbIdentityRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[0.6rem] py-[0.55rem] text-[0.9rem] text-[#050505] [&+&]:border-t [&+&]:border-dashed [&+&]:border-t-[rgba(5,5,5,0.12)]">
      {children}
    </div>
  );
}

function NbPillButton(props: BtnProps) {
  return (
    <button
      className="inline-flex cursor-pointer items-center gap-[0.4rem] rounded-full border-2 border-[#050505] bg-white px-[0.9rem] py-[0.46rem] text-[0.8rem] font-extrabold text-[#050505] shadow-[2px_2px_0_rgba(5,5,5,0.9)] transition-transform duration-[120ms] ease-[ease] hover:enabled:[transform:translate(-1px,-1px)] disabled:cursor-not-allowed disabled:opacity-55 [&_svg]:h-[14px] [&_svg]:w-[14px]"
      {...props}
    />
  );
}

const nbInputClass =
  "box-border w-full rounded-[10px] border-2 border-[#050505] px-[0.85rem] py-[0.7rem] text-[0.9rem] text-[#050505] outline-none focus:shadow-[2px_2px_0_rgba(5,5,5,0.9)]";

function NbInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={nbInputClass} {...props} />;
}

function NbSaveButton(props: BtnProps) {
  return (
    <button
      className="cursor-pointer rounded-full border-2 border-[#050505] bg-[#050505] px-[1.2rem] py-[0.6rem] text-[0.85rem] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-55"
      {...props}
    />
  );
}

function NbCancelButton(props: BtnProps) {
  return (
    <button
      className="cursor-pointer rounded-full border-2 border-[#050505] bg-white px-[1.2rem] py-[0.6rem] text-[0.85rem] font-extrabold text-[#050505]"
      {...props}
    />
  );
}

export default function ProfileClient() {
  const { locale, t } = useI18n();
  const { currentUser: user, isLoading: authLoading } = useAuth();
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
    nationality: "",
    interests: "",
    profile_public: true,
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
  const [showAccountDeletionDialog, setShowAccountDeletionDialog] = useState(false);
  const [accountDeletionConfirmation, setAccountDeletionConfirmation] = useState("");
  const [accountDeletionInProgress, setAccountDeletionInProgress] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      // AuthProvider starts with currentUser = null and fills it in after reading the
      // session, so on a cold load (a direct URL, a refresh, or the OAuth callback's
      // server redirect) this effect runs before the session is known. Redirecting on
      // that first pass bounced signed-in people straight back to /auth.
      if (authLoading) return;
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

        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("uid", user.uid)
          .maybeSingle();

        if (data) {
          const userDataObj = {
            last_received: data.last_received
              ? new Date(data.last_received)
              : new Date(0),
            received_articles: data.received_articles || [],
            saved_words: data.saved_words || [],
            createdAt: data.created_at ? new Date(data.created_at) : new Date(),
            hasActiveSubscription: data.has_active_subscription || false,
            subscriptionStartDate: data.subscription_start_date
              ? new Date(data.subscription_start_date)
              : undefined,
            subscriptionEndDate: data.subscription_end_date
              ? new Date(data.subscription_end_date)
              : undefined,
            billingKey: data.billing_key,
            paymentMethod: data.payment_method,
            billingCancelled: data.billing_cancelled || false,
            account_status: data.account_status,
            gdg_member: data.gdg_member || false,
            referralCode: data.referral_code,
            referralGeneratedAt: data.referral_generated_at
              ? new Date(data.referral_generated_at)
              : undefined,
            bio: data.bio || "",
            work: data.work || "",
            school: data.school || "",
            location: data.location || "",
            nationality: data.nationality || "",
            interests: data.interests || "",
            profilePublic: data.profile_public !== false,
          };

          setUserData(userDataObj);
          setProfileForm({
            bio: userDataObj.bio || "",
            work: userDataObj.work || "",
            school: userDataObj.school || "",
            nationality: userDataObj.nationality || "",
            interests: userDataObj.interests || "",
            profile_public: userDataObj.profilePublic !== false,
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
          const { data } = await supabase
            .from("articles")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (data) {
            articlesData.push({
              id: id,
              title: data.title?.english || data.title?.korean || "Untitled",
              date: data.timestamp ? new Date(data.timestamp) : null,
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
  }, [user, authLoading, router]);

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

        // Upload the file to Supabase Storage
        const avatarPath = `${user.uid}/avatar.png`;
        await supabase.storage
          .from("avatars")
          .upload(avatarPath, file, { upsert: true });
        const {
          data: { publicUrl: avatarUrl },
        } = supabase.storage.from("avatars").getPublicUrl(avatarPath);

        console.log("Profile - Uploaded new avatar:", avatarUrl);

        // Update the profile (public.users.photo_url) and auth metadata
        await supabase
          .from("users")
          .update({ photo_url: avatarUrl, updated_at: new Date().toISOString() })
          .eq("uid", user.uid);
        await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });

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
      const avatarPath = `${user.uid}/avatar.png`;
      await supabase.storage.from("avatars").remove([avatarPath]);

      console.log("Profile - Deleted avatar from storage");

      // Update the profile to remove photoURL
      await supabase
        .from("users")
        .update({ photo_url: "", updated_at: new Date().toISOString() })
        .eq("uid", user.uid);
      await supabase.auth.updateUser({ data: { avatar_url: "" } });

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
          await supabase
            .from("users")
            .update({ photo_url: "", updated_at: new Date().toISOString() })
            .eq("uid", user.uid);
          await supabase.auth.updateUser({ data: { avatar_url: "" } });
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
      await supabase.auth.signOut();
      console.log("User signed out successfully");
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out. Please try again.");
    }
  };

  const accountDeletionPhrase = t.profile.deleteAccountPhrase;
  const accountDeletionNeedsBillingStop =
    userData?.hasActiveSubscription === true && !userData.billingCancelled;

  const closeAccountDeletionDialog = () => {
    if (accountDeletionInProgress) return;
    setShowAccountDeletionDialog(false);
    setAccountDeletionConfirmation("");
  };

  const handleAccountDeletion = async () => {
    if (!user) return;

    if (accountDeletionNeedsBillingStop) {
      setError(t.profile.deleteAccountBillingRequired);
      return;
    }

    if (accountDeletionConfirmation !== accountDeletionPhrase) {
      setError(t.profile.deleteAccountMismatch);
      return;
    }

    setAccountDeletionInProgress(true);
    setError("");

    try {
      await invokeFunction("account-delete", {
        confirmation: accountDeletionConfirmation,
      });
      // Deleting the Auth users invalidates the remote session. Clear the local cookie
      // regardless, since Supabase may reject sign-out after the user is gone.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      router.replace("/");
      router.refresh();
    } catch (deletionError) {
      console.error("Account deletion failed:", deletionError);
      setError(
        deletionError instanceof Error && deletionError.message
          ? deletionError.message
          : t.profile.deleteAccountFailed,
      );
      setAccountDeletionInProgress(false);
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

      // Update auth metadata + public.users
      await supabase.auth.updateUser({ data: { name: displayName } });
      await supabase
        .from("users")
        .update({
          display_name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("uid", user.uid);

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
      // nationality has no column in public.users; keep it in local state only.
      const { nationality, ...profileFormDb } = profileForm;
      await supabase
        .from("users")
        .update({
          ...profileFormDb,
          updated_at: new Date().toISOString(),
        })
        .eq("uid", user.uid);
      setUserData((prev) =>
        prev ? { ...prev, ...profileForm, profilePublic: profileForm.profile_public } : prev
      );
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
      const result = await invokeFunction("payment", {
        action: "generate-referral",
      });
      const code = (result as any)?.referralCode;
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

    // Copy BEFORE opening the Kakao dialog, for two reasons. The dialog can fail after
    // it opens — an unregistered domain, a popup blocker, no KakaoTalk installed — and
    // sendDefault gives us no callback for that, so the catch below never fires and the
    // user would be left with a broken popup and a "shared!" message. Copying first also
    // keeps the clipboard write inside the click gesture, which awaiting the SDK load
    // would otherwise break.
    let copied = false;
    try {
      await navigator.clipboard.writeText(shareText);
      copied = true;
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }

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
          setSuccessMessage(
            copied
              ? "카카오톡 공유 창을 열었습니다. 창이 뜨지 않거나 실패하면, 복사된 추천 코드를 붙여넣어 공유해주세요."
              : "카카오톡 공유 창을 열었습니다.",
          );
          return;
        }
      } catch (e) {
        console.error("Kakao share failed, falling back to copy", e);
      }
    }

    if (copied) {
      setSuccessMessage("추천 코드가 복사되었습니다. 카카오톡에 붙여넣어 공유해주세요.");
    } else {
      setError("클립보드 복사에 실패했습니다. 직접 복사하여 공유해주세요.");
    }
  };

  // Supabase's own identity list, not our link table: this card is about what GoTrue
  // will accept as a login, which is exactly what auth.identities records.
  const [identities, setIdentities] = useState<
    { id: string; provider: string }[]
  >([]);
  const [linkingIdentity, setLinkingIdentity] = useState(false);

  useEffect(() => {
    supabase.auth
      .getUserIdentities()
      .then(({ data }) => {
        setIdentities(
          (data?.identities ?? []).map((i) => ({
            id: i.identity_id ?? i.id,
            provider: i.provider,
          }))
        );
      })
      .catch(() => setIdentities([]));
  }, []);

  // Manual linking only — the member is already signed in, so the account is proven.
  // Automatic linking keys on a confirmed email and none of ours were ever verified.
  const handleLinkKakao = async () => {
    setLinkingIdentity(true);
    setError("");
    try {
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: "kakao",
        options: { redirectTo: `${window.location.origin}/profile` },
      });
      if (linkError) throw linkError;
      // A redirect to Kakao follows; nothing after this runs on success.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "카카오 연결에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
      setLinkingIdentity(false);
    }
  };

  const dismissError = useCallback(() => setError(""), []);
  const dismissSuccess = useCallback(() => setSuccessMessage(null), []);

  // A pinned banner that never leaves is its own kind of noise, so retire successes
  // on their own. Errors stay until dismissed — they usually need acting on.
  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 7000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

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
      const result = await invokeFunction("payment", {
        action: "stop",
        reason: "User requested stop billing",
      });

      console.log("Stop billing result:", result);

      if (result && (result as any).success) {
        // Update local state - subscription is still active but billing is cancelled
        setSubscriptionData((prev) => ({
          ...prev,
          status: "active", // Keep as active since user retains membership
          billingCancelled: true, // Billing is cancelled but key is preserved
          nextBillingDate: null, // No next billing date since billing is cancelled
        }));
        // The subscription card reads some rows off userData, so it has to move too —
        // otherwise the card contradicts itself until the next reload.
        setUserData((prev) =>
          prev ? { ...prev, billingCancelled: true } : prev
        );

        setSuccessMessage((result as any).message);
        setShowCancellationSurvey(false);

        // Reset survey data
        setCancellationSurveyReasons([]);
        setCancellationOtherReason("");
      } else {
        throw new Error(
          (result as any)?.message || "결제 중단에 실패했습니다."
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
      // Update user data to reactivate billing
      await supabase
        .from("users")
        .update({
          billing_cancelled: false, // Reactivate billing
        })
        .eq("uid", user.uid);

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
      setUserData((prev) =>
        prev ? { ...prev, billingCancelled: false } : prev
      );

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
      const result = await invokeFunction("payment", {
        action: "cancel",
        userId: user.uid,
        billingKey: subscriptionData.billingKey,
      });

      console.log("Subscription cancellation result:", result);

      if (result && (result as any).success) {
        const cancelledAt = new Date();

        // Update local state
        setSubscriptionData((prev) => ({
          ...prev,
          status: "canceled",
          cancelledDate: cancelledAt,
          billingCancelled: false,
          nextBillingDate: null,
        }));

        // Update user data
        await supabase
          .from("users")
          .update({
            has_active_subscription: false,
            subscription_end_date: cancelledAt.toISOString(),
          })
          .eq("uid", user.uid);

        // The "구독 여부" pill renders off userData, not subscriptionData. Without this
        // it kept reading 구독중 next to a 비활성 회원 상태 until the page was reloaded.
        setUserData((prev) =>
          prev
            ? {
                ...prev,
                hasActiveSubscription: false,
                subscriptionEndDate: cancelledAt,
                billingCancelled: false,
              }
            : prev
        );

        setSuccessMessage("구독이 성공적으로 해지되고 환불 처리되었습니다.");
        setShowRefundSurvey(false);

        // Reset survey data
        setRefundSurveyReasons([]);
        setRefundOtherReason("");
      } else {
        throw new Error(
          (result as any)?.message || "구독 해지에 실패했습니다."
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
  const membershipYear = userData?.createdAt
    ? userData.createdAt.getFullYear()
    : null;
  const roleBadgeLabel =
    userData?.account_status === "admin"
      ? "ADMIN"
      : userData?.account_status === "leader"
        ? "LEADER"
        : null;
  const lookingForChips = t.profile.lookingForDefaults;
  const profileBio = userData?.bio || t.profile.bioFallback;
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
  // True once the membership has been stopped or ended — i.e. the states a user
  // arrives at by cancelling, which is exactly when the note has to be noticed.
  const hasEndedSubscription =
    subscriptionData.status !== "active" && !!subscriptionData.startDate;
  const subscriptionActionNote = isManagedMembership
    ? "리더 또는 GDG 멤버십은 별도 결제 관리가 필요하지 않습니다."
    : subscriptionData.status === "active" && subscriptionData.billingCancelled
      ? "다음 결제가 중단되었습니다. 현재 구독 기간 만료 시까지 서비스를 이용할 수 있습니다."
      : subscriptionData.status === "active"
        ? "다음 결제 중단 또는 환불 요청을 진행할 수 있습니다."
        : hasEndedSubscription
          ? "구독이 해지되었습니다. 언제든지 멤버십을 다시 시작하실 수 있습니다."
          : "멤버십을 시작하면 영어 한잔 서비스를 이용할 수 있습니다.";
  const subscriptionNoteHighlight =
    !isManagedMembership &&
    (subscriptionData.billingCancelled || hasEndedSubscription);

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

      {(error || successMessage) && (
        <div className={alertLayerClass}>
          {error && (
            <div className={`${alertCardClass} bg-[#ffebee]`} role="alert">
              <p className={`${alertTextClass} text-[#b71c1c]`}>{error}</p>
              <button
                type="button"
                aria-label="알림 닫기"
                onClick={dismissError}
                className={alertDismissClass}
              >
                <XMarkIcon />
              </button>
            </div>
          )}
          {successMessage && (
            <div className={`${alertCardClass} bg-[#e8f5e9]`} role="status">
              <p className={`${alertTextClass} text-[#1b5e20]`}>{successMessage}</p>
              <button
                type="button"
                aria-label="알림 닫기"
                onClick={dismissSuccess}
                className={alertDismissClass}
              >
                <XMarkIcon />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-none flex-col items-center gap-0 p-0">
        <div className="w-full bg-transparent">
          <main className="mx-auto grid w-full max-w-[560px] gap-[0.85rem] px-5 pb-14 pt-5 text-[#050505] max-[600px]:gap-3 max-[600px]:px-4 max-[600px]:pb-10 max-[600px]:pt-4">
            {/* 1. PROFILE CARD */}
            <section
              className={`${nbCardClass} flex flex-col items-center gap-[0.6rem] text-center`}
            >
              <div className="relative w-fit">
                <div
                  className={`${avatarUploadClass} h-24 w-24 border-2 border-[#050505] shadow-[3px_3px_0_rgba(5,5,5,0.9)] max-[600px]:h-[84px] max-[600px]:w-[84px]`}
                >
                  <AvatarImg
                    src={avatar || defaultUserImage}
                    alt="Profile"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = defaultUserImage;
                    }}
                  />
                </div>
                <button
                  type="button"
                  aria-label="프로필 사진 변경"
                  onClick={() => document.getElementById("avatar")?.click()}
                  className="absolute -right-1 bottom-0 inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border-2 border-[#050505] bg-[#f47a4a] text-[#050505] shadow-[2px_2px_0_rgba(5,5,5,0.9)] transition-transform duration-[120ms] ease-[ease] hover:[transform:translate(-1px,-1px)] [&_svg]:h-[18px] [&_svg]:w-[18px]"
                >
                  <CameraIcon />
                </button>
                {avatar && (
                  <button
                    type="button"
                    aria-label="프로필 사진 삭제"
                    onClick={deleteAvatar}
                    className="absolute right-0 top-0 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-[#050505] bg-white text-[#050505] [&_svg]:h-[14px] [&_svg]:w-[14px]"
                  >
                    <TrashIcon />
                  </button>
                )}
                <input
                  className="hidden"
                  onChange={onAvatarChange}
                  id="avatar"
                  type="file"
                  accept="image/*"
                />
              </div>

              {isEditingName ? (
                <div
                  className="grid gap-[0.7rem]"
                  style={{ width: "100%", maxWidth: "320px" }}
                >
                  <NbInput
                    type="text"
                    value={displayName}
                    onChange={handleNameChange}
                    placeholder="이름 입력"
                    autoFocus
                    onKeyDown={handleKeyPress}
                  />
                  <div
                    className="flex flex-wrap gap-2"
                    style={{ justifyContent: "center" }}
                  >
                    <NbSaveButton type="button" onClick={saveDisplayName}>
                      저장
                    </NbSaveButton>
                    <NbCancelButton
                      type="button"
                      onClick={() => {
                        setDisplayName(user?.displayName || "");
                        setIsEditingName(false);
                      }}
                    >
                      취소
                    </NbCancelButton>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <h1 className="m-0 text-[clamp(1.4rem,4.5vw,1.75rem)] font-[900] leading-[1.1] tracking-[-0.02em] text-[#050505]">
                    {user?.displayName || "이름 없는 멤버"}
                  </h1>
                  <button
                    type="button"
                    aria-label="이름 수정"
                    onClick={() => setIsEditingName(true)}
                    className="inline-flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-full border-2 border-[#050505] bg-white text-[#050505] transition-transform duration-[120ms] ease-[ease] hover:[transform:translate(-1px,-1px)] [&_svg]:h-4 [&_svg]:w-4"
                  >
                    <PencilSquareIcon />
                  </button>
                </div>
              )}

              {membershipYear && (
                <p className="mx-0 mb-[0.1rem] mt-[-0.15rem] text-[0.8rem] font-semibold text-[rgba(5,5,5,0.55)]">
                  {t.profile.membershipSince.replace(
                    "{year}",
                    String(membershipYear)
                  )}
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-[0.45rem]">
                <span className="inline-flex items-center gap-[0.3rem] rounded-full border-2 border-[#050505] bg-[#f47a4a] px-[0.6rem] py-[0.26rem] text-[0.64rem] font-[900] uppercase tracking-[0.05em] text-[#050505] [&_svg]:h-[14px] [&_svg]:w-[14px]">
                  <CheckBadgeIcon />
                  {userData?.hasActiveSubscription
                    ? t.profile.subscribed
                    : t.profile.notSubscribed}
                </span>
                <span className="inline-flex items-center gap-[0.3rem] rounded-full border-2 border-[#050505] bg-[#050505] px-[0.6rem] py-[0.26rem] text-[0.64rem] font-[900] uppercase tracking-[0.05em] text-white [&_svg]:h-[14px] [&_svg]:w-[14px]">
                  <UserCircleIcon />
                  {userData?.account_status === "admin"
                    ? t.profile.roleAdmin
                    : userData?.account_status === "leader"
                      ? t.profile.roleLeader
                      : t.profile.roleMember}
                </span>
              </div>

              <div className="mt-[0.3rem] flex flex-wrap justify-center gap-[0.6rem]">
                <NbPillButton
                  type="button"
                  onClick={() => user && router.push(`/profile/${user.uid}`)}
                >
                  <EyeIcon />
                  {t.profile.viewPublicProfile}
                </NbPillButton>
                <NbPillButton
                  type="button"
                  onClick={() => router.push("/profile/connections")}
                >
                  <UserGroupIcon />
                  {t.profile.viewConnections}
                </NbPillButton>
                <NbPillButton
                  type="button"
                  onClick={
                    userData?.referralCode
                      ? handleShareReferral
                      : handleGenerateReferral
                  }
                  disabled={referralGenerating}
                >
                  <ShareIcon />
                  {userData?.referralCode
                    ? t.profile.shareReferral
                    : referralGenerating
                      ? t.profile.generating
                      : t.profile.generateReferral}
                </NbPillButton>
              </div>
            </section>

            {/* 2. MY INFO */}
            <section className={nbCardClass}>
              <NbManageTitle>{t.profile.myInfo}</NbManageTitle>
              <h2 className="mx-0 mb-3 mt-0 text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-[rgba(5,5,5,0.55)]">
                {t.profile.bio}
              </h2>
              <p className="m-0 text-[0.95rem] italic leading-[1.6] text-[#050505]">
                {userData?.bio || t.profile.notSet}
              </p>
              <NbManageRow
                type="button"
                onClick={() => setIsEditingDetails(true)}
              >
                <BriefcaseIcon />
                <span className="nb-row-label">{t.profile.work}</span>
                <span className="nb-row-value">
                  {userData?.work || t.profile.notSet}
                </span>
                <ChevronRightIcon />
              </NbManageRow>
              <NbManageRow
                type="button"
                onClick={() => setIsEditingDetails(true)}
              >
                <AcademicCapIcon />
                <span className="nb-row-label">{t.profile.school}</span>
                <span className="nb-row-value">
                  {userData?.school || t.profile.notSet}
                </span>
                <ChevronRightIcon />
              </NbManageRow>
              <NbManageRow
                type="button"
                onClick={() => setIsEditingDetails(true)}
              >
                <GlobeAltIcon />
                <span className="nb-row-label">{t.profile.nationality}</span>
                <span className="nb-row-value">
                  {userData?.nationality || t.profile.notSet}
                </span>
                <ChevronRightIcon />
              </NbManageRow>
              <NbManageRow
                type="button"
                onClick={() => setIsEditingDetails(true)}
              >
                <SparklesIcon />
                <span className="nb-row-label">{t.profile.interests}</span>
                <span className="nb-row-value">
                  {userData?.interests || t.profile.notSet}
                </span>
                <ChevronRightIcon />
              </NbManageRow>
            </section>

            {/* Inline profile edit form */}
            {isEditingDetails && (
              <section className={`${nbCardClass} grid gap-[0.7rem]`}>
                <NbManageTitle>{t.profile.editTitle}</NbManageTitle>
                <NbManageSub>{t.profile.editSub}</NbManageSub>
                <textarea
                  className={`${nbInputClass} min-h-[84px] resize-y`}
                  value={profileForm.bio}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  placeholder={t.profile.bioPlaceholder}
                />
                <NbInput
                  value={profileForm.work}
                  onChange={(e) =>
                    setProfileForm((prev) => ({ ...prev, work: e.target.value }))
                  }
                  placeholder={t.profile.workPlaceholder}
                />
                <NbInput
                  value={profileForm.school}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      school: e.target.value,
                    }))
                  }
                  placeholder={t.profile.schoolPlaceholder}
                />
                <NbInput
                  value={profileForm.nationality}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      nationality: e.target.value,
                    }))
                  }
                  placeholder={t.profile.nationalityPlaceholder}
                />
                <NbInput
                  value={profileForm.interests}
                  onChange={(e) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      interests: e.target.value,
                    }))
                  }
                  placeholder={t.profile.interestsPlaceholder}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    margin: "0.75rem 0",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={profileForm.profile_public}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        profile_public: e.target.checked,
                      }))
                    }
                  />
                  <span>{t.profile.makePublic}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <NbSaveButton type="button" onClick={saveProfileDetails}>
                    {t.profile.save}
                  </NbSaveButton>
                  <NbCancelButton
                    type="button"
                    onClick={() => {
                      setProfileForm({
                        bio: userData?.bio || "",
                        work: userData?.work || "",
                        school: userData?.school || "",
                        nationality: userData?.nationality || "",
                        interests: userData?.interests || "",
                        profile_public: userData?.profilePublic !== false,
                      });
                      setIsEditingDetails(false);
                    }}
                  >
                    {t.profile.cancel}
                  </NbCancelButton>
                </div>
              </section>
            )}

            {/* 3.5 LOGIN METHODS */}
            <section className={nbCardClass}>
              <NbManageTitle>로그인 수단</NbManageTitle>
              <NbManageSub>
                여러 방법으로 로그인해도 멤버십과 학습 기록은 하나로 유지됩니다.
              </NbManageSub>
              {identities.length === 0 ? (
                <NbIdentityRow>불러오는 중...</NbIdentityRow>
              ) : (
                identities.map((identity) => (
                  <NbIdentityRow key={identity.id}>
                    <span className="rounded-lg border-2 border-[#050505] bg-[#fff3d1] px-[0.55rem] py-[0.2rem] text-[0.72rem] font-extrabold tracking-[0.02em]">
                      {identity.provider === "kakao"
                        ? "카카오"
                        : identity.provider === "phone"
                          ? "휴대폰"
                          : identity.provider === "email"
                            ? "이메일"
                            : identity.provider}
                    </span>
                    <span>연결됨</span>
                  </NbIdentityRow>
                ))
              )}
              {!identities.some((i) => i.provider === "kakao") && (
                <button
                  type="button"
                  onClick={handleLinkKakao}
                  disabled={linkingIdentity}
                  className="mt-[0.9rem] min-h-[46px] w-full cursor-pointer rounded-xl border-2 border-[#050505] bg-[#fee500] text-[0.92rem] font-extrabold text-[#3c1e1e] shadow-[2px_2px_0_rgba(5,5,5,0.9)] disabled:cursor-not-allowed disabled:bg-[#f3f4f6] disabled:text-[rgba(5,5,5,0.4)] disabled:shadow-none"
                >
                  {linkingIdentity ? "카카오로 이동 중..." : "카카오 계정 연결하기"}
                </button>
              )}
            </section>

            {/* 4. SUBSCRIPTION INFO */}
            <section className={nbCardClass}>
              <NbManageTitle>{t.profile.subscriptionInfo}</NbManageTitle>
              <NbManageRow as="div">
                <CheckBadgeIcon />
                <span className="nb-row-label">{t.profile.memberStatus}</span>
                <span className="nb-row-value">{membershipStatus}</span>
              </NbManageRow>
              <NbManageRow as="div">
                <CreditCardIcon />
                <span className="nb-row-label">{t.profile.lastPay}</span>
                <span className="nb-row-value">{recentPaymentLabel}</span>
              </NbManageRow>
              <NbManageRow as="div">
                <CreditCardIcon />
                <span className="nb-row-label">{t.profile.nextBilling}</span>
                <span className="nb-row-value">{nextBillingLabel}</span>
              </NbManageRow>
              <NbManageRow as="div">
                <CreditCardIcon />
                <span className="nb-row-label">{t.profile.subscribed}</span>
                <span className="nb-row-value">
                  <NbStatusPill active={subscriptionData.status === "active"}>
                    {userData?.hasActiveSubscription
                      ? t.profile.subscribed
                      : t.profile.notSubscribed}
                  </NbStatusPill>
                </span>
              </NbManageRow>

              {/* Says out loud, in the card the user just acted on, what state the
                  subscription is now in. Highlighted once billing is stopped or the
                  membership has ended, so the change is visible at the point of the
                  action rather than only in a banner. */}
              <p
                className={`mx-0 mb-0 mt-[0.9rem] rounded-[10px] text-left text-[0.82rem] leading-[1.55] ${
                  subscriptionNoteHighlight
                    ? "border-2 border-[#050505] bg-[#fff3d1] px-[0.85rem] py-[0.7rem] font-bold text-[#050505]"
                    : "border-0 bg-transparent p-0 font-medium text-[rgba(5,5,5,0.6)]"
                }`}
              >
                {subscriptionActionNote}
              </p>

              {isManagedMembership ? null : subscriptionData.status ===
                  "active" && !subscriptionData.billingCancelled ? (
                <button
                  type="button"
                  onClick={() => setShowCancellationOptions(true)}
                  className="mt-4 w-full cursor-pointer border-0 bg-transparent text-[0.78rem] font-semibold tracking-[0.03em] text-[rgba(5,5,5,0.45)] transition-[color] duration-150 ease-[ease] hover:enabled:text-[#c0392b] hover:enabled:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.profile.subscriptionCancellation}
                </button>
              ) : (
                <NbManageRow type="button" onClick={handleSubscriptionAction}>
                  <CreditCardIcon />
                  <span className="nb-row-label">
                    {t.profile.subscriptionStatus}
                  </span>
                  <span className="nb-row-value">{subscriptionActionLabel}</span>
                  <ChevronRightIcon />
                </NbManageRow>
              )}
            </section>

            {/* 5. PRIMARY EDIT PROFILE BUTTON */}
            <button
              type="button"
              onClick={() => setIsEditingDetails((value) => !value)}
              className="w-full cursor-pointer rounded-xl border-2 border-[#050505] bg-[#050505] px-5 py-[0.8rem] text-[0.9rem] font-extrabold text-white shadow-[3px_3px_0_rgba(5,5,5,0.9)] transition-transform duration-[120ms] ease-[ease] hover:[transform:translate(-1px,-1px)]"
            >
              {isEditingDetails ? t.profile.cancel : t.profile.editProfile}
            </button>
            <button
              type="button"
              onClick={() => setShowAccountDeletionDialog(true)}
              className="w-full cursor-pointer rounded-xl border border-[#d73a49] bg-white px-4 py-[0.8rem] text-[0.88rem] font-extrabold text-[#b42331] transition-[background-color,color] duration-[160ms] ease-[ease] hover:bg-[#fff1f2]"
            >
              {t.profile.deleteAccount}
            </button>
          </main>
        </div>

        {showAccountDeletionDialog && (
          <ConfirmationOverlay onClick={closeAccountDeletionDialog}>
            <div
              className="grid w-[90%] max-w-[500px] gap-[0.9rem] rounded-[14px] border-2 border-[#050505] bg-white p-8 shadow-[4px_4px_0_rgba(5,5,5,0.9)] [&_h2]:m-0 [&_h2]:text-[1.2rem] [&_h2]:text-[#b42331] [&_p]:m-0 [&_p]:text-[0.92rem] [&_p]:leading-[1.55] [&_p]:text-[#4b5563]"
              onClick={(event) => event.stopPropagation()}
            >
              <h2>{t.profile.deleteAccountTitle}</h2>
              <p>{t.profile.deleteAccountDescription}</p>
              <p>{t.profile.deleteAccountHistory}</p>
              {accountDeletionNeedsBillingStop ? (
                <p role="alert">{t.profile.deleteAccountBillingRequired}</p>
              ) : (
                <>
                  <p>
                    {t.profile.deleteAccountConfirmation.replace(
                      "{phrase}",
                      accountDeletionPhrase,
                    )}
                  </p>
                  <code className="w-fit rounded-md border border-[#d1d5db] bg-[#f9fafb] px-[0.45rem] py-[0.28rem] text-[0.9rem] font-extrabold text-[#111827]">
                    {accountDeletionPhrase}
                  </code>
                  <input
                    className="box-border w-full rounded-lg border border-[#9ca3af] px-[0.85rem] py-3 focus:border-[#d73a49] focus:outline-2 focus:outline-offset-1 focus:outline-[#d73a49]"
                    value={accountDeletionConfirmation}
                    onChange={(event) => setAccountDeletionConfirmation(event.target.value)}
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={t.profile.deleteAccountConfirmation.replace(
                      "{phrase}",
                      accountDeletionPhrase,
                    )}
                    disabled={accountDeletionInProgress}
                  />
                </>
              )}
              <ButtonGroup>
                <CancelButton type="button" onClick={closeAccountDeletionDialog}>
                  {t.profile.cancel}
                </CancelButton>
                {!accountDeletionNeedsBillingStop && (
                  <DangerButton
                    type="button"
                    disabled={
                      accountDeletionInProgress ||
                      accountDeletionConfirmation !== accountDeletionPhrase
                    }
                    onClick={handleAccountDeletion}
                  >
                    {accountDeletionInProgress
                      ? t.profile.deleteAccountDeleting
                      : t.profile.deleteAccountConfirm}
                  </DangerButton>
                )}
              </ButtonGroup>
            </div>
          </ConfirmationOverlay>
        )}

        {showPublicPreview && (
          <ConfirmationOverlay onClick={() => setShowPublicPreview(false)}>
            <div
              className="max-h-[min(86vh,760px)] w-[min(92vw,500px)] max-w-[500px] overflow-auto rounded-[24px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="m-0 text-[1rem] font-bold text-[#222222]">
                  공개 프로필 미리보기
                </h2>
                <button
                  type="button"
                  aria-label="미리보기 닫기"
                  onClick={() => setShowPublicPreview(false)}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-[#f7f7f5] text-[#222222] transition-[background] duration-150 ease-[ease] hover:bg-[#eeeeec] [&_svg]:h-[18px] [&_svg]:w-[18px]"
                >
                  <XMarkIcon />
                </button>
              </div>
              <div className="rounded-[20px] border border-[#ddd] bg-white p-5">
                <div className="flex items-center gap-4">
                  <img
                    className="h-20 w-20 flex-none rounded-full bg-[#f7f7f5] object-cover"
                    src={avatar || defaultUserImage}
                    alt="Public profile preview"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = defaultUserImage;
                    }}
                  />
                  <div>
                    <h3 className="m-0 text-[1.35rem] font-bold leading-[1.15] text-[#222222]">
                      {user?.displayName || "이름 없는 멤버"}
                    </h3>
                    <p className="mx-0 mb-0 mt-[0.35rem] text-[0.85rem] text-[#717171]">
                      {userData?.location || "서울"}에서 활동 중
                    </p>
                    <div className="mt-2 flex flex-wrap gap-[0.4rem] max-[560px]:justify-center">
                      {userData?.account_status && (
                        <ProfileChip>
                          <UserCircleIcon /> {userData.account_status}
                        </ProfileChip>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mx-0 mb-0 mt-4 text-[0.95rem] font-normal leading-[1.6] text-[#222222]">
                  {profileBio}
                </p>
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
              </div>
            </div>
          </ConfirmationOverlay>
        )}

        {false && <div style={{ display: "none" }}>
        <div className="flex w-full flex-col gap-5 min-[768px]:flex-row min-[768px]:gap-5 min-[768px]:[&>*]:flex-1">
          {/* User Information Section */}
          <div className={`${transparentCardClass} flex w-full flex-col`}>
            <SectionTitle>기본 정보</SectionTitle>
            <SectionContent>
              <div className="flex w-full justify-between">
                <div className="flex-1">
                  <InfoRow>
                    <InfoLabel>유저명</InfoLabel>
                    {isEditingName ? (
                      <div className="relative flex items-center">
                        <input
                          className="w-[200px] rounded border border-[#ccc] bg-white px-2.5 py-1.5 text-[16px] font-medium outline-none focus:border-[#4caf50] focus:shadow-[0_0_0_2px_rgba(76,175,80,0.2)]"
                          type="text"
                          value={displayName}
                          onChange={handleNameChange}
                          placeholder="이름 입력"
                          autoFocus
                          onKeyPress={handleKeyPress}
                        />
                        <span
                          className="absolute right-2.5 cursor-pointer text-[18px] text-[#4caf50]"
                          onClick={saveDisplayName}
                        >
                          ✓
                        </span>
                      </div>
                    ) : (
                      <div
                        className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-[background-color] duration-200 ease-[ease] hover:bg-gray-light"
                        onClick={() => setIsEditingName(true)}
                      >
                        <span className="username-text text-[0.9rem] font-medium">
                          {user?.displayName
                            ? user.displayName
                            : "유저명을 정해주세요"}
                        </span>
                        <svg
                          className="h-3.5 w-3.5 text-[#666] transition-[color] duration-200 ease-[ease] group-hover:text-primary"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </div>
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
                </div>

                <div className="flex flex-col items-center justify-center pl-5">
                  <label htmlFor="avatar" className={`${avatarUploadClass} h-20 w-20`}>
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
                  </label>
                  <div className="mt-2 flex gap-2.5">
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
                  </div>
                  <input
                    className="hidden"
                    onChange={onAvatarChange}
                    id="avatar"
                    type="file"
                    accept="image/*"
                  />
                </div>
              </div>
            </SectionContent>
          </div>

          {/* Subscription Information Section */}
          <div className={transparentCardClass}>
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
                    <button
                      className="cursor-pointer rounded border-none bg-transparent p-2 text-[0.8rem] font-medium text-[#808080] no-underline transition-all duration-200 ease-[ease] hover:text-[#c0392b] hover:underline disabled:cursor-not-allowed disabled:text-[#bdbdbd] disabled:no-underline"
                      onClick={() => setShowCancellationOptions(true)}
                    >
                      멤버십 중지하기
                    </button>
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
          </div>
        </div>

        {/* Referral Code Section */}
        <div className={transparentCardClass}>
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
        </div>

        {/* Vocabulary Section */}
        {userData?.saved_words && userData.saved_words.length > 0 && (
          <div className={transparentCardClass}>
            <SectionTitle>저장한 단어</SectionTitle>
            <SectionContent>
              <div className="mt-[15px] max-h-[200px] overflow-y-auto">
                {userData.saved_words.map((word, index) => (
                  <div
                    className="my-1.5 flex items-center justify-between rounded bg-white px-3 py-2 transition-all duration-200 ease-[ease] hover:-translate-y-[2px] hover:shadow-[0_2px_5px_rgba(0,0,0,0.05)]"
                    key={index}
                  >
                    <span>{word}</span>
                  </div>
                ))}
              </div>
            </SectionContent>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <button
            className="mt-2.5 w-auto cursor-pointer rounded-[20px] border-none bg-[#d73a49] px-4 py-2 text-[14px] text-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-200 ease-[ease] hover:-translate-y-[2px] hover:bg-[#c92532] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15)]"
            onClick={handleLogout}
          >
            로그아웃
          </button>
        </div>
        </div>}

        {/* Cancellation Options Dialog */}
        {showCancellationOptions && (
          <ConfirmationOverlay>
            <div className="w-[90%] max-w-[480px] rounded-[20px] border border-[rgba(0,0,0,0.05)] bg-white p-10 shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
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

              <button
                className="relative my-3 w-full cursor-pointer rounded-xl border border-[#e8eaed] bg-[#fafbfc] px-6 py-5 text-left text-[0.95rem] font-medium text-[#333] transition-all duration-200 hover:-translate-y-px hover:border-primary hover:bg-gray-light hover:shadow-[0_2px_8px_rgba(44,24,16,0.1)] active:translate-y-0"
                onClick={handleStopNextBilling}
                disabled={stopBillingInProgress}
              >
                <span className="option-title mb-[0.4rem] block text-[1rem] font-semibold text-[#1f2937]">
                  다음 결제 중단하기 (권장)
                </span>
                <span className="option-description block text-[0.85rem] font-normal leading-[1.5] text-[#6b7280]">
                  현재 구독 기간까지는 서비스를 계속 이용하고, 다음 결제부터
                  중단됩니다. 환불은 없지만 남은 기간 동안 서비스를 모두 사용할
                  수 있습니다.
                </span>
              </button>

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
            </div>
          </ConfirmationOverlay>
        )}

        {/* Refund Confirmation Dialog */}
        {showRefundDialog && (
          <ConfirmationOverlay>
            <div className="w-[90%] max-w-[500px] rounded-lg bg-white p-8">
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
            </div>
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
      </div>
    </>
  );
}
