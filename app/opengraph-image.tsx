import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "영어 한잔 - 1 Cup English";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            '"Noto Sans KR", "Inter", "Arial", "Helvetica", sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 88,
              height: 88,
              borderRadius: 24,
              background: "#0f172a",
              color: "#ffffff",
              fontSize: 42,
              fontWeight: 900,
            }}
          >
            1
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 42, fontWeight: 900 }}>영어 한잔</div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#475569",
              }}
            >
              1 Cup English
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontSize: 74,
              lineHeight: 1.08,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            오프라인 실전 영어 모임
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.35,
              fontWeight: 700,
              color: "#334155",
            }}
          >
            매주 영어 모임으로 회화 습관을 만들고, 매일 아티클로 어휘력을
            쌓아보세요.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#64748b",
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          <span>1cupenglish.com</span>
        </div>
      </div>
    ),
    size,
  );
}
