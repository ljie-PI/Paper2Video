import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getJob, updateJob } from '@/lib/job-store';
import { generateSlides, writeSlidesJson } from '@/lib/generating';

export const runtime = 'nodejs';

const loadMarkdown = async (job: { markdown_content?: string; paths?: { doc?: string } }) => {
  if (job.markdown_content) return job.markdown_content;
  if (!job.paths?.doc) return null;
  const absolutePath = path.isAbsolute(job.paths.doc)
    ? job.paths.doc
    : path.join(process.cwd(), job.paths.doc);
  return fs.readFile(absolutePath, 'utf8');
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

  const markdown = await loadMarkdown(job);
  if (!markdown) {
    return NextResponse.json({ error: 'Markdown missing.' }, { status: 400 });
  }

  const slides = await generateSlides(markdown, job.config);
  const slidesPath = await writeSlidesJson(id, slides);

  await updateJob(id, {
    slides_json: slides,
    paths: { slides: slidesPath }
  });

  return NextResponse.json({ slides, slidesPath });
}
