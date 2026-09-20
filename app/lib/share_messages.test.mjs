import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeShareText, SEATING_SHARE_MESSAGE, buildMeetupArticleMessage,
  buildReferralShareMessage, buildTextShareData, copyShareText,
} from "./share_messages.ts";

const meetupUrl = "https://1cupenglish.com/meetup/2026-09-20-Anam";

test("article announcement preserves the existing copy and paragraph breaks", () => {
  assert.equal(buildMeetupArticleMessage(meetupUrl), `안녕하세요,\n\n저희 밋업페이지에 아티클이 업데이트 되었습니다.\n${meetupUrl}\n*아티클은 로그인 하셔야 확인 가능합니다.\n\n질문은 추후 변경될 수 있는점 참고하셔서 확인 부탁드립니다.\n\n감사합니다!`);
});

test("seating announcement preserves the existing copy without a final line break", () => {
  assert.equal(SEATING_SHARE_MESSAGE, "안녕하세요! 오늘 영어 한잔 안암 커뮤니티 좌석배치 공유드립니다. 그럼 이따 뵙겠습니다!");
  assert.equal(SEATING_SHARE_MESSAGE, SEATING_SHARE_MESSAGE.trim());
});

test("trims ordinary, nonbreaking and invisible edge whitespace", () => {
  assert.equal(normalizeShareText("\ufeff\u200b \n감사합니다! \t\u00a0\n\u200b\n"), "감사합니다!");
});

test("normalizes CRLF and CR without collapsing intentional paragraphs", () => {
  assert.equal(normalizeShareText("첫 문단  \r\n\r\n다음 문단\t\r끝\r\n"), "첫 문단\n\n다음 문단\n끝");
});

test("preserves emoji joiners and interior indentation", () => {
  assert.equal(normalizeShareText("\n안녕하세요 🧑‍💻\n  설명\n\n끝!\n"), "안녕하세요 🧑‍💻\n  설명\n\n끝!");
});

test("normalization is idempotent and handles an empty message", () => {
  const value = "\u200b\n본문 \r\n\n끝! \n";
  assert.equal(normalizeShareText(normalizeShareText(value)), normalizeShareText(value));
  assert.equal(normalizeShareText(" \n\t\u200b\ufeff"), "");
});

test("referral messages contain exactly one URL in Korean and English", () => {
  const url = "https://1cupenglish.com/payment?ref=EXAMPLE";
  for (const title of ["영어 한잔 추천 코드", "One Cup English referral code"]) {
    const message = buildReferralShareMessage(`${title}\n`, " EXAMPLE ", `${url}\n`);
    assert.equal(message, `${title}: EXAMPLE\n${url}`);
    assert.equal(message.split(url).length - 1, 1);
    assert.deepEqual(buildTextShareData(`${message}\n\n`), { text: message });
  }
});

test("article URL and the end of the message are normalized", () => {
  const message = buildMeetupArticleMessage(` ${meetupUrl}\n`);
  assert.ok(message.endsWith("감사합니다!"));
  assert.equal(message.split(meetupUrl).length - 1, 1);
});

function installGlobals(navigatorValue, documentValue) {
  const previous = ["navigator", "document"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigatorValue });
  Object.defineProperty(globalThis, "document", { configurable: true, value: documentValue });
  return () => previous.forEach(([key, descriptor]) => {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  });
}

test("modern clipboard receives only the normalized text", async () => {
  let written;
  const restore = installGlobals({ clipboard: { writeText: async (text) => { written = text; } } }, undefined);
  try {
    await copyShareText("\n감사합니다!\n\u200b");
    assert.equal(written, "감사합니다!");
  } finally { restore(); }
});

function legacyDocument(success) {
  const state = { removed: false, restoredFocus: false, copied: null, selectionRestored: false };
  const range = { cloneRange() { return this; } };
  const textarea = { style: {}, setAttribute() {}, focus() {}, select() {}, setSelectionRange() {}, remove() { state.removed = true; } };
  const selection = { rangeCount: 1, getRangeAt() { return range; }, removeAllRanges() {}, addRange(value) { state.selectionRestored = value === range; } };
  const document = {
    activeElement: { focus() { state.restoredFocus = true; } },
    getSelection() { return selection; }, createElement() { return textarea; },
    body: { appendChild() {} }, execCommand(command) { assert.equal(command, "copy"); state.copied = textarea.value; return success; },
  };
  return { state, document };
}

test("denied modern clipboard falls back and restores focus and selection", async () => {
  const { state, document } = legacyDocument(true);
  const restore = installGlobals({ clipboard: { writeText: async () => { throw new Error("denied"); } } }, document);
  try {
    await copyShareText("\n안내문\n\n");
    assert.deepEqual(state, { removed: true, restoredFocus: true, copied: "안내문", selectionRestored: true });
  } finally { restore(); }
});

test("failed fallback rejects and still cleans up", async () => {
  const { state, document } = legacyDocument(false);
  const restore = installGlobals({}, document);
  try {
    await assert.rejects(copyShareText("안내문\n"), /Unable to copy/);
    assert.equal(state.removed, true);
    assert.equal(state.restoredFocus, true);
    assert.equal(state.selectionRestored, true);
  } finally { restore(); }
});
