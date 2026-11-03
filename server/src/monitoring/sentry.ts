import * as Sentry from '@sentry/node';

/**
 * Error tracking is optional: with SENTRY_DSN set (Sentry free tier), server errors and errors reported
 * by the app are sent there. No personal data: default PII off, no request bodies, cookies or headers,
 * user ids only (no emails or names).
 */
let enabled = false;

export function initSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!env.SENTRY_DSN || enabled) return enabled;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV || 'development',
    release: env.THRIFTOS_TAG,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
      }
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
  enabled = true;
  return true;
}

export function sentryEnabled(): boolean {
  return enabled;
}

export function reportError(error: unknown, tags: Record<string, string | undefined> = {}): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(tags)) if (v) scope.setTag(k, v);
    Sentry.captureException(error);
  });
}
