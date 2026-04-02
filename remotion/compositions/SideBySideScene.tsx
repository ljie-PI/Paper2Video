// @ts-nocheck
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Img, Audio, staticFile } from 'remotion';

type Props = {
  title: string;
  imageUrl: string;
  content: string;
  audioUrl?: string;
};

export const SideBySideScene: React.FC<Props> = ({ title, imageUrl, content, audioUrl }) => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const leftX = interpolate(frame, [10, 35], [-40, 0], { extrapolateRight: 'clamp' });
  const leftOpacity = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp' });
  const rightX = interpolate(frame, [15, 40], [40, 0], { extrapolateRight: 'clamp' });
  const rightOpacity = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #0a0b10 0%, #111225 100%)',
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {audioUrl && <Audio src={staticFile(audioUrl)} />}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 40,
          fontWeight: 700,
          color: '#2cb4ff',
          marginBottom: 30,
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 40, alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
            opacity: leftOpacity,
            transform: `translateX(${leftX}px)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {imageUrl && (
            <Img
              src={staticFile(imageUrl)}
              style={{ maxWidth: '100%', maxHeight: 700, objectFit: 'contain' }}
            />
          )}
        </div>
        <div
          style={{
            flex: 1,
            opacity: rightOpacity,
            transform: `translateX(${rightX}px)`,
            fontSize: 26,
            color: '#e0e0e8',
            lineHeight: 1.8,
          }}
        >
          {content}
        </div>
      </div>
    </AbsoluteFill>
  );
};
