import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', () => ({
  tool: (config: any) => config,
}));

vi.mock('zod', async () => {
  const actual = await vi.importActual('zod');
  return actual;
});

vi.mock('@/lib/remotion-render', () => ({
  mergeSegments: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { mergeSegments } from '@/lib/remotion-render';
import { mergeVideoSegments } from '@/lib/tools/merge-video-segments';

const mockMerge = vi.mocked(mergeSegments);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mergeVideoSegments', () => {
  const baseParams = {
    sessionId: 'sess-123',
    segmentPaths: ['/video/seg-001.mp4', '/video/seg-002.mp4', '/video/seg-003.mp4'],
  };

  it('calls mergeSegments with correct params', async () => {
    mockMerge.mockResolvedValue('/output/final.mp4');

    await mergeVideoSegments.execute(baseParams, {} as any);

    expect(mockMerge).toHaveBeenCalledWith(
      'sess-123',
      ['/video/seg-001.mp4', '/video/seg-002.mp4', '/video/seg-003.mp4'],
      undefined,
    );
  });

  it('passes custom outputFileName', async () => {
    mockMerge.mockResolvedValue('/output/custom.mp4');

    await mergeVideoSegments.execute(
      { ...baseParams, outputFileName: 'custom.mp4' },
      {} as any,
    );

    expect(mockMerge).toHaveBeenCalledWith(
      'sess-123',
      baseParams.segmentPaths,
      'custom.mp4',
    );
  });

  it('returns success with segmentCount', async () => {
    mockMerge.mockResolvedValue('/output/final.mp4');

    const result = await mergeVideoSegments.execute(baseParams, {} as any);

    expect(result.success).toBe(true);
    expect(result.videoPath).toBe('/output/final.mp4');
    expect(result.segmentCount).toBe(3);
    expect(result.message).toContain('3 segments');
  });

  it('returns error on failure', async () => {
    mockMerge.mockRejectedValue(new Error('FFmpeg merge failed'));

    const result = await mergeVideoSegments.execute(baseParams, {} as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('FFmpeg merge failed');
  });

  it('handles non-Error thrown values', async () => {
    mockMerge.mockRejectedValue('unexpected failure');

    const result = await mergeVideoSegments.execute(baseParams, {} as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });

  it('works with single segment', async () => {
    mockMerge.mockResolvedValue('/output/final.mp4');

    const result = await mergeVideoSegments.execute(
      { sessionId: 'sess-1', segmentPaths: ['/video/seg-001.mp4'] },
      {} as any,
    );

    expect(result.success).toBe(true);
    expect(result.segmentCount).toBe(1);
  });

  it('has a description', () => {
    expect(mergeVideoSegments.description).toBeDefined();
    expect(typeof mergeVideoSegments.description).toBe('string');
  });
});
