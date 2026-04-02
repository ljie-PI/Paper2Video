// @ts-nocheck
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Audio, staticFile } from 'remotion';

type Props = {
  title: string;
  content: string;
  audioUrl?: string;
};

export const NarrationScene: React.FC<Props> = ({ title, content, audioUrl }) => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const contentOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [20, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #0a0b10 0%, #111225 100%)',
        padding: 80,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {audioUrl && <Audio src={staticFile(audioUrl)} />}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 48,
          fontWeight: 700,
          color: '#2cb4ff',
          marginBottom: 40,
        }}
      >
        {title}
      </div>
      <div
        style={{
          opacity: contentOpacity,
          fontSize: 28,
          color: '#e0e0e8',
          lineHeight: 1.8,
          maxWidth: 1600,
        }}
      >
        {content}
      </div>
    </AbsoluteFill>
  );
};
