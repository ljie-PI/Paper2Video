import { Composition } from 'remotion';
import { SlidesVideo } from './SlidesVideo';
import type { SlidesJSON } from '@/lib/types';

const defaultSlides: SlidesJSON = {
  slides: [
    {
      title: 'Paper2Video Overview',
      text_contents:
        '- Docling parses PDF\n- LLM builds slide JSON\n- Remotion renders MP4',
      images: [],
      tables: [],
      transcript: 'Introduce the pipeline and outputs.'
    },
    {
      title: 'Key Contributions',
      text_contents:
        '- Structured Markdown extraction\n- Slide-ready summarization\n- Dual output: PPTX + MP4',
      images: [],
      tables: [],
      transcript: 'Focus on the differentiators.'
    }
  ]
};

const totalFrames = (slides: SlidesJSON, fps: number) =>
  slides.slides.reduce((sum) => sum + Math.round(16 * fps), 0);

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
