/**
 * Structured error logger for API routes.
 * Centralizes error logging with context for easier debugging.
 *
 * Sentry integration:
 * 1. npm install @sentry/nextjs
 * 2. npx @sentry/wizard@latest -i nextjs
 * 3. Set NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN env vars
 * 4. Sentry will automatically capture errors via its own instrumentation
 */

type LogLevel = 'error' | 'warn' | 'info'

interface LogContext {
  route?: string
  userId?: string
  action?: string
  [key: string]: unknown
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}

export const logger = {
  error: (message: string, context?: LogContext) => log('error', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
}
