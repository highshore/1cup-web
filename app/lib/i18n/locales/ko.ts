const ko = {
  common: {
    loading: "로딩 중...",
    error: "오류가 발생했습니다.",
  },
  nav: {
    about: "소개",
    topics: "주제",
    reviews: "후기",
    pricing: "멤버십",
    login: "로그인",
    join: "참여하기",
    shadowing: "쉐도잉",
    meetup: "밋업",
    leaderboard: "리더보드",
    blog: "블로그",
  },
  home: {
    hero: {
      title: "서울에서 만나는\n비즈니스 영어\n커뮤니티",
      mobileTitle: "서울에서 만나는\n비즈니스 영어 커뮤니티",
      subtitle: "국내파 통번역사가 작정하고 개발한\n국내 최고 퀄리티 영어 모임",
      mobileSubtitle: "국내파 통역사가 손수 개발한\n국내 최고 영어 스피킹 모임",
      eventPrompt: "바로 지금! 통역사가 직접 리딩하는 영어 모임에 참여해보세요!",
    },
    cta: {
      title: "영어 소통 능력을 키우고 싶다면?",
      description: "통역사, 직장인, 대학생, 전문가 등 다양한 백그라운드를 가진\n멤버들과 함께하는 영어 밋업에 참여해보세요.",
      button: "밋업 확인하기",
    },
    meetupCard: {
      join: "바로 참여하기",
      filled: "명 참여",
      spotsLeft: "자리 남음",
      almostFull: "마감 임박",
    },
    renderMode: {
      prefix: "나는",
      human: "사람",
      machine: "에이전트",
      ariaLabel: "홈페이지 표시 모드",
    },
    topicsShowcase: {
      title: "모임에서 어떤 토픽을 다루나요?",
      subtitle: "WSJ, FT, NYT, Techcrunch 등에서 운영진이 엄선한 기사만 다룹니다.",
      hoverPrompt: "기사 읽어보기",
    },
    faq: {
      title: "자주 묻는 질문",
      items: [
        { q: "영어 한잔 밋업은 뭔가요?", a: "영어 한잔 밋업은 통번역사 출신의 운영자가 직접 리딩하는 영어 모임입니다. 자세한 일정 및 참여 방법은 밋업 메뉴를 참고해 주세요." },
        { q: "구독은 언제든 취소할 수 있나요?", a: "네, 언제든지 구독을 취소할 수 있습니다. 구독 취소 시 다음 결제 주기부터 서비스가 중단됩니다." },
        { q: "모바일에서도 이용 가능한가요?", a: "네, 영어 한잔은 모바일, PC 환경을 모두 고려하여 개발했습니다. 모바일/태블릿 이용 시 카카오톡 인앱 브라우저보다 크롬, 사파리 브라우저에서 작동이 더 잘될 수 있습니다." },
        { q: "회원가입 하려니 외국 웹사이트에서 코드인증을 하라는 문자가 날아와요. 괜찮은건가요?", a: "저희는 Google의 인증 방식을 채택하여, 해당 문자는 Google 시스템을 통해 발송되는 것 입니다. 영어 한잔은 웹사이트 가입 시 휴대폰 번호 외의 어떤 개인정보도 받고 있지 않습니다. 안심하고 가입하셔도 됩니다." },
        { q: "회원 탈퇴는 어떻게 하나요?", a: "회원 탈퇴에 관한 문의는 영어한잔 카카오톡 채널을 통해 문의 주시면 탈퇴 진행을 도와드리겠습니다." },
        { q: "서비스에 대한 문의 사항이 있어요", a: "각종 문의는 영어한잔 카카오톡(링크 추가)로 연락 주시면 성심껏 응답하도록 하겠습니다." },
      ],
    },
    stats: {
      header: {
        title: "완벽한 영어가 아닌,\n통하는 영어를 만듭니다.",
        highlight: "통하는 영어",
      },
      insights: {
        title: "검증된 멤버와 나누는\n깊이 있는 인사이트",
        description: "다양한 분야의 직장인, IT/AI 전공자, 그리고 영미권 석박사를 준비하는 고스펙 인재들이 모입니다.",
      },
      leader: {
        title: "통역사 출신이 직접\n이끌고 설계하는 모임",
        description: "대기업, IT 유니콘 기업, 군에서 5년 넘게 미팅을 수천 번 통역한 영어 베테랑입니다.",
        linkedin: "모임장 링크드인 확인하기",
      },
      topics: {
        title: "글로벌 엘리트가\n주목하는 토픽",
        description: "가벼운 잡담 대신 WSJ, FT, NYT, TechCrunch 등 글로벌 탑티어 미디어의 아티클을 다룹니다.",
      },
      growth: {
        title: "지금이 가장 빠른 성장 기회",
        metrics: {
          meetups: "누적 밋업 수",
          members: "누적 유료 멤버",
          retention: "재참여율",
        },
        cta: "멤버십 둘러보기",
      },
    },
    pricing: {
      badge: "PREMIUM ACCESS",
      cta: "멤버십 신청하기",
    },
    pricingNew: {
      sectionTitle: "월 9,700원으로 누리는\n압도적인 가성비",
      leftTitle: "멤버십 기간 내\n모든 밋업 참여 가능",
      referralDiscount: "지인 추천 시 추가 할인 가능",
      caveats: {
        line1: "* 밋업은 주 1회 열리며, 매주 참여 시 4회 참여가능합니다.",
        line2: "* 운영진 귀책 사유로 밋업을 1주 진행하지 못할 경우 구독 기간을 2주 연장해드립니다.",
        line3: "* 멤버 분 귀책 사유로 밋업을 불참하실 경우 연장이 되지 않습니다.",
        line4: "* 비매너 등 운영 정책을 위반할 경우 강제 환불이 진행될 수 있습니다.",
      },
      chart: {
        title: "월 9700원으로 누리는\n압도적인 가성비",
        highlight: "압도적인 가성비",
        header: "1시간 당 비용 비교",
        unit: "(단위: 원)",
        labels: {
          oneCup: "영어 한잔",
          exchange: "언어교환 모임",
          phone: "전화영어",
          academy: "영어학원",
          premium: "프리미엄 화상영어",
        },
      },
    },
  },
  blog: {
    featured: "추천",
    announcements: "공지사항",
    information: "정보",
    reviews: "밋업 후기",
    readPost: "글 읽기",
    refresh: "새로고침",
  },
  meetup: {
    blogPost: "블로그",
    sections: {
      upcoming: "현재 모집 중",
      past: "이전 밋업",
      noEvents: "등록된 밋업이 없습니다.",
      errorLoading: "밋업을 불러오지 못했습니다",
      loadMore: "더 보기",
      loadingMore: "로딩 중...",
    },
    status: {
      ended: "종료",
      joinable: "참가 가능",
      inProgress: "진행중",
      full: "정원 마감",
      closed: "모집 종료",
    },
    leaderboards: {
      totalParticipation: "누적 참여",
      monthlyParticipation: "{month} 참여",
      monthlyAverageParticipation: "월평균 참여",
      newMembers: "신규 멤버",
      noParticipation: "아직 참여 기록이 없습니다",
      noMonthlyParticipation: "이번 달 참여 기록이 없습니다",
      noMonthlyAverageParticipation: "아직 월평균 참여 기록이 없습니다",
      noNewMembers: "아직 멤버가 없습니다",
      meetupCount: "{count}회",
      meetupCountSingular: "1회",
      monthlyAverageCount: "월 {count}회",
    },
  },
};

export default ko;
