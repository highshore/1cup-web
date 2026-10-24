"use client";

import styled, { css, keyframes } from "styled-components";
import { newsletterColors as c } from "../constants";

const bounce = keyframes`
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(1); }
`;

const Button = styled.button<{ $active: boolean }>`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.35rem;
  border: 2px solid ${c.ink};
  border-radius: 999px;
  background: ${(props) => (props.$active ? c.orange : "#ffffff")};
  padding: 0.25rem 0.65rem 0.25rem 0.5rem;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 800;
  color: ${c.ink};
  cursor: pointer;
  transition: background-color 150ms ease;

  &:focus-visible {
    outline: 3px solid rgba(244, 122, 74, 0.45);
    outline-offset: 2px;
  }
`;

const Bars = styled.span<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 12px;

  i {
    display: block;
    width: 2.5px;
    height: 12px;
    border-radius: 2px;
    background: ${c.ink};
    transform: scaleY(0.45);
    ${(props) =>
      props.$active &&
      css`
        animation: ${bounce} 700ms ease-in-out infinite;
      `}
  }

  i:nth-child(2) {
    animation-delay: 120ms;
    transform: scaleY(0.8);
  }

  i:nth-child(3) {
    animation-delay: 240ms;
  }

  @media (prefers-reduced-motion: reduce) {
    i {
      animation: none;
    }
  }
`;

export default function SpeakButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button type="button" $active={active} aria-pressed={active} onClick={onClick}>
      <Bars $active={active} aria-hidden>
        <i />
        <i />
        <i />
      </Bars>
      {label}
    </Button>
  );
}
