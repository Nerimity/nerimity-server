import pino from 'pino';

export const logger = pino({
  timestamp: pino.stdTimeFunctions.isoTime, // Use ISO 8601 for timestamps
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
