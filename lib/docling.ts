import fs from 'fs/promises';
import path from 'path';
import { outputsDir, toRelativePath } from './storage';
import { getPrompt, renderTemplate } from './prompts';

const stubTemplate = () => {
  const template = getPrompt('docling-stub.md');
  if (!template) {
    throw new Error('Missing prompt: docling-stub.md');
  }
  return template;
};

const stubMarkdown = (fileName: string) =>
  renderTemplate(stubTemplate(), { filename: fileName });

export const convertPdfToMarkdown = async (pdfPath: string, jobId: string) => {
  const outputDir = outputsDir(jobId);
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'doc.md');

  let markdown: string;

  if (process.env.DOCLING_URL) {
    const buffer = await fs.readFile(pdfPath);
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('file', blob, path.basename(pdfPath));
    const controller = new AbortController();
    const timeoutMs = 30000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;

    try {
      response = await fetch(`${process.env.DOCLING_URL}/convert`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('fetch timeouted');
      }
      if (error instanceof Error) {
        const message = error.message?.trim() || 'unknown error';
        throw new Error(`Docling request failed: ${message}`);
      }
      throw new Error('Docling request failed: unknown error');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      throw new Error(`Docling failed: ${response.status}${statusText}`);
    }

    const data = await response.json();
    markdown = data.markdown ?? '';
  } else {
    markdown = stubMarkdown(path.basename(pdfPath));
  }

  await fs.writeFile(outputPath, markdown, 'utf8');

  return {
    markdown,
    docPath: toRelativePath(outputPath)
  };
};
