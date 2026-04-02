import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { SessionRecord, SessionConfig, SessionStatus, Artifact, SessionMessage } from './types';
import { storageRoot } from './storage';

export const sessionDir = (id: string) =>
  path.join(storageRoot, 'sessions', id);

export const sessionFile = (id: string) =>
  path.join(sessionDir(id), 'session.json');

const readSession = async (id: string): Promise<SessionRecord | null> => {
  const filePath = sessionFile(id);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? (data as SessionRecord) : null;
  } catch {
    return null;
  }
};

const writeSession = async (session: SessionRecord) => {
  const dir = sessionDir(session.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(sessionFile(session.id), JSON.stringify(session, null, 2));
};

export const createSession = async (config: SessionConfig): Promise<SessionRecord> => {
  const now = new Date().toISOString();
  const session: SessionRecord = {
    id: crypto.randomUUID(),
    status: 'idle',
    config,
    artifacts: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  await writeSession(session);
  return session;
};

export const getSession = async (id: string): Promise<SessionRecord | null> => {
  return readSession(id);
};

export const updateSession = async (
  id: string,
  patch: Partial<SessionRecord>
): Promise<SessionRecord | null> => {
  const current = await readSession(id);
  if (!current) return null;

  const updated: SessionRecord = {
    ...current,
    ...patch,
    config: {
      ...current.config,
      ...patch.config,
    },
    updatedAt: new Date().toISOString(),
  };

  await writeSession(updated);
  return updated;
};

export const listSessions = async (): Promise<
  Array<{ id: string; status: SessionStatus; pdfName?: string; createdAt: string; updatedAt: string }>
> => {
  const sessionsDir = path.join(storageRoot, 'sessions');
  try {
    const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    const results = await Promise.all(
      dirs.map(async (dir) => {
        const session = await readSession(dir.name);
        if (!session) return null;
        return {
          id: session.id,
          status: session.status,
          pdfName: session.pdfName,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        };
      })
    );

    return results
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
};

export const addArtifact = async (
  id: string,
  artifact: Artifact
): Promise<SessionRecord | null> => {
  const current = await readSession(id);
  if (!current) return null;

  const updated: SessionRecord = {
    ...current,
    artifacts: [...current.artifacts, artifact],
    updatedAt: new Date().toISOString(),
  };

  await writeSession(updated);
  return updated;
};

export const appendMessage = async (
  id: string,
  message: SessionMessage
): Promise<SessionRecord | null> => {
  const current = await readSession(id);
  if (!current) return null;

  const updated: SessionRecord = {
    ...current,
    messages: [...current.messages, message],
    updatedAt: new Date().toISOString(),
  };

  await writeSession(updated);
  return updated;
};
