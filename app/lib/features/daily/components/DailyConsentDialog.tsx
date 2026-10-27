"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CheckIcon, ChevronRightIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { DailyPrivacyDocument, DailyTermsDocument } from "./DailyLegal";
import { cn, Emoji } from "./DailyUI";

// The agreement sheet that opens when someone starts a free trial (and, with
// mode="payment", before they pay). Same shape as Roundy's account consent: required
// items each open their document inside the sheet, closing without agreeing explains
// why it is needed instead of silently doing nothing, and the server re-checks every
// required agreement, so this dialog is not the only guard.

export interface DailyConsent {
  marketing: boolean;
}

type View = "summary" | "terms" | "privacy" | "refused";

type ItemKey = "terms" | "privacy" | "messages" | "marketing";

export default function DailyConsentDialog({
  mode = "trial",
  busy,
  error,
  onAccept,
  onClose,
}: {
  mode?: "trial" | "payment";
  busy: boolean;
  error?: string;
  onAccept: (consent: DailyConsent) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<View>("summary");
  const [checked, setChecked] = useState<Record<ItemKey, boolean>>({
    terms: false,
    privacy: false,
    messages: false,
    marketing: false,
  });

  // Read inside the observer below, which is set up once.
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    busyRef.current = busy;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";

    // Chrome closes a modal dialog outright, with no cancel event, when Escape is
    // pressed twice without a click in between. Watching the open attribute catches
    // that (and any other way the dialog gets closed) where the close event is not
    // reliably delivered. While a request is in flight the sheet reopens, since it has
    // to stay up to show the result.
    let unmounting = false;
    const observer = new MutationObserver(() => {
      if (unmounting || element.open) return;
      if (busyRef.current) element.showModal();
      else onCloseRef.current();
    });
    observer.observe(element, { attributes: true, attributeFilter: ["open"] });

    return () => {
      unmounting = true;
      observer.disconnect();
      if (element.open) element.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  // The terms hold the refund rules, so before paying the one terms item covers both.
  const termsLabel = mode === "payment" ? "이용약관 및 환불 규정" : "영어 한잔 Daily 이용약관";
  const items: Array<{ key: ItemKey; label: string; required: boolean; doc?: "terms" | "privacy" }> = [
    { key: "terms", label: termsLabel, required: true, doc: "terms" },
    { key: "privacy", label: "개인정보 수집·이용", required: true, doc: "privacy" },
    { key: "messages", label: "레슨 메시지(알림톡·문자) 받기", required: true },
    { key: "marketing", label: "혜택·이벤트 소식 받기", required: false },
  ];

  const requiredDone = items.filter((i) => i.required).every((i) => checked[i.key]);
  const allDone = items.every((i) => checked[i.key]);

  const toggleAll = () => {
    const next = !allDone;
    setChecked((current) => {
      const updated = { ...current };
      for (const item of items) updated[item.key] = next;
      return updated;
    });
  };

  // 확인했어요 at the bottom of a document counts as agreeing to it.
  const confirmDoc = (doc: "terms" | "privacy") => {
    setChecked((current) => ({ ...current, [doc]: true }));
    setView("summary");
  };

  const dismiss = () => {
    if (busy) return;
    setView(view === "summary" ? "refused" : "summary");
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="daily-consent-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      className="daily-page m-auto max-h-[min(720px,92dvh)] w-[min(440px,calc(100vw-24px))] overflow-hidden rounded-[28px] border-0 bg-white p-0 text-[#050505] shadow-[0_30px_80px_-20px_rgba(5,5,5,0.5)] backdrop:bg-[rgba(5,5,5,0.55)] max-[520px]:mb-0 max-[520px]:w-full max-[520px]:max-w-full max-[520px]:rounded-b-none"
    >
      <div className="flex max-h-[min(720px,92dvh)] flex-col [word-break:keep-all]">
        {view === "terms" || view === "privacy" ? (
          <>
            <div className="flex items-center gap-2 border-b border-[#f1f5f9] px-4 py-3">
              <button
                type="button"
                onClick={() => setView("summary")}
                aria-label="동의 화면으로 돌아가기"
                className="flex size-10 items-center justify-center rounded-full hover:bg-[#f5f5f5]"
              >
                <ArrowLeftIcon className="size-5" />
              </button>
              <h2 id="daily-consent-title" className="text-[1.05rem] font-black">
                {view === "terms" ? termsLabel : "개인정보 수집·이용 안내"}
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5" tabIndex={0}>
              {view === "terms" ? <DailyTermsDocument /> : <DailyPrivacyDocument />}
            </div>
            <div className="border-t border-[#f1f5f9] p-4">
              <button
                type="button"
                onClick={() => confirmDoc(view)}
                className="h-[54px] w-full rounded-2xl bg-[#050505] text-[1rem] font-black text-white"
              >
                확인했어요
              </button>
            </div>
          </>
        ) : view === "refused" ? (
          <div className="flex flex-col items-center px-6 pb-6 pt-9 text-center">
            <Emoji label="우는 얼굴" className="text-[4rem]">
              😭
            </Emoji>
            <h2 id="daily-consent-title" className="mt-4 text-[1.3rem] font-black">
              동의가 필요해요
            </h2>
            <p className="mt-2 text-[0.95rem] leading-[1.65] text-[#475569]">
              레슨을 카카오톡으로 보내려면 필수 항목에 동의해야 해요. 선택 항목은 동의하지 않아도 괜찮아요.
            </p>
            <button
              type="button"
              onClick={() => setView("summary")}
              className="mt-6 h-[54px] w-full rounded-2xl bg-[#050505] text-[1rem] font-black text-white"
            >
              약관 확인하기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 h-12 w-full rounded-2xl text-[0.95rem] font-bold text-[#64748b]"
            >
              다음에 할게요
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto px-6 pb-6 pt-7">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f47a4a] text-[#050505]">
              <ShieldCheckIcon className="size-6" />
            </span>
            <h2 id="daily-consent-title" className="mt-4 text-[1.35rem] font-black leading-snug">
              {mode === "payment" ? "결제 전에 확인해 주세요" : "시작하기 전에 확인해 주세요"}
            </h2>
            <p className="mt-1.5 text-[0.92rem] text-[#475569]">아래 내용을 확인하고 동의해 주세요.</p>

            <button
              type="button"
              onClick={toggleAll}
              disabled={busy}
              className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-[#f5f5f4] px-4 py-3.5 text-left text-[1rem] font-black"
            >
              <Box on={allDone} />
              전체 동의
            </button>

            <ul className="m-0 mt-2 list-none p-0">
              {items.map((item) => (
                <li key={item.key} className="flex items-center gap-1">
                  <label className="flex min-h-[48px] flex-1 cursor-pointer items-center gap-3 px-4 text-[0.95rem] font-semibold">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked[item.key]}
                      disabled={busy}
                      onChange={(event) =>
                        setChecked((current) => ({ ...current, [item.key]: event.target.checked }))
                      }
                    />
                    <Box on={checked[item.key]} small />
                    <span>
                      <span className={item.required ? "text-[#d95f2d]" : "text-[#64748b]"}>
                        [{item.required ? "필수" : "선택"}]
                      </span>{" "}
                      {item.label}
                    </span>
                  </label>
                  {item.doc && (
                    <button
                      type="button"
                      onClick={() => setView(item.doc!)}
                      className="flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-2 text-[0.82rem] font-bold text-[#64748b] hover:bg-[#f5f5f5]"
                    >
                      보기
                      <ChevronRightIcon className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-[#fef2f2] px-4 py-3 text-[0.88rem] font-semibold text-[#b91c1c]"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={busy || !requiredDone}
              onClick={() => onAccept({ marketing: checked.marketing })}
              className="mt-5 h-[54px] w-full rounded-2xl bg-[#050505] text-[1.02rem] font-black text-white transition-opacity disabled:opacity-35"
            >
              {busy ? "잠시만 기다려 주세요…" : mode === "payment" ? "동의하고 결제하기" : "동의하고 무료 레슨 받기"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setView("refused")}
              className="mt-2 h-12 w-full rounded-2xl text-[0.92rem] font-bold text-[#64748b]"
            >
              다음에 할게요
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

function Box({ on, small = false }: { on: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#050505] peer-focus-visible:ring-offset-2",
        small ? "size-6" : "size-7",
        on ? "bg-[#f47a4a] text-[#050505]" : "bg-white text-[#cbd5e1] ring-1 ring-[#e2e8f0]",
      )}
    >
      <CheckIcon className={small ? "size-3.5" : "size-4"} strokeWidth={3} />
    </span>
  );
}
