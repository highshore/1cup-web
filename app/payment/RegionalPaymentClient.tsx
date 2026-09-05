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
  place-items: center;
  background: transparent;
  padding: 1rem;
`;

const Card = styled.section`
  width: min(100%, 860px);
  border: 3px solid #050505;
  border-radius: 18px;
  background: #fff;
  box-shadow: 6px 6px 0 #050505;
  padding: 1.3rem;

  @media (max-width: 720px) {
    padding: 1rem;
    box-shadow: 4px 4px 0 #050505;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 2px solid #050505;
  padding-bottom: 0.9rem;

  @media (max-width: 620px) {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.4rem;
  }
`;

const Title = styled.h1`
  margin: 0;
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  font-weight: 950;
`;

const Price = styled.div`
  font-size: clamp(1.2rem, 3vw, 1.65rem);
  font-weight: 950;
  white-space: nowrap;
`;

const Muted = styled.span`
  color: rgba(5, 5, 5, 0.56);
  font-size: 0.78rem;
  font-weight: 700;
`;

const Step = styled.div`
  margin-top: 1rem;
`;

const StepTitle = styled.div`
  margin-bottom: 0.55rem;
  font-size: 0.84rem;
  font-weight: 950;
`;

const RegionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const RegionButton = styled.button<{ $selected: boolean }>`
  border: 2px solid #050505;
  border-radius: 12px;
  background: ${(p) => (p.$selected ? "#f47a4a" : "#fff")};
  color: #050505;
  padding: 0.9rem 0.75rem;
  font: inherit;
  font-weight: 950;
  cursor: pointer;
  box-shadow: ${(p) => (p.$selected ? "2px 2px 0 #050505" : "none")};
`;

const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const ProductButton = styled.button<{ $selected: boolean; disabled?: boolean }>`
  border: 2px solid #050505;
  border-radius: 12px;
  background: ${(p) => (p.$selected ? "#fff0e8" : "#fff")};
  color: #050505;
  padding: 0.9rem;
  text-align: left;
  font: inherit;
  cursor: pointer;
  box-shadow: ${(p) => (p.$selected ? "3px 3px 0 #f47a4a" : "none")};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.52;
    box-shadow: none;
  }
`;

const ProductName = styled.div`
  font-weight: 950;
  font-size: 0.98rem;
`;

const ProductDescription = styled.div`
  margin-top: 0.3rem;
  color: rgba(5, 5, 5, 0.64);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.45;
`;

const PricePanel = styled.div`
  margin-top: 1rem;
  border: 2px solid #050505;
  border-radius: 14px;
  padding: 0.95rem 1rem;
  background: #fafafa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;

  @media (max-width: 560px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const PriceLabel = styled.div`
  font-size: 0.84rem;
  font-weight: 950;
`;

const PriceValue = styled.div`
  font-size: clamp(1.35rem, 4vw, 1.8rem);
  font-weight: 950;
  white-space: nowrap;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Section = styled.div`
  min-width: 0;
`;

const Label = styled.div`
  margin-bottom: 0.55rem;
  font-size: 0.84rem;
  font-weight: 900;
`;

const InputRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  min-width: 0;
  border: 2px solid #050505;
  border-radius: 12px;
  padding: 0.75rem 0.8rem;
  font: inherit;

  &:focus {
    outline: none;
    box-shadow: 2px 2px 0 #f47a4a;
  }
`;

const SmallButton = styled.button`
  border: 2px solid #050505;
  border-radius: 999px;
  background: #fff;
  padding: 0 1rem;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 900;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const Message = styled.p<{ $error?: boolean }>`
  margin: 0.42rem 0 0;
  color: ${(p) => (p.$error ? "#b42318" : "#16794f")};
  font-size: 0.78rem;
  font-weight: 750;
`;

const BenefitRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 1rem;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const Benefit = styled.div`
  border: 1.5px solid #050505;
  border-radius: 10px;
  padding: 0.62rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 750;
  line-height: 1.35;
`;

const Footer = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: end;
  margin-top: 1rem;
  border-top: 2px solid #050505;
  padding-top: 1rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const PolicyGroup = styled.div`
  display: grid;
  gap: 0.55rem;
  color: rgba(5, 5, 5, 0.65);
  font-size: 0.76rem;
  line-height: 1.5;

  p {
    margin: 0;
  }

  strong {
    color: #050505;
    font-weight: 850;
  }

  a {
    color: #f47a4a;
    font-weight: 850;
    text-decoration: underline;
  }
`;

const PolicyTitle = styled.div`
  color: #050505;
  font-size: 0.82rem;
  font-weight: 950;
`;

const PayButton = styled.button`
  min-width: 250px;
  border: 2px solid #050505;
  border-radius: 999px;
  background: #f47a4a;
  padding: 0.9rem 1.35rem;
  color: #050505;
  font: inherit;
  font-size: 1rem;
  font-weight: 950;
  cursor: pointer;
  box-shadow: 4px 4px 0 #050505;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  @media (max-width: 620px) {
    width: 100%;
    min-width: 0;
  }
`;

const StateCard = styled.div`
  width: min(100%, 620px);
  border: 3px solid #050505;
  border-radius: 16px;
  background: #fff;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 5px 5px 0 #050505;
`;

export default function RegionalPaymentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [productId, setProductId] = useState<ProductId | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = useMemo(
    () => region && productId
      ? products.find((p) => p.id === productId && p.region === region)
      : undefined,
    [products, productId, region],
  );
  const totalAmount = quote?.validReferral ? quote.finalAmount : selectedProduct?.price;

  const resetReferralApplication = () => {
    setAppliedReferralCode(null);
    setQuote(null);
    setMessage("");
    setError("");
  };

  useEffect(() => {
    const urlRef = searchParams?.get("ref")?.trim();
    const shouldResume = searchParams?.get("resume") === "1";
    const urlRegion = searchParams?.get("region");
    const urlProduct = searchParams?.get("product");

    if (urlRef) setReferralCode(urlRef);
    if (shouldResume) {
      if (urlRegion === "anam" || urlRegion === "yeouido") setRegion(urlRegion);
      if (urlProduct === "membership_30d" || urlProduct === "participation_pack_5") setProductId(urlProduct);
    }

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
            .select("has_active_subscription")
            .eq("uid", currentUser.uid)
            .maybeSingle();
          setAlreadySubscribed(Boolean(data?.has_active_subscription));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "상품 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

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
    if (!code || !selectedProduct || !region || !productId) return;

    if (!currentUser) {
      sessionStorage.setItem("referralCodePrefill", code);
      localStorage.setItem(
        "returnUrl",
        `/payment?resume=1&region=${region}&product=${productId}&ref=${encodeURIComponent(code)}`,
      );
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
    if (!region || !productId) return;

    if (!currentUser) {
      localStorage.setItem("returnUrl", `/payment?resume=1&region=${region}&product=${productId}`);
      if (referralCode.trim()) sessionStorage.setItem("referralCodePrefill", referralCode.trim());
      router.push("/auth");
      return;
    }
    if (!selectedProduct || totalAmount === undefined) {
      setError("상품 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (productId === "membership_30d" && alreadySubscribed) {
      setError("기존 30일 이용권의 결제금액은 그대로 유지됩니다. 새 30일 이용권을 중복 구매할 수 없습니다.");
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
      if (typeof window.PaypleCpayAuthCheck !== "function") {
        throw new Error("결제 스크립트가 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      }

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

  if (loading) {
    return <Page><StateCard>결제 정보를 불러오는 중...</StateCard></Page>;
  }

  const regionLabel = region === "yeouido" ? "여의도" : region === "anam" ? "안암" : "";
  const isPack = productId === "participation_pack_5";
  const discount = quote?.validReferral ? quote.discountAmount : 0;

  return (
    <Page>
      <Card>
        <Header>
          <div>
            <Title>영어 한잔 이용권</Title>
            <Muted>지역을 먼저 고른 뒤 이용 방식을 선택하면 가격과 상세 조건을 확인할 수 있습니다.</Muted>
          </div>
          {region && productId && totalAmount !== undefined ? (
            <Price>
              {totalAmount.toLocaleString()}원
              {!isPack ? <Muted> / 30일</Muted> : null}
            </Price>
          ) : (
            <Muted>가격은 이용권 선택 후 표시됩니다.</Muted>
          )}
        </Header>

        <Step>
          <StepTitle>1. 참여 지역을 선택하세요</StepTitle>
          <RegionGrid>
            <RegionButton
              type="button"
              $selected={region === "anam"}
              onClick={() => {
                setRegion("anam");
                setProductId(null);
                resetReferralApplication();
              }}
            >
              안암
            </RegionButton>
            <RegionButton
              type="button"
              $selected={region === "yeouido"}
              onClick={() => {
                setRegion("yeouido");
                setProductId(null);
                resetReferralApplication();
              }}
            >
              여의도
            </RegionButton>
          </RegionGrid>
        </Step>

        {region ? (
          <Step>
            <StepTitle>2. 이용 방식을 선택하세요</StepTitle>
            <ProductGrid>
              <ProductButton
                type="button"
                $selected={productId === "membership_30d"}
                disabled={alreadySubscribed}
                onClick={() => {
                  setProductId("membership_30d");
                  resetReferralApplication();
                }}
              >
                <ProductName>30일 멤버십 {alreadySubscribed ? "(이용 중)" : ""}</ProductName>
                <ProductDescription>30일마다 자동 결제 · 선택한 지역의 밋업 신청 · 멤버십 전용 기능</ProductDescription>
              </ProductButton>
              <ProductButton
                type="button"
                $selected={productId === "participation_pack_5"}
                onClick={() => {
                  setProductId("participation_pack_5");
                  resetReferralApplication();
                }}
              >
                <ProductName>5회 참여권</ProductName>
                <ProductDescription>한 번만 결제 · 자동 결제 없음 · 선택한 지역 밋업 신청 5회</ProductDescription>
              </ProductButton>
            </ProductGrid>
            {alreadySubscribed ? (
              <Message>현재 30일 멤버십을 이용 중입니다. 기존 결제금액은 그대로 유지되며 5회 참여권은 별도로 구매할 수 있습니다.</Message>
            ) : null}
          </Step>
        ) : null}

        {region && productId && selectedProduct && totalAmount !== undefined ? (
          <>
            <PricePanel>
              <div>
                <PriceLabel>3. {regionLabel} · {isPack ? "5회 참여권" : "30일 멤버십"}</PriceLabel>
                <ProductDescription>
                  {isPack
                    ? `구매일부터 ${selectedProduct.validityDays ?? 180}일 동안 사용`
                    : "30일마다 동일한 결제금액으로 자동 갱신"}
                </ProductDescription>
                {discount > 0 ? <Message>추천 할인 -{discount.toLocaleString()}원 적용</Message> : null}
              </div>
              <PriceValue>{totalAmount.toLocaleString()}원</PriceValue>
            </PricePanel>

            <Grid>
              <Section>
                <Label>지인 추천 코드 <Muted>(선택 · 첫 유료 구매 1회)</Muted></Label>
                <InputRow>
                  <Input
                    value={referralCode}
                    placeholder="추천 코드를 입력하세요"
                    onChange={(e) => {
                      setReferralCode(e.target.value);
                      resetReferralApplication();
                    }}
                  />
                  <SmallButton type="button" onClick={applyReferral} disabled={!referralCode.trim() || checkingReferral}>
                    {checkingReferral ? "확인 중" : "확인"}
                  </SmallButton>
                </InputRow>
                {message ? <Message $error={Boolean(quote && !quote.validReferral)}>{message}</Message> : null}
              </Section>

              <Section>
                <Label>선택한 이용권</Label>
                <ProductDescription>
                  {isPack
                    ? `${regionLabel} 밋업 신청에 1회씩 사용되는 ${selectedProduct.credits ?? 5}회 참여권입니다. 멤버십 상태는 변경되지 않습니다.`
                    : `${regionLabel} 밋업을 이용하는 30일 멤버십입니다. 구독이 유지되는 동안 같은 결제금액으로 자동 갱신됩니다.`}
                </ProductDescription>
              </Section>
            </Grid>

            <BenefitRow>
              <Benefit>{isPack ? `✓ ${regionLabel} 밋업 신청 5회` : `✓ ${regionLabel} 밋업 신청`}</Benefit>
              <Benefit>{isPack ? "✓ 자동 결제 없이 1회만 결제" : "✓ 멤버십 전용 영어 학습 기능"}</Benefit>
              <Benefit>{isPack ? `✓ 구매일부터 ${selectedProduct.validityDays ?? 180}일간 사용` : "✓ 30일마다 자동 갱신 · 다음 결제 언제든 중단"}</Benefit>
            </BenefitRow>

            <Footer>
              <PolicyGroup>
                <PolicyTitle>결제 및 환불 정책</PolicyTitle>
                {!isPack ? (
                  <>
                    <p><strong>자동 결제</strong> · 결제일부터 30일 단위로 자동 갱신됩니다. 다음 결제를 중단하기 전까지 현재 실제 결제금액으로 30일마다 자동 결제되며, 재결제 시 알림톡을 발송합니다.</p>
                    <p><strong>이용 지역</strong> · 이번에 구매하는 신규 멤버십은 <strong>{regionLabel}</strong> 지역용입니다. 멤버십 기간 동안 선택한 지역의 밋업을 신청할 수 있습니다.</p>
                    <p><strong>추천 할인</strong> · 추천 코드는 첫 번째 성공한 유료 구매에 한 번만 사용할 수 있으며 본인 추천 코드는 사용할 수 없습니다. 추천 할인이 적용된 30일 멤버십은 구독이 중단되지 않는 동안 할인된 실제 결제금액으로 갱신됩니다.</p>
                    <p><strong>7일 환불</strong> · 최초 결제일로부터 <strong>7일 이내에는 전액 환불</strong>이 가능합니다. 7일 이후에는 실제 결제금액을 기준으로 사용하지 않은 남은 기간을 일할 계산해 환불합니다.</p>
                    <p><strong>기존 회원 가격 보호</strong> · 이미 활성화된 기존 정기구독 회원의 현재 결제금액은 신규 지역별 가격으로 변경되지 않습니다. 기존 구독을 종료한 뒤 새로 가입하면 그 시점의 신규 가격이 적용됩니다.</p>
                    <p><strong>구독 관리</strong> · <a href="/profile" onClick={(e) => { e.preventDefault(); router.push("/profile"); }}>프로필 페이지</a>에서 이용 상태를 확인하고 다음 자동 결제를 중단할 수 있습니다. 자세한 조건은 <a href="/policy/refund">환불정책</a>을 확인해 주세요.</p>
                  </>
                ) : (
                  <>
                    <p><strong>자동 결제 없음</strong> · 5회 참여권은 한 번만 결제되며 30일 멤버십을 시작하거나 갱신하지 않습니다.</p>
                    <p><strong>이용 지역 및 유효기간</strong> · 이번에 구매하는 참여권은 <strong>{regionLabel}</strong> 지역 밋업에만 사용할 수 있습니다. 총 {selectedProduct.credits ?? 5}회이며 구매일부터 {selectedProduct.validityDays ?? 180}일 동안 유효합니다. 밋업 참가 신청이 완료될 때 1회가 사용됩니다.</p>
                    <p><strong>밋업 취소</strong> · 밋업 시작 <strong>24시간 전까지</strong> 참가를 취소하면 해당 신청에 사용한 참여권 1회가 반환됩니다. 24시간 이내 취소에는 참여권이 반환되지 않습니다.</p>
                    <p><strong>남은 참여권 환불</strong> · 유효기간 내에는 <strong>실제 결제금액 × 남은 횟수 ÷ 5</strong>로 환불금액을 계산합니다. 추천 할인을 받았다면 할인 후 실제 결제금액을 기준으로 계산하며, 환불 완료 시 남은 참여권은 회수됩니다. 유효기간이 지난 참여권은 환불되지 않습니다.</p>
                    <p><strong>추천 할인</strong> · 추천 코드는 첫 번째 성공한 유료 구매에 한 번만 사용할 수 있으며 본인 추천 코드는 사용할 수 없습니다.</p>
                    <p><strong>참여권 관리 및 환불</strong> · <a href="/profile" onClick={(e) => { e.preventDefault(); router.push("/profile"); }}>프로필 페이지</a>에서 잔여 참여권을 확인할 수 있고, <a href="/payment/refunds">참여권 환불 페이지</a>에서 환불 가능한 구매 건과 예상 환불금액을 확인할 수 있습니다. 자세한 조건은 <a href="/policy/refund">환불정책</a>을 확인해 주세요.</p>
                  </>
                )}
                {error ? <Message $error>{error}</Message> : null}
              </PolicyGroup>

              <PayButton
                type="button"
                onClick={handlePayment}
                disabled={processing || (productId === "membership_30d" && alreadySubscribed)}
              >
                {processing
                  ? "결제 준비 중..."
                  : productId === "membership_30d" && alreadySubscribed
                    ? "멤버십 이용 중"
                    : isPack
                      ? `${totalAmount.toLocaleString()}원으로 참여권 구매`
                      : `${totalAmount.toLocaleString()}원으로 시작하기`}
              </PayButton>
            </Footer>
          </>
        ) : null}

        {!region && error ? <Message $error>{error}</Message> : null}
      </Card>
    </Page>
  );
}
