import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Img, Audio, staticFile } from 'remotion';

type Props = {
  title: string;
  imageUrl: string;
  caption?: string;
  audioUrl?: string;
};

export const ImageScene: React.FC<Props> = ({ title, imageUrl, caption, audioUrl }) => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const imageScale = interpolate(frame, [10, 40], [0.95, 1], { extrapolateRight: 'clamp' });
  const imageOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });
  const captionOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: '#0a0b10',
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {audioUrl && <Audio src={staticFile(audioUrl)} />}
      <div
        style={{
          opacity: titleOpacity,
          fontSize: 40,
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: 30,
        }}
      >
        {title}
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: imageOpacity,
          transform: `scale(${imageScale})`,
        }}
      >
        {imageUrl && (
          <Img
            src={staticFile(imageUrl)}
            style={{ maxWidth: '100%', maxHeight: 700, objectFit: 'contain' }}
          />
        )}
      </div>
      {caption && (
        <div
          style={{
            opacity: captionOpacity,
            fontSize: 22,
            color: '#a0a0b0',
            textAlign: 'center',
            marginTop: 20,
          }}
        >
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
};
