import { tool } from 'ai';
import { z } from 'zod';

const segmentSchema = z.object({
  id: z.string().describe('Unique segment ID, e.g. seg-001'),
  type: z.enum(['title', 'narration', 'image', 'side-by-side', 'table']),
  title: z.string().optional().describe('Scene title'),
  content: z.string().optional().describe('Text content for narration scenes'),
  imageUrl: z.string().optional().describe('Relative path to image file'),
  tableData: z.array(z.array(z.string())).optional().describe('Table rows'),
  narration: z.string().describe('Narration text for TTS'),
  durationSeconds: z.number().optional().describe('Estimated duration'),
});

export const videoPlanner = tool({
  description: 'Create or update the video production plan. Call after parsing the PDF to structure the video, and again after segments are completed to update status.',
  parameters: z.object({
    segments: z.array(segmentSchema).describe('Ordered list of video segments'),
  }),
  execute: async ({ segments }) => {
    const plan = {
      segments: segments.map((s) => ({
        ...s,
        status: 'planned' as const,
      })),
      totalDuration: segments.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0),
    };
    return {
      success: true,
      plan,
      message: `Video plan created with ${segments.length} segments (~${plan.totalDuration}s total).`,
    };
  },
});
