import fs from 'fs/promises';
import path from 'path';
import type { SlidesJSON } from './types';
import { outputsDir, toRelativePath } from './storage';

const formatTimestamp = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const pad = (value: number, size: number) => value.toString().padStart(size, '0');
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
};

export const generateSrt = async (slides: SlidesJSON, jobId: string) => {
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, 'captions.srt');

  let cursor = 0;
  const lines: string[] = [];

  slides.slides.forEach((slide, index) => {
    const duration = slide.durationSec ?? 16;
    const start = formatTimestamp(cursor);
    const end = formatTimestamp(cursor + duration);

    lines.push(String(index + 1));
    lines.push(`${start} --> ${end}`);
    lines.push(`${slide.title} — ${slide.bullets.join('; ')}`);
    lines.push('');

    cursor += duration;
  });

  await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  return toRelativePath(filePath);
};
