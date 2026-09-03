export type ExamInterviewerStatus = "pending" | "approved" | "rejected";
export type ExamMediaStatus = "idle" | "generating" | "ready" | "failed";
export type ExamSetStatus = "draft" | "media_ready" | "published" | "archived";
export type ExamModule = "listen_repeat" | "interview";

export type ExamInterviewer = {
  id: string;
  name: string;
  gender: "Female" | "Male" | "Nonbinary";
  occupation: string;
  attire: string;
  personality: string;
  voice_tone: string;
  avatar_key: string;
  status: ExamInterviewerStatus;
  image_status: ExamMediaStatus;
  video_status: ExamMediaStatus;
  media_mode: "browser_preview" | "uploaded" | "generated";
  created_at: string;
  updated_at: string;
};

export type ExamSetSummary = {
  id: string;
  title: string;
  interviewer_id: string;
  status: ExamSetStatus;
  listen_repeat_theme: string;
  interview_theme: string;
  scene_description: string;
  media_mode: "browser_preview" | "uploaded" | "generated";
  published_at: string | null;
  created_at: string;
  updated_at: string;
  interviewer?: Pick<ExamInterviewer, "id" | "name" | "avatar_key" | "occupation" | "status"> | null;
  item_count?: number;
  ready_item_count?: number;
};

export type ExamNarration = {
  id: string;
  exam_set_id: string;
  cue_key: "section_intro" | "listen_repeat_instructions" | "listen_repeat_scenario" | "interview_instructions" | "interview_scenario";
  label: string;
  script: string;
  source: "fixed" | "authored" | "generated";
  media_status: ExamMediaStatus;
  position: number;
};

export type ExamItem = {
  id: string;
  exam_set_id: string;
  module: ExamModule;
  position: number;
  label: string;
  prompt: string;
  response_seconds: number;
  visual_target: string;
  audio_status: ExamMediaStatus;
  visual_status: ExamMediaStatus;
  video_status: ExamMediaStatus;
  media_mode: "browser_preview" | "uploaded" | "generated";
};

export type ExamSetDetail = ExamSetSummary & {
  interviewer: ExamInterviewer;
  narration: ExamNarration[];
  items: ExamItem[];
};

export type ExamCenterOverview = {
  interviewers: ExamInterviewer[];
  sets: ExamSetSummary[];
};

export const EXAM_FORMAT_COPY = {
  sectionIntro:
    "In the Speaking section, you will answer up to 11 questions to demonstrate how well you can speak English. There are two types of tasks.",
  listenInstructions:
    "You will listen as someone speaks to you. Listen carefully and then repeat what you have heard. The clock indicates your speaking time. There is no preparation time.",
  interviewInstructions:
    "An interviewer will ask you questions. Answer the questions and be sure to say as much as you can in the time allowed. There is no preparation time.",
} as const;
