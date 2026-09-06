"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { colors as brandColors } from "../lib/features/shadow/styles/shadow_styles";
import {
  FiTrendingUp,
  FiClock,
  FiMessageSquare,
  FiTarget,
  FiBookOpen,
  FiAward,
  FiActivity,
} from "react-icons/fi";

// chart.js is heavy and only needed once charts render — load it (and the
// Chart.js registration side-effect) from a separate chunk on demand.
const Line = dynamic(() => import("./ReportCharts").then((m) => m.Line), {
  ssr: false,
});
const Bar = dynamic(() => import("./ReportCharts").then((m) => m.Bar), {
  ssr: false,
});
const Doughnut = dynamic(
  () => import("./ReportCharts").then((m) => m.Doughnut),
  { ssr: false }
);

// Types
interface SessionData {
  id: string;
  date: string;
  topic1: string;
  topic2: string;
  speakingTime: number; // in minutes
  totalWords: number;
  wordsPerMinute: number;
  pronunciationScore: number;
  fluencyScore: number;
  coherenceScore: number;
  overallScore: number;
  suggestedWords: string[];
  suggestedExpressions: string[];
  transcript: TranscriptSegment[];
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

interface LanguageSuggestion {
  word: string;
  definition: string;
  example: string;
  category: "vocabulary" | "expression" | "pronunciation";
  difficulty: "beginner" | "intermediate" | "advanced";
}

// Layout primitives (styled-components -> Tailwind migration).
// Color values are the resolved brandColors used by the original styled blocks:
// text.primary #2c1810 (token: ink), text.secondary #3c2e26, text.muted #8d6e63,
// border.light #e8ddd4 (token: line), border.medium #d7c7b8, primary #3c2e26,
// background #faf8f6, success #4e7c59, warning #c17817.
type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ParagraphProps = React.HTMLAttributes<HTMLParagraphElement>;
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

function Container({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`mx-auto min-h-screen max-w-[1200px] px-0 py-8 text-ink [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] ${className}`}
      {...rest}
    />
  );
}

function Header({ className = "", ...rest }: DivProps) {
  return <div className={`mb-12 p-0 ${className}`} {...rest} />;
}

function Title({ className = "", ...rest }: HeadingProps) {
  return <h1 className={`mb-2 text-[2.5rem] font-bold tracking-[-0.025em] text-ink ${className}`} {...rest} />;
}

function SessionMetaData({ className = "", ...rest }: DivProps) {
  return <div className={`mb-8 flex gap-8 border-b border-line px-0 py-6 ${className}`} {...rest} />;
}

function MetaItem({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`[&_.label]:mb-1 [&_.label]:text-[0.875rem] [&_.label]:font-medium [&_.label]:uppercase [&_.label]:tracking-[0.05em] [&_.label]:text-[#8d6e63] [&_.value]:text-[1rem] [&_.value]:font-semibold [&_.value]:text-ink ${className}`}
      {...rest}
    />
  );
}

function TabNavigation({ className = "", ...rest }: DivProps) {
  return <div className={`mb-8 flex border-b border-line ${className}`} {...rest} />;
}

function Tab({ $active, className = "", ...rest }: { $active: boolean } & ButtonProps) {
  return (
    <button
      className={`mr-8 cursor-pointer border-0 border-b-2 bg-transparent px-0 py-4 text-[0.875rem] font-medium [transition:all_0.2s_ease] hover:text-[#3c2e26] ${
        $active ? "border-b-[#3c2e26] text-[#3c2e26]" : "border-b-transparent text-[#8d6e63]"
      } ${className}`}
      {...rest}
    />
  );
}

function MetricsGrid({ className = "", ...rest }: DivProps) {
  return <div className={`mb-12 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 ${className}`} {...rest} />;
}

function MetricCard({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`rounded-lg border border-line bg-white p-6 [transition:border-color_0.2s_ease] hover:border-[#d7c7b8] ${className}`}
      {...rest}
    />
  );
}

function MetricHeader({ className = "", ...rest }: DivProps) {
  return <div className={`mb-4 flex items-center justify-between ${className}`} {...rest} />;
}

function MetricIcon({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-lg bg-[#faf8f6] text-[#3c2e26] ${className}`}
      {...rest}
    />
  );
}

function MetricValue({ className = "", ...rest }: DivProps) {
  return <div className={`mb-1 text-[2rem] font-bold text-ink ${className}`} {...rest} />;
}

function MetricLabel({ className = "", ...rest }: DivProps) {
  return <div className={`text-[0.875rem] font-medium text-[#8d6e63] ${className}`} {...rest} />;
}

function ContentGrid({ className = "", ...rest }: DivProps) {
  return <div className={`mb-12 grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-8 ${className}`} {...rest} />;
}

function Card({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`rounded-lg border border-line bg-white p-8 [transition:border-color_0.2s_ease] hover:border-[#d7c7b8] ${className}`}
      {...rest}
    />
  );
}

function SectionTitle({ className = "", ...rest }: HeadingProps) {
  return <h3 className={`mb-6 flex items-center gap-2 text-[1.125rem] font-semibold text-ink ${className}`} {...rest} />;
}

function ChartContainer({ className = "", ...rest }: DivProps) {
  return <div className={`relative mb-4 h-[300px] ${className}`} {...rest} />;
}

function ProgressChart({ className = "", ...rest }: DivProps) {
  return <div className={`mb-4 h-[400px] ${className}`} {...rest} />;
}

function SuggestionsContainer({ className = "", ...rest }: DivProps) {
  return <div className={`grid grid-cols-[repeat(auto-fit,minmax(350px,1fr))] gap-8 ${className}`} {...rest} />;
}

function SuggestionSection({ className = "", ...rest }: DivProps) {
  return <div className={`rounded-lg border border-line bg-white p-8 ${className}`} {...rest} />;
}

function SuggestionTitle({ className = "", ...rest }: HeadingProps) {
  return <h3 className={`mb-6 flex items-center gap-2 text-[1.125rem] font-semibold text-ink ${className}`} {...rest} />;
}

function SuggestionList({ className = "", ...rest }: DivProps) {
  return <div className={`flex flex-col gap-4 ${className}`} {...rest} />;
}

function SuggestionItem({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`rounded-md border border-line p-4 [transition:border-color_0.2s_ease] hover:border-[#d7c7b8] ${className}`}
      {...rest}
    />
  );
}

function SuggestionWord({ className = "", ...rest }: DivProps) {
  return <div className={`mb-2 text-[1rem] font-semibold text-ink ${className}`} {...rest} />;
}

function SuggestionDefinition({ className = "", ...rest }: DivProps) {
  return <div className={`mb-2 text-[0.875rem] leading-normal text-[#3c2e26] ${className}`} {...rest} />;
}

function SuggestionExample({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`rounded border-l-[3px] border-l-[#e8ddd4] bg-[#faf8f6] p-3 text-[0.875rem] italic text-[#8d6e63] ${className}`}
      {...rest}
    />
  );
}

function DifficultyBadge({
  $difficulty,
  className = "",
  ...rest
}: { $difficulty: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const tone =
    $difficulty === "beginner"
      ? "text-[#4e7c59] border-[#4e7c5930]"
      : $difficulty === "intermediate"
      ? "text-[#c17817] border-[#c1781730]"
      : "text-[#3c2e26] border-[#3c2e2630]";
  return (
    <span
      className={`mt-2 inline-block rounded border bg-[#faf8f6] px-3 py-1 text-[0.75rem] font-medium uppercase tracking-[0.05em] ${tone} ${className}`}
      {...rest}
    />
  );
}

function TranscriptSection({ className = "", ...rest }: DivProps) {
  return <div className={`rounded-lg border border-line bg-white p-8 ${className}`} {...rest} />;
}

function TranscriptSegment({ $isUser, className = "", ...rest }: { $isUser: boolean } & DivProps) {
  return (
    <div
      className={`mb-6 flex gap-4 rounded-md border-l-[3px] p-4 ${
        $isUser ? "border-l-[#3c2e26] bg-[#faf8f6]" : "border-l-[#d7c7b8] bg-white"
      } ${className}`}
      {...rest}
    />
  );
}

function SpeakerLabel({ $isUser, className = "", ...rest }: { $isUser: boolean } & DivProps) {
  return (
    <div
      className={`min-w-[60px] text-[0.875rem] font-semibold uppercase tracking-[0.05em] ${
        $isUser ? "text-[#3c2e26]" : "text-[#8d6e63]"
      } ${className}`}
      {...rest}
    />
  );
}

function TranscriptText({ className = "", ...rest }: DivProps) {
  return <div className={`flex-1 leading-[1.6] text-[#3c2e26] ${className}`} {...rest} />;
}

function ChartDescription({ className = "", ...rest }: ParagraphProps) {
  return <p className={`mt-4 text-center text-[0.875rem] leading-normal text-[#8d6e63] ${className}`} {...rest} />;
}

// Empty State Components
function EmptyState({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-8 py-12 text-center text-[#8d6e63] ${className}`}
      {...rest}
    />
  );
}

function EmptyStateIcon({ className = "", ...rest }: DivProps) {
  return <div className={`mb-4 text-[3rem] opacity-50 [&_svg]:h-12 [&_svg]:w-12 ${className}`} {...rest} />;
}

function EmptyStateTitle({ className = "", ...rest }: HeadingProps) {
  return <h3 className={`mb-2 text-[1.125rem] font-semibold text-[#3c2e26] ${className}`} {...rest} />;
}

function EmptyStateMessage({ className = "", ...rest }: ParagraphProps) {
  return <p className={`max-w-[300px] text-[0.875rem] leading-normal text-[#8d6e63] ${className}`} {...rest} />;
}

// Real data will be loaded from props or API calls
// No dummy/fallback data - proper empty states will be shown when no data exists

export default function ReportClient() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "progress" | "suggestions" | "transcript"
  >("overview");
  const [currentSession, setCurrentSession] = useState<SessionData | null>(
    null
  );
  const [sessionHistory, setSessionHistory] = useState<SessionData[]>([]);
  const [languageSuggestions, setLanguageSuggestions] = useState<
    LanguageSuggestion[]
  >([]);

  // Coaching insights (Ringle-style): identify top strength and focus area
  const strengthsAndFocus = useMemo(() => {
    if (!currentSession) return null;
    const scorePairs = [
      { label: "Pronunciation", value: currentSession.pronunciationScore },
      { label: "Fluency", value: currentSession.fluencyScore },
      { label: "Coherence", value: currentSession.coherenceScore },
    ];
    const sorted = [...scorePairs].sort((a, b) => b.value - a.value);
    return { top: sorted[0], focus: sorted[sorted.length - 1] };
  }, [currentSession]);

  // Chart data for progress tracking - only create if we have data
  const progressData =
    sessionHistory.length > 0
      ? {
          labels: sessionHistory.map((s) =>
            new Date(s.date).toLocaleDateString()
          ),
          datasets: [
            {
              label: "Words per Minute",
              data: sessionHistory.map((s) => s.wordsPerMinute),
              borderColor: brandColors.primary,
              backgroundColor: "rgba(60, 46, 38, 0.08)",
              tension: 0.4,
              fill: true,
              borderWidth: 2,
            },
            {
              label: "Overall Score",
              data: sessionHistory.map((s) => s.overallScore),
              borderColor: brandColors.accent,
              backgroundColor: "rgba(212, 165, 116, 0.15)",
              tension: 0.4,
              fill: true,
              borderWidth: 2,
            },
          ],
        }
      : null;

  const scoreBreakdownData = currentSession
    ? {
        labels: ["Pronunciation", "Fluency", "Coherence"],
        datasets: [
          {
            data: [
              currentSession.pronunciationScore,
              currentSession.fluencyScore,
              currentSession.coherenceScore,
            ],
            backgroundColor: [
              brandColors.primary,
              brandColors.accent,
              brandColors.secondary,
            ],
            borderWidth: 0,
          },
        ],
      }
    : null;

  const speakingTimeData = currentSession
    ? {
        labels: [
          "Topic 1: " + currentSession.topic1,
          "Topic 2: " + currentSession.topic2,
        ],
        datasets: [
          {
            label: "Speaking Time (minutes)",
            data: [
              Math.round(currentSession.speakingTime * 0.6),
              Math.round(currentSession.speakingTime * 0.4),
            ],
            backgroundColor: [brandColors.primary, brandColors.secondary],
            borderRadius: 4,
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: brandColors.text.secondary,
          font: {
            family: "-apple-system, BlinkMacSystemFont, sans-serif",
            size: 12,
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: brandColors.border.light,
        },
        ticks: {
          color: brandColors.text.muted,
          font: {
            family: "-apple-system, BlinkMacSystemFont, sans-serif",
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: brandColors.border.light,
        },
        ticks: {
          color: brandColors.text.muted,
          font: {
            family: "-apple-system, BlinkMacSystemFont, sans-serif",
            size: 11,
          },
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: brandColors.text.secondary,
          font: {
            family: "-apple-system, BlinkMacSystemFont, sans-serif",
            size: 12,
          },
          padding: 20,
        },
      },
    },
  };

  const renderOverview = () => {
    if (!currentSession) {
      return (
        <EmptyState>
          <EmptyStateIcon>📊</EmptyStateIcon>
          <EmptyStateTitle>No Session Data Available</EmptyStateTitle>
          <EmptyStateMessage>
            Complete a speaking session to view your performance metrics and
            analytics.
          </EmptyStateMessage>
        </EmptyState>
      );
    }

    return (
      <>
        <MetricsGrid>
          <MetricCard>
            <MetricHeader>
              <MetricIcon>
                <FiClock />
              </MetricIcon>
            </MetricHeader>
            <MetricValue>{currentSession.speakingTime}min</MetricValue>
            <MetricLabel>Speaking Time</MetricLabel>
          </MetricCard>

          <MetricCard>
            <MetricHeader>
              <MetricIcon>
                <FiMessageSquare />
              </MetricIcon>
            </MetricHeader>
            <MetricValue>
              {currentSession.totalWords.toLocaleString()}
            </MetricValue>
            <MetricLabel>Total Words</MetricLabel>
          </MetricCard>

          <MetricCard>
            <MetricHeader>
              <MetricIcon>
                <FiActivity />
              </MetricIcon>
            </MetricHeader>
            <MetricValue>{currentSession.wordsPerMinute}</MetricValue>
            <MetricLabel>Words per Minute</MetricLabel>
          </MetricCard>

          <MetricCard>
            <MetricHeader>
              <MetricIcon>
                <FiAward />
              </MetricIcon>
            </MetricHeader>
            <MetricValue>{currentSession.overallScore}%</MetricValue>
            <MetricLabel>Overall Score</MetricLabel>
          </MetricCard>
        </MetricsGrid>

        <ContentGrid>
          <Card>
            <SectionTitle>
              <FiTarget />
              Score Breakdown
            </SectionTitle>
            {scoreBreakdownData ? (
              <>
                <ChartContainer>
                  <Doughnut
                    data={scoreBreakdownData}
                    options={doughnutOptions}
                  />
                </ChartContainer>
                <ChartDescription>
                  Performance breakdown across key speaking metrics
                </ChartDescription>
              </>
            ) : (
              <EmptyState>
                <EmptyStateMessage>No score data available</EmptyStateMessage>
              </EmptyState>
            )}
          </Card>

          <Card>
            <SectionTitle>
              <FiClock />
              Speaking Time Distribution
            </SectionTitle>
            {speakingTimeData ? (
              <>
                <ChartContainer>
                  <Bar data={speakingTimeData} options={chartOptions} />
                </ChartContainer>
                <ChartDescription>
                  Time spent discussing each topic during the session
                </ChartDescription>
              </>
            ) : (
              <EmptyState>
                <EmptyStateMessage>
                  No speaking time data available
                </EmptyStateMessage>
              </EmptyState>
            )}
          </Card>

          <Card>
            <SectionTitle>
              <FiTrendingUp /> Highlights & Focus
            </SectionTitle>
            {strengthsAndFocus ? (
              <>
                <ul
                  style={{
                    paddingLeft: "1rem",
                    color: brandColors.text.secondary,
                  }}
                >
                  <li>
                    Top strength: {strengthsAndFocus.top.label} (
                    {strengthsAndFocus.top.value}%)
                  </li>
                  <li>
                    Focus area: {strengthsAndFocus.focus.label} (
                    {strengthsAndFocus.focus.value}%)
                  </li>
                </ul>
                <ChartDescription>
                  Double down on your strength and allocate extra practice to
                  your focus area.
                </ChartDescription>
              </>
            ) : (
              <EmptyState>
                <EmptyStateMessage>
                  Highlights will appear once session scores are available
                </EmptyStateMessage>
              </EmptyState>
            )}
          </Card>
        </ContentGrid>
      </>
    );
  };

  const renderProgress = () => (
    <Card>
      <SectionTitle>
        <FiTrendingUp />
        Performance Trends
      </SectionTitle>
      {progressData ? (
        <>
          <ProgressChart>
            <Line data={progressData} options={chartOptions} />
          </ProgressChart>
          <ChartDescription>
            Track your improvement across multiple sessions. Monitor both
            speaking pace and overall performance scores over time.
          </ChartDescription>
        </>
      ) : (
        <EmptyState>
          <EmptyStateIcon>📈</EmptyStateIcon>
          <EmptyStateTitle>No Progress Data</EmptyStateTitle>
          <EmptyStateMessage>
            Complete multiple speaking sessions to view your progress trends and
            improvement over time.
          </EmptyStateMessage>
        </EmptyState>
      )}
    </Card>
  );

  const renderSuggestions = () => {
    const vocabularySuggestions = languageSuggestions.filter(
      (s) => s.category === "vocabulary"
    );
    const expressionSuggestions = languageSuggestions.filter(
      (s) => s.category === "expression"
    );

    if (languageSuggestions.length === 0) {
      return (
        <EmptyState>
          <EmptyStateIcon>
            <FiBookOpen />
          </EmptyStateIcon>
          <EmptyStateTitle>No Language Suggestions</EmptyStateTitle>
          <EmptyStateMessage>
            Complete speaking sessions to receive personalized vocabulary and
            expression recommendations.
          </EmptyStateMessage>
        </EmptyState>
      );
    }

    return (
      <SuggestionsContainer>
        <SuggestionSection>
          <SuggestionTitle>
            <FiBookOpen />
            Recommended Vocabulary
          </SuggestionTitle>
          <SuggestionList>
            {vocabularySuggestions.length > 0 ? (
              vocabularySuggestions.map((suggestion, index) => (
                <SuggestionItem key={index}>
                  <SuggestionWord>{suggestion.word}</SuggestionWord>
                  <SuggestionDefinition>
                    {suggestion.definition}
                  </SuggestionDefinition>
                  <SuggestionExample>"{suggestion.example}"</SuggestionExample>
                  <DifficultyBadge $difficulty={suggestion.difficulty}>
                    {suggestion.difficulty}
                  </DifficultyBadge>
                </SuggestionItem>
              ))
            ) : (
              <EmptyStateMessage>
                No vocabulary suggestions available
              </EmptyStateMessage>
            )}
          </SuggestionList>
        </SuggestionSection>

        <SuggestionSection>
          <SuggestionTitle>
            <FiMessageSquare />
            Useful Expressions
          </SuggestionTitle>
          <SuggestionList>
            {expressionSuggestions.length > 0 ? (
              expressionSuggestions.map((suggestion, index) => (
                <SuggestionItem key={index}>
                  <SuggestionWord>{suggestion.word}</SuggestionWord>
                  <SuggestionDefinition>
                    {suggestion.definition}
                  </SuggestionDefinition>
                  <SuggestionExample>"{suggestion.example}"</SuggestionExample>
                  <DifficultyBadge $difficulty={suggestion.difficulty}>
                    {suggestion.difficulty}
                  </DifficultyBadge>
                </SuggestionItem>
              ))
            ) : (
              <EmptyStateMessage>
                No expression suggestions available
              </EmptyStateMessage>
            )}
          </SuggestionList>
        </SuggestionSection>
      </SuggestionsContainer>
    );
  };

  const renderTranscript = () => {
    const hasTranscript =
      currentSession &&
      currentSession.transcript &&
      currentSession.transcript.length > 0;

    return (
      <TranscriptSection>
        <SectionTitle>
          <FiMessageSquare />
          Session Transcript
        </SectionTitle>
        {hasTranscript ? (
          <>
            <ChartDescription
              style={{ textAlign: "left", marginBottom: "2rem" }}
            >
              Review your conversation with detailed analysis. Areas for
              improvement are highlighted below.
            </ChartDescription>
            {currentSession!.transcript.map((segment, index) => (
              <TranscriptSegment
                key={index}
                $isUser={segment.speaker === "user"}
              >
                <SpeakerLabel $isUser={segment.speaker === "user"}>
                  {segment.speaker === "user" ? "You" : "AI"}
                </SpeakerLabel>
                <TranscriptText>{segment.text}</TranscriptText>
              </TranscriptSegment>
            ))}
          </>
        ) : (
          <EmptyState>
            <EmptyStateIcon>
              <FiMessageSquare />
            </EmptyStateIcon>
            <EmptyStateTitle>No Transcript Available</EmptyStateTitle>
            <EmptyStateMessage>
              Complete a speaking session to view your detailed conversation
              transcript and analysis.
            </EmptyStateMessage>
          </EmptyState>
        )}
      </TranscriptSection>
    );
  };

  return (
    <Container>
      <Header>
        <Title>Speaking Analytics</Title>
        {currentSession && (
          <SessionMetaData>
            <MetaItem>
              <div className="label">Session Date</div>
              <div className="value">
                {new Date(currentSession.date).toLocaleDateString()}
              </div>
            </MetaItem>
            <MetaItem>
              <div className="label">Topic 1</div>
              <div className="value">{currentSession.topic1}</div>
            </MetaItem>
            <MetaItem>
              <div className="label">Topic 2</div>
              <div className="value">{currentSession.topic2}</div>
            </MetaItem>
          </SessionMetaData>
        )}
      </Header>

      <TabNavigation>
        <Tab
          $active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </Tab>
        <Tab
          $active={activeTab === "progress"}
          onClick={() => setActiveTab("progress")}
        >
          Progress
        </Tab>
        <Tab
          $active={activeTab === "suggestions"}
          onClick={() => setActiveTab("suggestions")}
        >
          Language Tips
        </Tab>
        <Tab
          $active={activeTab === "transcript"}
          onClick={() => setActiveTab("transcript")}
        >
          Transcript
        </Tab>
      </TabNavigation>

      {activeTab === "overview" && renderOverview()}
      {activeTab === "progress" && renderProgress()}
      {activeTab === "suggestions" && renderSuggestions()}
      {activeTab === "transcript" && renderTranscript()}
    </Container>
  );
}
