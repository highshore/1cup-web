"use client";

import { RefObject, useEffect, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

// True once the element has entered the viewport; stays true afterwards.
export function useSeen<T extends Element>(ref: RefObject<T | null>, threshold = 0.3) {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, threshold, seen]);

  return seen;
}

// True while the element is out of view above the viewport (scrolled past).
export function useScrolledPast<T extends Element>(ref: RefObject<T | null>) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) =>
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return past;
}

// True once the element's top has reached the viewport, and while it stays above it.
export function useReached<T extends Element>(ref: RefObject<T | null>) {
  const [reached, setReached] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) =>
      setReached(entry.isIntersecting || entry.boundingClientRect.top < 0),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return reached;
}

// True while the element is at least partly on screen.
export function useVisible<T extends Element>(ref: RefObject<T | null>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return visible;
}

// "(sb)", "(sth)", "(sb's)" and the like mark where a word goes in an expression such as
// "run (sth) by (sb)". Read aloud they come out as "sth" and "sb", so the voice skips them.
const PLACEHOLDER = /\((?:sb|sth|someone|something|one)(?:'s)?\)/gi;

export function spokenText(text: string) {
  return text.replace(PLACEHOLDER, " ").replace(/\s+/g, " ").trim();
}

// The browser's own English voice reads expressions and examples aloud until lessons
// carry recorded audio (daily_lessons.audio_path).
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    return () => {
      if (ok) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = (text: string, rate = 0.92) => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    if (speaking === text) {
      setSpeaking(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(spokenText(text));
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.onend = () => setSpeaking(null);
    utterance.onerror = () => setSpeaking(null);
    setSpeaking(text);
    synth.speak(utterance);
  };

  return { supported, speaking, speak };
}
