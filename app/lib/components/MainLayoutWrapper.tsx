"use client";

import { usePathname } from "next/navigation";
import styled from "styled-components";
import Footer from "./footer";
import NewNavbar from "../../new-home/components/NewNavbar";
import { colors } from "../constants/colors";
import { appLayout } from "../constants/app_layout";
import NonKoreanApplicantPrompt from "./NonKoreanApplicantPrompt";

const LayoutWrapper = styled.div<{ $isHomePage: boolean }>`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: ${(props) =>
    props.$isHomePage ? colors.landingBg : colors.pageBg};
`;

const PageContainer = styled.div<{
  $isHomePage: boolean;
  $isArticlePage: boolean;
}>`
  padding-top: ${(props) => (props.$isHomePage ? "0" : "74px")};
  flex: 1;
  min-height: 100vh;
  max-width: ${(props) =>
    props.$isHomePage || props.$isArticlePage
      ? "100%"
      : appLayout.pageMaxWidth};
  margin: 0 auto;
  padding-bottom: 2rem;
  font-family: "Noto Sans KR", sans-serif;
  width: 100%;

  @media (max-width: 768px) {
    padding-top: ${(props) => (props.$isHomePage ? "0" : "68px")};
    padding-left: ${(props) =>
      props.$isHomePage || props.$isArticlePage
        ? "0"
        : appLayout.pageGutterMobile};
    padding-right: ${(props) =>
      props.$isHomePage || props.$isArticlePage
        ? "0"
        : appLayout.pageGutterMobile};
  }
`;

export default function MainLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isArticlePage = pathname.startsWith("/article/");

  return (
    <LayoutWrapper $isHomePage={isHomePage}>
      <NewNavbar />
      <PageContainer $isHomePage={isHomePage} $isArticlePage={isArticlePage}>
        {children}
      </PageContainer>
      <Footer />
      <NonKoreanApplicantPrompt />
    </LayoutWrapper>
  );
}
