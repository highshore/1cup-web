import React from "react";
import "./shadow_styles.css";

// Shadowing uses the stronger One Cup black/orange product language.
export const colors = {
  primary: "#050505",
  primaryDark: "#050505",
  primaryLight: "#2a2a2a",
  secondary: "#6f6861",
  accent: "#e0602e",
  success: "#3f7a50",
  warning: "#b66a18",
  error: "#b9473f",
  background: "#f7f6f2",
  surface: "#ffffff",
  surfaceElevated: "#ffffff",
  text: {
    primary: "#050505",
    secondary: "#2a2a2a",
    muted: "#706a64",
    inverse: "#ffffff",
  },
  border: {
    light: "#e7e3de",
    medium: "#d4cec7",
    dark: "#8f8880",
  },
  shadow: {
    sm: "0 1px 2px rgba(5, 5, 5, 0.08)",
    md: "0 6px 18px rgba(5, 5, 5, 0.08)",
    lg: "0 14px 32px rgba(5, 5, 5, 0.1)",
    xl: "0 18px 42px rgba(5, 5, 5, 0.12)",
  },
};

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type SpanProps = React.HTMLAttributes<HTMLSpanElement>;

export function ShadowContainer({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`mx-auto flex min-h-screen w-full max-w-page flex-col items-center gap-6 px-gutter py-7 [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] max-[640px]:px-gutter-mobile max-[640px]:py-5 ${className}`}
      {...rest}
    />
  );
}

export function Title({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={`m-0 w-full text-left text-[clamp(2rem,5vw,3.3rem)] font-black tracking-[-0.055em] text-[#050505] ${className}`}
      {...rest}
    />
  );
}

const buttonClasses = [
  "relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-[12px] border-2 border-[#050505] px-5 py-2.5",
  "bg-[#050505] text-[0.83rem] font-black text-white shadow-[3px_3px_0_#e0602e]",
  "cursor-pointer transition-[transform,box-shadow,background-color] duration-150",
  "enabled:hover:-translate-y-[2px] enabled:hover:shadow-[4px_5px_0_#e0602e]",
  "enabled:active:translate-y-0 enabled:active:shadow-[2px_2px_0_#e0602e]",
  "disabled:border-[#d4cec7] disabled:bg-[#dedad5] disabled:text-[#8c857e] disabled:shadow-none disabled:cursor-not-allowed",
  "[&_span]:relative [&_span]:z-[1] [&_span]:inline-flex [&_span]:items-center [&_span]:gap-2",
].join(" ");

export function Button({
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${buttonClasses} ${className}`} {...rest} />;
}

export function ColorCodedSentence({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`my-3 rounded-[16px] border border-black/10 bg-[#faf9f6] p-5 text-[1.05rem] leading-[1.9] transition-colors hover:border-black/20 max-[640px]:p-4 ${className}`}
      {...rest}
    />
  );
}

export function WordWithScoreContainer({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`relative mx-[1px] inline-flex flex-col items-center align-top ${className}`}
      {...rest}
    />
  );
}

export function ScoreDisplaySpan({
  className = "",
  color: _color,
  ...rest
}: SpanProps & { color?: string }) {
  return (
    <span
      className={`mt-[2px] text-[0.68em] font-black leading-none text-[#706a64] ${className}`}
      {...rest}
    />
  );
}

const syllableColorClass = (color: string, isOmitted?: boolean): string => {
  if (isOmitted) return "text-[#b9473f]";
  switch (color) {
    case "green":
      return "text-[#3f7a50]";
    case "orange":
      return "text-[#b66a18]";
    case "red":
      return "text-[#b9473f]";
    default:
      return "text-[#706a64]";
  }
};

export function SyllableSpan({
  color,
  isOmitted,
  isInserted,
  hasUnexpectedBreak,
  hasMissingBreak,
  className = "",
  ...rest
}: SpanProps & {
  color: string;
  isOmitted?: boolean;
  isInserted?: boolean;
  hasUnexpectedBreak?: boolean;
  hasMissingBreak?: boolean;
}) {
  const classes = [
    syllableColorClass(color, isOmitted),
    "mx-[1px] rounded-[4px] px-[2px] py-1 font-bold transition-transform duration-150",
    isOmitted ? "line-through" : "no-underline",
    isOmitted || isInserted ? "italic" : "not-italic",
    isOmitted ? "opacity-[0.85]" : "opacity-100",
    hasUnexpectedBreak
      ? "border-b-[3px] border-dotted border-[#b66a18] pb-[1px]"
      : "",
    hasMissingBreak
      ? "border-b-[3px] border-dashed border-[#050505] pb-[1px]"
      : "",
    "hover:scale-[1.04]",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={classes} {...rest} />;
}

export function ErrorMessage({
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`my-4 w-full rounded-[14px] border border-solid border-[#b9473f40] bg-[#b9473f0d] p-4 text-center text-[#a83d37] font-bold ${className}`}
      {...rest}
    />
  );
}

export function LoadingSpinner({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`mr-2 inline-block h-5 w-5 animate-[shadow-spin_1s_ease-in-out_infinite] rounded-full border-2 border-solid border-white/40 border-t-white ${className}`}
      {...rest}
    />
  );
}

export function LoadingContainer({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`flex min-h-[46vh] flex-col items-center justify-center gap-4 [&_.spinner]:h-10 [&_.spinner]:w-10 [&_.spinner]:animate-[shadow-spin_1s_ease-in-out_infinite] [&_.spinner]:rounded-full [&_.spinner]:border-[3px] [&_.spinner]:border-solid [&_.spinner]:border-white/25 [&_.spinner]:border-t-white [&_.text]:text-[0.95rem] [&_.text]:font-bold [&_.text]:text-white/75 ${className}`}
      {...rest}
    />
  );
}

export function VideoContainer({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`relative mb-3 aspect-video w-full overflow-hidden rounded-[18px] border-2 border-solid border-[#050505] bg-[#050505] shadow-[6px_6px_0_#e0602e] [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-none ${className}`}
      {...rest}
    />
  );
}

const statusIndicatorVariant: Record<
  "success" | "warning" | "error" | "info",
  string
> = {
  success: "bg-[#3f7a5010] border-[#3f7a5030] text-[#356843]",
  warning: "bg-[#b66a1810] border-[#b66a1830] text-[#9a5813]",
  error: "bg-[#b9473f10] border-[#b9473f30] text-[#9f3d37]",
  info: "bg-[#05050508] border-black/15 text-[#050505]",
};

export function StatusIndicator({
  type,
  className = "",
  ...rest
}: DivProps & { type: "success" | "warning" | "error" | "info" }) {
  return (
    <div
      className={`mt-2 inline-flex items-center gap-2 rounded-[12px] border border-solid px-4 py-3 text-[0.84rem] font-bold ${statusIndicatorVariant[type]} ${className}`}
      {...rest}
    />
  );
}

export function SentenceTextDisplay({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`mb-3 text-[clamp(1.1rem,2vw,1.35rem)] font-bold leading-[1.65] tracking-[-0.015em] text-[#050505] ${className}`}
      {...rest}
    />
  );
}
