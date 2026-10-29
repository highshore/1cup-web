"use client";

import { useEffect, useState, type MouseEvent } from "react";

// Daily's only sign-in: Kakao Login, which supplies the account's verified phone number
// (where the Alimtalk lessons go) and nickname. Nobody types a number, and no 1cup
// account is involved.
//
// With confirm, it is the step-up for someone signed in from a message link: logging in
// with Kakao again turns the link session into a full one.
const KAKAO_ERRORS: Record<string, string> = {
  cancelled: "카카오 로그인을 취소했어요.",
  "no-phone": "카카오계정의 휴대폰 번호를 받지 못했어요. 레슨이 이 번호로 가요. 다시 시작해서 전화번호 제공에 동의해 주세요.",
  "unsupported-phone": "카카오계정의 휴대폰 번호로는 알림톡을 받을 수 없어요. 국내 휴대폰 번호가 등록된 카카오계정으로 시작해 주세요.",
  failed: "카카오로 로그인하지 못했어요. 잠시 후 다시 시도해 주세요.",
  expired: "로그인이 중간에 끊겼어요. 아래 버튼으로 다시 시작해 주세요.",
};

export default function KakaoSignIn({
  confirm = false,
  bare = false,
  detail,
}: {
  confirm?: boolean;
  // Drop the white card when the caller already renders one, so it isn't a box in a box.
  bare?: boolean;
  // Null when the caller already explains it next to the button.
  detail?: string | null;
}) {
  const [message, setMessage] = useState("");
  const [href, setHref] = useState("/api/daily/kakao");
  // Between the tap and Kakao's page loading there is a pause of a second or more,
  // long enough that people tap again or think nothing happened.
  const [pending, setPending] = useState(false);

  // Back from Kakao Login: say why it did not sign in, and come back to this page next time.
  useEffect(() => {
    const url = new URL(window.location.href);
    const reason = url.searchParams.get("kakao");
    if (reason) {
      setMessage(KAKAO_ERRORS[reason] ?? KAKAO_ERRORS.failed);
      url.searchParams.delete("kakao");
      window.history.replaceState(null, "", url.toString());
    }
    setHref(`/api/daily/kakao?next=${encodeURIComponent(url.pathname + url.search)}`);

    // Backing out of Kakao's page restores this one from the back-forward cache with the
    // spinner still going.
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    // A modified click opens a new tab and leaves this page where it is.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setPending(true);
  };

  return (
    <div className={bare ? undefined : "rounded-[22px] bg-white p-5"}>
      {detail !== null && (
        <p className="mb-4 text-[0.92rem] font-semibold text-[#475569]">
          {detail ??
            (confirm
              ? "결제나 신청처럼 중요한 작업은 안전을 위해 다시 한번 로그인해 주세요."
              : "카카오계정으로 바로 시작해요. 레슨은 카카오계정의 휴대폰 번호로 알림톡이 가요.")}
        </p>
      )}
      <a
        href={href}
        onClick={handleClick}
        aria-busy={pending}
        aria-disabled={pending}
        className={`flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-[#fee500] text-[1.05rem] font-black text-[#191600] ${
          pending ? "cursor-progress" : ""
        }`}
      >
        {pending ? (
          <span
            className="size-5 animate-spin rounded-full border-[2.5px] border-[#191600]/25 border-t-[#191600]"
            aria-hidden
          />
        ) : (
          <svg viewBox="0 0 24 22" className="size-5" fill="currentColor" aria-hidden>
            <path d="M12 0C5.4 0 0 4.2 0 9.4c0 3.4 2.3 6.4 5.7 8l-1.2 4.3c-.1.4.3.7.6.5l5-3.3c.6.1 1.2.1 1.9.1 6.6 0 12-4.2 12-9.4S18.6 0 12 0Z" />
          </svg>
        )}
        {pending ? "카카오로 이동하고 있어요" : confirm ? "카카오로 다시 로그인하기" : "카카오로 시작하기"}
      </a>
      {message && (
        <p role="status" className="mt-2.5 text-[0.86rem] font-semibold text-[#b91c1c]">
          {message}
        </p>
      )}
    </div>
  );
}
