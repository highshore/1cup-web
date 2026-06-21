"use client";

import React from "react";
import styled, { keyframes } from "styled-components";

import { colors } from "../constants/colors";

const slideIn = keyframes`
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-20px);
    opacity: 0;
  }
`;

const WarningOverlay = styled.div<{ isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  opacity: ${(props) => (props.isVisible ? 1 : 0)};
  visibility: ${(props) => (props.isVisible ? "visible" : "hidden")};
  transition: opacity 0.3s ease, visibility 0.3s ease;
  -webkit-overflow-scrolling: touch;
  touch-action: none;
`;

const WarningContainer = styled.div<{ isVisible: boolean; isExiting: boolean }>`
  background: #ef4444;
  color: white;
  padding: 2rem 2.5rem;
  border-radius: 16px;
  box-shadow: 6px 6px 0 rgba(5, 5, 5, 0.9);
  display: flex;
  align-items: center;
  gap: 1.2rem;
  max-width: 90%;
  width: 500px;
  position: relative;
  transform: scale(1);
  transition: transform 0.3s ease;
  animation: ${(props) => (props.isExiting ? slideOut : slideIn)} 0.3s ease;
  border: 2px solid #050505;

  @media (max-width: 768px) {
    padding: 1.5rem 2rem;
    width: 85%;
    font-size: 0.9rem;
    gap: 1rem;
  }

  @media (max-width: 480px) {
    padding: 1.2rem 1.5rem;
    width: 90%;
    gap: 0.8rem;
    font-size: 0.85rem;
  }
`;

const WarningIcon = styled.div`
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    font-size: 1.7rem;
  }

  @media (max-width: 480px) {
    font-size: 1.5rem;
  }
`;

const WarningText = styled.div`
  font-weight: 500;
  line-height: 1.5;
  flex: 1;
  font-size: 1.1rem;

  @media (max-width: 768px) {
    font-size: 1rem;
  }

  @media (max-width: 480px) {
    font-size: 0.9rem;
  }
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
`;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: white;

  @media (max-width: 480px) {
    width: 14px;
    height: 14px;
  }
`;

const CheckboxLabel = styled.label`
  font-size: 0.9rem;
  font-weight: 400;
  cursor: pointer;
  user-select: none;

  @media (max-width: 480px) {
    font-size: 0.8rem;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }

  @media (max-width: 768px) {
    top: 0.8rem;
    right: 0.8rem;
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    top: 0.7rem;
    right: 0.7rem;
    width: 24px;
    height: 24px;
    font-size: 0.8rem;
  }
`;

interface TranslationWarningProps {
  isVisible: boolean;
  onClose: () => void;
  onDontShowAgain: (dontShow: boolean) => void;
}

const TranslationWarning: React.FC<TranslationWarningProps> = ({
  isVisible,
  onClose,
  onDontShowAgain,
}) => {
  const [isExiting, setIsExiting] = React.useState(false);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      onDontShowAgain(true);
    }

    setIsExiting(true);
    setTimeout(() => {
      setIsExiting(false);
      onClose();
      setDontShowAgain(false); // Reset for next time
    }, 300);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDontShowAgain(e.target.checked);
  };

  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        handleClose();
      }, 8000); // Increased to 8 seconds to give time to read checkbox

      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <WarningOverlay isVisible={isVisible} onClick={handleClose}>
      <WarningContainer
        isVisible={isVisible}
        isExiting={isExiting}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <WarningIcon>⚠️</WarningIcon>
        <div style={{ flex: 1 }}>
          <WarningText>
            한국어에 너무 의존하면 영어 공부에 도움이 안됩니다
          </WarningText>
          <CheckboxContainer>
            <Checkbox
              type="checkbox"
              id="dontShowAgain"
              checked={dontShowAgain}
              onChange={handleCheckboxChange}
            />
            <CheckboxLabel htmlFor="dontShowAgain">
              다시 보지 않기
            </CheckboxLabel>
          </CheckboxContainer>
        </div>
        <CloseButton onClick={handleClose}>✕</CloseButton>
      </WarningContainer>
    </WarningOverlay>
  );
};

export default TranslationWarning;
