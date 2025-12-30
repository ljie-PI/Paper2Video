export type JobStatus =
  | 'pending'
  | 'parsing'
  | 'generating'
  | 'rendering'
  | 'completed'
  | 'failed';

export type JobConfig = {
  model: string;
  enableVideo: boolean;
  voiceClone: boolean;
  ttsSpeed: number;
  voiceId?: string | null;
};

export type Slide = {
  id: string;
  title: string;
  bullets: string[];
  speakerNotes: string;
  visualPrompt?: string;
  durationSec?: number;
};

export type SlidesJSON = {
  title: string;
  slides: Slide[];
};

export type JobPaths = {
  pdf?: string;
  voiceSample?: string;
  doc?: string;
  slides?: string;
  pptx?: string;
  video?: string;
  srt?: string;
};

export type JobRecord = {
  id: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  markdown_content?: string;
  slides_json?: SlidesJSON;
  config: JobConfig;
  paths: JobPaths;
  error?: string | null;
};
