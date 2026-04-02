import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', () => ({
  tool: (config: any) => config,
}));

vi.mock('zod', async () => {
  const actual = await vi.importActual('zod');
  return actual;
});

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock('@/lib/tts', () => ({
  synthesizeTtsText: vi.fn(),
}));

vi.mock('@/lib/session-store', () => ({
  sessionDir: vi.fn((id: string) => `/mock/storage/sessions/${id}`),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import fs from 'fs/promises';
import { synthesizeTtsText } from '@/lib/tts';
import { generateTts } from '@/lib/tools/generate-tts';

const mockFs = vi.mocked(fs);
const mockTts = vi.mocked(synthesizeTtsText);

beforeEach(() => {
  vi.clearAllMocks();
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.writeFile.mockResolvedValue(undefined);
});

describe('generateTts', () => {
  const baseParams = {
    text: 'Hello, this is a narration segment.',
    segmentId: 'seg-001',
    sessionId: 'sess-123',
  };

  it('calls synthesizeTtsText with correct params', async () => {
    mockTts.mockResolvedValue({
      audio: { buffer: Buffer.from('audio-data'), extension: 'mp3' },
      voice: 'default',
      languageType: 'English',
    });

    await generateTts.execute(
      { ...baseParams, voice: 'alloy', language: 'en' },
      {} as any,
    );

    expect(mockTts).toHaveBeenCalledWith({
      text: baseParams.text,
      voice: 'alloy',
      languageType: 'English',
    });
  });

  it('uses Chinese language type when language is zh', async () => {
    mockTts.mockResolvedValue({
      audio: { buffer: Buffer.from('audio'), extension: 'mp3' },
      voice: 'default',
      languageType: 'Chinese',
    });

    await generateTts.execute(
      { ...baseParams, language: 'zh' },
      {} as any,
    );

    expect(mockTts).toHaveBeenCalledWith(
      expect.objectContaining({ languageType: 'Chinese' }),
    );
  });

  it('creates tts directory and writes audio file', async () => {
    const audioBuffer = Buffer.from('fake-mp3-data');
    mockTts.mockResolvedValue({
      audio: { buffer: audioBuffer, extension: 'mp3' },
      voice: 'default',
      languageType: 'English',
    });

    await generateTts.execute(baseParams, {} as any);

    expect(mockFs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('tts'),
      { recursive: true },
    );
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('seg-001.mp3'),
      audioBuffer,
    );
  });

  it('returns success with audioPath', async () => {
    mockTts.mockResolvedValue({
      audio: { buffer: Buffer.from('data'), extension: 'wav' },
      voice: 'default',
      languageType: 'English',
    });

    const result = await generateTts.execute(baseParams, {} as any);

    expect(result.success).toBe(true);
    expect(result.audioPath).toBe('storage/sessions/sess-123/tts/seg-001.wav');
    expect(result.format).toBe('wav');
    expect(result.segmentId).toBe('seg-001');
    expect(result.message).toContain('seg-001');
  });

  it('returns error on TTS failure', async () => {
    mockTts.mockRejectedValue(new Error('TTS service unavailable'));

    const result = await generateTts.execute(baseParams, {} as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('TTS service unavailable');
    expect(result.segmentId).toBe('seg-001');
  });

  it('handles non-Error thrown values', async () => {
    mockTts.mockRejectedValue('string error');

    const result = await generateTts.execute(baseParams, {} as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });

  it('uses correct file extension from TTS result', async () => {
    mockTts.mockResolvedValue({
      audio: { buffer: Buffer.from('data'), extension: 'ogg' },
      voice: 'default',
      languageType: 'English',
    });

    const result = await generateTts.execute(baseParams, {} as any);

    expect(result.audioPath).toContain('seg-001.ogg');
    expect(result.format).toBe('ogg');
  });
});
