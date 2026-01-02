import fs from 'fs/promises';
import path from 'path';
import { outputsDir, toRelativePath } from './storage';
import { logger } from './logger';
import { runCommand } from './command';

type SlideAudio = {
  index: number;
  path: string;
};

const toAbsolutePath = (filePath: string) =>
  path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

const formatSeconds = (value: number) =>
  Number.isFinite(value) ? value.toFixed(3) : '0';

const getAudioDuration = async (filePath: string) => {
  const absolutePath = toAbsolutePath(filePath);
  const { stdout } = await runCommand('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    absolutePath
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid audio duration for ${filePath}`);
  }
  return duration;
};

export const renderVideoFromSlides = async (input: {
  jobId: string;
  slideImages: string[];
  slideAudios: SlideAudio[];
  transitionSeconds?: number;
}) => {
  const transitionSeconds = input.transitionSeconds ?? 1;
  if (!input.slideImages.length) {
    throw new Error('No slide images available to render video.');
  }
  if (!input.slideAudios.length) {
    throw new Error('No slide narration audio available to render video.');
  }
  if (input.slideImages.length !== input.slideAudios.length) {
    throw new Error(
      `Slide image count (${input.slideImages.length}) does not match audio count (${input.slideAudios.length}).`
    );
  }

  const outputDir = outputsDir(input.jobId);
  const videoDir = path.join(outputDir, 'video');
  await fs.rm(videoDir, { recursive: true, force: true });
  await fs.mkdir(videoDir, { recursive: true });

  const segmentFiles: string[] = [];
  for (let index = 0; index < input.slideImages.length; index += 1) {
    const imagePath = toAbsolutePath(input.slideImages[index]);
    const audioPath = toAbsolutePath(input.slideAudios[index].path);
    const audioDuration = await getAudioDuration(audioPath);
    const totalDuration = audioDuration + transitionSeconds;

    const segmentName = `segment-${String(index + 1).padStart(3, '0')}.mp4`;
    const segmentPath = path.join(videoDir, segmentName);
    logger.info(
      `[video] rendering segment ${index + 1} (${formatSeconds(totalDuration)}s)`
    );

    await runCommand('ffmpeg', [
      '-y',
      '-loop',
      '1',
      '-t',
      formatSeconds(totalDuration),
      '-i',
      imagePath,
      '-i',
      audioPath,
      '-c:v',
      'libx264',
      '-tune',
      'stillimage',
      '-r',
      '30',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-af',
      `apad=pad_dur=${formatSeconds(transitionSeconds)}`,
      '-shortest',
      segmentPath
    ]);

    segmentFiles.push(segmentName);
  }

  const concatListPath = path.join(videoDir, 'concat.txt');
  await fs.writeFile(
    concatListPath,
    segmentFiles.map((file) => `file '${file}'`).join('\n'),
    'utf8'
  );

  const videoPath = path.join(outputDir, 'video.mp4');
  await runCommand(
    'ffmpeg',
    ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', videoPath],
    { cwd: videoDir }
  );

  return toRelativePath(videoPath);
};
