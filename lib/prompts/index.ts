import fs from 'fs';
import path from 'path';

const promptCache = new Map<string, string>();

export const getPrompt = (fileName: string) => {
  if (promptCache.has(fileName)) {
    return promptCache.get(fileName) ?? '';
  }

  try {
    const promptPath = path.join(process.cwd(), 'lib', 'prompts', fileName);
    const content = fs.readFileSync(promptPath, 'utf8');
    promptCache.set(fileName, content);
    return content;
  } catch {
    promptCache.set(fileName, '');
    return '';
  }
};

const resolvePath = (data: Record<string, unknown>, key: string) => {
  const parts = key.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
};

export const renderTemplate = (
  template: string,
  data: Record<string, unknown>
) =>
  template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key) => {
    const value = resolvePath(data, key);
    return value === undefined || value === null ? '' : String(value);
  });
