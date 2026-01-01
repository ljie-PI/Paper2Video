import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getJob, updateJob } from '@/lib/job-store';
import { renderSlides } from '@/lib/render-slides';
import type { SlidesJSON } from '@/lib/types';

export const runtime = 'nodejs';

const loadSlides = async (jobId: string, job: { slides_json?: SlidesJSON; paths?: { slides?: string } }) => {
  if (job.slides_json) return job.slides_json;
  if (!job.paths?.slides) return null;
  const absolutePath = path.isAbsolute(job.paths.slides)
    ? job.paths.slides
    : path.join(process.cwd(), job.paths.slides);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return JSON.parse(raw) as SlidesJSON;
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

  const slides = await loadSlides(id, job);
  if (!slides) {
    return NextResponse.json({ error: 'Slides are missing.' }, { status: 400 });
  }

  const rendered = await renderSlides(slides, id, job.config);
  await updateJob(id, {
    paths: {
      rendered: rendered.manifestPath,
      slidesPdf: rendered.pdfPath
    }
  });

  return NextResponse.json({ rendered });
}
