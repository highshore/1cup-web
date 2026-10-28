"use client";

import { usePathname } from "next/navigation";
import Footer from "./footer";
import NewNavbar from "../../new-home/components/NewNavbar";
import DailyNavbar from "../features/daily/components/DailyNavbar";
import NonKoreanApplicantPrompt from "./NonKoreanApplicantPrompt";

export default function MainLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isArticlePage = pathname.startsWith("/article/");
  // Daily draws its own full-bleed sections under its own navbar (60px tall).
  const isDailyPage = pathname === "/daily" || pathname.startsWith("/daily/");
  const isPaymentPage = pathname === "/payment";
  const isNonKoreanApplicantPage = pathname === "/non-korean-applicants";
  const isExamCenterPage = pathname === "/exam-center";
  const isPrivateProfilePage =
    pathname === "/profile" ||
    pathname === "/profile/connections" ||
    pathname === "/profile/account";
  const isFullWidth =
    isHomePage ||
    isArticlePage ||
    isDailyPage ||
    isPaymentPage ||
    isNonKoreanApplicantPage ||
    isExamCenterPage ||
    isPrivateProfilePage;

  return (
    <div
      className={`flex min-h-screen flex-col ${
        isHomePage || isExamCenterPage || isDailyPage ? "bg-white" : "bg-[#f5f5f5]"
      }`}
    >
      {isDailyPage ? <DailyNavbar /> : <NewNavbar />}
      <div
        className={`mx-auto min-h-screen w-full flex-1 [font-family:'Noto_Sans_KR',sans-serif] ${isExamCenterPage || isDailyPage ? "pb-0" : "pb-8"} ${
          isHomePage ? "pt-0" : isExamCenterPage || isDailyPage ? "pt-[60px]" : "pt-[74px] max-[768px]:pt-[68px]"
        } ${isFullWidth ? "max-w-full" : "max-w-[960px] max-[768px]:px-2"} ${
          isPrivateProfilePage ? "profile-workspace" : ""
        }`}
      >
        {children}
      </div>
      <Footer cookieSettings={isDailyPage} />
      {/* The 1cup membership's invitation for international members; not part of Daily. */}
      {!isDailyPage && <NonKoreanApplicantPrompt />}
    </div>
  );
}
