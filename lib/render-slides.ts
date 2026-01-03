import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import type { JobConfig, Slide, SlideImage, SlidesJSON } from './types';
import { getPrompt, renderTemplate } from './prompts';
import { logger } from './logger';
import { requestLlmText } from './llm';
import { outputsDir, toRelativePath } from './storage';
import {
  DEFAULT_STYLE,
  LAYOUT_SCHEMAS,
  REVEAL_DIST,
  SHARED_REVEAL_DIST,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  STYLES_DIR,
  TEMPLATE_PATH
} from '@/constants/render-slides';

type RenderedSlide = {
  index: number;
  title: string;
  htmlPath: string;
  layout: string;
};

type RenderedSlidesResult = {
  manifestPath: string;
  pdfPath: string;
  images: string[];
};

const resolveImageSrc = (image: SlideImage, baseDir: string) => {
  const absolutePath = path.isAbsolute(image.path)
    ? image.path
    : path.join(baseDir, image.path);
  return {
    src: pathToFileURL(absolutePath).toString(),
    width: image.width,
    height: image.height
  };
};

const stripCodeFence = (text: string) => {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
};

const sanitizeHtml = (text: string) => {
  const stripped = stripCodeFence(text);
  return stripped.replace(/<\/?(html|body)[^>]*>/gi, '').trim();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const ensureSharedRevealDist = async () => {
  try {
    await fs.access(SHARED_REVEAL_DIST);
    return;
  } catch {
    // Create shared reveal dist once.
  }

  await fs.mkdir(path.dirname(SHARED_REVEAL_DIST), { recursive: true });
  try {
    await fs.cp(REVEAL_DIST, SHARED_REVEAL_DIST, { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code !== 'EEXIST' && code !== 'ENOTEMPTY') {
      throw error;
    }
  }
};

const buildUserPrompt = (
  slide: Slide,
  images: SlideImage[],
  baseDir: string
) => {
  const payload = {
    title: slide.title,
    text_contents: slide.text_contents,
    tables: slide.tables,
    images: images.map((image) => resolveImageSrc(image, baseDir)),
    canvas: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT }
  };
  return `Slide data (JSON):\n${JSON.stringify(payload, null, 2)}`;
};

const extractJson = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
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

const renderLayoutTemplate = async (
  layoutId: string,
  slots: Record<string, unknown>
) => {
  const schema = LAYOUT_SCHEMAS[layoutId];
  if (!schema) {
    throw new Error(`Unknown layout template "${layoutId}".`);
  }
  const templatePath = path.join(
    process.cwd(),
    'lib',
    'templates',
    'reveal',
    'layouts',
    schema.templateFile
  );
  const template = await fs.readFile(templatePath, 'utf8');
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key) => {
    const value = resolvePath(slots, key);
    return value === undefined || value === null ? '' : String(value);
  });
};

const generateSlideHtml = async (
  slide: Slide,
  config: JobConfig,
  systemPrompt: string,
  baseDir: string,
  slideIndex: number,
  outputDir: string
): Promise<{ html: string; layout: string }> => {
  // Check LLM cache for layout and slots
  const llmCachePath = path.join(outputDir, 'llm-cache', `slide-${slideIndex}.json`);
  let layout: string | undefined;
  let slots: Record<string, unknown> | undefined;

  if (process.env.USE_LLM_CACHE?.toLowerCase() === 'true') {
    try {
      const cached = JSON.parse(await fs.readFile(llmCachePath, 'utf8'));
      layout = cached.layout;
      slots = cached.slots;
      logger.debug(`[render-slides] slide ${slideIndex + 1}: using cached LLM result`);
    } catch {
      logger.debug(`[render-slides] slide ${slideIndex + 1}: cache miss`);
    }
  }

  // Generate layout and slots if not cached
  if (!layout || !slots) {
    const userPrompt = buildUserPrompt(slide, slide.images ?? [], baseDir);
    const responseText = await requestLlmText({
      model: config.model?.trim() ?? null,
      systemPrompt,
      userPrompt
    });

    if (!responseText) {
      throw new Error('LLM returned empty HTML for slide layout.');
    }

    const json = extractJson(responseText);
    const parsed = JSON.parse(json) as {
      layout?: unknown;
      slots?: unknown;
    };

    const layoutName =
      typeof parsed.layout === 'string' ? parsed.layout.toLowerCase().trim() : '';
    logger.debug(`[render-slides] selected layout: ${layoutName}`);
    const schema = layoutName ? LAYOUT_SCHEMAS[layoutName] : null;
    if (!schema) {
      throw new Error(
        `Missing or unknown layout template "${layoutName || 'unknown'}".`
      );
    }

    const rawSlots =
      parsed.slots && typeof parsed.slots === 'object'
        ? (parsed.slots as Record<string, unknown>)
        : {};
    slots = {};
    for (const slot of schema.slots) {
      const rawValue = rawSlots[slot.name];
      if (slot.kind === 'image') {
        if (!rawValue || typeof rawValue !== 'object') {
          if (slot.required) {
            throw new Error(
              `Layout "${schema.id}" requires slot "${slot.name}".`
            );
          }
          slots[slot.name] = null;
          continue;
        }
        const rawImage = rawValue as {
          path?: unknown;
          width?: unknown;
          height?: unknown;
          caption?: unknown;
        };
        const imagePath = typeof rawImage.path === 'string' ? rawImage.path.trim() : '';
        const width = Number(rawImage.width);
        const height = Number(rawImage.height);
        const caption =
          typeof rawImage.caption === 'string' ? rawImage.caption.trim() : '';
        if (!imagePath || !Number.isFinite(width) || !Number.isFinite(height)) {
          throw new Error(
            `Layout "${schema.id}" requires image slot "${slot.name}" with path, width, height.`
          );
        }
        slots[slot.name] = {
          path: imagePath,
          width: Math.round(width),
          height: Math.round(height),
          caption: caption ? escapeHtml(caption) : ''
        };
        continue;
      }

      const value =
        rawValue === undefined || rawValue === null
          ? ''
          : typeof rawValue === 'string'
            ? rawValue
            : String(rawValue);

      if (slot.required && !value.trim()) {
        throw new Error(
          `Layout "${schema.id}" requires slot "${slot.name}".`
        );
      }

      slots[slot.name] =
        slot.kind === 'text' ? escapeHtml(value.trim()) : sanitizeHtml(value);
    }

    layout = schema.id;

    // Save to cache
    if (process.env.USE_LLM_CACHE?.toLowerCase() === 'true') {
      await fs.mkdir(path.dirname(llmCachePath), { recursive: true });
      await fs.writeFile(llmCachePath, JSON.stringify({ layout, slots }, null, 2), 'utf8');
      logger.debug(`[render-slides] slide ${slideIndex + 1}: cached LLM result`);
    }
  }

  // Load schema and render HTML from cached layout and slots
  const schema = layout ? LAYOUT_SCHEMAS[layout] : null;
  if (!schema) {
    throw new Error(`Missing or unknown layout template "${layout || 'unknown'}".`);
  }

  const html = await renderLayoutTemplate(schema.id, slots);
  return { html, layout };
};

const buildDeckHtml = async (sections: string[], styleName: string) => {
  const revealBaseUrl = pathToFileURL(SHARED_REVEAL_DIST)
    .toString()
    .replace(/\/?$/, '/');
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  return template
    .replace(/{{revealCss}}/g, `${revealBaseUrl}reveal.css`)
    .replace(/{{revealThemeCss}}/g, `${revealBaseUrl}theme/white.css`)
    .replace(/{{revealPdfCss}}/g, `${revealBaseUrl}print/pdf.css`)
    .replace(/{{revealJs}}/g, `${revealBaseUrl}reveal.js`)
    .replace(/{{layoutCss}}/g, `./styles/layout.css`)
    .replace(/{{styleCss}}/g, `./styles/${styleName}.css`)
    .replace(/{{width}}/g, String(SLIDE_WIDTH))
    .replace(/{{height}}/g, String(SLIDE_HEIGHT))
    .replace(/{{sections}}/g, sections.join('\n'));
};

const renderDeckAssets = async (deckPath: string, outputDir: string) => {
  const imagesDir = path.join(outputDir, 'slides-images');
  await fs.rm(imagesDir, { recursive: true, force: true });
  await fs.mkdir(imagesDir, { recursive: true });

  const pdfPath = path.join(outputDir, 'slides.pdf');

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: SLIDE_WIDTH, height: SLIDE_HEIGHT });

  const deckUrl = pathToFileURL(deckPath).toString();
  await page.goto(deckUrl, { waitUntil: 'networkidle0' });
  await page.waitForFunction(
    () => (window as typeof window & { Reveal?: { isReady: () => boolean } }).Reveal?.isReady?.()
  );

  await page.evaluate(() => {
    document.documentElement.classList.add('export-images');
  });

  await page.evaluate(() => {
    const reveal = (window as typeof window & {
      Reveal?: { configure: (config: unknown) => void };
    }).Reveal;
    reveal?.configure?.({ transition: 'none', backgroundTransition: 'none' });
  });

  const slideIndices = await page.evaluate(() => {
    const reveal = (window as typeof window & {
      Reveal?: {
        getSlides?: () => HTMLElement[];
        getIndices?: (slide: HTMLElement) => { h: number; v?: number; f?: number };
      };
    }).Reveal;
    const getSlides = reveal?.getSlides;
    const getIndices = reveal?.getIndices;
    if (!getSlides || !getIndices) return [];
    return getSlides().map((slide) => getIndices(slide));
  });

  if (!slideIndices.length) {
    await browser.close();
    throw new Error('Reveal did not return any slides to render.');
  }

  const images: string[] = [];
  for (let index = 0; index < slideIndices.length; index += 1) {
    const target = slideIndices[index];
    await page.evaluate((indices) => {
      (window as typeof window & { Reveal?: { slide: (h: number, v?: number, f?: number) => void } })
        .Reveal?.slide?.(indices.h, indices.v, indices.f);
    }, target);

    await new Promise((resolve) => setTimeout(resolve, 100));
    const imagePath = path.join(
      imagesDir,
      `slide-${String(index + 1).padStart(3, '0')}.png`
    );
    await page.screenshot({
      path: imagePath,
      clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT }
    });
    images.push(toRelativePath(imagePath));
  }

  const pdfUrl = `${deckUrl}?print-pdf`;
  await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
  await page.waitForFunction(
    () => (window as typeof window & { Reveal?: { isReady: () => boolean } }).Reveal?.isReady?.()
  );
  await page.emulateMediaType('screen');
  await page.pdf({
    path: pdfPath,
    printBackground: true,
    width: `${SLIDE_WIDTH}px`,
    height: `${SLIDE_HEIGHT}px`
  });
  await browser.close();

  return {
    pdfPath: toRelativePath(pdfPath),
    images
  };
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    runWorker()
  );
  await Promise.all(workers);
  return results;
};

export const renderSlides = async (
  slides: SlidesJSON,
  jobId: string,
  config: JobConfig
): Promise<RenderedSlidesResult> => {
  const outputDir = outputsDir(jobId);
  const renderDir = path.join(outputDir, 'rendered-slides');
  await fs.mkdir(renderDir, { recursive: true });

  const promptTemplate = getPrompt('render-slide.md');
  if (!promptTemplate) {
    throw new Error('Missing prompt render-slide.md.');
  }

  try {
    await fs.access(TEMPLATE_PATH);
  } catch {
    throw new Error('Missing Reveal.js deck template.');
  }

  try {
    await fs.access(REVEAL_DIST);
  } catch {
    throw new Error('Reveal.js not installed. Run bun install.');
  }

  await ensureSharedRevealDist();

  const languageHints = { zh: 'Chinese.', en: 'English.' } as const;
  const languageHint = config.outputLanguage
    ? languageHints[config.outputLanguage]
    : '';
  const systemPrompt = renderTemplate(promptTemplate, { languageHint });

  const renderConcurrency = Math.max(
    1,
    Number.parseInt(process.env.RENDER_SLIDES_CONCURRENCY ?? '1', 10) || 1
  );
  const results = await runWithConcurrency(
    slides.slides,
    renderConcurrency,
    async (slide, index) => {
      logger.info(`[render-slides] rendering slide ${index + 1}`);
      const start = Date.now();
      const selection = await generateSlideHtml(
        slide,
        config,
        systemPrompt,
        outputDir,
        index,
        outputDir
      );
      logger.debug(
        `[render-slides] generateSlideHtml ${index + 1} took ${Date.now() - start}ms`
      );
      const baseName = `slide-${String(index + 1).padStart(3, '0')}`;
      const htmlPath = path.join(renderDir, `${baseName}.html`);
      await fs.writeFile(htmlPath, selection.html, 'utf8');
      return {
        sectionHtml: selection.html,
        rendered: {
          index,
          title: slide.title,
          htmlPath: toRelativePath(htmlPath),
          layout: selection.layout
        }
      };
    }
  );

  const rendered: RenderedSlide[] = results.map((result) => result.rendered);
  const sections = results.map((result) => result.sectionHtml);
  const styleName = DEFAULT_STYLE;
  const stylePath = path.join(STYLES_DIR, `${styleName}.css`);
  try {
    await fs.access(stylePath);
  } catch {
    throw new Error(`Unknown slide style "${styleName}".`);
  }

  await fs.mkdir(path.join(renderDir, 'styles'), { recursive: true });
  await fs.copyFile(stylePath, path.join(renderDir, 'styles', `${styleName}.css`));
  const layoutCssPath = path.join(STYLES_DIR, 'layout.css');
  await fs.copyFile(layoutCssPath, path.join(renderDir, 'styles', 'layout.css'));

  const deckPath = path.join(renderDir, 'slides.html');
  await fs.writeFile(deckPath, await buildDeckHtml(sections, styleName), 'utf8');

  const manifestPath = path.join(renderDir, 'rendered-slides.json');
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        slides: rendered,
        deck: toRelativePath(deckPath),
        style: styleName,
        layouts: Object.keys(LAYOUT_SCHEMAS)
      },
      null,
      2
    )
  );
  logger.debug(`[render-slides] wrote manifest at ${manifestPath}`);

  const assets = await renderDeckAssets(deckPath, outputDir);
  logger.debug(`[render-slides] rendered PDF at ${assets.pdfPath}`);
  logger.debug(
    `[render-slides] rendered ${assets.images.length} slide images`
  );

  return {
    manifestPath: toRelativePath(manifestPath),
    pdfPath: assets.pdfPath,
    images: assets.images
  };
};
