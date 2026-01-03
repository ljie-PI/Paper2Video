import { promises as fs } from 'fs';
import path from 'path';
import extract from 'extract-zip';
import { outputsDir, toRelativePath } from './storage';
import { logger } from './logger';
import { getPrompt, renderTemplate } from './prompts';
import {
  DOC_POLL_INTERVAL_MS,
  DOC_POLL_TIMEOUT_MS,
  DOC_REQUEST_TIMEOUT_MS,
  PNG_SIGNATURE
} from '@/constants/docling';

const stubTemplate = () => {
  const template = getPrompt('docling-stub.md');
  if (!template) {
    throw new Error('Missing prompt: docling-stub.md');
  }
  return template;
};

const stubMarkdown = (fileName: string) =>
  renderTemplate(stubTemplate(), { filename: fileName });

const normalizeDoclingUrl = (baseUrl: string) => baseUrl.replace(/\/$/, '');

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
    // Extract prefix: artifacts/image_000005 from artifacts/image_000005_longhash.png
    // Too long image path may be modified by LLM, so only pass short path to LLM
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
          logger.warn(`[docling] unable to read image size for ${relativePath}`);
        }
      } catch (error) {
        logger.warn(`[docling] failed to read image ${relativePath}`, error);
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
  timeoutMs = DOC_REQUEST_TIMEOUT_MS
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
      throw new Error(
        `Docling failed: ${response.status}${statusText} (${safeUrl})`
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Docling request timed out: ${safeUrl}`);
    }
    if (error instanceof Error) {
      const message = sanitizeUrlMessage(
        error.message?.trim() || 'unknown error'
      );
      throw new Error(`Docling request failed (${safeUrl}): ${message}`);
    }
    throw new Error(`Docling request failed (${safeUrl}): unknown error`);
  } finally {
    clearTimeout(timeout);
  }
};

const createDoclingTask = async (doclingUrl: string, pdfPath: string) => {
  const buffer = await fs.readFile(pdfPath);
  logger.debug(
    `[docling] read PDF file ${pdfPath}, size ${buffer.length} bytes`
  );

  const formData = new FormData();
  formData.append(
    'files',
    new Blob([buffer], { type: 'application/pdf' }),
    path.basename(pdfPath)
  );
  formData.append('target_type', 'zip');
  // formData.append('to_formats', 'md');
  formData.append('image_export_mode', 'referenced');
  formData.append('ocr_engine', 'tesseract');
  formData.append('ocr_lang', 'eng,fra,deu,spa');

  const data = await requestJson<{ task_id?: string; task_status?: string }>(
    `${doclingUrl}/v1/convert/file/async`,
    {
      method: 'POST',
      body: formData
    }
  );
  logger.debug('[docling] create task response', data);

  if (!data.task_id) {
    throw new Error('Docling response missing task_id');
  }

  return { taskId: data.task_id, taskStatus: data.task_status ?? 'unknown' };
};

const pollDoclingTask = async (doclingUrl: string, taskId: string) => {
  const deadline = Date.now() + DOC_POLL_TIMEOUT_MS;
  let lastStatus = 'unknown';

  while (Date.now() < deadline) {
    const data = await requestJson<{ task_status?: string }>(
      `${doclingUrl}/v1/status/poll/${taskId}`,
      { method: 'GET' },
      20000
    );
    logger.debug(`[docling] task ${taskId} status data`, data);

    lastStatus = data.task_status ?? 'unknown';

    if (lastStatus === 'success' || lastStatus === 'completed') {
      return lastStatus;
    }

    if (
      lastStatus === 'failed' ||
      lastStatus === 'error' ||
      lastStatus === 'canceled'
    ) {
      throw new Error(`Docling task ${taskId} failed: ${lastStatus}`);
    }

    await delay(DOC_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Docling task ${taskId} polling timed out after ${DOC_POLL_TIMEOUT_MS}ms (last status ${lastStatus})`
  );
};

const fetchDoclingResult = async (
  doclingUrl: string,
  taskId: string,
  outputDir: string
) => {
  const resolvedUrl = `${doclingUrl}/v1/result/${taskId}`;
  const safeResolvedUrl = urlToPath(resolvedUrl);
  const zipPath = path.join(outputDir, 'docling.zip');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOC_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(resolvedUrl, { signal: controller.signal });
    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      throw new Error(
        `Docling zip download failed: ${response.status}${statusText} (${safeResolvedUrl})`
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(zipPath, buffer);
    logger.debug(`[docling] downloaded zip file to ${zipPath}, size ${buffer.length} bytes`);
    return zipPath;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Docling zip download timed out: ${safeResolvedUrl}`);
    }
    if (error instanceof Error) {
      const message = sanitizeUrlMessage(
        error.message?.trim() || 'unknown error'
      );
      throw new Error(`Docling zip download failed (${safeResolvedUrl}): ${message}`);
    }
    throw new Error(
      `Docling zip download failed (${safeResolvedUrl}): unknown error`
    );
  } finally {
    clearTimeout(timeout);
  }
};

const extractDoclingZip = async (zipPath: string, outputDir: string) => {
  const extractDir = path.join(outputDir, 'docling-extract');
  await fs.mkdir(extractDir, { recursive: true });

  await extract(zipPath, { dir: extractDir });
  try {
    await fs.rm(zipPath, { force: true });
    logger.debug(`[docling] removed zip file ${zipPath} after extraction`);
  } catch (error) {
    logger.warn(
      `[docling] failed to remove zip file ${zipPath} after extraction`,
      error
    );
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

const materializeDoclingOutput = async (
  extractDir: string,
  outputDir: string
): Promise<{ markdown: string; imageMapping: Map<string, string> }> => {
  const markdownPath = await findFirstMarkdown(extractDir);
  if (!markdownPath) {
    throw new Error('Docling output missing markdown file');
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
    logger.debug(`[docling] removed extract dir ${extractDir} after materialization`);
  } catch (error) {
    logger.warn(
      `[docling] failed to remove extract dir ${extractDir} after materialization`,
      error
    );
  }
  logger.debug(
    `[docling] materialized output from ${extractDir}, output to ${outputDir}`
  );
  const result = await appendImageSizeInfo(markdown, outputDir);
  return result;
};

export const convertPdfToMarkdown = async (pdfPath: string, jobId: string) => {
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });

  let markdown: string;
  let imageMapping: Map<string, string> = new Map();

  if (process.env.DOCLING_URL) {
    const doclingUrl = normalizeDoclingUrl(process.env.DOCLING_URL);
    const { taskId } = await createDoclingTask(doclingUrl, pdfPath);
    await pollDoclingTask(doclingUrl, taskId);
    const zipPath = await fetchDoclingResult(doclingUrl, taskId, outputDir);
    const extractDir = await extractDoclingZip(zipPath, outputDir);
    const result = await materializeDoclingOutput(extractDir, outputDir);
    markdown = result.markdown;
    imageMapping = result.imageMapping;
  } else {
    markdown = stubMarkdown(path.basename(pdfPath));
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
