'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

type Props = {
  file: File | null;
  onFileSelect: (file: File) => void;
  sessionId: string | null;
  t: Record<string, string>;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export function PdfZone({ file, onFileSelect, t }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const dropped = event.dataTransfer.files[0];
      if (dropped?.type === 'application/pdf') {
        onFileSelect(dropped);
      }
    },
    [onFileSelect],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0];
      if (selected) onFileSelect(selected);
    },
    [onFileSelect],
  );

  // ── Upload zone (no file loaded) ────────────────────────────────────
  if (!file) {
    return (
      <div
        className={`flex h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white transition ${
          dragActive
            ? 'border-sky-400 bg-sky-50'
            : 'border-slate-200 hover:border-slate-300'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-8 w-8 text-slate-400" />
        <p className="text-lg font-semibold text-slate-700">
          {t.dragText}
        </p>
        <p className="text-sm text-slate-500">
          {t.dragSubtext}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    );
  }

  // ── Preview (file loaded) ───────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="truncate font-medium text-slate-800">{file.name}</span>
          <span className="shrink-0">{formatBytes(file.size)}</span>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg px-3 py-1 text-sm font-medium text-sky-600 transition hover:bg-sky-50"
          onClick={() => inputRef.current?.click()}
        >
          {t.changeBtn ?? 'Change'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {previewUrl && (
        <embed
          src={previewUrl}
          type="application/pdf"
          className="w-full h-[500px] rounded-lg"
        />
      )}
    </div>
  );
}
