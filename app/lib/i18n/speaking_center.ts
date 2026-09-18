const speakingCenter = {
  en: {
    navLabel: "Speaking",
    eyebrow: "EXAM PREP CENTER",
    titleLineOne: "English Exam",
    titleLineTwo: "Practice Center",
    subtitle:
      "Practice realistic English exams with timers, recording flow and structured feedback designed for focused improvement.",
    startFree: "Start Free  Test →",
    previewEyebrow: "PRACTICE TEST 01",
    previewTitle: "Give Your Opinion",
    previewPrompt:
      "Some people prefer to work in teams. Others prefer to work alone. Which do you prefer and why?",
    previewRecord: "Record Your Response",
    previewMeta: "4 tasks  ·  16 min  ·  Instant review",
    testsEyebrow: "PRACTICE TESTS",
    testsTitle: "Choose a Practice Exam",
    testsIntro:
      "Each set mirrors the real exam flow with timed preparation, recording and post-response review.",
    loading: "Loading available tests…",
    noTests: "There are no deployed practice tests available yet.",
    loadFailed: "Practice tests are temporarily unavailable.",
    type: "Type",
    difficulty: "Difficulty",
    difficultyValue: "Low",
    tasks: "tasks",
    duration: "16 min",
    start: "Start →",
    free: "FREE",
    popular: "POPULAR",
    savedTitle: "Your saved results",
    savedEmpty: "Complete a recorded test to build your score history.",
    faqEyebrow: "FAQ",
    faqTitle: "Frequently Asked Questions",
    faqIntro: "The practical details before you start recording.",
    faq: [
      {
        q: "Do I need to install anything?",
        a: "No. The practice flow is designed to run in your browser with microphone permission.",
      },
      {
        q: "Are the practice sets timed?",
        a: "Yes. Preparation and speaking timers are part of the standard practice flow.",
      },
      {
        q: "Do I need a membership to try it?",
        a: "A free starter test can be opened without committing to a full membership.",
      },
      {
        q: "Is this only for advanced speakers?",
        a: "No. The structure is useful whenever you want more disciplined timed speaking practice.",
      },
    ],
  },
  ko: {
    navLabel: "스피킹",
    eyebrow: "스피킹 센터",
    titleLineOne: "각종 영어 시험에",
    titleLineTwo: "대비하는 테스트 센터",
    subtitle:
      "실전형 스피킹 문항을 타이머와 녹음 기능으로 연습하고, 구조화된 피드백으로 개선할 부분을 확인하세요.",
    startFree: "무료로 시작 →",
    previewEyebrow: "연습 테스트 01",
    previewTitle: "내 답변 녹음하기",
    previewPrompt:
      "어떤 사람들은 팀으로 일하는 것을 선호하고, 다른 사람들은 혼자 일하는 것을 선호합니다. 여러분은 어느 쪽을 선호하며, 그 이유는 무엇인가요?",
    previewRecord: "답변 녹음하기",
    previewMeta: "4문항  ·  16분  ·  즉시 리뷰",
    testsEyebrow: "연습 테스트",
    testsTitle: "연습할 시험을 선택하세요",
    testsIntro:
      "저희 시험 세트는 준비 시간, 녹음, 답변 후 리뷰까지 실제 시험 흐름을 반영했습니다.",
    loading: "사용 가능한 테스트를 불러오는 중…",
    noTests: "아직 배포된 연습 테스트가 없습니다.",
    loadFailed: "현재 연습 테스트를 불러올 수 없습니다.",
    type: "시험 종류",
    difficulty: "난이도",
    difficultyValue: "쉬움",
    tasks: "문항",
    duration: "16분",
    start: "시작 →",
    free: "무료",
    popular: "인기",
    savedTitle: "저장된 결과",
    savedEmpty: "녹음 테스트를 완료하면 이전 점수가 이곳에 표시됩니다.",
    faqEyebrow: "FAQ",
    faqTitle: "자주 묻는 질문",
    faqIntro: "녹음을 시작하기 전에 알아두면 좋은 내용입니다.",
    faq: [
      {
        q: "녹음한 답변을 다시 들을 수 있나요?",
        a: "네. 다음 문제로 넘어가거나 다시 도전하기 전에 바로 재생해 확인할 수 있습니다.",
      },
      {
        q: "문항 하나만 따로 연습할 수 있나요?",
        a: "네. 전체 세트를 완료하지 않고 원하는 유형만 집중해서 연습할 수 있습니다.",
      },
      {
        q: "녹음한 답변은 저장되나요?",
        a: "로그인하면 연습 기록이 저장되어 이전 답변과 비교할 수 있습니다.",
      },
      {
        q: "모바일에서도 사용할 수 있나요?",
        a: "반응형으로 사용할 수 있지만, 전체 테스트와 리뷰는 노트북 환경을 권장합니다.",
      },
    ],
  },
} as const;

export default speakingCenter;
