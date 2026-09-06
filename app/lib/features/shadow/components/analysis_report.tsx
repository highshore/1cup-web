import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "./analysis_report.css";
// Lazy-load lottie-react so it ships in its own chunk (matches the
// dynamic-import pattern used by the loading screens).
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import {
  SentenceForAssessment,
  AzureWordPronunciationResult,
} from "../types/shadow";
import { colors } from "../styles/shadow_styles";
import CompletionModal from "./completion_modal";
import { LightBulbIcon, TrophyIcon } from "@heroicons/react/24/outline";

interface AnalysisReportProps {
  sentences: SentenceForAssessment[];
}

function MetricCard({
  highlight,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { highlight?: boolean }) {
  const classes = [
    highlight
      ? "bg-[linear-gradient(135deg,#3c2e2615_0%,#d4a57410_50%,#3c2e2615_100%)] border-[#3c2e26] before:bg-[linear-gradient(45deg,transparent,#3c2e2620,transparent)]"
      : "bg-[linear-gradient(135deg,#ffffff_0%,#faf8f6_100%)] border-line before:bg-none",
    "border-2 border-solid rounded-[20px] py-8 px-6 text-center",
    "[transition:all_0.4s_cubic-bezier(0.4,0,0.2,1)] relative overflow-hidden",
    "animate-[shadow-report-float_3s_ease-in-out_infinite]",
    "before:content-[''] before:absolute before:-top-1/2 before:-left-1/2 before:w-[200%] before:h-[200%]",
    "before:[transform:rotate(-45deg)] before:[transition:all_0.6s_ease] before:opacity-0",
    "hover:[transform:translateY(-8px)_scale(1.02)]",
    "hover:shadow-[0_20px_25px_rgba(44,24,16,0.1),0_10px_10px_rgba(44,24,16,0.04),0_20px_40px_rgba(60,46,38,0.15)]",
    "hover:border-[#3c2e26]",
    "hover:before:opacity-100 hover:before:animate-[shadow-report-gradient-move_2s_linear_infinite]",
    "[&:nth-child(2)]:[animation-delay:0.2s] [&:nth-child(3)]:[animation-delay:0.4s] [&:nth-child(4)]:[animation-delay:0.6s]",
    className,
  ].join(" ");
  return <div className={classes} {...rest} />;
}

function MetricValue({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`text-[3rem] font-extrabold bg-[linear-gradient(135deg,#3c2e26,#d4a574)] bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] mb-2 relative z-[2] ${className}`}
      {...rest}
    />
  );
}

function MetricLabel({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`text-[0.95rem] text-[#8d6e63] font-semibold uppercase tracking-[1px] relative z-[2] ${className}`}
      {...rest}
    />
  );
}

function Section({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mb-12 p-6 rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] backdrop-blur-[10px] border border-solid border-[rgba(255,255,255,0.1)] ${className}`}
      {...rest}
    />
  );
}

function SectionTitle({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-[1.6rem] font-bold text-ink mb-6 flex items-center gap-3 before:content-[''] before:w-[6px] before:h-8 before:bg-[linear-gradient(180deg,#3c2e26,#d4a574)] before:rounded-[3px] before:shadow-[0_2px_8px_rgba(60,46,38,0.3)] ${className}`}
      {...rest}
    />
  );
}

function ProgressBar({
  percentage,
  color,
  className = "",
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  percentage: number;
  color?: string;
}) {
  const fillBackground = (() => {
    if (color) return color;
    if (percentage >= 80)
      return `linear-gradient(90deg, ${colors.success}, #6fd46f)`;
    if (percentage >= 60)
      return `linear-gradient(90deg, ${colors.warning}, #f4c430)`;
    return `linear-gradient(90deg, ${colors.error}, #ff6b6b)`;
  })();
  return (
    <div
      className={`w-full h-4 bg-[linear-gradient(90deg,#e8ddd4,#d7c7b8)] rounded-lg overflow-hidden relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] after:content-[''] after:absolute after:top-0 after:left-0 after:h-full after:w-[var(--bar-width)] after:[background:var(--bar-bg)] after:rounded-lg after:[transition:width_0.8s_cubic-bezier(0.4,0,0.2,1)] after:relative ${className}`}
      style={
        {
          "--bar-width": `${percentage}%`,
          "--bar-bg": fillBackground,
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    />
  );
}

function ImprovementCard({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const classes = [
    "bg-[linear-gradient(135deg,#ffffff_0%,#faf8f6_100%)] border border-solid border-line rounded-2xl p-8 mb-4",
    "[transition:all_0.4s_cubic-bezier(0.4,0,0.2,1)] relative overflow-hidden",
    "before:content-[''] before:absolute before:top-0 before:-left-full before:w-full before:h-full",
    "before:bg-[linear-gradient(90deg,transparent,rgba(60,46,38,0.05),transparent)] before:[transition:left_0.6s_ease]",
    "hover:[transform:translateY(-4px)]",
    "hover:shadow-[0_10px_15px_rgba(44,24,16,0.1),0_4px_6px_rgba(44,24,16,0.05)]",
    "hover:border-[#3c2e2650] hover:before:left-full",
    className,
  ].join(" ");
  return <div className={classes} {...rest} />;
}

function WordChip({
  score,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { score: number }) {
  const tier =
    score >= 80
      ? "bg-[linear-gradient(135deg,#4e7c5920,#4e7c5910)] text-[#4e7c59] border-[#4e7c5940]"
      : score >= 60
      ? "bg-[linear-gradient(135deg,#c1781720,#c1781710)] text-[#c17817] border-[#c1781740]"
      : "bg-[linear-gradient(135deg,#a8423f20,#a8423f10)] text-[#a8423f] border-[#a8423f40]";
  const classes = [
    "py-2 px-4 rounded-[25px] text-[0.9rem] font-semibold border-2 border-solid",
    tier,
    "[transition:all_0.3s_ease] relative overflow-hidden",
    "before:content-[''] before:absolute before:top-0 before:-left-full before:w-full before:h-full",
    "before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] before:[transition:left_0.4s_ease]",
    "hover:[transform:translateY(-2px)] hover:before:left-full",
    className,
  ].join(" ");
  return <span className={classes} {...rest} />;
}

function RecommendationItem({
  className = "",
  ...rest
}: React.LiHTMLAttributes<HTMLLIElement>) {
  const classes = [
    "py-4 px-0 text-[#3c2e26] leading-[1.7] flex items-start gap-4 font-medium [transition:all_0.3s_ease]",
    "before:content-['→'] before:text-[#3c2e26] before:font-bold before:text-[1.2rem] before:mt-[0.1rem] before:[transition:transform_0.3s_ease]",
    "hover:[transform:translateX(8px)] hover:before:[transform:scale(1.2)]",
    className,
  ].join(" ");
  return <li className={classes} {...rest} />;
}

const finishButtonClasses = [
  "mt-8 flex w-full items-center justify-center py-4 px-12 text-[1rem] font-bold",
  "bg-[linear-gradient(135deg,#3c2e26,#2c1810)] text-white border-none rounded-[20px] cursor-pointer",
  "[transition:all_0.3s_cubic-bezier(0.4,0,0.2,1)]",
  "shadow-[0_10px_15px_rgba(44,24,16,0.1),0_4px_6px_rgba(44,24,16,0.05)]",
  "relative overflow-hidden",
  "[&_svg]:w-[1.1rem] [&_svg]:h-[1.1rem] [&_svg]:shrink-0",
  "[&_span]:inline-flex [&_span]:items-center [&_span]:justify-center [&_span]:gap-2 [&_span]:relative [&_span]:z-[1]",
  "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-full",
  "before:bg-[linear-gradient(135deg,#d4a574,#5d4037)] before:opacity-0 before:[transition:opacity_0.3s_ease]",
  "hover:[transform:translateY(-4px)_scale(1.02)]",
  "hover:shadow-[0_20px_25px_rgba(44,24,16,0.1),0_10px_10px_rgba(44,24,16,0.04)]",
  "hover:before:opacity-100",
  "active:[transform:translateY(-2px)_scale(1.01)]",
].join(" ");

const AnalysisReport: React.FC<AnalysisReportProps> = ({ sentences }) => {
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [welcomeAnimation, setWelcomeAnimation] = useState<any>(null);

  // Load Lottie animation
  useEffect(() => {
    fetch("/animations/complete.json")
      .then((response) => response.json())
      .then((data) => setWelcomeAnimation(data))
      .catch((error) => console.error("Error loading animation:", error));
  }, []);

  // Handle AI chat option
  const handleAIChat = () => {
    setIsCompletionModalOpen(false);
    // TODO: Navigate to AI chat or implement AI chat functionality
    console.log("AI Chat selected");
  };

  // Handle finish option
  const handleFinish = () => {
    setIsCompletionModalOpen(false);
    // TODO: Navigate back to home or close the app
    console.log("Finish selected");
  };

  // Calculate overall metrics
  const assessedSentences = sentences.filter((s) => s.assessmentResult);

  // Show sample data instead of empty state
  const useSampleData = assessedSentences.length === 0;

  // Sample data for demonstration
  const sampleData = {
    totalSentences: 8,
    avgPronunciation: 82,
    avgAccuracy: 85,
    avgFluency: 78,
    avgCompleteness: 83,
    wordIssues: [
      { word: "expectations", score: 65, error: "Mispronunciation", count: 2 },
      { word: "resilience", score: 58, error: "Accuracy", count: 1 },
      { word: "character", score: 72, error: "Fluency", count: 1 },
      { word: "refine", score: 68, error: "Pronunciation", count: 1 },
      { word: "company", score: 74, error: "Accent", count: 1 },
      { word: "greatness", score: 69, error: "Stress", count: 1 },
      { word: "train", score: 76, error: "Speed", count: 1 },
    ],
  };

  let totalSentences,
    avgPronunciation,
    avgAccuracy,
    avgFluency,
    avgCompleteness,
    wordIssues;

  if (useSampleData) {
    totalSentences = sampleData.totalSentences;
    avgPronunciation = sampleData.avgPronunciation;
    avgAccuracy = sampleData.avgAccuracy;
    avgFluency = sampleData.avgFluency;
    avgCompleteness = sampleData.avgCompleteness;
    wordIssues = sampleData.wordIssues;
  } else {
    totalSentences = assessedSentences.length;
    avgPronunciation =
      assessedSentences.reduce(
        (sum, s) => sum + (s.assessmentResult?.pronunciationScore || 0),
        0
      ) / totalSentences;
    avgAccuracy =
      assessedSentences.reduce(
        (sum, s) => sum + (s.assessmentResult?.accuracyScore || 0),
        0
      ) / totalSentences;
    avgFluency =
      assessedSentences.reduce(
        (sum, s) => sum + (s.assessmentResult?.fluencyScore || 0),
        0
      ) / totalSentences;
    avgCompleteness =
      assessedSentences.reduce(
        (sum, s) => sum + (s.assessmentResult?.completenessScore || 0),
        0
      ) / totalSentences;

    // Analyze word-level issues from real data
    const realWordIssues: {
      word: string;
      score: number;
      error: string;
      count: number;
    }[] = [];
    const wordMap = new Map();

    assessedSentences.forEach((sentence) => {
      const words =
        (sentence.assessmentResult?.detailResult
          ?.Words as AzureWordPronunciationResult[]) || [];
      words.forEach((word) => {
        const score = word.PronunciationAssessment?.AccuracyScore || 0;
        const error = word.PronunciationAssessment?.ErrorType || "None";

        if (score < 70 || error !== "None") {
          const key = word.Word.toLowerCase();
          if (wordMap.has(key)) {
            const existing = wordMap.get(key);
            existing.count++;
            existing.score = Math.min(existing.score, score);
          } else {
            wordMap.set(key, { word: word.Word, score, error, count: 1 });
          }
        }
      });
    });

    realWordIssues.push(...Array.from(wordMap.values()));
    realWordIssues.sort((a, b) => a.score - b.score);
    wordIssues = realWordIssues;
  }

  // Generate improvement areas
  const improvementAreas = [];

  if (avgPronunciation < 70) {
    improvementAreas.push({
      title: "전체적인 발음",
      description:
        "명확한 발음과 정확한 소리 생성에 집중하세요. 원어민 오디오와 함께 연습해보세요.",
    });
  }

  if (avgFluency < 70) {
    improvementAreas.push({
      title: "말하기 유창성",
      description:
        "부드럽고 자연스러운 말의 리듬을 연습하세요. 매일 소리내어 읽기와 쉐도잉 연습을 해보세요.",
    });
  }

  if (avgAccuracy < 70) {
    improvementAreas.push({
      title: "단어 정확성",
      description:
        "개별 단어의 정확한 발음에 집중하세요. 발음 기호를 가이드로 활용해보세요.",
    });
  }

  // Add sample improvement areas if using sample data and no real issues found
  if (useSampleData && improvementAreas.length === 0) {
    improvementAreas.push({
      title: "말하기 유창성",
      description:
        "부드럽고 자연스러운 말의 리듬을 연습하세요. 매일 소리내어 읽기와 쉐도잉 연습을 해보세요.",
    });
  }

  const overallScore =
    (avgPronunciation + avgAccuracy + avgFluency + avgCompleteness) / 4;

  // Show firework animation for good scores
  const showFireworks = overallScore >= 80;

  return (
    <div className="max-w-[900px] mx-auto p-8 bg-[linear-gradient(135deg,#ffffff_0%,#faf8f6_50%,#ffffff_100%)] rounded-3xl shadow-[0_20px_25px_rgba(44,24,16,0.1),0_10px_10px_rgba(44,24,16,0.04),0_0_40px_rgba(60,46,38,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] border border-solid border-line relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-[linear-gradient(90deg,#3c2e26,#d4a574,#3c2e26)] before:[background-size:200%_100%] before:animate-[shadow-report-gradient-move_3s_ease_infinite]">
      <div className="flex flex-col items-center justify-center text-center mb-12 pb-8 border-b-2 border-solid border-line relative">
        {showFireworks && welcomeAnimation && (
          <div className="relative w-[120px] h-[120px] pointer-events-none z-[5] mt-0 mx-auto mb-4">
            <Lottie
              animationData={welcomeAnimation}
              loop={true}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}
        <h1 className="text-[2.8rem] font-extrabold bg-[linear-gradient(135deg,#3c2e26_0%,#d4a574_30%,#5d4037_60%,#3c2e26_100%)] [background-size:300%_300%] bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] mb-2 animate-[shadow-report-gradient-move_4s_ease_infinite] tracking-[-0.02em]">
          고생하셨습니다!
        </h1>
        <p className="text-[1.5rem] text-[#8d6e63] my-5 mx-0 font-medium">
          {useSampleData
            ? "스터디 분석 결과"
            : `총 ${totalSentences}개 문장 분석 결과`}
        </p>
      </div>

      {/* Overall Metrics */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 mb-12">
        <MetricCard highlight>
          <MetricValue>{Math.round(overallScore)}</MetricValue>
          <MetricLabel>종합 점수</MetricLabel>
        </MetricCard>
        <MetricCard>
          <MetricValue>{Math.round(avgPronunciation)}</MetricValue>
          <MetricLabel>발음</MetricLabel>
        </MetricCard>
        <MetricCard>
          <MetricValue>{Math.round(avgAccuracy)}</MetricValue>
          <MetricLabel>정확성</MetricLabel>
        </MetricCard>
        <MetricCard>
          <MetricValue>{Math.round(avgFluency)}</MetricValue>
          <MetricLabel>유창성</MetricLabel>
        </MetricCard>
      </div>

      {/* Detailed Scores */}
      <Section>
        <SectionTitle>📈 세부 성과 분석</SectionTitle>
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                fontSize: "1.1rem",
              }}
            >
              <span style={{ fontWeight: 600 }}>발음 점수</span>
              <span style={{ color: colors.text.muted, fontWeight: 600 }}>
                {Math.round(avgPronunciation)}%
              </span>
            </div>
            <ProgressBar percentage={avgPronunciation} />
          </div>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                fontSize: "1.1rem",
              }}
            >
              <span style={{ fontWeight: 600 }}>정확성 점수</span>
              <span style={{ color: colors.text.muted, fontWeight: 600 }}>
                {Math.round(avgAccuracy)}%
              </span>
            </div>
            <ProgressBar percentage={avgAccuracy} />
          </div>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                fontSize: "1.1rem",
              }}
            >
              <span style={{ fontWeight: 600 }}>유창성 점수</span>
              <span style={{ color: colors.text.muted, fontWeight: 600 }}>
                {Math.round(avgFluency)}%
              </span>
            </div>
            <ProgressBar percentage={avgFluency} />
          </div>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                fontSize: "1.1rem",
              }}
            >
              <span style={{ fontWeight: 600 }}>완성도 점수</span>
              <span style={{ color: colors.text.muted, fontWeight: 600 }}>
                {Math.round(avgCompleteness)}%
              </span>
            </div>
            <ProgressBar percentage={avgCompleteness} />
          </div>
        </div>
      </Section>

      {/* Words to Practice */}
      {wordIssues.length > 0 && (
        <Section>
          <SectionTitle>집중 연습 단어</SectionTitle>
          <p
            style={{
              color: colors.text.secondary,
              marginBottom: "1.5rem",
              fontSize: "1.1rem",
              lineHeight: "1.6",
            }}
          >
            다음 단어들의 정확도가 낮게 나타났습니다. 이 단어들의 발음 연습에
            집중해보세요:
          </p>
          <div className="flex flex-wrap gap-3">
            {wordIssues.slice(0, 15).map((issue, index) => (
              <WordChip key={index} score={issue.score}>
                {issue.word} ({Math.round(issue.score)}%)
              </WordChip>
            ))}
          </div>
        </Section>
      )}

      {/* Improvement Areas */}
      {improvementAreas.length > 0 && (
        <Section>
          <SectionTitle>개선이 필요한 영역</SectionTitle>
          {improvementAreas.map((area, index) => (
            <ImprovementCard key={index}>
              <h4 className="text-[1.2rem] font-bold bg-[linear-gradient(135deg,#2c1810,#3c2e26)] bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] mb-2">
                {area.title}
              </h4>
              <p className="text-[#3c2e26] leading-[1.7] mb-4 font-medium">
                {area.description}
              </p>
            </ImprovementCard>
          ))}
        </Section>
      )}

      {/* Recommendations */}
      <div className="bg-[linear-gradient(135deg,#3c2e2608_0%,#d4a57405_50%,#3c2e2608_100%)] border-2 border-solid border-[#3c2e2630] rounded-[20px] p-10 mt-8 relative overflow-hidden before:content-[''] before:absolute before:-top-1/2 before:-left-1/2 before:w-[200%] before:h-[200%] before:bg-[linear-gradient(45deg,transparent,#3c2e2610,transparent)] before:animate-[shadow-report-pulse_4s_ease-in-out_infinite]">
        <h3 className="text-[1.5rem] font-bold bg-[linear-gradient(135deg,#3c2e26,#d4a574)] bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] mb-6 flex items-center gap-3 relative z-[2] [&_svg]:w-[1.8rem] [&_svg]:h-[1.8rem] [&_svg]:animate-[shadow-report-pulse_2s_ease-in-out_infinite]">
          <LightBulbIcon />
          다음 단계 추천
        </h3>
        <ul className="list-none p-0 m-0 relative z-[2]">
          {overallScore >= 80 ? (
            <>
              <RecommendationItem>
                훌륭합니다! 높은 수준의 실력을 유지하기 위해 꾸준히 연습을
                계속하세요.
              </RecommendationItem>
              <RecommendationItem>
                더 어려운 콘텐츠에 도전하거나 말하기 속도와 자연스러움에
                집중해보세요.
              </RecommendationItem>
              <RecommendationItem>
                다양한 억양과 말하기 스타일을 연습하여 실력의 폭을 넓혀보세요.
              </RecommendationItem>
            </>
          ) : overallScore >= 60 ? (
            <>
              <RecommendationItem>
                좋은 진전입니다! 개선이 필요한 특정 단어와 소리에 집중해보세요.
              </RecommendationItem>
              <RecommendationItem>
                일관성을 위해 매일 10-15분씩 쉐도잉 연습을 해보세요.
              </RecommendationItem>
              <RecommendationItem>
                자신의 말하기를 녹음하고 원어민과 비교해보세요.
              </RecommendationItem>
            </>
          ) : (
            <>
              <RecommendationItem>
                천천히 말하기부터 시작하여 각 단어의 명확한 발음에 집중하세요.
              </RecommendationItem>
              <RecommendationItem>
                전체 문장으로 넘어가기 전에 기본적인 소리와 발음을 연습하세요.
              </RecommendationItem>
              <RecommendationItem>
                발음 앱을 사용하거나 말하기 코치와 함께 개인별 맞춤 피드백을
                받아보세요.
              </RecommendationItem>
            </>
          )}
          <RecommendationItem>
            위에 강조된 단어들을 먼저 개별적으로 연습해보세요.
          </RecommendationItem>
          <RecommendationItem>
            내일 다시 돌아와서 이 연습을 반복하여 향상 정도를 확인해보세요!
          </RecommendationItem>
        </ul>
      </div>

      <button
        className={finishButtonClasses}
        onClick={() => setIsCompletionModalOpen(true)}
      >
        <span>
          <TrophyIcon />
          마무리하기
        </span>
      </button>

      {isCompletionModalOpen && (
        <CompletionModal
          isOpen={isCompletionModalOpen}
          onClose={() => setIsCompletionModalOpen(false)}
          onAIChat={handleAIChat}
          onFinish={handleFinish}
        />
      )}
    </div>
  );
};

export default AnalysisReport;
