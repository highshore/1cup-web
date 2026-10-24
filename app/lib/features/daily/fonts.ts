import { Black_Han_Sans } from "next/font/google";

// Display face for /daily headlines. Korean glyphs come in unicode-range chunks,
// so nothing is preloaded; the browser fetches only the chunks a page uses.
export const dailyDisplay = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-daily-display",
});
