"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import "../newsletter.css";

// Primitives mirror the production home (app/new-home): 2px ink borders, hard offset
// shadows, orange pill chips, 900-weight titles. Values match the home's arbitrary classes.

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const tones = {
  white: "bg-white",
  surface: "bg-[#f3f3f1]",
  surfaceAlt: "bg-[#f5f5f5]",
  cream: "bg-[#fff8dc]",
} as const;
export type Tone = keyof typeof tones;

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white font-['Noto_Sans_KR',sans-serif] text-[#0f172a] break-keep">
      {children}
    </div>
  );
}

export function Section({
  tone = "white",
  className,
  ...props
}: ComponentProps<"section"> & { tone?: Tone }) {
  return (
    <section
      className={cn(
        "scroll-mt-[74px] py-[clamp(3.5rem,7vw,5.5rem)]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Container({
  narrow,
  className,
  ...props
}: ComponentProps<"div"> & { narrow?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto px-5 max-[768px]:px-4",
        narrow ? "max-w-[720px]" : "max-w-page",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-[clamp(1.5rem,4vw,2.25rem)] flex flex-col items-start max-[768px]:items-center max-[768px]:text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mb-[0.85rem] inline-flex items-center rounded-full border-2 border-[#050505] bg-[#f47a4a] px-[0.72rem] py-[0.34rem] text-[0.78rem] font-black leading-[1.25] tracking-[0.02em] text-[#050505]">
      {children}
    </p>
  );
}

// Headings opt out of the global h1–h6 font and color.
export function SectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "m-0 font-['Noto_Sans_KR',sans-serif] text-[clamp(1.6rem,2.4vw,2.05rem)] font-black leading-[1.18] tracking-[0] text-[#0f172a]",
        className,
      )}
      {...props}
    />
  );
}

export function SubTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "m-0 font-['Noto_Sans_KR',sans-serif] text-[1.25rem] font-black leading-[1.3] text-[#0f172a]",
        className,
      )}
      {...props}
    />
  );
}

// Renders a multi-line title with the last line in the accent color, like the production home.
export function AccentLines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, index) =>
        index === lines.length - 1 ? (
          <span key={line} className="text-[#d95f2d]">
            {line}
          </span>
        ) : (
          <span key={line}>
            {line}
            <br />
          </span>
        ),
      )}
    </>
  );
}

export function Description({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "m-0 mt-4 max-w-[32rem] text-[0.98rem] font-[620] leading-[1.65] text-[#64748b]",
        className,
      )}
      {...props}
    />
  );
}

export function SmallText({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("m-0 text-[0.82rem] font-[580] leading-[1.6] text-[#64748b]", className)}
      {...props}
    />
  );
}

export const cardClass =
  "rounded-[14px] border-2 border-[#050505] bg-white shadow-[5px_5px_0_rgba(5,5,5,0.88)]";

const buttonBase =
  "inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full border-2 border-[#050505] px-[1.9rem] py-[0.875rem] font-[inherit] text-base font-[850] no-underline [transition:background-color_160ms_ease,box-shadow_160ms_ease,transform_160ms_ease] hover:no-underline disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const lift =
  "[@media(hover:hover)]:hover:-translate-x-px [@media(hover:hover)]:hover:-translate-y-px disabled:hover:translate-x-0 disabled:hover:translate-y-0";

export const buttonVariants = {
  // White pill with the orange offset shadow (production hero CTA).
  primary: cn(
    buttonBase,
    lift,
    "bg-white text-[#050505] shadow-[5px_5px_0_#f47a4a] hover:text-[#050505] [@media(hover:hover)]:hover:bg-[#fff8dc] [@media(hover:hover)]:hover:shadow-[7px_7px_0_#f47a4a]",
  ),
  // Orange pill with an ink offset shadow, for the main purchase action.
  orange: cn(
    buttonBase,
    lift,
    "bg-[#f47a4a] text-[#050505] shadow-[4px_4px_0_#050505] hover:text-[#050505] [@media(hover:hover)]:hover:shadow-[6px_6px_0_#050505]",
  ),
  // Plain ink outline for secondary actions on light backgrounds.
  outline: cn(
    buttonBase,
    "bg-transparent text-[#050505] hover:text-[#050505] [@media(hover:hover)]:hover:bg-[#fff8dc]",
  ),
} as const;
export type ButtonVariant = keyof typeof buttonVariants;

export function ButtonLink({
  variant,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant: ButtonVariant }) {
  return <Link className={cn(buttonVariants[variant], className)} {...props} />;
}

export function Button({
  variant,
  className,
  ...props
}: ComponentProps<"button"> & { variant: ButtonVariant }) {
  return <button className={cn(buttonVariants[variant], className)} {...props} />;
}

// Sub-brand bar under the global navbar; the brand name is a placeholder until it is decided.
export function BrandBar() {
  const { t } = useI18n();
  return (
    <div className="border-b border-[#e5e7eb] bg-white">
      <Container className="flex items-baseline gap-2 py-[0.875rem]">
        <Link
          href="/newsletter"
          className="text-[1.15rem] font-black text-[#050505] no-underline hover:text-[#050505] hover:no-underline"
        >
          {t.newsletter.brand.name}
        </Link>
        <span className="text-[0.78rem] font-bold text-[#64748b]">
          {t.newsletter.brand.endorsement}
        </span>
      </Container>
    </div>
  );
}
