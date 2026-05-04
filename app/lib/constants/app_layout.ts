export const appLayout = {
  pageMaxWidth: "960px",
  pageGutterDesktop: "1.5rem",
  pageGutterMobile: "0.5rem",
} as const;

export type AppLayout = typeof appLayout;
