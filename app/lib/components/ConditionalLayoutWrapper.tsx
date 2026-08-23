"use client";

import React from "react";
import { usePathname } from "next/navigation";
import MainLayoutWrapper from "./MainLayoutWrapper";
import DisplayNamePrompt from "./DisplayNamePrompt";
import IdentityLinkPrompt from "./IdentityLinkPrompt";
import RouteTransitionLoader from "./RouteTransitionLoader";
import { useDisplayNamePrompt } from "../hooks/useDisplayNamePrompt";
import { useIdentityLinkPrompt } from "../hooks/useIdentityLinkPrompt";
import { I18nProvider } from "../i18n/I18nProvider";

interface ConditionalLayoutWrapperProps {
  children: React.ReactNode;
}

export default function ConditionalLayoutWrapper({
  children,
}: ConditionalLayoutWrapperProps) {
  const pathname = usePathname();
  const { shouldShowPrompt, hidePrompt, loading } = useDisplayNamePrompt();
  const {
    shouldShowPrompt: shouldShowIdentityLink,
    hidePrompt: hideIdentityLink,
    loading: identityLinkLoading,
  } = useIdentityLinkPrompt();

  // Pages that should NOT use the main layout (with GNB and Footer)
  const authPages = ["/auth", "/kakao_callback"];

  const shouldUseMainLayout = !authPages.includes(pathname);

  return (
    <I18nProvider>
      {shouldUseMainLayout ? (
        <MainLayoutWrapper>{children}</MainLayoutWrapper>
      ) : (
        children
      )}
      {shouldUseMainLayout && !identityLinkLoading && shouldShowIdentityLink && (
        <IdentityLinkPrompt onComplete={hideIdentityLink} />
      )}
      {shouldUseMainLayout &&
        !identityLinkLoading &&
        !shouldShowIdentityLink &&
        !loading &&
        shouldShowPrompt && <DisplayNamePrompt onComplete={hidePrompt} />}
      <RouteTransitionLoader />
    </I18nProvider>
  );
}
