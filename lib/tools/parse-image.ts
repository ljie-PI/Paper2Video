import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs/promises';
import { logger } from '@/lib/logger';

export const parseImage = tool({
  description: 'Analyze a paper figure or diagram using a vision model. Returns a text description of the image content. Use this for key figures to generate better narration.',
  parameters: z.object({
    imagePath: z.string().describe('Path to the image file'),
    context: z.string().optional().describe('Surrounding text or caption from the paper'),
  }),
  execute: async ({ imagePath, context }) => {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const base64 = imageBuffer.toString('base64');
      const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'png';
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

      const apiKey = process.env.VISION_API_KEY?.trim()
        || process.env.LLM_API_KEY?.trim()
        || process.env.OPENAI_API_KEY?.trim();

      if (!apiKey) {
        return {
          success: false,
          error: 'No vision API key configured. Set VISION_API_KEY, LLM_API_KEY, or OPENAI_API_KEY.',
        };
      }

      const baseUrl = process.env.VISION_BASE_URL?.trim()
        || process.env.LLM_BASE_URL?.trim()
        || process.env.OPENAI_BASE_URL?.trim()
        || 'https://api.openai.com/v1';

      const model = process.env.VISION_MODEL?.trim() || 'gpt-4o-mini';

      const systemPrompt = 'You are an expert at analyzing academic paper figures. Describe the figure in detail: what it shows, key data points, trends, and significance. Be concise but thorough.';
      const userContent = context
        ? `Analyze this figure from an academic paper. Context from the paper: "${context}"`
        : 'Analyze this figure from an academic paper.';

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userContent },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Vision API failed: ${response.status} ${text}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const description = data?.choices?.[0]?.message?.content;

      if (!description) {
        throw new Error('Vision API response missing content.');
      }

      logger.info(`[parse-image] Analyzed image: ${imagePath}`);
      return { success: true, description, imagePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[parse-image] Failed: ${message}`);
      return { success: false, error: message };
    }
  },
});
