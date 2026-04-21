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

const assertRepoRelativePath = (relativePath: string, originalPath: string) => {
  if (
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    isAbsolutePath(relativePath) ||
    isWindowsAbsolutePath(relativePath)
  ) {
    throw new Error(`Path is outside repository root: ${originalPath}`);
  }
};

export const toRelativePath = (filePath: string) => {
  if (!isAbsolutePath(filePath)) {
    const relativePath = normalizeRelativePath(filePath);
    assertRepoRelativePath(relativePath, filePath);
    return relativePath;
  }

  const cwd = process.cwd();
  const pathApi =
    isWindowsAbsolutePath(filePath) || isWindowsAbsolutePath(cwd)
      ? path.win32
      : path.posix;
  const normalizedCwd = pathApi.normalize(cwd);
  const normalizedFilePath = pathApi.normalize(filePath);
  const cwdRoot = pathApi.parse(normalizedCwd).root;
  const filePathRoot = pathApi.parse(normalizedFilePath).root;
  const rootsMatch =
    pathApi === path.win32
      ? cwdRoot.toLowerCase() === filePathRoot.toLowerCase()
      : cwdRoot === filePathRoot;

  if (!rootsMatch) {
    throw new Error(`Path is outside repository root: ${filePath}`);
  }

  const relativePath = normalizeRelativePath(
    pathApi.relative(normalizedCwd, normalizedFilePath)
  );
  assertRepoRelativePath(relativePath, filePath);
  return relativePath;
};
