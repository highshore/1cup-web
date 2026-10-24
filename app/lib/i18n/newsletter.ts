// Copy for the /newsletter sub-brand (daily Kakao lessons). Keep ko and en in the same shape.
// Author credentials were approved by the founder for public use; keep names, schools and
// employers out of this file.
const newsletter = {
  ko: {
    brand: {
      name: "1cup Daily",
      endorsement: "by 영어 한잔",
      operatedBy: "1cup Daily는 영어 한잔이 운영해요.",
    },
    price: {
      amount: "₩{price}",
      perMonth: "/ 월",
      perMonthShort: "₩{price}/월",
      member: "영어 한잔 멤버 ₩{price} / 월",
      memberShort: "1cup 멤버 ₩{price}",
    },
    demo: {
      today: "오늘",
      yesterday: "어제",
      alimtalk: "알림톡 도착",
      messageIntro: "[{track}] 오늘의 표현",
      openLesson: "오늘의 레슨 보기",
      listen: "듣기",
      listening: "재생 중",
      tapToListen: "예문을 누르면 발음을 들을 수 있어요",
      subtitlesEn: "영어 자막",
      subtitlesKo: "한글 자막",
      newsSource: "Tech news",
    },
    author: {
      eyebrow: "만든 사람",
      photoCaption: "영어 한잔 오프라인 모임 현장",
      photoAlt: "영어 한잔 오프라인 모임에서 멤버들이 테이블에 둘러앉아 영어로 이야기하는 모습",
      title: "매일 레슨은\n통역사가 직접 고르고 씁니다",
      description:
        "교과서 예문이 아니라, 수천 번의 비즈니스 미팅을 통역하며 실제로 오간 표현을 기준으로 고릅니다. 영어 한잔 오프라인 모임을 설계하고 이끄는 통역사가 레슨 하나하나를 직접 씁니다.",
      credentials: [
        {
          icon: "work",
          title: "대기업·IT 유니콘 기업 통역사 4년+",
          detail: "수천 건의 미팅 통역",
        },
        {
          icon: "military",
          title: "한미연합군사령부 영어 통역병",
          detail: "어학병 복무",
        },
        {
          icon: "score",
          title: "New TOEFL 6.0 만점",
          detail: "iBT 118 · OPIc AL",
        },
        { icon: "school", title: "SKY 대학 컴퓨터학과", detail: "재학 중" },
        { icon: "company", title: "현 Fortune 500 기업", detail: "재직 중" },
      ],
    },
    storefront: {
      eyebrow: "영어 한잔이 만드는 데일리 영어",
      title: "출근길 5분,\n카톡으로 오는\n영어 한 잔",
      description:
        "통역사가 매일 고른 표현 하나를, 내가 정한 시간에 카카오톡으로 보내드려요. 앱 설치도 필요 없어요.",
      chooseTrack: "트랙 고르기",
      viewSample: "무료 샘플 레슨 보기",
      launchNotice: "런칭 할인 진행 중 · {deadline} 마감",
      launchNoticeDetail: "마감일이 지나면 정상가로 돌아가요. 연장하지 않아요.",
      coffeeEyebrow: "하루 5분",
      coffeeTitle: "커피 한 잔 내리는 시간이면\n오늘의 레슨이 끝나요",
      coffeeDescription:
        "레슨 하나는 표현 3개와 예문, 발음 음성, 1분 퀴즈로 끝나요. 커피를 내리는 동안 읽고 들으면 됩니다.",
      marqueeEyebrow: "표현 미리보기",
      marqueeTitle: "이런 표현들이\n매일 카톡으로 와요",
      tracksEyebrow: "트랙 안내",
      tracksTitle: "세 가지 트랙",
      tracksDescription: "트랙마다 따로 구독해요. 여러 개를 함께 받아도 돼요.",
      coverEyebrow: "매일 아침 카톡으로",
      howEyebrow: "이용 방법",
      howTitle: "이렇게 받아요",
      howSteps: [
        {
          title: "트랙을 고르고 결제해요",
          description: "월 ₩{price} · 언제든 해지할 수 있어요",
        },
        {
          title: "받을 시간을 정해요",
          description: "오전 6시부터 밤 11시까지, 30분 단위로 직접 골라요",
        },
        {
          title: "매일 카톡으로 레슨이 와요",
          description:
            "표현 3개 · 발음 음성 · 1분 퀴즈가 담긴 레슨 페이지로 연결돼요",
        },
      ],
      howNote: "레슨을 받으려면 카카오톡 채널 추가가 필요해요.",
      memberEyebrow: "영어 한잔 멤버 혜택",
      memberTitle: "멤버는 모든 트랙 50% 할인",
      memberDescription:
        "영어 한잔 정기 멤버십 회원은 로그인하면 결제 금액에 자동으로 적용돼요.",
      memberLogin: "로그인하고 할인 받기",
      memberEligible: "멤버 할인 대상이에요. 결제할 때 자동으로 적용돼요.",
      memberJoin: "영어 한잔 멤버십 알아보기",
      reviewsTitle: "구매평",
      reviewsEmptyTitle: "아직 구매평이 없어요",
      reviewsEmptyDescription:
        "구독자만 작성할 수 있어요. 첫 후기가 이곳에 올라와요.",
      faqTitle: "자주 묻는 질문",
      faq: [
        {
          q: "카톡이 오지 않아요",
          a: "결제할 때 입력한 번호의 카카오톡에서 1cup Daily 채널을 추가했는지 확인해주세요. 채널을 추가하지 않으면 메시지가 오지 않아요. 그래도 오지 않으면 문의하기로 알려주세요.",
        },
        {
          q: "받는 시간을 바꾸고 싶어요",
          a: "내 구독 페이지에서 받는 요일과 시간을 언제든 바꿀 수 있어요. 바꾼 시간은 다음 레슨부터 적용돼요.",
        },
        {
          q: "선물은 어떻게 하나요?",
          a: "구독 신청에서 '선물하기'를 고르고 받는 분의 휴대폰 번호를 입력하면 돼요. 받는 분이 채널을 추가하면 레슨이 시작돼요.",
        },
        {
          q: "해지와 환불은 어떻게 하나요?",
          a: "내 구독 페이지에서 언제든 해지할 수 있고, 해지하면 다음 결제일부터 청구되지 않아요. 환불 기준은 구독 오픈 전에 이곳에 안내할게요.",
        },
        {
          q: "영어 한잔 멤버가 아니어도 구독할 수 있나요?",
          a: "네. 휴대폰 번호만 있으면 누구나 구독할 수 있어요. 영어 한잔 정기 멤버십 회원은 50% 할인을 받아요.",
        },
      ],
    },
    detail: {
      pricingSuffix: "데일리",
      facts: [
        { label: "받는 방법", value: "카카오톡 알림톡 + 웹 레슨" },
        { label: "받는 시간", value: "직접 설정 (30분 단위)" },
        { label: "결제", value: "매월 자동 결제 · 언제든 해지" },
        { label: "구성", value: "표현 3개 · 발음 음성 · 1분 퀴즈" },
      ],
      painEyebrow: "혹시 이런 적 있나요?",
      coverCaption: "회의에서 바로 쓰는 한 문장",
      gainTitle: "이런 순간을 위해 만들었어요",
      pillsTitle: "카톡으로 매일 받는\n{track}",
      pills: [
        { title: "앱 설치 없이", detail: "카카오톡으로 바로 와요" },
        { title: "하루 5분", detail: "출근길에 읽고 듣고 끝내요" },
        { title: "받는 시간은 직접", detail: "30분 단위로 정해요" },
        { title: "언제든 해지", detail: "약정이 없어요" },
      ],
      lessonEyebrow: "오늘의 레슨",
      lessonTitle: "오늘의 카톡이\n도착했어요",
      kakaoTag: "알림톡",
      kakaoNotice: "오늘의 영어 표현이 도착했습니다.",
      kakaoTime: "오전 8:00",
      meaningLabel: "뜻",
      nuanceLabel: "이럴 때 써요",
      examplesLabel: "실제 사용 예시",
      similarLabel: "비슷한 표현",
      audioNote: "모든 예문은 발음 음성과 함께 와요.",
      notBasicEyebrow: "뻔한 기초 영어는 그만",
      notBasicTitle: "실제로 쓰는 관용구와\n구동사를 배워요",
      beforeAfterEyebrow: "Before → After",
      beforeAfterTitle: "같은 말도\n이렇게 달라집니다",
      beforeLabel: "Before",
      afterLabel: "After",
      scenesTitle: "이런 순간에 바로 써요",
      whoTitle: "이런 분께 맞아요",
      reviewsTitle: "구매평 0",
      reviewsEmpty: "아직 구매평이 없어요. 구독자만 작성할 수 있어요.",
      gift: "선물하기",
      subscribe: "구독하기 · ₩{price}/월",
      comingSoon: "구독 오픈 준비 중",
    },
    tracks: {
      business: {
        title: "비즈니스 영어",
        tagline: "회의·메일에서 바로 쓰는 표현",
        painTitle: "회의가 끝나고 나서야\n하고 싶은 말이 떠오르나요?",
        pains: [
          "할 말은 있는데, 영어로는 \"I think...\"에서 멈춰요.",
          "메일 한 통 보내기 전에 번역기를 세 번 돌려요.",
          "외국계 공고를 보고도 영어 면접 때문에 망설여요.",
        ],
        gains: [
          "회의에서 내 의견을 한 문장으로 정리해 말하는 순간",
          "메일 첫 줄을 망설이지 않고 쓰는 순간",
          "동료가 쓰는 표현을 듣자마자 알아듣는 순간",
        ],
        lesson: {
          expression: "circle back",
          meaning: "(논의를) 나중에 다시 이어가다",
          nuance:
            "결론을 지금 내지 않고 다음에 다시 다루자고 할 때 씁니다. 'talk later'보다 업무적이고 정중해요.",
          examples: [
            {
              en: "Let's circle back on pricing after the launch.",
              ko: "가격 얘기는 출시 후에 다시 하죠.",
            },
            {
              en: "Can we circle back to this on Friday?",
              ko: "이건 금요일에 다시 얘기할 수 있을까요?",
            },
            {
              en: "I'll circle back once I hear from legal.",
              ko: "법무팀 답이 오면 다시 연락드릴게요.",
            },
          ],
          similar: ["follow up on", "revisit", "touch base"],
        },
        notBasic: [
          { type: "구동사", en: "loop in", ko: "(논의에) 끌어들이다, 참조로 넣다" },
          { type: "관용구", en: "on the same page", ko: "같은 이해를 공유하는" },
          { type: "관용구", en: "move the needle", ko: "눈에 띄는 변화를 만들다" },
        ],
        beforeAfter: [
          {
            before: "I will tell you later.",
            after: "I'll circle back once I have the numbers.",
            highlight: "circle back",
          },
          {
            before: "Please add him to the email.",
            after: "Could you loop him in on this thread?",
            highlight: "loop him in",
          },
          {
            before: "Do you understand my point?",
            after: "Just to make sure we're on the same page...",
            highlight: "on the same page",
          },
        ],
        scenes: ["회의", "메일", "보고", "1:1 미팅"],
        whoFor: [
          "영어 회의에서 할 말은 있는데 표현이 떠오르지 않는 분",
          "영어 메일 한 통에 20분씩 걸리는 분",
          "앱 알림은 꺼두지만 카톡은 매일 확인하는 분",
        ],
      },
      drama: {
        title: "미드 속 원어민 표현",
        tagline: "대사 한 줄로 배우는 진짜 구어체",
        painTitle: "자막을 끄면\n대사가 소리로만 들리나요?",
        pains: [
          "단어는 다 아는데, 말이 빨라서 놓쳐요.",
          "교과서 영어로 말하면 어색하다는 말을 들어요.",
          "원어민 친구의 농담에 한 박자 늦게 웃어요.",
        ],
        gains: [
          "자막 없이 장면의 뉘앙스를 따라가는 순간",
          "같은 말도 상황에 맞는 말투로 골라 쓰는 순간",
          "짧은 리액션으로 대화에 자연스럽게 끼어드는 순간",
        ],
        lesson: {
          expression: "I'm not buying it",
          meaning: "그 말 못 믿겠어",
          nuance:
            "상대 말이 그럴듯하지 않을 때 가볍게 의심을 표현해요. 'I don't believe you'보다 덜 공격적이에요.",
          examples: [
            {
              en: "You were stuck in traffic for three hours? I'm not buying it.",
              ko: "세 시간이나 차가 막혔다고? 못 믿겠는데.",
            },
            {
              en: "He says he's fine, but I'm not buying it.",
              ko: "괜찮다는데, 난 안 믿겨.",
            },
            {
              en: "Nice try, but I'm not buying it.",
              ko: "시도는 좋았는데, 안 넘어가.",
            },
          ],
          similar: ["I don't buy it", "Yeah, right", "Get out of here"],
        },
        notBasic: [
          { type: "구동사", en: "blow off", ko: "(약속·일을) 무시하다, 바람맞히다" },
          { type: "관용구", en: "spill the tea", ko: "(소문·뒷얘기를) 털어놓다" },
          { type: "관용구", en: "read the room", ko: "분위기를 파악하다" },
        ],
        beforeAfter: [
          {
            before: "I don't believe you.",
            after: "Nice try, but I'm not buying it.",
            highlight: "I'm not buying it",
          },
          {
            before: "He didn't come to the meeting.",
            after: "He totally blew off the meeting.",
            highlight: "blew off",
          },
          {
            before: "Tell me the gossip.",
            after: "Okay, spill the tea.",
            highlight: "spill the tea",
          },
        ],
        scenes: ["친구와 대화", "리액션", "농담", "감정 표현"],
        whoFor: [
          "미드를 자막 없이 보고 싶은 분",
          "교과서 영어와 실제 말투의 차이가 궁금한 분",
          "짧게라도 매일 꾸준히 하고 싶은 분",
        ],
      },
      tech: {
        title: "테크 영어",
        tagline: "실리콘밸리 뉴스 속 핵심 표현",
        painTitle: "테크 기사, 단어는 아는데\n문장이 안 읽히나요?",
        pains: [
          "'ship', 'scale' 같은 쉬운 단어가 기사에선 다른 뜻이에요.",
          "해외 개발 문서와 회의록을 번역기로 읽어요.",
          "글로벌 팀 스탠드업에서 진행 상황을 설명하기 어려워요.",
        ],
        gains: [
          "테크 뉴스 헤드라인의 뜻을 바로 잡는 순간",
          "스탠드업에서 진행 상황을 짧고 정확하게 말하는 순간",
          "PR 설명과 문서를 영어로 망설이지 않고 쓰는 순간",
        ],
        lesson: {
          expression: "ship",
          meaning: "(제품·기능을) 출시하다",
          nuance:
            "테크 업계에서는 'release'보다 훨씬 자주 써요. 코드나 기능을 실제 사용자에게 내보낸다는 느낌이에요.",
          examples: [
            {
              en: "The team shipped the new search feature last week.",
              ko: "팀이 지난주에 새 검색 기능을 출시했어요.",
            },
            {
              en: "We need to ship this before the holiday freeze.",
              ko: "연휴 배포 동결 전에 이걸 출시해야 해요.",
            },
            {
              en: "Ship it, then iterate.",
              ko: "일단 내보내고, 개선은 그다음에.",
            },
          ],
          similar: ["roll out", "launch", "go live"],
        },
        notBasic: [
          { type: "구동사", en: "roll out", ko: "(단계적으로) 배포하다" },
          { type: "업계 용어", en: "dogfood", ko: "(자사 제품을) 직접 써보다" },
          { type: "업계 용어", en: "tech debt", ko: "기술 부채" },
        ],
        beforeAfter: [
          {
            before: "We will make the feature available to everyone slowly.",
            after: "We're rolling the feature out gradually.",
            highlight: "rolling the feature out",
          },
          {
            before: "Our employees use our product first.",
            after: "We dogfood everything before launch.",
            highlight: "dogfood",
          },
          {
            before: "The old code makes new work slow.",
            after: "Tech debt is slowing us down.",
            highlight: "Tech debt",
          },
        ],
        scenes: ["스탠드업", "코드 리뷰", "테크 뉴스", "기술 문서"],
        whoFor: [
          "테크 기사를 원문으로 읽고 싶은 분",
          "글로벌 IT 회사와 일하거나 이직을 준비하는 분",
          "스타트업·개발 용어를 영어로 정확히 쓰고 싶은 분",
        ],
      },
    },
  },
  en: {
    brand: {
      name: "1cup Daily",
      endorsement: "by OneCup English",
      operatedBy: "1cup Daily is run by OneCup English.",
    },
    price: {
      amount: "₩{price}",
      perMonth: "/ month",
      perMonthShort: "₩{price}/mo",
      member: "OneCup members ₩{price} / month",
      memberShort: "Members ₩{price}",
    },
    demo: {
      today: "Today",
      yesterday: "Yesterday",
      alimtalk: "New Alimtalk",
      messageIntro: "[{track}] Today's expression",
      openLesson: "Open today's lesson",
      listen: "Listen",
      listening: "Playing",
      tapToListen: "Tap an example to hear it",
      subtitlesEn: "English subtitles",
      subtitlesKo: "Korean subtitles",
      newsSource: "Tech news",
    },
    author: {
      eyebrow: "Who writes it",
      photoCaption: "A OneCup English offline meetup",
      photoAlt: "OneCup English members around a table at an offline meetup, talking in English",
      title: "Every lesson is picked\nand written by an interpreter",
      description:
        "Not textbook examples: we pick expressions that actually came up across thousands of interpreted business meetings. The interpreter who designs and leads OneCup English's offline meetups writes every lesson personally.",
      credentials: [
        {
          icon: "work",
          title: "4+ years interpreting at large corporations and an IT unicorn",
          detail: "Thousands of meetings interpreted",
        },
        {
          icon: "military",
          title: "English interpreter, ROK–US Combined Forces Command",
          detail: "Military language specialist",
        },
        {
          icon: "score",
          title: "Perfect score on the new TOEFL (6.0)",
          detail: "iBT 118 · OPIc AL",
        },
        {
          icon: "school",
          title: "Computer science at a SKY university",
          detail: "Currently enrolled",
        },
        {
          icon: "company",
          title: "Fortune 500 company",
          detail: "Currently employed",
        },
      ],
    },
    storefront: {
      eyebrow: "Daily English from OneCup English",
      title: "Five minutes on your commute,\none cup of English\nin KakaoTalk",
      description:
        "One expression a day, picked by an interpreter and sent to KakaoTalk at the time you choose. No app to install.",
      chooseTrack: "Choose a track",
      viewSample: "See a free sample lesson",
      launchNotice: "Launch discount · ends {deadline}",
      launchNoticeDetail:
        "After the deadline, prices go back to normal. We won't extend it.",
      coffeeEyebrow: "5 minutes a day",
      coffeeTitle: "Today's lesson takes\nas long as a pour-over",
      coffeeDescription:
        "Each lesson is 3 expressions with examples, pronunciation audio and a 1-minute quiz. Read and listen while your coffee brews.",
      marqueeEyebrow: "Expression preview",
      marqueeTitle: "Expressions like these\narrive every day",
      tracksEyebrow: "Tracks",
      tracksTitle: "Three tracks",
      tracksDescription:
        "Each track is a separate subscription. You can take more than one.",
      coverEyebrow: "Every morning in KakaoTalk",
      howEyebrow: "How it works",
      howTitle: "Here's how you get it",
      howSteps: [
        {
          title: "Pick a track and subscribe",
          description: "₩{price} a month · cancel anytime",
        },
        {
          title: "Choose your delivery time",
          description: "Anywhere from 6 AM to 11 PM, in 30-minute steps",
        },
        {
          title: "Get a lesson in KakaoTalk every day",
          description:
            "It links to a lesson page with 3 expressions, pronunciation audio and a 1-minute quiz",
        },
      ],
      howNote: "You need to add our KakaoTalk channel to receive lessons.",
      memberEyebrow: "OneCup member benefit",
      memberTitle: "Members get 50% off every track",
      memberDescription:
        "OneCup English members get the discount applied automatically when logged in.",
      memberLogin: "Log in for the discount",
      memberEligible:
        "You're eligible for the member discount. It's applied at checkout.",
      memberJoin: "Learn about OneCup membership",
      reviewsTitle: "Reviews",
      reviewsEmptyTitle: "No reviews yet",
      reviewsEmptyDescription:
        "Only subscribers can write reviews. The first ones will appear here.",
      faqTitle: "FAQ",
      faq: [
        {
          q: "I'm not getting KakaoTalk messages",
          a: "Check that you added the 1cup Daily channel in KakaoTalk on the number you entered at checkout. Messages don't arrive until you add the channel. If they still don't come, contact us.",
        },
        {
          q: "I want to change my delivery time",
          a: "You can change your delivery days and time anytime on the My subscription page. Changes apply from the next lesson.",
        },
        {
          q: "How do I give it as a gift?",
          a: "Choose 'Gift' when subscribing and enter the recipient's phone number. Lessons start once they add the channel.",
        },
        {
          q: "How do cancellations and refunds work?",
          a: "You can cancel anytime on the My subscription page, and you won't be charged from the next billing date. We'll post the refund policy here before subscriptions open.",
        },
        {
          q: "Can I subscribe without a OneCup membership?",
          a: "Yes. Anyone with a phone number can subscribe. OneCup English members get 50% off.",
        },
      ],
    },
    detail: {
      pricingSuffix: "Daily",
      facts: [
        { label: "Delivery", value: "KakaoTalk message + web lesson" },
        { label: "Time", value: "You choose (30-minute steps)" },
        { label: "Billing", value: "Monthly · cancel anytime" },
        {
          label: "Includes",
          value: "3 expressions · pronunciation audio · 1-minute quiz",
        },
      ],
      painEyebrow: "Sound familiar?",
      coverCaption: "One sentence you can use in today's meeting",
      gainTitle: "We built it for moments like these",
      pillsTitle: "{track},\ndelivered to KakaoTalk daily",
      pills: [
        { title: "No app", detail: "It arrives in KakaoTalk" },
        { title: "5 minutes a day", detail: "Read and listen on your commute" },
        { title: "Your time", detail: "Pick it in 30-minute steps" },
        { title: "Cancel anytime", detail: "No contract" },
      ],
      lessonEyebrow: "Today's lesson",
      lessonTitle: "Today's KakaoTalk\njust arrived",
      kakaoTag: "Alimtalk",
      kakaoNotice: "Today's English expression is here.",
      kakaoTime: "8:00 AM",
      meaningLabel: "Meaning",
      nuanceLabel: "When to use it",
      examplesLabel: "Real examples",
      similarLabel: "Similar expressions",
      audioNote: "Every example comes with pronunciation audio.",
      notBasicEyebrow: "Beyond basic English",
      notBasicTitle: "Learn the idioms and\nphrasal verbs people actually use",
      beforeAfterEyebrow: "Before → After",
      beforeAfterTitle: "Say the same thing,\nbetter",
      beforeLabel: "Before",
      afterLabel: "After",
      scenesTitle: "Use it right away in",
      whoTitle: "Who it's for",
      reviewsTitle: "Reviews 0",
      reviewsEmpty: "No reviews yet. Only subscribers can write them.",
      gift: "Gift",
      subscribe: "Subscribe · ₩{price}/mo",
      comingSoon: "Subscriptions opening soon",
    },
    tracks: {
      business: {
        title: "Business English",
        tagline: "Expressions for meetings and email",
        painTitle: "Do the right words only come\nafter the meeting ends?",
        pains: [
          "You know what to say, but your English stops at \"I think...\"",
          "You run every email through a translator three times.",
          "You see a job at a global company and hesitate over the English interview.",
        ],
        gains: [
          "Making your point in one clear sentence in a meeting",
          "Writing the first line of an email without hesitating",
          "Catching a colleague's expression the moment you hear it",
        ],
        lesson: {
          expression: "circle back",
          meaning: "to return to a topic later",
          nuance:
            "Use it when you'd rather settle something later. It sounds more professional and polite than 'talk later'.",
          examples: [
            {
              en: "Let's circle back on pricing after the launch.",
              ko: "가격 얘기는 출시 후에 다시 하죠.",
            },
            {
              en: "Can we circle back to this on Friday?",
              ko: "이건 금요일에 다시 얘기할 수 있을까요?",
            },
            {
              en: "I'll circle back once I hear from legal.",
              ko: "법무팀 답이 오면 다시 연락드릴게요.",
            },
          ],
          similar: ["follow up on", "revisit", "touch base"],
        },
        notBasic: [
          { type: "Phrasal verb", en: "loop in", ko: "to bring someone into a discussion" },
          { type: "Idiom", en: "on the same page", ko: "sharing the same understanding" },
          { type: "Idiom", en: "move the needle", ko: "to make a noticeable difference" },
        ],
        beforeAfter: [
          {
            before: "I will tell you later.",
            after: "I'll circle back once I have the numbers.",
            highlight: "circle back",
          },
          {
            before: "Please add him to the email.",
            after: "Could you loop him in on this thread?",
            highlight: "loop him in",
          },
          {
            before: "Do you understand my point?",
            after: "Just to make sure we're on the same page...",
            highlight: "on the same page",
          },
        ],
        scenes: ["Meetings", "Email", "Reports", "1:1s"],
        whoFor: [
          "You know what to say in meetings but the words don't come",
          "One English email takes you 20 minutes",
          "You mute app notifications but check KakaoTalk every day",
        ],
      },
      drama: {
        title: "Native expressions from TV",
        tagline: "Real spoken English, one line at a time",
        painTitle: "Turn off the subtitles and\nthe dialogue turns into noise?",
        pains: [
          "You know every word, but they talk too fast.",
          "People say your textbook English sounds stiff.",
          "You laugh a beat late at your friend's jokes.",
        ],
        gains: [
          "Following a scene's nuance without subtitles",
          "Choosing the right tone for the same message",
          "Jumping into a conversation with a quick reaction",
        ],
        lesson: {
          expression: "I'm not buying it",
          meaning: "I don't believe you",
          nuance:
            "A light way to say you doubt what someone said. Less confrontational than 'I don't believe you'.",
          examples: [
            {
              en: "You were stuck in traffic for three hours? I'm not buying it.",
              ko: "세 시간이나 차가 막혔다고? 못 믿겠는데.",
            },
            {
              en: "He says he's fine, but I'm not buying it.",
              ko: "괜찮다는데, 난 안 믿겨.",
            },
            {
              en: "Nice try, but I'm not buying it.",
              ko: "시도는 좋았는데, 안 넘어가.",
            },
          ],
          similar: ["I don't buy it", "Yeah, right", "Get out of here"],
        },
        notBasic: [
          { type: "Phrasal verb", en: "blow off", ko: "to skip or ignore a plan" },
          { type: "Idiom", en: "spill the tea", ko: "to share the gossip" },
          { type: "Idiom", en: "read the room", ko: "to sense the mood" },
        ],
        beforeAfter: [
          {
            before: "I don't believe you.",
            after: "Nice try, but I'm not buying it.",
            highlight: "I'm not buying it",
          },
          {
            before: "He didn't come to the meeting.",
            after: "He totally blew off the meeting.",
            highlight: "blew off",
          },
          {
            before: "Tell me the gossip.",
            after: "Okay, spill the tea.",
            highlight: "spill the tea",
          },
        ],
        scenes: ["Chatting with friends", "Reactions", "Jokes", "Feelings"],
        whoFor: [
          "You want to watch American shows without subtitles",
          "You wonder how textbook English differs from how people talk",
          "You want a small, steady daily habit",
        ],
      },
      tech: {
        title: "Tech English",
        tagline: "Key expressions from Silicon Valley news",
        painTitle: "You know the words in tech news,\nbut the sentences don't click?",
        pains: [
          "Easy words like 'ship' and 'scale' mean something else in articles.",
          "You read engineering docs and meeting notes through a translator.",
          "Explaining your progress at a global team's standup is hard.",
        ],
        gains: [
          "Getting a tech headline at first read",
          "Giving a short, precise update at standup",
          "Writing PR descriptions and docs in English without hesitating",
        ],
        lesson: {
          expression: "ship",
          meaning: "to release a product or feature",
          nuance:
            "Far more common than 'release' in tech. It means getting code or a feature out to real users.",
          examples: [
            {
              en: "The team shipped the new search feature last week.",
              ko: "팀이 지난주에 새 검색 기능을 출시했어요.",
            },
            {
              en: "We need to ship this before the holiday freeze.",
              ko: "연휴 배포 동결 전에 이걸 출시해야 해요.",
            },
            {
              en: "Ship it, then iterate.",
              ko: "일단 내보내고, 개선은 그다음에.",
            },
          ],
          similar: ["roll out", "launch", "go live"],
        },
        notBasic: [
          { type: "Phrasal verb", en: "roll out", ko: "to release in stages" },
          { type: "Industry term", en: "dogfood", ko: "to use your own product internally" },
          { type: "Industry term", en: "tech debt", ko: "accumulated shortcuts in code" },
        ],
        beforeAfter: [
          {
            before: "We will make the feature available to everyone slowly.",
            after: "We're rolling the feature out gradually.",
            highlight: "rolling the feature out",
          },
          {
            before: "Our employees use our product first.",
            after: "We dogfood everything before launch.",
            highlight: "dogfood",
          },
          {
            before: "The old code makes new work slow.",
            after: "Tech debt is slowing us down.",
            highlight: "Tech debt",
          },
        ],
        scenes: ["Standups", "Code review", "Tech news", "Docs"],
        whoFor: [
          "You want to read tech news in the original English",
          "You work with global tech companies or plan to",
          "You want to use startup and engineering terms precisely",
        ],
      },
    },
  },
};

export default newsletter;
