import { format } from "date-fns";
import { enUS, ko } from "date-fns/locale";

// Shared Tailwind class fragments for the members admin panels.
export const hoverLiftTransition =
  "transition-[translate,box-shadow] duration-[140ms] ease-[ease]";
export const cardHoverLift = `${hoverLiftTransition} hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_rgba(5,5,5,0.85)]`;

export const userNameClass = "font-extrabold text-[#050505] text-[14px]";
export const userEmailClass = "text-[rgba(5,5,5,0.6)] text-[13px]";
export const statusPillClass =
  "inline-flex items-center py-1 px-2.5 border-[1.5px] border-[#050505] rounded-full text-[12px] font-extrabold text-[#050505]";
export const emptyStateClass = "text-center p-10 text-[rgba(5,5,5,0.6)] font-bold";

export const resolveToDate = (value?: Date | string): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Formats with the admin's locale, or returns `fallback` for a missing/invalid date.
export const formatAdminDate = (
  value: Date | string | undefined,
  pattern: "yyyy.MM.dd" | "yyyy.MM.dd HH:mm",
  locale: string,
  fallback: string,
) => {
  const date = resolveToDate(value);
  if (!date) return fallback;
  return format(date, pattern, { locale: locale === "ko" ? ko : enUS });
};
