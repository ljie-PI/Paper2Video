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

  it('exposes a Settings region with labelled controls', () => {
    renderSidebar();
    const settings = screen.getByRole('region', { name: 'Settings' });
    expect(settings).toBeInTheDocument();

    const modelInput = screen.getByRole('textbox', { name: 'Model' });
    expect(modelInput).toHaveValue('gpt-4o');

    const langSelect = screen.getByRole('combobox', { name: 'Language' });
    expect(langSelect).toHaveValue('en');

    const slider = screen.getByRole('slider', { name: 'TTS Speed' });
    expect(slider).toHaveAttribute('min', '0.5');
    expect(slider).toHaveAttribute('max', '2');
    expect(slider).toHaveAttribute('step', '0.1');
    expect(slider).toHaveValue('1');
  });

  it('label elements are associated with their controls via htmlFor/id', () => {
    renderSidebar();

    // getByLabelText proves the label->control association end-to-end
    // (it would fail if either `htmlFor` or the control `id` were missing).
    const modelInput = screen.getByLabelText('Model');
    const langSelect = screen.getByLabelText('Language');
    const slider = screen.getByLabelText('TTS Speed');

    expect(modelInput).toHaveAttribute('id', 'settings-model');
    expect(langSelect).toHaveAttribute('id', 'settings-language');
    expect(slider).toHaveAttribute('id', 'settings-tts-speed');

    // Also assert the explicit htmlFor wiring so removing it is caught even
    // if the inputs still carry a redundant aria-label.
    const modelLabel = document.querySelector('label[for="settings-model"]');
    const langLabel = document.querySelector('label[for="settings-language"]');
    const ttsLabel = document.querySelector('label[for="settings-tts-speed"]');
    expect(modelLabel).not.toBeNull();
    expect(langLabel).not.toBeNull();
    expect(ttsLabel).not.toBeNull();
    expect(modelLabel).toHaveTextContent('Model');
    expect(langLabel).toHaveTextContent('Language');
    expect(ttsLabel).toHaveTextContent('TTS Speed');
  });

  it('changing model input calls onConfigChange("model", value)', () => {
    const { onConfigChange } = renderSidebar();
    const modelInput = screen.getByRole('textbox', { name: 'Model' });
    fireEvent.change(modelInput, { target: { value: 'claude-3.5' } });
    expect(onConfigChange).toHaveBeenCalledWith('model', 'claude-3.5');
  });

  it('changing language select calls onConfigChange("outputLanguage", value)', () => {
    const { onConfigChange } = renderSidebar();
    const langSelect = screen.getByRole('combobox', { name: 'Language' });
    fireEvent.change(langSelect, { target: { value: 'zh' } });
    expect(onConfigChange).toHaveBeenCalledWith('outputLanguage', 'zh');
  });

  it('changing TTS speed slider calls onConfigChange("ttsSpeed", parsedFloat)', () => {
    const { onConfigChange } = renderSidebar();
    const slider = screen.getByRole('slider', { name: 'TTS Speed' });
    fireEvent.change(slider, { target: { value: '1.5' } });
    expect(onConfigChange).toHaveBeenCalledWith('ttsSpeed', 1.5);
  });

  it('respects translated labels (zh) for accessible names', () => {
    renderSidebar({
      config: { model: 'gpt-4o', ttsSpeed: 1.0, outputLanguage: 'zh' as const },
      t: {
        new: '新建',
        settings: '设置',
        model: '模型',
        outputLanguage: '语言',
        ttsSpeed: '语音速度',
        untitled: '未命名',
      },
    });
    expect(screen.getByRole('region', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '模型' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '语言' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '语音速度' })).toBeInTheDocument();
  });
});
