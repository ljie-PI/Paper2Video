'use client';

import React from 'react';
import { Film, Mic, ImageIcon, Table2, LayoutPanelLeft } from 'lucide-react';

const typeIcons: Record<string, React.ReactNode> = {
  title: <Film size={14} />,
  narration: <Mic size={14} />,
  image: <ImageIcon size={14} />,
  'side-by-side': <LayoutPanelLeft size={14} />,
  table: <Table2 size={14} />,
};

const typeColors: Record<string, string> = {
  title: 'bg-purple-100 text-purple-700',
  narration: 'bg-sky-100 text-sky-700',
  image: 'bg-emerald-100 text-emerald-700',
  'side-by-side': 'bg-amber-100 text-amber-700',
  table: 'bg-rose-100 text-rose-700',
};

type Props = {
  planJson: string;
};

export const PlanBlock: React.FC<Props> = ({ planJson }) => {
  let plan: { segments?: Array<{ id: string; type: string; title?: string; narration?: string; durationSeconds?: number }> };
  try {
    plan = JSON.parse(planJson);
  } catch {
    return null;
  }

  if (!plan.segments?.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-semibold text-[var(--muted)] mb-2">VIDEO PLAN</div>
      <div className="space-y-1.5">
        {plan.segments.map((seg, i) => (
          <div key={seg.id || i} className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${typeColors[seg.type] || 'bg-gray-100 text-gray-600'}`}>
              {typeIcons[seg.type]} {seg.type}
            </span>
            <span className="text-[var(--ink)] font-medium truncate">
              {seg.title || seg.narration?.slice(0, 40) || seg.id}
            </span>
            {seg.durationSeconds && (
              <span className="text-[var(--muted)] ml-auto">{seg.durationSeconds}s</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
