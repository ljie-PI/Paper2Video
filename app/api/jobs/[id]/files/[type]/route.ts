import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getJob } from '@/lib/job-store';

export const runtime = 'nodejs';

const contentTypes: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'text/markdown',
  slides: 'application/json',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rendered: 'application/json',
  slidesPdf: 'application/pdf',
  video: 'video/mp4'
};

const downloadNames: Record<string, string> = {
  slidesPdf: 'slides.pdf',
  video: 'video.mp4'
};

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id, type } = await params;
  const job = await getJob(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const filePath = job.paths?.[type as keyof typeof job.paths];
  if (!filePath) {
    return NextResponse.json({ error: 'File not available.' }, { status: 404 });
  }

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  try {
    const data = await fs.readFile(absolutePath);
    const fileName = downloadNames[type] ?? type;
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentTypes[type] ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch {
    return NextResponse.json({ error: 'File missing.' }, { status: 404 });
  }
}
