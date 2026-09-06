"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "../lib/contexts/auth_context";
import { invokeFunction, supabase } from "../lib/supabase/client";

const PAYPLE_HOST = (process.env.NEXT_PUBLIC_PAYPLE_HOST || "https://cpay.payple.kr").replace(/\/+$/, "");
const PAYPLE_SDK_SRC = `${PAYPLE_HOST}/js/v1/payment.js`;
const BASE_PRICE = 9700;

type Region = "yeouido" | "anam";
type ProductId = "membership_30d" | "participation_pack_5";
type PaymentProduct = {
  id: ProductId;
  price: number;
  credits?: number;
  validityDays?: number;
  recurring: boolean;
};

declare global {
  interface Window {
    PaypleCpayAuthCheck?: (paymentParams: Record<string, unknown>) => void;
    $?: unknown;
    PaypleCpayCallback?: Array<(response: Record<string, any>) => boolean>;
  }
}

// Shared class strings (styled-components migration).
const pageClass =
  "min-h-[calc(100vh-72px)] grid place-items-center bg-transparent p-4";

const titleClass = "m-0 text-[clamp(1.35rem,3vw,1.8rem)] font-[950]";

const mutedClass = "text-[rgba(5,5,5,0.56)] text-[0.78rem] font-bold";

const labelClass = "mb-[0.55rem] text-[0.84rem] font-[900]";

const productDescriptionClass =
  "mt-[0.3rem] text-[rgba(5,5,5,0.64)] text-[0.78rem] font-bold leading-[1.4]";

const regionButtonBaseClass =
  "border-2 border-[#050505] rounded-[12px] text-[#050505] py-[0.8rem] px-[0.65rem] font-[900] cursor-pointer";

const benefitClass =
  "border-[1.5px] border-[#050505] rounded-[10px] py-[0.62rem] px-[0.7rem] text-[0.78rem] font-[750] leading-[1.35]";

const payButtonClass =
  "min-w-[250px] border-2 border-[#050505] rounded-full bg-[#f47a4a] py-[0.9rem] px-[1.35rem] text-[#050505] text-[1rem] font-[950] cursor-pointer shadow-[4px_4px_0_#050505] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none max-[620px]:w-full max-[620px]:min-w-0";

const stateCardClass =
  "w-[min(100%,620px)] border-[3px] border-[#050505] rounded-[16px] bg-white p-6 text-center shadow-[5px_5px_0_#050505]";

function Message({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <p
      className={`mx-0 mb-0 mt-[0.42rem] text-[0.78rem] font-[750] ${
        error ? "text-[#b42318]" : "text-[#16794f]"
      }`}
    >
      {children}
    </p>
  );
}

function normalizeReferralPrice(discount: number, type: string) {
  const rawDiscount = type === "percent" ? BASE_PRICE * (discount / 100) : discount;
  const roundedDiscount = Math.floor(rawDiscount / 10) * 10;
  return Math.ceil(Math.max(0, BASE_PRICE - roundedDiscount) / 10) * 10;
}

export default function CompactPaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [productId, setProductId] = useState<ProductId>("membership_30d");
  const [region, setRegion] = useState<Region>("yeouido");
  const [referralCode, setReferralCode] = useState("");
  const [referralPrice, setReferralPrice] = useState<number | null>(null);
  const [referralMessage, setReferralMessage] = useState("");
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const selectedProduct = products.find((product) => product.id === productId);
  const membershipProduct = products.find((product) => product.id === "membership_30d");
  const membershipPrice = membershipProduct?.price ?? BASE_PRICE;
  const totalAmount = productId === "membership_30d"
    ? referralPrice ?? membershipPrice
    : selectedProduct?.price;
  const discounted = productId === "membership_30d" && totalAmount !== undefined && totalAmount < membershipPrice;

  useEffect(() => {
    void (async () => {
      try {
        const [productResult, userResult] = await Promise.all([
          invokeFunction<{ success: boolean; products: PaymentProduct[] }>("payment", { action: "products" }),
          currentUser
            ? supabase
                .from("users")
                .select("has_active_subscription")
                .eq("uid", currentUser.uid)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        setProducts(productResult.products || []);
        setAlreadySubscribed(Boolean(userResult.data?.has_active_subscription));
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  useEffect(() => {
    const urlRef = searchParams?.get("ref")?.trim();
    const urlRegion = searchParams?.get("region");
    const urlProduct = searchParams?.get("product");
    if (urlRef) setReferralCode(urlRef);
    if (urlRegion === "yeouido" || urlRegion === "anam") setRegion(urlRegion);
    if (urlProduct === "participation_pack_5") setProductId(urlProduct);

    if (typeof window !== "undefined") {
      const storedRef = sessionStorage.getItem("referralCodePrefill")?.trim();
      if (!urlRef && storedRef) setReferralCode(storedRef);
      if (storedRef) sessionStorage.removeItem("referralCodePrefill");
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.PaypleCpayCallback = window.PaypleCpayCallback || [];
    const callback = (response: Record<string, any>) => {
      const sessionInfo = sessionStorage.getItem("paymentSessionInfo");
      if (!sessionInfo) {
        window.location.href = "/payment/result";
        return true;
      }

      const parsed = JSON.parse(sessionInfo) as { userId: string };
      void invokeFunction("payment", {
        action: "verify",
        userId: parsed.userId,
        paymentParams: response,
        timestamp: Date.now(),
      })
        .then((result) => sessionStorage.setItem("paymentVerificationResult", JSON.stringify(result)))
        .catch((err) => sessionStorage.setItem("paymentVerificationError", JSON.stringify({ message: err?.message || String(err) })))
        .finally(() => {
          window.location.href = "/payment/result";
        });
      return true;
    };

    window.PaypleCpayCallback.push(callback);

    const appendPayple = () => {
      if (document.querySelector(`script[src="${PAYPLE_SDK_SRC}"]`)) return;
      const script = document.createElement("script");
      script.src = PAYPLE_SDK_SRC;
      script.async = true;
      document.body.appendChild(script);
    };

    if (!window.$) {
      const existingJquery = document.querySelector('script[src="https://code.jquery.com/jquery-3.6.0.min.js"]') as HTMLScriptElement | null;
      if (existingJquery) {
        existingJquery.addEventListener("load", appendPayple, { once: true });
      } else {
        const jquery = document.createElement("script");
        jquery.src = "https://code.jquery.com/jquery-3.6.0.min.js";
        jquery.async = true;
        jquery.onload = appendPayple;
        document.body.appendChild(jquery);
      }
    } else {
      appendPayple();
    }

    return () => {
      window.PaypleCpayCallback = (window.PaypleCpayCallback || []).filter((item) => item !== callback);
    };
  }, []);

  const checkReferral = async () => {
    if (productId !== "membership_30d") return;
    const code = referralCode.trim();
    if (!code) return;

    if (!currentUser) {
      setReferralPrice(null);
      setReferralMessage("로그인 후 추천 코드를 확인할 수 있습니다.");
      return;
    }

    setCheckingReferral(true);
    setReferralMessage("");
    setReferralPrice(null);

    try {
      const { data, error: referralError } = await supabase.rpc(
        "check_referral_code_for_current_user",
        { p_code: code },
      );
      if (referralError) throw referralError;

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.valid) {
        setReferralMessage(result?.message || "유효하지 않은 코드입니다.");
        return;
      }

      const price = normalizeReferralPrice(
        Number(result.discount || 0),
        String(result.discount_type || "fixed_price"),
      );
      setReferralPrice(price);
      setReferralMessage(result.message || "추천 코드가 적용되었습니다.");
    } catch {
      setReferralMessage("코드 확인 중 오류가 발생했습니다.");
    } finally {
      setCheckingReferral(false);
    }
  };

  const handlePayment = async () => {
    if (!currentUser) {
      localStorage.setItem("returnUrl", `/payment?region=${region}&product=${productId}`);
      if (referralCode.trim()) sessionStorage.setItem("referralCodePrefill", referralCode.trim());
      router.push("/auth");
      return;
    }

    if (!selectedProduct || totalAmount === undefined) {
      setError("상품 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (productId === "membership_30d" && alreadySubscribed) {
      setError("이미 이용 중인 멤버십은 다시 구매할 수 없습니다. 참여권은 별도로 구매할 수 있습니다.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const paymentData = (await invokeFunction("payment", {
        action: "window",
        userId: currentUser.uid,
        userEmail: currentUser.email || "",
        userName: currentUser.displayName || "사용자",
        userPhone: currentUser.phoneNumber || "",
        productId,
        selected_categories: productId === "membership_30d"
          ? {
              meetup: true,
              region,
              yeouido: region === "yeouido",
              anam: region === "anam",
            }
          : {},
        referralCode: productId === "membership_30d" && discounted ? referralCode.trim() : undefined,
      })) as any;

      if (!paymentData?.success) throw new Error(paymentData?.message || "결제 정보를 불러오지 못했습니다.");
      if (typeof window.PaypleCpayAuthCheck !== "function") throw new Error("결제 스크립트가 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.");

      sessionStorage.setItem(
        "paymentSessionInfo",
        JSON.stringify({ userId: currentUser.uid, productId, region, timestamp: Date.now() }),
      );
      window.PaypleCpayAuthCheck(paymentData.paymentParams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제 초기화 중 오류가 발생했습니다.");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className={pageClass}>
        <div className={stateCardClass}>결제 정보를 불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className={pageClass}>
      <section className="w-[min(100%,860px)] border-[3px] border-[#050505] rounded-[18px] bg-white shadow-[6px_6px_0_#050505] p-[1.3rem] max-[720px]:p-4 max-[720px]:shadow-[4px_4px_0_#050505]">
        <div className="flex items-end justify-between gap-4 border-b-2 border-[#050505] pb-[0.9rem] max-[620px]:flex-col max-[620px]:items-start max-[620px]:gap-[0.4rem]">
          <div>
            <h1 className={titleClass}>영어 한잔 이용권</h1>
            <span className={mutedClass}>30일 멤버십과 회차 참여권은 서로 다른 이용권입니다.</span>
          </div>
          <div className="text-[clamp(1.2rem,3vw,1.65rem)] font-[950] whitespace-nowrap">
            {totalAmount === undefined ? "상품 확인 중" : `${totalAmount.toLocaleString()}원`}
            {productId === "membership_30d" ? <span className={mutedClass}> / 30일</span> : null}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 mt-4 max-[620px]:grid-cols-1">
          <button
            className={`border-2 border-[#050505] rounded-[12px] text-[#050505] p-[0.9rem] text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-[0.52] disabled:shadow-none ${
              productId === "membership_30d" ? "bg-[#fff0e8] shadow-[3px_3px_0_#f47a4a]" : "bg-white shadow-none"
            }`}
            type="button"
            disabled={alreadySubscribed}
            onClick={() => setProductId("membership_30d")}
          >
            <div className="font-[950] text-[0.98rem]">30일 멤버십 {alreadySubscribed ? "(이용 중)" : ""}</div>
            <div className={productDescriptionClass}>30일마다 자동 결제 · 멤버십 전용 기능 및 밋업 신청</div>
          </button>
          <button
            className={`border-2 border-[#050505] rounded-[12px] text-[#050505] p-[0.9rem] text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-[0.52] disabled:shadow-none ${
              productId === "participation_pack_5" ? "bg-[#fff0e8] shadow-[3px_3px_0_#f47a4a]" : "bg-white shadow-none"
            }`}
            type="button"
            onClick={() => {
              setProductId("participation_pack_5");
              setReferralPrice(null);
              setReferralMessage("");
            }}
          >
            <div className="font-[950] text-[0.98rem]">{selectedProduct?.credits ?? 5}회 참여권</div>
            <div className={productDescriptionClass}>1회 결제 · 자동 결제 없음 · 밋업 신청 시 1회 사용</div>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 max-[720px]:grid-cols-1">
          {productId === "membership_30d" ? (
            <>
              <div className="min-w-0">
                <div className={labelClass}>참여 지역</div>
                <div className="grid grid-cols-2 gap-[0.55rem]">
                  <button
                    className={`${regionButtonBaseClass} ${
                      region === "yeouido" ? "bg-[#f47a4a] shadow-[2px_2px_0_#050505]" : "bg-white shadow-none"
                    }`}
                    type="button"
                    onClick={() => setRegion("yeouido")}
                  >
                    여의도
                  </button>
                  <button
                    className={`${regionButtonBaseClass} ${
                      region === "anam" ? "bg-[#f47a4a] shadow-[2px_2px_0_#050505]" : "bg-white shadow-none"
                    }`}
                    type="button"
                    onClick={() => setRegion("anam")}
                  >
                    안암
                  </button>
                </div>
              </div>

              <div className="min-w-0">
                <div className={labelClass}>지인 추천 코드 <span className={mutedClass}>(선택)</span></div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className="w-full min-w-0 border-2 border-[#050505] rounded-[12px] py-[0.75rem] px-[0.8rem] focus:outline-none focus:shadow-[2px_2px_0_#f47a4a]"
                    value={referralCode}
                    placeholder="추천 코드를 입력하세요"
                    onChange={(e) => {
                      setReferralCode(e.target.value);
                      setReferralPrice(null);
                      setReferralMessage("");
                    }}
                  />
                  <button
                    className="border-2 border-[#050505] rounded-full bg-white py-0 px-4 text-[0.84rem] font-[900] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    type="button"
                    onClick={checkReferral}
                    disabled={!referralCode.trim() || checkingReferral}
                  >
                    {checkingReferral ? "확인 중" : "확인"}
                  </button>
                </div>
                {referralMessage ? <Message error={!discounted}>{referralMessage}</Message> : null}
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <div className={labelClass}>회차 참여권 안내</div>
              <div className={productDescriptionClass}>
                {selectedProduct?.credits ?? 5}회는 밋업 참가 신청을 완료할 때 1회씩 사용됩니다. 멤버십 상태나 멤버십 전용 기능은 변경되지 않으며, 구매일부터 {selectedProduct?.validityDays ?? 180}일 동안 사용할 수 있습니다.
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-[0.55rem] mt-4 max-[620px]:grid-cols-1">
          <div className={benefitClass}>{productId === "membership_30d" ? "✓ 멤버십 기간 동안 밋업 신청" : "✓ 밋업 신청 5회에 사용할 수 있는 회차형 이용권"}</div>
          <div className={benefitClass}>{productId === "membership_30d" ? "✓ 멤버십 전용 영어 학습 기능" : "✓ 자동 결제 없이 1회만 결제"}</div>
          <div className={benefitClass}>{productId === "membership_30d" ? "✓ 30일마다 자동 결제, 언제든 다음 결제 중단" : "✓ 구매일부터 180일간 사용"}</div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-end mt-4 border-t-2 border-[#050505] pt-4 max-[720px]:grid-cols-1">
          <div className="grid gap-[0.55rem] text-[rgba(5,5,5,0.65)] text-[0.76rem] leading-[1.45] [&_p]:m-0 [&_strong]:text-[#050505] [&_strong]:font-[850] [&_a]:text-[#f47a4a] [&_a]:font-[850] [&_a]:underline">
            <div className="text-[#050505] text-[0.82rem] font-[950]">결제 및 환불 정책</div>
            {productId === "membership_30d" ? (
              <>
                <p><strong>자동 결제</strong> · 30일마다 자동으로 결제됩니다. 재결제 시 알림톡을 드리며 언제든지 취소할 수 있습니다.</p>
                <p><strong>7일 체험 기간 및 환불 정책</strong> · 결제일로부터 <strong>7일 이내 전액 환불</strong>이 가능합니다. 7일 이후에는 사용하지 않은 기간에 대해 일할 계산으로 환불됩니다.</p>
              </>
            ) : (
              <>
                <p><strong>자동 결제 없음</strong> · 참여권은 한 번만 결제되며 멤버십을 시작하거나 갱신하지 않습니다.</p>
                <p><strong>밋업 취소</strong> · 밋업 시작 24시간 전까지 취소하면 사용한 참여권 1회가 반환됩니다. 상세 환불 정책은 아래 링크에서 확인하세요.</p>
              </>
            )}
            <p><strong>이용권 관리</strong> · <a href="/profile" onClick={(e) => { e.preventDefault(); router.push("/profile"); }}>프로필 페이지</a>에서 멤버십과 참여권을 확인할 수 있습니다.</p>
            {error ? <Message error>{error}</Message> : null}
          </div>
          <button className={payButtonClass} type="button" onClick={handlePayment} disabled={processing || totalAmount === undefined || (productId === "membership_30d" && alreadySubscribed)}>
            {processing
              ? "결제 준비 중..."
              : productId === "membership_30d" && alreadySubscribed
                ? "멤버십 이용 중"
                : totalAmount === undefined
                  ? "상품 확인 중..."
                  : productId === "membership_30d"
                    ? `${totalAmount.toLocaleString()}원으로 시작하기`
                    : `${totalAmount.toLocaleString()}원으로 참여권 구매`}
          </button>
        </div>
      </section>
    </main>
  );
}
