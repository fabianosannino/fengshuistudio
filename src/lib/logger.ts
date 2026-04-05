/**
 * Structured error logger for API routes.
 * Centralizes error logging with context for easier debugging.
 *
 * Sentry integration:
 * 1. npm install @sentry/nextjs
 * 2. npx @sentry/wizard@latest -i nextjs
 * 3. Set NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN env vars
 * 4. Errors will be automatically sent to Sentry
 */

type LogLevel = 'error' | 'warn' | 'info'

interface LogContext {
  route?: string
  userId?: string
  action?: string
  [key: string]: unknown
}

// Lazy Sentry import — only loads if @sentry/nextjs is installed
let _sentry: { captureException: (err: unknown, ctx?: unknown) => void; captureMessage: (msg: string, ctx?: unknown) => void } | null = null
let _sentryChecked = false

function getSentry() {
  if (_sentryChecked) return _sentry
  _sentryChecked = true
  try {
    // Dynamic import to avoid build errors if Sentry is not installed
    _sentry = require('@sentry/nextjs')
  } catch {
    _sentry = null
  }
  return _sentry
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  // Console output
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }

  // Send to Sentry if available
  const sentry = getSentry()
  if (sentry && (level === 'error' || level === 'warn')) {
    if (level === 'error') {
      sentry.captureException(new Error(message), {
        extra: context,
        tags: { route: context?.route },
      })
    } else {
      sentry.captureMessage(message, {
        level: 'warning',
        extra: context,
        tags: { route: context?.route },
      })
    }
  }
}

export const logger = {
  error: (message: string, context?: LogContext) => log('error', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
}
