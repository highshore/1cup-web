"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DailyLoading from "../features/daily/components/DailyLoading";
import { useI18n } from "../i18n/I18nProvider";

// The site-wide loader is Daily's: three orange dots in a white pill at the middle of the
// viewport, pure CSS so it shows from the first paint. It is portalled to <body> so a
// transformed ancestor can't pull the fixed overlay off center, and sits above the navbar
// and modals like the old full-screen Lottie did.
export default function GlobalLoadingScreen() {
  const { t } = useI18n();
  const label = t.common.loading;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadingElement = (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <DailyLoading label={label} />
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(loadingElement, document.body);
  }

  return loadingElement;
}
