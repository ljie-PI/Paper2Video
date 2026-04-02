'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download } from 'lucide-react';

type ArtifactPreview = {
  type: string;
  path: string;
  label: string;
};

type Props = {
  artifact: ArtifactPreview | null;
  onClose: () => void;
};

function artifactUrl(path: string): string {
  return `/api/artifacts/${path}`;
}

function MarkdownBody({ src }: { src: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(null);
    setError(null);

    let cancelled = false;
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (error) {
    return <p className="text-red-400 text-sm p-4">{error}</p>;
  }
  if (content === null) {
    return <p className="text-white/40 text-sm p-4">Loading…</p>;
  }
  return (
    <pre className="whitespace-pre-wrap break-words text-sm text-white/80 p-4 font-mono leading-relaxed">
      {content}
    </pre>
  );
}

export const ArtifactPanel: React.FC<Props> = ({ artifact, onClose }) => {
  if (!artifact) return null;

  const src = artifactUrl(artifact.path);

  function renderBody() {
    switch (artifact!.type) {
      case 'video-final':
      case 'video-segment':
        return (
          <video
            key={src}
            controls
            className="w-full max-h-full object-contain"
            src={src}
          />
        );

      case 'audio':
        return (
          <div className="flex items-center justify-center h-full p-6">
            <audio key={src} controls className="w-full" src={src} />
          </div>
        );

      case 'image':
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={artifact!.label}
            className="w-full h-full object-contain"
          />
        );

      case 'markdown':
      case 'plan':
        return <MarkdownBody src={src} />;

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Download size={32} className="text-white/30" />
            <a
              href={src}
              download
              className="text-skyline-500 hover:text-skyline-400 text-sm underline underline-offset-2"
            >
              Download {artifact!.label}
            </a>
          </div>
        );
    }
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="flex flex-col w-1/2 h-full bg-ink-900 border-l border-white/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
        <span className="text-sm font-medium text-white/90 truncate">
          {artifact.label}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors"
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {renderBody()}
      </div>
    </motion.div>
  );
};
