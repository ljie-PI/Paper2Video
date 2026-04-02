import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// ─── Mocks ────────────────────────────────────────────────────

vi.mock('extract-zip', () => ({ default: vi.fn() }));
vi.mock('@/lib/storage', () => ({
  storageRoot: '/mock/storage',
  outputsDir: (jobId: string) => `/mock/storage/outputs/${jobId}`,
  toRelativePath: (p: string) => p.replace('/mock/cwd/', ''),
}));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/constants/mineru', () => ({
  MINERU_API_BASE: 'https://mineru.net',
  MINERU_REQUEST_TIMEOUT_MS: 30_000,
  MINERU_POLL_INTERVAL_MS: 10,
  MINERU_POLL_TIMEOUT_MS: 600_000,
  MINERU_MODEL_VERSION: 'vlm',
}));

// Mock fs/promises
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockRm = vi.fn().mockResolvedValue(undefined);
const mockCopyFile = vi.fn().mockResolvedValue(undefined);
const mockOpen = vi.fn();

vi.mock('fs', () => {
  const mockFs = {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    stat: (...args: unknown[]) => mockStat(...args),
    rm: (...args: unknown[]) => mockRm(...args),
    copyFile: (...args: unknown[]) => mockCopyFile(...args),
    open: (...args: unknown[]) => mockOpen(...args),
  };
  return {
    default: { promises: mockFs },
    promises: mockFs,
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────

const BATCH_ID = 'batch-abc-123';
const UPLOAD_URL = 'https://mineru.oss-cn-shanghai.aliyuncs.com/upload/test';
const ZIP_URL = 'https://cdn-mineru.openxlab.org.cn/pdf/result.zip';
const FAKE_PDF_BUFFER = Buffer.from('fake-pdf-content');
const FAKE_ZIP_BUFFER = Buffer.from('fake-zip-content');
const FAKE_MARKDOWN = '# Test Paper\n\nSome content\n\n![](images/fig1.png)\n\n![alt text](images/fig2.jpg)\n';

const makeUploadUrlResponse = () => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({
    code: 0,
    msg: 'ok',
    data: { batch_id: BATCH_ID, file_urls: [UPLOAD_URL] },
  }),
  text: () => Promise.resolve(''),
});

const makeUploadResponse = () => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(''),
});

const makePollPendingResponse = () => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({
    code: 0,
    msg: 'ok',
    data: { extract_result: [{ task_id: 'task-1', state: 'running' }] },
  }),
  text: () => Promise.resolve(''),
});

const makePollDoneResponse = () => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({
    code: 0,
    msg: 'ok',
    data: {
      extract_result: [{
        task_id: 'task-1',
        state: 'done',
        full_zip_url: ZIP_URL,
      }],
    },
  }),
  text: () => Promise.resolve(''),
});

const makePollFailedResponse = (errMsg = 'parse error') => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({
    code: 0,
    msg: 'ok',
    data: {
      extract_result: [{
        task_id: 'task-1',
        state: 'failed',
        err_msg: errMsg,
      }],
    },
  }),
  text: () => Promise.resolve(''),
});

const makeZipDownloadResponse = () => ({
  ok: true,
  status: 200,
  arrayBuffer: () => Promise.resolve(FAKE_ZIP_BUFFER.buffer.slice(
    FAKE_ZIP_BUFFER.byteOffset,
    FAKE_ZIP_BUFFER.byteOffset + FAKE_ZIP_BUFFER.byteLength
  )),
  text: () => Promise.resolve(''),
});

// Setup fs mocks for the materialize phase
const setupFsForMaterialize = (markdownContent = FAKE_MARKDOWN) => {
  // readFile: return PDF buffer for upload, markdown for extraction
  mockReadFile.mockImplementation((filePath: string) => {
    if (filePath.endsWith('.pdf')) return Promise.resolve(FAKE_PDF_BUFFER);
    if (filePath.endsWith('.md')) return Promise.resolve(markdownContent);
    return Promise.reject(new Error(`Unexpected readFile: ${filePath}`));
  });

  // readdir: simulate extracted directory structure
  mockReaddir.mockImplementation((dirPath: string, options?: { withFileTypes?: boolean }) => {
    const dirStr = String(dirPath);
    if (options?.withFileTypes) {
      // For findFirstFile and findDirectory traversal
      if (dirStr.includes('mineru-extract') && !dirStr.includes('images') && !dirStr.includes('artifacts')) {
        // Root of extracted dir: contains a subdirectory and full.md
        return Promise.resolve([
          { name: 'full.md', isFile: () => true, isDirectory: () => false },
          { name: 'images', isFile: () => false, isDirectory: () => true },
        ]);
      }
      return Promise.resolve([]);
    }
    // Non-withFileTypes readdir — for listing image files
    if (dirStr.includes('images')) {
      return Promise.resolve(['fig1.png', 'fig2.jpg']);
    }
    return Promise.resolve([]);
  });

  mockStat.mockResolvedValue({ isFile: () => true });
};

// ─── Tests ────────────────────────────────────────────────────

describe('lib/mineru', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Re-set default implementations cleared by clearAllMocks
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
    process.env.MINERU_API_KEY = 'test-api-key-123';
    // Mock process.cwd for toRelativePath
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('convertPdfToMarkdown', () => {
    it('throws when MINERU_API_KEY is not set', async () => {
      delete process.env.MINERU_API_KEY;
      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await expect(
        convertPdfToMarkdown('/path/to/test.pdf', 'job-1')
      ).rejects.toThrow('MINERU_API_KEY is not set');
    });

    it('throws when upload URL request returns non-zero code', async () => {
      mockReadFile.mockResolvedValue(FAKE_PDF_BUFFER);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 1, msg: 'invalid token' }),
        text: () => Promise.resolve(''),
      });

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await expect(
        convertPdfToMarkdown('/path/to/test.pdf', 'job-1')
      ).rejects.toThrow('upload URL request failed: invalid token');
    });

    it('throws when upload URL response is missing batch_id', async () => {
      mockReadFile.mockResolvedValue(FAKE_PDF_BUFFER);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 0, msg: 'ok', data: {} }),
        text: () => Promise.resolve(''),
      });

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await expect(
        convertPdfToMarkdown('/path/to/test.pdf', 'job-1')
      ).rejects.toThrow('missing batch_id or file_urls');
    });

    it('throws when file upload returns non-ok status', async () => {
      mockReadFile.mockResolvedValue(FAKE_PDF_BUFFER);
      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, text: () => Promise.resolve('') });

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await expect(
        convertPdfToMarkdown('/path/to/test.pdf', 'job-1')
      ).rejects.toThrow('file upload failed: 403');
    });

    it('throws when MinerU task fails', async () => {
      mockReadFile.mockResolvedValue(FAKE_PDF_BUFFER);
      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollFailedResponse('unsupported format'));

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await expect(
        convertPdfToMarkdown('/path/to/test.pdf', 'job-1')
      ).rejects.toThrow('MinerU task failed: unsupported format');
    });

    it('throws when zip download fails', async () => {
      mockReadFile.mockResolvedValue(FAKE_PDF_BUFFER);
      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('') });

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await expect(
        convertPdfToMarkdown('/path/to/test.pdf', 'job-1')
      ).rejects.toThrow('zip download failed: 500');
    });

    it('completes full flow and returns correct structure', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // Verify return structure matches Docling format
      expect(result).toHaveProperty('markdown');
      expect(result).toHaveProperty('imageMapping');
      expect(result).toHaveProperty('docPath');
      expect(typeof result.markdown).toBe('string');
      expect(result.imageMapping).toBeInstanceOf(Map);
      expect(typeof result.docPath).toBe('string');
    });

    it('polls multiple times before getting done state', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollPendingResponse())
        .mockResolvedValueOnce(makePollPendingResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      expect(result).toHaveProperty('markdown');
      // Verify poll was called 3 times (2 pending + 1 done)
      // calls: uploadUrl, upload, poll1, poll2, poll3, zipDownload = 6
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    it('sends correct Authorization header', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // Check first call (upload URL request) has auth header
      const firstCallOptions = mockFetch.mock.calls[0][1];
      expect(firstCallOptions.headers).toHaveProperty('Authorization', 'Bearer test-api-key-123');
    });

    it('sends correct model_version in upload URL request', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model_version).toBe('vlm');
      expect(body.files).toEqual([{ name: 'test.pdf' }]);
      expect(body.enable_formula).toBe(true);
      expect(body.enable_table).toBe(true);
    });

    it('uploads file via PUT to the pre-signed URL', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // Second fetch call is the file upload
      const uploadCall = mockFetch.mock.calls[1];
      expect(uploadCall[0]).toBe(UPLOAD_URL);
      expect(uploadCall[1].method).toBe('PUT');
    });

    it('writes paper.md and image-mapping.json to output dir', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // Verify paper.md was written
      const writeFileCalls = mockWriteFile.mock.calls;
      const paperMdCall = writeFileCalls.find(
        (call: unknown[]) => String(call[0]).endsWith('paper.md')
      );
      expect(paperMdCall).toBeDefined();

      // Verify image-mapping.json was written
      const imageMappingCall = writeFileCalls.find(
        (call: unknown[]) => String(call[0]).endsWith('image-mapping.json')
      );
      expect(imageMappingCall).toBeDefined();
      const mapping = JSON.parse(imageMappingCall![1] as string);
      expect(typeof mapping).toBe('object');
    });

    it('rewrites MinerU image paths to Docling-compatible format', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);

      const mineruMarkdown = '# Paper\n\n![](images/fig1.png)\n\nSome text\n\n![caption](images/fig2.jpg)\n';
      setupFsForMaterialize(mineruMarkdown);

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // Image references should be rewritten to artifacts/ format
      expect(result.markdown).toContain('artifacts/');
      expect(result.markdown).not.toContain('images/fig1.png');
      expect(result.markdown).not.toContain('images/fig2.jpg');
    });

    it('generates correct imageMapping with short prefix keys', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // imageMapping keys should be short prefix like "artifacts/image_000000"
      for (const key of result.imageMapping.keys()) {
        expect(key).toMatch(/^artifacts\/image_\d+$/);
      }
      // Values should be full paths
      for (const value of result.imageMapping.values()) {
        expect(value).toMatch(/^artifacts\/image_\d+_/);
      }
    });

    it('creates output directory recursively', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('outputs'),
        { recursive: true }
      );
    });

    it('handles markdown without images', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);

      const noImageMarkdown = '# Simple Paper\n\nJust text content here.\n';
      mockReadFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('.pdf')) return Promise.resolve(FAKE_PDF_BUFFER);
        if (filePath.endsWith('.md')) return Promise.resolve(noImageMarkdown);
        return Promise.reject(new Error(`Unexpected readFile: ${filePath}`));
      });
      mockReaddir.mockImplementation((_dirPath: string, options?: { withFileTypes?: boolean }) => {
        if (options?.withFileTypes) {
          return Promise.resolve([
            { name: 'full.md', isFile: () => true, isDirectory: () => false },
          ]);
        }
        return Promise.resolve([]);
      });

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      expect(result.markdown).toBe(noImageMarkdown);
      expect(result.imageMapping.size).toBe(0);
    });

    it('cleans up zip file and extract dir after processing', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // rm should be called for zip file and extract dir cleanup
      const rmCalls = mockRm.mock.calls.map((call: unknown[]) => String(call[0]));
      const hasZipCleanup = rmCalls.some((p: string) => p.includes('mineru.zip'));
      const hasExtractDirCleanup = rmCalls.some((p: string) => p.includes('mineru-extract'));
      expect(hasZipCleanup || hasExtractDirCleanup).toBe(true);
    });

    it('docPath is a relative path', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      expect(result.docPath).toContain('paper.md');
      // Should not be an absolute path
      expect(result.docPath).not.toMatch(/^[A-Z]:\\/i);
      expect(result.docPath).not.toMatch(/^\//);
    });
  });

  describe('return format compatibility with Docling', () => {
    it('returns { markdown: string, imageMapping: Map, docPath: string } — same as Docling', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // Exact shape check matching Docling's return type
      const keys = Object.keys(result).sort();
      expect(keys).toEqual(['docPath', 'imageMapping', 'markdown']);

      // Type checks
      expect(typeof result.markdown).toBe('string');
      expect(result.imageMapping instanceof Map).toBe(true);
      expect(typeof result.docPath).toBe('string');

      // docPath ends with paper.md
      expect(result.docPath).toMatch(/paper\.md$/);
    });

    it('imageMapping uses same key format as Docling (artifacts/image_NNNNNN)', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // Docling format: key = "artifacts/image_000000", value = "artifacts/image_000000_hash.ext"
      for (const [key, value] of result.imageMapping.entries()) {
        expect(key).toMatch(/^artifacts\/image_\d{6}$/);
        expect(value).toMatch(/^artifacts\/image_\d{6}_/);
        // Value should start with key prefix
        expect(value.startsWith(key)).toBe(true);
      }
    });

    it('markdown image references use ![image](artifacts/...) format', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      const result = await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // All image refs should use artifacts/ path, matching Docling output
      const imageRefs = Array.from(result.markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g));
      for (const match of imageRefs) {
        const imgPath = match[2];
        expect(imgPath).toMatch(/^artifacts\//);
      }
    });

    it('images are copied to artifacts/ directory, not images/', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      // copyFile should copy to artifacts/ dir
      const copyFileDests = mockCopyFile.mock.calls.map((call: unknown[]) => String(call[1]));
      for (const dest of copyFileDests) {
        expect(dest).toContain(path.join('artifacts', 'image_'));
      }
    });

    it('writes output files to same locations as Docling', async () => {
      const extractZipMock = (await import('extract-zip')).default as unknown as ReturnType<typeof vi.fn>;
      extractZipMock.mockResolvedValue(undefined);
      setupFsForMaterialize();

      mockFetch
        .mockResolvedValueOnce(makeUploadUrlResponse())
        .mockResolvedValueOnce(makeUploadResponse())
        .mockResolvedValueOnce(makePollDoneResponse())
        .mockResolvedValueOnce(makeZipDownloadResponse());

      const { convertPdfToMarkdown } = await import('@/lib/mineru');
      await convertPdfToMarkdown('/path/to/test.pdf', 'job-1');

      const writeFilePaths = mockWriteFile.mock.calls.map((call: unknown[]) => String(call[0]));

      // paper.md in output dir (same as Docling)
      expect(writeFilePaths.some((p: string) => p.endsWith(path.join('outputs', 'job-1', 'paper.md')))).toBe(true);

      // image-mapping.json in output dir (same as Docling)
      expect(writeFilePaths.some((p: string) => p.endsWith(path.join('outputs', 'job-1', 'image-mapping.json')))).toBe(true);
    });
  });
});
