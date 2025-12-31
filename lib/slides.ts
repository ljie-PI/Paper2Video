import crypto from 'crypto';
import type { JobConfig, SlidesJSON } from './types';
import { getPrompt } from './prompts';
import { logger } from './logger';
import { requestLlmText } from './llm';

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

const normalizeSlides = (payload: unknown): SlidesJSON | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { title?: unknown; slides?: unknown };
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title || !Array.isArray(data.slides)) return null;

  const slides = data.slides
    .map((slide) => {
      if (!slide || typeof slide !== 'object') return null;
      const raw = slide as {
        id?: unknown;
        title?: unknown;
        bullets?: unknown;
        speakerNotes?: unknown;
        visualPrompt?: unknown;
        durationSec?: unknown;
      };

      const slideTitle =
        typeof raw.title === 'string' ? raw.title.trim() : '';
      if (!slideTitle) return null;

      const bullets = Array.isArray(raw.bullets)
        ? raw.bullets
            .filter((item) => typeof item === 'string' && item.trim())
            .map((item) => (item as string).trim())
        : [];
      const speakerNotes =
        typeof raw.speakerNotes === 'string' ? raw.speakerNotes.trim() : '';
      if (!speakerNotes) return null;

      return {
        id:
          typeof raw.id === 'string' && raw.id.trim()
            ? raw.id.trim()
            : crypto.randomUUID(),
        title: slideTitle,
        bullets,
        speakerNotes,
        visualPrompt:
          typeof raw.visualPrompt === 'string' && raw.visualPrompt.trim()
            ? raw.visualPrompt.trim()
            : undefined,
        durationSec:
          typeof raw.durationSec === 'number' ? raw.durationSec : undefined
      };
    })
    .filter(Boolean) as SlidesJSON['slides'];

  if (!slides.length) return null;

  return { title, slides };
};

const requestSlidesFromLlm = async (
  markdown: string,
  config: JobConfig
): Promise<SlidesJSON | null> => {
  const systemPrompt = getPrompt('slides-system.md');
  if (!systemPrompt) {
    logger.warn('[slides] missing prompt slides-system.md, fallback used');
    return null;
  }

  try {
    const languageHint =
      config.outputLanguage === 'zh'
        ? 'Output language: Chinese.'
        : config.outputLanguage === 'en'
          ? 'Output language: English.'
          : '';
    const effectiveSystemPrompt = languageHint
      ? `${systemPrompt}\n\n${languageHint}`
      : systemPrompt;

    const responseText = await requestLlmText({
      model: config.model?.trim() ?? null,
      systemPrompt: effectiveSystemPrompt,
      userPrompt: markdown
    });
    if (!responseText) return null;

    const json = extractJson(responseText);
    const parsed = JSON.parse(json) as unknown;
    return normalizeSlides(parsed);
  } catch (error) {
    logger.warn('[slides] LLM summary failed, fallback used', error);
    return null;
  }
};

const takeHeadings = (markdown: string) => {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'))
    .map((line) => line.replace(/^#+\s*/, ''))
    .filter(Boolean);
};

const splitIntoBullets = (markdown: string) => {
  const bullets = markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.replace(/^[-]\s*/, '').trim())
    .filter(Boolean);
  return bullets.slice(0, 4);
};

export const generateSlides = async (
  markdown: string,
  config: JobConfig
): Promise<SlidesJSON> => {
  const llmSlides = await requestSlidesFromLlm(markdown, config);
  if (llmSlides) {
    return llmSlides;
  }

  const headings = takeHeadings(markdown);
  const bullets = splitIntoBullets(markdown);
  const useChinese = config.outputLanguage === 'zh';

  const slides = (headings.length
    ? headings
    : useChinese
      ? ['概述', '方法', '结果', '结论']
      : ['Overview', 'Method', 'Results', 'Conclusion']
  )
    .slice(0, 6)
    .map((title, index) => ({
      id: crypto.randomUUID(),
      title,
      bullets: bullets.length
        ? bullets
        : useChinese
          ? ['关键结论一', '关键结论二', '关键结论三']
          : ['Key insight one', 'Key insight two', 'Key insight three'],
      speakerNotes: useChinese
        ? `用 30-45 秒讲述 ${title} 的要点。`
        : `Narrate the key points for ${title.toLowerCase()} in 30-45 seconds.`,
      visualPrompt: useChinese
        ? `科学主题的极简插画，主题为 ${title}。`
        : `Minimalist illustration for ${title.toLowerCase()} in a scientific keynote style.`,
      durationSec: 14 + index * 2
    }));

  return {
    title: useChinese ? '论文摘要' : 'Paper Summary',
    slides
  };
};
