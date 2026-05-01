import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info');

const logger = pino(
  {
    level,
    redact: ['*.password', '*.token', '*.apiKey', '*.cpf', '*.cnpj'],
  },
  isDev
    ? pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      })
    : undefined
);

export default logger;
