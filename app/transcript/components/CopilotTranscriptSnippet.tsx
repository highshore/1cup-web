"use client";

import React from "react";
import type { CopilotConversationMessage } from "../hooks/useTranscriptCopilot";
import "./copilot-snippet.css";

export default function CopilotTranscriptSnippet({
  message,
  isThinking = false,
}: {
  message?: CopilotConversationMessage;
  isThinking?: boolean;
}) {
  return (
    <div className="flex gap-3 items-start mb-[0.9rem] w-full">
      <div
        className={`w-10 h-10 flex-[0_0_40px] rounded-full border border-[rgba(248,113,113,0.78)] bg-[radial-gradient(circle_at_45%_42%,#fee2e2_0_8%,#ef4444_18%,#7f1d1d_48%,#111827_74%)] ${
          isThinking
            ? "animate-[transcript-copilot-pulse_1.8s_ease-in-out_infinite]"
            : ""
        }`}
      />
      <div className="min-w-0 w-full">
        <div className="flex items-center gap-2">
          <span className="text-[#b91c1c] text-[1rem] font-bold">
            AI Copilot
          </span>
          <span className="text-[#64748b] text-[0.82rem]">
            {isThinking
              ? "listening"
              : message?.reason === "turn-switch"
                ? "turn switch"
                : "intervention"}
            {!isThinking && message?.action?.type !== "none"
              ? ` · ${message.action.label}`
              : ""}
          </span>
        </div>
        <div className="mt-[0.35rem] py-3 px-[0.85rem] border-l-2 border-l-[rgba(239,68,68,0.65)] bg-[#fff7f7] text-[#334155] rounded-[0_8px_8px_0] leading-[1.58] [overflow-wrap:anywhere]">
          {isThinking ? (
            <p className="m-0">
              Listening and thinking
              <span
                className="inline-flex gap-[0.18rem] items-center ml-[0.18rem] [&_span]:w-[0.28rem] [&_span]:h-[0.28rem] [&_span]:rounded-full [&_span]:bg-[#ef4444] [&_span]:animate-[transcript-copilot-dot-pulse_1.1s_ease-in-out_infinite] [&_span:nth-child(2)]:[animation-delay:0.16s] [&_span:nth-child(3)]:[animation-delay:0.32s]"
                aria-label="Thinking"
              >
                <span />
                <span />
                <span />
              </span>
            </p>
          ) : (
            <>
              <p className="m-0">
                {message?.error || message?.action?.message || message?.items?.[0]}
              </p>
              {message?.action?.type === "speech_correction" && message.action.replacement && (
                <p className="m-0">Try: {message.action.replacement}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
