import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
  delete process.env.LOG_LEVEL;
  vi.resetModules();
});

const importLogger = async () => {
  const mod = await import('@/lib/logger');
  return mod.logger;
};

describe('logger', () => {
  describe('default level (INFO)', () => {
    it('does not log debug messages', async () => {
      const logger = await importLogger();
      logger.debug('test debug');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('logs info messages via console.log', async () => {
      const logger = await importLogger();
      logger.info('test info');
      expect(logSpy).toHaveBeenCalledWith('[info]', 'test info');
    });

    it('logs warn messages via console.warn', async () => {
      const logger = await importLogger();
      logger.warn('test warn');
      expect(warnSpy).toHaveBeenCalledWith('[warn]', 'test warn');
    });

    it('logs error messages via console.error', async () => {
      const logger = await importLogger();
      logger.error('test error');
      expect(errorSpy).toHaveBeenCalledWith('[error]', 'test error');
    });
  });

  describe('LOG_LEVEL=DEBUG', () => {
    it('logs all levels', async () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const logger = await importLogger();

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(logSpy).toHaveBeenCalledWith('[debug]', 'd');
      expect(logSpy).toHaveBeenCalledWith('[info]', 'i');
      expect(warnSpy).toHaveBeenCalledWith('[warn]', 'w');
      expect(errorSpy).toHaveBeenCalledWith('[error]', 'e');
    });
  });

  describe('LOG_LEVEL=ERROR', () => {
    it('only logs error messages', async () => {
      process.env.LOG_LEVEL = 'ERROR';
      const logger = await importLogger();

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith('[error]', 'e');
    });
  });

  describe('LOG_LEVEL=WARN', () => {
    it('logs warn and error but not debug or info', async () => {
      process.env.LOG_LEVEL = 'WARN';
      const logger = await importLogger();

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('[warn]', 'w');
      expect(errorSpy).toHaveBeenCalledWith('[error]', 'e');
    });
  });

  describe('LOG_LEVEL=SILENT', () => {
    it('logs nothing', async () => {
      process.env.LOG_LEVEL = 'SILENT';
      const logger = await importLogger();

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('case insensitivity', () => {
    it('accepts lowercase log level', async () => {
      process.env.LOG_LEVEL = 'debug';
      const logger = await importLogger();

      logger.debug('d');
      expect(logSpy).toHaveBeenCalledWith('[debug]', 'd');
    });
  });

  describe('invalid LOG_LEVEL', () => {
    it('falls back to INFO for unknown level', async () => {
      process.env.LOG_LEVEL = 'TRACE';
      const logger = await importLogger();

      logger.debug('d');
      logger.info('i');

      expect(logSpy).not.toHaveBeenCalledWith('[debug]', 'd');
      expect(logSpy).toHaveBeenCalledWith('[info]', 'i');
    });
  });

  describe('multiple arguments', () => {
    it('passes all arguments to console methods', async () => {
      const logger = await importLogger();
      logger.info('msg', { key: 'value' }, 42);
      expect(logSpy).toHaveBeenCalledWith('[info]', 'msg', { key: 'value' }, 42);
    });
  });
});
