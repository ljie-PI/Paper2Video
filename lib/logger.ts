import { LOG_LEVELS } from '@/constants/logger';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';

const resolveLogLevel = (): LogLevel => {
  const raw = process.env.LOG_LEVEL?.toUpperCase();
  if (!raw) return 'INFO';
  if (raw in LOG_LEVELS) return raw as LogLevel;
  return 'INFO';
};

const shouldLog = (level: LogLevel) =>
  LOG_LEVELS[level] >= LOG_LEVELS[resolveLogLevel()];

const logWithLevel = (level: LogLevel, args: unknown[]) => {
  if (!shouldLog(level)) return;
  const prefix = `[${level.toLowerCase()}]`;

  if (level === 'ERROR') {
    console.error(prefix, ...args);
    return;
  }

  if (level === 'WARN') {
    console.warn(prefix, ...args);
    return;
  }

  console.log(prefix, ...args);
};

export const logger = {
  debug: (...args: unknown[]) => logWithLevel('DEBUG', args),
  info: (...args: unknown[]) => logWithLevel('INFO', args),
  warn: (...args: unknown[]) => logWithLevel('WARN', args),
  error: (...args: unknown[]) => logWithLevel('ERROR', args)
};
