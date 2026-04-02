import { tool } from 'ai';
import { z } from 'zod';
import { mergeSegments } from '@/lib/remotion-render';
import { logger } from '@/lib/logger';

export const mergeVideoSegments = tool({
  description: 'Merge all rendered video segments into the final video. Call this last, after all segments have been rendered.',
  parameters: z.object({
    sessionId: z.string().describe('Current session ID'),
    segmentPaths: z.array(z.string()).describe('Ordered list of segment video file paths'),
    outputFileName: z.string().optional().describe('Output file name. Defaults to final.mp4'),
  }),
  execute: async ({ sessionId, segmentPaths, outputFileName }) => {
    try {
      logger.info(`[merge-video-segments] Merging ${segmentPaths.length} segments for session ${sessionId}`);

      const outputPath = await mergeSegments(sessionId, segmentPaths, outputFileName);

      return {
        success: true,
        videoPath: outputPath,
        segmentCount: segmentPaths.length,
        message: `Final video merged from ${segmentPaths.length} segments.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[merge-video-segments] Failed: ${message}`);
      return { success: false, error: message };
    }
  },
});
