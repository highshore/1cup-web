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
const siteDescription =
  "1 Cup English 영어 한잔은 서울에서 한국인과 외국인 거주자가 시사, 기술, 비즈니스, 커리어를 영어로 토론하는 소그룹 커뮤니티입니다.";
const socialImage = "/images/url-share-thumbnail.jpg";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "1 Cup English",
  alternateName: "영어 한잔",
  url: siteUrl,
  logo: `${siteUrl}/images/logos/1cup_logo.jpg`,
  description: siteDescription,
  areaServed: {
    "@type": "City",
    name: "Seoul",
    alternateName: "서울",
  },
  knowsAbout: [
    "English discussion",
    "Current affairs",
    "Technology",
    "Business",
    "Careers",
    "Life in Korea",
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  keywords: [
    "1 Cup English",
    "영어 한잔",
    "서울 영어 모임",
    "서울 영어 토론",
    "English discussion Seoul",
    "English community Seoul",
  ],
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
    siteName: "1 Cup English | 영어 한잔",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "1 Cup English 영어 한잔 - Seoul English discussion community",
      },
    ],
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
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
