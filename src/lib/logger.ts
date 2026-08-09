import pino from 'pino';

const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isTest ? 'silent' : 'info'),
  // No call site currently logs a credential directly, but several log a
  // whole caught SDK error object (e.g. the Stripe webhook handler, the
  // OpenRouter chat error path) - some third-party SDK error shapes carry
  // the outbound request config, including an Authorization header, inside
  // that object. Structural redaction here means a future such call site
  // can't reintroduce the leak.
  redact: {
    paths: [
      '*.headers.authorization',
      '*.headers.cookie',
      '*.config.headers',
      'err.config',
      '*.secret',
      '*.token',
      '*.apiKey'
    ],
    censor: '[REDACTED]'
  },
  ...(!isProd &&
    !isTest && {
      transport: { target: 'pino-pretty', options: { colorize: true } }
    })
});

export const createLogger = (context: Record<string, string | undefined>) =>
  logger.child(context);
