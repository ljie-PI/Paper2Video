import { spawn } from 'node:child_process';

type CommandResult = {
  stdout: string;
  stderr: string;
};

export const runCommand = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code && code !== 0) {
        const message = stderr.trim() || stdout.trim() || 'unknown error';
        reject(
          new Error(
            `Command failed (${command} ${args.join(' ')}): ${message}`
          )
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
