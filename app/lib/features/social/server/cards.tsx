// Server-only: renders Instagram card-news slides as 1080×1350 JPEGs in the 영어 한잔
// site style (off-white page, black 6px outlines, hard shadow, orange accents) and
// stores them in the public `assets` bucket. JPEG because Instagram's publishing API
// accepts nothing else; next/og draws PNG, sharp re-encodes it.
import { createHash } from "node:crypto";
import { ImageResponse } from "next/og";
import sharp from "sharp";

import { admin } from "../../../supabase/server";
import type { CardSlide, SocialMedia } from "../types";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
// Reels are 9:16. Instagram overlays its UI on roughly the top 180px and bottom 420px,
// so the card and the subtitle stay inside that safe area.
export const REEL_HEIGHT = 1920;

// The last card's call to action. Instagram posts point at the profile link; Threads
// posts carry the link in the post itself.
export const PROFILE_CTA = "프로필 링크에서 하루 무료 →";
export const POST_LINK_CTA = "글 속 링크에서 하루 무료 →";

const INK = "#050505";
const ORANGE = "#f47a4a";
const PAGE = "#f7f6f2";
const PEACH = "#fff1e9";

type FontWeight = 500 | 700 | 900;
let fontCache: Promise<Array<{ name: string; data: ArrayBuffer; weight: FontWeight; style: "normal" }>> | null = null;

// next/og ships no Hangul glyphs. Google Fonts serves TrueType (which satori reads) to
// old user agents, so fetch Noto Sans KR once per server instance.
async function loadFonts() {
  if (!fontCache) {
    fontCache = Promise.all(
      ([500, 700, 900] as FontWeight[]).map(async (weight) => {
        const css = await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}`, {
          headers: { "User-Agent": "Mozilla/4.0" },
        }).then((response) => response.text());
        const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
        if (!url) throw new Error("Unable to locate the Noto Sans KR font.");
        const data = await fetch(url).then((response) => response.arrayBuffer());
        return { name: "Noto Sans KR", data, weight, style: "normal" as const };
      }),
    ).catch((error) => {
      fontCache = null; // retry on the next render instead of caching the failure
      throw error;
    });
  }
  return fontCache;
}

// Satori breaks lines at any space, which can split a short quoted phrase
// ("I think...", '재귀적 자기 개선') across lines. Lay text out as a wrapping row of
// unbreakable words instead, with each quoted phrase kept as a single word.
// An opening quote must not follow a letter (so "won't" is not a quote) and a closing
// quote must not be followed by a Latin letter; a Korean particle may follow ("..."만).
// A quoted phrase too wide for one line ("'그건 회의 끝나고 따로 얘기해요' 영어로?" on a cover)
// would run off the card, so it is only kept whole when its estimated width fits.
const QUOTED = /((?<![\p{L}\p{N}])["“'‘][^"”'’\n]{1,28}?["”'’](?![A-Za-z])[^\s]*)/u;
const WIDE = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3000-\u9fff\uff00-\uffef]/;
/** Rough rendered width in ems: Hangul and other full-width glyphs ~0.95, the rest ~0.55. */
export const emWidth = (text: string) => [...text].reduce((sum, char) => sum + (WIDE.test(char) ? 0.95 : 0.55), 0);

export const textTokens = (text: string, maxEms = Infinity): string[] =>
  text
    .split(QUOTED)
    .flatMap((part, index) => (index % 2 === 1 && emWidth(part) <= maxEms ? [part] : part.split(/\s+/)))
    .filter(Boolean);

// Width of the text column inside a card (1080 minus page and card padding and borders),
// minus a margin; boxed text (the highlight) is narrower still.
const TEXT_WIDTH = 760;

function WrappedText({
  text,
  fontSize,
  style,
  width = TEXT_WIDTH,
}: {
  text: string;
  fontSize: number;
  style: Record<string, unknown>;
  width?: number;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: Math.round(fontSize * 0.28), fontSize, ...style }}>
      {textTokens(text, width / fontSize).map((token, index) => (
        <span key={index} style={{ whiteSpace: "nowrap" }}>
          {token}
        </span>
      ))}
    </div>
  );
}

function Slide({
  slide,
  index,
  total,
  reel = false,
  subtitle = "",
  cta = PROFILE_CTA,
}: {
  slide: CardSlide;
  index: number;
  total: number;
  reel?: boolean;
  subtitle?: string;
  cta?: string;
}) {
  const isCover = index === 0;
  const isLast = index === total - 1 && total > 1;
  const cardBg = isLast ? INK : "#ffffff";
  const text = isLast ? "#ffffff" : INK;
  const muted = isLast ? "rgba(255,255,255,0.78)" : "rgba(5,5,5,0.72)";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: reel ? "180px 64px 420px" : 64,
        background: PAGE,
        fontFamily: "Noto Sans KR",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 64px 56px",
          background: cardBg,
          border: `6px solid ${INK}`,
          borderRadius: 44,
          boxShadow: `18px 18px 0 ${isLast ? ORANGE : INK}`,
          color: text,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              padding: "10px 26px",
              background: ORANGE,
              color: INK,
              border: `4px solid ${INK}`,
              borderRadius: 999,
              fontSize: 32,
              fontWeight: 900,
            }}
          >
            {slide.eyebrow || "영어 한잔"}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: muted }}>
            {`${index + 1} / ${total}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {isCover && <div style={{ display: "flex", width: 120, height: 14, background: ORANGE, borderRadius: 999 }} />}
          <WrappedText
            text={slide.title}
            fontSize={isCover ? (reel ? 96 : 88) : reel ? 72 : 66}
            style={{ fontWeight: 900, lineHeight: 1.22, letterSpacing: -2 }}
          />
          {slide.body && (
            <WrappedText text={slide.body} fontSize={reel ? 44 : 40} style={{ fontWeight: 500, lineHeight: 1.55, color: muted }} />
          )}
          {slide.highlight && (
            <div
              style={{
                display: "flex",
                padding: "28px 34px",
                background: isLast ? ORANGE : PEACH,
                color: INK,
                border: `4px solid ${INK}`,
                borderRadius: 28,
              }}
            >
              <WrappedText text={slide.highlight} fontSize={40} width={TEXT_WIDTH - 80} style={{ fontWeight: 700, lineHeight: 1.4 }} />
            </div>
          )}
        </div>

        {subtitle && (
          <div
            style={{
              display: "flex",
              padding: "22px 30px",
              background: isLast ? ORANGE : INK,
              color: isLast ? INK : "#ffffff",
              borderRadius: 24,
            }}
          >
            <WrappedText text={subtitle} fontSize={38} width={TEXT_WIDTH - 70} style={{ fontWeight: 700, lineHeight: 1.45 }} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>영어 한잔</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 900, color: ORANGE, letterSpacing: 1 }}>DAILY</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: isLast ? ORANGE : muted }}>
            {isLast ? cta : "매일 아침 카톡으로 오는 영어"}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function renderSlidePng(
  slide: CardSlide,
  index: number,
  total: number,
  options: { reel?: boolean; subtitle?: string; cta?: string } = {},
): Promise<Buffer> {
  const fonts = await loadFonts();
  const png = await new ImageResponse(
    <Slide slide={slide} index={index} total={total} reel={options.reel} subtitle={options.subtitle} cta={options.cta} />,
    { width: CARD_WIDTH, height: options.reel ? REEL_HEIGHT : CARD_HEIGHT, fonts },
  ).arrayBuffer();
  return Buffer.from(png);
}

export async function renderSlideJpeg(slide: CardSlide, index: number, total: number, cta?: string): Promise<Buffer> {
  return sharp(await renderSlidePng(slide, index, total, { cta })).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

// File names hash the slide content, so an edited slide gets a new URL (no stale CDN
// copy) while re-rendering unchanged slides overwrites the same object.
export async function renderAndStoreSlides(postId: string, slides: CardSlide[], cta = PROFILE_CTA): Promise<SocialMedia[]> {
  const storage = admin().storage.from("assets");
  const media: SocialMedia[] = [];
  for (const [index, slide] of slides.entries()) {
    const jpeg = await renderSlideJpeg(slide, index, slides.length, cta);
    const hash = createHash("sha256").update(JSON.stringify([slide, index, slides.length, cta])).digest("hex").slice(0, 12);
    const path = `social/${postId}/${index + 1}-${hash}.jpg`;
    const { error } = await storage.upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`Unable to store card ${index + 1}: ${error.message}`);
    media.push({ url: storage.getPublicUrl(path).data.publicUrl, kind: "image" });
  }
  return media;
}
