import { Barlow_Condensed, Black_Han_Sans } from "next/font/google";

// Display face for /daily headlines. Korean glyphs come in unicode-range chunks,
// so nothing is preloaded; the browser fetches only the chunks a page uses.
export const dailyDisplay = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-daily-display",
});

// The "DAILY" wordmark next to the 1cup logo: the closest Google face to the logo's
// condensed capitals.
export const dailyWordmark = Barlow_Condensed({
  weight: "600",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-daily-wordmark",
});
