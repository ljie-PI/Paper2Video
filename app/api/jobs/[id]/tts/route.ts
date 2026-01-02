import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getJob } from '@/lib/job-store';
import { generateSlideNarrations } from '@/lib/tts';
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleTtsRequest(request, params);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleTtsRequest(request, params);
}

const handleTtsRequest = async (
  request: Request,
  params: Promise<{ id: string }>
) => {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const slides = await loadSlides(job);
  if (!slides) {
    return NextResponse.json({ error: 'Slides are missing.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const speechRateParam = url.searchParams.get('speech_rate');
  const speechRateValue =
    speechRateParam && Number.isFinite(Number(speechRateParam))
      ? Number(speechRateParam)
      : undefined;

  try {
    const result = await generateSlideNarrations(slides, id, job.config, {
      speechRate: speechRateValue
    });
    return NextResponse.json({ audio: result.audio });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};
