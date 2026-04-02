import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const { icon } = vi.hoisted(() => ({
  icon: (name: string) =>
    function MockIcon(props: Record<string, unknown>) {
      return React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
    },
}));

vi.mock('lucide-react', () => ({
  FileVideo: icon('FileVideo'),
  FileAudio: icon('FileAudio'),
  FileText: icon('FileText'),
  Image: icon('Image'),
  ListVideo: icon('ListVideo'),
}));

import { ArtifactCard } from '@/app/components/ArtifactCard';

describe('ArtifactCard', () => {
  const defaultProps = {
    type: 'video-final',
    path: '/output/video.mp4',
    label: 'Final Video',
  };

  it('renders label text', () => {
    render(<ArtifactCard {...defaultProps} />);
    expect(screen.getByText('Final Video')).toBeInTheDocument();
  });

  it('renders type text', () => {
    render(<ArtifactCard {...defaultProps} />);
    expect(screen.getByText('video-final')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ArtifactCard {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    ['video-final', 'border-emerald-300 bg-emerald-50'],
    ['video-segment', 'border-sky-300 bg-sky-50'],
    ['audio', 'border-amber-300 bg-amber-50'],
    ['markdown', 'border-indigo-300 bg-indigo-50'],
    ['image', 'border-purple-300 bg-purple-50'],
    ['plan', 'border-gray-300 bg-gray-50'],
  ])('uses correct color classes for type "%s"', (type, expectedClasses) => {
    render(<ArtifactCard type={type} path="/p" label="L" />);
    const button = screen.getByRole('button');
    for (const cls of expectedClasses.split(' ')) {
      expect(button.className).toContain(cls);
    }
  });

  it('falls back to plan config for unknown type', () => {
    render(<ArtifactCard type="unknown-type" path="/p" label="L" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('border-gray-300');
    expect(button.className).toContain('bg-gray-50');
  });
});
