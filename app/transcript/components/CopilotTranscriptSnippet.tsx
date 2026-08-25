"use client";

import React from "react";
import styled, { keyframes } from "styled-components";
import type { CopilotConversationMessage } from "../hooks/useTranscriptCopilot";

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 18px rgba(239, 68, 68, 0.42), inset 0 0 18px rgba(254, 202, 202, 0.22); }
  50% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.66), inset 0 0 26px rgba(254, 202, 202, 0.32); }
`;

const dotPulse = keyframes`
  0%, 80%, 100% { opacity: 0.32; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
`;

const Snippet = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 0.9rem;
  width: 100%;
`;

const Lens = styled.div<{ $active?: boolean }>`
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 50%;
  border: 1px solid rgba(248, 113, 113, 0.78);
  background:
    radial-gradient(circle at 45% 42%, #fee2e2 0 8%, #ef4444 18%, #7f1d1d 48%, #111827 74%);
  animation: ${(props) => (props.$active ? pulse : "none")} 1.8s ease-in-out infinite;
`;

const Content = styled.div`
  min-width: 0;
  width: 100%;
`;

const HeadRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Name = styled.span`
  color: #b91c1c;
  font-size: 1rem;
  font-weight: 700;
`;

const Meta = styled.span`
  color: #64748b;
  font-size: 0.82rem;
`;

const Body = styled.div`
  margin-top: 0.35rem;
  padding: 0.75rem 0.85rem;
  border-left: 2px solid rgba(239, 68, 68, 0.65);
  background: #fff7f7;
  color: #334155;
  border-radius: 0 8px 8px 0;
  line-height: 1.58;
  overflow-wrap: anywhere;
`;

const Summary = styled.p`
  margin: 0;
`;

const TypingDots = styled.span`
  display: inline-flex;
  gap: 0.18rem;
  align-items: center;
  margin-left: 0.18rem;

  span {
    width: 0.28rem;
    height: 0.28rem;
    border-radius: 50%;
    background: #ef4444;
    animation: ${dotPulse} 1.1s ease-in-out infinite;
  }

  span:nth-child(2) {
    animation-delay: 0.16s;
  }

  span:nth-child(3) {
    animation-delay: 0.32s;
  }
`;

export default function CopilotTranscriptSnippet({
  message,
  isThinking = false,
}: {
  message?: CopilotConversationMessage;
  isThinking?: boolean;
}) {
  return (
    <Snippet>
      <Lens $active={isThinking} />
      <Content>
        <HeadRow>
          <Name>AI Copilot</Name>
          <Meta>
            {isThinking
              ? "listening"
              : message?.reason === "turn-switch"
                ? "turn switch"
                : "intervention"}
            {!isThinking && message?.action?.type !== "none"
              ? ` · ${message.action.label}`
              : ""}
          </Meta>
        </HeadRow>
        <Body>
          {isThinking ? (
            <Summary>
              Listening and thinking
              <TypingDots aria-label="Thinking">
                <span />
                <span />
                <span />
              </TypingDots>
            </Summary>
          ) : (
            <>
              <Summary>
                {message?.error || message?.action?.message || message?.items?.[0]}
              </Summary>
              {message?.action?.type === "speech_correction" && message.action.replacement && (
                <Summary>Try: {message.action.replacement}</Summary>
              )}
            </>
          )}
        </Body>
      </Content>
    </Snippet>
  );
}
