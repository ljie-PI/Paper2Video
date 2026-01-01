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
  slidesPdf: 'slides.pdf'
};

export async function GET(
  _: Request,
  { params }: { params: { id: string; type: string } }
) {
  const job = await getJob(params.id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const filePath = job.paths?.[params.type as keyof typeof job.paths];
  if (!filePath) {
    return NextResponse.json({ error: 'File not available.' }, { status: 404 });
  }

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  try {
    const data = await fs.readFile(absolutePath);
    const fileName = downloadNames[params.type] ?? params.type;
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentTypes[params.type] ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch {
    return NextResponse.json({ error: 'File missing.' }, { status: 404 });
  }
}
