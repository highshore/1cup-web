"use client";

import { useState } from "react";
import styled from "styled-components";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { colors } from "../lib/constants/colors";

// Using shared colors; extend locally for star rating
const star = {
  active: "#FFD700",
  inactive: "#E0E0E0",
  hover: "#FFC107",
} as const;

const Container = styled.div`
  min-height: 100vh;
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    padding: 2rem 1rem;
  }
`;

const Title = styled.h1`
  font-size: 3rem;
  font-weight: 800;
  color: ${colors.primary};
  text-align: center;
  margin-bottom: 1rem;
  letter-spacing: -0.03em;

  @media (max-width: 768px) {
    font-size: 2.5rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  color: ${colors.text.light};
  text-align: center;
  margin-bottom: 4rem;
  line-height: 1.6;
  max-width: 600px;

  @media (max-width: 768px) {
    font-size: 1.1rem;
    margin-bottom: 3rem;
  }
`;

const FormContainer = styled.div`
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 3rem;

  @media (max-width: 768px) {
    gap: 2.5rem;
  }
`;

const Question = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const QuestionText = styled.h2`
  font-size: 1.4rem;
  font-weight: 600;
  color: ${colors.text.dark};
  margin-bottom: 2rem;
  line-height: 1.5;
  max-width: 700px;

  @media (max-width: 768px) {
    font-size: 1.2rem;
    margin-bottom: 1.5rem;
  }
`;

const Required = styled.span`
  color: #dc3545;
  font-weight: 600;
  margin-left: 0.5rem;
`;

const StarContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;

  @media (max-width: 768px) {
    gap: 0.8rem;
  }
`;

const Star = styled.span.withConfig({
  shouldForwardProp: (prop) => !["$hover"].includes(prop),
})<{ selected: boolean; $hover: boolean }>`
  font-size: 3.5rem;
  cursor: pointer;
  color: ${({ selected, $hover }) =>
    selected ? star.active : $hover ? star.hover : star.inactive};
  transition: all 0.3s ease;
  user-select: none;

  &:hover {
    transform: scale(1.2);
    filter: drop-shadow(0 4px 8px rgba(255, 215, 0, 0.3));
  }

  @media (max-width: 768px) {
    font-size: 3rem;
  }
`;

const RatingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const RatingLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: ${colors.text.light};
  font-weight: 500;
  width: 100%;
  max-width: 400px;
  margin-top: 0.5rem;

  @media (max-width: 768px) {
    font-size: 0.85rem;
    max-width: 300px;
  }
`;

const TextQuestion = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const TextQuestionTitle = styled.h3`
  font-size: 1.3rem;
  font-weight: 600;
  color: ${colors.text.dark};
  margin-bottom: 1.5rem;
  text-align: center;
  line-height: 1.5;

  @media (max-width: 768px) {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  max-width: 600px;
  min-height: 140px;
  padding: 1.5rem;
  border-radius: 16px;
  border: 2px solid ${colors.gray.medium};
  font-size: 1.1rem;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  transition: all 0.3s ease;
  background-color: white;

  &:focus {
    outline: none;
    border-color: ${colors.accent};
    box-shadow: 0 0 0 4px rgba(200, 162, 122, 0.1);
    transform: translateY(-2px);
  }

  &::placeholder {
    color: ${colors.text.light};
  }

  @media (max-width: 768px) {
    min-height: 120px;
    padding: 1.2rem;
    font-size: 1rem;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  max-width: 400px;
  padding: 1.2rem 2rem;
  font-size: 1.2rem;
  font-weight: 700;
  background: linear-gradient(
    135deg,
    ${colors.primary} 0%,
    ${colors.primaryLight} 100%
  );
  color: white;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 0.02em;
  margin: 2rem auto 0;
  box-shadow: 0 4px 15px rgba(44, 24, 16, 0.2);

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 8px 30px rgba(44, 24, 16, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px);
  }

  &:disabled {
    background: ${colors.gray.dark};
    cursor: not-allowed;
    transform: none;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    font-size: 1.1rem;
    padding: 1rem 1.5rem;
  }
`;

const StarRating = ({
  rating,
  onRating,
}: {
  rating: number;
  onRating: (rating: number) => void;
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <RatingContainer>
      <StarContainer>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            selected={star <= (hoverRating || rating)}
            $hover={hoverRating > 0 && star <= hoverRating}
            onClick={() => onRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
          >
            ★
          </Star>
        ))}
      </StarContainer>
      <RatingLabel>
        <span>전혀 그렇지 않다</span>
        <span>매우 그렇다</span>
      </RatingLabel>
    </RatingContainer>
  );
};

export default function FeedbackClient({ uid }: { uid: string }) {
  const router = useRouter();
  const [q1, setQ1] = useState(0);
  const [q2, setQ2] = useState(0);
  const [q3, setQ3] = useState(0);
  const [q4, setQ4] = useState("");
  const [q5, setQ5] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = q1 > 0 && q2 > 0 && q3 > 0;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          survey: {
            q1_meetup_participation: q1,
            q2_recommendation: q2,
            q3_disappointment: q3,
            q4_speaking_difficulty: q4,
            q5_improvement_suggestions: q5,
          },
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      alert("소중한 의견 감사합니다!");
      router.push("/");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container>
      <Title>피드백</Title>
      <Subtitle>
        여러분의 소중한 의견을 들려주세요.
        <br />더 나은 서비스를 위해 활용하겠습니다.
      </Subtitle>

      <FormContainer>
        <Question>
          <QuestionText>
            다음에도 저희 밋업에 참가할 의사가 있으신가요?
            <Required>*</Required>
          </QuestionText>
          <StarRating rating={q1} onRating={setQ1} />
        </Question>

        <Question>
          <QuestionText>
            저희 밋업을 지인에게 추천할 의향이 있으신가요?
            <Required>*</Required>
          </QuestionText>
          <StarRating rating={q2} onRating={setQ2} />
        </Question>

        <Question>
          <QuestionText>
            저희 밋업이 어느날 운영을 못하게 되면 아쉬울 것 같나요?
            <Required>*</Required>
          </QuestionText>
          <StarRating rating={q3} onRating={setQ3} />
        </Question>

        <TextQuestion>
          <TextQuestionTitle>
            스피킹에 있어서 본인이 가장 어려워하는 점이 무엇인가요?
          </TextQuestionTitle>
          <TextArea
            value={q4}
            onChange={(e) => setQ4(e.target.value)}
            placeholder="예: 발음, 문법, 어휘력, 자신감 등 자유롭게 작성해주세요..."
          />
        </TextQuestion>

        <TextQuestion>
          <TextQuestionTitle>
            개선을 원하거나 요청하고 싶은 점이 있나요?
          </TextQuestionTitle>
          <TextArea
            value={q5}
            onChange={(e) => setQ5(e.target.value)}
            placeholder="서비스 개선 사항이나 추가 기능 요청 등을 자유롭게 작성해주세요..."
          />
        </TextQuestion>

        <SubmitButton
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? "제출 중..." : "피드백 제출하기"}
        </SubmitButton>
      </FormContainer>
    </Container>
  );
}
