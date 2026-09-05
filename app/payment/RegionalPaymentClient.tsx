"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styled from "styled-components";

import { useAuth } from "../lib/contexts/auth_context";
import { invokeFunction, supabase } from "../lib/supabase/client";

const PAYPLE_HOST = (process.env.NEXT_PUBLIC_PAYPLE_HOST || "https://cpay.payple.kr").replace(/\/+$/, "");
const PAYPLE_SDK_SRC = `${PAYPLE_HOST}/js/v1/payment.js`;

type Region = "anam" | "yeouido";
type ProductId = "membership_30d" | "participation_pack_5";

type PaymentProduct = {
  id: ProductId;
  region: Region;
  displayName: string;
  price: number;
  referralPrice: number;
  referralDiscountAmount: number;
  recurring: boolean;
  credits?: number;
  validityDays?: number;
};

type QuoteResult = {
  success: boolean;
  validReferral: boolean;
  listAmount: number;
  discountAmount: number;
  finalAmount: number;
  message: string;
};

declare global {
  interface Window {
    PaypleCpayAuthCheck?: (paymentParams: Record<string, unknown>) => void;
    $?: unknown;
    PaypleCpayCallback?: Array<(response: Record<string, any>) => boolean>;
  }
}

const Page = styled.main`
  min-height: calc(100vh - 72px);
  display: grid;
  place-items: start center;
  padding: 40px 16px 72px;
`;

const Card = styled.section`
  width: min(100%, 780px);
  border: 2px solid #111;
  border-radius: 18px;
  background: #fff;
  box-shadow: 5px 5px 0 #111;
  overflow: hidden;
`;

const Header = styled.header`
  padding: 22px;
  border-bottom: 2px solid #111;
`;

const Title = styled.h1`
  margin: 0;
  font-size: clamp(1.45rem, 4vw, 2rem);
  font-weight: 950;
`;

const Subtitle = styled.p`
  margin: 7px 0 0;
  color: #626262;
  font-size: 0.9rem;
  line-height: 1.5;
`;

const Body = styled.div`
  padding: 22px;
  display: grid;
  gap: 22px;
`;

const Section = styled.section`
  display: grid;
  gap: 10px;
`;

const Label = styled.div`
  font-size: 0.82rem;
  font-weight: 900;
  color: #333;
`;

const ChoiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const Choice = styled.button<{ $selected: boolean }>`
  border: 2px solid #111;
  border-radius: 13px;
  background: ${(p) => (p.$selected ? "#fff0e8" : "#fff")};
  padding: 14px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  box-shadow: ${(p) => (p.$selected ? "3px 3px 0 #f47a4a" : "none")};

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const ChoiceTitle = styled.div`
  font-weight: 950;
`;

const ChoiceMeta = styled.div`
  margin-top: 4px;
  color: #666;
  font-size: 0.78rem;
  line-height: 1.45;
`;

const PriceBox = styled.div`
  border: 2px solid #111;
  border-radius: 14px;
  padding: 17px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: #fafafa;
`;

const Price = styled.div`
  font-size: clamp(1.45rem, 5vw, 2rem);
  font-weight: 950;
  white-space: nowrap;
`;

const PriceMeta = styled.div`
  color: #666;
  font-size: 0.8rem;
  text-align: right;
  line-height: 1.45;
`;

const ReferralRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
`;

const Input = styled.input`
  min-width: 0;
  border: 2px solid #111;
  border-radius: 12px;
  padding: 12px 13px;
  font: inherit;
`;

const SmallButton = styled.button`
  border: 2px solid #111;
  border-radius: 999px;
  background: #fff;
  padding: 0 16px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const Message = styled.div<{ $error?: boolean }>`
  color: ${(p) => (p.$error ? "#b42318" : "#16794f")};
  font-size: 0.8rem;
  font-weight: 750;
`;

const Policy = styled.div`
  border-top: 1px solid #ddd;
  padding-top: 16px;
  color: #616161;
  font-size: 0.78rem;
  line-height: 1.6;

  p { margin: 4px 0; }
  strong { color: #222; }
`;

const PayButton = styled.button`
  width: 100%;
  border: 2px solid #111;
  border-radius: 999px;
  background: #f47a4a;
  color: #111;
  padding: 15px 18px;
  font: inherit;
  font-size: 1rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 4px 4px 0 #111;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const Loading = styled.div`
  padding: 80px 20px;
  text-align: center;
  font-weight: 800;
`;

export default function RegionalPaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [productId, setProductId] = useState<ProductId>("membership_30d");
  const [region, setRegion] = useState<Region>("anam");
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId && p.region === region),
    [products, productId, region],
  );
  const totalAmount = quote?.validReferral ? quote.finalAmount : selectedProduct?.price;

  const resetReferralApplication = () => {
    setAppliedReferralCode(null);
    setQuote(null);
    setMessage("");
  };

  useEffect(() => {
    const urlRegion = searchParams?.get("region");
    const urlProduct = searchParams?.get("product");
    const urlRef = searchParams?.get("ref")?.trim();
    if (urlRegion === "anam" || urlRegion === "yeouido") setRegion(urlRegion);
    if (urlProduct === "participation_pack_5") setProductId("participation_pack_5");
    if (urlRef) setReferralCode(urlRef);
    if (typeof window !== "undefined" && !urlRef) {
      const stored = sessionStorage.getItem("referralCodePrefill")?.trim();
      if (stored) setReferralCode(stored);
      sessionStorage.removeItem("referralCodePrefill");
    }
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const result = await invokeFunction<{ success: boolean; products: PaymentProduct[] }>("checkout", { action: "products" });
        setProducts(result.products || []);
        if (currentUser) {
          const { data } = await supabase
            .from("users")
            .select("has_active_subscription, location")
            .eq("uid", currentUser.uid)
            .maybeSingle();
          setAlreadySubscribed(Boolean(data?.has_active_subscription));
          const urlRegion = searchParams?.get("region");
          if (urlRegion !== "anam" && urlRegion !== "yeouido" && (data?.location === "anam" || data?.location === "yeouido")) {
            setRegion(data.location);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "상품 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.PaypleCpayCallback = window.PaypleCpayCallback || [];

    const callback = (response: Record<string, any>) => {
      const session = sessionStorage.getItem("paymentSessionInfo");
      if (!session) {
        window.location.href = "/payment/result";
        return true;
      }
      const parsed = JSON.parse(session) as { userId: string };
      void invokeFunction("checkout", {
        action: "verify",
        userId: parsed.userId,
        paymentParams: response,
      })
        .then((result) => sessionStorage.setItem("paymentVerificationResult", JSON.stringify(result)))
        .catch((err) => sessionStorage.setItem("paymentVerificationError", JSON.stringify({ message: err?.message || String(err) })))
        .finally(() => { window.location.href = "/payment/result"; });
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
      const existing = document.querySelector('script[src="https://code.jquery.com/jquery-3.6.0.min.js"]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", appendPayple, { once: true });
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

  const applyReferral = async () => {
    const code = referralCode.trim();
    if (!code || !selectedProduct) return;
    if (!currentUser) {
      sessionStorage.setItem("referralCodePrefill", code);
      localStorage.setItem("returnUrl", `/payment?region=${region}&product=${productId}&ref=${encodeURIComponent(code)}`);
      router.push("/auth");
      return;
    }

    setCheckingReferral(true);
    setError("");
    setMessage("");
    try {
      const result = await invokeFunction<QuoteResult>("checkout", {
        action: "quote",
        productId,
        region,
        referralCode: code,
      });
      setQuote(result);
      if (result.validReferral) {
        setAppliedReferralCode(code);
        setMessage(result.message);
      } else {
        setAppliedReferralCode(null);
        setMessage(result.message);
      }
    } catch (err) {
      setAppliedReferralCode(null);
      setQuote(null);
      setError(err instanceof Error ? err.message : "추천 코드를 확인하지 못했습니다.");
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
    if (!selectedProduct || totalAmount === undefined) return;
    if (productId === "membership_30d" && alreadySubscribed) {
      setError("기존 30일 이용권의 월 결제금액은 그대로 유지됩니다. 새 30일 이용권을 중복 구매할 수 없습니다.");
      return;
    }

    setProcessing(true);
    setError("");
    try {
      const paymentData = await invokeFunction<any>("checkout", {
        action: "window",
        userId: currentUser.uid,
        userEmail: currentUser.email || "",
        userName: currentUser.displayName || "사용자",
        productId,
        region,
        referralCode: appliedReferralCode || undefined,
      });
      if (!paymentData?.success) throw new Error(paymentData?.message || "결제 정보를 불러오지 못했습니다.");
      if (typeof window.PaypleCpayAuthCheck !== "function") throw new Error("결제 스크립트가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");

      sessionStorage.setItem("paymentSessionInfo", JSON.stringify({
        userId: currentUser.uid,
        productId,
        region,
        orderNumber: paymentData.orderNumber,
        timestamp: Date.now(),
      }));
      window.PaypleCpayAuthCheck(paymentData.paymentParams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제를 시작하지 못했습니다.");
      setProcessing(false);
    }
  };

  if (loading) return <Page><Card><Loading>결제 정보를 불러오는 중...</Loading></Card></Page>;

  const regionLabel = region === "yeouido" ? "여의도" : "안암";
  const isPack = productId === "participation_pack_5";
  const discount = quote?.validReferral ? quote.discountAmount : 0;

  return (
    <Page>
      <Card>
        <Header>
          <Title>영어 한잔 이용권</Title>
          <Subtitle>지역과 이용 방식을 고르세요. 기존 정기구독 회원의 월 결제금액은 변경되지 않습니다.</Subtitle>
        </Header>

        <Body>
          <Section>
            <Label>1. 지역</Label>
            <ChoiceGrid>
              <Choice $selected={region === "anam"} onClick={() => { setRegion("anam"); resetReferralApplication(); }}>
                <ChoiceTitle>안암</ChoiceTitle>
                <ChoiceMeta>30일 9,700원 · 5회 14,700원</ChoiceMeta>
              </Choice>
              <Choice $selected={region === "yeouido"} onClick={() => { setRegion("yeouido"); resetReferralApplication(); }}>
                <ChoiceTitle>여의도</ChoiceTitle>
                <ChoiceMeta>30일 19,700원 · 5회 29,700원</ChoiceMeta>
              </Choice>
            </ChoiceGrid>
          </Section>

          <Section>
            <Label>2. 이용 방식</Label>
            <ChoiceGrid>
              <Choice
                $selected={productId === "membership_30d"}
                disabled={alreadySubscribed}
                onClick={() => { setProductId("membership_30d"); resetReferralApplication(); }}
              >
                <ChoiceTitle>30일 이용권 {alreadySubscribed ? "(현재 이용 중)" : ""}</ChoiceTitle>
                <ChoiceMeta>30일마다 자동 결제 · 선택한 지역 밋업 이용</ChoiceMeta>
              </Choice>
              <Choice
                $selected={productId === "participation_pack_5"}
                onClick={() => { setProductId("participation_pack_5"); resetReferralApplication(); }}
              >
                <ChoiceTitle>5회 이용권</ChoiceTitle>
                <ChoiceMeta>1회 결제 · 180일 유효 · 선택한 지역 밋업 5회</ChoiceMeta>
              </Choice>
            </ChoiceGrid>
          </Section>

          <PriceBox>
            <div>
              <Label>{regionLabel} · {isPack ? "5회 이용권" : "30일 이용권"}</Label>
              {discount > 0 ? <Message>추천 할인 -{discount.toLocaleString()}원</Message> : null}
            </div>
            <div>
              <Price>{totalAmount === undefined ? "-" : `${totalAmount.toLocaleString()}원`}</Price>
              <PriceMeta>{isPack ? "한 번만 결제" : "30일마다 동일 금액 자동결제"}</PriceMeta>
            </div>
          </PriceBox>

          <Section>
            <Label>3. 추천 코드 <span style={{ color: "#888", fontWeight: 700 }}>(선택 · 첫 유료 구매 1회)</span></Label>
            <ReferralRow>
              <Input
                value={referralCode}
                placeholder="추천 코드 입력"
                onChange={(e) => { setReferralCode(e.target.value); resetReferralApplication(); }}
              />
              <SmallButton disabled={!referralCode.trim() || checkingReferral} onClick={applyReferral}>
                {checkingReferral ? "확인 중" : "적용"}
              </SmallButton>
            </ReferralRow>
            {message ? <Message $error={Boolean(quote && !quote.validReferral)}>{message}</Message> : null}
            <ChoiceMeta>
              표준 첫 구매 할인: 30일 이용권 3,200원 할인 · 5회 이용권 3,000원 할인.
              적용된 30일 이용권 가격은 해당 구독이 계속 유지되는 동안 다음 결제에도 그대로 적용됩니다.
            </ChoiceMeta>
          </Section>

          <Policy>
            {!isPack ? (
              <>
                <p><strong>30일 이용권 환불</strong> · 결제 후 7일 이내 전액 환불, 이후에는 실제 결제금액을 기준으로 남은 기간을 일할 계산해 환불합니다.</p>
                <p><strong>기존 회원</strong> · 현재 활성 구독의 월 결제금액은 지역별 신규 가격과 관계없이 그대로 유지됩니다. 구독이 종료된 뒤 새로 가입하면 신규 가격이 적용됩니다.</p>
              </>
            ) : (
              <>
                <p><strong>5회 이용권 환불</strong> · 유효기간 내 실제 결제금액 × 남은 횟수 ÷ 5로 환불합니다. 예: 14,700원 결제 후 2회 사용 → 8,820원 환불.</p>
                <p><strong>밋업 취소</strong> · 시작 24시간 전까지 취소하면 사용한 1회가 반환됩니다. 유효기간이 지난 이용권은 환불되지 않습니다.</p>
              </>
            )}
          </Policy>

          {error ? <Message $error>{error}</Message> : null}
          <PayButton
            disabled={processing || !selectedProduct || totalAmount === undefined || (productId === "membership_30d" && alreadySubscribed)}
            onClick={handlePayment}
          >
            {processing
              ? "결제 준비 중..."
              : productId === "membership_30d" && alreadySubscribed
                ? "기존 구독 이용 중"
                : totalAmount === undefined
                  ? "상품 확인 중..."
                  : `${totalAmount.toLocaleString()}원 결제하기`}
          </PayButton>
        </Body>
      </Card>
    </Page>
  );
}
