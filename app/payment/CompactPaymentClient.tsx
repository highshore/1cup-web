"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styled from "styled-components";

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

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;

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
  line-height: 1.4;
`;

const Section = styled.div`
  min-width: 0;
`;

const Label = styled.div`
  margin-bottom: 0.55rem;
  font-size: 0.84rem;
  font-weight: 900;
`;

const RegionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
`;

const RegionButton = styled.button<{ $selected: boolean }>`
  border: 2px solid #050505;
  border-radius: 12px;
  background: ${(p) => (p.$selected ? "#f47a4a" : "#fff")};
  color: #050505;
  padding: 0.8rem 0.65rem;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: ${(p) => (p.$selected ? "2px 2px 0 #050505" : "none")};
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
  line-height: 1.45;

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
    return <Page><StateCard>결제 정보를 불러오는 중...</StateCard></Page>;
  }

  return (
    <Page>
      <Card>
        <Header>
          <div>
            <Title>영어 한잔 이용권</Title>
            <Muted>30일 멤버십과 회차 참여권은 서로 다른 이용권입니다.</Muted>
          </div>
          <Price>
            {totalAmount === undefined ? "상품 확인 중" : `${totalAmount.toLocaleString()}원`}
            {productId === "membership_30d" ? <Muted> / 30일</Muted> : null}
          </Price>
        </Header>

        <ProductGrid>
          <ProductButton
            type="button"
            $selected={productId === "membership_30d"}
            disabled={alreadySubscribed}
            onClick={() => setProductId("membership_30d")}
          >
            <ProductName>30일 멤버십 {alreadySubscribed ? "(이용 중)" : ""}</ProductName>
            <ProductDescription>30일마다 자동 결제 · 멤버십 전용 기능 및 밋업 신청</ProductDescription>
          </ProductButton>
          <ProductButton
            type="button"
            $selected={productId === "participation_pack_5"}
            onClick={() => {
              setProductId("participation_pack_5");
              setReferralPrice(null);
              setReferralMessage("");
            }}
          >
            <ProductName>{selectedProduct?.credits ?? 5}회 참여권</ProductName>
            <ProductDescription>1회 결제 · 자동 결제 없음 · 밋업 신청 시 1회 사용</ProductDescription>
          </ProductButton>
        </ProductGrid>

        <Grid>
          {productId === "membership_30d" ? (
            <>
              <Section>
                <Label>참여 지역</Label>
                <RegionGrid>
                  <RegionButton type="button" $selected={region === "yeouido"} onClick={() => setRegion("yeouido")}>여의도</RegionButton>
                  <RegionButton type="button" $selected={region === "anam"} onClick={() => setRegion("anam")}>안암</RegionButton>
                </RegionGrid>
              </Section>

              <Section>
                <Label>지인 추천 코드 <Muted>(선택)</Muted></Label>
                <InputRow>
                  <Input
                    value={referralCode}
                    placeholder="추천 코드를 입력하세요"
                    onChange={(e) => {
                      setReferralCode(e.target.value);
                      setReferralPrice(null);
                      setReferralMessage("");
                    }}
                  />
                  <SmallButton type="button" onClick={checkReferral} disabled={!referralCode.trim() || checkingReferral}>
                    {checkingReferral ? "확인 중" : "확인"}
                  </SmallButton>
                </InputRow>
                {referralMessage ? <Message $error={!discounted}>{referralMessage}</Message> : null}
              </Section>
            </>
          ) : (
            <Section>
              <Label>회차 참여권 안내</Label>
              <ProductDescription>
                {selectedProduct?.credits ?? 5}회는 밋업 참가 신청을 완료할 때 1회씩 사용됩니다. 멤버십 상태나 멤버십 전용 기능은 변경되지 않으며, 구매일부터 {selectedProduct?.validityDays ?? 180}일 동안 사용할 수 있습니다.
              </ProductDescription>
            </Section>
          )}
        </Grid>

        <BenefitRow>
          <Benefit>{productId === "membership_30d" ? "✓ 멤버십 기간 동안 밋업 신청" : "✓ 밋업 신청 5회에 사용할 수 있는 회차형 이용권"}</Benefit>
          <Benefit>{productId === "membership_30d" ? "✓ 멤버십 전용 영어 학습 기능" : "✓ 자동 결제 없이 1회만 결제"}</Benefit>
          <Benefit>{productId === "membership_30d" ? "✓ 30일마다 자동 결제, 언제든 다음 결제 중단" : "✓ 구매일부터 180일간 사용"}</Benefit>
        </BenefitRow>

        <Footer>
          <PolicyGroup>
            <PolicyTitle>결제 및 환불 정책</PolicyTitle>
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
            {error ? <Message $error>{error}</Message> : null}
          </PolicyGroup>
          <PayButton type="button" onClick={handlePayment} disabled={processing || totalAmount === undefined || (productId === "membership_30d" && alreadySubscribed)}>
            {processing
              ? "결제 준비 중..."
              : productId === "membership_30d" && alreadySubscribed
                ? "멤버십 이용 중"
                : totalAmount === undefined
                  ? "상품 확인 중..."
                  : productId === "membership_30d"
                    ? `${totalAmount.toLocaleString()}원으로 시작하기`
                    : `${totalAmount.toLocaleString()}원으로 참여권 구매`}
          </PayButton>
        </Footer>
      </Card>
    </Page>
  );
}
