type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT';

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  SILENT: 50
};

const resolveLogLevel = (): LogLevel => {
  const raw = process.env.LOG_LEVEL?.toUpperCase();
  if (!raw) return 'INFO';
  if (raw in LOG_LEVELS) return raw as LogLevel;
  return 'INFO';
};

const currentLevel = LOG_LEVELS[resolveLogLevel()];

const shouldLog = (level: LogLevel) => LOG_LEVELS[level] >= currentLevel;

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
