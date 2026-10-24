"use client";

import { ReactNode } from "react";
import styled from "styled-components";
import { newsletterColors as c } from "../constants";

const Frame = styled.div<{ $shadow: string }>`
  position: relative;
  width: min(300px, 82vw);
  aspect-ratio: 300 / 610;
  border: 10px solid ${c.ink};
  border-radius: 46px;
  background: ${c.ink};
  box-shadow: 8px 8px 0 ${(props) => props.$shadow};
  overflow: hidden;
`;

const Screen = styled.div<{ $background: string }>`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 36px;
  background: ${(props) => props.$background};
`;

const StatusBar = styled.div`
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 22px;
  font-size: 0.78rem;
  font-weight: 800;
  color: ${c.ink};

  &::after {
    content: "";
    position: absolute;
    top: 9px;
    left: 50%;
    width: 84px;
    height: 22px;
    border-radius: 999px;
    background: ${c.ink};
    transform: translateX(-50%);
  }
`;

const Signal = () => (
  <svg width="38" height="12" viewBox="0 0 38 12" fill={c.ink} aria-hidden>
    <rect x="0" y="8" width="3" height="4" rx="1" />
    <rect x="5" y="6" width="3" height="6" rx="1" />
    <rect x="10" y="3" width="3" height="9" rx="1" />
    <rect x="15" y="0" width="3" height="12" rx="1" />
    <rect x="23" y="1" width="13" height="10" rx="3" fill="none" stroke={c.ink} strokeWidth="1.5" />
    <rect x="25" y="3" width="8" height="6" rx="1.5" />
  </svg>
);

// A plain device frame that renders live product UI instead of screenshots.
export default function PhoneFrame({
  children,
  time,
  background = "#ffffff",
  shadow = c.orange,
  label,
}: {
  children: ReactNode;
  time: string;
  background?: string;
  shadow?: string;
  label: string;
}) {
  return (
    <Frame $shadow={shadow} role="img" aria-label={label}>
      <Screen $background={background}>
        <StatusBar>
          <span>{time}</span>
          <Signal />
        </StatusBar>
        {children}
      </Screen>
    </Frame>
  );
}
