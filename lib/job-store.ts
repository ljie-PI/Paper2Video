import fs from 'fs/promises';
import path from 'path';
import type { JobRecord } from './types';

const jobsPath = path.join(process.cwd(), 'storage', 'jobs.json');

const readJobs = async (): Promise<JobRecord[]> => {
  try {
    const raw = await fs.readFile(jobsPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const writeJobs = async (jobs: JobRecord[]) => {
  await fs.mkdir(path.dirname(jobsPath), { recursive: true });
  await fs.writeFile(jobsPath, JSON.stringify(jobs, null, 2));
};

export const createJob = async (job: JobRecord) => {
  const jobs = await readJobs();
  jobs.push(job);
  await writeJobs(jobs);
  return job;
};

export const updateJob = async (
  id: string,
  patch: Partial<JobRecord>
): Promise<JobRecord | null> => {
  const jobs = await readJobs();
  const index = jobs.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const current = jobs[index];
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

  jobs[index] = updated;
  await writeJobs(jobs);
  return updated;
};

export const getJob = async (id: string): Promise<JobRecord | null> => {
  const jobs = await readJobs();
  return jobs.find((item) => item.id === id) ?? null;
};
