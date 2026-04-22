import crypto from 'crypto';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockStat = vi.fn();

vi.mock('fs/promises', () => ({
  default: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    stat: (...args: unknown[]) => mockStat(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from '@/lib/logger';
import { generateSlideNarrations } from '@/lib/tts';

const mockLogger = vi.mocked(logger);
const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();
const savedEnv = { ...process.env };

const makeSlides = () => ({
  slides: [
    {
      title: 'Slide 1',
      text_contents: 'Body',
      images: [],
      tables: [],
      transcript: 'Narration',
    },
  ],
});

const makeConfig = () => ({
  model: 'gpt-4o',
  enableVideo: true,
  voiceClone: false,
  ttsSpeed: 1,
  outputLanguage: 'zh' as const,
});

const makeCacheHash = () =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        transcript: 'Narration',
        voice: 'Cherry',
        languageType: 'Chinese',
        speechRate: 0,
        model: 'qwen3-tts-flash',
      })
    )
    .digest('hex');

beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...savedEnv,
    TTS_API_KEY: 'test-key',
    USE_TTS_CACHE: 'true',
  };
  mockReadFile.mockResolvedValue(
    JSON.stringify({
      slides: {
        '0': {
          hash: makeCacheHash(),
          path: '../secrets.wav',
          format: 'wav',
        },
      },
    })
  );
  mockStat.mockResolvedValue({
    isFile: () => true,
  });
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () =>
      Promise.resolve(
        JSON.stringify({
          output: {
            audio: Buffer.from('audio-data').toString('base64'),
            format: 'wav',
          },
        })
      ),
  });
  globalThis.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
  process.env = { ...savedEnv };
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('generateSlideNarrations', () => {
  it('treats invalid cached paths as a cache miss instead of failing the job', async () => {
    const result = await generateSlideNarrations(makeSlides(), 'job-1', makeConfig());

    expect(result.audio).toHaveLength(1);
    expect(result.audio[0]).toMatchObject({
      index: 0,
      transcript: 'Narration',
      path: 'storage/outputs/job-1/tts/slide-001.wav',
      format: 'wav',
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[tts] ignoring invalid cached audio path for slide 1: ../secrets.wav',
      expect.any(Error)
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'storage', 'outputs', 'job-1', 'tts', 'slide-001.wav'),
      expect.any(Buffer)
    );
  });

  it('treats cached directories as a cache miss instead of audio files', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        slides: {
          '0': {
            hash: makeCacheHash(),
            path: '.',
            format: 'wav',
          },
        },
      })
    );
    mockStat.mockResolvedValue({
      isFile: () => false,
    });

    const result = await generateSlideNarrations(makeSlides(), 'job-1', makeConfig());

    expect(result.audio).toHaveLength(1);
    expect(result.audio[0]).toMatchObject({
      path: 'storage/outputs/job-1/tts/slide-001.wav',
      format: 'wav',
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
