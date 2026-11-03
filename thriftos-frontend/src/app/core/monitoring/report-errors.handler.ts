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
