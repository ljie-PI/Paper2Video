import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', () => ({
  tool: (config: any) => config,
}));

vi.mock('zod', async () => {
  const actual = await vi.importActual('zod');
  return actual;
});

vi.mock('@/lib/docling', () => ({
  convertPdfToMarkdown: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { parsePdf } from '@/lib/tools/parse-pdf';
import { convertPdfToMarkdown } from '@/lib/docling';

const mockConvert = vi.mocked(convertPdfToMarkdown);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parsePdf', () => {
  it('has a description', () => {
    expect(parsePdf.description).toBeDefined();
  });

  it('returns markdown and image count on success', async () => {
    mockConvert.mockResolvedValue({
      markdown: '# Paper Title\n\nContent here',
      imageMapping: new Map([['fig1', '/images/fig1.png'], ['fig2', '/images/fig2.png']]),
      docPath: '/mock/doc.md',
    });

    const result = await parsePdf.execute(
      { pdfPath: '/mock/paper.pdf', sessionId: 'sess-1' },
      {} as any,
    );

    expect(result.success).toBe(true);
    expect(result.markdown).toBe('# Paper Title\n\nContent here');
    expect(result.imageCount).toBe(2);
    expect(result.docPath).toBe('/mock/doc.md');
    expect(result.message).toContain('PDF parsed successfully');
  });

  it('passes correct arguments to convertPdfToMarkdown', async () => {
    mockConvert.mockResolvedValue({
      markdown: 'content',
      imageMapping: new Map(),
      docPath: '/mock/doc.md',
    });

    await parsePdf.execute(
      { pdfPath: '/uploads/paper.pdf', sessionId: 'sess-42' },
      {} as any,
    );

    expect(mockConvert).toHaveBeenCalledWith('/uploads/paper.pdf', 'sess-42');
  });

  it('returns 0 imageCount when no images extracted', async () => {
    mockConvert.mockResolvedValue({
      markdown: 'text only',
      imageMapping: new Map(),
      docPath: '/mock/doc.md',
    });

    const result = await parsePdf.execute(
      { pdfPath: '/mock/paper.pdf', sessionId: 'sess-1' },
      {} as any,
    );

    expect(result.success).toBe(true);
    expect(result.imageCount).toBe(0);
  });

  it('handles undefined imageMapping gracefully', async () => {
    mockConvert.mockResolvedValue({
      markdown: 'text',
      imageMapping: undefined as any,
      docPath: '/mock/doc.md',
    });

    const result = await parsePdf.execute(
      { pdfPath: '/mock/paper.pdf', sessionId: 'sess-1' },
      {} as any,
    );

    expect(result.success).toBe(true);
    expect(result.imageCount).toBe(0);
  });

  it('returns error message on failure', async () => {
    mockConvert.mockRejectedValue(new Error('PDF parsing failed: invalid format'));

    const result = await parsePdf.execute(
      { pdfPath: '/mock/bad.pdf', sessionId: 'sess-1' },
      {} as any,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('PDF parsing failed: invalid format');
  });

  it('handles non-Error thrown values', async () => {
    mockConvert.mockRejectedValue('string error');

    const result = await parsePdf.execute(
      { pdfPath: '/mock/bad.pdf', sessionId: 'sess-1' },
      {} as any,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });

  it('includes character count in success message', async () => {
    const markdown = 'A'.repeat(500);
    mockConvert.mockResolvedValue({
      markdown,
      imageMapping: new Map([['fig1', '/img/fig1.png']]),
      docPath: '/mock/doc.md',
    });

    const result = await parsePdf.execute(
      { pdfPath: '/mock/paper.pdf', sessionId: 'sess-1' },
      {} as any,
    );

    expect(result.message).toContain('500');
    expect(result.message).toContain('1 images');
  });
});
