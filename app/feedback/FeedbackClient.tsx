"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Star rating colors (local to this page)
const star = {
  active: "#FFD700",
  inactive: "#E0E0E0",
  hover: "#FFC107",
} as const;

const questionClass = "flex flex-col items-center text-center";

const questionTextClass =
  "mb-8 max-w-[700px] text-[1.4rem] font-semibold leading-[1.5] text-ink max-[768px]:mb-6 max-[768px]:text-[1.2rem]";

const textQuestionClass = "flex w-full flex-col items-center";

const textQuestionTitleClass =
  "mb-6 text-center text-[1.3rem] font-semibold leading-[1.5] text-ink max-[768px]:mb-4 max-[768px]:text-[1.1rem]";

const textAreaClass =
  "min-h-[140px] w-full max-w-[600px] resize-y rounded-2xl border-2 border-gray-medium bg-white p-6 text-[1.1rem] leading-[1.6] transition-all duration-300 ease-[ease] placeholder:text-ink-light focus:-translate-y-0.5 focus:border-accent focus:shadow-[0_0_0_4px_rgba(200,162,122,0.1)] focus:outline-none max-[768px]:min-h-[120px] max-[768px]:p-[1.2rem] max-[768px]:text-base";

const requiredClass = "ml-2 font-semibold text-[#dc3545]";

const StarRating = ({
  rating,
  onRating,
}: {
  rating: number;
  onRating: (rating: number) => void;
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-4 flex items-center justify-center gap-4 max-[768px]:gap-[0.8rem]">
        {[1, 2, 3, 4, 5].map((value) => {
          const selected = value <= (hoverRating || rating);
          const hovered = hoverRating > 0 && value <= hoverRating;
          const color = selected
            ? star.active
            : hovered
              ? star.hover
              : star.inactive;
          return (
            <span
              key={value}
              className="cursor-pointer text-[3.5rem] transition-all duration-300 ease-[ease] select-none hover:scale-[1.2] hover:[filter:drop-shadow(0_4px_8px_rgba(255,215,0,0.3))] max-[768px]:text-[3rem]"
              style={{ color }}
              onClick={() => onRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
            >
              ★
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex w-full max-w-[400px] justify-between text-[0.9rem] font-medium text-ink-light max-[768px]:max-w-[300px] max-[768px]:text-[0.85rem]">
        <span>전혀 그렇지 않다</span>
        <span>매우 그렇다</span>
      </div>
    </div>
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
    <div className="flex min-h-screen flex-col items-center justify-center px-8 py-16 max-[768px]:px-4 max-[768px]:py-8">
      <h1 className="mb-4 text-center text-[3rem] font-extrabold tracking-[-0.03em] text-primary max-[768px]:text-[2.5rem]">
        피드백
      </h1>
      <p className="mb-16 max-w-[600px] text-center text-[1.2rem] leading-[1.6] text-ink-light max-[768px]:mb-12 max-[768px]:text-[1.1rem]">
        여러분의 소중한 의견을 들려주세요.
        <br />더 나은 서비스를 위해 활용하겠습니다.
      </p>

      <div className="flex w-full max-w-[800px] flex-col gap-12 max-[768px]:gap-10">
        <div className={questionClass}>
          <h2 className={questionTextClass}>
            다음에도 저희 밋업에 참가할 의사가 있으신가요?
            <span className={requiredClass}>*</span>
          </h2>
          <StarRating rating={q1} onRating={setQ1} />
        </div>

        <div className={questionClass}>
          <h2 className={questionTextClass}>
            저희 밋업을 지인에게 추천할 의향이 있으신가요?
            <span className={requiredClass}>*</span>
          </h2>
          <StarRating rating={q2} onRating={setQ2} />
        </div>

        <div className={questionClass}>
          <h2 className={questionTextClass}>
            저희 밋업이 어느날 운영을 못하게 되면 아쉬울 것 같나요?
            <span className={requiredClass}>*</span>
          </h2>
          <StarRating rating={q3} onRating={setQ3} />
        </div>

        <div className={textQuestionClass}>
          <h3 className={textQuestionTitleClass}>
            스피킹에 있어서 본인이 가장 어려워하는 점이 무엇인가요?
          </h3>
          <textarea
            className={textAreaClass}
            value={q4}
            onChange={(e) => setQ4(e.target.value)}
            placeholder="예: 발음, 문법, 어휘력, 자신감 등 자유롭게 작성해주세요..."
          />
        </div>

        <div className={textQuestionClass}>
          <h3 className={textQuestionTitleClass}>
            개선을 원하거나 요청하고 싶은 점이 있나요?
          </h3>
          <textarea
            className={textAreaClass}
            value={q5}
            onChange={(e) => setQ5(e.target.value)}
            placeholder="서비스 개선 사항이나 추가 기능 요청 등을 자유롭게 작성해주세요..."
          />
        </div>

        <button
          className="mx-auto mt-8 w-full max-w-[400px] cursor-pointer rounded-[50px] border-none bg-[linear-gradient(135deg,#2C1810_0%,#4A2F23_100%)] px-8 py-[1.2rem] text-[1.2rem] font-bold tracking-[0.02em] text-white shadow-[0_4px_15px_rgba(44,24,16,0.2)] transition-all duration-300 ease-[ease] hover:enabled:-translate-y-[3px] hover:enabled:shadow-[0_8px_30px_rgba(44,24,16,0.3)] active:enabled:-translate-y-px disabled:transform-none disabled:cursor-not-allowed disabled:bg-gray-dark disabled:bg-none disabled:shadow-[0_2px_10px_rgba(0,0,0,0.1)] max-[768px]:px-6 max-[768px]:py-4 max-[768px]:text-[1.1rem]"
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? "제출 중..." : "피드백 제출하기"}
        </button>
      </div>
    </div>
  );
}
