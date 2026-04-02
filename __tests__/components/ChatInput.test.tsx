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
  Send: icon('Send'),
}));

import { ChatInput } from '@/app/components/ChatInput';

describe('ChatInput', () => {
  const defaultProps = {
    onSend: vi.fn(),
    isLoading: false,
    t: { inputPlaceholder: 'Ask about your paper...' },
  };

  function renderInput(overrides: Partial<typeof defaultProps> = {}) {
    const props = { ...defaultProps, onSend: vi.fn(), ...overrides };
    const result = render(<ChatInput {...props} />);
    return { ...result, onSend: props.onSend };
  }

  it('renders textarea with placeholder from t.inputPlaceholder', () => {
    renderInput();
    expect(
      screen.getByPlaceholderText('Ask about your paper...'),
    ).toBeInTheDocument();
  });

  it('uses default placeholder when t.inputPlaceholder is not set', () => {
    renderInput({ t: {} });
    expect(
      screen.getByPlaceholderText('Type a message...'),
    ).toBeInTheDocument();
  });

  it('calls onSend with trimmed text on submit button click', () => {
    const { onSend } = renderInput();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  hello world  ' } });
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledWith('hello world');
  });

  it('does NOT call onSend when input is empty', () => {
    const { onSend } = renderInput();
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does NOT call onSend when isLoading is true', () => {
    const { onSend } = renderInput({ isLoading: true });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('Enter key triggers send', () => {
    const { onSend } = renderInput();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('Shift+Enter does NOT trigger send', () => {
    const { onSend } = renderInput();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears input after sending', () => {
    renderInput();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button'));
    expect(textarea.value).toBe('');
  });
});
