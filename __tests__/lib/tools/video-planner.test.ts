import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => ({
  tool: (config: any) => config,
}));

vi.mock('zod', async () => {
  const actual = await vi.importActual('zod');
  return actual;
});

import { videoPlanner } from '@/lib/tools/video-planner';

describe('videoPlanner', () => {
  it('has a description', () => {
    expect(videoPlanner.description).toBeDefined();
    expect(typeof videoPlanner.description).toBe('string');
  });

  it('creates plan with correct segment count', async () => {
    const segments = [
      { id: 'seg-001', type: 'title' as const, narration: 'Welcome', durationSeconds: 5 },
      { id: 'seg-002', type: 'narration' as const, narration: 'Introduction', durationSeconds: 30 },
    ];

    const result = await videoPlanner.execute({ segments }, {} as any);

    expect(result.success).toBe(true);
    expect(result.plan.segments).toHaveLength(2);
  });

  it('sets status to planned for each segment', async () => {
    const segments = [
      { id: 'seg-001', type: 'title' as const, narration: 'Title', durationSeconds: 5 },
      { id: 'seg-002', type: 'image' as const, narration: 'Figure 1', durationSeconds: 10 },
    ];

    const result = await videoPlanner.execute({ segments }, {} as any);

    for (const seg of result.plan.segments) {
      expect(seg.status).toBe('planned');
    }
  });

  it('sums durations correctly', async () => {
    const segments = [
      { id: 'seg-001', type: 'title' as const, narration: 'A', durationSeconds: 5 },
      { id: 'seg-002', type: 'narration' as const, narration: 'B', durationSeconds: 20 },
      { id: 'seg-003', type: 'table' as const, narration: 'C', durationSeconds: 15 },
    ];

    const result = await videoPlanner.execute({ segments }, {} as any);

    expect(result.plan.totalDuration).toBe(40);
  });

  it('handles segments without durationSeconds (defaults to 0)', async () => {
    const segments = [
      { id: 'seg-001', type: 'narration' as const, narration: 'A' },
      { id: 'seg-002', type: 'narration' as const, narration: 'B', durationSeconds: 10 },
    ];

    const result = await videoPlanner.execute({ segments }, {} as any);

    expect(result.plan.totalDuration).toBe(10);
  });

  it('returns informative message', async () => {
    const segments = [
      { id: 'seg-001', type: 'title' as const, narration: 'A', durationSeconds: 5 },
    ];

    const result = await videoPlanner.execute({ segments }, {} as any);

    expect(result.message).toContain('1 segments');
    expect(result.message).toContain('5s total');
  });

  it('preserves original segment properties', async () => {
    const segments = [
      {
        id: 'seg-001',
        type: 'side-by-side' as const,
        title: 'Comparison',
        content: 'Left vs right',
        imageUrl: '/images/fig1.png',
        narration: 'Compare these two approaches',
        durationSeconds: 15,
      },
    ];

    const result = await videoPlanner.execute({ segments }, {} as any);
    const seg = result.plan.segments[0];

    expect(seg.id).toBe('seg-001');
    expect(seg.type).toBe('side-by-side');
    expect(seg.title).toBe('Comparison');
    expect(seg.content).toBe('Left vs right');
    expect(seg.imageUrl).toBe('/images/fig1.png');
    expect(seg.narration).toBe('Compare these two approaches');
    expect(seg.durationSeconds).toBe(15);
    expect(seg.status).toBe('planned');
  });

  it('handles empty segments array', async () => {
    const result = await videoPlanner.execute({ segments: [] }, {} as any);

    expect(result.success).toBe(true);
    expect(result.plan.segments).toHaveLength(0);
    expect(result.plan.totalDuration).toBe(0);
    expect(result.message).toContain('0 segments');
  });
});
