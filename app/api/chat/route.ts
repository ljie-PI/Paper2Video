import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent';
import { getSession, updateSession } from '@/lib/session-store';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json();
  const { sessionId, messages } = body;

  if (!sessionId || !messages) {
    return NextResponse.json(
      { error: 'sessionId and messages are required.' },
      { status: 400 }
    );
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found.' },
      { status: 404 }
    );
  }

  await updateSession(sessionId, { status: 'running' });

  const result = await runAgent({
    config: session.config,
    messages,
  });

  return result.toDataStreamResponse();
}
