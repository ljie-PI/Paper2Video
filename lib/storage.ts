import path from 'path';

export const storageRoot = path.join(process.cwd(), 'storage');

export const uploadsDir = (jobId: string) =>
  path.join(storageRoot, 'uploads', jobId);

export const outputsDir = (jobId: string) =>
  path.join(storageRoot, 'outputs', jobId);

export const jobDir = (jobId: string) => path.join(storageRoot, jobId);

export const jobFile = (jobId: string) => path.join(jobDir(jobId), 'job.json');

const isWindowsAbsolutePath = (value: string) =>
  /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\');

const isAbsolutePath = (value: string) =>
  path.posix.isAbsolute(value) || path.win32.isAbsolute(value);

const normalizeRelativePath = (value: string) => {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
  return normalized === '' ? '.' : normalized.replace(/^\.\//, '');
};

export const toRelativePath = (filePath: string) => {
  if (!isAbsolutePath(filePath)) {
    return normalizeRelativePath(filePath);
  }

  const cwd = process.cwd();
  const pathApi =
    isWindowsAbsolutePath(filePath) || isWindowsAbsolutePath(cwd)
      ? path.win32
      : path.posix;
  const relativePath = normalizeRelativePath(
    pathApi.relative(pathApi.normalize(cwd), pathApi.normalize(filePath))
  );

  if (relativePath === '..' || relativePath.startsWith('../')) {
    throw new Error(`Path is outside repository root: ${filePath}`);
  }

  return relativePath;
};
