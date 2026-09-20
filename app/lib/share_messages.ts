/** Plain-text sharing only. Preserve paragraph breaks and emoji inside messages. */
export function normalizeShareText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t \u00a0\u200b\ufeff]+$/gm, "")
    .replace(/^[\s\u200b]+|[\s\u200b]+$/g, "");
}

export const SEATING_SHARE_MESSAGE = normalizeShareText(
  "안녕하세요! 오늘 영어 한잔 안암 커뮤니티 좌석배치 공유드립니다. 그럼 이따 뵙겠습니다!",
);

export function buildMeetupArticleMessage(meetupUrl: string): string {
  return normalizeShareText([
    "안녕하세요,",
    "",
    "저희 밋업페이지에 아티클이 업데이트 되었습니다.",
    normalizeShareText(meetupUrl),
    "*아티클은 로그인 하셔야 확인 가능합니다.",
    "",
    "질문은 추후 변경될 수 있는점 참고하셔서 확인 부탁드립니다.",
    "",
    "감사합니다!",
  ].join("\n"));
}

export function buildReferralShareMessage(title: string, code: string, url: string): string {
  return normalizeShareText(
    `${normalizeShareText(title)}: ${normalizeShareText(code)}\n${normalizeShareText(url)}`,
  );
}

/** Do not send a second URL/title when they are already part of the message. */
export function buildTextShareData(text: string): { text: string } {
  return { text: normalizeShareText(text) };
}

/** Copy text/plain, bypassing any formatting added by a native share target. */
export async function copyShareText(text: string): Promise<void> {
  const cleaned = normalizeShareText(text);
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(cleaned);
      return;
    }
  } catch {
    // Clipboard permissions or browser support may require the legacy fallback.
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is only available in a browser.");
  }

  const focused = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const textarea = document.createElement("textarea");
  textarea.value = cleaned;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.cssText = "position:fixed;top:0;left:-9999px;font-size:16px;";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, cleaned.length);
    if (!document.execCommand("copy")) {
      throw new Error("Unable to copy the share message.");
    }
  } finally {
    textarea.remove();
    focused?.focus?.({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
}
