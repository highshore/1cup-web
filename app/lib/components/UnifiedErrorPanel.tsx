"use client";

interface UnifiedErrorPanelProps {
  title?: string;
  message?: string;
  detail?: string | null;
  onRetry?: () => void;
  homeHref?: string;
  fullHeight?: boolean;
}

export default function UnifiedErrorPanel({
  title = "페이지를 불러오지 못했습니다",
  message = "일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  detail,
  onRetry,
  homeHref = "/",
  fullHeight = true,
}: UnifiedErrorPanelProps) {
  return (
    <div
      role="alert"
      style={{
        minHeight: fullHeight ? "min(72vh, 620px)" : undefined,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        color: "#050505",
        fontFamily: '"Noto Sans KR", sans-serif',
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          border: "2px solid #050505",
          borderRadius: "18px",
          background: "#ffffff",
          padding: "clamp(1.35rem, 4vw, 2rem)",
          boxShadow: "6px 6px 0 #050505",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2rem", lineHeight: 1 }}>☕</div>
        <h1
          style={{
            margin: "0.8rem 0 0",
            fontSize: "clamp(1.25rem, 4vw, 1.55rem)",
            fontWeight: 950,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: "0.5rem auto 0",
            maxWidth: "410px",
            color: "rgba(5,5,5,0.62)",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        {detail && (
          <code
            style={{
              display: "block",
              marginTop: "0.65rem",
              color: "rgba(5,5,5,0.42)",
              fontSize: "0.7rem",
            }}
          >
            {detail}
          </code>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.6rem",
            flexWrap: "wrap",
            marginTop: "1.15rem",
          }}
        >
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                minHeight: "2.65rem",
                border: "2px solid #050505",
                borderRadius: "999px",
                background: "#f47a4a",
                color: "#050505",
                padding: "0.55rem 1rem",
                font: "inherit",
                fontSize: "0.82rem",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "2px 2px 0 #050505",
              }}
            >
              다시 시도
            </button>
          )}
          <a
            href={homeHref}
            style={{
              minHeight: "2.65rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #050505",
              borderRadius: "999px",
              background: "#ffffff",
              color: "#050505",
              padding: "0.55rem 1rem",
              fontSize: "0.82rem",
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            홈으로
          </a>
        </div>
      </div>
    </div>
  );
}
