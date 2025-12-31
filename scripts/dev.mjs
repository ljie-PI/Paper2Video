import { spawn, spawnSync } from 'node:child_process';

const DOC_CONTAINER = 'paper2video-docling';
const DOC_IMAGE_GPU = 'quay.io/docling-project/docling-serve-cu128';
const DOC_IMAGE_CPU = 'quay.io/docling-project/docling-serve-cpu';

const hasNvidiaGpu = () => {
  const result = spawnSync('nvidia-smi', ['-L'], {
    env: process.env,
    encoding: 'utf8'
  });
  if (result.error || result.status !== 0) {
    return false;
  }
  return typeof result.stdout === 'string' && result.stdout.includes('GPU');
};

const run = (cmd, args, options = {}) => {
  return spawn(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    ...options
  });
};

const startDocling = () => {
  const useGpu = hasNvidiaGpu();
  const image = useGpu ? DOC_IMAGE_GPU : DOC_IMAGE_CPU;
  const args = [
    'run',
    '--rm',
    '--name',
    DOC_CONTAINER,
    '-p',
    '5001:5001',
    '-e',
    'DOCLING_SERVE_ENABLE_UI=1'
  ];
  if (useGpu) {
    args.push('--device', 'nvidia.com/gpu=all');
  }
  args.push(image);
  return run('podman', args);
};

const startNext = () => run('bun', ['run', 'next', 'dev']);

let shuttingDown = false;
let exitCode = 0;

let doclingProcess;
let nextProcess;

const stopAll = () => {
  if (shuttingDown) return;
  shuttingDown = true;

  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill('SIGTERM');
  }

  const stopProcess = run('podman', ['stop', DOC_CONTAINER]);
  stopProcess.on('exit', () => {
    process.exit(exitCode);
  });
  stopProcess.on('error', () => {
    process.exit(exitCode);
  });
};

doclingProcess = startDocling();
nextProcess = startNext();

const handleExit = (code) => {
  exitCode = typeof code === 'number' ? code : 0;
  stopAll();
};

nextProcess.on('exit', handleExit);
doclingProcess.on('exit', handleExit);

nextProcess.on('error', () => handleExit(1));
doclingProcess.on('error', () => handleExit(1));

process.on('SIGINT', () => handleExit(0));
process.on('SIGTERM', () => handleExit(0));
