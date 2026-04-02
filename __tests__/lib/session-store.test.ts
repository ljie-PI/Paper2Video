import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'test-uuid-1234'),
  },
}));

vi.mock('@/lib/storage', () => ({
  storageRoot: '/mock/storage',
}));

import fs from 'fs/promises';
import {
  createSession,
  getSession,
  updateSession,
  listSessions,
  addArtifact,
  appendMessage,
  sessionDir,
  sessionFile,
} from '@/lib/session-store';
import type { SessionConfig, Artifact, SessionMessage } from '@/lib/types';

const mockFs = vi.mocked(fs);

const baseConfig: SessionConfig = {
  model: 'gpt-4o',
  ttsSpeed: 1.0,
  voiceId: null,
  outputLanguage: 'en',
};

const fakeSession = () => ({
  id: 'test-uuid-1234',
  status: 'idle' as const,
  config: baseConfig,
  artifacts: [],
  messages: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.writeFile.mockResolvedValue(undefined);
});

describe('sessionDir / sessionFile', () => {
  it('returns correct directory path', () => {
    expect(sessionDir('abc')).toContain('sessions');
    expect(sessionDir('abc')).toContain('abc');
  });

  it('returns correct file path', () => {
    expect(sessionFile('abc')).toContain('session.json');
  });
});

describe('createSession', () => {
  it('creates a session with a random UUID and writes to disk', async () => {
    const session = await createSession(baseConfig);

    expect(session.id).toBe('test-uuid-1234');
    expect(session.status).toBe('idle');
    expect(session.config).toEqual(baseConfig);
    expect(session.artifacts).toEqual([]);
    expect(session.messages).toEqual([]);
    expect(session.createdAt).toBeDefined();
    expect(session.updatedAt).toBeDefined();
    expect(mockFs.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('test-uuid-1234'),
      { recursive: true },
    );
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('session.json'),
      expect.any(String),
    );
  });

  it('writes valid JSON to disk', async () => {
    await createSession(baseConfig);

    const writtenJson = mockFs.writeFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed.id).toBe('test-uuid-1234');
    expect(parsed.config.model).toBe('gpt-4o');
  });
});

describe('getSession', () => {
  it('returns parsed session when file exists', async () => {
    const session = fakeSession();
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    const result = await getSession('test-uuid-1234');

    expect(result).toEqual(session);
    expect(mockFs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('test-uuid-1234'),
      'utf8',
    );
  });

  it('returns null when file does not exist', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await getSession('nonexistent');

    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    mockFs.readFile.mockResolvedValue('not-json');

    const result = await getSession('bad-json');

    expect(result).toBeNull();
  });

  it('returns null for non-object JSON', async () => {
    mockFs.readFile.mockResolvedValue('"just a string"');

    const result = await getSession('string-json');

    expect(result).toBeNull();
  });
});

describe('updateSession', () => {
  it('merges patch into existing session', async () => {
    const session = fakeSession();
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    const result = await updateSession('test-uuid-1234', {
      status: 'running',
    });

    expect(result).not.toBeNull();
    expect(result!.status).toBe('running');
    expect(result!.config).toEqual(baseConfig);
    expect(result!.updatedAt).not.toBe(session.updatedAt);
  });

  it('deep-merges config', async () => {
    const session = fakeSession();
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    const result = await updateSession('test-uuid-1234', {
      config: { model: 'claude-3-opus', ttsSpeed: 1.5 },
    });

    expect(result!.config.model).toBe('claude-3-opus');
    expect(result!.config.ttsSpeed).toBe(1.5);
  });

  it('returns null when session does not exist', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await updateSession('nonexistent', { status: 'failed' });

    expect(result).toBeNull();
  });

  it('writes updated session back to disk', async () => {
    const session = fakeSession();
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    await updateSession('test-uuid-1234', { status: 'completed' });

    expect(mockFs.writeFile).toHaveBeenCalled();
    const writtenJson = mockFs.writeFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed.status).toBe('completed');
  });
});

describe('listSessions', () => {
  it('returns sessions sorted by updatedAt descending', async () => {
    const sessionA = {
      ...fakeSession(),
      id: 'aaa',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const sessionB = {
      ...fakeSession(),
      id: 'bbb',
      updatedAt: '2024-06-01T00:00:00.000Z',
    };

    mockFs.readdir.mockResolvedValue([
      { name: 'aaa', isDirectory: () => true },
      { name: 'bbb', isDirectory: () => true },
    ] as any);

    mockFs.readFile.mockImplementation(async (filePath: any) => {
      if (String(filePath).includes('aaa')) return JSON.stringify(sessionA);
      if (String(filePath).includes('bbb')) return JSON.stringify(sessionB);
      throw new Error('ENOENT');
    });

    const result = await listSessions();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('bbb'); // newer first
    expect(result[1].id).toBe('aaa');
  });

  it('filters out non-directory entries', async () => {
    const session = fakeSession();
    mockFs.readdir.mockResolvedValue([
      { name: 'aaa', isDirectory: () => true },
      { name: 'some-file.txt', isDirectory: () => false },
    ] as any);
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    const result = await listSessions();

    expect(result).toHaveLength(1);
  });

  it('filters out sessions that fail to read', async () => {
    mockFs.readdir.mockResolvedValue([
      { name: 'aaa', isDirectory: () => true },
      { name: 'bad', isDirectory: () => true },
    ] as any);

    mockFs.readFile.mockImplementation(async (filePath: any) => {
      if (String(filePath).includes('bad')) throw new Error('corrupt');
      return JSON.stringify(fakeSession());
    });

    const result = await listSessions();

    expect(result).toHaveLength(1);
  });

  it('returns empty array when sessions directory does not exist', async () => {
    mockFs.readdir.mockRejectedValue(new Error('ENOENT'));

    const result = await listSessions();

    expect(result).toEqual([]);
  });
});

describe('addArtifact', () => {
  it('appends artifact to session', async () => {
    const session = fakeSession();
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    const artifact: Artifact = {
      id: 'art-1',
      type: 'plan',
      label: 'Video Plan',
      path: '/mock/storage/plan.json',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const result = await addArtifact('test-uuid-1234', artifact);

    expect(result).not.toBeNull();
    expect(result!.artifacts).toHaveLength(1);
    expect(result!.artifacts[0]).toEqual(artifact);
  });

  it('preserves existing artifacts', async () => {
    const existingArtifact: Artifact = {
      id: 'art-0',
      type: 'markdown',
      label: 'Existing',
      path: '/mock/existing',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const session = { ...fakeSession(), artifacts: [existingArtifact] };
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    const newArtifact: Artifact = {
      id: 'art-1',
      type: 'audio',
      label: 'New',
      path: '/mock/new',
      createdAt: '2024-01-02T00:00:00.000Z',
    };

    const result = await addArtifact('test-uuid-1234', newArtifact);

    expect(result!.artifacts).toHaveLength(2);
    expect(result!.artifacts[0]).toEqual(existingArtifact);
    expect(result!.artifacts[1]).toEqual(newArtifact);
  });

  it('returns null when session does not exist', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

    const artifact: Artifact = {
      id: 'art-1',
      type: 'plan',
      label: 'Plan',
      path: '/mock',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const result = await addArtifact('nonexistent', artifact);

    expect(result).toBeNull();
  });
});

describe('appendMessage', () => {
  it('appends message to session', async () => {
    const session = fakeSession();
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    const message: SessionMessage = {
      role: 'user',
      content: 'Hello world',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const result = await appendMessage('test-uuid-1234', message);

    expect(result).not.toBeNull();
    expect(result!.messages).toHaveLength(1);
    expect(result!.messages[0]).toEqual(message);
  });

  it('preserves existing messages', async () => {
    const existingMsg: SessionMessage = {
      role: 'user',
      content: 'First',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const session = { ...fakeSession(), messages: [existingMsg] };
    mockFs.readFile.mockResolvedValue(JSON.stringify(session));

    const newMsg: SessionMessage = {
      role: 'assistant',
      content: 'Second',
      createdAt: '2024-01-02T00:00:00.000Z',
    };

    const result = await appendMessage('test-uuid-1234', newMsg);

    expect(result!.messages).toHaveLength(2);
    expect(result!.messages[0]).toEqual(existingMsg);
    expect(result!.messages[1]).toEqual(newMsg);
  });

  it('returns null when session does not exist', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

    const message: SessionMessage = {
      role: 'user',
      content: 'Hello',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const result = await appendMessage('nonexistent', message);

    expect(result).toBeNull();
  });
});
