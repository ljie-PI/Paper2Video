'use client';

import React, { useEffect, useRef } from 'react';
import type { Message } from 'ai';
import { PlanBlock } from './PlanBlock';
import { ToolCallPill } from './ToolCallPill';
import { ArtifactCard } from './ArtifactCard';
import { Bot, User } from 'lucide-react';

type Props = {
  messages: Message[];
  onArtifactClick?: (artifact: { type: string; path: string; label: string }) => void;
  t: Record<string, string>;
};

export const ChatMessages: React.FC<Props> = ({ messages, onArtifactClick, t }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted)] text-sm">
        {t.chatPlaceholder || 'Upload a PDF to get started'}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-white" />
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[var(--ink)] text-white'
                : 'bg-white border border-gray-200 text-[var(--ink)]'
            }`}
          >
            {msg.toolInvocations && msg.toolInvocations.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {msg.toolInvocations.map((tc) => (
                  <ToolCallPill key={tc.toolCallId} toolCall={tc} />
                ))}
              </div>
            )}
            <div className="whitespace-pre-wrap">{msg.content}</div>
            {msg.role === 'assistant' && msg.content && (
              <MessageExtras content={msg.content} onArtifactClick={onArtifactClick} />
            )}
          </div>
          {msg.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-[var(--accent-warm)] flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-white" />
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

// Extract plan blocks and artifact cards from message content
const MessageExtras: React.FC<{
  content: string;
  onArtifactClick?: (artifact: { type: string; path: string; label: string }) => void;
}> = ({ content, onArtifactClick }) => {
  // Detect plan JSON in content
  const planMatch = content.match(/```json\n(\{[\s\S]*?"segments"[\s\S]*?\})\n```/);
  // Detect artifact references like [artifact:type:path:label]
  const artifactPattern = /\[artifact:(\w+):([^\]:]+):([^\]]+)\]/g;
  const artifacts = Array.from(content.matchAll(artifactPattern));

  if (!planMatch && artifacts.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {planMatch && <PlanBlock planJson={planMatch[1]} />}
      {artifacts.map((match, i) => (
        <ArtifactCard
          key={i}
          type={match[1]}
          path={match[2]}
          label={match[3]}
          onClick={() => onArtifactClick?.({ type: match[1], path: match[2], label: match[3] })}
        />
      ))}
    </div>
  );
};
