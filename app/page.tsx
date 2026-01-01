'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { JobRecord, JobStatus } from '@/lib/types';

const statusMeta: Record<
  JobStatus,
  { label: string; tone: string; text: string }
> = {
  pending: { label: 'Queued', tone: 'bg-slate-200', text: 'text-slate-700' },
  parsing: { label: 'Parsing', tone: 'bg-sky-100', text: 'text-sky-700' },
  generating: { label: 'Generating', tone: 'bg-indigo-100', text: 'text-indigo-700' },
  rendering: { label: 'Rendering', tone: 'bg-amber-100', text: 'text-amber-700' },
  completed: { label: 'Completed', tone: 'bg-emerald-100', text: 'text-emerald-700' },
  failed: { label: 'Failed', tone: 'bg-rose-100', text: 'text-rose-700' }
};

const stages: Array<{
  id: string;
  title: string;
  detail: string;
  activeOn: JobStatus[];
  doneOn: JobStatus[];
}> = [
  {
    id: 'parsing',
    title: 'Parsing',
    detail: 'PDF -> structured Markdown',
    activeOn: ['parsing'],
    doneOn: ['generating', 'rendering', 'completed']
  },
  {
    id: 'generating',
    title: 'Generating',
    detail: 'Markdown -> slides JSON',
    activeOn: ['generating'],
    doneOn: ['rendering', 'completed']
  },
  {
    id: 'composing',
    title: 'Rendering Slides',
    detail: 'LLM layout -> HTML -> PDF',
    activeOn: ['rendering'],
    doneOn: ['completed']
  },
  {
    id: 'rendering',
    title: 'Generating Video',
    detail: 'Video processing',
    activeOn: ['rendering'],
    doneOn: ['completed']
  }
];

const formatBytes = (value: number) => {
  if (!value) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, index);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
};

export default function HomePage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [voiceSample, setVoiceSample] = useState<File | null>(null);
  const [enableVideo, setEnableVideo] = useState(true);
  const [voiceClone, setVoiceClone] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [outputLanguage, setOutputLanguage] = useState<'en' | 'zh'>('en');
  const [dragActive, setDragActive] = useState(false);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [outputSnapshot, setOutputSnapshot] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!pdfFile) return null;
    return URL.createObjectURL(pdfFile);
  }, [pdfFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    const interval = setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`);
      if (!response.ok) return;
      const data = (await response.json()) as JobRecord;
      setJob(data);
    }, 2000);

    return () => clearInterval(interval);
  }, [job]);

  useEffect(() => {
    if (!job) {
      setOutputSnapshot(null);
      return;
    }
    if (job.status !== 'failed') {
      setOutputSnapshot(job);
    }
  }, [job]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file?.type === 'application/pdf') {
      setPdfFile(file);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!pdfFile) {
      setError('Please upload a PDF first.');
      return;
    }
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('enableVideo', String(enableVideo));
    formData.append('voiceClone', String(voiceClone));
    formData.append('ttsSpeed', String(ttsSpeed));
    formData.append('outputLanguage', outputLanguage);
    if (voiceSample) formData.append('voiceSample', voiceSample);

    const response = await fetch('/api/jobs', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? 'Failed to create job.');
      setLoading(false);
      return;
    }

    const data = (await response.json()) as JobRecord;
    setJob(data);
    setLoading(false);
  };

  const currentStatus = job?.status ?? 'pending';
  const outputJob = job?.status === 'failed' ? outputSnapshot : job;

  return (
    <main className="min-h-screen px-6 py-12 md:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Paper2Video Atelier
          </span>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold text-ink-900 md:text-5xl">
                From dense papers to cinematic explainers.
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-600">
                Upload a PDF, tune your narration, and generate slides, speaker
                notes, and a final video.
              </p>
            </div>
            {job ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                  statusMeta[currentStatus].tone
                } ${statusMeta[currentStatus].text}`}
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                {statusMeta[currentStatus].label}
              </span>
            ) : null}
          </div>
        </header>

        <section className="grid items-start gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-white/80 p-6 shadow-card backdrop-blur">
            <div
              className={`flex h-52 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition ${
                dragActive
                  ? 'border-sky-400 bg-sky-50'
                  : 'border-slate-200 bg-white'
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <p className="text-lg font-semibold text-slate-700">
                Drag a PDF here or browse
              </p>
              <p className="text-sm text-slate-500">
                Optimized for long-form research papers
              </p>
              <label className="cursor-pointer rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-white">
                Upload PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setPdfFile(file);
                      setError(null);
                    }
                  }}
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
              <div className="flex h-[580px] flex-col rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">PDF Preview</p>
                {pdfFile ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{pdfFile.name}</span>
                    <span>{formatBytes(pdfFile.size)}</span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No file selected.</p>
                )}
                {previewUrl ? (
                  <div className="mt-4 flex-1 overflow-hidden rounded-xl border border-slate-200">
                    <embed src={previewUrl} className="h-full w-full" />
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">Options</p>
                <div className="mt-4 flex flex-col gap-4 text-sm text-slate-600">
                  <label className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700">Output language</span>
                    <select
                      value={outputLanguage}
                      onChange={(event) =>
                        setOutputLanguage(event.target.value as 'en' | 'zh')
                      }
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700">Enable video output</span>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-sky-500"
                      checked={enableVideo}
                      onChange={(event) => setEnableVideo(event.target.checked)}
                    />
                  </label>

                  <AnimatePresence initial={false}>
                    {enableVideo ? (
                      <motion.div
                        key="tts-speed"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-sm font-medium text-slate-700">TTS speed</p>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="range"
                            min={0.7}
                            max={1.4}
                            step={0.1}
                            value={ttsSpeed}
                            onChange={(event) => setTtsSpeed(Number(event.target.value))}
                            className="w-full accent-sky-500"
                          />
                          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600">
                            {ttsSpeed.toFixed(1)}x
                          </span>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {enableVideo ? (
                    <>
                      <label className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-700">Voice cloning</span>
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-orange-500"
                          checked={voiceClone}
                          onChange={(event) => setVoiceClone(event.target.checked)}
                        />
                      </label>

                      <AnimatePresence initial={false}>
                        {voiceClone ? (
                          <motion.div
                            key="voice-sample"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4"
                          >
                            <p className="text-sm font-medium text-slate-700">Voice sample</p>
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                setVoiceSample(file);
                              }}
                              className="mt-3 block w-full rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                              Upload a short WAV sample for voice cloning.
                            </p>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="mt-6 w-full rounded-2xl bg-ink-900 px-5 py-3 text-base font-semibold text-white transition hover:translate-y-[-1px] hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Dispatching job…' : 'Generate Slides + Video'}
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-white/85 to-sky-50/60 p-6 text-slate-700 shadow-card backdrop-blur">
              <div className="flex flex-col gap-4">
                {stages.map((stage) => {
                  const failed = job?.status === 'failed';
                  const active = !failed && !!job?.status && stage.activeOn.includes(job.status);
                  const done = !failed && !!job?.status && stage.doneOn.includes(job.status);
                  const showError =
                    failed && job?.error && job.errorStage === stage.id;

                  return (
                    <div
                      key={stage.id}
                      className={`rounded-2xl border px-4 py-3 transition ${
                        active ? 'border-sky-300 bg-sky-50/60' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-base font-semibold">{stage.title}</p>
                        <span
                          className={`text-xs uppercase tracking-[0.2em] ${
                            active
                              ? 'text-emerald-600'
                              : done
                                ? 'text-emerald-500'
                                : 'text-slate-400'
                          }`}
                        >
                          {active ? 'Running' : done ? 'Ready' : 'Waiting'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{stage.detail}</p>
                      {showError ? (
                        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
                          {job.error}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl bg-white/90 p-6 shadow-card backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Outputs</p>
                  <p className="text-xs text-slate-500">
                    Slides JSON, slides PDF, and video artifacts.
                  </p>
                </div>
              </div>

              {outputJob?.slides_json ? (
                <div className="mt-4 flex max-h-[300px] flex-col rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Slide outline
                  </p>
                  <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                    <ul className="space-y-2 text-sm text-slate-600">
                    {outputJob.slides_json.slides.map((slide, index) => (
                      <li key={`${slide.title}-${index}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                        <span>{slide.title}</span>
                      </li>
                    ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No outputs yet.</p>
              )}

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  {outputJob?.paths?.video
                    ? 'Video output is ready for download.'
                    : 'Video output is disabled or not yet rendered.'}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {outputJob?.paths?.slidesPdf ? (
                    <a
                      className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700"
                      href={`/api/jobs/${outputJob.id}/files/slidesPdf`}
                    >
                      Slides
                    </a>
                  ) : null}
                  {outputJob?.paths?.video ? (
                    <a
                      className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700"
                      href={`/api/jobs/${outputJob.id}/files/video`}
                    >
                      Video
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
