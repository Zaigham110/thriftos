import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Errors in the app are still printed to the console, and also sent to the API (`api/client-errors`,
 * relative to <base href>), which logs them on the server. At most 5 different errors per page load;
 * only the message, stack and route are sent (no query string, no form data).
 */
@Injectable()
export class ReportErrorsHandler extends ErrorHandler {
  private readonly sent = new Set<string>();

  override handleError(error: unknown): void {
    super.handleError(error);
    // A page opened before a new release asks for a file that is gone: load the new version once.
    if (isStaleFile(error) && reloadOnceForNewVersion()) return;
    try {
      const e = error as { message?: string; stack?: string; rejection?: { message?: string; stack?: string } };
      const source = e?.rejection ?? e;
      const message = String(source?.message ?? error).slice(0, 500);
      if (this.sent.has(message) || this.sent.size >= 5) return;
      this.sent.add(message);
      const body = JSON.stringify({ message, stack: source?.stack?.slice(0, 4000), path: location.pathname.slice(0, 300) });
      fetch('api/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
    } catch {
      // Reporting must never cause another error.
    }
  }
}

const STALE = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i;
const RELOADED_KEY = 'thriftos.stale-reload';

/** The error is a part of the app that no longer exists on the server (a new version was released). */
export function isStaleFile(error: unknown): boolean {
  const e = error as { message?: string; rejection?: { message?: string } } | null;
  return STALE.test(String(e?.rejection?.message ?? e?.message ?? error ?? ''));
}

/**
 * Reload the page to get the new version, at most once a minute (a file that is really missing must not cause
 * a reload loop). Returns false when it already tried.
 */
export function reloadOnceForNewVersion(now = Date.now(), reload = () => location.reload()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
    if (now - last < 60_000) return false;
    sessionStorage.setItem(RELOADED_KEY, String(now));
  } catch {
    return false;
  }
  reload();
  return true;
}
