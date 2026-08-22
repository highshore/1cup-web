"use client";

import { useEffect, useState } from "react";

import UnifiedErrorPanel from "./UnifiedErrorPanel";
import {
  SERVICE_ERROR_EVENT,
  type ServiceErrorDetail,
} from "../services/service_error_bus";

function serviceMessage(service: ServiceErrorDetail["service"]) {
  if (service === "meetup") {
    return "밋업 정보를 불러오는 데 문제가 생겼습니다. 데이터는 안전하게 보관되어 있으니 잠시 후 다시 시도해 주세요.";
  }
  if (service === "leaderboard") {
    return "리더보드 정보를 불러오는 데 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

export default function ServiceErrorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [serviceError, setServiceError] = useState<ServiceErrorDetail | null>(
    null,
  );

  useEffect(() => {
    const onServiceError = (event: Event) => {
      const detail = (event as CustomEvent<ServiceErrorDetail>).detail;
      setServiceError(detail || { service: "general" });
    };
    window.addEventListener(SERVICE_ERROR_EVENT, onServiceError);
    return () => window.removeEventListener(SERVICE_ERROR_EVENT, onServiceError);
  }, []);

  return (
    <>
      {children}
      {serviceError && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            overflowY: "auto",
            background: "#f3f3f1",
          }}
        >
          <UnifiedErrorPanel
            title="서비스를 불러오지 못했습니다"
            message={serviceMessage(serviceError.service)}
            onRetry={() => window.location.reload()}
          />
        </div>
      )}
    </>
  );
}
