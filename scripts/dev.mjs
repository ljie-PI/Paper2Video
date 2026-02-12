import { spawn } from 'node:child_process';

const nextProcess = spawn('bun', ['run', 'next', 'dev'], {
  stdio: 'inherit',
  env: process.env
});

const handleExit = (code) => {
  process.exit(typeof code === 'number' ? code : 0);
};

nextProcess.on('exit', handleExit);
nextProcess.on('error', () => handleExit(1));

process.on('SIGINT', () => {
  if (!nextProcess.killed) {
    nextProcess.kill('SIGTERM');
  }
});

process.on('SIGTERM', () => {
  if (!nextProcess.killed) {
    nextProcess.kill('SIGTERM');
  }
});
