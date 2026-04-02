import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { sessionDir } from '@/lib/session-store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const sessionId = formData.get('sessionId');
  const pdf = formData.get('pdf');

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json(
      { error: 'sessionId is required.' },
      { status: 400 }
    );
  }

  if (!pdf || !(pdf instanceof File)) {
    return NextResponse.json(
      { error: 'PDF file is required.' },
      { status: 400 }
    );
  }

  const dir = sessionDir(sessionId);
  await fs.mkdir(dir, { recursive: true });

  const pdfPath = path.join(dir, pdf.name);
  const buffer = Buffer.from(await pdf.arrayBuffer());
  await fs.writeFile(pdfPath, buffer);

  return NextResponse.json({
    sessionId,
    pdfPath: `storage/sessions/${sessionId}/${pdf.name}`,
    pdfName: pdf.name,
  });
}
