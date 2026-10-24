"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  ReactNode,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase/client";
import { DevicePhoneMobileIcon } from "@heroicons/react/24/outline";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";

import "./auth.css";

const SIGN_IN_PHRASES = [
  "Welcome",
  "영어 한잔",
  "Join us",
] as const;

const TYPING_SPEED_MS = 82;
const ERASING_SPEED_MS = 40;
const HOLD_MS = 1300;

// Mirrors CODE_TTL_MS / RESEND_MIN_INTERVAL_MS in app/lib/otp/service.ts. The server
// stays the authority; these only decide what the UI offers.
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

// The code arrives over KakaoTalk, so reading it means leaving the page — and the
// KakaoTalk in-app browser routinely bins the tab. Without this the user came back to
// the start screen holding a code that is still valid server-side but has no field to
// go in, and a resend blocked by the 30s cooldown.
//
// localStorage, not sessionStorage: a discarded tab takes sessionStorage with it. Only
// the number and the send time are stored — never the code — and the record is dropped
// as soon as it is spent or expires, so a shared device keeps nothing.
const PENDING_OTP_KEY = "pendingPhoneOtp";

interface PendingOtp {
  phone: string;
  sentAt: number;
}

const readPendingOtp = (): PendingOtp | null => {
  try {
    const raw = localStorage.getItem(PENDING_OTP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOtp>;
    if (typeof parsed?.phone !== "string" || typeof parsed?.sentAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.sentAt >= OTP_TTL_MS) return null;
    return { phone: parsed.phone, sentAt: parsed.sentAt };
  } catch {
    return null;
  }
};

const writePendingOtp = (record: PendingOtp) => {
  try {
    localStorage.setItem(PENDING_OTP_KEY, JSON.stringify(record));
  } catch {
    // Private-mode quota errors must not break the sign-in itself.
  }
};

const clearPendingOtp = () => {
  try {
    localStorage.removeItem(PENDING_OTP_KEY);
  } catch {
    // ignore
  }
};

const isPhoneNumberValid = (input: string) => {
  // Deliberately loose (starts with 01, at least 10 digits) so a real number is never
  // rejected client-side; app/lib/otp/service.ts does the strict check.
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("01") && digits.length >= 10;
};

const formatCountdown = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const sanitizeRedirectUrl = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  if (value.startsWith("/auth") || value.startsWith("/kakao_callback")) {
    return "/";
  }

  return value;
};

// Shared class strings (styled-components migration).

// Base for the phone/code inputs; font-size, alignment and right padding are set per
// variant to avoid conflicting utilities.
const inputBaseClass =
  "w-full min-h-[54px] py-[0.95rem] pl-[1.1rem] border-2 border-[#050505] rounded-[12px] text-[#050505] bg-white [transition:border-color_140ms_ease,box-shadow_140ms_ease,background-color_140ms_ease] focus:outline-none focus:border-[#050505] focus:shadow-[3px_3px_0_#f47a4a] read-only:bg-[#f3f1ed] read-only:text-[rgba(5,5,5,0.7)]";

// Base for underlined link-style buttons; color and weight are set per variant.
const linkButtonBaseClass =
  "p-0 border-none bg-transparent text-[0.9rem] underline underline-offset-[3px] cursor-pointer disabled:text-[#9ca3af] disabled:no-underline disabled:cursor-not-allowed";

const messageBaseClass =
  "mt-4 py-3 px-4 rounded-[12px] text-center text-[0.95rem]";

// Base for the sign-in choice buttons; background/text/border colors per variant.
const choiceButtonBaseClass =
  "flex items-center justify-center w-full min-h-[56px] py-[0.9rem] px-5 border rounded-[20px] cursor-pointer font-[760] text-[1rem] gap-3 [transition:filter_140ms_ease,border-color_140ms_ease,box-shadow_140ms_ease,transform_140ms_ease] hover:[transform:translateY(-1px)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] disabled:cursor-not-allowed disabled:opacity-[0.66] disabled:[transform:none]";

interface SpinnerProps {
  dark?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
}

function Spinner({ dark, ...rest }: SpinnerProps) {
  return (
    <span
      className={`inline-block w-4 h-4 mr-2 align-[-3px] border-2 rounded-full animate-[auth-spin_700ms_linear_infinite] ${
        dark
          ? "border-[rgba(60,30,30,0.28)] border-t-[#3c1e1e]"
          : "border-[rgba(255,255,255,0.35)] border-t-white"
      }`}
      {...rest}
    />
  );
}

function SignInGreeting() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const currentPhrase = useMemo(
    () => SIGN_IN_PHRASES[phraseIndex],
    [phraseIndex]
  );

  useEffect(() => {
    const atPhraseEnd = characterCount === currentPhrase.length;
    const atPhraseStart = characterCount === 0;

    const timeout = window.setTimeout(
      () => {
        if (!isDeleting && atPhraseEnd) {
          setIsDeleting(true);
          return;
        }

        if (isDeleting && atPhraseStart) {
          setIsDeleting(false);
          setPhraseIndex((current) => (current + 1) % SIGN_IN_PHRASES.length);
          return;
        }

        setCharacterCount((current) => current + (isDeleting ? -1 : 1));
      },
      !isDeleting && atPhraseEnd
        ? HOLD_MS
        : isDeleting
        ? ERASING_SPEED_MS
        : TYPING_SPEED_MS
    );

    return () => window.clearTimeout(timeout);
  }, [characterCount, currentPhrase, isDeleting]);

  return (
    <div className="flex min-h-[88px] w-full items-center justify-center text-center max-[480px]:min-h-[78px]">
      <h1 className="m-0 text-[#111111] text-[clamp(1.8rem,5.8vw,2.4rem)] font-medium leading-[1.12] tracking-normal">
        {currentPhrase.slice(0, characterCount)}
        <span className="inline-block w-px h-[0.95em] ml-1 translate-y-[0.08em] bg-[#111111] animate-[auth-caret-blink_1s_step-end_infinite]" />
      </h1>
    </div>
  );
}

// Layout Component
interface AuthLayoutProps {
  children: ReactNode;
}

function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh w-full bg-white text-[#141414]">
      <div className="grid min-h-dvh grid-cols-[3fr_2fr] max-[1023px]:grid-cols-1 max-[1023px]:grid-rows-[minmax(0,42dvh)_minmax(0,58dvh)] max-[1023px]:h-dvh max-[1023px]:overflow-hidden">
        <section className="relative min-h-[44vh] overflow-hidden bg-black max-[1023px]:min-h-0 max-[1023px]:h-[42dvh]">
          <video
            className="absolute inset-0 w-full h-full object-cover object-[40%_center]"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
          >
            <source src="/signin/bg_video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative z-[1] p-6 min-[640px]:p-8 min-[768px]:p-10">
            <Link href="/" className="inline-flex items-center">
              <img
                className="block h-9 w-auto max-[480px]:h-[30px]"
                src="/images/logos/1cup_logo_new_white.svg"
                alt="1 Cup English"
              />
            </Link>
          </div>
        </section>

        {/* flex-start + margin:auto on the child, rather than align-items:center, so the
            top of a tall form stays reachable once this pane has to scroll. */}
        <section className="flex min-h-[56vh] items-start justify-center overflow-y-auto bg-white text-center pt-7 px-6 pb-[max(28px,env(safe-area-inset-bottom))] max-[1023px]:min-h-0 max-[1023px]:h-[58dvh] min-[640px]:py-12 min-[640px]:px-10 min-[768px]:px-14 min-[1024px]:px-16 min-[1280px]:px-20">
          {/* m-auto centres in the pane without trapping overflow — see the pane above */}
          <div className="flex w-full max-w-[420px] m-auto flex-col items-center">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

// Create a separate component that uses useSearchParams
function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  // Blocks the whole screen only while we resolve an existing session on mount.
  // OTP send/verify stay inline so the form never disappears mid-flow.
  const [checkingSession, setCheckingSession] = useState(true);
  const [busy, setBusy] = useState<null | "send" | "verify">(null);
  const [kakaoPending, setKakaoPending] = useState(false);
  // When the current code was sent. Both countdowns derive from it, so they stay
  // truthful across a backgrounded tab — the normal case here, since reading the code
  // means switching to KakaoTalk and timers get throttled while we are hidden.
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [errorState, setErrorState] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isValidPhoneNumber, setIsValidPhoneNumber] = useState(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  // Remembers the code we last fired off so the auto-submit effect can't resend it.
  const submittedCodeRef = useRef<string | null>(null);

  // Keep this browser path first-party: /auth/kakao/start sets state and then
  // redirects straight to Kakao, avoiding browser navigation to Supabase Auth.
  const handleKakaoLoginClick = () => {
    if (kakaoPending) return;
    setKakaoPending(true);
    setErrorState(null);
    const redirectUrl = sanitizeRedirectUrl(searchParams.get("redirect"));
    if (redirectUrl) localStorage.setItem("returnUrl", redirectUrl);
    const startUrl = new URL("/auth/kakao/start", window.location.origin);
    if (redirectUrl) startUrl.searchParams.set("redirect", redirectUrl);
    window.location.assign(startUrl.toString());
  };

  const handlePhoneAuthClick = () => {
    setErrorState(null);
    setMessage(null);
    setShowPhoneAuth(true);
  };

  // Handle phone number input change
  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Only allow digits, spaces, and hyphens for better user experience
    const filtered = input.replace(/[^\d\s-]/g, "");
    setPhoneNumber(filtered);

    // Validate on every change
    validatePhoneNumber(filtered);
  };

  // Validate Korean phone number format
  const validatePhoneNumber = (input: string) => {
    setIsValidPhoneNumber(isPhoneNumberValid(input));
  };

  // On an existing/new Supabase session, redirect. The handle_new_user trigger
  // creates/links the public.users row server-side, so no client doc write here.
  useEffect(() => {
    const redirectOnSession = () => {
      const redirectFromParams = sanitizeRedirectUrl(searchParams.get("redirect"));
      const returnUrlFromStorage = sanitizeRedirectUrl(localStorage.getItem("returnUrl"));
      const finalUrl = redirectFromParams || returnUrlFromStorage || "/profile";
      if (returnUrlFromStorage) localStorage.removeItem("returnUrl");
      router.push(finalUrl);
      router.refresh();
    };
    // OAuth failures come back from /auth/callback as ?error=<message>.
    const callbackError = searchParams.get("error");
    if (callbackError) setErrorState(callbackError);

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectOnSession();
      else setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) redirectOnSession();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, searchParams]);

  // One clock for both countdowns; each is recomputed from sentAt rather than counted
  // down, so returning from KakaoTalk shows the real remaining time, not a stalled one.
  useEffect(() => {
    if (sentAt === null) return;
    setNowMs(Date.now());
    const ticker = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, [sentAt]);

  const elapsedSinceSend = sentAt === null ? null : nowMs - sentAt;
  const resendIn =
    elapsedSinceSend === null
      ? 0
      : Math.max(0, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedSinceSend) / 1000));
  const codeValidFor =
    elapsedSinceSend === null
      ? 0
      : Math.max(0, Math.ceil((OTP_TTL_MS - elapsedSinceSend) / 1000));

  // Pick the flow back up if the tab was discarded while the code was still alive.
  // Runs once: a restored code has to be typed, not re-requested.
  useEffect(() => {
    const pending = readPendingOtp();
    if (!pending) return;
    setShowPhoneAuth(true);
    setPhoneNumber(pending.phone);
    setIsValidPhoneNumber(isPhoneNumberValid(pending.phone));
    setCodeSent(true);
    setSentAt(pending.sentAt);
    setMessage(
      "이어서 진행할게요. 카카오 알림톡으로 받으신 인증번호를 입력해주세요."
    );
  }, []);

  // The server drops the code at OTP_TTL_MS, so stop offering a field for it.
  // Guard on sentAt as well: codeValidFor is 0 whenever it is null, and treating that
  // as an expiry would wipe the step the instant it opened.
  useEffect(() => {
    if (!codeSent || sentAt === null || codeValidFor > 0) return;
    clearPendingOtp();
    setCodeSent(false);
    setSentAt(null);
    setVerificationCode("");
    submittedCodeRef.current = null;
    setMessage(null);
    setErrorState("인증번호 유효시간이 지났습니다. 다시 요청해주세요.");
  }, [codeSent, sentAt, codeValidFor]);

  // Custom phone OTP delivered via Kakao AlimTalk (see app/api/phone-otp/*).
  // Free-plan alternative to Supabase's Pro-only Send SMS auth hook.
  const sendVerificationCode = useCallback(
    async (isResend: boolean) => {
      setBusy("send");
      setErrorState(null);
      setMessage(null);
      try {
        const res = await fetch("/api/phone-otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneNumber }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "" }));
          throw new Error(error || "인증번호 전송에 실패했습니다");
        }
        const sentNow = Date.now();
        setCodeSent(true);
        setSentAt(sentNow);
        writePendingOtp({ phone: phoneNumber, sentAt: sentNow });
        setVerificationCode("");
        submittedCodeRef.current = null;
        setMessage(
          isResend
            ? "인증번호를 다시 보내드렸어요."
            : "인증번호를 보내드렸어요. 카카오 알림톡(또는 문자)을 확인해주세요."
        );
        // Focus lands on the newly revealed field instead of making the user tap it.
        window.setTimeout(() => codeInputRef.current?.focus(), 60);
      } catch (err: unknown) {
        setErrorState(
          err instanceof Error ? err.message : "인증번호 전송에 실패했습니다"
        );
      } finally {
        setBusy(null);
      }
    },
    [phoneNumber]
  );

  const verifyCode = useCallback(
    async (code: string) => {
      if (!codeSent || code.length !== 6) return;
      submittedCodeRef.current = code;
      setBusy("verify");
      setErrorState(null);
      setMessage(null);
      try {
        const res = await fetch("/api/phone-otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneNumber, code }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "인증코드 확인에 실패했습니다");
        // Establish the Supabase session from the server-minted tokens; the
        // onAuthStateChange effect above then handles the redirect. Stay "busy"
        // so the button doesn't flip back to idle during the redirect.
        const { error } = await supabase.auth.setSession({
          access_token: body.access_token,
          refresh_token: body.refresh_token,
        });
        if (error) throw error;
        clearPendingOtp();
        setMessage("로그인 성공! 이동 중이에요...");
      } catch (err: unknown) {
        setErrorState(
          err instanceof Error ? err.message : "인증코드 확인에 실패했습니다"
        );
        setBusy(null);
        codeInputRef.current?.focus();
      }
    },
    [codeSent, phoneNumber]
  );

  const handleVerificationCodeChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    // The server requires exactly 6 digits, so keep the field to that shape.
    setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6));
  };

  // Submitting a 6-digit code is the only thing the user could do next, so do it
  // for them rather than making them reach for the button.
  useEffect(() => {
    if (!codeSent || busy) return;
    if (verificationCode.length !== 6) return;
    if (submittedCodeRef.current === verificationCode) return;
    verifyCode(verificationCode);
  }, [codeSent, busy, verificationCode, verifyCode]);

  // Back to editing the number without losing the screen.
  const handleEditPhoneNumber = () => {
    clearPendingOtp();
    setCodeSent(false);
    setVerificationCode("");
    setSentAt(null);
    submittedCodeRef.current = null;
    setErrorState(null);
    setMessage(null);
  };

  const handleBackToChoices = () => {
    setShowPhoneAuth(false);
    handleEditPhoneNumber();
  };

  const handlePrimaryAction = () => {
    if (busy) return;
    if (!codeSent) {
      if (isValidPhoneNumber) sendVerificationCode(false);
      return;
    }
    verifyCode(verificationCode);
  };

  if (checkingSession) return <GlobalLoadingScreen />;

  const primaryDisabled =
    !!busy ||
    (codeSent ? verificationCode.length !== 6 : !isValidPhoneNumber);

  return (
    <AuthLayout>
      {showPhoneAuth ? (
        <>
          <h1 className="mx-0 mt-0 mb-3 w-full text-center text-[#111827] text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-[1.16] tracking-normal">
            휴대폰으로 로그인
          </h1>
          <p className="mx-0 mt-0 mb-8 w-full text-center text-[#6b7280] text-[1rem] leading-[1.6]">
            {codeSent
              ? "받으신 6자리 인증번호를 입력해주세요. 카카오톡을 확인하고 돌아오셔도 이 화면 그대로 이어집니다."
              : "인증코드를 받으실 휴대폰 번호를 입력해주세요. 인증번호는 카카오 알림톡(또는 문자)으로 발송됩니다."}
          </p>
        </>
      ) : (
        <SignInGreeting />
      )}

      {!showPhoneAuth ? (
        <div className="flex flex-col w-full gap-4 mt-[clamp(1.1rem,4.8vw,1.75rem)]">
          <button
            className={`${choiceButtonBaseClass} bg-white text-[#111827] border-[#d1d5db] hover:border-[#111827]`}
            onClick={handlePhoneAuthClick}
            disabled={kakaoPending}
          >
            <DevicePhoneMobileIcon className="w-[22px] h-[22px]" />
            전화번호로 시작하기
          </button>
          <button
            className={`${choiceButtonBaseClass} bg-[#fee500] text-[#3c1e1e] border-[#fee500] hover:bg-[#fdd800] hover:border-[#fdd800]`}
            onClick={handleKakaoLoginClick}
            disabled={kakaoPending}
            aria-busy={kakaoPending}
          >
            {kakaoPending ? (
              <Spinner dark aria-hidden="true" />
            ) : (
              <img
                className="w-[22px] h-[22px]"
                src="/images/kakao_btn.png"
                alt="Kakao Login"
              />
            )}
            카카오로 시작하기
          </button>
        </div>
      ) : (
        <form
          className="flex w-full flex-col items-stretch mt-[0.35rem] p-4 border-2 border-[#050505] rounded-[18px] bg-white shadow-[4px_4px_0_#050505]"
          onSubmit={(e) => {
            e.preventDefault();
            handlePrimaryAction();
          }}
        >
          {/* The number stays on screen through the whole flow — sending the code
              reveals the next field below it instead of swapping the view. */}
          <div className="relative w-full">
            <input
              className={`${inputBaseClass} text-[1rem] ${
                codeSent ? "pr-20" : "pr-[1.1rem]"
              }`}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="휴대폰 번호 (예: 01012345678)"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              readOnly={codeSent}
            />
            {codeSent && (
              <button
                className="absolute top-1/2 right-[0.6rem] -translate-y-1/2 py-[0.4rem] px-[0.7rem] border-[1.5px] border-[#050505] rounded-full bg-white text-[#050505] text-[0.9rem] font-bold cursor-pointer hover:bg-[#f47a4a] disabled:text-[#9ca3af] disabled:cursor-not-allowed disabled:bg-transparent"
                type="button"
                onClick={handleEditPhoneNumber}
                disabled={!!busy}
              >
                번호 변경
              </button>
            )}
          </div>

          {!codeSent &&
            (phoneNumber && !isValidPhoneNumber ? (
              <p className="mx-0 mb-0 mt-[0.6rem] text-[0.92rem] text-[#d93025] text-left">
                올바른 휴대폰 번호를 입력해주세요 (예: 01012345678)
              </p>
            ) : (
              <p className="mx-0 mb-0 mt-[0.6rem] text-[0.92rem] text-[rgba(5,5,5,0.62)] text-left">
                공백이나 대시(-) 없이 번호만 입력해주세요.
              </p>
            ))}

          {codeSent && (
            /* The code step lives on the same screen — it slides in under the number. */
            <div className="w-full animate-[auth-reveal-step_220ms_ease-out]">
              <p className="mx-0 mt-[0.9rem] mb-2 text-[0.9rem] font-semibold text-[#050505] text-left">
                인증번호 6자리
              </p>
              {/* indent keeps the digits optically centred despite the tracking */}
              <input
                className={`${inputBaseClass} pr-[1.1rem] text-center text-[1.35rem] font-bold tracking-[0.4em] indent-[0.4em]`}
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={handleVerificationCodeChange}
                disabled={busy === "verify"}
              />
              <div className="flex items-center justify-between gap-3 w-full mt-[0.6rem] text-[0.9rem] text-[rgba(5,5,5,0.62)] text-left">
                <span>
                  {codeValidFor > 0
                    ? `인증번호 유효시간 ${formatCountdown(codeValidFor)}`
                    : "인증번호를 받지 못하셨나요?"}
                </span>
                <button
                  className={`${linkButtonBaseClass} text-[#050505] font-bold`}
                  type="button"
                  onClick={() => sendVerificationCode(true)}
                  disabled={!!busy || resendIn > 0}
                >
                  {resendIn > 0 ? `재전송 (${resendIn}초)` : "재전송"}
                </button>
              </div>
            </div>
          )}

          <button
            className="w-full min-h-[54px] mt-5 py-[0.9rem] px-4 bg-[#f47a4a] text-[#050505] border-2 border-[#050505] rounded-full shadow-[3px_3px_0_#050505] cursor-pointer font-[760] text-[1rem] [transition:all_0.2s_ease] hover:bg-[#ff8f65] hover:[transform:translateY(-1px)] disabled:bg-[#e4e1dc] disabled:text-[rgba(5,5,5,0.45)] disabled:shadow-none disabled:cursor-not-allowed disabled:[transform:none]"
            id="send-code-button"
            type="submit"
            disabled={primaryDisabled}
          >
            {busy && <Spinner aria-hidden="true" />}
            {busy === "send"
              ? "전송 중..."
              : busy === "verify"
              ? "확인 중..."
              : codeSent
              ? "인증하고 시작하기"
              : "인증번호 전송"}
          </button>

          {errorState && (
            <div
              className={`${messageBaseClass} border-[1.5px] border-[#a72121] bg-[#fff1ef] text-[#8c1717]`}
              role="alert"
            >
              {errorState}
            </div>
          )}
          {message && (
            <div
              className={`${messageBaseClass} border-[1.5px] border-[#1f6b41] bg-[#eff9f1] text-[#155833]`}
              role="status"
            >
              {message}
            </div>
          )}

          <button
            className={`${linkButtonBaseClass} self-center mt-5 text-[rgba(5,5,5,0.68)] font-semibold`}
            type="button"
            onClick={handleBackToChoices}
          >
            다른 방법으로 로그인
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

// Fallback component for Suspense
function AuthLoadingFallback() {
  return <GlobalLoadingScreen />;
}

// Main export with Suspense boundary
export default function Auth() {
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <AuthContent />
    </Suspense>
  );
}
