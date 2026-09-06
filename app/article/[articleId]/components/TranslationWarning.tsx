"use client";

import React from "react";

import "./translation-warning.css";

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
    <div
      className={`fixed inset-0 bg-black/70 flex justify-center items-center z-[1000] [transition:opacity_0.3s_ease,visibility_0.3s_ease] [-webkit-overflow-scrolling:touch] touch-none ${
        isVisible ? "opacity-100 visible" : "opacity-0 invisible"
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-[#ef4444] text-white py-8 px-10 rounded-2xl shadow-[6px_6px_0_rgba(5,5,5,0.9)] flex items-center gap-[1.2rem] max-w-[90%] w-[500px] relative [transform:scale(1)] [transition:transform_0.3s_ease] border-2 border-[#050505] max-[768px]:py-6 max-[768px]:px-8 max-[768px]:w-[85%] max-[768px]:text-[0.9rem] max-[768px]:gap-4 max-[480px]:py-[1.2rem] max-[480px]:px-6 max-[480px]:w-[90%] max-[480px]:gap-[0.8rem] max-[480px]:text-[0.85rem] ${
          isExiting
            ? "animate-[article-warning-slide-out_0.3s_ease]"
            : "animate-[article-warning-slide-in_0.3s_ease]"
        }`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="text-[2rem] flex items-center justify-center max-[768px]:text-[1.7rem] max-[480px]:text-[1.5rem]">
          ⚠️
        </div>
        <div style={{ flex: 1 }}>
          <div className="font-medium leading-[1.5] flex-1 text-[1.1rem] max-[768px]:text-[1rem] max-[480px]:text-[0.9rem]">
            한국어에 너무 의존하면 영어 공부에 도움이 안됩니다
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/20">
            <input
              className="w-4 h-4 cursor-pointer accent-white max-[480px]:w-3.5 max-[480px]:h-3.5"
              type="checkbox"
              id="dontShowAgain"
              checked={dontShowAgain}
              onChange={handleCheckboxChange}
            />
            <label
              className="text-[0.9rem] font-normal cursor-pointer select-none max-[480px]:text-[0.8rem]"
              htmlFor="dontShowAgain"
            >
              다시 보지 않기
            </label>
          </div>
        </div>
        <button
          className="absolute top-4 right-4 bg-white/20 text-white border-none rounded-full w-8 h-8 flex items-center justify-center cursor-pointer text-[1rem] font-bold [transition:all_0.2s_ease] hover:bg-white/30 hover:scale-110 max-[768px]:top-[0.8rem] max-[768px]:right-[0.8rem] max-[768px]:w-7 max-[768px]:h-7 max-[768px]:text-[0.9rem] max-[480px]:top-[0.7rem] max-[480px]:right-[0.7rem] max-[480px]:w-6 max-[480px]:h-6 max-[480px]:text-[0.8rem]"
          onClick={handleClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default TranslationWarning;
