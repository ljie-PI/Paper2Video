import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { storageRoot } from '@/lib/storage';

export const runtime = 'nodejs';

const mimeTypes: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.md': 'text/markdown',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = path.join(storageRoot, 'sessions', ...segments);

  // Prevent path traversal
  const resolved = path.resolve(filePath);
  const sessionsRoot = path.resolve(path.join(storageRoot, 'sessions'));
  if (!resolved.startsWith(sessionsRoot)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Not a file.' }, { status: 400 });
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const buffer = await fs.readFile(resolved);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }
}
