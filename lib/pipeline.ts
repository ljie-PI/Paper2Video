import fs from 'fs/promises';
import path from 'path';
import { convertPdfToMarkdown } from './docling';
import { generateSlides, writeSlidesJson } from './generating';
import { renderSlides } from './render-slides';
import { generateSlideNarrations } from './tts';
import { renderVideoFromSlides } from './video';
import { getJob, updateJob } from './job-store';
import { outputsDir } from './storage';
import type { SlidesJSON } from './types';

const isVideoEnabled = (enableVideo: boolean) => enableVideo;

const toAbsolutePath = (filePath: string) =>
  path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

const fileExists = async (filePath?: string | null) => {
  if (!filePath) return false;
  try {
    await fs.access(toAbsolutePath(filePath));
    return true;
  } catch {
    return false;
  }
};

const resolveExistingPath = async (
  jobId: string,
  currentPath: string | undefined,
  fallbackRelative: string
) => {
  if (await fileExists(currentPath)) return currentPath ?? null;
  const fallback = path.join(outputsDir(jobId), fallbackRelative);
  if (await fileExists(fallback)) {
    return fallback.replace(process.cwd() + path.sep, '');
  }
  return null;
};

const loadMarkdownFromJob = async (
  jobId: string,
  job: {
  markdown_content?: string;
  paths?: { doc?: string };
}) => {
  if (job.markdown_content) {
    return {
      markdown: job.markdown_content,
      docPath: job.paths?.doc ?? null
    };
  }
  const docPath =
    job.paths?.doc ?? (await resolveExistingPath(jobId, undefined, 'paper.md'));
  if (docPath && (await fileExists(docPath))) {
    const raw = await fs.readFile(toAbsolutePath(docPath), 'utf8');
    return { markdown: raw, docPath };
  }
  return null;
};

const loadSlidesFromJob = async (
  jobId: string,
  job: {
  slides_json?: SlidesJSON;
  paths?: { slides?: string };
}) => {
  if (job.slides_json) {
    return { slides: job.slides_json, slidesPath: job.paths?.slides ?? null };
  }
  const slidesPath =
    job.paths?.slides ?? (await resolveExistingPath(jobId, undefined, 'slides.json'));
  if (slidesPath && (await fileExists(slidesPath))) {
    const raw = await fs.readFile(toAbsolutePath(slidesPath), 'utf8');
    return { slides: JSON.parse(raw) as SlidesJSON, slidesPath };
  }
  return null;
};

const loadSlideImages = async (jobId: string, slideCount: number) => {
  const imagesDir = path.join(outputsDir(jobId), 'slides-images');
  let entries: string[];
  try {
    entries = await fs.readdir(imagesDir);
  } catch {
    return null;
  }

  const images = entries
    .map((entry) => {
      const match = entry.match(/^slide-(\d+)\.png$/i);
      if (!match) return null;
      const index = Number.parseInt(match[1], 10);
      if (!Number.isFinite(index)) return null;
      return {
        index,
        path: path
          .join(imagesDir, entry)
          .replace(process.cwd() + path.sep, '')
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0)) as Array<{
      index: number;
      path: string;
    }>;

  if (images.length < slideCount) return null;
  return images.slice(0, slideCount).map((image) => image.path);
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

  const pdfPath = toAbsolutePath(job.paths.pdf);
  const markdownResult = await runStage('parsing', async () => {
    const existing = await loadMarkdownFromJob(jobId, job);
    if (existing) return existing;
    return convertPdfToMarkdown(pdfPath, jobId);
  });
  if (
    !job.markdown_content ||
    (markdownResult.docPath && job.paths.doc !== markdownResult.docPath)
  ) {
    await updateJob(jobId, {
      markdown_content: markdownResult.markdown,
      paths: markdownResult.docPath ? { doc: markdownResult.docPath } : {}
    });
  }

  await updateJob(jobId, { status: 'generating' });
  const existingSlides = await loadSlidesFromJob(jobId, job);
  let slides = existingSlides?.slides ?? null;
  let slidesPath = existingSlides?.slidesPath ?? null;
  if (!slides) {
    slides = await runStage('generating', async () => {
      return generateSlides(markdownResult.markdown, job.config);
    });
  }
  if (!slides) {
    throw new Error('Slides are missing after generation.');
  }
  const resolvedSlidesPath = await resolveExistingPath(jobId, slidesPath ?? undefined, 'slides.json');
  if (!resolvedSlidesPath) {
    slidesPath = await runStage('generating', async () => {
      return writeSlidesJson(jobId, slides);
    });
  } else {
    slidesPath = resolvedSlidesPath;
  }
  if (!job.slides_json || slidesPath !== job.paths.slides) {
    await updateJob(jobId, {
      slides_json: slides,
      paths: { slides: slidesPath ?? undefined }
    });
  }

  await updateJob(jobId, { status: 'composing' });
  const expectedSlidesCount = slides.slides.length;
  const existingRenderedPath = await resolveExistingPath(
    jobId,
    job.paths.rendered,
    path.join('rendered-slides', 'rendered-slides.json')
  );
  const existingPdfPath = await resolveExistingPath(
    jobId,
    job.paths.slidesPdf,
    'slides.pdf'
  );
  const existingImages = await loadSlideImages(jobId, expectedSlidesCount);

  const renderedSlides = await runStage('composing', async () => {
    if (existingRenderedPath && existingPdfPath && existingImages) {
      return {
        manifestPath: existingRenderedPath,
        pdfPath: existingPdfPath,
        images: existingImages
      };
    }
    return renderSlides(slides, jobId, job.config);
  });
  if (
    renderedSlides.manifestPath !== job.paths.rendered ||
    renderedSlides.pdfPath !== job.paths.slidesPdf
  ) {
    await updateJob(jobId, {
      paths: {
        rendered: renderedSlides.manifestPath,
        slidesPdf: renderedSlides.pdfPath
      }
    });
  }

  let videoPath = await resolveExistingPath(jobId, job.paths.video, 'video.mp4');
  if (isVideoEnabled(job.config.enableVideo) && !videoPath) {
    await updateJob(jobId, { status: 'rendering' });
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
      video: videoPath ?? undefined
    }
  });
};
