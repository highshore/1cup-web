import React from "react";
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAIChat: () => void;
  onFinish: () => void;
}

const optionButtonBase = [
  "flex items-center justify-center py-6 px-8 text-[1.1rem] font-semibold rounded-2xl border-2 border-solid cursor-pointer",
  "[transition:all_0.3s_cubic-bezier(0.4,0,0.2,1)] relative overflow-hidden",
  "[&_svg]:w-[1.2rem] [&_svg]:h-[1.2rem] [&_svg]:shrink-0",
  "[&_span]:inline-flex [&_span]:items-center [&_span]:justify-center [&_span]:gap-2 [&_span]:relative [&_span]:z-[1]",
  "active:[transform:translateY(0)]",
].join(" ");

const optionButtonVariants = {
  primary: [
    "bg-[linear-gradient(135deg,#3c2e26,#2c1810)] text-white border-[#3c2e26]",
    "before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-full",
    "before:bg-[linear-gradient(135deg,#5d4037,#d4a574)] before:opacity-0 before:[transition:opacity_0.3s_ease]",
    "hover:[transform:translateY(-2px)] hover:shadow-[0_10px_15px_rgba(44,24,16,0.1),0_4px_6px_rgba(44,24,16,0.05)]",
    "hover:before:opacity-100",
  ].join(" "),
  secondary: [
    "bg-white text-ink border-[#d7c7b8]",
    "hover:bg-[#faf8f6] hover:border-[#3c2e26] hover:[transform:translateY(-2px)]",
    "hover:shadow-[0_4px_6px_rgba(44,24,16,0.07),0_2px_4px_rgba(44,24,16,0.06)]",
  ].join(" "),
};

function OptionButton({
  variant,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "primary" | "secondary";
}) {
  return (
    <button
      className={`${optionButtonBase} ${optionButtonVariants[variant]} ${className}`}
      {...rest}
    />
  );
}

const CompletionModal: React.FC<CompletionModalProps> = ({
  isOpen,
  onClose,
  onAIChat,
  onFinish,
}) => {
  return (
    <div
      data-open={isOpen}
      onClick={onClose}
      className={`fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.7)] flex justify-center items-center z-[1000] [transition:opacity_0.3s_ease,visibility_0.3s_ease] ${
        isOpen ? "opacity-100 visible" : "opacity-0 invisible"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-[linear-gradient(135deg,#ffffff_0%,#faf8f6_100%)] rounded-[20px] p-10 max-w-[500px] w-[90%] max-h-[80vh] overflow-y-auto shadow-[0_20px_25px_rgba(44,24,16,0.1),0_10px_10px_rgba(44,24,16,0.04)] border border-solid border-line relative [transition:transform_0.3s_ease] ${
          isOpen ? "[transform:scale(1)]" : "[transform:scale(0.9)]"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-transparent border-none text-[1.5rem] text-[#8d6e63] cursor-pointer [transition:color_0.2s_ease] hover:text-ink"
        >
          ✕
        </button>

        <div className="text-center mb-8 pb-6 border-b-2 border-solid border-line">
          <h2 className="text-[1.8rem] font-bold bg-[linear-gradient(135deg,#3c2e26,#d4a574)] bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] mb-2">
            🎉 학습 완료!
          </h2>
          <p className="text-[1.1rem] text-[#3c2e26] m-0 leading-[1.6]">
            오늘 쉐도잉 학습을 완료하셨습니다.
            <br />
            다음 중 어떻게 마무리하고 싶으세요?
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-8">
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
        </div>
      </div>
    </div>
  );
};

export default CompletionModal;
