import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The link preview for /daily and every page under it (KakaoTalk, iMessage, Slack…):
// the white 1cup logo on black, with the DAILY wordmark. Prerendered once at build time,
// like app/opengraph-image.tsx.
export const alt = "One Cup Daily";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const svg = await readFile(join(process.cwd(), "public/images/logos/1cup_logo_new_white.svg"));
  const logo = `data:image/svg+xml;base64,${svg.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
          background: "#050505",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={592} height={144} />
        <div
          style={{
            display: "flex",
            color: "#f47a4a",
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: 18,
            // Letter spacing also trails the last letter; this keeps the word centred.
            paddingLeft: 18,
          }}
        >
          DAILY
        </div>
      </div>
    ),
    size,
  );
}
