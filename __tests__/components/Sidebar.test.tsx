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
  Plus: icon('Plus'),
  FileText: icon('FileText'),
  Settings: icon('Settings'),
}));

import { Sidebar } from '@/app/components/Sidebar';

describe('Sidebar', () => {
  const defaultProps = {
    sessions: [
      { id: 's1', status: 'done', pdfName: 'paper.pdf', createdAt: new Date().toISOString() },
      { id: 's2', status: 'active', createdAt: new Date().toISOString() },
    ],
    activeSessionId: 's1',
    onSelectSession: vi.fn(),
    onNewSession: vi.fn(),
    config: { model: 'gpt-4o', ttsSpeed: 1.0, outputLanguage: 'en' as const },
    onConfigChange: vi.fn(),
    t: { new: 'New', settings: 'Settings', model: 'Model', outputLanguage: 'Language', ttsSpeed: 'TTS Speed', untitled: 'Untitled' },
  };

  function renderSidebar(overrides: Partial<typeof defaultProps> = {}) {
    const props = {
      ...defaultProps,
      onSelectSession: vi.fn(),
      onNewSession: vi.fn(),
      onConfigChange: vi.fn(),
      ...overrides,
    };
    const result = render(<Sidebar {...props} />);
    return { ...result, ...props };
  }

  it('renders "Paper2Video" header', () => {
    renderSidebar();
    expect(screen.getByText('Paper2Video')).toBeInTheDocument();
  });

  it('renders New button that calls onNewSession', () => {
    const { onNewSession } = renderSidebar();
    const newBtn = screen.getByText('New');
    fireEvent.click(newBtn);
    expect(onNewSession).toHaveBeenCalledOnce();
  });

  it('renders each session in list', () => {
    renderSidebar();
    expect(screen.getByText('paper.pdf')).toBeInTheDocument();
    // Second session has no pdfName, falls back to t.untitled
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('active session has skyline class styling', () => {
    renderSidebar();
    const activeBtn = screen.getByText('paper.pdf').closest('button')!;
    expect(activeBtn.className).toContain('skyline');
  });

  it('shows pdfName, falls back to "Untitled"', () => {
    renderSidebar({
      sessions: [
        { id: 's1', status: 'done', pdfName: 'my-paper.pdf', createdAt: new Date().toISOString() },
        { id: 's2', status: 'active', createdAt: new Date().toISOString() },
      ],
    });
    expect(screen.getByText('my-paper.pdf')).toBeInTheDocument();
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('clicking a session calls onSelectSession with the id', () => {
    const { onSelectSession } = renderSidebar();
    fireEvent.click(screen.getByText('paper.pdf'));
    expect(onSelectSession).toHaveBeenCalledWith('s1');
  });

  it('renders settings section with model input, language select, TTS speed slider', () => {
    renderSidebar();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('TTS Speed')).toBeInTheDocument();

    // Model input has correct value
    const modelInput = screen.getByDisplayValue('gpt-4o');
    expect(modelInput).toBeInTheDocument();

    // Language select
    const langSelect = screen.getByDisplayValue('English');
    expect(langSelect).toBeInTheDocument();

    // TTS speed slider
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('changing model input calls onConfigChange("model", value)', () => {
    const { onConfigChange } = renderSidebar();
    const modelInput = screen.getByDisplayValue('gpt-4o');
    fireEvent.change(modelInput, { target: { value: 'claude-3.5' } });
    expect(onConfigChange).toHaveBeenCalledWith('model', 'claude-3.5');
  });

  it('changing language select calls onConfigChange("outputLanguage", value)', () => {
    const { onConfigChange } = renderSidebar();
    const langSelect = screen.getByDisplayValue('English');
    fireEvent.change(langSelect, { target: { value: 'zh' } });
    expect(onConfigChange).toHaveBeenCalledWith('outputLanguage', 'zh');
  });
});
