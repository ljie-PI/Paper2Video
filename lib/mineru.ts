import { promises as fs } from 'fs';
import path from 'path';
import extract from 'extract-zip';
import { outputsDir, toRelativePath } from './storage';
import { logger } from './logger';
import {
  MINERU_API_BASE,
  MINERU_REQUEST_TIMEOUT_MS,
  MINERU_POLL_INTERVAL_MS,
  MINERU_POLL_TIMEOUT_MS,
  MINERU_MODEL_VERSION,
} from '@/constants/mineru';
import { PNG_SIGNATURE } from '@/constants/mineru';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getApiKey = (): string => {
  const key = process.env.MINERU_API_KEY?.trim();
  if (!key) throw new Error('MINERU_API_KEY is not set');
  return key;
};

const authHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
});

// ─── HTTP helpers ──────────────────────────────────────────────

const requestJson = async <T>(
  url: string,
  options: RequestInit,
  timeoutMs = MINERU_REQUEST_TIMEOUT_MS
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`MinerU API error: ${response.status} ${text}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`MinerU request timed out: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

// ─── Step 1: Request upload URL ────────────────────────────────

type BatchUploadResponse = {
  code: number;
  msg: string;
  data: { batch_id: string; file_urls: string[] };
};

const requestUploadUrl = async (
  apiKey: string,
  fileName: string
): Promise<{ batchId: string; uploadUrl: string }> => {
  const data = await requestJson<BatchUploadResponse>(
    `${MINERU_API_BASE}/api/v4/file-urls/batch`,
    {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        files: [{ name: fileName }],
        model_version: MINERU_MODEL_VERSION,
        enable_formula: true,
        enable_table: true,
      }),
    }
  );

  if (data.code !== 0) {
    throw new Error(`MinerU upload URL request failed: ${data.msg}`);
  }

  if (!data.data?.batch_id || !data.data?.file_urls?.length) {
    throw new Error('MinerU response missing batch_id or file_urls');
  }

  return { batchId: data.data.batch_id, uploadUrl: data.data.file_urls[0] };
};

// ─── Step 2: Upload file ──────────────────────────────────────

const uploadFile = async (uploadUrl: string, filePath: string) => {
  const buffer = await fs.readFile(filePath);
  logger.debug(`[mineru] uploading file ${filePath}, size ${buffer.length} bytes`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MINERU_REQUEST_TIMEOUT_MS * 2);

  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: buffer,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`MinerU file upload failed: ${response.status}`);
    }
    logger.info(`[mineru] file uploaded successfully`);
  } finally {
    clearTimeout(timeout);
  }
};

// ─── Step 3: Poll for results ─────────────────────────────────

type BatchResultItem = {
  task_id: string;
  state: string;
  full_zip_url?: string;
  err_msg?: string;
};

type BatchResultResponse = {
  code: number;
  msg: string;
  data: { extract_result: BatchResultItem[] };
};

const pollBatchResult = async (
  apiKey: string,
  batchId: string
): Promise<string> => {
  const deadline = Date.now() + MINERU_POLL_TIMEOUT_MS;
  let lastState = 'pending';

  while (Date.now() < deadline) {
    const data = await requestJson<BatchResultResponse>(
      `${MINERU_API_BASE}/api/v4/extract-results/batch/${batchId}`,
      { method: 'GET', headers: authHeaders(apiKey) },
      20_000
    );

    if (data.code !== 0) {
      throw new Error(`MinerU poll error: ${data.msg}`);
    }

    const result = data.data?.extract_result?.[0];
    if (!result) {
      await delay(MINERU_POLL_INTERVAL_MS);
      continue;
    }

    lastState = result.state;
    logger.debug(`[mineru] batch ${batchId} state: ${lastState}`);

    if (lastState === 'done') {
      if (!result.full_zip_url) {
        throw new Error('MinerU task done but missing full_zip_url');
      }
      return result.full_zip_url;
    }

    if (lastState === 'failed') {
      throw new Error(`MinerU task failed: ${result.err_msg || 'unknown error'}`);
    }

    await delay(MINERU_POLL_INTERVAL_MS);
  }

  throw new Error(
    `MinerU polling timed out after ${MINERU_POLL_TIMEOUT_MS}ms (last state: ${lastState})`
  );
};

// ─── Step 4: Download and extract zip ─────────────────────────

const downloadZip = async (zipUrl: string, outputDir: string): Promise<string> => {
  const zipPath = path.join(outputDir, 'mineru.zip');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MINERU_REQUEST_TIMEOUT_MS * 3);

  try {
    const response = await fetch(zipUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`MinerU zip download failed: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(zipPath, buffer);
    logger.debug(`[mineru] downloaded zip to ${zipPath}, size ${buffer.length} bytes`);
    return zipPath;
  } finally {
    clearTimeout(timeout);
  }
};

const extractZip = async (zipPath: string, outputDir: string): Promise<string> => {
  const extractDir = path.join(outputDir, 'mineru-extract');
  await fs.mkdir(extractDir, { recursive: true });
  await extract(zipPath, { dir: extractDir });
  try {
    await fs.rm(zipPath, { force: true });
  } catch { /* ignore */ }
  return extractDir;
};

// ─── Step 5: Process extracted content ────────────────────────

const findFirstFile = async (
  rootDir: string,
  predicate: (name: string) => boolean
): Promise<string | null> => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFirstFile(fullPath, predicate);
      if (nested) return nested;
    } else if (entry.isFile() && predicate(entry.name)) {
      return fullPath;
    }
  }
  return null;
};

const findDirectory = async (
  rootDir: string,
  targetName: string
): Promise<string | null> => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === targetName) return fullPath;
      const nested = await findDirectory(fullPath, targetName);
      if (nested) return nested;
    }
  }
  return null;
};

const readPngDimensions = async (filePath: string) => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(24);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead < buffer.length) return null;
    if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
    if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
};

/**
 * Normalize MinerU image references to match the Docling format.
 *
 * MinerU outputs images in an `images/` dir with references like `![](images/xxx.jpg)`.
 * We copy them to `artifacts/` and rewrite references to `![image](artifacts/image_NNNNNN_hash.png)`.
 */
const materializeOutput = async (
  extractDir: string,
  outputDir: string
): Promise<{ markdown: string; imageMapping: Map<string, string> }> => {
  // Find the markdown file — MinerU names it full.md
  const markdownPath = await findFirstFile(extractDir, (name) =>
    name.toLowerCase().endsWith('.md')
  );
  if (!markdownPath) {
    throw new Error('MinerU output missing markdown file');
  }

  // Find images directory (could be 'images' or 'artifacts')
  const imagesDir =
    (await findDirectory(extractDir, 'images')) ??
    (await findDirectory(extractDir, 'artifacts'));

  // Copy images to output artifacts dir with normalized names
  const targetArtifacts = path.join(outputDir, 'artifacts');
  const imageMapping = new Map<string, string>();

  if (imagesDir) {
    await fs.rm(targetArtifacts, { recursive: true, force: true });
    await fs.mkdir(targetArtifacts, { recursive: true });

    const imageFiles = await fs.readdir(imagesDir);
    let index = 0;
    for (const file of imageFiles) {
      if (file.startsWith('.')) continue;
      const srcPath = path.join(imagesDir, file);
      const stat = await fs.stat(srcPath);
      if (!stat.isFile()) continue;

      const ext = path.extname(file).toLowerCase() || '.png';
      const paddedIndex = String(index).padStart(6, '0');
      // Keep original filename hash for uniqueness
      const baseName = path.basename(file, path.extname(file));
      const newName = `image_${paddedIndex}_${baseName}${ext}`;
      const destPath = path.join(targetArtifacts, newName);
      await fs.copyFile(srcPath, destPath);
      imageMapping.set(`artifacts/image_${paddedIndex}`, `artifacts/${newName}`);
      index++;
    }
  }

  let markdown = await fs.readFile(markdownPath, 'utf8');

  // Rewrite image references from MinerU format to Docling-compatible format
  // MinerU uses: ![](images/xxx.jpg) or ![some text](images/xxx.jpg)
  // We rewrite to: ![image](artifacts/image_NNNNNN_hash.ext)
  if (imagesDir) {
    const imagesBaseName = path.basename(imagesDir);
    const imageFiles = await fs.readdir(imagesDir);
    const sortedFiles = imageFiles.filter((f) => !f.startsWith('.')).sort();

    sortedFiles.forEach((file, index) => {
      const paddedIndex = String(index).padStart(6, '0');
      const baseName = path.basename(file, path.extname(file));
      const ext = path.extname(file).toLowerCase() || '.png';
      const newRef = `artifacts/image_${paddedIndex}_${baseName}${ext}`;

      // Replace both relative and full references
      const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `!\\[([^\\]]*)\\]\\((?:${imagesBaseName}/)?${escaped}\\)`,
        'g'
      );
      markdown = markdown.replace(pattern, `![image](${newRef})`);
    });
  }

  // Append image size info (same as Docling does)
  const imagePattern = /!\[image\]\((artifacts\/image_[^)]+\.(?:png|jpg|jpeg))\)/gi;
  const matches = Array.from(markdown.matchAll(imagePattern));
  const sizes = new Map<string, { width: number; height: number }>();

  await Promise.all(
    matches.map(async (match) => {
      const relativePath = match[1];
      if (sizes.has(relativePath)) return;
      const absolutePath = path.join(outputDir, relativePath);
      try {
        if (relativePath.toLowerCase().endsWith('.png')) {
          const size = await readPngDimensions(absolutePath);
          if (size) sizes.set(relativePath, size);
        }
      } catch {
        logger.warn(`[mineru] failed to read image size for ${relativePath}`);
      }
    })
  );

  // Rewrite with size info for PNG images
  markdown = markdown.replace(imagePattern, (fullMatch, relativePath: string) => {
    const size = sizes.get(relativePath);
    if (!size) return fullMatch;
    const prefixMatch = relativePath.match(/(artifacts\/image_\d+)/);
    const prefix = prefixMatch ? prefixMatch[1] : relativePath;
    return `![image_${size.width}_${size.height}](${prefix})`;
  });

  // Clean up extract dir
  try {
    await fs.rm(extractDir, { recursive: true, force: true });
  } catch { /* ignore */ }

  return { markdown, imageMapping };
};

// ─── Public API ───────────────────────────────────────────────

export const convertPdfToMarkdown = async (pdfPath: string, jobId: string) => {
  logger.info(`[mineru] convertPdfToMarkdown: processing PDF ${pdfPath} for job ${jobId}`);
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });

  const apiKey = getApiKey();
  const fileName = path.basename(pdfPath);

  // Step 1: Request upload URL
  logger.info(`[mineru] requesting upload URL for ${fileName}`);
  const { batchId, uploadUrl } = await requestUploadUrl(apiKey, fileName);

  // Step 2: Upload file
  logger.info(`[mineru] uploading file to pre-signed URL`);
  await uploadFile(uploadUrl, pdfPath);

  // Step 3: Poll for results
  logger.info(`[mineru] polling batch ${batchId} for results`);
  const zipUrl = await pollBatchResult(apiKey, batchId);

  // Step 4: Download and extract zip
  logger.info(`[mineru] downloading result zip`);
  const zipPath = await downloadZip(zipUrl, outputDir);
  const extractDir = await extractZip(zipPath, outputDir);

  // Step 5: Process output
  const { markdown, imageMapping } = await materializeOutput(extractDir, outputDir);

  // Write output files
  const outputPath = path.join(outputDir, 'paper.md');
  await fs.writeFile(outputPath, markdown, 'utf8');

  const mappingPath = path.join(outputDir, 'image-mapping.json');
  await fs.writeFile(
    mappingPath,
    JSON.stringify(Object.fromEntries(imageMapping), null, 2)
  );

  return {
    markdown,
    imageMapping,
    docPath: toRelativePath(outputPath),
  };
};
