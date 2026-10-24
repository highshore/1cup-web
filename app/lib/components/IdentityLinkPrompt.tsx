"use client";

import React, { useState } from "react";

// Offered to someone whose profile was created without matching an existing member.
// Kakao withholds the phone number for about half our members, so a returning member
// signing in a new way can look brand new — and quietly lose their subscription and
// history to a second profile. The OTP they already use to sign in settles it, without
// depending on what the provider chose to share.

const inputClass =
  "w-full rounded-xl border border-[#e5e7eb] bg-[#fafbfc] px-[1.15rem] py-[0.95rem] text-[1rem] read-only:text-[#6b7280] focus:border-[#111827] focus:bg-white focus:outline-none";

const codeInputClass = `${inputClass} mt-3 text-center text-[1.3rem] font-bold tracking-[0.4em] [text-indent:0.4em]`;

const primaryButtonClass =
  "min-h-[50px] w-full cursor-pointer rounded-[14px] border-0 bg-[#111827] [font-family:inherit] text-[1rem] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#d1d5db]";

const ghostButtonClass =
  "w-full cursor-pointer border-0 bg-transparent p-[0.6rem] [font-family:inherit] text-[0.9rem] text-[#6b7280] underline underline-offset-[3px] disabled:cursor-not-allowed disabled:text-[#d1d5db]";

const messageClass = (error: boolean) =>
  `m-0 mt-4 rounded-[10px] px-[0.9rem] py-[0.7rem] text-center text-[0.9rem] leading-[1.5] ${
    error ? "bg-[#fdeded] text-[#5f2120]" : "bg-[#edf7ed] text-[#1e4620]"
  }`;

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[4px]">
      <div
        className="w-full max-w-[440px] rounded-[20px] border border-black/5 bg-white p-9 shadow-[0_10px_50px_rgba(0,0,0,0.15)] max-[480px]:px-[1.35rem] max-[480px]:py-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-link-title"
      >
        <h2
          id="identity-link-title"
          className="m-0 mb-[0.6rem] text-center text-[1.35rem] font-bold text-[#1f2937]"
        >
          이전에 가입하신 적이 있나요?
        </h2>
        <p className="m-0 mb-7 text-center text-[0.95rem] leading-[1.65] text-[#6b7280]">
          기존에 쓰시던 휴대폰 번호로 인증하시면 그 계정과 연결해 드립니다. 멤버십과
          학습 기록이 그대로 이어집니다. 처음이시라면 건너뛰셔도 됩니다.
        </p>

        <input
          className={inputClass}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="이전에 사용하신 휴대폰 번호"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ""))}
          readOnly={codeSent}
        />

        {codeSent && (
          <input
            className={codeInputClass}
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

        <div className="mt-6 flex flex-col gap-[0.6rem]">
          {!codeSent ? (
            <button
              className={primaryButtonClass}
              type="button"
              onClick={sendCode}
              disabled={!phoneValid || busy !== null}
            >
              {busy === "send" ? "전송 중..." : "인증번호 받기"}
            </button>
          ) : (
            <button
              className={primaryButtonClass}
              type="button"
              onClick={linkAccount}
              disabled={code.length !== 6 || busy !== null || done !== null}
            >
              {busy === "link" ? "연결 중..." : "기존 계정과 연결하기"}
            </button>
          )}

          <button
            className={ghostButtonClass}
            type="button"
            onClick={dismiss}
            disabled={busy !== null}
          >
            처음 가입이에요 · 건너뛰기
          </button>
        </div>

        {error && <p className={messageClass(true)}>{error}</p>}
        {done && <p className={messageClass(false)}>{done}</p>}
      </div>
    </div>
  );
}
