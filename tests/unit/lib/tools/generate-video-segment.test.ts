import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', () => ({
  tool: (config: any) => config,
}));

vi.mock('zod', async () => {
  const actual = await vi.importActual('zod');
  return actual;
});

vi.mock('@/lib/remotion-render', () => ({
  renderSegment: vi.fn(),
  durationToFrames: vi.fn((seconds: number) => Math.ceil(seconds * 30)),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { renderSegment, durationToFrames } from '@/lib/remotion-render';
import { generateVideoSegment } from '@/lib/tools/generate-video-segment';

const mockRender = vi.mocked(renderSegment);
const mockDurationToFrames = vi.mocked(durationToFrames);

beforeEach(() => {
  vi.clearAllMocks();
  mockRender.mockResolvedValue('/mock/output/seg-001.mp4');
});

const baseParams = {
  segmentId: 'seg-001',
  sessionId: 'sess-123',
  template: 'narration' as const,
  props: { content: 'Hello world', audioPath: '/audio/seg-001.mp3' },
};

describe('generateVideoSegment', () => {
  describe('template to compositionId mapping', () => {
    it.each([
      ['title', 'TitleScene'],
      ['narration', 'NarrationScene'],
      ['image', 'ImageScene'],
      ['side-by-side', 'SideBySideScene'],
      ['table', 'TableScene'],
    ])('maps %s template to %s compositionId', async (template, compositionId) => {
      const result = await generateVideoSegment.execute(
        { ...baseParams, template: template as any },
        {} as any,
      );

      expect(mockRender).toHaveBeenCalledWith(
        expect.objectContaining({ compositionId }),
      );
      expect(result.success).toBe(true);
    });
  });

  it('returns error for unknown template', async () => {
    const result = await generateVideoSegment.execute(
      { ...baseParams, template: 'unknown' as any },
      {} as any,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown template');
    expect(result.segmentId).toBe('seg-001');
    expect(mockRender).not.toHaveBeenCalled();
  });

  it('uses durationInFrames when provided', async () => {
    await generateVideoSegment.execute(
      { ...baseParams, durationInFrames: 450 },
      {} as any,
    );

    expect(mockRender).toHaveBeenCalledWith(
      expect.objectContaining({ durationInFrames: 450 }),
    );
    expect(mockDurationToFrames).not.toHaveBeenCalled();
  });

  it('uses audioDurationSeconds to calculate frames when durationInFrames not provided', async () => {
    mockDurationToFrames.mockReturnValue(600);

    await generateVideoSegment.execute(
      { ...baseParams, audioDurationSeconds: 20 },
      {} as any,
    );

    expect(mockDurationToFrames).toHaveBeenCalledWith(20);
    expect(mockRender).toHaveBeenCalledWith(
      expect.objectContaining({ durationInFrames: 600 }),
    );
  });

  it('defaults to 300 frames when neither durationInFrames nor audioDurationSeconds provided', async () => {
    await generateVideoSegment.execute(baseParams, {} as any);

    expect(mockRender).toHaveBeenCalledWith(
      expect.objectContaining({ durationInFrames: 300 }),
    );
  });

  it('prefers durationInFrames over audioDurationSeconds', async () => {
    await generateVideoSegment.execute(
      { ...baseParams, durationInFrames: 500, audioDurationSeconds: 20 },
      {} as any,
    );

    expect(mockRender).toHaveBeenCalledWith(
      expect.objectContaining({ durationInFrames: 500 }),
    );
    expect(mockDurationToFrames).not.toHaveBeenCalled();
  });

  it('returns success with videoPath', async () => {
    mockRender.mockResolvedValue('/mock/output/seg-001.mp4');

    const result = await generateVideoSegment.execute(baseParams, {} as any);

    expect(result.success).toBe(true);
    expect(result.videoPath).toBe('/mock/output/seg-001.mp4');
    expect(result.segmentId).toBe('seg-001');
    expect(result.template).toBe('narration');
    expect(result.message).toContain('seg-001');
  });

  it('passes correct props to renderSegment', async () => {
    const props = { title: 'My Title', audioPath: '/audio/title.mp3' };

    await generateVideoSegment.execute(
      { ...baseParams, template: 'title' as const, props },
      {} as any,
    );

    expect(mockRender).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-123',
        segmentId: 'seg-001',
        props,
      }),
    );
  });

  it('returns error on render failure', async () => {
    mockRender.mockRejectedValue(new Error('Remotion render failed'));

    const result = await generateVideoSegment.execute(baseParams, {} as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Remotion render failed');
    expect(result.segmentId).toBe('seg-001');
  });

  it('handles non-Error thrown values', async () => {
    mockRender.mockRejectedValue('render crash');

    const result = await generateVideoSegment.execute(baseParams, {} as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown error');
  });
});
