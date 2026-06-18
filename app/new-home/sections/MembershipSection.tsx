import { useMemo, useCallback, type CSSProperties } from "react";
import styled, { keyframes } from "styled-components";
import { useRouter } from "next/navigation";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { useI18n } from "../../lib/i18n/I18nProvider";

type CSSVariableStyle = CSSProperties & {
  ["--target-width"]?: string;
  ["--delay"]?: string;
};

interface CostComparison {
  key: string;
  label: string;
  cost: number;
  displayValue: string;
  color: string;
  highlight?: boolean;
}

const MOBILE_NAV_GUTTER = "1rem";

const MembershipSectionContainer = styled.section`
  padding: clamp(4rem, 8vw, 5.5rem) 0;
  background: #f3f3f1;
  position: relative;
  overflow: hidden;
  color: #050505;
`;

const MembershipWrapper = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.25rem;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
    text-align: center;
  }
`;

const MembershipGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(1.5rem, 4vw, 2.25rem);
  
  @media (min-width: 860px) {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    align-items: stretch;
  }
`;

const LeftCol = styled.div`
  color: #050505;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.15rem;
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    text-align: center;
    align-items: center;
    width: 100%;
  }
`;

const RightCol = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  position: relative;
  z-index: 1;
  overflow: visible;
  width: 100%;

  @media (max-width: 768px) {
    margin-top: 1.5rem;
    align-items: stretch;
  }
`;

const BulletList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: 100%;

  @media (max-width: 768px) {
    max-width: 34rem;
  }
`;

const BulletItem = styled.p`
  font-size: 0.96rem;
  color: rgba(5, 5, 5, 0.76);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0;
  line-height: 1.55;
  font-weight: 700;

  svg {
    margin-top: 0.12rem;
    color: #050505;
  }

  @media (max-width: 768px) {
    justify-content: center;
    text-align: center;
  }
`;

const chartBreath = keyframes`
  0%, 100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -3px, 0);
  }
`;

const ComparisonChart = styled.div`
  background: #ffffff;
  border-radius: 10px;
  padding: clamp(1.05rem, 2.5vw, 1.4rem);
  border: 2px solid #050505;
  box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  transition: border-color 180ms ease, box-shadow 180ms ease;
  position: relative;
  overflow: hidden;
  width: 100%;
  max-width: none;
  animation: ${chartBreath} 5.2s ease-in-out infinite;

  &::before {
    display: none;
  }

  &::after {
    display: none;
  }
  
  &:hover {
    border-color: #050505;
    box-shadow: 5px 5px 0 rgba(5, 5, 5, 0.9);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.1rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid rgba(5, 5, 5, 0.12);
  font-size: 0.86rem;
  font-weight: 850;
  color: #050505;
  position: relative;
  z-index: 1;
`;

const CostBarContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.82rem;
  position: relative;
  z-index: 1;
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const CostItem = styled.div<{ $delay: number }>`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  opacity: 0;
  transform: translateY(10px);
  animation: ${fadeInUp} 0.45s ease forwards;
  animation-delay: ${({ $delay }) => `${$delay}s`};
`;

const CostLabelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.86rem;
  color: #050505;
  font-weight: 760;
`;

const CostBarWrapper = styled.div`
  width: 100%;
  height: 12px;
  background: #fff8dc;
  border-radius: 9999px;
  overflow: hidden;
  border: 1px solid rgba(5, 5, 5, 0.16);
  position: relative;
`;

const growBar = keyframes`
  from { width: 0; }
  to { width: var(--target-width, 100%); }
`;

const CostBar = styled.div<{ $color: string }>`
  position: relative;
  height: 100%;
  width: 0;
  background: ${props => props.$color};
  border-radius: 9999px;
  animation: ${growBar} 1.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--delay, 0s);
  box-shadow: none;
  overflow: hidden;

  &::after {
    display: none;
  }
`;

const CostValue = styled.span<{ $highlight?: boolean }>`
  color: ${props => props.$highlight ? '#050505' : 'rgba(5, 5, 5, 0.58)'};
  font-weight: ${props => props.$highlight ? '920' : '650'};
  font-size: 0.85rem;
  white-space: nowrap;
`;

const CostLabelText = styled.span<{ $highlight?: boolean }>`
  color: #050505;
  font-weight: ${({ $highlight }) => ($highlight ? 920 : 760)};
`;

const BulletIcon = styled(CheckBadgeIcon)`
  flex-shrink: 0;
`;

const CtaButton = styled.button`
  min-height: 48px;
  background: #ffffff;
  color: #050505;
  font-weight: 850;
  padding: 0.85rem 1.55rem;
  border-radius: 999px;
  transition: background-color 160ms ease, border-color 160ms ease,
    box-shadow 160ms ease, transform 160ms ease;
  box-shadow: 5px 5px 0 #f47a4a;
  width: max-content;
  border: 2px solid #050505;
  cursor: pointer;
  font-size: 1rem;

  &:hover {
    background: #fff8dc;
    border-color: #050505;
    transform: translate(-1px, -1px);
    box-shadow: 7px 7px 0 #f47a4a;
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    margin: 0 auto;
  }
`;

const ValueIntro = styled.div`
  display: grid;
  gap: 0.8rem;

  @media (max-width: 768px) {
    justify-items: center;
    text-align: center;
  }
`;

const MembershipTitle = styled.h2`
  margin: 0;
  color: #050505;
  font-family: "Noto Sans KR", sans-serif;
  font-size: clamp(1.85rem, 3vw, 2.4rem);
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
  word-break: keep-all;
`;

const MembershipHighlight = styled.span`
  display: inline;
  color: #d95f2d;
`;

const CaveatBox = styled.div`
  margin-top: 1.15rem;
  border: 1px solid rgba(5, 5, 5, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.68);
  padding: 0.9rem;
`;

const CaveatText = styled.p`
  margin: 0;
  color: rgba(5, 5, 5, 0.62);
  font-size: 0.82rem;
  font-weight: 580;
  line-height: 1.6;
  word-break: keep-all;
`;

export default function MembershipSection() {
  const { t, locale } = useI18n();
  const router = useRouter();

  const membershipSectionTitleLines = t.home.pricingNew.sectionTitle.split('\n');
  const membershipAccessBullet = useMemo(
    () => t.home.pricingNew.leftTitle.replace(/\n/g, " "),
    [t.home.pricingNew.leftTitle]
  );

  const formatCostValue = useCallback(
    (value: number) =>
      locale === "ko"
        ? `${value.toLocaleString("ko-KR")}원`
        : `${value.toLocaleString("en-US")} KRW`,
    [locale]
  );

  const costComparisons: CostComparison[] = useMemo(() => {
    const labels = t.home.pricingNew.chart.labels;
    return [
      {
        key: "oneCup",
        label: labels.oneCup,
        cost: 1212,
        displayValue: formatCostValue(1212),
        color: "linear-gradient(90deg, #050505, #2a2a2a)",
        highlight: true,
      },
      {
        key: "exchange",
        label: labels.exchange,
        cost: 5000,
        displayValue: formatCostValue(5000),
        color: "linear-gradient(90deg, #f47a4a, #f79a72)",
      },
      {
        key: "phone",
        label: labels.phone,
        cost: 20000,
        displayValue: `${formatCostValue(20000)}~`,
        color: "linear-gradient(90deg, #a6c9d8, #7fb1c5)",
      },
      {
        key: "academy",
        label: labels.academy,
        cost: 35000,
        displayValue: `${formatCostValue(35000)}~`,
        color: "linear-gradient(90deg, #d6c8aa, #bfae8b)",
      },
      {
        key: "premium",
        label: labels.premium,
        cost: 60000,
        displayValue: `${formatCostValue(60000)}~`,
        color: "linear-gradient(90deg, #8e9b8d, #6f806e)",
      },
    ];
  }, [formatCostValue, t, locale]);

  const maxCost = useMemo(
    () => Math.max(...costComparisons.map((item) => item.cost), 1),
    [costComparisons]
  );

  return (
    <MembershipSectionContainer>
      <MembershipWrapper>
        <MembershipGrid>
          <LeftCol>
            <ValueIntro>
              <MembershipTitle>
                {membershipSectionTitleLines[0]}
                {membershipSectionTitleLines[1] && (
                  <>
                    <br />
                    <MembershipHighlight>
                      {membershipSectionTitleLines[1]}
                    </MembershipHighlight>
                  </>
                )}
              </MembershipTitle>
            </ValueIntro>
            <div>
              <BulletList>
                {[membershipAccessBullet, t.home.pricingNew.referralDiscount].map((text, idx) => (
                  <BulletItem key={idx}>
                    <BulletIcon width={20} />
                    {text}
                  </BulletItem>
                ))}
              </BulletList>
              <CaveatBox>
                <CaveatText>
                  {t.home.pricingNew.caveats.line1}<br/>
                  {t.home.pricingNew.caveats.line2}<br/>
                  {t.home.pricingNew.caveats.line3}<br/>
                  {t.home.pricingNew.caveats.line4}
                </CaveatText>
              </CaveatBox>
            </div>
            <CtaButton onClick={() => router.push("/payment")}>
              {t.home.pricing.cta}
            </CtaButton>
          </LeftCol>
          <RightCol>
            <ComparisonChart>
              <ChartHeader>
                <span>{t.home.pricingNew.chart.header}</span>
                <span>{t.home.pricingNew.chart.unit}</span>
              </ChartHeader>
              <CostBarContainer>
                {costComparisons.map((item, index) => {
                  const widthPercent = Math.max(
                    1.5,
                    (item.cost / maxCost) * 100
                  );
                  const barStyle: CSSVariableStyle = {
                    "--target-width": `${widthPercent}%`,
                    "--delay": `${index * 0.08}s`,
                  };
                  return (
                    <CostItem key={item.key} $delay={index * 0.08}>
                      <CostLabelRow>
                        <CostLabelText $highlight={item.highlight}>
                          {item.label}
                        </CostLabelText>
                        <CostValue $highlight={item.highlight}>
                          {item.displayValue}
                        </CostValue>
                      </CostLabelRow>
                      <CostBarWrapper>
                        <CostBar $color={item.color} style={barStyle} />
                      </CostBarWrapper>
                    </CostItem>
                  );
                })}
              </CostBarContainer>
            </ComparisonChart>
          </RightCol>
        </MembershipGrid>
      </MembershipWrapper>
    </MembershipSectionContainer>
  );
}
