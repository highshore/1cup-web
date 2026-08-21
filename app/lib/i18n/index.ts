import en from "./locales/en";
import ko from "./locales/ko";

export type SupportedLocale = "en" | "ko";

const dictionaries = {
  en,
  ko: {
    ...ko,
    profile: {
      ...ko.profile,
      viewConnections: "내 네트워크",
      connectionsTitle: "내 네트워크",
    },
  },
};

export const getDictionary = (locale: SupportedLocale) =>
  dictionaries[locale] || en;
