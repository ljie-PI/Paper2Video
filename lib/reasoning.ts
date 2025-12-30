import crypto from 'crypto';
import type { JobConfig, SlidesJSON } from './types';

const takeHeadings = (markdown: string) => {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'))
    .map((line) => line.replace(/^#+\s*/, ''))
    .filter(Boolean);
};

const splitIntoBullets = (markdown: string) => {
  const bullets = markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter(Boolean);
  return bullets.slice(0, 4);
};

export const summarizeToSlides = async (
  markdown: string,
  config: JobConfig
): Promise<SlidesJSON> => {
  if (process.env.QWEN_API_KEY) {
    // TODO: Integrate Vercel AI SDK + Qwen-Max using the schema from DESIGN.md.
    // Keeping a deterministic fallback for local dev without keys.
  }

  const headings = takeHeadings(markdown);
  const bullets = splitIntoBullets(markdown);

  const slides = (headings.length ? headings : ['Overview', 'Method', 'Results', 'Conclusion'])
    .slice(0, 6)
    .map((title, index) => ({
      id: crypto.randomUUID(),
      title,
      bullets: bullets.length ? bullets : ['Key insight one', 'Key insight two', 'Key insight three'],
      speakerNotes: `Narrate the key points for ${title.toLowerCase()} in 30-45 seconds.`,
      visualPrompt: `Minimalist illustration for ${title.toLowerCase()} in a scientific keynote style.`,
      durationSec: 14 + index * 2
    }));

  return {
    title: 'Paper Summary',
    slides
  };
};
