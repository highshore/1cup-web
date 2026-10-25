import { Black_Han_Sans, Noto_Sans } from "next/font/google";

// Display face for /daily headlines. Korean glyphs come in unicode-range chunks,
// so nothing is preloaded; the browser fetches only the chunks a page uses.
export const dailyDisplay = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-daily-display",
});

// The "DAILY" wordmark next to the 1cup logo: Noto Sans ExtraCondensed, i.e. the
// variable Noto Sans at wdth 62.5 (set with font-stretch where it's used).
export const dailyWordmark = Noto_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-daily-wordmark",
});
