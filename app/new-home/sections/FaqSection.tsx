import { useState } from "react";
import styled from "styled-components";
import { colors } from "../../lib/constants/colors";
import { useI18n } from "../../lib/i18n/I18nProvider";
import { SectionTitle } from "../components/SectionHeading";

const MOBILE_NAV_GUTTER = "1rem";

const FAQSectionWrapper = styled.section`
  padding: 5rem 0 0;
  background: #f5f5f5;
  margin-bottom: 0;
`;

const FAQInner = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem;

  @media (max-width: 768px) {
    padding: 0 ${MOBILE_NAV_GUTTER};
  }
`;

const FAQContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const FAQItem = styled.div`
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;

  &:hover {
    border-color: #050505;
    box-shadow: 4px 4px 0 rgba(5, 5, 5, 0.9);
  }
`;

const FAQQuestion = styled.button<{ $isOpen: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 1.5rem;
  background: transparent;
  border: none;
  font-size: 1.05rem;
  font-weight: 600;
  color: #1f2937;
  cursor: pointer;
  font-family: "Noto Sans KR", sans-serif;
  text-align: left;
  transition: color 0.2s ease;

  &:hover {
    color: ${colors.primary};
  }

  span {
    font-size: 1.4rem;
    font-weight: 400;
    color: ${colors.primary};
    transition: transform 0.25s ease;
    transform: ${(props) => (props.$isOpen ? "rotate(180deg)" : "none")};
    flex-shrink: 0;
    margin-left: 1rem;
  }

  @media (max-width: 768px) {
    padding: 1.2rem;
    font-size: 0.95rem;
  }
`;

const FAQAnswer = styled.div<{ $isOpen: boolean }>`
  max-height: ${(props) => (props.$isOpen ? "500px" : "0")};
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  padding: ${(props) => (props.$isOpen ? "0 1.5rem 1.5rem" : "0 1.5rem")};
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.7;
  font-family: "Noto Sans KR", sans-serif;

  @media (max-width: 768px) {
    font-size: 0.9rem;
    padding: ${(props) => (props.$isOpen ? "0 1.2rem 1.2rem" : "0 1.2rem")};
  }
`;

export default function FaqSection() {
  const { t } = useI18n();
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const FAQ_ITEMS = t.home.faq.items.map(item => ({ question: item.q, answer: item.a }));

  const toggleFAQ = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  return (
    <FAQSectionWrapper>
      <FAQInner>
        <SectionTitle>{t.home.faq.title}</SectionTitle>
        <FAQContainer>
          {FAQ_ITEMS.map((faq, index) => (
            <FAQItem key={index}>
              <FAQQuestion
                onClick={() => toggleFAQ(index)}
                $isOpen={openFAQ === index}
              >
                {faq.question}
                <span>{openFAQ === index ? "−" : "+"}</span>
              </FAQQuestion>
              <FAQAnswer $isOpen={openFAQ === index}>
                {faq.answer}
              </FAQAnswer>
            </FAQItem>
          ))}
        </FAQContainer>
      </FAQInner>
    </FAQSectionWrapper>
  );
}
