import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { JobConfig, SlidesJSON } from './types';
import { outputsDir, toRelativePath } from './storage';
import { logger } from './logger';

const DEFAULT_TTS_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const DEFAULT_TTS_MODEL = 'qwen3-tts-flash';
const DEFAULT_TTS_VOICE = 'Cherry';
const DEFAULT_TIMEOUT_MS = 120000;

type TtsConfig = {
  url: string;
  apiKey: string;
  model: string;
};

type AudioPayload = {
  buffer: Buffer;
  extension: string;
};

type SlideAudio = {
  index: number;
  transcript: string;
  path: string;
  format: string;
};

type SlideCacheEntry = {
  hash: string;
  path: string;
  format: string;
};

type TtsCache = {
  slides: Record<string, SlideCacheEntry>;
};

const resolveTtsConfig = (): TtsConfig => {
  const apiKey = process.env.TTS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing TTS_API_KEY environment variable.');
  }

  const url = process.env.TTS_MODEL_URL?.trim() || DEFAULT_TTS_URL;
  const model = process.env.TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;

  return { url, apiKey, model };
};

const resolveVoice = (config: JobConfig) =>
  config.voiceId?.trim() || process.env.TTS_VOICE?.trim() || DEFAULT_TTS_VOICE;

const normalizeLanguageType = (value?: string | null) => {
  if (!value) return 'Chinese';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'en' || normalized === 'english') return 'English';
  if (normalized === 'zh' || normalized === 'chinese' || normalized === 'cn') {
    return 'Chinese';
  }
  return value.trim();
};

const resolveLanguageType = (config: JobConfig) =>
  normalizeLanguageType(config.outputLanguage ?? null);

const hashContent = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const readCache = async (cachePath: string): Promise<TtsCache> => {
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    const data = JSON.parse(raw) as TtsCache;
    return data && typeof data === 'object' ? data : { slides: {} };
  } catch {
    return { slides: {} };
  }
};

const writeCache = async (cachePath: string, cache: TtsCache) => {
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf8');
};

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const resolveCachedAudio = async (
  cache: TtsCache,
  slideIndex: number,
  cacheHash: string,
  transcript: string
) => {
  const entry = cache.slides[String(slideIndex)];
  if (!entry) return null;
  if (entry.hash !== cacheHash) return null;
  const absolutePath = path.isAbsolute(entry.path)
    ? entry.path
    : path.join(process.cwd(), entry.path);
  if (!(await fileExists(absolutePath))) return null;
  return {
    index: slideIndex,
    transcript,
    path: entry.path,
    format: entry.format
  } as SlideAudio;
};

const toSpeechRateValue = (value?: number | null) => {
  if (!Number.isFinite(value)) return undefined;
  const rate = Math.round(((value as number) - 1) * 1000);
  return Math.max(-500, Math.min(500, rate));
};

const normalizeFormat = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mp3') || normalized.includes('mpeg')) return 'mp3';
  if (normalized.includes('ogg')) return 'ogg';
  return null;
};

const formatFromContentType = (value?: string | null) => {
  if (!value) return undefined;
  const lowered = value.toLowerCase();
  if (lowered.includes('audio/wav')) return 'wav';
  if (lowered.includes('audio/mpeg')) return 'mp3';
  if (lowered.includes('audio/ogg')) return 'ogg';
  return undefined;
};

const decodeBase64Audio = (payload: string): { buffer: Buffer; format?: string } => {
  const trimmed = payload.trim();
  if (trimmed.startsWith('data:')) {
    const [meta, base64] = trimmed.split(',');
    const contentType = meta?.split(';')?.[0]?.replace('data:', '');
    return {
      buffer: Buffer.from(base64 ?? '', 'base64'),
      format: formatFromContentType(contentType)
    };
  }
  return { buffer: Buffer.from(trimmed, 'base64') };
};

const fetchAudioFromUrl = async (url: string): Promise<AudioPayload> => {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`TTS audio download failed: ${response.status} ${message}`);
  }
  const contentType = response.headers.get('content-type');
  const format = formatFromContentType(contentType) || normalizeFormat(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    extension: format ?? 'wav'
  };
};

const extractAudioPayload = async (payload: unknown): Promise<AudioPayload> => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('TTS response missing audio payload.');
  }

  const data = payload as {
    output?: {
      audio?: unknown;
      audio_format?: unknown;
      format?: unknown;
      audios?: unknown;
    };
  };

  const output = data.output ?? {};
  const outputFormat =
    normalizeFormat(
      typeof output.audio_format === 'string' ? output.audio_format : null
    ) ??
    normalizeFormat(typeof output.format === 'string' ? output.format : null);

  const audio = output.audio ?? output.audios;

  if (typeof audio === 'string') {
    if (audio.startsWith('http')) {
      return fetchAudioFromUrl(audio);
    }
    const decoded = decodeBase64Audio(audio);
    return {
      buffer: decoded.buffer,
      extension: decoded.format ?? outputFormat ?? 'wav'
    };
  }

  if (Array.isArray(audio) && audio.length > 0) {
    return extractAudioPayload({ output: { audio: audio[0], format: outputFormat } });
  }

  if (audio && typeof audio === 'object') {
    const audioObj = audio as {
      data?: unknown;
      url?: unknown;
      format?: unknown;
    };
    const format =
      normalizeFormat(typeof audioObj.format === 'string' ? audioObj.format : null) ??
      outputFormat;

    if (typeof audioObj.url === 'string') {
      return fetchAudioFromUrl(audioObj.url);
    }
    if (typeof audioObj.data === 'string') {
      const decoded = decodeBase64Audio(audioObj.data);
      return { buffer: decoded.buffer, extension: decoded.format ?? format ?? 'wav' };
    }
  }

  throw new Error('Unable to extract audio from TTS response.');
};

const requestTtsAudio = async (
  config: TtsConfig,
  input: { text: string; voice: string; languageType: string; speechRate?: number }
): Promise<AudioPayload> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    logger.debug('[tts] input.speechRate:', input.speechRate);
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        input: {
          text: input.text,
          voice: input.voice,
          language_type: input.languageType,
          ...(input.speechRate !== undefined ? { speech_rate: input.speechRate } : {})
        }
      }),
      signal: controller.signal
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseBody = { raw: responseText };
    }

    if (!response.ok) {
      throw new Error(
        `TTS request failed: ${response.status} ${responseText || response.statusText}`
      );
    }

    return extractAudioPayload(responseBody);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TTS request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const generateSlideNarrations = async (
  slides: SlidesJSON,
  jobId: string,
  config: JobConfig,
  options?: { speechRate?: number }
): Promise<{ audio: SlideAudio[] }> => {
  const ttsConfig = resolveTtsConfig();
  const outputDir = path.join(outputsDir(jobId), 'tts');
  await fs.mkdir(outputDir, { recursive: true });
  const cachePath = path.join(outputDir, 'tts-cache.json');
  const useCache = (process.env.USE_TTS_CACHE ?? 'true').toLowerCase() === 'true';
  const cache = useCache ? await readCache(cachePath) : { slides: {} };

  const voice = resolveVoice(config);
  const languageType = resolveLanguageType(config);
  const speechRate = toSpeechRateValue(options?.speechRate ?? config.ttsSpeed);
  const results: SlideAudio[] = [];

  for (let index = 0; index < slides.slides.length; index += 1) {
    const slide = slides.slides[index];
    const transcript = slide.transcript?.trim();
    if (!transcript) {
      throw new Error(`Slide ${index + 1} transcript is missing.`);
    }

    const cacheHash = hashContent(
      JSON.stringify({
        transcript,
        voice,
        languageType,
        speechRate,
        model: ttsConfig.model
      })
    );
    if (useCache) {
      const cached = await resolveCachedAudio(cache, index, cacheHash, transcript);
      if (cached) {
        logger.info(`[tts] cache hit for slide ${index + 1}`);
        results.push(cached);
        continue;
      }
    }

    logger.info(`[tts] generating audio for slide ${index + 1}`);
    const audio = await requestTtsAudio(ttsConfig, {
      text: transcript,
      voice,
      languageType,
      speechRate
    });

    const fileName = `slide-${String(index + 1).padStart(3, '0')}.${audio.extension}`;
    const filePath = path.join(outputDir, fileName);
    await fs.writeFile(filePath, audio.buffer);

    const entry = {
      index,
      transcript,
      path: toRelativePath(filePath),
      format: audio.extension
    };
    if (useCache) {
      cache.slides[String(index)] = {
        hash: cacheHash,
        path: entry.path,
        format: entry.format
      };
    }
    results.push(entry);
  }

  if (useCache) {
    await writeCache(cachePath, cache);
  }
  return { audio: results };
};

export const synthesizeTtsText = async (input: {
  text: string;
  voice?: string;
  languageType?: string;
}) => {
  const ttsConfig = resolveTtsConfig();
  const voice =
    input.voice?.trim() || process.env.TTS_VOICE?.trim() || DEFAULT_TTS_VOICE;
  const languageType = normalizeLanguageType(input.languageType);
  const audio = await requestTtsAudio(ttsConfig, {
    text: input.text,
    voice,
    languageType
  });
  return { audio, voice, languageType };
};
