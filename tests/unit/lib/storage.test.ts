import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { storageRoot, uploadsDir, outputsDir, jobDir, jobFile, toRelativePath } from '@/lib/storage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storageRoot', () => {
  it('points to storage directory under cwd', () => {
    expect(storageRoot).toBe(path.join(process.cwd(), 'storage'));
  });
});

describe('uploadsDir', () => {
  it('returns uploads subdirectory for a job', () => {
    const result = uploadsDir('job-123');
    expect(result).toBe(path.join(storageRoot, 'uploads', 'job-123'));
  });
});

describe('outputsDir', () => {
  it('returns outputs subdirectory for a job', () => {
    const result = outputsDir('job-123');
    expect(result).toBe(path.join(storageRoot, 'outputs', 'job-123'));
  });
});

describe('jobDir', () => {
  it('returns job directory directly under storage root', () => {
    const result = jobDir('job-456');
    expect(result).toBe(path.join(storageRoot, 'job-456'));
  });
});

describe('jobFile', () => {
  it('returns path to job.json inside job directory', () => {
    const result = jobFile('job-789');
    expect(result).toBe(path.join(storageRoot, 'job-789', 'job.json'));
  });
});

describe('toRelativePath', () => {
  it('strips cwd prefix from absolute path and normalizes separators', () => {
    const abs = path.join(process.cwd(), 'storage', 'uploads', 'file.pdf');
    const result = toRelativePath(abs);
    expect(result).toBe('storage/uploads/file.pdf');
  });

  it('normalizes already-relative paths to forward slashes', () => {
    const result = toRelativePath('storage\\uploads\\file.pdf');
    expect(result).toBe('storage/uploads/file.pdf');
  });

  it('throws when a relative path escapes the repo root', () => {
    expect(() => toRelativePath('../secrets.txt')).toThrow(
      'Path is outside repository root: ../secrets.txt'
    );
    expect(() => toRelativePath('storage/../../secrets.txt')).toThrow(
      'Path is outside repository root: storage/../../secrets.txt'
    );
  });

  it('handles Windows-style absolute paths under the repo root', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('C:\\repo\\Paper2Video');
    const result = toRelativePath('C:\\repo\\Paper2Video\\storage\\outputs\\job-1\\paper.md');
    expect(result).toBe('storage/outputs/job-1/paper.md');
  });

  it('throws when a Windows absolute path is on a different root', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('C:\\repo\\Paper2Video');
    expect(() => toRelativePath('D:\\repo\\Paper2Video\\storage\\outputs\\job-1\\paper.md')).toThrow(
      'Path is outside repository root: D:\\repo\\Paper2Video\\storage\\outputs\\job-1\\paper.md'
    );
  });

  it('throws when an absolute path is outside the repo root', () => {
    const foreign = path.join(path.dirname(process.cwd()), 'other', 'dir', 'file.txt');
    expect(() => toRelativePath(foreign)).toThrow(
      `Path is outside repository root: ${foreign}`
    );
  });

  it('returns dot for the repo root itself', () => {
    const result = toRelativePath(process.cwd());
    expect(result).toBe('.');
  });

  it('preserves clean relative paths', () => {
    const foreign = path.join('other', 'dir', 'file.txt');
    const result = toRelativePath(foreign);
    expect(result).toBe('other/dir/file.txt');
  });
});
