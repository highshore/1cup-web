import adminGifts from "./admin_gifts";
import en from "./locales/en";
import ko from "./locales/ko";

export type SupportedLocale = "en" | "ko";

const dictionaries = {
  en: {
    ...en,
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
