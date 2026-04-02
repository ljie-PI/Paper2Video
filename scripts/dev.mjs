import { spawn } from 'node:child_process';

const run = (cmd, args, options = {}) => {
  return spawn(cmd, args, {
    stdio: 'inherit',
    env: process.env,
    ...options
  });
};

const startNext = () => run('bun', ['run', 'next', 'dev']);

let shuttingDown = false;
let exitCode = 0;

let nextProcess;

const stopAll = () => {
  if (shuttingDown) return;
  shuttingDown = true;

  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill('SIGTERM');
  }

  process.exit(exitCode);
};

nextProcess = startNext();

const handleExit = (code) => {
  exitCode = typeof code === 'number' ? code : 0;
  stopAll();
};

nextProcess.on('exit', handleExit);
nextProcess.on('error', () => handleExit(1));

process.on('SIGINT', () => handleExit(0));
process.on('SIGTERM', () => handleExit(0));
