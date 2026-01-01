import fs from 'fs/promises';
import path from 'path';
import type { JobConfig, SlideImage, SlidesJSON } from './types';
import { getPrompt, renderTemplate } from './prompts';
import { logger } from './logger';
import { requestLlmText } from './llm';
import { outputsDir, toRelativePath } from './storage';

const extractJson = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
};

const normalizeImages = (images: unknown): SlideImage[] => {
  if (!Array.isArray(images)) return [];
  return images
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as {
        path?: unknown;
        width?: unknown;
        height?: unknown;
      };
      if (typeof raw.path !== 'string') return null;
      if (typeof raw.width !== 'number' || typeof raw.height !== 'number') {
        return null;
      }
      return {
        path: raw.path,
        width: raw.width,
        height: raw.height
      };
    })
    .filter(Boolean) as SlideImage[];
};

const normalizeSlides = (payload: unknown): SlidesJSON | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { slides?: unknown };
  if (!Array.isArray(data.slides)) return null;

  const slides = data.slides
    .map((slide) => {
      if (!slide || typeof slide !== 'object') return null;
      const raw = slide as {
        title?: unknown;
        text_contents?: unknown;
        images?: unknown;
        tables?: unknown;
        transcript?: unknown;
      };

      const title = typeof raw.title === 'string' ? raw.title.trim() : '';
      if (!title) return null;

      const textContents =
        typeof raw.text_contents === 'string' ? raw.text_contents.trim() : '';
      if (!textContents) return null;

      const transcript =
        typeof raw.transcript === 'string' ? raw.transcript.trim() : '';
      if (!transcript) return null;

      const tables = Array.isArray(raw.tables)
        ? raw.tables
            .filter((item) => typeof item === 'string' && item.trim())
            .map((item) => (item as string).trim())
        : [];

      return {
        title,
        text_contents: textContents,
        images: normalizeImages(raw.images),
        tables,
        transcript
      };
    })
    .filter(Boolean) as SlidesJSON['slides'];

  if (!slides.length) return null;

  return { slides };
};

const requestSlidesFromLlm = async (
  markdown: string,
  config: JobConfig
): Promise<SlidesJSON | null> => {
  const promptTemplate = getPrompt('generating.md');
  if (!promptTemplate) {
    logger.warn('[generating] missing prompt generating.md, fallback used');
    return null;
  }

  try {
    const languageHints = { zh: 'Chinese.', en: 'English.' } as const;
    const languageHint = config.outputLanguage
      ? languageHints[config.outputLanguage]
      : '';
    const systemPrompt = renderTemplate(promptTemplate, { languageHint });

    logger.debug(`[generating] requesting LLM with userPrompt ${markdown.slice(0, 1024)}...`);
    const responseText = await requestLlmText({
      model: config.model?.trim() ?? null,
      systemPrompt,
      userPrompt: markdown
    });
    logger.debug('[generating] LLM response:', responseText);

    if (!responseText) return null;

    const json = extractJson(responseText);
    const parsed = JSON.parse(json) as unknown;
    return normalizeSlides(parsed);
  } catch (error) {
    logger.warn('[generating] LLM summary failed, fallback used', error);
    return null;
  }
};

export const generateSlides = async (
  markdown: string,
  config: JobConfig
): Promise<SlidesJSON> => {
  const start = Date.now();
  try {
    const llmSlides = await requestSlidesFromLlm(markdown, config);
    if (llmSlides) {
      return llmSlides;
    }

    throw new Error('Failed to generate slides from LLM response.');
  } finally {
    logger.debug(`[generating] generateSlides took ${Date.now() - start}ms`);
  }
};

export const writeSlidesJson = async (jobId: string, slides: SlidesJSON) => {
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, 'slides.json');
  await fs.writeFile(filePath, JSON.stringify(slides, null, 2));
  logger.debug('[generating] slides.json written to', filePath);
  return toRelativePath(filePath);
};
