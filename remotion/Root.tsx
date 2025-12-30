import { Composition } from 'remotion';
import { SlidesVideo } from './SlidesVideo';
import type { SlidesJSON } from '@/lib/types';

const defaultSlides: SlidesJSON = {
  title: 'Paper Summary',
  slides: [
    {
      id: 'intro',
      title: 'Paper2Video Overview',
      bullets: ['Docling parses PDF', 'Qwen builds slide JSON', 'Remotion renders MP4'],
      speakerNotes: 'Introduce the pipeline and outputs.',
      visualPrompt: 'Blueprint-style flow diagram from PDF to video.',
      durationSec: 14
    },
    {
      id: 'method',
      title: 'Key Contributions',
      bullets: ['Structured Markdown extraction', 'Slide-ready summarization', 'Dual output: PPTX + MP4'],
      speakerNotes: 'Focus on the differentiators.',
      visualPrompt: 'Split-screen PPTX and video timelines.',
      durationSec: 16
    }
  ]
};

const totalFrames = (slides: SlidesJSON, fps: number) =>
  slides.slides.reduce((sum, slide) => sum + Math.round((slide.durationSec ?? 16) * fps), 0);

export const RemotionRoot = () => {
  const fps = 30;
  return (
    <>
      <Composition
        id="SlidesVideo"
        component={SlidesVideo}
        durationInFrames={totalFrames(defaultSlides, fps)}
        fps={fps}
        width={1920}
        height={1080}
        defaultProps={{ slides: defaultSlides }}
      />
    </>
  );
};
