/**
 * Structured logger for Rift
 * Outputs JSON-formatted logs with levels, timestamps, and context
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

interface LogContext {
  requestId?: string
  userId?: string
  riftId?: string
  action?: string
  [key: string]: unknown
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error) {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }
  }

  return JSON.stringify(entry)
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) console.debug(formatLog('debug', message, context))
  },

  info(message: string, context?: LogContext) {
    if (shouldLog('info')) console.info(formatLog('info', message, context))
  },

  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) console.warn(formatLog('warn', message, context))
  },

  error(message: string, context?: LogContext, error?: Error) {
    if (shouldLog('error')) console.error(formatLog('error', message, context, error instanceof Error ? error : undefined))
  },

  /** Create a child logger with preset context */
  child(baseContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        logger.debug(message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) =>
        logger.info(message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        logger.warn(message, { ...baseContext, ...context }),
      error: (message: string, context?: LogContext, error?: Error) =>
        logger.error(message, { ...baseContext, ...context }, error),
    }
  },
}

/** Generate a unique request ID */
export function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8)
}
