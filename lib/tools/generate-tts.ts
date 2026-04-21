import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { synthesizeTtsText } from '@/lib/tts';
import { sessionDir } from '@/lib/session-store';
import { toRelativePath } from '@/lib/storage';
import { logger } from '@/lib/logger';

export const generateTts = tool({
  description: 'Generate narration audio from text using TTS. Returns the audio file path and format.',
  parameters: z.object({
    text: z.string().describe('The narration text to synthesize'),
    segmentId: z.string().describe('The segment ID this audio belongs to'),
    sessionId: z.string().describe('Current session ID'),
    voice: z.string().optional().describe('Voice ID to use'),
    language: z.enum(['zh', 'en']).optional().describe('Language for TTS'),
  }),
  execute: async ({ text, segmentId, sessionId, voice, language }) => {
    try {
      logger.info(`[generate-tts] Generating TTS for segment ${segmentId}`);
      const languageType = language === 'en' ? 'English' : 'Chinese';
      const result = await synthesizeTtsText({ text, voice, languageType });

      const ttsDir = path.join(sessionDir(sessionId), 'tts');
      await fs.mkdir(ttsDir, { recursive: true });
      const fileName = `${segmentId}.${result.audio.extension}`;
      const filePath = path.join(ttsDir, fileName);
      await fs.writeFile(filePath, result.audio.buffer);

      const relativePath = toRelativePath(filePath);
      logger.info(`[generate-tts] Audio saved: ${relativePath}`);
      return {
        success: true,
        audioPath: relativePath,
        format: result.audio.extension,
        segmentId,
        message: `TTS audio generated for segment ${segmentId}.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[generate-tts] Failed: ${message}`);
      return { success: false, error: message, segmentId };
    }
  },
});
