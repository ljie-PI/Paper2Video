import fs from 'fs/promises';
import path from 'path';
import { convertPdfToMarkdown } from './docling';
import { generateSlides, writeSlidesJson } from './generating';
import { generatePptx } from './pptx';
import { generateSrt } from './srt';
import { getJob, updateJob } from './job-store';
import { outputsDir, toRelativePath } from './storage';

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
      const current = await getJob(jobId);
      if (current?.status === 'failed') return;
      await updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStage: current?.status ?? null
      });
    });
  }, 50);
};

const runPipeline = async (jobId: string) => {
  const job = await getJob(jobId);
  if (!job) return;

  const failStage = async (stage: string, error: unknown) => {
    await updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStage: stage
    });
  };

  const runStage = async <T>(stage: string, task: () => Promise<T>) => {
    try {
      return await task();
    } catch (error) {
      await failStage(stage, error);
      throw error;
    }
  };

  await updateJob(jobId, { status: 'parsing', error: null, errorStage: null });

  if (!job.paths.pdf) {
    throw new Error('Missing source PDF path.');
  }

  const pdfPath = path.join(process.cwd(), job.paths.pdf);
  const { markdown, docPath } = await runStage('parsing', async () => {
    return convertPdfToMarkdown(pdfPath, jobId);
  });
  await updateJob(jobId, {
    markdown_content: markdown,
    paths: { doc: docPath }
  });

  await updateJob(jobId, { status: 'generating' });
  const slides = await runStage('generating', async () => {
    return generateSlides(markdown, job.config);
  });
  const slidesPath = await runStage('generating', async () => {
    return writeSlidesJson(jobId, slides);
  });
  await updateJob(jobId, {
    slides_json: slides,
    paths: { slides: slidesPath }
  });

  await updateJob(jobId, { status: 'rendering' });
  const pptxPath = await runStage('composing', async () => {
    return generatePptx(slides, jobId);
  });
  await updateJob(jobId, {
    paths: { pptx: pptxPath }
  });

  const srtPath = await runStage('rendering', async () => {
    return generateSrt(slides, jobId);
  });
  const videoPath = await runStage('rendering', async () => {
    return ensurePlaceholderVideo(jobId);
  });

  await updateJob(jobId, {
    status: 'completed',
    paths: {
      srt: srtPath,
      video: videoPath
    }
  });
};
