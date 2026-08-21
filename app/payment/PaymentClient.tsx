"use client";

import { useState, useEffect, Suspense } from "react";
import { styled } from "styled-components";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, invokeFunction } from "../lib/supabase/client";
import { useAuth } from "../lib/contexts/auth_context";

// Payple payment-window SDK host. Live is cpay.payple.kr; set
// NEXT_PUBLIC_PAYPLE_HOST=https://democpay.payple.kr to run against the sandbox
// (must match PAYPLE_HOST on the payment edge function — mixing the two fails auth).
const PAYPLE_HOST = (
  process.env.NEXT_PUBLIC_PAYPLE_HOST || "https://cpay.payple.kr"
).replace(/\/+$/, "");
const PAYPLE_SDK_SRC = `${PAYPLE_HOST}/js/v1/payment.js`;

// Declare the jQuery global variable and other globals
declare global {
  interface Window {
    PaypleCpayAuthCheck: (paymentParams: any) => void;
    $: any; // jQuery
    PaypleCpayCallback: any[]; // Array of callback handlers
  }
}

// Initialize the Payple callback array if it doesn't exist
if (typeof window !== "undefined" && !window.PaypleCpayCallback) {
  window.PaypleCpayCallback = [];
}

// Best-effort: a failure we cannot describe is worse than a slow one, but never let
// the report itself surface as the error the member sees.
async function reportPaymentFailure(
  orderNumber: string | undefined,
  stage: string,
  errorMessage: string,
  response?: unknown
) {
  try {
    await invokeFunction("payment", {
      action: "report-failure",
      orderNumber,
      stage,
      errorCode:
        (response as Record<string, string> | undefined)?.PCD_PAY_CODE ||
        "client_reported",
      errorMessage,
      response,
    });
  } catch {
    // swallowed on purpose
  }
}

// Add our callback handler to the array
if (typeof window !== "undefined") {
  window.PaypleCpayCallback.push(function (response: any) {
    // Enhanced debug logging
    try {
      // Store response in sessionStorage
      sessionStorage.setItem(
        "paypleCallbackResponse",
        JSON.stringify(response)
      );

      // A non-success result is the common case we were blind to: verify() throws on
      // it, so nothing reached the order row.
      if (response?.PCD_PAY_RST && response.PCD_PAY_RST !== "success") {
        void reportPaymentFailure(
          response.PCD_PAY_OID,
          "callback",
          response.PCD_PAY_MSG || "결제가 완료되지 않았습니다.",
          response
        );
      }

      // Get the session info
      const sessionInfo = sessionStorage.getItem("paymentSessionInfo");
      if (sessionInfo) {
        const parsedSession = JSON.parse(sessionInfo);

        // Manually call our Edge Function to verify the payment
        invokeFunction("payment", {
          action: "verify",
          userId: parsedSession.userId,
          paymentParams: response,
          timestamp: Date.now(),
        })
          .then((result) => {
            // Store the verification result
            sessionStorage.setItem(
              "paymentVerificationResult",
              JSON.stringify(result)
            );

            // Redirect to the result page - the user stays in the frontend app
            // Payple handles the server-side POST to our HTTP function separately
            window.location.href = "/payment/result";
          })
          .catch((error) => {
            sessionStorage.setItem(
              "paymentVerificationError",
              JSON.stringify({
                message: error.message,
                code: error.code,
                details: error.details,
                timestamp: new Date().toISOString(),
              })
            );

            // Still redirect to result page to show the error
            window.location.href = "/payment/result";
          });
      } else {
        // Fallback: still redirect but without verification
        window.location.href = "/payment/result";
      }
    } catch (e) {
      // Still redirect to the result page to show the error
      window.location.href = "/payment/result";
    }

    // Return true to indicate the callback was handled
    return true;
  });
}

const MainCard = styled.div`
  background: #faf8f4;
  border-radius: 12px;
  width: 100%;
  min-height: 100vh;
  padding: 2rem 0rem;

  @media (max-width: 768px) {
    padding: 2rem 0rem;
    border-radius: 12px;
  }
`;

const PricingCard = styled.div`
  border: 3px solid #050505;
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  background: #fff;
  position: relative;
  overflow: hidden;
  box-shadow: 6px 6px 0 #050505;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 7px;
    background: #f47a4a;
  }

  @media (max-width: 768px) {
    padding: 1.5rem;
    box-shadow: 5px 5px 0 #050505;
  }
`;

const PricingHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const PricingTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 900;
  color: #050505;
  margin-bottom: 0.5rem;
`;

const PricingAmount = styled.div`
  font-size: 3rem;
  font-weight: 900;
  color: #050505;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const PricingPeriod = styled.span`
  font-size: 1.125rem;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 600;
`;

const FeaturesList = styled.div`
  margin: 2rem 0;
`;

const FeatureItem = styled.div`
  display: flex;
  align-items: flex-start;
  padding: 0.75rem 0;
  font-size: 1rem;
  color: rgba(5, 5, 5, 0.72);
  line-height: 1.2;

  &::before {
    content: "✓";
    color: #050505;
    font-weight: 900;
    margin-right: 1rem;
    margin-top: 0.125rem;
    flex-shrink: 0;
  }
`;

const ActionButton = styled.button<{ $variant?: "primary" | "secondary" }>`
  width: 100%;
  padding: 1rem 2rem;
  border: 2px solid #050505;
  border-radius: 999px;
  font-size: 1.125rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  position: relative;
  letter-spacing: -0.01em;
  box-shadow: 4px 4px 0 #050505;

  ${(props) =>
    props.$variant === "secondary"
      ? `
    background: #fff;
    color: #050505;

    &:hover:not(:disabled) {
      background: #f3f3f1;
      transform: translate(-1px, -1px);
      box-shadow: 5px 5px 0 #050505;
    }
  `
      : `
    background: #f47a4a;
    color: #050505;

    &:hover:not(:disabled) {
      transform: translate(-1px, -1px);
      box-shadow: 5px 5px 0 #050505;
    }

    &:active:not(:disabled) {
      transform: translate(1px, 1px);
      box-shadow: 2px 2px 0 #050505;
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
  }
`;

const CheckboxSection = styled.div`
  margin-bottom: 2rem;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: flex-start;
  cursor: pointer;
  font-size: 1rem;
  color: rgba(5, 5, 5, 0.72);
  line-height: 1.5;
  gap: 0.75rem;
`;

const CheckboxInput = styled.input`
  width: 18px;
  height: 18px;
  margin-top: 0.125rem;
  accent-color: #f47a4a;
  flex-shrink: 0;
`;

const PolicyCard = styled.div`
  background: #ffffff;
  border: 2px solid #050505;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.88);

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const PolicyTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 900;
  color: #050505;
  margin-bottom: 1rem;
`;

const PolicySection = styled.div`
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const PolicySubtitle = styled.h4`
  font-size: 0.875rem;
  font-weight: 800;
  color: #050505;
  margin-bottom: 0.5rem;
`;

const PolicyText = styled.p`
  font-size: 0.875rem;
  color: rgba(5, 5, 5, 0.6);
  line-height: 1.5;
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }

  strong {
    color: #050505;
    font-weight: 800;
  }

  a {
    color: #f47a4a;
    text-decoration: underline;
    font-weight: 800;

    &:hover {
      color: #050505;
    }
  }
`;

const ErrorMessage = styled.div`
  background: #fee2e2;
  border: 2px solid #050505;
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1rem;
  color: #050505;
  font-weight: 800;
  text-align: center;
  font-size: 0.875rem;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
`;

const LoadingSpinner = styled.div`
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-left-color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  animation: spin 1s linear infinite;
  display: inline-block;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const AlreadySubscribedCard = styled.div`
  background: #ffffff;
  border: 3px solid #050505;
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  margin-top: 1rem;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
`;

const AlreadySubscribedIcon = styled.div`
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #050505;
`;

const AlreadySubscribedTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 900;
  color: #050505;
  margin-bottom: 0.5rem;
`;

const AlreadySubscribedText = styled.p`
  font-size: 1rem;
  color: rgba(5, 5, 5, 0.72);
  margin-bottom: 1.5rem;
  line-height: 1.5;
`;

const Badge = styled.span`
  display: inline-block;
  background: #f47a4a;
  color: #050505;
  border: 1.5px solid #050505;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
`;

const ReferralSection = styled.div`
  margin: 2rem 0;
  padding-top: 2rem;
  border-top: 2px solid #050505;
`;

const ReferralLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 800;
  color: #050505;
  margin-bottom: 0.75rem;
`;

const InputGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #050505;
  border-radius: 10px;
  font-size: 1rem;
  transition: box-shadow 0.16s ease;

  &:focus {
    outline: none;
    box-shadow: 2px 2px 0 #f47a4a;
  }

  &:disabled {
    background: #f3f3f1;
    color: rgba(5, 5, 5, 0.4);
  }
`;

const VerifyButton = styled.button`
  padding: 0 1.25rem;
  background: #f47a4a;
  border: 2px solid #050505;
  border-radius: 999px;
  color: #050505;
  font-weight: 800;
  font-size: 0.875rem;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;
  transition: transform 0.16s ease, box-shadow 0.16s ease;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    box-shadow: none;
    cursor: not-allowed;
  }
`;

const ClearButton = styled.button`
  padding: 0 1.25rem;
  background: #ffffff;
  border: 2px solid #050505;
  border-radius: 999px;
  color: #050505;
  font-weight: 800;
  font-size: 0.875rem;
  cursor: pointer;
  box-shadow: 2px 2px 0 #050505;
  transition: transform 0.16s ease, box-shadow 0.16s ease;

  &:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 #050505;
  }

  &:disabled {
    opacity: 0.5;
    box-shadow: none;
    cursor: not-allowed;
  }
`;

const ReferralMessage = styled.div<{ $valid?: boolean }>`
  font-size: 0.875rem;
  color: ${(props) => (props.$valid ? "#16a34a" : "#dc2626")};
  margin-top: 0.5rem;
  font-weight: 500;
`;

interface UserData {
  hasActiveSubscription?: boolean;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  billingKey?: string;
}

export default function PaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  const BASE_PRICE = 9700;

  // --- NEW STATE ---
  const [selectMeetup, setSelectMeetup] = useState(true); // Default to selected
  const [totalAmount, setTotalAmount] = useState(0); // Will be calculated
  const [selectedProductName] = useState("영어 한잔 멤버십 (정기 결제)");
  // --- END NEW STATE ---

  // --- REFERRAL STATE ---
  const [referralCode, setReferralCode] = useState("");
  const [referralMessage, setReferralMessage] = useState("");
  const [isReferralValid, setIsReferralValid] = useState(false);
  const [discountPrice, setDiscountPrice] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<"percent" | "fixed_price" | null>(null);
  const [discountValue, setDiscountValue] = useState<number | null>(null);
  const [discountPercentApplied, setDiscountPercentApplied] = useState<number | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [prefillChecked, setPrefillChecked] = useState(false);
  // --- END REFERRAL STATE ---

  const getGrowthTrackingCode = () => {
    const urlCode = searchParams?.get("growth")?.trim();
    const cookieCode =
      typeof document !== "undefined"
        ? document.cookie
            .split("; ")
            .find((cookie) => cookie.startsWith("growthTrackingCode="))
            ?.split("=")[1]
        : undefined;
    const code = urlCode || cookieCode || "";
    return /^[a-z0-9_-]{4,80}$/i.test(code) ? code : undefined;
  };

  // Check authentication and fetch user data
  useEffect(() => {
    if (currentUser) {
      fetchUserData(currentUser.uid);
    } else {
      setLoading(false);
      // Allow access without login
    }
  }, [currentUser]);

  // Calculate total amount based on meetup selection
  useEffect(() => {
    let meetupPrice = BASE_PRICE;

    if (isReferralValid && discountPrice !== null) {
      meetupPrice = discountPrice;
    }

    const amount = selectMeetup ? meetupPrice : 0;
    setTotalAmount(amount);
  }, [selectMeetup, isReferralValid, discountPrice]);

  const checkCode = async (codeOverride?: string) => {
    const codeToUse = (codeOverride ?? referralCode).trim();
    if (!codeToUse) return;
    setIsCheckingCode(true);
    setReferralMessage("");

    try {
      const data = (await invokeFunction("payment", {
        action: "check-referral",
        code: codeToUse,
      })) as any;

      if (data.valid) {
        const discountValue = Number(data.discount ?? 0);
        const discountType = data.discountType || "fixed_price";
        let discounted = BASE_PRICE;
        let appliedPercent = 0;

        if (discountType === "percent") {
          const rawDiscount = BASE_PRICE * (discountValue / 100);
          const discountRoundedDown10 = Math.floor(rawDiscount / 10) * 10;
          discounted = Math.max(0, BASE_PRICE - discountRoundedDown10);
          // Final price should be rounded UP to nearest 10 KRW
          discounted = Math.ceil(discounted / 10) * 10;
          appliedPercent = Math.floor((discountRoundedDown10 / BASE_PRICE) * 100);
        } else {
          // fixed amount off, round discount down to nearest 10 KRW
          const discountRoundedDown10 = Math.floor(discountValue / 10) * 10;
          discounted = Math.max(0, BASE_PRICE - discountRoundedDown10);
          discounted = Math.ceil(discounted / 10) * 10; // round final price UP to nearest 10 KRW
          appliedPercent = Math.floor((discountRoundedDown10 / BASE_PRICE) * 100);
        }

        setIsReferralValid(true);
        setDiscountPrice(discounted);
        setDiscountType(discountType);
        setDiscountValue(discountValue);
        setDiscountPercentApplied(appliedPercent);
        setReferralMessage(data.message);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("referralCodePrefill", codeToUse);
        }
        if (!codeOverride) {
          setReferralCode(codeToUse);
        }
      } else {
        setIsReferralValid(false);
        setDiscountPrice(null);
        setDiscountType(null);
        setDiscountValue(null);
        setReferralMessage(data.message);
      }
    } catch (e) {
      console.error(e);
      setReferralMessage("코드 확인 중 오류가 발생했습니다.");
      setIsReferralValid(false);
      setDiscountPrice(null);
    } finally {
      setIsCheckingCode(false);
    }
  };

  // Prefill referral code from URL (?ref=CODE) and auto-validate once
  useEffect(() => {
    if (prefillChecked) return;
    const urlRef = searchParams?.get("ref")?.trim();
    const storedRef =
      typeof window !== "undefined"
        ? sessionStorage.getItem("referralCodePrefill")?.trim()
        : null;

    const refToUse = urlRef || storedRef;
    if (refToUse) {
      setReferralCode(refToUse);
      checkCode(refToUse);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("referralCodePrefill", refToUse);
      }
      setPrefillChecked(true);
    }
  }, [searchParams, prefillChecked]);

  const fetchUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("uid", userId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setUserData({
          hasActiveSubscription: data.has_active_subscription ?? undefined,
          subscriptionStartDate: data.subscription_start_date
            ? new Date(data.subscription_start_date)
            : undefined,
          subscriptionEndDate: data.subscription_end_date
            ? new Date(data.subscription_end_date)
            : undefined,
          billingKey: data.billing_key ?? undefined,
        });
      }
      setLoading(false);
    } catch (err) {
      console.error("Error fetching user data:", err);
      setError("사용자 정보를 가져오는 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const handlePaymentClick = async () => {
    if (!currentUser) {
      // Store the current path for post-login redirect
      localStorage.setItem("returnUrl", "/payment");
      // Persist referral code for after login
      if (typeof window !== "undefined") {
        const refToSave = referralCode?.trim() || searchParams?.get("ref")?.trim() || "";
        if (refToSave) {
          sessionStorage.setItem("referralCodePrefill", refToSave);
        }
      }
      // Redirect to auth page
      router.push("/auth");
      return;
    }

    // --- VALIDATION ---
    if (!selectMeetup) {
      setError("밋업 참여를 선택해주세요.");
      return;
    }
    if (totalAmount <= 0) {
      setError(
        "결제 금액을 계산하는 중 오류가 발생했습니다. 다시 시도해주세요."
      );
      return;
    }
    // --- END VALIDATION ---

    setIsProcessing(true);
    setError(null);

    try {
      // --- UPDATE User Info for Payment ---
      const userInfo = {
        userId: currentUser.uid,
        userEmail: currentUser.email || "",
        userName: currentUser.displayName || "사용자",
        // Whole number, not a fragment. This used to send the last 8 digits (or an
        // 8-digit timestamp), which reached Payple as PCD_PAYER_HP and could not
        // receive the auth SMS. The server prefers its own record anyway.
        userPhone: currentUser.phoneNumber || "",
        pcd_amount: totalAmount, // Pass calculated amount
        pcd_good_name: selectedProductName, // Pass selected items description
        selected_categories: {
          meetup: selectMeetup,
        },
        referralCode: isReferralValid ? referralCode.trim() : undefined,
        growthTrackingCode: getGrowthTrackingCode(),
      };
      // --- END UPDATE ---

      // Store session info for result page
      sessionStorage.setItem(
        "paymentSessionInfo",
        JSON.stringify({
          userId: currentUser.uid,
          timestamp: Date.now(),
          amount: totalAmount, // Store amount in session too
          productName: selectedProductName,
        })
      );

      // Get payment window data
      const paymentData = (await invokeFunction("payment", {
        action: "window",
        ...userInfo,
      })) as any;

      if (!paymentData?.success) {
        throw new Error(
          paymentData?.message || "결제 정보를 가져오는데 실패했습니다."
        );
      }

      // Verify scripts are loaded
      if (
        typeof window.$ === "undefined" ||
        typeof window.PaypleCpayAuthCheck !== "function"
      ) {
        throw new Error(
          "결제 스크립트가 로드되지 않았습니다. 페이지를 새로고침 해주세요."
        );
      }

      // Payple validates the parameters before the window renders and reports that
      // rejection here, not through PaypleCpayCallback — so without this the reason
      // never left the member's browser.
      try {
        window.PaypleCpayAuthCheck(paymentData.paymentParams);
      } catch (windowErr) {
        void reportPaymentFailure(
          paymentData.paymentParams?.PCD_PAY_OID,
          "window_open",
          windowErr instanceof Error ? windowErr.message : String(windowErr)
        );
        throw windowErr;
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "결제 초기화 중 오류가 발생했습니다.";
      setError(message);
      setIsProcessing(false);
    }
  };

  // Add the Payple script dynamically
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadPaypleScript = () => {
      // First load jQuery if it's not already loaded
      if (typeof window.$ === "undefined") {
        const jqueryScript = document.createElement("script");
        jqueryScript.src = "https://code.jquery.com/jquery-3.6.0.min.js";
        jqueryScript.async = true;
        jqueryScript.onload = () => {
          // After jQuery is loaded, load the Payple script
          const paypleScript = document.createElement("script");
          paypleScript.src = PAYPLE_SDK_SRC;
          paypleScript.async = true;
          document.body.appendChild(paypleScript);
        };
        document.body.appendChild(jqueryScript);
      } else {
        // jQuery already loaded, just load Payple script
        const paypleScript = document.createElement("script");
        paypleScript.src = PAYPLE_SDK_SRC;
        paypleScript.async = true;
        document.body.appendChild(paypleScript);
      }
    };

    loadPaypleScript();

    return () => {
      // Clean up scripts when component unmounts
      const jqueryScript = document.querySelector(
        'script[src="https://code.jquery.com/jquery-3.6.0.min.js"]'
      );
      const paypleScript = document.querySelector(
        `script[src="${PAYPLE_SDK_SRC}"]`
      );
      if (jqueryScript && jqueryScript.parentNode) {
        jqueryScript.parentNode.removeChild(jqueryScript);
      }
      if (paypleScript && paypleScript.parentNode) {
        paypleScript.parentNode.removeChild(paypleScript);
      }
    };
  }, []);

  if (loading) {
    return (
      <MainCard>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <LoadingSpinner />
        </div>
      </MainCard>
    );
  }

  return (
    <Suspense fallback={<MainCard><div style={{padding:"2rem", textAlign:"center"}}><LoadingSpinner /></div></MainCard>}>
    <MainCard>
      {userData?.hasActiveSubscription ? (
        <AlreadySubscribedCard>
          <AlreadySubscribedIcon>✓</AlreadySubscribedIcon>
          <AlreadySubscribedTitle>이미 구독 중입니다</AlreadySubscribedTitle>
          <AlreadySubscribedText>
            현재 멤버십을 이용 중입니다. 프로필 페이지에서 구독 상태를 확인하실
            수 있습니다.
          </AlreadySubscribedText>
          <ActionButton
            $variant="secondary"
            onClick={() => router.push("/profile")}
          >
            프로필로 이동
          </ActionButton>
        </AlreadySubscribedCard>
      ) : (
        <>
          <PricingCard>
            <PricingHeader>
              <PricingTitle>Monthly Membership</PricingTitle>
              <PricingAmount>
                9,700
                <PricingPeriod> 원 / 1개월</PricingPeriod>
              </PricingAmount>
            </PricingHeader>

            <FeaturesList>
              <FeatureItem>월 4회 오프라인 영어 모임</FeatureItem>
              <FeatureItem>
                통번역사 출신 및 다양한 백그라운드를 가진 멤버들과 실전 대화
              </FeatureItem>
              <FeatureItem>소규모 그룹 (5명 이하) 집중 토론</FeatureItem>
              <FeatureItem>
                미국 기업 임원들이 즐겨보는 기사로 학습 및 스피킹
              </FeatureItem>
            </FeaturesList>

            <ReferralSection>
              <ReferralLabel>지인 추천 코드 (선택)</ReferralLabel>
              <InputGroup>
                <Input
                  placeholder="추천 코드를 입력하세요"
                  value={referralCode}
                  onChange={(e) => {
                    setReferralCode(e.target.value);
                    if (isReferralValid) {
                      setIsReferralValid(false);
                      setDiscountPrice(null);
                      setReferralMessage("");
                    }
                  }}
                />
                <VerifyButton
                  onClick={() => checkCode()}
                  disabled={
                    !referralCode.trim() || isCheckingCode
                  }
                >
                  {isCheckingCode
                    ? "확인 중..."
                    : isReferralValid
                    ? "적용됨"
                    : "확인"}
                </VerifyButton>
                <ClearButton
                  onClick={() => {
                    setReferralCode("");
                    setIsReferralValid(false);
                    setDiscountPrice(null);
                    setDiscountType(null);
                    setDiscountValue(null);
                    setDiscountPercentApplied(null);
                    setReferralMessage("");
                    if (typeof window !== "undefined") {
                      sessionStorage.removeItem("referralCodePrefill");
                    }
                  }}
                  disabled={!referralCode && !isReferralValid}
                >
                  해제
                </ClearButton>
              </InputGroup>
              {referralMessage && (
                <ReferralMessage $valid={isReferralValid}>
                  {referralMessage}
                </ReferralMessage>
              )}
            </ReferralSection>

            <ActionButton
              onClick={handlePaymentClick}
              disabled={isProcessing || !selectMeetup}
            >
              {isProcessing ? (
                <LoadingSpinner />
              ) : (
                isReferralValid &&
                discountPrice !== null &&
                discountPrice < BASE_PRICE ? (
                  <>
                    월 {totalAmount.toLocaleString()}원으로 시작하기{" "}
                    <span style={{ fontSize: "0.9rem", opacity: 0.85 }}>
                      {discountType === "percent" && discountValue !== null
                        ? `(할인 ${discountValue}% 적용)`
                        : `(할인 ${discountPercentApplied ?? 0}% 적용)`}
                    </span>
                  </>
                ) : (
                  `월 ${totalAmount.toLocaleString()}원으로 시작하기`
                )
              )}
            </ActionButton>
          </PricingCard>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <PolicyCard>
            <PolicyTitle>결제 및 환불 정책</PolicyTitle>

            <PolicySection>
              <PolicySubtitle>자동 결제</PolicySubtitle>
              <PolicyText>
                30일마다 자동으로 결제됩니다. 재결제 시 알림톡을 드리며 언제든지
                취소할 수 있습니다.
              </PolicyText>
            </PolicySection>

            <PolicySection>
              <PolicySubtitle>7일 체험 기간 및 환불 정책</PolicySubtitle>
              <PolicyText>
                결제일로부터 <strong>7일 이내 전액 환불</strong>이 가능합니다.
                7일 이후에는 사용하지 않은 기간에 대해 일할 계산으로 환불됩니다.
                또한, 운영진 판단에 의거 정책 위반이나 원활한 서비스 제공이
                어려울 경우 일방적으로 환불 처리를 해드릴 수 있습니다.
              </PolicyText>
            </PolicySection>

            <PolicySection>
              <PolicySubtitle>구독 관리</PolicySubtitle>
              <PolicyText>
                <a
                  href="/profile"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/profile");
                  }}
                >
                  프로필 페이지
                </a>
                에서 구독을 관리하실 수 있습니다.
              </PolicyText>
            </PolicySection>
          </PolicyCard>
        </>
      )}
    </MainCard>
    </Suspense>
  );
}
