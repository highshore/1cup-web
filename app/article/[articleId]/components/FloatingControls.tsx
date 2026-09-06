import React from "react";

interface FloatingControlsProps {
  isAudioMode: boolean;
  hasAudio: boolean;
  onToggleAudioMode: () => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export default function FloatingControls({
  hasAudio,
  onToggleAudioMode,
  isVisible
}: FloatingControlsProps) {
  if (!hasAudio) return null;

  return (
    <div
      className={`fixed bottom-20 right-5 flex flex-col gap-2 [transition:opacity_0.3s_ease] z-[99] ${
        isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <button
        className="w-12 h-12 rounded-full bg-[#f47a4a] border-2 border-[#050505] shadow-[3px_3px_0_rgba(5,5,5,0.9)] flex items-center justify-center cursor-pointer [transition:transform_0.16s_ease,box-shadow_0.16s_ease] hover:[transform:translate(-1px,-1px)] hover:shadow-[4px_4px_0_rgba(5,5,5,0.9)]"
        onClick={onToggleAudioMode}
      >
        🎧
      </button>
    </div>
  );
}
