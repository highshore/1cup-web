// Copy for the /newsletter sub-brand (daily Kakao lessons). Keep ko and en in the same shape.
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
    storefront: {
      eyebrow: "영어 한잔이 만드는 데일리 영어",
      title: "출근길 5분,\n카톡으로 오는\n영어 한 잔",
      description:
        "앱 설치 없이, 내가 정한 시간에 매일 한 레슨씩 카카오톡으로 보내드려요.",
      chooseTrack: "트랙 고르기",
      viewSample: "무료 샘플 레슨 보기",
      launchNotice: "런칭 할인 진행 중 · {deadline} 마감",
      launchNoticeDetail: "마감일이 지나면 정상가로 돌아가요. 연장하지 않아요.",
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
      whoTitle: "이런 분께 맞아요",
      sampleEyebrow: "샘플 레슨",
      sampleTitle: "실제로 이런 레슨이 와요",
      sampleCounter: "오늘의 표현 1 / 3",
      viewFullSample: "샘플 레슨 전체 보기",
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
        whoFor: [
          "영어 회의에서 할 말은 있는데 표현이 떠오르지 않는 분",
          "영어 메일 한 통에 20분씩 걸리는 분",
          "앱 알림은 꺼두지만 카톡은 매일 확인하는 분",
        ],
        sample: {
          expression: "circle back",
          meaning: "(논의를) 나중에 다시 이어가다",
          exampleEn: "Let's circle back on pricing after the launch.",
          exampleKo: "가격 얘기는 출시 후에 다시 하죠.",
        },
      },
      drama: {
        title: "미드 속 원어민 표현",
        tagline: "대사 한 줄로 배우는 진짜 구어체",
        whoFor: [
          "미드를 자막 없이 보고 싶은 분",
          "교과서 영어와 실제 말투의 차이가 궁금한 분",
          "짧게라도 매일 꾸준히 하고 싶은 분",
        ],
        sample: {
          expression: "I'm not buying it",
          meaning: "그 말 못 믿겠어",
          exampleEn: "You were stuck in traffic for three hours? I'm not buying it.",
          exampleKo: "세 시간이나 차가 막혔다고? 못 믿겠는데.",
        },
      },
      tech: {
        title: "테크 영어",
        tagline: "실리콘밸리 뉴스 속 핵심 표현",
        whoFor: [
          "테크 기사를 원문으로 읽고 싶은 분",
          "글로벌 IT 회사와 일하거나 이직을 준비하는 분",
          "스타트업·개발 용어를 영어로 정확히 쓰고 싶은 분",
        ],
        sample: {
          expression: "ship",
          meaning: "(제품·기능을) 출시하다",
          exampleEn: "The team shipped the new search feature last week.",
          exampleKo: "팀이 지난주에 새 검색 기능을 출시했어요.",
        },
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
    storefront: {
      eyebrow: "Daily English from OneCup English",
      title: "Five minutes on your commute,\none cup of English\nin KakaoTalk",
      description:
        "No app to install. One lesson a day, sent to KakaoTalk at the time you choose.",
      chooseTrack: "Choose a track",
      viewSample: "See a free sample lesson",
      launchNotice: "Launch discount · ends {deadline}",
      launchNoticeDetail:
        "After the deadline, prices go back to normal. We won't extend it.",
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
      whoTitle: "Who it's for",
      sampleEyebrow: "Sample lesson",
      sampleTitle: "Here's what a lesson looks like",
      sampleCounter: "Expression 1 / 3",
      viewFullSample: "See the full sample lesson",
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
        whoFor: [
          "You know what to say in meetings but the words don't come",
          "One English email takes you 20 minutes",
          "You mute app notifications but check KakaoTalk every day",
        ],
        sample: {
          expression: "circle back",
          meaning: "to return to a topic later",
          exampleEn: "Let's circle back on pricing after the launch.",
          exampleKo: "가격 얘기는 출시 후에 다시 하죠.",
        },
      },
      drama: {
        title: "Native expressions from TV",
        tagline: "Real spoken English, one line at a time",
        whoFor: [
          "You want to watch American shows without subtitles",
          "You wonder how textbook English differs from how people talk",
          "You want a small, steady daily habit",
        ],
        sample: {
          expression: "I'm not buying it",
          meaning: "I don't believe you",
          exampleEn: "You were stuck in traffic for three hours? I'm not buying it.",
          exampleKo: "세 시간이나 차가 막혔다고? 못 믿겠는데.",
        },
      },
      tech: {
        title: "Tech English",
        tagline: "Key expressions from Silicon Valley news",
        whoFor: [
          "You want to read tech news in the original English",
          "You work with global tech companies or plan to",
          "You want to use startup and engineering terms precisely",
        ],
        sample: {
          expression: "ship",
          meaning: "to release a product or feature",
          exampleEn: "The team shipped the new search feature last week.",
          exampleKo: "팀이 지난주에 새 검색 기능을 출시했어요.",
        },
      },
    },
  },
};

export default newsletter;
