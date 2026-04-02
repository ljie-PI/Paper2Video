'use client';

import React from 'react';
import { FileVideo, FileAudio, FileText, Image as ImageIcon, ListVideo } from 'lucide-react';

const typeConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  'video-final': { icon: <FileVideo size={16} />, color: 'border-emerald-300 bg-emerald-50' },
  'video-segment': { icon: <ListVideo size={16} />, color: 'border-sky-300 bg-sky-50' },
  audio: { icon: <FileAudio size={16} />, color: 'border-amber-300 bg-amber-50' },
  markdown: { icon: <FileText size={16} />, color: 'border-indigo-300 bg-indigo-50' },
  image: { icon: <ImageIcon size={16} />, color: 'border-purple-300 bg-purple-50' },
  plan: { icon: <ListVideo size={16} />, color: 'border-gray-300 bg-gray-50' },
};

type Props = {
  type: string;
  path: string;
  label: string;
  onClick?: () => void;
};

export const ArtifactCard: React.FC<Props> = ({ type, label, onClick }) => {
  const config = typeConfig[type] || typeConfig.plan;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left hover:shadow-sm transition-shadow ${config.color}`}
    >
      <div className="flex-shrink-0 text-[var(--ink)]">{config.icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--ink)] truncate">{label}</div>
        <div className="text-xs text-[var(--muted)]">{type}</div>
      </div>
    </button>
  );
};
