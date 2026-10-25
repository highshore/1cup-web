// Copy for /daily (영어 한잔 Daily). Korean only by decision: the product is sold in Korea
// and is not localized. Founder credentials are the founder-approved wording; never add
// names, schools or employers.
export const dailyCopy = {
  nav: {
    brand: "DAILY",
    cta: "무료로 받기",
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
      { emoji: "💬", label: "말풍선", title: "앱 설치 NO", detail: "카톡으로 매일 자동 발송" },
      { emoji: "⏰", label: "알람 시계", title: "하루 딱 5분", detail: "출근길에 읽고 듣고 끝" },
      { emoji: "🎁", label: "선물", title: "첫 하루 무료", detail: "받아보고 결정하세요" },
      { emoji: "👋", label: "손 흔들기", title: "언제든 해지", detail: "약정 없이 한 달 단위" },
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
  // Mastery (RAMP): progress people can see. Every item here is a product promise:
  // the quiz and Saturday review exist in the delivery design; the streak and 내 표현장
  // belong on the lesson page and must ship with it.
  mastery: {
    title: "매일 조금씩,\n확실히 쌓여요",
    accent: "확실히 쌓여요",
    sub: "읽고 끝나지 않게, 내 것이 될 때까지 이어서 챙겨요.",
    steps: [
      { emoji: "🎯", label: "과녁", title: "1분 퀴즈", detail: "레슨 끝에 바로 풀고, 정답과 이유까지 확인해요" },
      { emoji: "🧠", label: "뇌", title: "토요일 복습", detail: "그 주에 받은 표현을 한 번에 다시 꺼내 봐요" },
      { emoji: "🔥", label: "불꽃", title: "연속 기록", detail: "며칠째 이어 왔는지 레슨 페이지에서 보여줘요" },
      { emoji: "📚", label: "책", title: "내 표현장", detail: "받은 표현이 모두 쌓여 언제든 다시 볼 수 있어요" },
    ],
    card: {
      label: "예시 화면",
      streak: "5일 연속",
      days: ["월", "화", "수", "목", "금"],
      rows: [
        { label: "이번 주 표현", value: "5/5" },
        { label: "토요일 복습 퀴즈", value: "4/5 정답" },
        { label: "내 표현장", value: "23개" },
      ],
    },
  },
  // Relatedness (RAMP): other learners are visible where the lesson happens.
  // Product promises: the shared sentence wall with ☕ reactions, a daily 통역사 PICK,
  // real "together" numbers that appear only once 10+ people are behind them (never
  // invented), and the invite reward (both get 7 days; terms 제5조의2).
  relatedness: {
    title: "같은 표현으로\n함께 쓰는 사람들",
    accent: "함께 쓰는 사람들",
    sub: "레슨을 읽고 끝내지 않아요. 같은 날 같은 표현을 받은 사람들과 문장으로 이어져요.",
    feed: {
      label: "예시 화면",
      heading: "오늘의 표현",
      expression: "circle back",
      together: "오늘 아침 비즈니스 트랙에서 같은 표현을 받은 사람 128명",
      prompt: "오늘 표현으로 한 문장 써보기…",
      send: "올리기",
      pick: "통역사 PICK",
      sentences: [
        { name: "익명의 PM", initial: "P", text: "Let's circle back on the timeline after QA.", cups: 12, pick: true },
        { name: "마케터 J", initial: "J", text: "I'll circle back with the final numbers by Friday.", cups: 8, pick: false },
        { name: "익명", initial: "?", text: "Can we circle back to the hiring plan next sprint?", cups: 5, pick: false },
      ],
    },
    points: [
      {
        emoji: "✍️",
        label: "글 쓰는 손",
        title: "함께 쓰는 문장",
        detail: "퀴즈를 풀고 나면 오늘 표현으로 한 문장을 써요. 같은 표현으로 다른 사람들이 쓴 문장을 보고 ☕로 응원해요.",
      },
      {
        emoji: "🏆",
        label: "트로피",
        title: "통역사 PICK",
        detail: "통역사가 매일 잘 쓴 문장을 골라 다음 날 레슨에 소개해요. 이름을 밝힐지 익명으로 할지는 직접 정해요.",
      },
      {
        emoji: "📊",
        label: "막대 그래프",
        title: "같이 푼 퀴즈",
        detail: "같은 날 같은 퀴즈를 푼 사람들의 정답률과 가장 헷갈린 보기를 보여줘요. 10명 이상 모였을 때부터, 실제 숫자로만요.",
      },
      {
        emoji: "💌",
        label: "편지",
        title: "친구 초대하면 둘 다 7일 더",
        detail: "초대한 친구가 구독하면 두 사람 모두 7일을 더 받아요. 오늘의 표현 카드도 카톡으로 바로 보낼 수 있어요.",
      },
    ],
  },
  // Shown only once 3+ reviews from verified customers are approved; never seeded.
  reviews: {
    title: "먼저 받아본\n사람들의 후기",
    accent: "사람들의 후기",
    verified: "인증된 구독자",
    anonymous: "익명",
    lessons: "레슨 {count}개 받음",
  },
  tracks: {
    title: "두 가지 트랙 중\n골라서 받아요",
    accent: "골라서 받아요",
    free: "첫 하루 무료",
    price: "이후 월 ₩{price}",
    items: [
      {
        key: "business",
        emoji: "🤝",
        emojiLabel: "악수",
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
    subscribeNow: "체험 없이 바로 구독하기",
    note: "결제는 페이플(Payple)로 안전하게 처리돼요. 무료 체험에는 카드 등록이 필요 없어요.",
    terms: "이용약관 · 환불 규정",
    guide: "이용 가이드",
  },
  faq: {
    title: "자주 묻는 질문",
    more: "신청부터 환불까지 자세한 방법은",
    moreSuffix: "에서 볼 수 있어요.",
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
        a: "레슨은 카카오 알림톡으로 가서 채널을 추가하지 않아도 받을 수 있어요. 신청한 번호로 카카오톡을 쓰고 있는지 확인해주세요. 지금은 카카오톡으로만 보내드려요.",
      },
      {
        q: "받는 시간을 바꾸고 싶어요",
        a: "hello@1cupenglish.com으로 신청한 번호와 원하는 시간을 보내주시면 바꿔드려요. 직접 바꾸는 화면은 준비하고 있어요.",
      },
      {
        q: "친구를 초대하면 혜택이 있나요?",
        a: "네. 내 초대 링크로 들어온 친구가 처음 구독하거나 이용권을 결제하면, 두 사람 모두 7일을 더 받아요. 정기구독은 다음 결제일이 7일 늦춰지고, 이용권은 끝나는 날이 7일 늘어나요.",
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
  // /daily/guide. Describes only what works today; anything not built yet is listed
  // under `soon` and must move out of it in the same change that ships it.
  guide: {
    title: "이용 가이드",
    lead: "신청부터 매일 받는 레슨, 결제와 해지, 환불까지. 영어 한잔 Daily를 쓰는 방법을 한곳에 모았어요.",
    contents: "이 페이지에서",
    week: {
      title: "일주일은 이렇게 흘러가요",
      sub: "신청할 때 고른 시간에 맞춰 카카오톡으로 와요.",
      days: [
        { day: "월", kind: "lesson" },
        { day: "화", kind: "lesson" },
        { day: "수", kind: "lesson" },
        { day: "목", kind: "lesson" },
        { day: "금", kind: "lesson" },
        { day: "토", kind: "review" },
        { day: "일", kind: "rest" },
      ],
      kinds: { lesson: "새 표현", review: "한 주 복습", rest: "쉬어요" },
      note: "토요일 복습은 그 주에 받은 레슨이 있을 때만 와요. 공휴일에도 평일과 똑같이 와요.",
    },
    start: {
      id: "start",
      title: "무료 체험 신청하기",
      sub: "카드 등록 없이 레슨 1회를 먼저 받아봐요. 1분이면 끝나요.",
      steps: [
        { title: "트랙 고르기", detail: "회의·메일에서 쓰는 비즈니스 영어, 실리콘밸리 뉴스 속 테크 영어 중 하나를 골라요." },
        { title: "받는 시간 고르기", detail: "오전 6시부터 밤 10시까지 30분 단위로 골라요. 출근길에 읽을 수 있는 시간이 좋아요." },
        { title: "휴대폰 번호 인증", detail: "레슨을 받을 번호로 인증번호를 받아 입력해요. 회원가입이나 비밀번호는 없어요." },
        { title: "약관 동의", detail: "이용약관, 개인정보 처리, 레슨 메시지 수신에 동의해요. 이벤트 소식 수신은 선택이에요." },
        { title: "첫 레슨 받기", detail: "신청을 마치면 오늘의 레슨이 바로 카카오톡으로 와요." },
      ],
      rules: [
        "무료 체험은 번호마다 트랙별로 한 번씩이에요. 비즈니스와 테크를 각각 한 번씩 받아볼 수 있어요.",
        "체험 다음 발송 시간(최소 12시간 뒤)에 체험이 끝났다는 안내가 와요. 그 뒤로는 구독해야 계속 받아요.",
      ],
      cta: "하루 무료로 받아보기",
    },
    receive: {
      id: "receive",
      title: "카카오톡으로 레슨 받기",
      items: [
        { emoji: "💬", label: "말풍선", title: "'영어 한잔' 알림톡으로 와요", detail: "채널을 추가하지 않아도 받아요. 신청한 번호로 카카오톡을 쓰고 있어야 해요." },
        { emoji: "👆", label: "가리키는 손", title: "'오늘의 레슨 보기'를 눌러요", detail: "메시지 버튼을 누르면 카카오톡 안에서 오늘의 레슨 페이지가 열려요. 앱 설치는 필요 없어요." },
        { emoji: "🔑", label: "열쇠", title: "버튼으로 열면 자동으로 로그인돼요", detail: "메시지를 받은 뒤 14일 동안은 버튼만 눌러도 내 계정으로 들어가요. 후기도 바로 남길 수 있어요." },
      ],
    },
    lesson: {
      id: "lesson",
      title: "레슨 페이지 200% 쓰기",
      sub: "위에서부터 차례로 읽으면 5분이에요.",
      parts: [
        { emoji: "🔊", label: "스피커", title: "오늘의 표현과 발음", detail: "'발음 듣기'를 누르면 또박또박 조금 천천히 읽어줘요. 발음과 강세 위치도 함께 적혀 있어요." },
        { emoji: "💡", label: "전구", title: "이럴 때 써요", detail: "어떤 상황에서, 어떤 뉘앙스로 쓰는지 통역사가 짚어줘요. 비슷한 표현도 함께 있어요." },
        { emoji: "🗣️", label: "말하는 얼굴", title: "실제 사용 예시", detail: "회의·메일·슬랙에서 실제로 쓰는 문장이에요. 문장마다 듣기 버튼이 있어요." },
        { emoji: "💬", label: "말풍선", title: "대화로 보기", detail: "짧은 대화 속에서 표현이 어떻게 오가는지 보고, 전체를 이어서 들을 수 있어요." },
        { emoji: "⚡", label: "번개", title: "1분 퀴즈", detail: "방금 배운 표현으로 문제를 풀면 정답과 이유를 바로 알려줘요." },
        { emoji: "📤", label: "보내기", title: "동료에게 보내기", detail: "오늘의 표현과 Daily 소개 링크를 보내요. 내 레슨 링크는 들어가지 않아요." },
      ],
      tip: "소리가 나지 않으면 휴대폰 무음 모드를 풀어주세요. 듣기는 휴대폰에 설치된 영어 음성으로 읽어줘요.",
    },
    signin: {
      id: "signin",
      title: "로그인과 본인 확인",
      items: [
        { title: "평소엔 버튼으로 바로", detail: "카카오톡 메시지의 버튼으로 들어오면 따로 로그인하지 않아도 돼요." },
        { title: "결제·신청·해지는 인증번호 한 번", detail: "버튼으로 들어온 상태에서 결제, 새 트랙 신청, 자동 결제 해지를 하려면 내 번호로 가는 인증번호를 한 번 입력해요. 화면에는 010-****-1234처럼 가린 번호만 보여요." },
        { title: "메시지는 그대로 전달하지 마세요", detail: "메시지 버튼은 내 계정으로 들어가는 링크예요. 친구에게 알려주고 싶다면 레슨 페이지의 '동료에게 보내기'를 써주세요." },
        { title: "다른 기기에서는 번호로", detail: "PC나 다른 브라우저에서는 신청·구독 페이지에서 휴대폰 번호 인증으로 들어와요." },
      ],
    },
    subscribe: {
      id: "subscribe",
      title: "구독하기",
      sub: "체험이 끝났다는 메시지의 버튼이나 레슨 페이지의 '구독 안내 보기'에서 시작해요.",
      planHeader: { name: "상품", price: "가격", how: "결제 방식" },
      subscription: { name: "30일 정기구독", how: "30일마다 자동 결제 · 언제든 해지" },
      passHow: "한 번만 결제 · 자동 결제 없음",
      steps: [
        "상품, 트랙, 받는 시간을 골라요.",
        "약관과 환불 규정에 동의해요.",
        "페이플 결제창에서 카드를 등록하면 그 자리에서 결제돼요.",
        "결제 결과 화면이 뜨면 끝이에요. 다음 발송 시간부터 레슨이 와요.",
      ],
      notes: [
        "한 달 기준으로는 정기구독이 가장 저렴해요.",
        "정기구독 중에 이용권을 결제하면 남은 기간 뒤로 이어지고, 자동 결제는 꺼져요.",
        "자동 결제는 다음 결제일 하루 전에 돼요. 실패하면 하루에 한 번씩 최대 3번 다시 시도하고, 결제될 때까지 레슨은 잠시 멈춰요. 세 번 모두 실패하면 구독이 끝나요.",
      ],
      cta: "구독 안내 보기",
    },
    manage: {
      id: "manage",
      title: "해지와 변경",
      items: [
        { title: "자동 결제 해지", detail: "구독 안내 페이지의 '자동 결제 해지'를 누르면 돼요. 이미 결제한 기간이 끝날 때까지는 계속 받아요." },
        { title: "받는 시간·트랙·이름 바꾸기", detail: "지금은 hello@1cupenglish.com으로 신청한 번호와 바꿀 내용을 보내주시면 바꿔드려요. 직접 바꾸는 화면은 준비하고 있어요." },
      ],
    },
    refund: {
      id: "refund",
      title: "환불",
      rules: [
        { title: "결제 후 7일 이내", detail: "결제 완료 시점부터 7일(168시간) 안에 요청하면 실제 결제 금액을 전액 환불해요. 정기구독의 매 회차 결제도 똑같아요." },
        { title: "7일이 지난 뒤", detail: "남은 기간만큼 환불해요. 지난 날짜는 24시간 단위로 올려서 계산해요." },
      ],
      exampleTitle: "예를 들어",
      example: "3개월 이용권(₩13,500)을 결제하고 30일이 지나 요청하면, ₩13,500 × 60 ÷ 90 = ₩9,000을 돌려드려요.",
      how: "신청한 휴대폰 번호와 함께 이메일이나 전화로 요청해 주세요. 결제한 카드의 승인 취소로 처리되고, 반영까지 영업일 기준 3~7일이 걸릴 수 있어요.",
      terms: "환불 규정 전문 보기",
    },
    review: {
      id: "review",
      title: "후기 남기기",
      detail: "레슨을 한 번이라도 받았다면 레슨 페이지 아래 '레슨이 어땠나요?'에서 별점과 한 줄 후기를 남길 수 있어요. 확인을 거쳐 소개 페이지에 올라가고, 이름 대신 익명으로 남겨도 돼요.",
    },
    soon: {
      id: "soon",
      title: "준비하고 있어요",
      sub: "아직 쓸 수 없는 기능이에요. 열리면 이 페이지에 바로 반영할게요.",
      items: ["함께 쓰는 문장과 통역사 PICK", "연속 기록과 내 표현장", "친구 초대 (둘 다 7일 더)", "받는 시간을 직접 바꾸는 내 계정 화면", "선물하기"],
    },
    help: {
      id: "help",
      title: "문제가 생겼을 때",
      items: [
        {
          q: "카카오톡이 오지 않아요",
          a: "신청한 번호로 카카오톡을 쓰고 있는지 확인해 주세요. '영어 한잔' 채널을 차단했다면 알림톡도 오지 않으니 차단을 풀어주세요. 그래도 오지 않으면 번호와 함께 알려주세요.",
        },
        {
          q: "인증번호가 오지 않아요",
          a: "인증번호도 카카오톡으로 가요. 30초가 지나면 '다시 받기'를 누를 수 있고, 한 번호로는 한 시간에 다섯 번까지 받을 수 있어요.",
        },
        {
          q: "결제를 처리하고 있다는 화면에서 멈췄어요",
          a: "다시 결제하지 말고 잠시 뒤 새로고침해 주세요. 계속 같은 화면이면 화면의 주문번호(DLY로 시작)와 함께 알려주세요. 두 번 청구되는 일이 없도록 확인해 드려요.",
        },
        {
          q: "결제하기 버튼 대신 인증번호 칸이 보여요",
          a: "카카오톡 버튼으로 들어온 상태라서 그래요. 가린 번호로 인증번호를 한 번 받아 입력하면 결제할 수 있어요.",
        },
        {
          q: "레슨 링크가 열리지 않아요",
          a: "메시지 버튼으로 다시 열어주세요. 주소를 손으로 옮기면 글자가 빠지기 쉬워요. 그래도 열리지 않으면 메시지를 받은 날짜와 함께 알려주세요.",
        },
      ],
    },
    contact: {
      title: "그래도 해결되지 않으면",
      detail: "신청한 휴대폰 번호와 함께 보내주시면 가장 빨리 확인할 수 있어요.",
    },
  },
  sticky: { title: "첫 하루 무료", sub: "이후 월 ₩{price} · 언제든 해지", cta: "받아보기" },
  soon: "곧 오픈",
  operatedBy: "영어 한잔 Daily는 영어 한잔이 운영해요.",
  emojiCredit: "애니메이션 이모지: Noto Animated Emoji by Google, CC BY 4.0",
} as const;
