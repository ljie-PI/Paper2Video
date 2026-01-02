import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getJob, updateJob } from '@/lib/job-store';
import { renderSlides } from '@/lib/render-slides';
import { renderVideoFromSlides } from '@/lib/video';
import type { SlidesJSON } from '@/lib/types';

export const runtime = 'nodejs';

const loadSlides = async (
  job: { slides_json?: SlidesJSON; paths?: { slides?: string } }
) => {
  if (job.slides_json) return job.slides_json;
  if (!job.paths?.slides) return null;
  const absolutePath = path.isAbsolute(job.paths.slides)
    ? job.paths.slides
    : path.join(process.cwd(), job.paths.slides);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(raw) as SlidesJSON;
};

const loadTtsAudio = async (jobId: string, slideCount: number) => {
  const audioDir = path.join(process.cwd(), 'storage', 'outputs', jobId, 'tts');
  let entries: string[] = [];
  try {
    entries = await fs.readdir(audioDir);
  } catch {
    return null;
  }

  const audioByIndex = new Map<number, string>();
  for (const entry of entries) {
    const match = entry.match(/^slide-(\d+)\.(wav|mp3|ogg)$/i);
    if (!match) continue;
    const index = Number.parseInt(match[1], 10) - 1;
    if (!Number.isFinite(index) || index < 0) continue;
    if (audioByIndex.has(index)) continue;
    audioByIndex.set(index, path.join(audioDir, entry));
  }

  const audio: Array<{ index: number; path: string }> = [];
  for (let index = 0; index < slideCount; index += 1) {
    const filePath = audioByIndex.get(index);
    if (!filePath) {
      return null;
    }
    audio.push({
      index,
      path: path.relative(process.cwd(), filePath)
    });
  }

  return audio;
};

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const slides = await loadSlides(job);
  if (!slides) {
    return NextResponse.json({ error: 'Slides are missing.' }, { status: 400 });
  }

  try {
    const rendered = await renderSlides(slides, id, job.config);
    const ttsAudio = await loadTtsAudio(id, slides.slides.length);
    if (!ttsAudio) {
      return NextResponse.json(
        { error: 'TTS audio is missing. Generate TTS first.' },
        { status: 400 }
      );
    }
    const videoPath = await renderVideoFromSlides({
      jobId: id,
      slideImages: rendered.images,
      slideAudios: ttsAudio,
      transitionSeconds: 1
    });

    await updateJob(id, {
      paths: {
        rendered: rendered.manifestPath,
        slidesPdf: rendered.pdfPath,
        video: videoPath
      }
    });

    return NextResponse.json({ video: videoPath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
