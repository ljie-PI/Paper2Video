'use client';

import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';

type Props = {
  onSend: (message: string) => void;
  isLoading: boolean;
  t: Record<string, string>;
};

export const ChatInput: React.FC<Props> = ({ onSend, isLoading, t }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white/80 backdrop-blur px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.inputPlaceholder || 'Type a message...'}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
          style={{ minHeight: 40, maxHeight: 120 }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--ink)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
