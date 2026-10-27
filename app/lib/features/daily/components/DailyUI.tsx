"use client";

import dynamic from "next/dynamic";
import { ReactNode, useEffect, useRef, useState } from "react";
import type { LottieRefCurrentProps } from "lottie-react";
import { DAILY_TRIAL_OPEN, DAILY_TRIAL_PATH } from "../constants";
import { dailyCopy } from "../copy";
import { usePrefersReducedMotion } from "../hooks";

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const displayClass = "[font-family:var(--font-daily-display),'Noto_Sans_KR',sans-serif] font-normal";

// Splits "\n"-separated copy into lines and wraps `accent` wherever it appears.
export function Headline({
  text,
  accent,
  accentClassName,
}: {
  text: string;
  accent?: string;
  accentClassName?: string;
}) {
  return (
    <>
      {text.split("\n").map((line, index) => {
        const at = accent ? line.indexOf(accent) : -1;
        return (
          <span key={index} className="block">
            {at < 0 || !accent ? (
              line
            ) : (
              <>
                {line.slice(0, at)}
                <span className={accentClassName}>{accent}</span>
                {line.slice(at + accent.length)}
              </>
            )}
          </span>
        );
      })}
    </>
  );
}

// lottie-web is only downloaded on pages that animate an emoji.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Google's Noto Animated Emoji (https://googlefonts.github.io/noto-emoji-animation/,
// CC BY 4.0, credited on the page), served from Google's font CDN like Roundy does.
// Uses the Lottie version (~8KB) rather than the 512px WebP (~200–700KB each, ~7MB
// for the storefront); it loads when the emoji nears the viewport and only plays
// while visible. Sized by the surrounding font-size. Falls back to the native emoji
// when the animation does not exist or fails to load, and under reduced motion.
// motion="none" always uses the still native emoji, for small inline marks.
function notoCodepoint(emoji: string): string {
  return Array.from(emoji)
    .map((char) => char.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== "fe0f")
    .join("_");
}

export function Emoji({
  children,
  label,
  motion = "animate",
  className,
}: {
  children: string;
  label?: string;
  motion?: "animate" | "none";
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);
  const still = motion === "none" || reduced || failed;
  const boxRef = useRef<HTMLSpanElement>(null);
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const [near, setNear] = useState(false);
  const [animation, setAnimation] = useState<object | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (still || !box) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          lottieRef.current?.play();
        } else {
          lottieRef.current?.pause();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [still]);

  useEffect(() => {
    if (still || !near || animation) return;
    let cancelled = false;
    fetch(`https://fonts.gstatic.com/s/e/notoemoji/latest/${notoCodepoint(children)}/lottie.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => !cancelled && setAnimation(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [still, near, animation, children]);

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block leading-none", className)}
    >
      {still ? (
        children
      ) : (
        <span ref={boxRef} aria-hidden className="inline-block size-[1.15em] align-[-0.15em]">
          {animation && (
            <Lottie
              animationData={animation}
              lottieRef={lottieRef}
              loop
              autoplay
              className="size-full"
            />
          )}
        </span>
      )}
    </span>
  );
}

// The cup from the 1cup logo (last two paths of /images/logos/1cup_logo_new.svg).
export function CupMark({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 38.42 53.13" className={className} aria-hidden fill={color}>
      <path d="M36.85 6.75H34.86L33.88 2.91L4.53 0L3.43 6.75H1.57L0 10.21H38.42L36.85 6.75Z" />
      <path d="M2.94 14.22L3.44 18.22L4.39 25.88L4.89 29.88L5.84 37.55L6.34 41.55L7.3 49.22L7.78 53.13H30.63L31.12 49.22L32.07 41.55L32.57 37.55L33.53 29.88L34.02 25.88L34.98 18.22L35.48 14.22H2.94Z" />
    </svg>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.82rem] font-extrabold leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Full-bleed band; content sits in a centered column.
export function Panel({
  id,
  className,
  inner,
  children,
}: {
  id?: string;
  className?: string;
  inner?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-[60px] px-4 py-16 min-[900px]:py-24", className)}>
      {/* Centered on phones; things that read better ranged left opt out with text-left. */}
      <div className={cn("mx-auto w-full max-w-[720px] max-[899px]:text-center", inner)}>{children}</div>
    </section>
  );
}

const trialTone = {
  black: "bg-[#050505] text-white",
  orange: "bg-[#f47a4a] text-[#050505]",
} as const;

// The free-trial button. Until signup exists it says so instead of pretending to work.
export function TrialButton({
  label,
  tone = "black",
  className,
}: {
  label: string;
  tone?: keyof typeof trialTone;
  className?: string;
}) {
  const base = cn(
    "inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl px-6 text-[1.05rem] font-black",
    trialTone[tone],
    className,
  );

  if (DAILY_TRIAL_OPEN) {
    return (
      <a href={DAILY_TRIAL_PATH} className={cn(base, "transition-transform active:scale-[0.98]")}>
        {label}
      </a>
    );
  }

  return (
    <button type="button" disabled aria-disabled className={cn(base, "cursor-not-allowed opacity-90")}>
      {label}
      <span className="rounded-full bg-white/20 px-2 py-0.5 text-[0.72rem] font-extrabold">
        {dailyCopy.soon}
      </span>
    </button>
  );
}

const WAVE = [5, 9, 6, 12, 8, 14, 7, 11, 5, 9, 13, 6, 10, 7, 12, 5, 8];

export function Waveform({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("daily-wave flex items-center gap-[2px]", className)}>
      {WAVE.map((height, index) => (
        <span
          key={index}
          className="w-[2px] rounded-full bg-[#f47a4a]"
          style={{ height: `${height}px`, animationDelay: `${(index % 6) * 120}ms` }}
        />
      ))}
    </span>
  );
}
