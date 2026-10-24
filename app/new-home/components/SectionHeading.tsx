import React from "react";

export function SectionTitle({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-[clamp(1.85rem,3vw,2.4rem)] font-black text-[#0f172a] mb-6 leading-[1.2] font-['Noto_Sans_KR',sans-serif] text-left max-[768px]:text-center ${className}`}
      {...rest}
    >
      {children}
    </h2>
  );
}

export function Highlight({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`text-[rgb(128,0,33)] ${className}`} {...rest}>
      {children}
    </span>
  );
}
