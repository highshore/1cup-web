"use client";

import React, { useState } from "react";
import styled from "styled-components";

// Offered to someone whose profile was created without matching an existing member.
// Kakao withholds the phone number for about half our members, so a returning member
// signing in a new way can look brand new — and quietly lose their subscription and
// history to a second profile. The OTP they already use to sign in settles it, without
// depending on what the provider chose to share.

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 1rem;
  backdrop-filter: blur(4px);
`;

const Dialog = styled.div`
  background: white;
  border-radius: 20px;
  padding: 2.25rem;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 10px 50px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.05);

  @media (max-width: 480px) {
    padding: 1.75rem 1.35rem;
  }
`;

const Title = styled.h2`
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 0.6rem;
  color: #1f2937;
  text-align: center;
`;

const Description = styled.p`
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.65;
  margin: 0 0 1.75rem;
  text-align: center;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.95rem 1.15rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1rem;
  background: #fafbfc;

  &:focus {
    outline: none;
    border-color: #111827;
    background: #ffffff;
  }

  &:read-only {
    color: #6b7280;
  }
`;

const CodeInput = styled(Input)`
  margin-top: 0.75rem;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.4em;
  text-indent: 0.4em;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 1.5rem;
`;

const PrimaryButton = styled.button`
  width: 100%;
  min-height: 50px;
  border: 0;
  border-radius: 14px;
  background: #111827;
  color: #fff;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  width: 100%;
  padding: 0.6rem;
  border: 0;
  background: none;
  color: #6b7280;
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:disabled {
    color: #d1d5db;
    cursor: not-allowed;
  }
`;

const Message = styled.p<{ $error?: boolean }>`
  margin: 1rem 0 0;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  font-size: 0.9rem;
  line-height: 1.5;
  text-align: center;
  background: ${(p) => (p.$error ? "#fdeded" : "#edf7ed")};
  color: ${(p) => (p.$error ? "#5f2120" : "#1e4620")};
`;

interface IdentityLinkPromptProps {
  onComplete: () => void;
}

export default function IdentityLinkPrompt({ onComplete }: IdentityLinkPromptProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<null | "send" | "link" | "dismiss">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const phoneValid = /^01\d{8,9}$/.test(phone.replace(/\D/g, ""));

  const sendCode = async () => {
    setBusy("send");
    setError(null);
    try {
      const res = await fetch("/api/phone-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "" }));
        throw new Error(msg || "인증번호 전송에 실패했습니다.");
      }
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호 전송에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const linkAccount = async () => {
    setBusy("link");
    setError(null);
    try {
      const res = await fetch("/api/account/link-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "계정 연결에 실패했습니다.");
      setDone(
        body.hasActiveSubscription
          ? "기존 계정과 연결되었습니다. 구독 정보가 복구되었습니다."
          : "기존 계정과 연결되었습니다."
      );
      // The page is holding the old profile; a reload is the simplest way to make every
      // screen agree about who this is.
      window.setTimeout(() => window.location.reload(), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "계정 연결에 실패했습니다.");
      setBusy(null);
    }
  };

  const dismiss = async () => {
    setBusy("dismiss");
    try {
      await fetch("/api/account/link-phone", { method: "DELETE" });
    } catch {
      // Dismissing is a convenience; if it fails the prompt simply returns next time.
    }
    onComplete();
  };

  return (
    <Overlay>
      <Dialog role="dialog" aria-modal="true" aria-labelledby="identity-link-title">
        <Title id="identity-link-title">이전에 가입하신 적이 있나요?</Title>
        <Description>
          기존에 쓰시던 휴대폰 번호로 인증하시면 그 계정과 연결해 드립니다. 멤버십과
          학습 기록이 그대로 이어집니다. 처음이시라면 건너뛰셔도 됩니다.
        </Description>

        <Input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="이전에 사용하신 휴대폰 번호"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ""))}
          readOnly={codeSent}
        />

        {codeSent && (
          <CodeInput
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
          />
        )}

        <Actions>
          {!codeSent ? (
            <PrimaryButton
              type="button"
              onClick={sendCode}
              disabled={!phoneValid || busy !== null}
            >
              {busy === "send" ? "전송 중..." : "인증번호 받기"}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              type="button"
              onClick={linkAccount}
              disabled={code.length !== 6 || busy !== null || done !== null}
            >
              {busy === "link" ? "연결 중..." : "기존 계정과 연결하기"}
            </PrimaryButton>
          )}

          <GhostButton type="button" onClick={dismiss} disabled={busy !== null}>
            처음 가입이에요 · 건너뛰기
          </GhostButton>
        </Actions>

        {error && <Message $error>{error}</Message>}
        {done && <Message>{done}</Message>}
      </Dialog>
    </Overlay>
  );
}
