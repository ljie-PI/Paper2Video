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
  Loader2: icon('Loader2'),
  CheckCircle2: icon('CheckCircle2'),
  AlertCircle: icon('AlertCircle'),
}));

import { ToolCallPill } from '@/app/components/ToolCallPill';

function makeTool(toolName: string, state: string) {
  return { toolCallId: 'tc-1', toolName, state };
}

describe('ToolCallPill', () => {
  it('shows "Parsing PDF" label for parse_pdf tool', () => {
    render(<ToolCallPill toolCall={makeTool('parse_pdf', 'call')} />);
    expect(screen.getByText('Parsing PDF')).toBeInTheDocument();
  });

  it('shows "Planning Video" for video_planner', () => {
    render(<ToolCallPill toolCall={makeTool('video_planner', 'call')} />);
    expect(screen.getByText('Planning Video')).toBeInTheDocument();
  });

  it('falls back to toolName when not in labels map', () => {
    render(<ToolCallPill toolCall={makeTool('unknown_tool', 'call')} />);
    expect(screen.getByText('unknown_tool')).toBeInTheDocument();
  });

  it('running state has sky-100 class', () => {
    render(<ToolCallPill toolCall={makeTool('parse_pdf', 'call')} />);
    const pill = screen.getByText('Parsing PDF').closest('span')!;
    expect(pill.className).toContain('bg-sky-100');
  });

  it('result state has emerald-100 class', () => {
    render(<ToolCallPill toolCall={makeTool('parse_pdf', 'result')} />);
    const pill = screen.getByText('Parsing PDF').closest('span')!;
    expect(pill.className).toContain('bg-emerald-100');
  });

  it('error state has rose-100 class', () => {
    render(<ToolCallPill toolCall={makeTool('parse_pdf', 'error')} />);
    const pill = screen.getByText('Parsing PDF').closest('span')!;
    expect(pill.className).toContain('bg-rose-100');
  });
});
