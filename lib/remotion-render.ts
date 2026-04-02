import path from 'path';
import fs from 'fs/promises';
import { logger } from './logger';
import { sessionDir } from './session-store';

const FPS = 30;

type RenderSegmentInput = {
  sessionId: string;
  segmentId: string;
  compositionId: string;
  props: Record<string, unknown>;
  durationInFrames: number;
};

const ensureDir = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

/**
 * Render a single video segment using Remotion CLI.
 * Falls back to a placeholder if Remotion is not available.
 */
export const renderSegment = async (input: RenderSegmentInput): Promise<string> => {
  const outputDir = path.join(sessionDir(input.sessionId), 'segments');
  await ensureDir(outputDir);
  const outputPath = path.join(outputDir, `${input.segmentId}.mp4`);

  const entryPoint = path.join(process.cwd(), 'remotion', 'index.ts');

  try {
    const { bundle } = await import('@remotion/bundler' as string);
    const { renderMedia, selectComposition } = await import('@remotion/renderer');

    logger.info(`[remotion] Bundling for segment ${input.segmentId}...`);
    const bundled = await bundle({ entryPoint, webpackOverride: (config: unknown) => config });

    const composition = await selectComposition({
      serveUrl: bundled,
      id: input.compositionId,
      inputProps: input.props,
    });

    logger.info(`[remotion] Rendering ${input.compositionId} (${input.durationInFrames} frames)...`);
    await renderMedia({
      composition: {
        ...composition,
        durationInFrames: input.durationInFrames,
      },
      serveUrl: bundled,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: input.props,
    });

    logger.info(`[remotion] Segment ${input.segmentId} rendered: ${outputPath}`);
    return outputPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[remotion] Rendering failed, creating placeholder: ${message}`);

    // Create a placeholder file so the pipeline can continue
    await fs.writeFile(outputPath, `[placeholder] ${input.compositionId}: ${JSON.stringify(input.props)}`);
    return outputPath;
  }
};

/**
 * Calculate frame count from audio duration.
 */
export const durationToFrames = (seconds: number, minFrames = 90): number => {
  return Math.max(minFrames, Math.ceil(seconds * FPS));
};

/**
 * Merge multiple video segments into a final video using FFmpeg concat.
 */
export const mergeSegments = async (
  sessionId: string,
  segmentPaths: string[],
  outputFileName = 'final.mp4'
): Promise<string> => {
  const sDir = sessionDir(sessionId);
  const outputPath = path.join(sDir, outputFileName);
  const concatListPath = path.join(sDir, 'concat-list.txt');

  const concatContent = segmentPaths
    .map((p) => `file '${path.resolve(p)}'`)
    .join('\n');

  await fs.writeFile(concatListPath, concatContent, 'utf8');

  try {
    const { execSync } = await import('child_process');
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`,
      { stdio: 'pipe', timeout: 300000 }
    );
    logger.info(`[remotion] Final video merged: ${outputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[remotion] FFmpeg merge failed: ${message}. Creating placeholder.`);
    await fs.writeFile(outputPath, `[placeholder] merged from ${segmentPaths.length} segments`);
  }

  // Clean up concat list
  try { await fs.rm(concatListPath); } catch { /* ignore */ }

  return outputPath;
};
