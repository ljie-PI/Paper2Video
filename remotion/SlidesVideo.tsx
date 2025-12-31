import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { SlidesJSON } from '@/lib/types';

const parseBullets = (markdown: string) => {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);
  return bullets.length ? bullets : lines;
};

export const SlidesVideo = ({ slides }: { slides: SlidesJSON }) => {
  const { fps } = useVideoConfig();
  let cursor = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a', color: '#f8fafc' }}>
      {slides.slides.map((slide, index) => {
        const duration = Math.round(16 * fps);
        const start = cursor;
        cursor += duration;
        const bullets = parseBullets(slide.text_contents);
        const imageLabel = slide.images?.[0]
          ? `Image: ${slide.images[0].path}`
          : 'No image selected';

        return (
          <Sequence key={`${slide.title}-${index}`} from={start} durationInFrames={duration}>
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
                {bullets.map((bullet) => (
                  <div key={`${slide.title}-${bullet}`} style={{ marginBottom: 16 }}>
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
                {imageLabel}
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
