"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { spokenText, type DailyAudioClip } from "./spoken";

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

// Lessons play their recorded clips (Gemini TTS, see server/audio.ts). The browser's own
// English voice stands in when a recording cannot play, and for the landing page's sample.
// The page carries the stored clips' URLs (stored); they are downloaded while the lesson is
// read, expression first, so a tap plays at once. A clip not stored yet goes through
// /api/daily/audio, which makes it.
export function useSpeech(lessonId?: string, stored?: Partial<Record<DailyAudioClip, string>>) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState<DailyAudioClip | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loaded = useRef<Partial<Record<DailyAudioClip, string>>>({});
  const recorded = Boolean(lessonId && /^[0-9a-f-]{36}$/i.test(lessonId));
  const storedKey = stored ? JSON.stringify(stored) : "";

  useEffect(() => {
    if (!storedKey) return;
    const urls = JSON.parse(storedKey) as Partial<Record<DailyAudioClip, string>>;
    const clips = (Object.keys(urls) as DailyAudioClip[]).sort((a, b) => Number(b === "expression") - Number(a === "expression"));
    let cancelled = false;
    const made: string[] = [];
    void (async () => {
      for (const clip of clips) {
        if (cancelled) return;
        try {
          const response = await fetch(urls[clip]!);
          if (!response.ok) continue;
          const objectUrl = URL.createObjectURL(await response.blob());
          made.push(objectUrl);
          if (cancelled) return;
          loaded.current[clip] = objectUrl;
        } catch {
          // The tap falls back to the clip's URL, then to /api/daily/audio.
        }
      }
    })();
    return () => {
      cancelled = true;
      loaded.current = {};
      for (const objectUrl of made) URL.revokeObjectURL(objectUrl);
    };
  }, [storedKey]);

  useEffect(() => {
    const browserVoice = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(browserVoice || recorded);
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (browserVoice) window.speechSynthesis.cancel();
    };
  }, [recorded]);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const speakWithBrowser = (clip: DailyAudioClip, text: string, rate: number) => {
    if (!("speechSynthesis" in window)) {
      setSpeaking(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(spokenText(text));
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.onend = () => setSpeaking((current) => (current === clip ? null : current));
    utterance.onerror = () => setSpeaking((current) => (current === clip ? null : current));
    window.speechSynthesis.speak(utterance);
  };

  // text is what the browser voice reads if the clip's recording cannot play.
  const speak = (clip: DailyAudioClip, text: string, rate = 0.92) => {
    if (!supported) return;
    stop();
    if (speaking === clip) {
      setSpeaking(null);
      return;
    }
    setSpeaking(clip);
    if (!recorded) {
      speakWithBrowser(clip, text, rate);
      return;
    }
    // Started inside the tap, so iOS lets it play even when the first play waits for
    // the clip to be generated.
    const audio = new Audio(
      loaded.current[clip] ?? stored?.[clip] ?? `/api/daily/audio?lesson=${encodeURIComponent(lessonId!)}&clip=${clip}`,
    );
    audioRef.current = audio;
    const fallBack = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      speakWithBrowser(clip, text, rate);
    };
    audio.onended = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      setSpeaking(null);
    };
    audio.onerror = fallBack;
    audio.play().catch(fallBack);
  };

  return { supported, speaking, speak };
}
