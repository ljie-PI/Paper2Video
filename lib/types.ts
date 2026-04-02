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

// ─── Agent Architecture Types ───────────────────────────────────

export type SessionStatus = 'idle' | 'running' | 'completed' | 'failed';

export type SessionConfig = {
  model: string;
  ttsSpeed: number;
  voiceId?: string | null;
  outputLanguage?: 'zh' | 'en';
};

export type VideoPlan = {
  segments: VideoSegment[];
  totalDuration?: number;
};

export type VideoSegment = {
  id: string;
  type: 'title' | 'narration' | 'image' | 'side-by-side' | 'table';
  title?: string;
  content?: string;
  imageUrl?: string;
  tableData?: string[][];
  narration?: string;
  durationSeconds?: number;
  status: 'planned' | 'tts-done' | 'rendered' | 'failed';
  audioPath?: string;
  videoPath?: string;
};

export type Artifact = {
  id: string;
  type: 'plan' | 'audio' | 'video-segment' | 'video-final' | 'markdown' | 'image';
  label: string;
  path: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type SessionMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallRecord[];
  createdAt: string;
};

export type ToolCallRecord = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
};

export type SessionRecord = {
  id: string;
  status: SessionStatus;
  config: SessionConfig;
  pdfPath?: string;
  pdfName?: string;
  markdownContent?: string;
  videoPlan?: VideoPlan;
  artifacts: Artifact[];
  messages: SessionMessage[];
  createdAt: string;
  updatedAt: string;
  error?: string | null;
};
