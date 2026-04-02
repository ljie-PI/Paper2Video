import { describe, it, expect } from 'vitest';
import path from 'path';
import { storageRoot, uploadsDir, outputsDir, jobDir, jobFile, toRelativePath } from '@/lib/storage';

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
  it('strips cwd prefix from absolute path', () => {
    const abs = path.join(process.cwd(), 'storage', 'uploads', 'file.pdf');
    const result = toRelativePath(abs);
    expect(result).toBe(path.join('storage', 'uploads', 'file.pdf'));
  });

  it('returns original path if cwd prefix is not present', () => {
    const foreign = path.join('other', 'dir', 'file.txt');
    const result = toRelativePath(foreign);
    // Should return unchanged since cwd prefix isn't present
    expect(result).toBe(foreign);
  });
});
