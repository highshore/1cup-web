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

function Slide({ slide, index, total }: { slide: CardSlide; index: number; total: number }) {
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
        padding: 64,
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
          <div
            style={{
              display: "flex",
              fontSize: isCover ? 88 : 66,
              fontWeight: 900,
              lineHeight: 1.22,
              letterSpacing: -2,
              wordBreak: "keep-all",
            }}
          >
            {slide.title}
          </div>
          {slide.body && (
            <div style={{ display: "flex", fontSize: 40, fontWeight: 500, lineHeight: 1.55, color: muted, wordBreak: "keep-all" }}>
              {slide.body}
            </div>
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
                fontSize: 40,
                fontWeight: 700,
                lineHeight: 1.4,
              }}
            >
              {slide.highlight}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 900 }}>영어 한잔</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: muted }}>1 Cup English</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: isLast ? ORANGE : muted }}>
            {isLast ? "프로필 링크에서 신청 →" : "1cupenglish.com"}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function renderSlideJpeg(slide: CardSlide, index: number, total: number): Promise<Buffer> {
  const fonts = await loadFonts();
  const png = await new ImageResponse(<Slide slide={slide} index={index} total={total} />, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts,
  }).arrayBuffer();
  return sharp(Buffer.from(png)).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

// File names hash the slide content, so an edited slide gets a new URL (no stale CDN
// copy) while re-rendering unchanged slides overwrites the same object.
export async function renderAndStoreSlides(postId: string, slides: CardSlide[]): Promise<SocialMedia[]> {
  const storage = admin().storage.from("assets");
  const media: SocialMedia[] = [];
  for (const [index, slide] of slides.entries()) {
    const jpeg = await renderSlideJpeg(slide, index, slides.length);
    const hash = createHash("sha256").update(JSON.stringify([slide, index, slides.length])).digest("hex").slice(0, 12);
    const path = `social/${postId}/${index + 1}-${hash}.jpg`;
    const { error } = await storage.upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`Unable to store card ${index + 1}: ${error.message}`);
    media.push({ url: storage.getPublicUrl(path).data.publicUrl, kind: "image" });
  }
  return media;
}
