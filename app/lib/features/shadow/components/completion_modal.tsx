import React from "react";
import styled from "styled-components";
import { colors } from "../styles/shadow_styles";
import { ChatBubbleLeftRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAIChat: () => void;
  onFinish: () => void;
}

const ModalOverlay = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== "isOpen",
})<{ isOpen: boolean }>`
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
  opacity: ${(props) => (props.isOpen ? 1 : 0)};
  visibility: ${(props) => (props.isOpen ? "visible" : "hidden")};
  transition: opacity 0.3s ease, visibility 0.3s ease;
`;

const ModalContent = styled.div`
  background: linear-gradient(
    135deg,
    ${colors.surface} 0%,
    ${colors.background} 100%
  );
  border-radius: 20px;
  padding: 2.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: ${colors.shadow.xl};
  border: 1px solid ${colors.border.light};
  position: relative;
  transform: scale(0.9);
  transition: transform 0.3s ease;

  ${ModalOverlay}[data-open="true"] & {
    transform: scale(1);
  }
`;

const ModalHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid ${colors.border.light};
`;

const ModalTitle = styled.h2`
  font-size: 1.8rem;
  font-weight: 700;
  background: linear-gradient(135deg, ${colors.primary}, ${colors.accent});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.5rem;
`;

const ModalSubtitle = styled.p`
  font-size: 1.1rem;
  color: ${colors.text.secondary};
  margin: 0;
  line-height: 1.6;
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const OptionButton = styled.button<{ variant: "primary" | "secondary" }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 16px;
  border: 2px solid;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  svg {
    width: 1.2rem;
    height: 1.2rem;
    flex-shrink: 0;
  }

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  ${(props) =>
    props.variant === "primary"
      ? `
        background: linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark});
        color: ${colors.text.inverse};
        border-color: ${colors.primary};
        
        &::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, ${colors.primaryLight}, ${colors.accent});
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: ${colors.shadow.lg};
          
          &::before {
            opacity: 1;
          }
        }
      `
      : `
        background: ${colors.surface};
        color: ${colors.text.primary};
        border-color: ${colors.border.medium};
        
        &:hover {
          background: ${colors.background};
          border-color: ${colors.primary};
          transform: translateY(-2px);
          box-shadow: ${colors.shadow.md};
        }
      `}

  &:active {
    transform: translateY(0);
  }

  span {
    position: relative;
    z-index: 1;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: ${colors.text.muted};
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: ${colors.text.primary};
  }
`;

const CompletionModal: React.FC<CompletionModalProps> = ({
  isOpen,
  onClose,
  onAIChat,
  onFinish,
}) => {
  return (
    <ModalOverlay isOpen={isOpen} data-open={isOpen} onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose}>✕</CloseButton>

        <ModalHeader>
          <ModalTitle>🎉 학습 완료!</ModalTitle>
          <ModalSubtitle>
            오늘 쉐도잉 학습을 완료하셨습니다.
            <br />
            다음 중 어떻게 마무리하고 싶으세요?
          </ModalSubtitle>
        </ModalHeader>

        <OptionsContainer>
          <OptionButton variant="primary" onClick={onAIChat}>
            <span>
              <ChatBubbleLeftRightIcon />
              오늘 학습한 내용에 대해 AI와 이야기하기
            </span>
          </OptionButton>

          <OptionButton variant="secondary" onClick={onFinish}>
            <span>
              <CheckCircleIcon />
              그냥 끝내기
            </span>
          </OptionButton>
        </OptionsContainer>
      </ModalContent>
    </ModalOverlay>
  );
};

export default CompletionModal;
