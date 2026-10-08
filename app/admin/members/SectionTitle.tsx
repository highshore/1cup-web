import type { ReactNode } from "react";

// Replaces the styled SectionTitle plus the `${SectionTitle}` override that
// MembersHeader applied to it (the `compact` variant).
export default function SectionTitle({
  compact = false,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <h2
      className={`inline-flex items-center border-2 border-[#050505] rounded-full bg-[#f47a4a] text-[#050505] font-black ${
        compact
          ? "h-9 m-0 py-0 px-3 text-[14px]"
          : "mb-5 py-[0.3rem] px-[0.7rem] text-[16px]"
      }`}
    >
      {children}
    </h2>
  );
}
