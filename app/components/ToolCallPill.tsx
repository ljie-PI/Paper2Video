'use client';

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const toolLabels: Record<string, string> = {
  parse_pdf: 'Parsing PDF',
  video_planner: 'Planning Video',
  parse_image: 'Analyzing Image',
  generate_tts: 'Generating Audio',
  generate_video_segment: 'Rendering Segment',
  merge_video_segments: 'Merging Video',
};

type ToolInvocation = {
  toolCallId: string;
  toolName: string;
  state: string;
  args?: Record<string, unknown>;
  result?: unknown;
};

type Props = {
  toolCall: ToolInvocation;
};

export const ToolCallPill: React.FC<Props> = ({ toolCall }) => {
  const label = toolLabels[toolCall.toolName] || toolCall.toolName;
  const isComplete = toolCall.state === 'result';
  const isFailed = toolCall.state === 'error';
  const isRunning = !isComplete && !isFailed;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        isFailed
          ? 'bg-rose-100 text-rose-700'
          : isComplete
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-sky-100 text-sky-700'
      }`}
    >
      {isRunning && <Loader2 size={12} className="animate-spin" />}
      {isComplete && <CheckCircle2 size={12} />}
      {isFailed && <AlertCircle size={12} />}
      {label}
    </span>
  );
};
