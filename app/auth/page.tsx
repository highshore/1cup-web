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
import styled, { keyframes } from "styled-components";
import { DevicePhoneMobileIcon } from "@heroicons/react/24/outline";
import GlobalLoadingScreen from "../lib/components/GlobalLoadingScreen";

const SIGN_IN_PHRASES = [
  "Welcome",
  "영어 한잔",
  "Join us",
] as const;

const TYPING_SPEED_MS = 82;
const ERASING_SPEED_MS = 40;
const HOLD_MS = 1300;

const caretBlink = keyframes`
  0%, 49% {
    opacity: 1;
  }

  50%, 100% {
    opacity: 0;
  }
`;

const revealStep = keyframes`
  from {
    opacity: 0;
    transform: translateY(-6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

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

// Layout Components
const PageWrapper = styled.div`
  min-height: 100dvh;
  width: 100%;
  background: #ffffff;
  color: #141414;
`;

const SplitLayout = styled.div`
  display: grid;
  min-height: 100dvh;
  grid-template-columns: 3fr 2fr;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 42dvh) minmax(0, 58dvh);
    height: 100dvh;
    overflow: hidden;
  }
`;

const MediaPane = styled.section`
  position: relative;
  min-height: 44vh;
  overflow: hidden;
  background: #000000;

  @media (max-width: 1023px) {
    min-height: 0;
    height: 42dvh;
  }
`;

const BackgroundVideo = styled.video`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 40% center;
`;

const VideoOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
`;

const BrandBar = styled.div`
  position: relative;
  z-index: 1;
  padding: 24px;

  @media (min-width: 640px) {
    padding: 32px;
  }

  @media (min-width: 768px) {
    padding: 40px;
  }
`;

const BrandLink = styled(Link)`
  display: inline-flex;
  align-items: center;
`;

const Logo = styled.img`
  display: block;
  height: 36px;
  width: auto;

  @media (max-width: 480px) {
    height: 30px;
  }
`;

const FormPane = styled.section`
  display: flex;
  min-height: 56vh;
  /* flex-start + margin:auto on the child, rather than align-items:center, so the
     top of a tall form stays reachable once this pane has to scroll. */
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  background: #ffffff;
  padding: 48px 24px;
  text-align: center;

  @media (max-width: 1023px) {
    min-height: 0;
    height: 58dvh;
    padding: 28px 24px max(28px, env(safe-area-inset-bottom));
  }

  @media (min-width: 640px) {
    padding: 48px 40px;
  }

  @media (min-width: 768px) {
    padding: 48px 56px;
  }

  @media (min-width: 1024px) {
    padding: 48px 64px;
  }

  @media (min-width: 1280px) {
    padding: 48px 80px;
  }
`;

const FormContent = styled.div`
  display: flex;
  width: 100%;
  max-width: 420px;
  margin: auto; /* centres in the pane without trapping overflow — see FormPane */
  flex-direction: column;
  align-items: center;
`;

const GreetingWrap = styled.div`
  display: flex;
  min-height: 88px;
  width: 100%;
  align-items: center;
  justify-content: center;
  text-align: center;

  @media (max-width: 480px) {
    min-height: 78px;
  }
`;

const GreetingText = styled.h1`
  color: #111111;
  font-size: clamp(1.8rem, 5.8vw, 2.4rem);
  font-weight: 500;
  line-height: 1.12;
  letter-spacing: 0;
  margin: 0;
`;

const Caret = styled.span`
  display: inline-block;
  width: 1px;
  height: 0.95em;
  margin-left: 0.25rem;
  transform: translateY(0.08em);
  background: #111111;
  animation: ${caretBlink} 1s step-end infinite;
`;

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
    <GreetingWrap>
      <GreetingText>
        {currentPhrase.slice(0, characterCount)}
        <Caret />
      </GreetingText>
    </GreetingWrap>
  );
}

// Layout Component
interface AuthLayoutProps {
  children: ReactNode;
}

function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <PageWrapper>
      <SplitLayout>
        <MediaPane>
          <BackgroundVideo autoPlay loop muted playsInline preload="auto">
            <source src="/signin/bg_video.mp4" type="video/mp4" />
          </BackgroundVideo>
          <VideoOverlay />
          <BrandBar>
            <BrandLink href="/">
              <Logo
                src="/images/logos/1cup_logo_new_white.svg"
                alt="1 Cup English"
              />
            </BrandLink>
          </BrandBar>
        </MediaPane>

        <FormPane>
          <FormContent>{children}</FormContent>
        </FormPane>
      </SplitLayout>
    </PageWrapper>
  );
}

// ... END: Components migrated from auth_components.tsx ...

// ... START: Original styled components from auth.tsx that are still in use ...
const AuthPageHeading = styled.h1`
  /* Renamed from Header in original auth.tsx */
  font-size: clamp(1.9rem, 4vw, 2.6rem);
  font-weight: 600;
  margin: 0 0 0.75rem;
  width: 100%;
  text-align: center;
  color: #111827;
  letter-spacing: 0;
  line-height: 1.16;
`;

const Description = styled.p`
  margin: 0 0 2rem;
  text-align: center;
  color: #6b7280;
  width: 100%;
  font-size: 1rem;
  line-height: 1.6;
`;

const PhoneForm = styled.form`
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  margin-top: 0.35rem;
  padding: 1rem;
  border: 2px solid #050505;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 4px 4px 0 #050505;
`;

const Input = styled.input<{ $hasInlineAction?: boolean }>`
  /* Specific to phone auth part */
  width: 100%;
  min-height: 54px;
  padding: 0.95rem 1.1rem;
  padding-right: ${(props) => (props.$hasInlineAction ? "5rem" : "1.1rem")};
  border: 2px solid #050505;
  border-radius: 12px;
  font-size: 1rem;
  color: #050505;
  background: #ffffff;
  transition: border-color 140ms ease, box-shadow 140ms ease,
    background-color 140ms ease;

  &:focus {
    outline: none;
    border-color: #050505;
    box-shadow: 3px 3px 0 #f47a4a;
  }

  &:read-only {
    background: #f3f1ed;
    color: rgba(5, 5, 5, 0.7);
  }
`;

/* Wraps one input so an inline action can sit on top of it. */
const Field = styled.div`
  position: relative;
  width: 100%;
`;

const InlineAction = styled.button`
  position: absolute;
  top: 50%;
  right: 0.6rem;
  transform: translateY(-50%);
  padding: 0.4rem 0.7rem;
  border: 1.5px solid #050505;
  border-radius: 999px;
  background: #ffffff;
  color: #050505;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    background: #f47a4a;
  }

  &:disabled {
    color: #9ca3af;
    cursor: not-allowed;
    background: transparent;
  }
`;

/* The code step lives on the same screen — it slides in under the number. */
const CodeStep = styled.div`
  width: 100%;
  animation: ${revealStep} 220ms ease-out;
`;

const CodeInput = styled(Input)`
  text-align: center;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.4em;
  text-indent: 0.4em; /* keeps the digits optically centred despite the tracking */
`;

const StepRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.6rem;
  font-size: 0.9rem;
  color: rgba(5, 5, 5, 0.62);
  text-align: left;
`;

const LinkButton = styled.button`
  padding: 0;
  border: none;
  background: none;
  color: #050505;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;

  &:disabled {
    color: #9ca3af;
    text-decoration: none;
    cursor: not-allowed;
  }
`;

const CodeLabel = styled.p`
  margin: 0.9rem 0 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #050505;
  text-align: left;
`;

const BackLink = styled(LinkButton)`
  align-self: center;
  margin-top: 1.25rem;
  color: rgba(5, 5, 5, 0.68);
  font-weight: 600;
`;

const Spinner = styled.span<{ $dark?: boolean }>`
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 0.5rem;
  vertical-align: -3px;
  border: 2px solid ${(props) => (props.$dark ? "rgba(60, 30, 30, 0.28)" : "rgba(255, 255, 255, 0.35)")};
  border-top-color: ${(props) => (props.$dark ? "#3c1e1e" : "#ffffff")};
  border-radius: 50%;
  animation: ${spin} 700ms linear infinite;
`;

const Button = styled.button`
  width: 100%;
  min-height: 54px;
  margin-top: 1.25rem;
  padding: 0.9rem 1rem;
  background-color: #f47a4a;
  color: #050505;
  border: 2px solid #050505;
  border-radius: 999px;
  box-shadow: 3px 3px 0 #050505;
  cursor: pointer;
  font-weight: 760;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: #ff8f65;
    transform: translateY(-1px);
  }

  &:disabled {
    background-color: #e4e1dc;
    color: rgba(5, 5, 5, 0.45);
    box-shadow: none;
    cursor: not-allowed;
    transform: none;
  }
`;

const Message = styled.div`
  /* Base for Success/Error messages in phone auth */
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  text-align: center;
  font-size: 0.95rem;
`;

const ErrorMessage = styled(Message)`
  border: 1.5px solid #a72121;
  background-color: #fff1ef;
  color: #8c1717;
`;

const SuccessMessage = styled(Message)`
  border: 1.5px solid #1f6b41;
  background-color: #eff9f1;
  color: #155833;
`;

const HelpText = styled.p`
  font-size: 0.92rem;
  color: rgba(5, 5, 5, 0.62);
  margin: 0.6rem 0 0;
  text-align: left;
`;

const ValidationMessage = styled.p`
  font-size: 0.92rem;
  color: #d93025;
  margin: 0.6rem 0 0;
  text-align: left;
`;

// Styled Components for Choice Buttons (from original auth.tsx)
const ChoiceButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 1rem;
`;

const SignInChoices = styled(ChoiceButtonContainer)`
  margin-top: clamp(1.1rem, 4.8vw, 1.75rem);
`;

const ChoiceButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  padding: 0.9rem 1.25rem;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 760;
  font-size: 1rem;
  transition: filter 140ms ease, border-color 140ms ease,
    box-shadow 140ms ease, transform 140ms ease;
  gap: 0.75rem;
  font-family: inherit;

  img,
  svg {
    width: 22px;
    height: 22px;
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.66;
    transform: none;
  }
`;

const PhoneButton = styled(ChoiceButton)`
  background-color: white;
  color: #111827;

  &:hover {
    border-color: #111827;
  }
`;

const KakaoButton = styled(ChoiceButton)`
  background-color: #fee500; // Kakao yellow
  color: #3c1e1e; // Kakao text color (approximate)
  border-color: #fee500;

  &:hover {
    background-color: #fdd800; // Slightly darker yellow on hover
    border-color: #fdd800;
  }
`;

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
          <AuthPageHeading>휴대폰으로 로그인</AuthPageHeading>
          <Description>
            {codeSent
              ? "받으신 6자리 인증번호를 입력해주세요. 카카오톡을 확인하고 돌아오셔도 이 화면 그대로 이어집니다."
              : "인증코드를 받으실 휴대폰 번호를 입력해주세요. 인증번호는 카카오 알림톡(또는 문자)으로 발송됩니다."}
          </Description>
        </>
      ) : (
        <SignInGreeting />
      )}

      {!showPhoneAuth ? (
        <SignInChoices>
          <PhoneButton onClick={handlePhoneAuthClick} disabled={kakaoPending}>
            <DevicePhoneMobileIcon />
            전화번호로 시작하기
          </PhoneButton>
          <KakaoButton onClick={handleKakaoLoginClick} disabled={kakaoPending} aria-busy={kakaoPending}>
            {kakaoPending ? <Spinner $dark aria-hidden="true" /> : <img src="/images/kakao_btn.png" alt="Kakao Login" />}
            카카오로 시작하기
          </KakaoButton>
        </SignInChoices>
      ) : (
        <PhoneForm
          onSubmit={(e) => {
            e.preventDefault();
            handlePrimaryAction();
          }}
        >
          {/* The number stays on screen through the whole flow — sending the code
              reveals the next field below it instead of swapping the view. */}
          <Field>
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="휴대폰 번호 (예: 01012345678)"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              readOnly={codeSent}
              $hasInlineAction={codeSent}
            />
            {codeSent && (
              <InlineAction
                type="button"
                onClick={handleEditPhoneNumber}
                disabled={!!busy}
              >
                번호 변경
              </InlineAction>
            )}
          </Field>

          {!codeSent &&
            (phoneNumber && !isValidPhoneNumber ? (
              <ValidationMessage>
                올바른 휴대폰 번호를 입력해주세요 (예: 01012345678)
              </ValidationMessage>
            ) : (
              <HelpText>공백이나 대시(-) 없이 번호만 입력해주세요.</HelpText>
            ))}

          {codeSent && (
            <CodeStep>
              <CodeLabel>인증번호 6자리</CodeLabel>
              <CodeInput
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
              <StepRow>
                <span>
                  {codeValidFor > 0
                    ? `인증번호 유효시간 ${formatCountdown(codeValidFor)}`
                    : "인증번호를 받지 못하셨나요?"}
                </span>
                <LinkButton
                  type="button"
                  onClick={() => sendVerificationCode(true)}
                  disabled={!!busy || resendIn > 0}
                >
                  {resendIn > 0 ? `재전송 (${resendIn}초)` : "재전송"}
                </LinkButton>
              </StepRow>
            </CodeStep>
          )}

          <Button
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
          </Button>

          {errorState && <ErrorMessage role="alert">{errorState}</ErrorMessage>}
          {message && <SuccessMessage role="status">{message}</SuccessMessage>}

          <BackLink type="button" onClick={handleBackToChoices}>
            다른 방법으로 로그인
          </BackLink>
        </PhoneForm>
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
