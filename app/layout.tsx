import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AuthProvider from "./lib/contexts/auth_context";
import ConditionalLayoutWrapper from "./lib/components/ConditionalLayoutWrapper";
import ServiceErrorProvider from "./lib/components/ServiceErrorProvider";

const siteUrl = "https://1cupenglish.com";
const siteTitle = "영어 한잔 | 1 Cup English";
const siteDescription = "Business English Community hosted in Seoul";
const socialImage = "/images/url-share-thumbnail.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "영어 한잔 | 1 Cup English",
  description: siteDescription,
  icons: {
    icon: [
      { url: "/images/logos/1cup_logo.jpg", sizes: "32x32", type: "image/jpeg" },
      { url: "/images/logos/1cup_logo.jpg", sizes: "16x16", type: "image/jpeg" },
    ],
    apple: [
      { url: "/images/logos/1cup_logo.jpg", sizes: "180x180", type: "image/jpeg" },
    ],
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "영어 한잔",
    locale: "ko_KR",
    type: "website",
    images: [{ url: socialImage, width: 1200, height: 630, alt: "영어 한잔 - 1 Cup English" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [socialImage],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning={true}>
        <ServiceErrorProvider>
          <AuthProvider>
            <ConditionalLayoutWrapper>{children}</ConditionalLayoutWrapper>
          </AuthProvider>
        </ServiceErrorProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
