import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { SlidesJSON } from '@/lib/types';

export const SlidesVideo = ({ slides }: { slides: SlidesJSON }) => {
  const { fps } = useVideoConfig();
  let cursor = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a', color: '#f8fafc' }}>
      {slides.slides.map((slide) => {
        const duration = Math.round((slide.durationSec ?? 16) * fps);
        const start = cursor;
        cursor += duration;

        return (
          <Sequence key={slide.id} from={start} durationInFrames={duration}>
            <AbsoluteFill
              style={{
                padding: '140px 160px',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 600,
                  marginBottom: 32,
                  lineHeight: 1.1
                }}
              >
                {slide.title}
              </div>
              <div style={{ fontSize: 30, color: '#cbd5f5', lineHeight: 1.5 }}>
                {slide.bullets.map((bullet) => (
                  <div key={bullet} style={{ marginBottom: 16 }}>
                    • {bullet}
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 32,
                  fontSize: 18,
                  color: '#6ee7ff'
                }}
              >
                {slide.visualPrompt}
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
