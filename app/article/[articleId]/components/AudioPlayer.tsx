import React from "react";
import styled from "styled-components";

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

const Container = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 1rem;
  border-top: 2px solid #050505;
  box-shadow: 0 -4px 0 rgba(5, 5, 5, 0.9);
  transform: translateY(${props => props.$isVisible ? '0' : '100%'});
  transition: transform 0.3s ease;
  z-index: 100;
`;

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
    <Container $isVisible={isVisible}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '960px', margin: '0 auto' }}>
        <button onClick={onTogglePlayPause}>{isPlaying ? 'Pause' : 'Play'}</button>
        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
    </Container>
  );
}
