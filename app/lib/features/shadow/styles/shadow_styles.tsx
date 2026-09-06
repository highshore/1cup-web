import React from "react";
import "./shadow_styles.css";

// Modern color palette
export const colors = {
  primary: "#3c2e26",
  primaryDark: "#2c1810",
  primaryLight: "#5d4037",
  secondary: "#8d6e63",
  accent: "#d4a574",
  success: "#4e7c59",
  warning: "#c17817",
  error: "#a8423f",
  background: "#faf8f6",
  surface: "#ffffff",
  surfaceElevated: "#ffffff",
  text: {
    primary: "#2c1810",
    secondary: "#3c2e26",
    muted: "#8d6e63",
    inverse: "#ffffff",
  },
  border: {
    light: "#e8ddd4",
    medium: "#d7c7b8",
    dark: "#a69080",
  },
  shadow: {
    sm: "0 1px 3px rgba(44, 24, 16, 0.1), 0 1px 2px rgba(44, 24, 16, 0.06)",
    md: "0 4px 6px rgba(44, 24, 16, 0.07), 0 2px 4px rgba(44, 24, 16, 0.06)",
    lg: "0 10px 15px rgba(44, 24, 16, 0.1), 0 4px 6px rgba(44, 24, 16, 0.05)",
    xl: "0 20px 25px rgba(44, 24, 16, 0.1), 0 10px 10px rgba(44, 24, 16, 0.04)",
  },
};

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type SpanProps = React.HTMLAttributes<HTMLSpanElement>;

export function ShadowContainer({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`w-full px-0 py-8 [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,'Helvetica_Neue',Arial,sans-serif] flex flex-col items-center gap-8 max-w-page mx-auto min-h-screen ${className}`}
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
      className={`text-ink w-full text-center text-[2.5rem] font-bold m-0 bg-[linear-gradient(135deg,#3c2e26,#5d4037)] bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] tracking-[-0.02em] max-[768px]:text-[2rem] ${className}`}
      {...rest}
    />
  );
}

const buttonClasses = [
  "inline-flex items-center justify-center px-6 py-3 text-[0.875rem] font-semibold",
  "bg-[linear-gradient(135deg,#3c2e26,#2c1810)] text-white border-none rounded-xl cursor-pointer",
  "[transition:all_0.2s_cubic-bezier(0.4,0,0.2,1)]",
  "shadow-[0_1px_3px_rgba(44,24,16,0.1),0_1px_2px_rgba(44,24,16,0.06)]",
  "relative overflow-hidden",
  "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-full",
  "before:bg-[linear-gradient(135deg,#5d4037,#d4a574)] before:opacity-0 before:[transition:opacity_0.2s_ease]",
  "enabled:hover:[transform:translateY(-2px)] enabled:hover:shadow-[0_10px_15px_rgba(44,24,16,0.1),0_4px_6px_rgba(44,24,16,0.05)]",
  "enabled:hover:before:opacity-100",
  "enabled:active:[transform:translateY(0)] enabled:active:shadow-[0_4px_6px_rgba(44,24,16,0.07),0_2px_4px_rgba(44,24,16,0.06)]",
  "disabled:bg-[#d7c7b8] disabled:bg-none disabled:text-[#8d6e63] disabled:cursor-not-allowed disabled:[transform:none] disabled:shadow-none",
  "disabled:before:hidden",
  "[&_span]:relative [&_span]:z-[1]",
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
      className={`my-6 mx-0 p-6 rounded-2xl leading-[2] text-[1.1rem] [transition:transform_0.2s_ease,box-shadow_0.2s_ease] hover:[transform:translateY(-2px)] ${className}`}
      {...rest}
    />
  );
}

export function WordWithScoreContainer({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`inline-flex flex-col items-center my-0 mx-[1px] align-top relative ${className}`}
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
      className={`text-[0.7em] text-[#8d6e63] mt-[2px] leading-none font-medium ${className}`}
      {...rest}
    />
  );
}

const syllableColorClass = (color: string, isOmitted?: boolean): string => {
  if (isOmitted) return "text-[#a8423f]";
  switch (color) {
    case "green":
      return "text-[#4e7c59]";
    case "orange":
      return "text-[#c17817]";
    case "red":
      return "text-[#a8423f]";
    default:
      return "text-[#8d6e63]";
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
    "font-semibold py-1 px-[2px] rounded-none my-0 mx-[1px] [transition:all_0.2s_ease]",
    isOmitted ? "line-through" : "no-underline",
    isOmitted || isInserted ? "italic" : "not-italic",
    isOmitted ? "opacity-[0.85]" : "opacity-100",
    hasUnexpectedBreak
      ? "border-b-[3px] border-dotted border-[#c17817] pb-[1px]"
      : "",
    hasMissingBreak
      ? "border-b-[3px] border-dashed border-[#5d4037] pb-[1px]"
      : "",
    "hover:[transform:scale(1.05)]",
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
      className={`text-[#a8423f] w-full text-center font-medium p-4 bg-[#a8423f10] border border-solid border-[#a8423f30] rounded-xl my-4 mx-0 shadow-[0_1px_3px_rgba(44,24,16,0.1),0_1px_2px_rgba(44,24,16,0.06)] ${className}`}
      {...rest}
    />
  );
}

export function LoadingSpinner({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`inline-block w-5 h-5 border-2 border-solid border-line rounded-full border-t-[#3c2e26] animate-[shadow-spin_1s_ease-in-out_infinite] mr-2 ${className}`}
      {...rest}
    />
  );
}

export function LoadingContainer({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[60vh] gap-4 [&_.spinner]:w-10 [&_.spinner]:h-10 [&_.spinner]:border-[3px] [&_.spinner]:border-solid [&_.spinner]:border-line [&_.spinner]:rounded-full [&_.spinner]:border-t-[#3c2e26] [&_.spinner]:animate-[shadow-spin_1s_ease-in-out_infinite] [&_.text]:text-[1.1rem] [&_.text]:text-[#3c2e26] [&_.text]:font-medium ${className}`}
      {...rest}
    />
  );
}

export function VideoContainer({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`mb-8 w-full aspect-video relative rounded-[20px] overflow-hidden shadow-[0_20px_25px_rgba(44,24,16,0.1),0_10px_10px_rgba(44,24,16,0.04)] bg-[linear-gradient(135deg,#faf8f6,#ffffff)] border border-solid border-line [transition:transform_0.3s_ease,box-shadow_0.3s_ease] hover:[transform:translateY(-2px)] hover:shadow-[0_20px_25px_rgba(44,24,16,0.1),0_10px_10px_rgba(44,24,16,0.04),0_0_0_1px_#3c2e2620] [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-none [&_iframe]:rounded-[20px] ${className}`}
      {...rest}
    />
  );
}

const statusIndicatorVariant: Record<
  "success" | "warning" | "error" | "info",
  string
> = {
  success: "bg-[#4e7c5910] border-[#4e7c5930] text-[#4e7c59]",
  warning: "bg-[#c1781710] border-[#c1781730] text-[#c17817]",
  error: "bg-[#a8423f10] border-[#a8423f30] text-[#a8423f]",
  info: "bg-[#3c2e2610] border-[#3c2e2630] text-[#3c2e26]",
};

export function StatusIndicator({
  type,
  className = "",
  ...rest
}: DivProps & { type: "success" | "warning" | "error" | "info" }) {
  return (
    <div
      className={`inline-flex items-center gap-2 py-3 px-4 rounded-xl text-[0.875rem] font-medium mt-2 border border-solid ${statusIndicatorVariant[type]} ${className}`}
      {...rest}
    />
  );
}

export function SentenceTextDisplay({ className = "", ...rest }: DivProps) {
  return (
    <div
      className={`text-[1.15rem] leading-[1.7] mb-4 text-ink font-normal tracking-[0.01em] ${className}`}
      {...rest}
    />
  );
}
