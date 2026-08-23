import type { ReactNode } from "react";

import KakaoOAuthNavigationGuard from "./KakaoOAuthNavigationGuard";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <KakaoOAuthNavigationGuard />
      {children}
    </>
  );
}
