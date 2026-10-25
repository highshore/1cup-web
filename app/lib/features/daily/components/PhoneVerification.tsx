"use client";

import { useState } from "react";
import { DailyApiError, dailyApi } from "../api";
import { cn } from "./DailyUI";

// Daily's own sign-in: a code to the number, no 1cup account involved.
//
// With maskedPhone, it is the step-up for someone signed in from a message link: the
// code goes to the subscriber's own number on the server, so there is nothing to type
// but the code.
export default function PhoneVerification({
  onVerified,
  maskedPhone,
}: {
  onVerified: () => Promise<void>;
  maskedPhone?: string;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const send = async () => {
    setBusy(true);
    setMessage("");
    try {
      await dailyApi("otp-send", maskedPhone ? { session: true } : { phone });
      setSent(true);
      setCode("");
      setMessage("인증번호를 카카오톡(또는 문자)으로 보냈어요.");
    } catch (e) {
      setMessage(e instanceof DailyApiError && e.message ? e.message : "인증번호를 보내지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setMessage("");
    try {
      await dailyApi("otp-verify", maskedPhone ? { session: true, code } : { phone, code });
      await onVerified();
    } catch (e) {
      setMessage(e instanceof DailyApiError && e.message ? e.message : "인증하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "h-12 min-w-0 flex-1 rounded-xl bg-[#f5f5f4] px-3 text-[1.05rem] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#050505]";
  const button =
    "h-12 shrink-0 rounded-xl px-4 text-[0.92rem] font-black transition-opacity disabled:opacity-35";

  return (
    <div className="rounded-[22px] bg-white p-5">
      <p className="text-[0.92rem] font-semibold text-[#475569]">
        {maskedPhone
          ? "카카오톡 링크로 들어오셨어요. 결제와 신청은 본인 확인을 한 번 거쳐요."
          : "레슨을 받을 번호예요. 회원가입 없이 인증번호로만 확인해요."}
      </p>
      <div className="mt-4 flex gap-2">
        {maskedPhone ? (
          <span className="flex h-12 min-w-0 flex-1 items-center whitespace-nowrap rounded-xl bg-[#f5f5f4] px-3 text-[1rem] font-bold">
            {maskedPhone}
          </span>
        ) : (
          <input
            inputMode="numeric"
            autoComplete="tel"
            placeholder="010-1234-5678"
            aria-label="휴대폰 번호"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^\d-]/g, "").slice(0, 13))}
            className={field}
          />
        )}
        <button
          type="button"
          onClick={send}
          disabled={busy || (!maskedPhone && phone.replace(/\D/g, "").length < 10)}
          className={cn(button, sent ? "bg-[#f5f5f4] text-[#050505]" : "bg-[#050505] text-white")}
        >
          {sent ? "다시 받기" : "인증번호 받기"}
        </button>
      </div>
      {sent && (
        <div className="mt-2 flex gap-2">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="인증번호 6자리"
            aria-label="인증번호"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className={field}
          />
          <button
            type="button"
            onClick={verify}
            disabled={busy || code.length !== 6}
            className={cn(button, "bg-[#f47a4a] text-[#050505]")}
          >
            확인
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-2.5 text-[0.86rem] font-semibold text-[#475569]">
          {message}
        </p>
      )}
    </div>
  );
}
