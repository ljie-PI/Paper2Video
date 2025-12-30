import path from 'path';

export const storageRoot = path.join(process.cwd(), 'storage');

export const uploadsDir = (jobId: string) =>
  path.join(storageRoot, 'uploads', jobId);

export const outputsDir = (jobId: string) =>
  path.join(storageRoot, 'outputs', jobId);

export const toRelativePath = (absolutePath: string) =>
  absolutePath.replace(process.cwd() + path.sep, '');
