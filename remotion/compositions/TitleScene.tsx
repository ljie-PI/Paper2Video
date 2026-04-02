// @ts-nocheck
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

type Props = {
  title: string;
  authors: string;
  subtitle?: string;
};

export const TitleScene: React.FC<Props> = ({ title, authors, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = spring({ frame, fps, config: { damping: 20 } });
  const authorOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [35, 55], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 30], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #0a0b10 0%, #1a1b2e 50%, #0a0b10 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 64,
          fontWeight: 700,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: 1400,
        }}
      >
        {title}
      </div>
      <div
        style={{
          opacity: authorOpacity,
          fontSize: 32,
          color: '#2cb4ff',
          marginTop: 40,
          textAlign: 'center',
        }}
      >
        {authors}
      </div>
      {subtitle && (
        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 24,
            color: '#a0a0b0',
            marginTop: 20,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
