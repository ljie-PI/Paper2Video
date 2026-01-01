export const LLM_MAX_TOKENS = Number.parseInt(
  process.env.LLM_MAX_TOKENS ?? '4096',
  10
);
export const LLM_TEMPERATURE = 0.2;

export type LlmProvider = 'openai' | 'openai-compatible' | 'anthropic' | 'gemini';

const normalizeProvider = (value?: string | null): LlmProvider | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[_\s]/g, '-');
  if (normalized === 'openai') return 'openai';
  if (normalized === 'openai-compatible' || normalized === 'openai-compatible-api') {
    return 'openai-compatible';
  }
  if (normalized === 'anthropic' || normalized === 'claude') return 'anthropic';
  if (normalized === 'gemini' || normalized === 'google') return 'gemini';
  return null;
};

const guessProviderFromModel = (model?: string | null): LlmProvider | null => {
  if (!model) return null;
  const lower = model.toLowerCase();
  if (lower.includes('claude')) return 'anthropic';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt') || lower.includes('openai')) return 'openai';
  if (lower.includes('qwen')) return 'openai-compatible';
  return 'openai-compatible';
};

const resolveApiKey = (provider: LlmProvider): string | null => {
  const shared = process.env.LLM_API_KEY?.trim();
  if (shared) return shared;
  if (provider === 'openai') return process.env.OPENAI_API_KEY?.trim() ?? null;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY?.trim() ?? null;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY?.trim() ?? null;
  if (provider === 'openai-compatible') {
    return (
      process.env.QWEN_API_KEY?.trim() ??
      process.env.OPENAI_API_KEY?.trim() ??
      null
    );
  }
  return null;
};

const resolveLlmConfig = (model: string | null) => {
  const provider =
    normalizeProvider(process.env.LLM_PROVIDER) ??
    (process.env.LLM_API_KEY ? guessProviderFromModel(model) : null) ??
    (process.env.OPENAI_API_KEY ? 'openai' : null) ??
    (process.env.ANTHROPIC_API_KEY ? 'anthropic' : null) ??
    (process.env.GEMINI_API_KEY ? 'gemini' : null) ??
    (process.env.QWEN_API_KEY ? 'openai-compatible' : null) ??
    guessProviderFromModel(model);

  if (!provider) return null;

  const apiKey = resolveApiKey(provider);
  if (!apiKey) return null;

  return {
    provider,
    apiKey,
    model: model || process.env.LLM_MODEL?.trim() || ''
  };
};

const buildOpenAiUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/$/, '')}/chat/completions`;

const callOpenAiCompatible = async (
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
) => {
  const url = buildOpenAiUrl(baseUrl);
  const body = {
    model,
    temperature: LLM_TEMPERATURE,
    max_tokens: LLM_MAX_TOKENS,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  };
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  let responseBody: unknown = responseText;
  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseBody = { raw: responseText };
  }

  if (!response.ok) {
    const message = responseText;
    throw new Error(`LLM request failed: ${response.status} ${message}`);
  }

  const data = responseBody as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('LLM response missing content.');
  }
  return content;
};

const callAnthropic = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
) => {
  const baseUrl =
    process.env.ANTHROPIC_BASE_URL?.trim() ?? 'https://api.anthropic.com/v1';
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: LLM_MAX_TOKENS,
      temperature: LLM_TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  const content = data?.content?.[0]?.text;
  if (typeof content !== 'string') {
    throw new Error('LLM response missing content.');
  }
  return content;
};

const callGemini = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
) => {
  const baseUrl =
    process.env.GEMINI_BASE_URL?.trim() ??
    'https://generativelanguage.googleapis.com/v1beta';
  const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: LLM_TEMPERATURE,
        maxOutputTokens: LLM_MAX_TOKENS
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${message}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== 'string') {
    throw new Error('LLM response missing content.');
  }
  return content;
};

export const requestLlmText = async (input: {
  model: string | null;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string | null> => {
  const llmConfig = resolveLlmConfig(input.model?.trim() ?? null);
  if (!llmConfig?.model) {
    throw new Error('LLM model is required but was not provided.');
  }

  if (llmConfig.provider === 'anthropic') {
    return callAnthropic(
      llmConfig.apiKey,
      llmConfig.model,
      input.systemPrompt,
      input.userPrompt
    );
  }

  if (llmConfig.provider === 'gemini') {
    return callGemini(
      llmConfig.apiKey,
      llmConfig.model,
      input.systemPrompt,
      input.userPrompt
    );
  }

  const baseUrl =
    process.env.LLM_BASE_URL?.trim() ??
    process.env.OPENAI_BASE_URL?.trim() ??
    'https://api.openai.com/v1';
  return callOpenAiCompatible(
    baseUrl,
    llmConfig.apiKey,
    llmConfig.model,
    input.systemPrompt,
    input.userPrompt
  );
};
