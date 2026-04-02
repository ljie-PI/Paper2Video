import fs from 'fs/promises';
import path from 'path';
import { streamText, type LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { videoPlanner } from './tools/video-planner';
import { parsePdf } from './tools/parse-pdf';
import { parseImage } from './tools/parse-image';
import { generateTts } from './tools/generate-tts';
import { generateVideoSegment } from './tools/generate-video-segment';
import { mergeVideoSegments } from './tools/merge-video-segments';
import { logger } from './logger';
import type { SessionConfig } from './types';

const SYSTEM_PROMPT_PATH = path.join(
  process.cwd(),
  'lib',
  'prompts',
  'agent-system.md'
);

let cachedSystemPrompt: string | null = null;

const loadSystemPrompt = async (): Promise<string> => {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = await fs.readFile(SYSTEM_PROMPT_PATH, 'utf8');
  return cachedSystemPrompt;
};

type LlmProvider = 'openai' | 'openai-compatible' | 'anthropic' | 'gemini';

const detectProvider = (model: string): LlmProvider => {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === 'anthropic' || explicit === 'claude') return 'anthropic';
  if (explicit === 'gemini' || explicit === 'google') return 'gemini';
  if (explicit === 'openai') return 'openai';
  if (explicit === 'openai-compatible') return 'openai-compatible';

  const lower = model.toLowerCase();
  if (lower.includes('claude')) return 'anthropic';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt') || lower.includes('openai')) return 'openai';
  return 'openai-compatible';
};

const resolveApiKey = (provider: LlmProvider): string => {
  const shared = process.env.LLM_API_KEY?.trim();
  if (shared) return shared;

  if (provider === 'openai') return process.env.OPENAI_API_KEY?.trim() ?? '';
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY?.trim() ?? '';
  if (provider === 'gemini') return process.env.GEMINI_API_KEY?.trim() ?? '';
  return process.env.QWEN_API_KEY?.trim() ?? process.env.OPENAI_API_KEY?.trim() ?? '';
};

const createModel = (config: SessionConfig) => {
  const modelName = config.model || process.env.LLM_MODEL?.trim() || '';
  if (!modelName) {
    throw new Error('No model configured. Set model in session config or LLM_MODEL env var.');
  }

  const provider = detectProvider(modelName);
  const apiKey = resolveApiKey(provider);
  if (!apiKey) {
    throw new Error(`No API key for provider "${provider}". Check your environment variables.`);
  }

  if (provider === 'anthropic') {
    const baseURL = process.env.ANTHROPIC_BASE_URL?.trim();
    const anthropic = createAnthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
    return anthropic(modelName) as LanguageModelV1;
  }

  if (provider === 'gemini') {
    const baseURL = process.env.GEMINI_BASE_URL?.trim();
    const google = createGoogleGenerativeAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    return google(modelName) as LanguageModelV1;
  }

  // openai or openai-compatible
  const baseURL = process.env.LLM_BASE_URL?.trim()
    ?? process.env.OPENAI_BASE_URL?.trim()
    ?? (provider === 'openai' ? undefined : undefined);
  const openai = createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
  return openai(modelName) as LanguageModelV1;
};

const tools = {
  video_planner: videoPlanner,
  parse_pdf: parsePdf,
  parse_image: parseImage,
  generate_tts: generateTts,
  generate_video_segment: generateVideoSegment,
  merge_video_segments: mergeVideoSegments,
};

export const runAgent = async (input: {
  config: SessionConfig;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}) => {
  const systemPrompt = await loadSystemPrompt();
  const model = createModel(input.config);

  logger.info(`[agent] Starting agent with model: ${input.config.model}`);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: input.messages,
    tools,
    maxSteps: 25,
    temperature: 0.2,
  });

  return result;
};
