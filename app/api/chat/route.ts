import { NextResponse } from 'next/server';

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

  // TODO: Phase 2 will implement agent streaming via streamText()
  return NextResponse.json({
    message: 'Chat endpoint ready. Agent implementation pending.',
    sessionId,
  });
}
