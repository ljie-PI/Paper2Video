import path from 'path';
import { convertPdfToMarkdown } from './docling';
import { generateSlides, writeSlidesJson } from './generating';
import { renderSlides } from './render-slides';
import { generateSlideNarrations } from './tts';
import { renderVideoFromSlides } from './video';
import { getJob, updateJob } from './job-store';

const isVideoEnabled = (enableVideo: boolean) => {
  if (!enableVideo) return false;
  const flag =
    process.env.VIDEO_RENDER_ENABLED ?? process.env.REMOTION_RENDER_ENABLED;
  if (!flag) return false;
  return flag.toLowerCase() !== 'false';
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
  const renderedSlides = await runStage('composing', async () => {
    return renderSlides(slides, jobId, job.config);
  });
  await updateJob(jobId, {
    paths: {
      rendered: renderedSlides.manifestPath,
      slidesPdf: renderedSlides.pdfPath
    }
  });

  let videoPath: string | undefined;
  if (isVideoEnabled(job.config.enableVideo)) {
    const ttsResult = await runStage('rendering', async () => {
      return generateSlideNarrations(slides, jobId, job.config);
    });

    videoPath = await runStage('rendering', async () => {
      return renderVideoFromSlides({
        jobId,
        slideImages: renderedSlides.images,
        slideAudios: ttsResult.audio.map((audio) => ({
          index: audio.index,
          path: audio.path
        })),
        transitionSeconds: 1
      });
    });
  }

  await updateJob(jobId, {
    status: 'completed',
    paths: {
      video: videoPath
    }
  });
};
