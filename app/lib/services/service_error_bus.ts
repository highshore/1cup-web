export type PublicServiceName = "meetup" | "leaderboard" | "general";

export type ServiceErrorDetail = {
  service: PublicServiceName;
  cause?: unknown;
};

export const SERVICE_ERROR_EVENT = "onecup:service-error";

export function reportServiceError(detail: ServiceErrorDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ServiceErrorDetail>(SERVICE_ERROR_EVENT, { detail }),
  );
}
