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
      videoUnsupported: "브라우저가 비디오 태그를 지원하지 않습니다.",
    },
    memberLogos: {
      titleLine1: "다양한 배경의 멤버들이",
      titleHighlight: "영어 한잔",
      titleLine2Suffix: "과 함께했습니다",
      additionalAria: "추가 멤버 배경",
      items: [
        "SK하이닉스",
        "PwC",
        "쿠팡",
        "SAP",
        "네슬레",
        "고려대학교 의과대학",
        "고려대학교",
        "연세대학교 MBA",
      ],
    },
    topicVideo: {
      sectionTitle: "모임 진행 방식 #1",
      title: "월가와 실리콘밸리의\n핫토픽을 선정합니다",
      description: "Wall Street Journal, Financial Times 등에서 글로벌 리더들이 정독하는 최고급 영문 기사들을 기반으로 토론합니다",
      caveat: "영어 한잔은 신문사의 지식재산권을 준수하여 멤버 토론 목적 외의 기사를 공개하지 않습니다.",
      videoTitle: "매일 WSJ, FT를 읽는 JP 모건 회장 제이미 다이먼",
    },
    leaderMethod: {
      sectionTitle: "모임 진행 방식 #2",
      title: "경험 있는 리더들이\n토론의 방향을 잡아줍니다",
      emptyTitle: "리더 라인업 준비 중",
      emptyDescription: "모임 리더 프로필은 확정되는 대로 업데이트됩니다.",
      linkedInUnavailable: "LinkedIn 준비 중",
      locationTabsAria: "리더 지역 선택",
      profilesAria: "커뮤니티 리더 프로필",
      readingStyleLabel: "리딩 스타일",
      locations: {
        anam: "안암",
        yeouido: "여의도",
      },
      profiles: {
        sj: {
          name: "SJ",
          role: "커뮤니티 매니저",
          bullets: [
            { icon: "work", text: "(현) AI 통번역 기업 풀스택 엔지니어" },
            { icon: "uk", text: "TOEIC 935" },
            { icon: "military", text: "미군 평택기지 카투사 복무" },
            { icon: "school", text: "고려대학교 서울캠퍼스 보안학과 재학" },
            { icon: "school", text: "과고 졸업" },
          ],
          readingStyle: "",
        },
        kyle: {
          name: "카일 (Kyle)",
          role: "커뮤니티 매니저",
          locationRoles: {
            yeouido: "리더",
          },
          bullets: [
            { icon: "work", text: "(현) 외국계 대기업 AI 엔지니어 인턴" },
            { icon: "work", text: "CJ 제일제당, 센드버드 통역사 4년 이상 경력" },
            { icon: "military", text: "한미연합군사령부 영어 통역병 (어학병)" },
            { icon: "uk", text: "뉴 TOEFL 6점 만점, 구 TOEFL 118점, 오픽 AL" },
            { icon: "school", text: "고려대학교 서울캠퍼스 컴퓨터학과 4학년 재학" },
            { icon: "school", text: "고양외국어고등학교 졸업" },
          ],
          readingStyle: "멤버들이 반대 의견, 새로운 의견을 제시하도록 적극적으로 유도. 당장의 영어 실력보다도 성장하고자 하는 의지를 중시.",
        },
        joey: {
          name: "조이 (Joey)",
          role: "커뮤니티 매니저",
          locationRoles: {
            yeouido: "리더",
          },
          bullets: [
            { icon: "work", text: "(현) 외국계 대기업 PM 8년차" },
            { icon: "uk", text: "오픽 AL 2회 달성" },
            { icon: "work", text: "국내 대기업, 외국계 재직 경력" },
            { icon: "school", text: "연세대학교 경영전문대학원 (MBA) 재학" },
            { icon: "school", text: "영국 석사 졸업" },
          ],
          readingStyle: "주제에 대한 다양한 의견을 중시하고 즐거운 토론 분위기를 주도",
        },
        ey: {
          name: "EY",
          role: "리더",
          bullets: [],
          readingStyle: "",
        },
        jc: {
          name: "JC",
          role: "리더",
          bullets: [],
          readingStyle: "",
        },
        ab: {
          name: "AB",
          role: "리더",
          bullets: [],
          readingStyle: "",
        },
      },
    },
    networkingMethod: {
      sectionTitle: "모임 진행 방식 #3",
      title: "정식 밋업 외에도\n다양한 활동으로 네트워킹",
      description: "원하는 멤버끼리 밋업 이후에도 자연스럽게 연결되는 커뮤니티를 만듭니다.",
      images: {
        member: "밋업 멤버 토론",
        galleryTwo: "밋업 후 네트워킹",
        galleryThree: "영어 한잔 커뮤니티 활동",
        activity: "영어 한잔 멤버 네트워킹 활동",
      },
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
    jobCelebration: {
      ariaLabel: "멤버 취업 축하 소식",
      eyebrow: "멤버 커리어 축하",
      title: "영어 한잔 멤버 남OO 님의 SK하이닉스 합격을 축하합니다",
      description: "국내 대표 반도체 기업에서 새 커리어를 시작하게 된 멤버의 성장을 함께 축하합니다.",
      close: "축하하며 닫기",
    },
    topicsShowcase: {
      title: "모임에서 어떤 토픽을 다루나요?",
      titlePrefix: "모임에서 ",
      titleHighlight: "어떤 토픽",
      titleSuffix: "을 다루나요?",
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
        title: "오랜 시간 여러 멤버에게 검증된 모임",
        metrics: {
          meetups: "누적 밋업 수",
          members: "누적 유료 멤버",
          retention: "재참여율",
        },
        valueSuffixes: {
          meetups: "회",
          members: "명+",
        },
        cta: "멤버십 둘러보기",
      },
    },
    pricing: {
      badge: "PREMIUM ACCESS",
      cta: "멤버십 신청하기",
    },
    pricingNew: {
      sectionTitle: "좋은 영어 모임을\n부담 없는 가격으로",
      leftTitle: "멤버십 기간 내\n모든 밋업 참여 가능",
      referralDiscount: "지인 추천 시 추가 할인 가능",
      caveats: {
        line1: "* 밋업은 주 1회 열리며, 매주 참여 시 4회 참여가능합니다.",
        line2: "* 운영진 귀책 사유로 밋업을 1주 진행하지 못할 경우 구독 기간을 2주 연장해드립니다.",
        line3: "* 멤버 분 귀책 사유로 밋업을 불참하실 경우 환불이나 연장은 불가합니다.",
        line4: "* 비매너 등 운영 정책을 위반할 경우 강제 환불이 진행될 수 있습니다.",
      },
      chart: {
        title: "좋은 영어 모임을\n부담 없는 가격으로",
        highlight: "부담 없는 가격",
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
    support: {
      label: "문의하기",
      ariaLabel: "고객 지원 문의하기",
    },
  },
  nonKoreanApplicants: {
    hero: {
      eyebrow: "외국인 지원자 안내",
      title: "한국에서 퀄리티 있는 네트워크를 만들어보세요.",
      subtitle:
        "영어 한잔은 한국에서 장기적으로 전문적인 삶을 만들어가고 있으며, 한국 직장인 및 학생들과 의미 있는 대화를 통해 연결되고 싶은 장기 체류 외국인 멤버를 환영합니다.",
      primaryCta: "로그인 후 지원하기",
      secondaryCta: "밋업 둘러보기",
      cardTitle: "장기적인 전문 네트워킹을 위한 커뮤니티",
      points: [
        "한국 직장인들과 함께하는 퀄리티 높은 영어 네트워킹",
        "단기 교환학생, 관광객, 임시 체류자 중심의 모임을 넘어선 연결",
        "배움에 적극적인 멤버들과 전문적·문화적 관점을 나누는 환경",
      ],
    },
    eligibility: {
      eyebrow: "지원 자격",
      title: "이 밋업이 적합한 분",
      description:
        "이 지원 채널은 한국에서 장기적으로 생활하며 전문적인 영어 네트워킹 환경에 기여할 수 있는 외국인 지원자를 위한 안내입니다.",
      items: [
        {
          title: "영어 원어민",
          description:
            "아래 주요 영어권 국가 중 한 곳의 시민권을 보유하고 있어야 합니다. 5개 국가의 시민권이 없더라도 지원할 수 있으나, 승인이 보장되지는 않습니다.",
          countries: [
            { flag: "🇦🇺", name: "Australia" },
            { flag: "🇨🇦", name: "Canada" },
            { flag: "🇳🇿", name: "New Zealand" },
            { flag: "🇬🇧", name: "United Kingdom" },
            { flag: "🇺🇸", name: "United States" },
          ],
        },
        {
          title: "한국 내 전문 경력",
          description:
            "현재 한국의 기업, 공공기관 또는 전문 조직에서 근무하고 있어야 합니다. 본 밋업은 단기 영어 교육, 군 복무, 교환학생, 관광, 임시 여행을 주된 체류 목적으로 하는 분들을 위한 모임은 아닙니다.",
        },
        {
          title: "한국 장기 체류",
          description:
            "이미 한국에서 2년 이상 체류했거나, 지원 시점부터 2년 이상 한국에 체류할 계획이 있어야 합니다.",
        },
        {
          title: "커뮤니티 적합성",
          description:
            "깊이 있는 대화, 전문적인 네트워킹, 한국 멤버들의 실전 영어 커뮤니케이션 연습에 기여하는 데 관심이 있어야 합니다.",
        },
      ],
    },
    benefits: {
      eyebrow: "참여 혜택",
      title: "소중한 멤버로서 기대할 수 있는 것",
      items: [
        "편안하지만 전문적인 영어 환경에서 한국 직장인 또는 SKY+ 학생들과 네트워킹할 수 있습니다.",
        "한국에 기반을 둔 다른 장기 체류 외국인 전문가들을 만날 수 있습니다.",
        "단기 방문자 중심의 네트워크를 넘어 의미 있는 관계를 만들 수 있습니다.",
        "영어 커뮤니케이션에 진지한 한국 멤버들과 전문적·문화적 관점을 나눌 수 있습니다.",
      ],
      note: "외국인 멤버의 멤버십 비용은 면제됩니다. 단, 밋업 장소에서 본인의 커피 비용은 직접 부담해야 합니다.",
    },
    process: {
      eyebrow: "지원 절차",
      title: "간단하지만 신중한 리뷰",
      description:
        "한국 멤버와 외국인 멤버 모두에게 의미 있고 적합한 커뮤니티를 유지하기 위해 지원서를 검토합니다.",
      steps: [
        {
          title: "로그인",
          description:
            "영어 한잔 계정을 만들거나 기존 계정으로 로그인합니다.",
        },
        {
          title: "지원 정보 제출",
          description:
            "이메일 주소, 국적, LinkedIn 프로필 URL을 제출해 주세요. 연락 및 밋업 적합성 검토를 위해 사용합니다.",
        },
        {
          title: "지원서 검토",
          description:
            "지원자의 배경과 영어 한잔 커뮤니티와의 적합성을 검토합니다. 가능하면 3일 이내에 검토를 완료합니다.",
        },
        {
          title: "이메일 안내",
          description:
            "검토가 완료되면 다음 단계에 대해 이메일로 안내드립니다.",
        },
      ],
    },
    cta: {
      title: "한국의 프로페셔널들과 연결될 준비가 되셨나요?",
      description:
        "한국에서 장기적으로 커리어를 만들어가는 외국인 전문가로서 영어 대화를 통해 의미 있는 관계를 만들고 싶다면 지원해 주세요.",
      primary: "로그인 후 지원하기",
      secondary: "밋업 둘러보기",
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
    filter: {
      label: "지역",
      all: "전체",
      yeouido: "여의도",
      anam: "안암",
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
      celebration: {
        title: "멤버 업적",
        subtitle: "영어 한잔 멤버들의 값진 성취를 함께 축하합니다",
        empty: "아직 축하 소식이 없습니다",
        addButton: "축하 추가",
        edit: "수정",
        delete: "삭제",
      },
    },
  },
};

export default ko;
