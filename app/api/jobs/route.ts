import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createJob, getJob, updateJob } from '@/lib/job-store';
import { startJobPipeline } from '@/lib/pipeline';
import type { JobConfig, JobRecord } from '@/lib/types';
import { uploadsDir, toRelativePath } from '@/lib/storage';

export const runtime = 'nodejs';

const parseBoolean = (value: FormDataEntryValue | null) => value === 'true';

export async function POST(request: Request) {
  const formData = await request.formData();
  const requestedIdValue = formData.get('jobId') ?? formData.get('jobid');
  const requestedId =
    typeof requestedIdValue === 'string' ? requestedIdValue.trim() : '';
  const pdf = formData.get('pdf');

  const rawLanguage = formData.get('outputLanguage');
  const outputLanguage =
    rawLanguage === 'zh' || rawLanguage === 'en' ? rawLanguage : undefined;

  const modelValue = formData.get('model');
  const model = typeof modelValue === 'string' ? modelValue : '';

  const config: JobConfig = {
    model,
    enableVideo: parseBoolean(formData.get('enableVideo')),
    voiceClone: parseBoolean(formData.get('voiceClone')),
    ttsSpeed: Number(formData.get('ttsSpeed') ?? 1),
    voiceId: formData.get('voiceId') ? String(formData.get('voiceId')) : null,
    outputLanguage
  };

  if (requestedId) {
    const existing = await getJob(requestedId);
    if (existing) {
      if (!existing.paths.pdf) {
        return NextResponse.json(
          { error: 'Existing job is missing PDF file.' },
          { status: 400 }
        );
      }

      const updated = await updateJob(requestedId, {
        status: 'pending',
        error: null,
        errorStage: null,
        config: existing.config
      });

      startJobPipeline(requestedId);
      return NextResponse.json(updated ?? existing);
    }
  }

  if (!pdf || !(pdf instanceof File)) {
    return NextResponse.json({ error: 'PDF file is required.' }, { status: 400 });
  }

  const id = requestedId || crypto.randomUUID();
  const uploadRoot = uploadsDir(id);
  await fs.mkdir(uploadRoot, { recursive: true });

  const pdfPath = path.join(uploadRoot, 'paper.pdf');
  const pdfBuffer = Buffer.from(await pdf.arrayBuffer());
  await fs.writeFile(pdfPath, pdfBuffer);

  let voiceSamplePath: string | undefined;
  const voiceSample = formData.get('voiceSample');
  if (voiceSample instanceof File) {
    const voicePath = path.join(uploadRoot, 'voice_sample.wav');
    await fs.writeFile(voicePath, Buffer.from(await voiceSample.arrayBuffer()));
    voiceSamplePath = toRelativePath(voicePath);
  }

  const now = new Date().toISOString();
  const job: JobRecord = {
    id,
    status: 'pending',
    created_at: now,
    updated_at: now,
    config,
    paths: {
      pdf: toRelativePath(pdfPath),
      voiceSample: voiceSamplePath
    }
  };

  await createJob(job);
  startJobPipeline(id);

  return NextResponse.json(job);
}
