import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AuthProvider from "./lib/contexts/auth_context";
import ConditionalLayoutWrapper from "./lib/components/ConditionalLayoutWrapper";
import ServiceErrorProvider from "./lib/components/ServiceErrorProvider";
import JsonLd from "./lib/seo/json_ld";
import {
  absoluteUrl,
  ORGANIZATION_ID,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_NAME_EN,
  SITE_URL,
} from "./lib/seo/site";

const siteTitle = `${SITE_NAME} | ${SITE_NAME_EN}`;
const socialImage = "/images/url-share-thumbnail.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: siteTitle,
  description: SITE_DESCRIPTION,
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
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ko_KR",
    type: "website",
    images: [{ url: socialImage, width: 1200, height: 630, alt: siteTitle }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: SITE_DESCRIPTION,
    images: [socialImage],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  alternateName: SITE_NAME_EN,
  legalName: "네이티브피티",
  url: SITE_URL,
  logo: absoluteUrl("/images/logos/1cup_logo_new.svg"),
  description: SITE_DESCRIPTION,
  email: "hello@1cupenglish.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "안암로9가길 9-8, 303호",
    addressLocality: "성북구",
    addressRegion: "서울특별시",
    addressCountry: "KR",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "hello@1cupenglish.com",
    availableLanguage: ["ko", "en"],
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
        <JsonLd data={organizationJsonLd} />
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
