"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { invokeFunction } from "../../lib/supabase/client";

// Shared class strings (styled-components migration).
const containerClass =
  "min-h-screen bg-[#faf8f4] py-8 px-4 flex items-center justify-center";

const maxWidthWrapperClass = "max-w-[600px] w-full mx-auto";

// Card base shared by the result and loading cards; the ::before colour bar is set
// per variant.
const cardBaseClass =
  "bg-white border-[3px] border-[#050505] rounded-[16px] py-12 px-8 text-center relative overflow-hidden shadow-[6px_6px_0_rgba(5,5,5,0.9)] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[7px] max-[768px]:py-8 max-[768px]:px-6 max-[768px]:shadow-[5px_5px_0_rgba(5,5,5,0.9)]";

const titleClass =
  "text-[2.25rem] font-[900] text-[#050505] mb-4 tracking-[-0.02em] max-[768px]:text-[1.875rem]";

const subtitleClass =
  "text-[1.125rem] text-[rgba(5,5,5,0.6)] mb-8 leading-[1.5] max-[768px]:text-[1rem]";

const detailRowClass =
  "flex justify-between items-center py-3 border-b-[1.5px] border-[#050505] last:border-b-0 max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-1";

const detailLabelClass = "text-[0.875rem] text-[rgba(5,5,5,0.6)] font-bold";

const detailValueClass = "text-[0.875rem] text-[#050505] font-extrabold";

const actionButtonBaseClass =
  "w-full py-4 px-8 border-2 border-[#050505] rounded-full text-[1.125rem] font-extrabold cursor-pointer [transition:transform_0.15s_ease,box-shadow_0.15s_ease,background_0.15s_ease] tracking-[-0.01em] mb-4 last:mb-0 shadow-[4px_4px_0_#050505] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none max-[768px]:py-[0.875rem] max-[768px]:px-6 max-[768px]:text-[1rem]";

const actionButtonPrimaryClass = `${actionButtonBaseClass} bg-[#f47a4a] text-[#050505] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[5px_5px_0_#050505] enabled:active:[transform:translate(1px,1px)] enabled:active:shadow-[2px_2px_0_#050505]`;

const actionButtonSecondaryClass = `${actionButtonBaseClass} bg-white text-[#050505] enabled:hover:bg-[#f3f3f1] enabled:hover:[transform:translate(-1px,-1px)] enabled:hover:shadow-[5px_5px_0_#050505]`;

const errorTextClass =
  "text-[0.875rem] text-[rgba(5,5,5,0.72)] leading-[1.5] mb-2 last:mb-0";

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
          // Use the actual legacy user UID from PCD_USER_DEFINE1 (NOT PCD_PAYER_NO,
          // which is only a sequential number).
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

        // Verify payment result with the payment Edge Function
        const resultData = (await invokeFunction("payment", {
          action: "verify",
          userId,
          paymentParams,
          timestamp: Date.now(),
        })) as PaymentResult;

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
      <div className={containerClass}>
        <div className={maxWidthWrapperClass}>
          <div className={`${cardBaseClass} before:bg-[#f47a4a]`}>
            <div className="border-[3px] border-[#faf8f4] border-l-[#f47a4a] rounded-full w-12 h-12 animate-spin mx-auto mb-6" />
            <p className="text-[1.125rem] text-[rgba(5,5,5,0.6)] font-bold">
              결제 결과 처리 중...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={maxWidthWrapperClass}>
        <div
          className={`${cardBaseClass} ${
            paymentResult?.success ? "before:bg-[#16a34a]" : "before:bg-[#dc2626]"
          }`}
        >
          <div
            className={`w-20 h-20 rounded-full border-2 border-[#050505] flex items-center justify-center mx-auto mb-8 text-[2.5rem] text-[#050505] font-[900] shadow-[3px_3px_0_rgba(5,5,5,0.9)] max-[768px]:w-16 max-[768px]:h-16 max-[768px]:text-[2rem] ${
              paymentResult?.success ? "bg-[#dcfce7]" : "bg-[#fee2e2]"
            }`}
          >
            {paymentResult?.success ? "✓" : "×"}
          </div>

          {paymentResult?.success ? (
            <>
              <h1 className={titleClass}>구독 등록 완료</h1>
              <p className={subtitleClass}>
                One Cup English 프리미엄 멤버십에 가입되었습니다
              </p>

              {paymentResult.data && (
                <div className="bg-[#faf8f4] border-2 border-[#050505] rounded-[12px] p-6 my-8 text-left shadow-[4px_4px_0_rgba(5,5,5,0.9)] max-[768px]:p-4">
                  <div className={detailRowClass}>
                    <span className={detailLabelClass}>결제 결과</span>
                    <span className={detailValueClass}>
                      {paymentResult.data.PCD_PAY_RST || "완료"}
                    </span>
                  </div>
                  <div className={detailRowClass}>
                    <span className={detailLabelClass}>상품명</span>
                    <span className={detailValueClass}>
                      {paymentResult.data.PCD_PAY_GOODS ||
                        "One Cup English 프리미엄 멤버십"}
                    </span>
                  </div>
                  <div className={detailRowClass}>
                    <span className={detailLabelClass}>구독 금액</span>
                    <span className={detailValueClass}>
                      ₩
                      {paymentResult.data.PCD_PAY_TOTAL
                        ? Number(
                            paymentResult.data.PCD_PAY_TOTAL
                          ).toLocaleString()
                        : "4,700"}
                      /월
                    </span>
                  </div>
                  <div className={detailRowClass}>
                    <span className={detailLabelClass}>다음 결제일</span>
                    <span className={detailValueClass}>
                      {new Date(
                        new Date().setMonth(new Date().getMonth() + 1)
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}

              <button className={actionButtonPrimaryClass} onClick={handleContinue}>
                프로필로 이동
              </button>
            </>
          ) : (
            <>
              <h1 className={titleClass}>구독 등록 실패</h1>
              <p className={subtitleClass}>
                {paymentResult?.message || "결제 처리 중 오류가 발생했습니다"}
              </p>

              <div className="bg-[#fee2e2] border-2 border-[#050505] rounded-[12px] p-6 my-8 text-left shadow-[4px_4px_0_rgba(5,5,5,0.9)] max-[768px]:p-4">
                <h3 className="text-[1rem] font-[900] text-[#050505] mb-4">
                  문제 해결 방법
                </h3>
                <p className={errorTextClass}>• 카드 정보를 다시 확인해 주세요</p>
                <p className={errorTextClass}>• 결제 한도를 확인해 주세요</p>
                <p className={errorTextClass}>• 다른 카드로 시도해 보세요</p>
                <p className={errorTextClass}>
                  • 문제가 지속되면 고객센터로 문의해 주세요
                </p>
                {errorCode && (
                  <p
                    className={errorTextClass}
                    style={{ marginTop: "1rem", fontWeight: 600 }}
                  >
                    오류 코드: {errorCode}
                  </p>
                )}
              </div>

              <button className={actionButtonPrimaryClass} onClick={handleRetry}>
                다시 시도하기
              </button>
              <button className={actionButtonSecondaryClass} onClick={handleContinue}>
                홈으로 돌아가기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
