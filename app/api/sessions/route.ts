import { NextResponse } from 'next/server';
import { createSession, listSessions } from '@/lib/session-store';
import type { SessionConfig } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const sessions = await listSessions();
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const config: SessionConfig = {
    model: body.model || '',
    ttsSpeed: body.ttsSpeed ?? 1,
    voiceId: body.voiceId ?? null,
    outputLanguage: body.outputLanguage ?? 'en',
  };

  const session = await createSession(config);
  return NextResponse.json(session);
}
