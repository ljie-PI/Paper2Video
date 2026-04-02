import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockOpenAIModel = { modelId: 'gpt-4o' };
const mockAnthropicModel = { modelId: 'claude-3-opus' };
const mockGeminiModel = { modelId: 'gemini-pro' };

const mockOpenAIFactory = vi.fn(() => mockOpenAIModel);
const mockAnthropicFactory = vi.fn(() => mockAnthropicModel);
const mockGeminiFactory = vi.fn(() => mockGeminiModel);

const mockStreamText = vi.fn(() => ({ textStream: 'mock-stream' }));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue('You are a helpful video production agent.'),
  },
}));

vi.mock('ai', () => ({
  streamText: (...args: any[]) => mockStreamText(...args),
  tool: (config: any) => config,
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => mockOpenAIFactory),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => mockAnthropicFactory),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => mockGeminiFactory),
}));

vi.mock('@/lib/tools/video-planner', () => ({ videoPlanner: { name: 'video_planner' } }));
vi.mock('@/lib/tools/parse-pdf', () => ({ parsePdf: { name: 'parse_pdf' } }));
vi.mock('@/lib/tools/parse-image', () => ({ parseImage: { name: 'parse_image' } }));
vi.mock('@/lib/tools/generate-tts', () => ({ generateTts: { name: 'generate_tts' } }));
vi.mock('@/lib/tools/generate-video-segment', () => ({ generateVideoSegment: { name: 'generate_video_segment' } }));
vi.mock('@/lib/tools/merge-video-segments', () => ({ mergeVideoSegments: { name: 'merge_video_segments' } }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const savedEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  // Reset environment
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
  delete process.env.LLM_BASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_BASE_URL;
  delete process.env.QWEN_API_KEY;
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('runAgent', () => {
  const baseMessages = [{ role: 'user' as const, content: 'Make a video' }];

  it('uses anthropic provider for claude model', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const { runAgent } = await import('@/lib/agent');

    await runAgent({
      config: { model: 'claude-3-opus-20240229', ttsSpeed: 1.0 },
      messages: baseMessages,
    });

    expect(createAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-ant-test' }),
    );
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockAnthropicModel,
        maxSteps: 25,
        temperature: 0.2,
      }),
    );
  });

  it('uses google provider for gemini model', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    const { runAgent } = await import('@/lib/agent');

    await runAgent({
      config: { model: 'gemini-1.5-pro', ttsSpeed: 1.0 },
      messages: baseMessages,
    });

    expect(createGoogleGenerativeAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'gemini-key' }),
    );
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ model: mockGeminiModel }),
    );
  });

  it('uses openai provider for gpt model', async () => {
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    const { runAgent } = await import('@/lib/agent');

    await runAgent({
      config: { model: 'gpt-4o', ttsSpeed: 1.0 },
      messages: baseMessages,
    });

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-openai-test' }),
    );
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ model: mockOpenAIModel }),
    );
  });

  it('LLM_PROVIDER env overrides model name detection', async () => {
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.LLM_API_KEY = 'shared-key';
    const { runAgent } = await import('@/lib/agent');

    await runAgent({
      config: { model: 'gpt-4o', ttsSpeed: 1.0 }, // name says openai, but env says anthropic
      messages: baseMessages,
    });

    expect(createAnthropic).toHaveBeenCalled();
    expect(createOpenAI).not.toHaveBeenCalled();
  });

  it('uses LLM_API_KEY as shared key', async () => {
    process.env.LLM_API_KEY = 'shared-secret';
    const { runAgent } = await import('@/lib/agent');

    await runAgent({
      config: { model: 'gpt-4o', ttsSpeed: 1.0 },
      messages: baseMessages,
    });

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'shared-secret' }),
    );
  });

  it('throws when no model configured', async () => {
    const { runAgent } = await import('@/lib/agent');

    await expect(
      runAgent({
        config: { model: '', ttsSpeed: 1.0 },
        messages: baseMessages,
      }),
    ).rejects.toThrow('No model configured');
  });

  it('throws when no API key available', async () => {
    const { runAgent } = await import('@/lib/agent');

    await expect(
      runAgent({
        config: { model: 'claude-3-opus', ttsSpeed: 1.0 },
        messages: baseMessages,
      }),
    ).rejects.toThrow('No API key');
  });

  it('passes system prompt and messages to streamText', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const { runAgent } = await import('@/lib/agent');

    await runAgent({
      config: { model: 'gpt-4o', ttsSpeed: 1.0 },
      messages: baseMessages,
    });

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are a helpful video production agent.',
        messages: baseMessages,
      }),
    );
  });

  it('passes all 6 tools to streamText', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const { runAgent } = await import('@/lib/agent');

    await runAgent({
      config: { model: 'gpt-4o', ttsSpeed: 1.0 },
      messages: baseMessages,
    });

    const call = mockStreamText.mock.calls[0][0];
    expect(Object.keys(call.tools)).toHaveLength(6);
    expect(call.tools).toHaveProperty('video_planner');
    expect(call.tools).toHaveProperty('parse_pdf');
    expect(call.tools).toHaveProperty('parse_image');
    expect(call.tools).toHaveProperty('generate_tts');
    expect(call.tools).toHaveProperty('generate_video_segment');
    expect(call.tools).toHaveProperty('merge_video_segments');
  });

  it('falls back to openai-compatible for unknown model names', async () => {
    process.env.QWEN_API_KEY = 'qwen-key';
    const { runAgent } = await import('@/lib/agent');

    await runAgent({
      config: { model: 'qwen-2.5-72b', ttsSpeed: 1.0 },
      messages: baseMessages,
    });

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'qwen-key' }),
    );
  });
});
