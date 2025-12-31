import fs from 'fs/promises';
import type { JobRecord } from './types';
import { jobFile, jobDir } from './storage';

const readJob = async (id: string): Promise<JobRecord | null> => {
  const filePath = jobFile(id);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? (data as JobRecord) : null;
  } catch {
    return null;
  }
};

const writeJob = async (job: JobRecord) => {
  const dir = jobDir(job.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(jobFile(job.id), JSON.stringify(job, null, 2));
};

export const createJob = async (job: JobRecord) => {
  await writeJob(job);
  return job;
};

export const updateJob = async (
  id: string,
  patch: Partial<JobRecord>
): Promise<JobRecord | null> => {
  const current = await readJob(id);
  if (!current) return null;

  const updated: JobRecord = {
    ...current,
    ...patch,
    paths: {
      ...current.paths,
      ...patch.paths
    },
    config: {
      ...current.config,
      ...patch.config
    },
    updated_at: new Date().toISOString()
  };

  await writeJob(updated);
  return updated;
};

export const getJob = async (id: string): Promise<JobRecord | null> => {
  return readJob(id);
};
