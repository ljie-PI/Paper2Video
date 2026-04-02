import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const { icon } = vi.hoisted(() => ({
  icon: (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
    },
}));

vi.mock('lucide-react', () => ({
  Film: icon('Film'),
  Mic: icon('Mic'),
  ImageIcon: icon('ImageIcon'),
  Table2: icon('Table2'),
  LayoutPanelLeft: icon('LayoutPanelLeft'),
}));

import { PlanBlock } from '@/app/components/PlanBlock';

describe('PlanBlock', () => {
  it('returns null for invalid JSON', () => {
    const { container } = render(<PlanBlock planJson="not-json" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for empty segments array', () => {
    const { container } = render(
      <PlanBlock planJson={JSON.stringify({ segments: [] })} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders "VIDEO PLAN" heading', () => {
    const plan = {
      segments: [{ id: 's1', type: 'title', title: 'Intro' }],
    };
    render(<PlanBlock planJson={JSON.stringify(plan)} />);
    expect(screen.getByText('VIDEO PLAN')).toBeInTheDocument();
  });

  it('renders each segment with type badge and title', () => {
    const plan = {
      segments: [
        { id: 's1', type: 'title', title: 'Intro' },
        { id: 's2', type: 'narration', title: 'Main Point' },
      ],
    };
    render(<PlanBlock planJson={JSON.stringify(plan)} />);
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Main Point')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('narration')).toBeInTheDocument();
  });

  it('shows duration when present', () => {
    const plan = {
      segments: [
        { id: 's1', type: 'title', title: 'Intro', durationSeconds: 5 },
      ],
    };
    render(<PlanBlock planJson={JSON.stringify(plan)} />);
    expect(screen.getByText('5s')).toBeInTheDocument();
  });

  it('falls back to narration text when no title', () => {
    const plan = {
      segments: [
        { id: 's1', type: 'narration', narration: 'This is the narration text for the segment' },
      ],
    };
    render(<PlanBlock planJson={JSON.stringify(plan)} />);
    // narration is sliced to 40 chars
    expect(
      screen.getByText('This is the narration text for the segme'),
    ).toBeInTheDocument();
  });

  it('falls back to segment id when no title or narration', () => {
    const plan = {
      segments: [{ id: 'seg-abc', type: 'image' }],
    };
    render(<PlanBlock planJson={JSON.stringify(plan)} />);
    expect(screen.getByText('seg-abc')).toBeInTheDocument();
  });
});
