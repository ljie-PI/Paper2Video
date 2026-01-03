'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import type { JobRecord, JobStatus } from '@/lib/types';

const formatBytes = (value: number) => {
  if (!value) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, index);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
};

const translations = {
  en: {
    title: 'From dense papers to cinematic explainers.',
    subtitle: 'Upload a PDF, tune your narration, and generate slides, speaker notes, and a final video.',
    dragText: 'Drag a PDF here or browse',
    dragSubtext: 'Optimized for long-form research papers',
    uploadBtn: 'Upload PDF',
    pdfPreview: 'PDF Preview',
    noFile: 'No file selected.',
    options: 'Options',
    outputLanguage: 'Output language',
    enableVideo: 'Enable video output',
    ttsSpeed: 'TTS speed',
    voiceCloning: 'Voice cloning',
    voiceSample: 'Voice sample',
    voiceSampleHint: 'Upload a short WAV sample for voice cloning.',
    generateBtn: 'Generate Slides + Video',
    dispatching: 'Dispatching job…',
    outputs: 'Outputs',
    outputsDesc: 'Slides JSON, slides PDF, and video artifacts.',
    slideOutline: 'Slide outline',
    noOutputs: 'No outputs yet.',
    videoReady: 'Video output is ready for download.',
    videoNotReady: 'Video output is disabled or not yet rendered.',
    slides: 'Slides',
    video: 'Video',
    language: 'Language',
    queued: 'Queued',
    parsing: 'Parsing',
    generating: 'Generating',
    composing: 'Composing',
    rendering: 'Rendering',
    completed: 'Completed',
    failed: 'Failed',
    parsingTitle: 'Parsing',
    parsingDetail: 'PDF -> structured Markdown',
    generatingTitle: 'Generating',
    generatingDetail: 'Markdown -> slides JSON',
    composingTitle: 'Rendering Slides',
    composingDetail: 'LLM layout -> HTML -> PDF',
    renderingTitle: 'Generating Video',
    renderingDetail: 'Video processing',
    running: 'Running',
    ready: 'Ready',
    waiting: 'Waiting',
    uploadError: 'Please upload a PDF first.',
    createError: 'Failed to create job.'
  },
  zh: {
    title: '让密密麻麻的论文，秒变电影级科普。',
    subtitle: '上传PDF，调整旁白，生成幻灯片、演讲笔记和最终视频。',
    dragText: '拖拽PDF到此处或浏览',
    dragSubtext: '专为长篇研究论文优化',
    uploadBtn: '上传PDF',
    pdfPreview: 'PDF预览',
    noFile: '未选择文件。',
    options: '选项',
    outputLanguage: '输出语言',
    enableVideo: '启用视频输出',
    ttsSpeed: '语音速度',
    voiceCloning: '声音克隆',
    voiceSample: '声音样本',
    voiceSampleHint: '上传简短的WAV样本用于声音克隆。',
    generateBtn: '生成幻灯片 + 视频',
    dispatching: '正在处理任务…',
    outputs: '输出',
    outputsDesc: '幻灯片JSON、幻灯片PDF和视频文件。',
    slideOutline: '幻灯片大纲',
    noOutputs: '暂无输出。',
    videoReady: '视频输出已准备好下载。',
    videoNotReady: '视频输出已禁用或尚未渲染。',
    slides: '幻灯片',
    video: '视频',
    language: '语言',
    queued: '排队中',
    parsing: '解析中',
    generating: '生成中',
    composing: '渲染中',
    rendering: '渲染中',
    completed: '已完成',
    failed: '失败',
    parsingTitle: '解析',
    parsingDetail: 'PDF -> 结构化Markdown',
    generatingTitle: '生成',
    generatingDetail: 'Markdown -> 幻灯片JSON',
    composingTitle: '渲染幻灯片',
    composingDetail: 'LLM布局 -> HTML -> PDF',
    renderingTitle: '生成视频',
    renderingDetail: '视频处理',
    running: '运行中',
    ready: '就绪',
    waiting: '等待中',
    uploadError: '请先上传PDF。',
    createError: '创建任务失败。'
  }
};

const statusMeta = {
  pending: { tone: 'bg-slate-200', text: 'text-slate-700' },
  parsing: { tone: 'bg-sky-100', text: 'text-sky-700' },
  generating: { tone: 'bg-indigo-100', text: 'text-indigo-700' },
  composing: { tone: 'bg-amber-100', text: 'text-amber-700' },
  rendering: { tone: 'bg-amber-100', text: 'text-amber-700' },
  completed: { tone: 'bg-emerald-100', text: 'text-emerald-700' },
  failed: { tone: 'bg-rose-100', text: 'text-rose-700' }
} as const;

const stagesBase = [
  {
    id: 'parsing',
    activeOn: ['parsing'] as JobStatus[],
    doneOn: ['generating', 'composing', 'rendering', 'completed'] as JobStatus[]
  },
  {
    id: 'generating',
    activeOn: ['generating'] as JobStatus[],
    doneOn: ['composing', 'rendering', 'completed'] as JobStatus[]
  },
  {
    id: 'composing',
    activeOn: ['composing'] as JobStatus[],
    doneOn: ['rendering', 'completed'] as JobStatus[]
  },
  {
    id: 'rendering',
    activeOn: ['rendering'] as JobStatus[],
    doneOn: ['completed'] as JobStatus[]
  }
];

export default function HomePage() {
  const searchParams = useSearchParams();
  const jobIdParam = useMemo(() => {
    const raw = searchParams.get('jobId') ?? searchParams.get('jobid');
    return raw ? raw.trim() : '';
  }, [searchParams]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [voiceSample, setVoiceSample] = useState<File | null>(null);
  const [enableVideo, setEnableVideo] = useState(true);
  const [voiceClone, setVoiceClone] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [outputLanguage, setOutputLanguage] = useState<'en' | 'zh'>('zh');
  const [uiLanguage, setUiLanguage] = useState<'en' | 'zh'>('zh');
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
    if (!jobIdParam) return;
    let active = true;
    fetch(`/api/jobs/${jobIdParam}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as JobRecord;
      })
      .then((data) => {
        if (!active || !data) return;
        setJob(data);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [jobIdParam]);

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
    if (!pdfFile && !jobIdParam) {
      setError(t.uploadError);
      return;
    }
    setError(null);
    setLoading(true);

    const formData = new FormData();
    if (jobIdParam) {
      formData.append('jobId', jobIdParam);
    }
    if (pdfFile) {
      formData.append('pdf', pdfFile);
    }
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
      setError(payload.error ?? t.createError);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as JobRecord;
    setJob(data);
    setLoading(false);
  };

  const currentStatus = job?.status ?? 'pending';
  const outputJob = job?.status === 'failed' ? outputSnapshot : job;
  const t = translations[uiLanguage];

  const stages = useMemo(() => stagesBase.map(stage => ({
    ...stage,
    title: t[`${stage.id}Title` as keyof typeof t] as string,
    detail: t[`${stage.id}Detail` as keyof typeof t] as string
  })), [t]);

  const getStatusLabel = (status: JobStatus): string => {
    return t[status as keyof typeof t] as string;
  };

  return (
    <main className="min-h-screen px-6 py-12 md:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Paper2Video Atelier
              </span>
              <h1 className="mt-2 text-4xl font-semibold text-ink-900 md:text-5xl">
                {t.title}
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-slate-600">
                {t.subtitle}
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <select
                value={uiLanguage}
                onChange={(event) => setUiLanguage(event.target.value as 'en' | 'zh')}
                className="rounded-lg border border-slate-300 bg-slate-50 px-6 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1"
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
              {job ? (
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                    statusMeta[currentStatus].tone
                  } ${statusMeta[currentStatus].text}`}
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  {getStatusLabel(currentStatus)}
                </span>
              ) : null}
            </div>
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
                {t.dragText}
              </p>
              <p className="text-sm text-slate-500">
                {t.dragSubtext}
              </p>
              <label className="cursor-pointer rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-white">
                {t.uploadBtn}
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

            <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="flex h-[580px] flex-col rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">{t.pdfPreview}</p>
                {pdfFile ? (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{pdfFile.name}</span>
                    <span>{formatBytes(pdfFile.size)}</span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">{t.noFile}</p>
                )}
                {previewUrl ? (
                  <div className="mt-4 flex-1 overflow-hidden rounded-xl border border-slate-200">
                    <embed src={previewUrl} className="h-full w-full" />
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">{t.options}</p>
                <div className="mt-4 flex flex-col gap-4 text-sm text-slate-600">
                  <label className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700">{t.outputLanguage}</span>
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
                    <span className="font-medium text-slate-700">{t.enableVideo}</span>
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
                        <p className="text-sm font-medium text-slate-700">{t.ttsSpeed}</p>
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
                        <span className="font-medium text-slate-700">{t.voiceCloning}</span>
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
                            <p className="text-sm font-medium text-slate-700">{t.voiceSample}</p>
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
                              {t.voiceSampleHint}
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
              {loading ? t.dispatching : t.generateBtn}
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
                          {active ? t.running : done ? t.ready : t.waiting}
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
                  <p className="text-sm font-semibold text-slate-700">{t.outputs}</p>
                  <p className="text-xs text-slate-500">
                    {t.outputsDesc}
                  </p>
                </div>
              </div>

              {outputJob?.slides_json ? (
                <div className="mt-4 flex max-h-[300px] flex-col rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {t.slideOutline}
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
                <p className="mt-4 text-sm text-slate-500">{t.noOutputs}</p>
              )}

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  {outputJob?.paths?.video
                    ? t.videoReady
                    : t.videoNotReady}
                </div>
                <div className="flex justify-center gap-6">
                  {outputJob?.paths?.slidesPdf ? (
                    <a
                      className="w-32 rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700"
                      href={`/api/jobs/${outputJob.id}/files/slidesPdf`}
                    >
{t.slides}
                    </a>
                  ) : null}
                  {outputJob?.paths?.video ? (
                    <a
                      className="w-32 rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700"
                      href={`/api/jobs/${outputJob.id}/files/video`}
                    >
{t.video}
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
