const speakingCenter = {
  en: {
    eyebrow: "Exam prep center",
    titleLineOne: "English Exam",
    titleLineTwo: "Practice Center",
    subtitle:
      "Practice realistic English exams with timers, recording flow and structured feedback designed for focused improvement.",
    startFree: "Start a Practice Test →",
    previewEyebrow: "PRACTICE TEST 01",
    previewTitle: "Give Your Opinion",
    previewPrompt:
      "Some people prefer to work in teams. Others prefer to work alone. Which do you prefer and why?",
    previewRecord: "Record Your Response",
    previewMeta: "Timed practice · Instant review",
    testsEyebrow: "Practice tests",
    testsTitle: "Choose a Practice Exam",
    testsIntro:
      "Each set mirrors the real exam flow with timed preparation, recording and post-response review.",
    loading: "Loading available tests…",
    noTests: "There are no deployed practice tests available yet.",
    loadFailed: "Practice tests are temporarily unavailable.",
    type: "Type",
    difficulty: "Difficulty",
    difficultyValue: "—",
    tasks: "tasks",
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
        a: "No. The practice flow runs in your browser with microphone permission.",
      },
      {
        q: "Are the practice sets timed?",
        a: "Yes. Preparation and speaking timers are part of the standard practice flow.",
      },
      {
        q: "Do I need a membership to try it?",
        a: "No paid membership is required for the current practice flow. Sign-in is required to record responses and save scores.",
      },
      {
        q: "Is this only for advanced speakers?",
        a: "No. The structure is useful whenever you want more disciplined timed speaking practice.",
      },
    ],
  },
  ko: {
    eyebrow: "시험 대비 센터",
    titleLineOne: "영어 시험",
    titleLineTwo: "연습 센터",
    subtitle:
      "타이머와 녹음, 구조화된 피드백을 활용해 실제 시험과 유사한 영어 말하기 연습을 집중적으로 진행하세요.",
    startFree: "연습 테스트 시작 →",
    previewEyebrow: "연습 테스트 01",
    previewTitle: "의견 말하기",
    previewPrompt:
      "어떤 사람들은 팀으로 일하는 것을 선호하고, 다른 사람들은 혼자 일하는 것을 선호합니다. 여러분은 어느 쪽을 선호하며 그 이유는 무엇인가요?",
    previewRecord: "답변 녹음하기",
    previewMeta: "시간 제한 연습 · 즉시 리뷰",
    testsEyebrow: "연습 테스트",
    testsTitle: "연습 시험 선택하기",
    testsIntro:
      "각 세트는 준비 시간, 녹음, 답변 후 리뷰까지 실제 시험의 흐름을 반영합니다.",
    loading: "사용 가능한 테스트를 불러오는 중…",
    noTests: "아직 배포된 연습 테스트가 없습니다.",
    loadFailed: "현재 연습 테스트를 불러올 수 없습니다.",
    type: "유형",
    difficulty: "난이도",
    difficultyValue: "—",
    tasks: "문항",
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
        q: "별도로 설치해야 하나요?",
        a: "아니요. 마이크 권한만 허용하면 브라우저에서 바로 연습할 수 있습니다.",
      },
      {
        q: "연습 세트에도 제한 시간이 있나요?",
        a: "네. 실제 연습 흐름에 맞춰 준비 시간과 답변 시간이 제공됩니다.",
      },
      {
        q: "사용하려면 멤버십이 필요한가요?",
        a: "현재 연습 기능은 유료 멤버십 없이 이용할 수 있습니다. 답변 녹음과 점수 저장을 위해서는 로그인이 필요합니다.",
      },
      {
        q: "상급자만 사용할 수 있나요?",
        a: "아니요. 제한 시간 안에 체계적으로 말하는 연습이 필요한 누구에게나 유용합니다.",
      },
    ],
  },
} as const;

export default speakingCenter;
