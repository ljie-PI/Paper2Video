import { promises as fs } from 'fs';
import path from 'path';
import extract from 'extract-zip';
import { outputsDir, toRelativePath } from './storage';
import { logger } from './logger';
import { getPrompt, renderTemplate } from './prompts';
import {
  MINERU_POLL_INTERVAL_MS,
  MINERU_POLL_TIMEOUT_MS,
  MINERU_REQUEST_TIMEOUT_MS,
  PNG_SIGNATURE
} from '@/constants/mineru';

type JsonObject = Record<string, unknown>;

const stubTemplate = () => {
  const template = getPrompt('mineru-stub.md');
  if (!template) {
    throw new Error('Missing prompt: mineru-stub.md');
  }
  return template;
};

const stubMarkdown = (fileName: string) =>
  renderTemplate(stubTemplate(), { filename: fileName });

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/, '');

const urlToPath = (value: string) => {
  try {
    const parsed = new URL(value);
    const pathSuffix = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return pathSuffix || '/';
  } catch {
    return value;
  }
};

const sanitizeUrlMessage = (message: string) =>
  message.replace(/https?:\/\/[^\s)]+/g, (match) => urlToPath(match));

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readPngDimensions = async (filePath: string) => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(24);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead < buffer.length) return null;
    if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
    if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  } finally {
    await handle.close();
  }
};

const createImageMapping = (markdown: string): Map<string, string> => {
  const pattern = /!\[image\]\((artifacts\/image_[^)]+\.png)\)/gi;
  const matches = Array.from(markdown.matchAll(pattern));
  const mapping = new Map<string, string>();

  matches.forEach((match) => {
    const fullPath = match[1];
    const prefixMatch = fullPath.match(/(artifacts\/image_\d+)/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      mapping.set(prefix, fullPath);
    }
  });

  return mapping;
};

const appendImageSizeInfo = async (markdown: string, outputDir: string) => {
  const pattern = /!\[image\]\((artifacts\/image_[^)]+\.png)\)/gi;
  const matches = Array.from(markdown.matchAll(pattern));
  if (!matches.length) return { markdown, imageMapping: new Map() };

  const sizes = new Map<string, { width: number; height: number }>();
  await Promise.all(
    matches.map(async (match) => {
      const relativePath = match[1];
      if (sizes.has(relativePath)) return;
      const absolutePath = path.join(outputDir, relativePath);
      try {
        const size = await readPngDimensions(absolutePath);
        if (size) {
          sizes.set(relativePath, size);
        } else {
          logger.warn(`[mineru] unable to read image size for ${relativePath}`);
        }
      } catch (error) {
        logger.warn(`[mineru] failed to read image ${relativePath}`, error);
      }
    })
  );

  const imageMapping = createImageMapping(markdown);

  const updatedMarkdown = markdown.replace(pattern, (fullMatch, relativePath: string) => {
    const size = sizes.get(relativePath);
    if (!size) return fullMatch;

    const prefixMatch = relativePath.match(/(artifacts\/image_\d+)/);
    const prefix = prefixMatch ? prefixMatch[1] : relativePath;

    return `![image_${size.width}_${size.height}](${prefix})`;
  });

  return { markdown: updatedMarkdown, imageMapping };
};

const requestJson = async <T>(
  url: string,
  options: RequestInit,
  timeoutMs = MINERU_REQUEST_TIMEOUT_MS
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const safeUrl = urlToPath(url);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      throw new Error(`MinerU failed: ${response.status}${statusText} (${safeUrl})`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`MinerU request timed out: ${safeUrl}`);
    }
    if (error instanceof Error) {
      const message = sanitizeUrlMessage(error.message?.trim() || 'unknown error');
      throw new Error(`MinerU request failed (${safeUrl}): ${message}`);
    }
    throw new Error(`MinerU request failed (${safeUrl}): unknown error`);
  } finally {
    clearTimeout(timeout);
  }
};

const getStringField = (payload: JsonObject, paths: string[]) => {
  for (const key of paths) {
    const value = key.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as JsonObject)[part];
    }, payload);
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
};

const extractTaskId = (payload: JsonObject) =>
  getStringField(payload, ['task_id', 'taskId', 'data.task_id', 'data.taskId']);

const extractTaskStatus = (payload: JsonObject) =>
  getStringField(payload, ['task_status', 'status', 'data.task_status', 'data.status']) ??
  'unknown';

const extractMarkdown = (payload: JsonObject) =>
  getStringField(payload, [
    'markdown',
    'md',
    'result.markdown',
    'result.md',
    'data.markdown',
    'data.md'
  ]);

const extractResultUrl = (payload: JsonObject) =>
  getStringField(payload, [
    'result_url',
    'download_url',
    'result.download_url',
    'result.url',
    'data.result_url',
    'data.download_url',
    'data.result.download_url',
    'data.result.url'
  ]);

const createMinerUTask = async (
  uploadUrl: string,
  apiKey: string,
  pdfPath: string
) => {
  const buffer = await fs.readFile(pdfPath);
  logger.debug(`[mineru] read PDF file ${pdfPath}, size ${buffer.length} bytes`);

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([buffer], { type: 'application/pdf' }),
    path.basename(pdfPath)
  );

  const data = await requestJson<JsonObject>(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-API-Key': apiKey
    },
    body: formData
  });
  logger.debug('[mineru] upload response', data);

  return {
    taskId: extractTaskId(data),
    taskStatus: extractTaskStatus(data),
    markdown: extractMarkdown(data),
    resultUrl: extractResultUrl(data)
  };
};

const pollMinerUTask = async (
  statusUrlTemplate: string,
  apiKey: string,
  taskId: string
) => {
  const deadline = Date.now() + MINERU_POLL_TIMEOUT_MS;
  let lastStatus = 'unknown';

  while (Date.now() < deadline) {
    const statusUrl = statusUrlTemplate.replace('{taskId}', taskId);
    const data = await requestJson<JsonObject>(statusUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-API-Key': apiKey
      }
    });
    logger.debug(`[mineru] task ${taskId} status data`, data);

    lastStatus = extractTaskStatus(data).toLowerCase();
    const markdown = extractMarkdown(data);
    const resultUrl = extractResultUrl(data);

    if (markdown || resultUrl) {
      return { status: lastStatus, markdown, resultUrl };
    }

    if (lastStatus === 'success' || lastStatus === 'completed' || lastStatus === 'done') {
      return { status: lastStatus, markdown: null, resultUrl: null };
    }

    if (lastStatus === 'failed' || lastStatus === 'error' || lastStatus === 'canceled') {
      throw new Error(`MinerU task ${taskId} failed: ${lastStatus}`);
    }

    await delay(MINERU_POLL_INTERVAL_MS);
  }

  throw new Error(
    `MinerU task ${taskId} polling timed out after ${MINERU_POLL_TIMEOUT_MS}ms (last status ${lastStatus})`
  );
};

const downloadResult = async (downloadUrl: string, outputDir: string) => {
  const safeUrl = urlToPath(downloadUrl);
  const zipPath = path.join(outputDir, 'mineru.zip');
  const mdPath = path.join(outputDir, 'paper.md');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MINERU_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(downloadUrl, { signal: controller.signal });
    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      throw new Error(
        `MinerU result download failed: ${response.status}${statusText} (${safeUrl})`
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as JsonObject;
      return {
        markdown: extractMarkdown(payload),
        zipPath: null
      };
    }

    if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
      const markdown = await response.text();
      await fs.writeFile(mdPath, markdown, 'utf8');
      return {
        markdown,
        zipPath: null
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(zipPath, buffer);
    logger.debug(`[mineru] downloaded result file to ${zipPath}, size ${buffer.length} bytes`);
    return { markdown: null, zipPath };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`MinerU result download timed out: ${safeUrl}`);
    }
    if (error instanceof Error) {
      const message = sanitizeUrlMessage(error.message?.trim() || 'unknown error');
      throw new Error(`MinerU result download failed (${safeUrl}): ${message}`);
    }
    throw new Error(`MinerU result download failed (${safeUrl}): unknown error`);
  } finally {
    clearTimeout(timeout);
  }
};

const extractMinerUZip = async (zipPath: string, outputDir: string) => {
  const extractDir = path.join(outputDir, 'mineru-extract');
  await fs.mkdir(extractDir, { recursive: true });

  await extract(zipPath, { dir: extractDir });
  try {
    await fs.rm(zipPath, { force: true });
    logger.debug(`[mineru] removed zip file ${zipPath} after extraction`);
  } catch (error) {
    logger.warn(`[mineru] failed to remove zip file ${zipPath} after extraction`, error);
  }

  return extractDir;
};

const findFirstMarkdown = async (rootDir: string): Promise<string | null> => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      const nested = await findFirstMarkdown(fullPath);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      return fullPath;
    }
  }

  return null;
};

const findArtifactsDir = async (rootDir: string): Promise<string | null> => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'artifacts') {
        return fullPath;
      }
      const nested = await findArtifactsDir(fullPath);
      if (nested) return nested;
    }
  }

  return null;
};

const materializeMinerUOutput = async (
  extractDir: string,
  outputDir: string
): Promise<{ markdown: string; imageMapping: Map<string, string> }> => {
  const markdownPath = await findFirstMarkdown(extractDir);
  if (!markdownPath) {
    throw new Error('MinerU output missing markdown file');
  }

  const artifactsPath = await findArtifactsDir(extractDir);
  if (artifactsPath) {
    const targetArtifacts = path.join(outputDir, 'artifacts');
    await fs.rm(targetArtifacts, { recursive: true, force: true });
    await fs.cp(artifactsPath, targetArtifacts, { recursive: true });
  }

  const markdown = await fs.readFile(markdownPath, 'utf8');
  try {
    await fs.rm(extractDir, { recursive: true, force: true });
    logger.debug(`[mineru] removed extract dir ${extractDir} after materialization`);
  } catch (error) {
    logger.warn(`[mineru] failed to remove extract dir ${extractDir} after materialization`, error);
  }

  logger.debug(`[mineru] materialized output from ${extractDir}, output to ${outputDir}`);
  const result = await appendImageSizeInfo(markdown, outputDir);
  return result;
};

const toStatusUrlTemplate = (baseUrl: string, statusPathTemplate: string) => {
  if (statusPathTemplate.startsWith('http://') || statusPathTemplate.startsWith('https://')) {
    return statusPathTemplate;
  }
  return `${baseUrl}${statusPathTemplate}`;
};

export const convertPdfToMarkdown = async (pdfPath: string, jobId: string) => {
  logger.info(`[mineru] convertPdfToMarkdown: processing PDF ${pdfPath} for job ${jobId}`);
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });

  let markdown: string;
  let imageMapping: Map<string, string> = new Map();

  const apiKey = process.env.MINERU_API_KEY?.trim() ?? '';
  const baseUrl = normalizeBaseUrl(process.env.MINERU_API_URL?.trim() ?? 'https://mineru.net');
  const uploadPath = process.env.MINERU_UPLOAD_PATH?.trim() ?? '/api/v1/file/upload';
  const statusPathTemplate = process.env.MINERU_STATUS_PATH_TEMPLATE?.trim() ?? '/api/v1/file/status/{taskId}';
  const resultPathTemplate = process.env.MINERU_RESULT_PATH_TEMPLATE?.trim() ?? '/api/v1/file/result/{taskId}';

  if (!apiKey) {
    logger.warn('[mineru] MINERU_API_KEY not configured, fallback to local stub markdown');
    markdown = stubMarkdown(path.basename(pdfPath));
  } else {
    const uploadUrl = uploadPath.startsWith('http://') || uploadPath.startsWith('https://')
      ? uploadPath
      : `${baseUrl}${uploadPath}`;
    logger.info(`[mineru] using upload endpoint ${urlToPath(uploadUrl)}`);

    const created = await createMinerUTask(uploadUrl, apiKey, pdfPath);
    let resultMarkdown = created.markdown;
    let resultUrl = created.resultUrl;

    if (!resultMarkdown && !resultUrl && created.taskId) {
      const statusTemplate = toStatusUrlTemplate(baseUrl, statusPathTemplate);
      const polled = await pollMinerUTask(statusTemplate, apiKey, created.taskId);
      resultMarkdown = polled.markdown;
      resultUrl = polled.resultUrl;

      if (!resultMarkdown && !resultUrl) {
        const fallbackResultUrl = resultPathTemplate.startsWith('http://') || resultPathTemplate.startsWith('https://')
          ? resultPathTemplate.replace('{taskId}', created.taskId)
          : `${baseUrl}${resultPathTemplate}`.replace('{taskId}', created.taskId);
        resultUrl = fallbackResultUrl;
      }
    }

    if (resultMarkdown) {
      const result = await appendImageSizeInfo(resultMarkdown, outputDir);
      markdown = result.markdown;
      imageMapping = result.imageMapping;
    } else if (resultUrl) {
      const downloaded = await downloadResult(resultUrl, outputDir);
      if (downloaded.markdown) {
        const result = await appendImageSizeInfo(downloaded.markdown, outputDir);
        markdown = result.markdown;
        imageMapping = result.imageMapping;
      } else if (downloaded.zipPath) {
        const extractDir = await extractMinerUZip(downloaded.zipPath, outputDir);
        const result = await materializeMinerUOutput(extractDir, outputDir);
        markdown = result.markdown;
        imageMapping = result.imageMapping;
      } else {
        throw new Error('MinerU response did not include markdown or downloadable result');
      }
    } else {
      throw new Error(
        `MinerU upload did not return markdown/result_url/task_id (status: ${created.taskStatus})`
      );
    }
  }

  const outputPath = path.join(outputDir, 'paper.md');
  await fs.writeFile(outputPath, markdown, 'utf8');

  const mappingPath = path.join(outputDir, 'image-mapping.json');
  await fs.writeFile(mappingPath, JSON.stringify(Object.fromEntries(imageMapping), null, 2));

  return {
    markdown,
    imageMapping,
    docPath: toRelativePath(outputPath)
  };
};
