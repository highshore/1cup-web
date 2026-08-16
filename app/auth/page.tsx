"use client";

import { useState, useEffect, useMemo, ReactNode, Suspense } from "react";
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
  align-items: center;
  justify-content: center;
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

const FormContainer = styled.div`
  /* Specific to phone auth part */
  width: 100%;
`;

const Input = styled.input`
  /* Specific to phone auth part */
  width: 100%;
  min-height: 54px;
  padding: 0.95rem 1.1rem;
  margin-bottom: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 16px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #111827;
    box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.1);
  }
`;

const Button = styled.button`
  /* Specific to phone auth part */
  width: 100%;
  min-height: 54px;
  padding: 0.9rem 1rem;
  background-color: #111827;
  color: white;
  border: 1px solid #111827;
  border-radius: 18px;
  cursor: pointer;
  font-weight: 760;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: #020617;
    transform: translateY(-1px);
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
    transform: none;
  }
`;

const Message = styled.div`
  /* Base for Success/Error messages in phone auth */
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  font-size: 1.1rem;
`;

const ErrorMessage = styled(Message)`
  /* Specific to phone auth part */
  background-color: #fdeded;
  color: #5f2120;
`;

const SuccessMessage = styled(Message)`
  /* Specific to phone auth part */
  background-color: #edf7ed;
  color: #1e4620;
`;

const HelpText = styled.p`
  font-size: 0.92rem;
  color: #6b7280;
  margin-top: -0.5rem;
  margin-bottom: 1.5rem;
  text-align: center;
`;

const ValidationMessage = styled.p`
  font-size: 1rem;
  color: #d93025;
  margin-top: -0.5rem;
  margin-bottom: 1.5rem;
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
  const [verificationId, setVerificationId] = useState<boolean>(false); // true once OTP sent
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isValidPhoneNumber, setIsValidPhoneNumber] = useState(false);

  // Handle Kakao Login Click — Supabase native Kakao OAuth
  const handleKakaoLoginClick = async () => {
    const redirectUrl = sanitizeRedirectUrl(searchParams.get("redirect"));
    if (redirectUrl) localStorage.setItem("returnUrl", redirectUrl);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        // Must land on the route handler that trades the PKCE code for a session —
        // the /auth page only reads an existing one.
        redirectTo: `${window.location.origin}/auth/callback${
          redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""
        }`,
        // account_email/phone_number are what let us recognise a returning member.
        // The number never appears in the id_token, but the scope puts it on the
        // access token so the `kakao-login` hook can read it from kapi.kakao.com.
        scopes: "profile_nickname profile_image account_email phone_number",
      },
    });
    if (error) setErrorState(error.message);
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
    // Clean up the input (remove non-digits)
    const cleanNumber = input.replace(/\D/g, "");

    // Allow more flexible validation to avoid frustrating users
    // Allow 10-11 digits Korean mobile numbers
    // Starting with 01X where X is usually 0, 1, 6, 7, 8, or 9
    const minLength = 10; // Minimum length for a valid Korean mobile number

    // Basic check: starts with 01 and has at least 10 digits
    setIsValidPhoneNumber(
      cleanNumber.startsWith("01") && cleanNumber.length >= minLength
    );
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
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) redirectOnSession();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, searchParams]);

  const onSignInSubmit = () => {
    if (!isValidPhoneNumber || loading) return;
    sendVerificationCode();
  };

  // Custom phone OTP delivered via Kakao AlimTalk (see app/api/phone-otp/*).
  // Free-plan alternative to Supabase's Pro-only Send SMS auth hook.
  const sendVerificationCode = async () => {
    setLoading(true);
    setErrorState(null);
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
      setVerificationId(true);
      setMessage("인증번호가 전송되었습니다!");
    } catch (err: unknown) {
      setErrorState(err instanceof Error ? err.message : "인증번호 전송에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationId) return;
    setLoading(true);
    setErrorState(null);
    try {
      const res = await fetch("/api/phone-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, code: verificationCode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "인증코드 확인에 실패했습니다");
      // Establish the Supabase session from the server-minted tokens; the
      // onAuthStateChange effect above then handles the redirect.
      const { error } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      if (error) throw error;
      setMessage("로그인 성공!");
    } catch (err: unknown) {
      setErrorState(err instanceof Error ? err.message : "인증코드 확인에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <GlobalLoadingScreen />}

      <AuthLayout>
        {showPhoneAuth ? (
          <>
            <AuthPageHeading>휴대폰으로 로그인</AuthPageHeading>
            <Description>
              인증코드를 받으실 휴대폰 번호를 입력해주세요. 인증번호는 카카오
              알림톡(또는 문자)으로 발송됩니다.
            </Description>
          </>
        ) : (
          <SignInGreeting />
        )}

        {!showPhoneAuth ? (
          <SignInChoices>
            <PhoneButton onClick={handlePhoneAuthClick}>
              <DevicePhoneMobileIcon />
              전화번호로 시작하기
            </PhoneButton>
            <KakaoButton onClick={handleKakaoLoginClick}>
              <img src="/images/kakao_btn.png" alt="Kakao Login" />
              카카오로 시작하기
            </KakaoButton>
          </SignInChoices>
        ) : (
          <FormContainer>
            {!verificationId ? (
              <>
                <Input
                  type="tel"
                  placeholder="휴대폰 번호 (예: 01012345678)"
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  disabled={loading}
                />
                {phoneNumber && !isValidPhoneNumber ? (
                  <ValidationMessage>
                    올바른 휴대폰 번호를 입력해주세요 (예: 01012345678)
                  </ValidationMessage>
                ) : (
                  <HelpText>
                    공백이나 대시(-) 없이 번호만 입력해주세요.
                  </HelpText>
                )}
                <Button
                  id="send-code-button"
                  onClick={onSignInSubmit}
                  disabled={!isValidPhoneNumber || loading}
                >
                  {loading ? "전송 중..." : "인증번호 전송"}
                </Button>
              </>
            ) : (
              <>
                <Input
                  type="text"
                  placeholder="인증번호 입력"
                  value={verificationCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setVerificationCode(e.target.value)
                  }
                  disabled={loading}
                />
                <Button
                  onClick={verifyCode}
                  disabled={!verificationCode || loading}
                >
                  {loading ? "확인 중..." : "인증번호 확인"}
                </Button>
              </>
            )}

            {errorState && <ErrorMessage>{errorState}</ErrorMessage>}
            {message && <SuccessMessage>{message}</SuccessMessage>}
          </FormContainer>
        )}
      </AuthLayout>
    </>
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
