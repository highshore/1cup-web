"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styled from "styled-components";

import { useAuth } from "../lib/contexts/auth_context";
import { invokeFunction, supabase } from "../lib/supabase/client";

const PAYPLE_HOST = (process.env.NEXT_PUBLIC_PAYPLE_HOST || "https://cpay.payple.kr").replace(/\/+$/, "");
const PAYPLE_SDK_SRC = `${PAYPLE_HOST}/js/v1/payment.js`;
const BASE_PRICE = 9700;

type Region = "yeouido" | "anam";

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
  background: #faf8f4;
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
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  margin-top: 1rem;
  border-top: 2px solid #050505;
  padding-top: 1rem;

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const Policy = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.65);
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.55;
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
  const [region, setRegion] = useState<Region>("yeouido");
  const [referralCode, setReferralCode] = useState("");
  const [referralPrice, setReferralPrice] = useState<number | null>(null);
  const [referralMessage, setReferralMessage] = useState("");
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const totalAmount = referralPrice ?? BASE_PRICE;
  const discounted = totalAmount < BASE_PRICE;

  const productName = useMemo(
    () => `영어 한잔 멤버십 (${region === "yeouido" ? "여의도" : "안암"})`,
    [region],
  );

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const { data } = await supabase
          .from("users")
          .select("has_active_subscription")
          .eq("uid", currentUser.uid)
          .maybeSingle();

        setAlreadySubscribed(Boolean(data?.has_active_subscription));
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser]);

  useEffect(() => {
    const urlRef = searchParams?.get("ref")?.trim();
    if (urlRef) setReferralCode(urlRef);
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
    const code = referralCode.trim();
    if (!code) return;
    setCheckingReferral(true);
    setReferralMessage("");
    setReferralPrice(null);

    try {
      const data = (await invokeFunction("payment", {
        action: "check-referral",
        code,
      })) as any;

      if (!data?.valid) {
        setReferralMessage(data?.message || "유효하지 않은 코드입니다.");
        return;
      }

      if (currentUser) {
        const { data: ownReferral } = await supabase
          .from("referral_codes")
          .select("referrer")
          .eq("code", code)
          .maybeSingle();
        if (ownReferral?.referrer === currentUser.uid) {
          setReferralMessage("본인의 추천 코드는 사용할 수 없습니다.");
          return;
        }
      }

      const price = normalizeReferralPrice(Number(data.discount || 0), String(data.discountType || "fixed_price"));
      setReferralPrice(price);
      setReferralMessage(data.message || "추천 코드가 적용되었습니다.");
    } catch {
      setReferralMessage("코드 확인 중 오류가 발생했습니다.");
    } finally {
      setCheckingReferral(false);
    }
  };

  const handlePayment = async () => {
    if (!currentUser) {
      localStorage.setItem("returnUrl", `/payment?region=${region}`);
      if (referralCode.trim()) sessionStorage.setItem("referralCodePrefill", referralCode.trim());
      router.push("/auth");
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
        pcd_amount: totalAmount,
        pcd_good_name: productName,
        selected_categories: {
          meetup: true,
          region,
          yeouido: region === "yeouido",
          anam: region === "anam",
        },
        referralCode: discounted ? referralCode.trim() : undefined,
      })) as any;

      if (!paymentData?.success) throw new Error(paymentData?.message || "결제 정보를 불러오지 못했습니다.");
      if (typeof window.PaypleCpayAuthCheck !== "function") throw new Error("결제 스크립트가 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.");

      sessionStorage.setItem(
        "paymentSessionInfo",
        JSON.stringify({ userId: currentUser.uid, amount: totalAmount, productName, region, timestamp: Date.now() }),
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

  if (alreadySubscribed) {
    return (
      <Page>
        <StateCard>
          <Title>이미 구독 중입니다</Title>
          <p>현재 멤버십을 이용 중입니다. 프로필에서 구독 상태를 확인해 주세요.</p>
          <PayButton onClick={() => router.push("/profile")}>프로필로 이동</PayButton>
        </StateCard>
      </Page>
    );
  }

  return (
    <Page>
      <Card>
        <Header>
          <div>
            <Title>영어 한잔 월간 멤버십</Title>
            <Muted>월 4회 오프라인 영어 모임 · 30일마다 자동 결제</Muted>
          </div>
          <Price>
            {totalAmount.toLocaleString()}원 <Muted>/ 1개월</Muted>
          </Price>
        </Header>

        <Grid>
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
        </Grid>

        <BenefitRow>
          <Benefit>✓ 통번역사 출신 리더와 실전 영어 토론</Benefit>
          <Benefit>✓ 5명 이하 소규모 그룹 중심 운영</Benefit>
          <Benefit>✓ WSJ·FT 등 글로벌 비즈니스 기사 기반</Benefit>
        </BenefitRow>

        <Footer>
          <div>
            <Policy>결제 후 7일 이내 전액 환불 가능. 이후에는 미사용 기간을 일할 계산해 환불합니다.</Policy>
            {error ? <Message $error>{error}</Message> : null}
          </div>
          <PayButton type="button" onClick={handlePayment} disabled={processing}>
            {processing ? "결제 준비 중..." : discounted ? `${totalAmount.toLocaleString()}원으로 시작하기` : "9,700원으로 시작하기"}
          </PayButton>
        </Footer>
      </Card>
    </Page>
  );
}
