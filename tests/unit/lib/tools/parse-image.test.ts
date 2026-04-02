import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('ai', () => ({
  tool: (config: any) => config,
}));

vi.mock('zod', async () => {
  const actual = await vi.importActual('zod');
  return actual;
});

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import fs from 'fs/promises';
import { parseImage } from '@/lib/tools/parse-image';

const mockFs = vi.mocked(fs);
const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();
  // Clear all relevant env vars
  delete process.env.VISION_API_KEY;
  delete process.env.LLM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.VISION_BASE_URL;
  delete process.env.LLM_BASE_URL;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.VISION_MODEL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...savedEnv };
});

describe('parseImage', () => {
  it('returns error when no API key env vars are set', async () => {
    mockFs.readFile.mockResolvedValue(Buffer.from('fake-image'));

    const result = await parseImage.execute(
      { imagePath: '/mock/image.png' },
      {} as any,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No vision API key');
  });

  it('calls fetch with correct vision API URL and body', async () => {
    process.env.VISION_API_KEY = 'test-vision-key';
    const imageBuffer = Buffer.from('fake-image-data');
    mockFs.readFile.mockResolvedValue(imageBuffer);

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'A chart showing results' } }],
      }),
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

    await parseImage.execute(
      { imagePath: '/mock/chart.png', context: 'Figure 3: Results' },
      {} as any,
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-vision-key',
          'Content-Type': 'application/json',
        }),
      }),
    );

    // Verify the body structure
    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]!.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.max_tokens).toBe(1024);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].content[1].type).toBe('image_url');
    expect(body.messages[1].content[1].image_url.url).toContain('data:image/png;base64,');
  });

  it('uses correct MIME type for jpeg files', async () => {
    process.env.LLM_API_KEY = 'test-key';
    mockFs.readFile.mockResolvedValue(Buffer.from('jpeg-data'));
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Description' } }],
      }),
    } as any);

    await parseImage.execute({ imagePath: '/mock/photo.jpg' }, {} as any);

    const body = JSON.parse(
      vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string,
    );
    expect(body.messages[1].content[1].image_url.url).toContain('data:image/jpeg;base64,');
  });

  it('returns description on success', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockFs.readFile.mockResolvedValue(Buffer.from('img'));
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'A bar chart showing accuracy metrics.' } }],
      }),
    } as any);

    const result = await parseImage.execute(
      { imagePath: '/mock/fig.png' },
      {} as any,
    );

    expect(result.success).toBe(true);
    expect(result.description).toBe('A bar chart showing accuracy metrics.');
    expect(result.imagePath).toBe('/mock/fig.png');
  });

  it('returns error on fetch failure (non-ok response)', async () => {
    process.env.VISION_API_KEY = 'test-key';
    mockFs.readFile.mockResolvedValue(Buffer.from('img'));
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('Rate limited'),
    } as any);

    const result = await parseImage.execute(
      { imagePath: '/mock/fig.png' },
      {} as any,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Vision API failed');
    expect(result.error).toContain('429');
  });

  it('returns error on network failure', async () => {
    process.env.VISION_API_KEY = 'test-key';
    mockFs.readFile.mockResolvedValue(Buffer.from('img'));
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

    const result = await parseImage.execute(
      { imagePath: '/mock/fig.png' },
      {} as any,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('returns error when response has no content', async () => {
    process.env.VISION_API_KEY = 'test-key';
    mockFs.readFile.mockResolvedValue(Buffer.from('img'));
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ choices: [] }),
    } as any);

    const result = await parseImage.execute(
      { imagePath: '/mock/fig.png' },
      {} as any,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing content');
  });

  it('uses custom base URL from env', async () => {
    process.env.VISION_API_KEY = 'key';
    process.env.VISION_BASE_URL = 'https://custom-api.example.com/v1';
    mockFs.readFile.mockResolvedValue(Buffer.from('img'));
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'desc' } }],
      }),
    } as any);

    await parseImage.execute({ imagePath: '/mock/fig.png' }, {} as any);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://custom-api.example.com/v1/chat/completions',
      expect.anything(),
    );
  });

  it('uses custom vision model from env', async () => {
    process.env.VISION_API_KEY = 'key';
    process.env.VISION_MODEL = 'gpt-4-vision-preview';
    mockFs.readFile.mockResolvedValue(Buffer.from('img'));
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'desc' } }],
      }),
    } as any);

    await parseImage.execute({ imagePath: '/mock/fig.png' }, {} as any);

    const body = JSON.parse(
      vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string,
    );
    expect(body.model).toBe('gpt-4-vision-preview');
  });

  it('includes context in user message when provided', async () => {
    process.env.VISION_API_KEY = 'key';
    mockFs.readFile.mockResolvedValue(Buffer.from('img'));
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'desc' } }],
      }),
    } as any);

    await parseImage.execute(
      { imagePath: '/mock/fig.png', context: 'Figure 1 caption' },
      {} as any,
    );

    const body = JSON.parse(
      vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string,
    );
    const userText = body.messages[1].content[0].text;
    expect(userText).toContain('Figure 1 caption');
  });

  it('uses fallback user message without context', async () => {
    process.env.VISION_API_KEY = 'key';
    mockFs.readFile.mockResolvedValue(Buffer.from('img'));
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'desc' } }],
      }),
    } as any);

    await parseImage.execute(
      { imagePath: '/mock/fig.png' },
      {} as any,
    );

    const body = JSON.parse(
      vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string,
    );
    const userText = body.messages[1].content[0].text;
    expect(userText).toBe('Analyze this figure from an academic paper.');
  });
});
