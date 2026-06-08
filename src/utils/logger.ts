export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
}

const PREFIX_BY_LEVEL: Record<LogLevel, string> = {
  info: '[amore]',
  warn: '[amore:warn]',
  error: '[amore:error]',
  success: '[amore:ok]',
};

function writeLog(level: LogLevel, message: string): void {
  const text = `${PREFIX_BY_LEVEL[level]} ${message}`;

  if (level === 'error') {
    console.error(text);
    return;
  }

  if (level === 'warn') {
    console.warn(text);
    return;
  }

  console.log(text);
}

export const logger: Logger = {
  info: (message) => writeLog('info', message),
  warn: (message) => writeLog('warn', message),
  error: (message) => writeLog('error', message),
  success: (message) => writeLog('success', message),
};
