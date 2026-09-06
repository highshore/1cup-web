import React from "react";

interface AudioPlayerProps {
  isVisible: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioProgress: number;
  playbackSpeed: number;
  onTogglePlayPause: () => void;
  onSeekAudio: (e: React.MouseEvent<HTMLDivElement>) => void;
  onChangePlaybackSpeed: () => void;
  formatTime: (time: number) => string;
}

export default function AudioPlayer({
  isVisible,
  isPlaying,
  currentTime,
  duration,
  formatTime,
  onTogglePlayPause
}: AudioPlayerProps) {
  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white p-4 border-t-2 border-[#050505] shadow-[0_-4px_0_rgba(5,5,5,0.9)] [transition:transform_0.3s_ease] z-[100] ${
        isVisible ? "[transform:translateY(0)]" : "[transform:translateY(100%)]"
      }`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '960px', margin: '0 auto' }}>
        <button onClick={onTogglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
    </div>
  );
}
