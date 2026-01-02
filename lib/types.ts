export type JobStatus =
  | 'pending'
  | 'parsing'
  | 'generating'
  | 'composing'
  | 'rendering'
  | 'completed'
  | 'failed';

export type JobConfig = {
  model: string;
  enableVideo: boolean;
  voiceClone: boolean;
  ttsSpeed: number;
  voiceId?: string | null;
  outputLanguage?: 'zh' | 'en';
};

export type SlideImage = {
  path: string;
  width: number;
  height: number;
};

export type Slide = {
  title: string;
  text_contents: string;
  images: SlideImage[];
  tables: string[];
  transcript: string;
};

export type SlidesJSON = {
  slides: Slide[];
};

export type JobPaths = {
  pdf?: string;
  voiceSample?: string;
  doc?: string;
  slides?: string;
  rendered?: string;
  slidesPdf?: string;
  pptx?: string;
  video?: string;
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
  errorStage?: string | null;
  error?: string | null;
};
