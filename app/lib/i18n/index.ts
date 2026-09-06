import adminGifts from "./admin_gifts";
import homeFaq from "./home_faq";
import en from "./locales/en";
import ko from "./locales/ko";

export type SupportedLocale = "en" | "ko";

const dictionaries = {
  en: {
    ...en,
    home: {
      ...en.home,
      faq: homeFaq.en,
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
      viewConnections: "내 네트워크",
      connectionsTitle: "내 네트워크",
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
