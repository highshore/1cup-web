"use client";

import { usePathname } from "next/navigation";
import Footer from "./footer";
import NewNavbar from "../../new-home/components/NewNavbar";
import NonKoreanApplicantPrompt from "./NonKoreanApplicantPrompt";

export default function MainLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isArticlePage = pathname.startsWith("/article/");
  const isFullWidth = isHomePage || isArticlePage;

  return (
    <div
      className={`flex min-h-screen flex-col ${
        isHomePage ? "bg-[#ffffff]" : "bg-[#f5f5f5]"
      }`}
    >
      <NewNavbar />
      <div
        className={`mx-auto min-h-screen w-full flex-1 pb-8 [font-family:'Noto_Sans_KR',sans-serif] ${
          isHomePage ? "pt-0" : "pt-[74px] max-[768px]:pt-[68px]"
        } ${
          isFullWidth
            ? "max-w-full"
            : "max-w-[960px] max-[768px]:px-2"
        }`}
      >
        {children}
      </div>
      <Footer />
      <NonKoreanApplicantPrompt />
    </div>
  );
}
