import adminGifts from "./admin_gifts";
import homeFaq from "./home_faq";
import en from "./locales/en";
import ko from "./locales/ko";
import profileRedesign from "./profile_redesign";

export type SupportedLocale = "en" | "ko";

const dictionaries = {
  en: {
    ...en,
    home: {
      ...en.home,
      faq: homeFaq.en,
    },
    profile: {
      ...en.profile,
      ...profileRedesign.en,
      accountHelp: "Login, membership, tickets and account actions.",
      participationCredits: "Tickets",
      creditsLeft: "{count} Tickets Left",
      loadingCreditHistory: "Loading ticket history…",
      noCreditHistory: "No ticket history yet.",
      buyFiveCredits: "Buy 5-ticket pack",
      creditPackPurchase: "Ticket pack purchase",
      creditPackRefund: "Ticket pack refund",
      creditAdjustment: "Ticket adjustment",
      credits: "Tickets",
      creditUnit: "tickets",
      meetupCredits: "Meetup tickets",
    },
    admin: {
      ...en.admin,
      dashboard: {
        ...en.admin.dashboard,
        sections: {
          ...en.admin.dashboard.sections,
          gifts: adminGifts.en.dashboardSection,
        },
      },
      gifts: adminGifts.en.gifts,
    },
  },
  ko: {
    ...ko,
    home: {
      ...ko.home,
      faq: homeFaq.ko,
    },
    profile: {
      ...ko.profile,
      ...profileRedesign.ko,
      viewConnections: "내 네트워크",
      connectionsTitle: "내 네트워크",
      accountHelp: "로그인, 멤버십, 참여권과 계정 설정을 관리합니다.",
      participationCredits: "참여권",
      creditsLeft: "참여권 {count}장 남음",
      loadingCreditHistory: "참여권 내역을 불러오는 중…",
      noCreditHistory: "아직 참여권 내역이 없습니다.",
      buyFiveCredits: "참여권 5장 구매",
      creditPackPurchase: "참여권 패키지 구매",
      creditPackRefund: "참여권 패키지 환불",
      creditAdjustment: "참여권 조정",
      credits: "참여권",
      creditUnit: "장",
      meetupCredits: "밋업 참여권",
    },
    admin: {
      ...ko.admin,
      dashboard: {
        ...ko.admin.dashboard,
        sections: {
          ...ko.admin.dashboard.sections,
          gifts: adminGifts.ko.dashboardSection,
        },
      },
      gifts: adminGifts.ko.gifts,
    },
  },
};

export const getDictionary = (locale: SupportedLocale) =>
  dictionaries[locale] || dictionaries.en;
