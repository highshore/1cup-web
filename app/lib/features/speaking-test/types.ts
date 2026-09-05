export const SPEAKING_TEST_CATEGORIES = ["topic", "toefl", "free"] as const;

export type SpeakingTestCategory = (typeof SPEAKING_TEST_CATEGORIES)[number];
export type ExamModule = "listen_repeat" | "interview";

export type DeployedExam = {
  id: string;
  title: string;
  categories: SpeakingTestCategory[];
  taskCount: number;
  listenRepeatCount: number;
  interviewCount: number;
  publishedAt: string | null;
};

export type DeployedExamItem = {
  id: string;
  module: ExamModule;
  position: number;
  label: string;
  prompt: string | null;
  responseSeconds: number;
  audioUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
};

export type DeployedExamDetail = DeployedExam & {
  interviewerName: string;
  interviewerImageUrl: string | null;
  illustrationUrl: string | null;
  items: DeployedExamItem[];
};

export type RubricDimension = {
  score: number;
  evidence: string;
};

export type TaskScore = {
  itemId: string;
  taskNumber: number;
  module: ExamModule;
  score: number;
  rubricScores: Record<string, RubricDimension>;
  evidence: string;
  rationale: string;
  feedback: string;
};

export type SpeakingTestReport = {
  overall: {
    rawScore: number;
    band: string;
    cefr: string;
    summary: string;
    rationale: string;
  };
  taskScores: TaskScore[];
  strengths: string[];
  focusAreas: string[];
  reportNote: string;
};

export type SpeakingTestAttempt = {
  id: string;
  examSetId: string;
  examTitle: string;
  status: "in_progress" | "scoring" | "completed" | "abandoned" | "failed";
  score: number | null;
  band: string | null;
  cefr: string | null;
  report: SpeakingTestReport | null;
  completedAt: string | null;
};

export type AdminAttemptResponse = {
  id: string;
  taskNumber: number;
  module: ExamModule;
  durationSeconds: number;
  transcript: string;
  score: number | null;
  rubricScores: Record<string, RubricDimension>;
  rationale: string | null;
  audioUrl: string | null;
};

export type AdminExamAttempt = {
  id: string;
  memberName: string;
  memberEmail: string | null;
  status: string;
  score: number | null;
  band: string | null;
  cefr: string | null;
  report: SpeakingTestReport | null;
  completedAt: string | null;
  responses: AdminAttemptResponse[];
};
