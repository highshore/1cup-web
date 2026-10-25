// Copy for /daily (영어 한잔 Daily). Korean only by decision: the product is sold in Korea
// and is not localized. Founder credentials are the founder-approved wording; never add
// names, schools or employers.
export const dailyCopy = {
  nav: {
    brand: "DAILY",
    home: "1cup 홈",
    cta: "무료로 받기",
    menu: "메뉴 열기",
    links: [
      { href: "/daily#tracks", label: "트랙" },
      { href: "/daily#lesson", label: "레슨 미리보기" },
      { href: "/daily#founder", label: "만든 사람" },
      { href: "/daily#pricing", label: "가격" },
      { href: "/daily#faq", label: "자주 묻는 질문" },
    ],
  },
  hero: {
    tagline: "통역사가 매일 직접 올리는 카톡 영어",
    title: "출근길 5분,\n카톡으로 오는\n영어 한잔",
    accent: "영어 한잔",
    lead: "통역사가 매일 아침 회의와 테크 현장에서 바로 쓰는 표현 하나를 카카오톡으로 올려드려요.",
    cta: "하루 무료로 받아보기",
    trust: ["첫 하루 무료", "앱 설치 없음", "언제든 해지"],
    notification: { app: "영어 한잔", time: "지금", body: "오늘의 영어 표현이 도착했어요 ☕" },
    demoLabel: "카카오톡으로 온 오늘의 표현을 누르면 오늘의 레슨 페이지가 열리는 화면",
  },
  kakao: {
    channel: "영어 한잔",
    date: "10월 27일 화요일",
    alimtalk: "알림톡 도착",
    intro: "[비즈니스 영어] 오늘의 표현",
    expression: "circle back",
    meaning: "(논의를) 나중에 다시 이어가다",
    example: "Let's circle back on pricing after the launch.",
    open: "오늘의 레슨 보기",
    time: "오전 8:00",
    input: "메시지 입력",
  },
  photo: {
    badge: "앱 설치 NO",
    title: "카톡만 열면\n오늘 영어 끝",
    body: "지하철에서, 커피 내리면서. 알림 하나로 시작해요.",
    alt: "출근길 지하철에서 휴대폰으로 카카오톡 알림을 확인하는 손",
  },
  pain: {
    title: "영어 회의,\n머리가 하얘지나요?",
    accent: "머리가 하얘지나요?",
    items: [
      "할 말은 있는데 \"I think...\"에서 멈춰요",
      "메일 한 통에 번역기를 세 번 돌려요",
      "외국계 공고, 영어 면접 때문에 망설여요",
    ],
    goalTitle: "이런 순간을 위해\n만들었어요",
    goalAccent: "만들었어요",
    goals: ["회의에서 한 문장으로 말하기 💬", "메일 첫 줄 바로 쓰기 ✉️", "동료 표현 바로 알아듣기 👂"],
  },
  benefits: {
    title: "카톡으로 매일 받는\n비즈니스·테크 영어",
    accent: "비즈니스·테크 영어",
    items: [
      { emoji: "📱", label: "휴대폰", title: "앱 설치 NO", detail: "카톡으로 매일 자동 발송" },
      { emoji: "⏰", label: "알람 시계", title: "하루 딱 5분", detail: "출근길에 읽고 듣고 끝" },
      { emoji: "🎁", label: "선물", title: "첫 하루 무료", detail: "받아보고 결정하세요" },
      { emoji: "🔁", label: "반복", title: "언제든 해지", detail: "약정 없이 한 달 단위" },
    ],
  },
  lesson: {
    title: "오늘의 카톡이\n도착했어요!",
    accent: "도착했어요!",
    sub: "알림을 누르면 이런 레슨 페이지가 열려요",
    callouts: { audio: "발음 듣기", nuance: "뜻·뉘앙스", examples: "예문 3개", quiz: "1분 퀴즈" },
    screen: {
      expression: "circle back",
      listen: "듣기",
      meaningLabel: "뜻",
      meaning: "(논의를) 나중에 다시 이어가다",
      nuanceLabel: "이럴 때 써요",
      nuance:
        "결론을 지금 내지 않고 다음에 다시 다루자고 할 때. 'talk later'보다 업무적이고 정중해요.",
      examplesLabel: "실제 사용 예시",
      examples: [
        { en: "Let's circle back on pricing after the launch.", ko: "가격 얘기는 출시 후에 다시 하죠." },
        { en: "Can we circle back to this on Friday?", ko: "이건 금요일에 다시 얘기할 수 있을까요?" },
      ],
      url: "1cupenglish.com",
    },
  },
  expressions: {
    title: "뻔한 기초 영어 ❌\n실제로 쓰는 표현 ✅",
    accent: "실제로 쓰는 표현",
    items: [
      { type: "구동사", en: "loop in", ko: "(논의에) 끌어들이다" },
      { type: "관용구", en: "on the same page", ko: "같은 이해를 공유하는" },
      { type: "업계 용어", en: "ship", ko: "(제품·기능을) 출시하다" },
    ],
  },
  beforeAfter: {
    title: "같은 말도\n이렇게 달라져요",
    accent: "이렇게 달라져요",
    before: "Before",
    after: "After",
    pairs: [
      { before: "I will tell you later.", after: "I'll circle back once I have the numbers.", highlight: "circle back" },
      { before: "Please add him to the email.", after: "Could you loop him in on this thread?", highlight: "loop him in" },
      { before: "The old code makes work slow.", after: "Tech debt is slowing us down.", highlight: "Tech debt" },
    ],
  },
  scenes: {
    title: "이럴 때\n바로 써요",
    accent: "바로 써요",
    items: [
      { icon: "meeting", title: "회의", detail: "의견을 한 문장으로" },
      { icon: "mail", title: "메일", detail: "첫 줄부터 자연스럽게" },
      { icon: "chat", title: "1:1 미팅", detail: "부드럽게 피드백" },
      { icon: "standup", title: "스탠드업", detail: "진행 상황을 짧게" },
    ],
  },
  tracks: {
    title: "두 가지 트랙 중\n골라서 받아요",
    accent: "골라서 받아요",
    free: "첫 하루 무료",
    price: "이후 월 ₩{price}",
    items: [
      {
        key: "business",
        emoji: "💼",
        emojiLabel: "서류 가방",
        title: "비즈니스 영어",
        tagline: "회의·메일에서 바로 쓰는 표현",
        image: "/assets/daily/meeting.webp",
        alt: "노트북과 커피가 놓인 사무실 회의 테이블",
      },
      {
        key: "tech",
        emoji: "🚀",
        emojiLabel: "로켓",
        title: "테크 영어",
        tagline: "실리콘밸리 뉴스 속 핵심 표현",
        image: "/assets/daily/devdesk.webp",
        alt: "코드가 띄워진 노트북과 커피잔이 있는 아침 책상",
      },
    ],
  },
  founder: {
    label: "만든 사람",
    title: "2,000번 이상의 회의를 통역하며\n실제로 오간 표현만 고릅니다",
    accent: "실제로 오간 표현만 고릅니다",
    credentials: [
      { icon: "office", title: "대기업 임원 통역사" },
      { icon: "globe", title: "실리콘밸리 기업 통역사" },
      { icon: "shield", title: "용산 미군기지 통역병" },
      { icon: "school", title: "SKY 학부 출신" },
      { icon: "chip", title: "Fortune 500 기업 경력" },
    ],
  },
  pricing: {
    title: "첫 하루는\n무료예요",
    accent: "무료예요",
    trial: "먼저 하루 무료로 받아보고, 마음에 들면 아래에서 골라요.",
    subscription: {
      badge: "가장 저렴해요",
      name: "30일 정기구독",
      espresso: "스타벅스 에스프레소 한 잔 값으로 30일",
      period: "30일마다 자동 결제",
      benefits: ["평일 원하는 시간에 카카오톡으로", "토요일엔 한 주 복습", "오늘의 표현 · 예문 3개 · 발음 · 1분 퀴즈", "약정 없이 언제든 해지"],
    },
    passes: {
      title: "자동 결제 없이 한 번만 결제",
      perMonth: "월 ₩{price}",
    },
    cta: "하루 무료로 받아보기",
    note: "결제는 페이플(Payple)로 안전하게 처리돼요. 무료 체험에는 카드 등록이 필요 없어요.",
    terms: "이용약관 · 환불 규정",
  },
  faq: {
    title: "자주 묻는 질문",
    items: [
      {
        q: "무료 하루는 어떻게 받나요?",
        a: "신청하면 오늘의 레슨 1회를 바로 카카오톡으로 보내드려요. 카드 등록은 필요 없고, 계속 받고 싶을 때만 구독하면 돼요.",
      },
      {
        q: "정기구독과 이용권은 뭐가 달라요?",
        a: "정기구독은 30일마다 ₩3,700이 자동 결제되고 언제든 해지할 수 있어요. 이용권은 1·3·6개월을 한 번에 결제하고 자동 결제가 없어요. 한 달 기준 가격은 정기구독이 가장 저렴해요.",
      },
      {
        q: "카톡이 오지 않아요",
        a: "레슨은 카카오 알림톡으로 가서 채널을 추가하지 않아도 받을 수 있어요. 신청한 번호로 카카오톡을 쓰고 있는지 확인해주세요. 카카오톡으로 보내지 못하면 같은 내용을 문자로 보내드려요.",
      },
      {
        q: "받는 시간을 바꾸고 싶어요",
        a: "내 구독 페이지에서 받는 시간을 언제든 바꿀 수 있어요. 바꾼 시간은 다음 레슨부터 적용돼요.",
      },
      {
        q: "선물할 수 있나요?",
        a: "선물하기는 준비하고 있어요. 열리면 이곳에서 안내할게요.",
      },
      {
        q: "해지와 환불은 어떻게 하나요?",
        a: "정기구독은 언제든 해지할 수 있고, 해지하면 다음 결제일부터 청구되지 않아요. 결제 후 7일 이내에는 전액, 그 이후에는 남은 기간만큼 환불돼요. 자세한 기준은 이용약관에서 확인할 수 있어요.",
      },
    ],
  },
  sticky: { title: "첫 하루 무료", sub: "이후 월 ₩{price} · 언제든 해지", cta: "받아보기" },
  soon: "곧 오픈",
  operatedBy: "영어 한잔 Daily는 영어 한잔이 운영해요.",
} as const;
