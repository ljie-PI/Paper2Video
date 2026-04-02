import { tool } from 'ai';
import { z } from 'zod';
import { renderSegment, durationToFrames } from '@/lib/remotion-render';
import { logger } from '@/lib/logger';

const COMPOSITION_MAP: Record<string, string> = {
  title: 'TitleScene',
  narration: 'NarrationScene',
  image: 'ImageScene',
  'side-by-side': 'SideBySideScene',
  table: 'TableScene',
};

export const generateVideoSegment = tool({
  description: 'Render a single video segment using Remotion templates. Call after TTS audio is ready for the segment.',
  parameters: z.object({
    segmentId: z.string().describe('The segment ID to render'),
    sessionId: z.string().describe('Current session ID'),
    template: z.enum(['title', 'narration', 'image', 'side-by-side', 'table']).describe('Remotion template to use'),
    props: z.record(z.string(), z.unknown()).describe('Template props (title, content, imageUrl, audioPath, etc.)'),
    durationInFrames: z.number().optional().describe('Duration in frames (30fps). Defaults based on audio length.'),
    audioDurationSeconds: z.number().optional().describe('Audio duration in seconds, used to calculate frames if durationInFrames not set.'),
  }),
  execute: async ({ segmentId, sessionId, template, props, durationInFrames, audioDurationSeconds }) => {
    try {
      const compositionId = COMPOSITION_MAP[template];
      if (!compositionId) {
        return { success: false, error: `Unknown template: ${template}`, segmentId };
      }

      const frames = durationInFrames ?? (audioDurationSeconds ? durationToFrames(audioDurationSeconds) : 300);
      logger.info(`[generate-video-segment] Rendering ${segmentId} (${compositionId}, ${frames} frames)`);

      const videoPath = await renderSegment({
        sessionId,
        segmentId,
        compositionId,
        props,
        durationInFrames: frames,
      });

      return {
        success: true,
        videoPath,
        segmentId,
        template,
        durationInFrames: frames,
        message: `Video segment ${segmentId} rendered (template: ${template}).`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[generate-video-segment] Failed: ${message}`);
      return { success: false, error: message, segmentId };
    }
  },
});
