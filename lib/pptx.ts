import fs from 'fs/promises';
import path from 'path';
import PptxGenJS from 'pptxgenjs';
import type { SlidesJSON } from './types';
import { outputsDir, toRelativePath } from './storage';

export const generatePptx = async (slides: SlidesJSON, jobId: string) => {
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, 'slides.pptx');

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Paper2Video';
  pptx.company = 'Paper2Video';
  pptx.subject = slides.title;
  pptx.title = slides.title;

  slides.slides.forEach((slideData) => {
    const slide = pptx.addSlide();
    slide.addText(slideData.title, {
      x: 0.6,
      y: 0.4,
      w: 12.2,
      h: 0.6,
      fontSize: 32,
      color: '0A0B10',
      bold: true
    });

    const bulletText = slideData.bullets.map((item) => `• ${item}`).join('\n');
    slide.addText(bulletText, {
      x: 0.9,
      y: 1.4,
      w: 11.6,
      h: 4.5,
      fontSize: 20,
      color: '2A2F40',
      valign: 'top'
    });

    if (slideData.visualPrompt) {
      slide.addText(`Visual: ${slideData.visualPrompt}`, {
        x: 0.9,
        y: 5.8,
        w: 11.6,
        h: 0.8,
        fontSize: 12,
        color: '6B7280'
      });
    }
  });

  await pptx.writeFile({ fileName: filePath });

  return toRelativePath(filePath);
};
