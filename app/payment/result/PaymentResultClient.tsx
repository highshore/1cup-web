"use client";

import { useState, useEffect } from "react";
import { styled } from "styled-components";
import { useRouter, useSearchParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebase/firebase";

// Styled components
const Container = styled.div`
  min-height: 100vh;
  background: #faf8f4;
  padding: 2rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MaxWidthWrapper = styled.div`
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
`;

const ResultCard = styled.div<{ success: boolean }>`
  background: #fff;
  border: 3px solid #050505;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 7px;
    background: ${(props) => (props.success ? "#16a34a" : "#dc2626")};
  }

  @media (max-width: 768px) {
    padding: 2rem 1.5rem;
    box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.9);
  }
`;

const StatusIcon = styled.div<{ success: boolean }>`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid #050505;
  background: ${(props) => (props.success ? "#dcfce7" : "#fee2e2")};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 2rem;
  font-size: 2.5rem;
  color: #050505;
  font-weight: 900;
  box-shadow: 3px 3px 0 rgba(5, 5, 5, 0.9);

  @media (max-width: 768px) {
    width: 64px;
    height: 64px;
    font-size: 2rem;
  }
`;

const Title = styled.h1`
  font-size: 2.25rem;
  font-weight: 900;
  color: #050505;
  margin-bottom: 1rem;
  letter-spacing: -0.02em;

  @media (max-width: 768px) {
    font-size: 1.875rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: rgba(5, 5, 5, 0.6);
  margin-bottom: 2rem;
  line-height: 1.5;

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const ResultDetails = styled.div`
  background: #faf8f4;
  border: 2px solid #050505;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 2rem 0;
  text-align: left;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1.5px solid #050505;

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
`;

const DetailLabel = styled.span`
  font-size: 0.875rem;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 700;
`;

const DetailValue = styled.span`
  font-size: 0.875rem;
  color: #050505;
  font-weight: 800;
`;

const ActionButton = styled.button<{ variant?: "primary" | "secondary" }>`
  width: 100%;
  padding: 1rem 2rem;
  border: 2px solid #050505;
  border-radius: 999px;
  font-size: 1.125rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  letter-spacing: -0.01em;
  margin-bottom: 1rem;
  box-shadow: 4px 4px 0 #050505;

  &:last-child {
    margin-bottom: 0;
  }

  ${(props) =>
    props.variant === "secondary"
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

const ErrorDetails = styled.div`
  background: #fee2e2;
  border: 2px solid #050505;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 2rem 0;
  text-align: left;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const ErrorTitle = styled.h3`
  font-size: 1rem;
  font-weight: 900;
  color: #050505;
  margin-bottom: 1rem;
`;

const ErrorText = styled.p`
  font-size: 0.875rem;
  color: rgba(5, 5, 5, 0.72);
  line-height: 1.5;
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const LoadingCard = styled.div`
  background: #fff;
  border: 3px solid #050505;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);

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
    padding: 2rem 1.5rem;
    box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.9);
  }
`;

const LoadingSpinner = styled.div`
  border: 3px solid #faf8f4;
  border-left-color: #f47a4a;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1.5rem;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadingText = styled.p`
  font-size: 1.125rem;
  color: rgba(5, 5, 5, 0.6);
  font-weight: 700;
`;

interface PaymentResult {
  success: boolean;
  message: string;
  errorCode?: string;
  data?: {
    PCD_PAY_RST: string;
    PCD_PAY_MSG: string;
    PCD_PAY_OID: string;
    PCD_PAY_TYPE: string;
    PCD_PAYER_ID: string;
    PCD_PAYER_NO: string;
    PCD_REGULER_FLAG: string;
    PCD_PAYER_EMAIL: string;
    PCD_PAY_YEAR: string;
    PCD_PAY_MONTH: string;
    PCD_PAY_GOODS?: string;
    PCD_PAY_TOTAL?: string;
    PCD_PAY_WORK?: string;
    PCD_PAY_CODE?: string;
    [key: string]: string | undefined;
  };
}

export default function PaymentResultClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null
  );
  const [isProcessed, setIsProcessed] = useState(false);
  const [hasAttemptedProcessing, setHasAttemptedProcessing] = useState(false);

  // Prevent back navigation and double payment processing
  useEffect(() => {
    // Check if payment has already been processed
    const paymentProcessed = sessionStorage.getItem("paymentProcessed");
    if (paymentProcessed) {
      setIsProcessed(true);

      // Try to get the previous result
      const storedResult = sessionStorage.getItem("paymentResult");
      if (storedResult) {
        try {
          const parsedResult = JSON.parse(storedResult);
          setPaymentResult(parsedResult);
          setLoading(false);
          return;
        } catch (e) {
          // If parsing fails, still mark as processed to prevent reprocessing
          setIsProcessed(true);
          setLoading(false);
          setError("결제 결과를 불러오는 중 오류가 발생했습니다.");
          return;
        }
      } else {
        // No stored result but marked as processed - prevent reprocessing
        setIsProcessed(true);
        setLoading(false);
        setError("결제 결과를 찾을 수 없습니다.");
        return;
      }
    }

    // Prevent browser back button
    const preventBack = () => {
      window.history.pushState(null, "", window.location.href);
    };

    // Add initial history state
    window.history.pushState(null, "", window.location.href);

    // Listen for popstate (back button)
    window.addEventListener("popstate", preventBack);

    // Prevent keyboard shortcuts for navigation
    const preventKeyboardNavigation = (e: KeyboardEvent) => {
      // Prevent Alt+Left (back), Alt+Right (forward), Backspace (back)
      if (
        (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) ||
        (e.key === "Backspace" &&
          (e.target as HTMLElement).tagName !== "INPUT" &&
          (e.target as HTMLElement).tagName !== "TEXTAREA")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener("keydown", preventKeyboardNavigation);

    // Cleanup function
    return () => {
      window.removeEventListener("popstate", preventBack);
      document.removeEventListener("keydown", preventKeyboardNavigation);
    };
  }, []);

  // Clear payment session data to prevent reuse
  useEffect(() => {
    // Clear sensitive payment data immediately
    const clearPaymentData = () => {
      sessionStorage.removeItem("paymentSessionInfo");
      sessionStorage.removeItem("paypleCallbackResponse");

      // Clear any payment-related localStorage
      localStorage.removeItem("paymentInProgress");
      localStorage.removeItem("paymentAttempts");
    };

    // Clear on mount
    clearPaymentData();

    // Clear on page unload
    const handleBeforeUnload = () => {
      clearPaymentData();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Process payment result ONLY ONCE
  useEffect(() => {
    // CRITICAL: Skip processing if already processed OR if we've already attempted processing
    if (isProcessed || hasAttemptedProcessing) {
      return;
    }

    // Mark that we've attempted processing to prevent duplicate calls
    setHasAttemptedProcessing(true);

    const processPaymentResult = async () => {
      try {
        // Mark as processing to prevent duplicate calls
        sessionStorage.setItem("paymentProcessed", "true");

        // Get URL search params - parse them more carefully
        const paymentParams: Record<string, string> = {};

        // Extract all parameters from Next.js searchParams
        Array.from(searchParams.entries()).forEach(([key, value]) => {
          paymentParams[key] = value;
        });

        // If no parameters in the URL, check for form POST data, hash fragment or sessionStorage
        if (Object.keys(paymentParams).length === 0) {
          // Try to parse hash fragment (some payment gateways use this)
          if (window.location.hash && window.location.hash.length > 1) {
            const hashParams = new URLSearchParams(
              window.location.hash.substring(1)
            );
            Array.from(hashParams.entries()).forEach(([key, value]) => {
              paymentParams[key] = value;
            });
          }

          // If still no parameters, check sessionStorage for callback response
          if (Object.keys(paymentParams).length === 0) {
            const callbackResponse = sessionStorage.getItem(
              "paypleCallbackResponse"
            );

            if (callbackResponse) {
              try {
                const callbackData = JSON.parse(callbackResponse);

                // Convert callback data to paymentParams format
                for (const key in callbackData) {
                  if (Object.prototype.hasOwnProperty.call(callbackData, key)) {
                    paymentParams[key] = String(callbackData[key]);
                  }
                }

                // Remove the stored callback response to prevent reuse
                sessionStorage.removeItem("paypleCallbackResponse");
              } catch (e) {
                // Continue processing even if parsing fails
              }
            }
          }
        }

        // Final check for necessary payment data
        if (!paymentParams.PCD_PAY_RST) {
          // If there are no parameters at all, we might be in a strange state
          if (Object.keys(paymentParams).length === 0) {
            // Try refreshing the page once to see if it helps
            if (!sessionStorage.getItem("payment_result_refreshed")) {
              sessionStorage.setItem("payment_result_refreshed", "true");
              window.location.reload();
              return; // Exit early since we're refreshing
            }

            const errorMsg =
              "결제 응답 데이터가 없습니다. 결제가 정상적으로 진행되지 않았거나 페이플에서 리디렉션이 제대로 이루어지지 않았습니다.";
            setError(errorMsg);
            setLoading(false);

            // Store error result
            const errorResult = {
              success: false,
              message: errorMsg,
              errorCode: "NO_PAYMENT_DATA",
            };
            sessionStorage.setItem(
              "paymentResult",
              JSON.stringify(errorResult)
            );
            setPaymentResult(errorResult);
            return;
          }

          throw new Error("결제 결과 정보가 없습니다. 다시 시도해주세요.");
        }

        // Clean up refresh indicator
        sessionStorage.removeItem("payment_result_refreshed");

        // If payment failed, display the error immediately
        if (paymentParams.PCD_PAY_RST !== "success") {
          const failureResult = {
            success: false,
            message: paymentParams.PCD_PAY_MSG || "결제 승인이 실패했습니다.",
            errorCode: paymentParams.PCD_PAY_CODE || "unknown",
          };

          // Store failure result
          sessionStorage.setItem(
            "paymentResult",
            JSON.stringify(failureResult)
          );
          setPaymentResult(failureResult);
          setLoading(false);
          return;
        }

        // Get the payment session info from sessionStorage
        const sessionInfo = sessionStorage.getItem("paymentSessionInfo");
        let userId: string;

        if (!sessionInfo) {
          // Use the actual Firebase UID from PCD_USER_DEFINE1 (NOT PCD_PAYER_NO which is just a sequential number)
          if (paymentParams.PCD_USER_DEFINE1) {
            userId = paymentParams.PCD_USER_DEFINE1;
          } else {
            throw new Error(
              "결제 세션 정보와 사용자 ID를 찾을 수 없습니다. 다시 시도해주세요."
            );
          }
        } else {
          const parsedSessionInfo = JSON.parse(sessionInfo);
          userId = parsedSessionInfo.userId;
        }

        // CRITICAL: Check if this exact payment has already been processed
        const paymentOrderId = paymentParams.PCD_PAY_OID;
        const processedPayments = JSON.parse(
          sessionStorage.getItem("processedPayments") || "[]"
        );

        if (processedPayments.includes(paymentOrderId)) {
          // This payment has already been processed, load the stored result
          const storedResult = sessionStorage.getItem("paymentResult");
          if (storedResult) {
            const parsedResult = JSON.parse(storedResult);
            setPaymentResult(parsedResult);
            setLoading(false);
            return;
          }
        }

        // Add this payment to the processed list
        processedPayments.push(paymentOrderId);
        sessionStorage.setItem(
          "processedPayments",
          JSON.stringify(processedPayments)
        );

        // Verify payment result with Firebase function
        const verifyPayment = httpsCallable(functions, "verifyPaymentResult");
        const result = await verifyPayment({
          userId,
          paymentParams,
          timestamp: Date.now(),
        });

        const resultData = result.data as PaymentResult;

        // Check if there's an error code in the result
        if (!resultData.success && resultData.errorCode) {
          setErrorCode(resultData.errorCode);
        }

        // Store successful result
        sessionStorage.setItem("paymentResult", JSON.stringify(resultData));
        setPaymentResult(resultData);

        // Clean up session storage after successful processing
        sessionStorage.removeItem("paymentSessionInfo");
        sessionStorage.removeItem("rawPaymentParams");

        // CRITICAL: Clear URL parameters to prevent reprocessing
        // Replace the current URL with a clean one without payment parameters
        if (typeof window !== "undefined" && window.history) {
          window.history.replaceState(null, "", "/payment/result");
        }
      } catch (err: any) {
        const errorMsg =
          err.message || "결제 결과 처리 중 오류가 발생했습니다.";
        setError(errorMsg);

        if (err.code) {
          setErrorCode(err.code);
        }

        // Store error result
        const errorResult = {
          success: false,
          message: errorMsg,
          errorCode: err.code || "PROCESSING_ERROR",
        };
        sessionStorage.setItem("paymentResult", JSON.stringify(errorResult));
        setPaymentResult(errorResult);
      } finally {
        setLoading(false);
      }
    };

    processPaymentResult();
  }, []); // CRITICAL: Empty dependency array to ensure it only runs once

  const handleContinue = () => {
    // Clear all payment-related data before navigating
    sessionStorage.removeItem("paymentProcessed");
    sessionStorage.removeItem("paymentResult");
    sessionStorage.removeItem("payment_result_refreshed");
    sessionStorage.removeItem("processedPayments");

    // Navigate to profile
    router.push("/profile");
  };

  const handleRetry = () => {
    // Clear all payment-related data before retrying
    sessionStorage.removeItem("paymentProcessed");
    sessionStorage.removeItem("paymentResult");
    sessionStorage.removeItem("payment_result_refreshed");
    sessionStorage.removeItem("rawPaymentParams");
    sessionStorage.removeItem("processedPayments");

    // Navigate to payment page
    router.push("/payment");
  };

  // Show warning if user tries to leave the page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loading) {
        e.preventDefault();
        e.returnValue = "결제 처리가 진행 중입니다. 페이지를 떠나시겠습니까?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [loading]);

  if (loading) {
    return (
      <Container>
        <MaxWidthWrapper>
          <LoadingCard>
            <LoadingSpinner />
            <LoadingText>결제 결과 처리 중...</LoadingText>
          </LoadingCard>
        </MaxWidthWrapper>
      </Container>
    );
  }

  return (
    <Container>
      <MaxWidthWrapper>
        <ResultCard success={paymentResult?.success || false}>
          <StatusIcon success={paymentResult?.success || false}>
            {paymentResult?.success ? "✓" : "×"}
          </StatusIcon>

          {paymentResult?.success ? (
            <>
              <Title>구독 등록 완료</Title>
              <Subtitle>
                One Cup English 프리미엄 멤버십에 가입되었습니다
              </Subtitle>

              {paymentResult.data && (
                <ResultDetails>
                  <DetailRow>
                    <DetailLabel>결제 결과</DetailLabel>
                    <DetailValue>
                      {paymentResult.data.PCD_PAY_RST || "완료"}
                    </DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>상품명</DetailLabel>
                    <DetailValue>
                      {paymentResult.data.PCD_PAY_GOODS ||
                        "One Cup English 프리미엄 멤버십"}
                    </DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>구독 금액</DetailLabel>
                    <DetailValue>
                      ₩
                      {paymentResult.data.PCD_PAY_TOTAL
                        ? Number(
                            paymentResult.data.PCD_PAY_TOTAL
                          ).toLocaleString()
                        : "4,700"}
                      /월
                    </DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>다음 결제일</DetailLabel>
                    <DetailValue>
                      {new Date(
                        new Date().setMonth(new Date().getMonth() + 1)
                      ).toLocaleDateString()}
                    </DetailValue>
                  </DetailRow>
                </ResultDetails>
              )}

              <ActionButton onClick={handleContinue}>
                프로필로 이동
              </ActionButton>
            </>
          ) : (
            <>
              <Title>구독 등록 실패</Title>
              <Subtitle>
                {paymentResult?.message || "결제 처리 중 오류가 발생했습니다"}
              </Subtitle>

              <ErrorDetails>
                <ErrorTitle>문제 해결 방법</ErrorTitle>
                <ErrorText>• 카드 정보를 다시 확인해 주세요</ErrorText>
                <ErrorText>• 결제 한도를 확인해 주세요</ErrorText>
                <ErrorText>• 다른 카드로 시도해 보세요</ErrorText>
                <ErrorText>
                  • 문제가 지속되면 고객센터로 문의해 주세요
                </ErrorText>
                {errorCode && (
                  <ErrorText style={{ marginTop: "1rem", fontWeight: 600 }}>
                    오류 코드: {errorCode}
                  </ErrorText>
                )}
              </ErrorDetails>

              <ActionButton onClick={handleRetry}>다시 시도하기</ActionButton>
              <ActionButton variant="secondary" onClick={handleContinue}>
                홈으로 돌아가기
              </ActionButton>
            </>
          )}
        </ResultCard>
      </MaxWidthWrapper>
    </Container>
  );
}
