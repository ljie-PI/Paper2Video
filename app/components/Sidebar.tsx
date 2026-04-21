'use client';

import React from 'react';
import { Plus, FileText, Settings } from 'lucide-react';

type Props = {
  sessions: Array<{ id: string; status: string; pdfName?: string; createdAt: string }>;
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  config: {
    model: string;
    ttsSpeed: number;
    outputLanguage: 'zh' | 'en';
  };
  onConfigChange: (key: string, value: unknown) => void;
  t: Record<string, string>;
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export const Sidebar: React.FC<Props> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  config,
  onConfigChange,
  t,
}) => {
  return (
    <aside className="flex flex-col w-[280px] h-full bg-ink-900 text-white/80 border-r border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
        <span className="text-base font-semibold tracking-tight text-white">
          Paper2Video
        </span>
        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 rounded-md bg-skyline-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-skyline-500"
        >
          <Plus size={14} />
          {t.new ?? 'New'}
        </button>
      </div>

      {/* Session list */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-skyline-600/15 text-skyline-600'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <FileText size={15} className="mt-0.5 shrink-0 opacity-60" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium leading-snug">
                  {session.pdfName || (t.untitled ?? 'Untitled')}
                </div>
                <div className="mt-0.5 text-[11px] opacity-50">
                  {relativeTime(session.createdAt)}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Settings section */}
      <section
        aria-label={t.settings ?? 'Settings'}
        data-testid="sidebar-settings"
        className="border-t border-white/5 px-4 py-3 space-y-3"
      >
        <div
          id="sidebar-settings-heading"
          className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40"
        >
          <Settings size={13} aria-hidden="true" />
          {t.settings ?? 'Settings'}
        </div>

        {/* Model */}
        <div className="block space-y-1">
          <label
            htmlFor="settings-model"
            className="text-[12px] text-white/50 block"
          >
            {t.model ?? 'Model'}
          </label>
          <input
            id="settings-model"
            type="text"
            aria-label={t.model ?? 'Model'}
            data-testid="settings-model-input"
            value={config.model}
            onChange={(e) => onConfigChange('model', e.target.value)}
            className="w-full rounded-md border border-white/10 bg-ink-800 px-2.5 py-1.5 text-xs text-white placeholder-white/30 outline-none transition-colors focus:border-skyline-600/50"
          />
        </div>

        {/* Output Language */}
        <div className="block space-y-1">
          <label
            htmlFor="settings-language"
            className="text-[12px] text-white/50 block"
          >
            {t.outputLanguage ?? 'Language'}
          </label>
          <select
            id="settings-language"
            aria-label={t.outputLanguage ?? 'Language'}
            data-testid="settings-language-select"
            value={config.outputLanguage}
            onChange={(e) => onConfigChange('outputLanguage', e.target.value)}
            className="w-full rounded-md border border-white/10 bg-ink-800 px-2.5 py-1.5 text-xs text-white outline-none transition-colors focus:border-skyline-600/50"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* TTS Speed */}
        <div className="block space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="settings-tts-speed"
              className="text-[12px] text-white/50"
            >
              {t.ttsSpeed ?? 'TTS Speed'}
            </label>
            <span
              className="text-[11px] tabular-nums text-white/40"
              data-testid="settings-tts-speed-value"
              aria-hidden="true"
            >
              {config.ttsSpeed.toFixed(1)}x
            </span>
          </div>
          <input
            id="settings-tts-speed"
            type="range"
            aria-label={t.ttsSpeed ?? 'TTS Speed'}
            data-testid="settings-tts-speed-slider"
            min={0.5}
            max={2.0}
            step={0.1}
            value={config.ttsSpeed}
            onChange={(e) => onConfigChange('ttsSpeed', parseFloat(e.target.value))}
            className="w-full accent-skyline-600"
          />
        </div>
      </section>
    </aside>
  );
};
