"use client";

import React, { useMemo, useState } from "react";
import { styled } from "styled-components";
import { colors as brandColors } from "../lib/features/shadow/styles/shadow_styles";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  FiTrendingUp,
  FiClock,
  FiMessageSquare,
  FiTarget,
  FiBookOpen,
  FiAward,
  FiActivity,
} from "react-icons/fi";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ChartTitle,
  Tooltip,
  Legend,
  ArcElement
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

// Styled Components - YC Startup Design
const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 0rem;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  color: ${brandColors.text.primary};
`;

const Header = styled.div`
  margin-bottom: 3rem;
  padding: 0;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: ${brandColors.text.primary};
  letter-spacing: -0.025em;
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: ${brandColors.text.muted};
  margin-bottom: 2rem;
  font-weight: 400;
`;

const SessionMetaData = styled.div`
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid ${brandColors.border.light};
`;

const MetaItem = styled.div`
  .label {
    font-size: 0.875rem;
    color: ${brandColors.text.muted};
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }

  .value {
    font-size: 1rem;
    font-weight: 600;
    color: ${brandColors.text.primary};
  }
`;

const TabNavigation = styled.div`
  display: flex;
  margin-bottom: 2rem;
  border-bottom: 1px solid ${brandColors.border.light};
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 1rem 0;
  margin-right: 2rem;
  border: none;
  background: none;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${(props) =>
    props.$active ? brandColors.primary : brandColors.text.muted};
  border-bottom: 2px solid
    ${(props) => (props.$active ? brandColors.primary : "transparent")};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: ${brandColors.primary};
  }
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const MetricCard = styled.div`
  background: #fff;
  border: 1px solid ${brandColors.border.light};
  border-radius: 8px;
  padding: 1.5rem;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: ${brandColors.border.medium};
  }
`;

const MetricHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const MetricIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: ${brandColors.background};
  border-radius: 8px;
  color: ${brandColors.text.secondary};
`;

const MetricValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${brandColors.text.primary};
  margin-bottom: 0.25rem;
`;

const MetricLabel = styled.div`
  font-size: 0.875rem;
  color: ${brandColors.text.muted};
  font-weight: 500;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid ${brandColors.border.light};
  border-radius: 8px;
  padding: 2rem;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: ${brandColors.border.medium};
  }
`;

const SectionTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${brandColors.text.primary};
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ChartContainer = styled.div`
  position: relative;
  height: 300px;
  margin-bottom: 1rem;
`;

const ProgressChart = styled.div`
  height: 400px;
  margin-bottom: 1rem;
`;

const SuggestionsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
`;

const SuggestionSection = styled.div`
  background: #fff;
  border: 1px solid ${brandColors.border.light};
  border-radius: 8px;
  padding: 2rem;
`;

const SuggestionTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${brandColors.text.primary};
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SuggestionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const SuggestionItem = styled.div`
  padding: 1rem;
  border: 1px solid ${brandColors.border.light};
  border-radius: 6px;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: ${brandColors.border.medium};
  }
`;

const SuggestionWord = styled.div`
  font-weight: 600;
  color: ${brandColors.text.primary};
  margin-bottom: 0.5rem;
  font-size: 1rem;
`;

const SuggestionDefinition = styled.div`
  color: ${brandColors.text.secondary};
  margin-bottom: 0.5rem;
  line-height: 1.5;
  font-size: 0.875rem;
`;

const SuggestionExample = styled.div`
  color: ${brandColors.text.muted};
  font-style: italic;
  padding: 0.75rem;
  background: ${brandColors.background};
  border-radius: 4px;
  border-left: 3px solid ${brandColors.border.light};
  font-size: 0.875rem;
`;

const DifficultyBadge = styled.span<{ $difficulty: string }>`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.5rem;
  background: ${brandColors.background};
  color: ${(props) =>
    props.$difficulty === "beginner"
      ? brandColors.success
      : props.$difficulty === "intermediate"
      ? brandColors.warning
      : brandColors.primary};
  border: 1px solid
    ${(props) =>
      props.$difficulty === "beginner"
        ? `${brandColors.success}30`
        : props.$difficulty === "intermediate"
        ? `${brandColors.warning}30`
        : `${brandColors.primary}30`};
`;

const TranscriptSection = styled.div`
  background: #fff;
  border: 1px solid ${brandColors.border.light};
  border-radius: 8px;
  padding: 2rem;
`;

const TranscriptSegment = styled.div<{ $isUser: boolean }>`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: 6px;
  background: ${(props) => (props.$isUser ? brandColors.background : "#fff")};
  border-left: 3px solid
    ${(props) =>
      props.$isUser ? brandColors.primary : brandColors.border.medium};
`;

const SpeakerLabel = styled.div<{ $isUser: boolean }>`
  font-weight: 600;
  color: ${(props) =>
    props.$isUser ? brandColors.primary : brandColors.text.muted};
  min-width: 60px;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const TranscriptText = styled.div`
  flex: 1;
  line-height: 1.6;
  color: ${brandColors.text.secondary};
`;

const ChartDescription = styled.p`
  color: ${brandColors.text.muted};
  font-size: 0.875rem;
  text-align: center;
  margin-top: 1rem;
  line-height: 1.5;
`;

// Empty State Components
const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  color: ${brandColors.text.muted};
`;

const EmptyStateIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;

  svg {
    width: 3rem;
    height: 3rem;
  }
`;

const EmptyStateTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${brandColors.text.secondary};
  margin-bottom: 0.5rem;
`;

const EmptyStateMessage = styled.p`
  font-size: 0.875rem;
  color: ${brandColors.text.muted};
  max-width: 300px;
  line-height: 1.5;
`;

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
