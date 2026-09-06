"use client";

import React from "react";
import { usePathname } from "next/navigation";
import MainLayoutWrapper from "./MainLayoutWrapper";
import IdentityLinkPrompt from "./IdentityLinkPrompt";
import OnboardingWizard from "./OnboardingWizard";
import RouteTransitionLoader from "./RouteTransitionLoader";
import { useIdentityLinkPrompt } from "../hooks/useIdentityLinkPrompt";
import { useOnboarding } from "../hooks/useOnboarding";
import { I18nProvider } from "../i18n/I18nProvider";

interface ConditionalLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ConditionalLayoutWrapper({
  children,
}: ConditionalLayoutWrapperProps) {
  const pathname = usePathname();
  const {
    shouldShow: shouldShowOnboarding,
    completeOnboarding,
    isLoading: onboardingLoading,
  } = useOnboarding();
  const {
    shouldShowPrompt: shouldShowIdentityLink,
    hidePrompt: hideIdentityLink,
    loading: identityLinkLoading,
  } = useIdentityLinkPrompt();

  // Pages that should NOT use the main layout (with GNB and Footer)
  const authPages = ["/auth", "/kakao_callback"];
  const isExamPreview = /^\/admin\/test-center\/exams\/[^/]+\/preview$/.test(
    pathname,
  );
  const isExamPipeline = /^\/admin\/test-center(?:\/.*)?$/.test(pathname);

  const shouldUseMainLayout = !authPages.includes(pathname) && !isExamPreview && !isExamPipeline;

  return (
    <I18nProvider>
      {shouldUseMainLayout ? (
        <MainLayoutWrapper>{children}</MainLayoutWrapper>
      ) : (
        children
      )}
      {shouldUseMainLayout &&
        !identityLinkLoading &&
        shouldShowIdentityLink && (
          <IdentityLinkPrompt onComplete={hideIdentityLink} />
        )}
      {shouldUseMainLayout &&
        !identityLinkLoading &&
        !shouldShowIdentityLink &&
        !onboardingLoading &&
        shouldShowOnboarding && (
          <OnboardingWizard onComplete={completeOnboarding} />
        )}
      <RouteTransitionLoader />
    </I18nProvider>
  );
}
