import fs from 'fs/promises';
import path from 'path';
import { convertPdfToMarkdown } from './docling';
import { summarizeToSlides } from './reasoning';
import { generatePptx } from './pptx';
import { generateSrt } from './srt';
import { getJob, updateJob } from './job-store';
import { outputsDir, toRelativePath } from './storage';

const writeSlidesJson = async (jobId: string, slides: unknown) => {
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, 'slides.json');
  await fs.writeFile(filePath, JSON.stringify(slides, null, 2));
  return toRelativePath(filePath);
};

const ensurePlaceholderVideo = async (jobId: string) => {
  if (!process.env.REMOTION_RENDER_ENABLED) return undefined;
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, 'final_video.mp4');
  await fs.writeFile(filePath, '');
  return toRelativePath(filePath);
};

export const startJobPipeline = (jobId: string) => {
  setTimeout(() => {
    runPipeline(jobId).catch(async (error) => {
      await updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });
  }, 50);
};

const runPipeline = async (jobId: string) => {
  const job = await getJob(jobId);
  if (!job) return;

  await updateJob(jobId, { status: 'parsing', error: null });

  if (!job.paths.pdf) {
    throw new Error('Missing source PDF path.');
  }

  const pdfPath = path.join(process.cwd(), job.paths.pdf);
  const { markdown, docPath } = await convertPdfToMarkdown(pdfPath, jobId);
  await updateJob(jobId, {
    markdown_content: markdown,
    paths: { doc: docPath }
  });

  await updateJob(jobId, { status: 'generating' });
  const slides = await summarizeToSlides(markdown, job.config);
  const slidesPath = await writeSlidesJson(jobId, slides);
  await updateJob(jobId, {
    slides_json: slides,
    paths: { slides: slidesPath }
  });

  await updateJob(jobId, { status: 'rendering' });
  const pptxPath = await generatePptx(slides, jobId);
  const srtPath = await generateSrt(slides, jobId);
  const videoPath = await ensurePlaceholderVideo(jobId);

  await updateJob(jobId, {
    status: 'completed',
    paths: {
      pptx: pptxPath,
      srt: srtPath,
      video: videoPath
    }
  });
};
