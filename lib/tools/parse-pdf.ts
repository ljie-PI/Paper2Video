import { tool } from 'ai';
import { z } from 'zod';
import { convertPdfToMarkdown } from '@/lib/mineru';
import { logger } from '@/lib/logger';

export const parsePdf = tool({
  description: 'Parse the uploaded PDF file into markdown text and extract images. Always call this first before planning the video.',
  parameters: z.object({
    pdfPath: z.string().describe('Path to the uploaded PDF file'),
    sessionId: z.string().describe('Current session ID'),
  }),
  execute: async ({ pdfPath, sessionId }) => {
    try {
      logger.info(`[parse-pdf] Parsing PDF: ${pdfPath} for session ${sessionId}`);
      const result = await convertPdfToMarkdown(pdfPath, sessionId);
      const imageCount = result.imageMapping?.size ?? 0;
      return {
        success: true,
        markdown: result.markdown,
        docPath: result.docPath,
        imageCount,
        message: `PDF parsed successfully. Extracted ${result.markdown.length} chars of text and ${imageCount} images.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[parse-pdf] Failed: ${message}`);
      return { success: false, error: message };
    }
  },
});
