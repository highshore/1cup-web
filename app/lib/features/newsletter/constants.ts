export const NEWSLETTER_TRACKS = ["business", "drama", "tech"] as const;
export type NewsletterTrack = (typeof NEWSLETTER_TRACKS)[number];

export const isNewsletterTrack = (value: string): value is NewsletterTrack =>
  (NEWSLETTER_TRACKS as readonly string[]).includes(value);

export const NEWSLETTER_MONTHLY_PRICE_KRW = 3700;
export const NEWSLETTER_MEMBER_DISCOUNT_RATE = 0.5;
export const NEWSLETTER_MEMBER_PRICE_KRW = Math.round(
  NEWSLETTER_MONTHLY_PRICE_KRW * (1 - NEWSLETTER_MEMBER_DISCOUNT_RATE),
);

// Checkout is not built yet. Subscribe/gift buttons stay disabled until this flips.
export const NEWSLETTER_SUBSCRIPTIONS_OPEN = false;

// Real end of the launch discount, or null to hide the notice. Never extend a passed deadline.
export const NEWSLETTER_LAUNCH_DISCOUNT_ENDS_AT: Date | null = null;

export const formatKrw = (amount: number) => amount.toLocaleString("ko-KR");

// Palette from the production home (app/new-home): black ink, orange accent, hard shadows.
export const newsletterColors = {
  ink: "#050505",
  heading: "#0f172a",
  body: "#475569",
  muted: "#64748b",
  orange: "#f47a4a",
  orangeText: "#d95f2d",
  cream: "#fff8dc",
  surface: "#f3f3f1",
  surfaceAlt: "#f5f5f5",
  line: "#e5e7eb",
} as const;

export const trackCoverTheme: Record<
  NewsletterTrack,
  { background: string; foreground: string; eyebrow: string; tagline: string }
> = {
  business: {
    background: newsletterColors.ink,
    foreground: "#ffffff",
    eyebrow: newsletterColors.orange,
    tagline: "rgba(255, 255, 255, 0.78)",
  },
  drama: {
    background: newsletterColors.orange,
    foreground: newsletterColors.ink,
    eyebrow: newsletterColors.ink,
    tagline: "rgba(5, 5, 5, 0.78)",
  },
  tech: {
    background: newsletterColors.cream,
    foreground: newsletterColors.ink,
    eyebrow: newsletterColors.orangeText,
    tagline: newsletterColors.body,
  },
};
