import { Injectable, NgZone, inject } from '@angular/core';
import { ScanDetector } from './scan-detector';

type Handler = (code: string) => void;

/**
 * Listens for USB / Bluetooth barcode scanners anywhere in the app. The screen on top (the last one that asked) gets
 * the code. A scan typed into a text box is left to that box, so the search box can handle its own Enter.
 */
@Injectable({ providedIn: 'root' })
export class Scanner {
  private readonly zone = inject(NgZone);
  private readonly handlers: Handler[] = [];
  private readonly detector = new ScanDetector();
  /** Set by Settings while the person tries their scanner. */
  lastScan = '';

  constructor() {
    this.zone.runOutsideAngular(() =>
      document.addEventListener(
        'keydown',
        (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const code = this.detector.key(e.key, e.timeStamp);
          if (!code) return;
          const el = document.activeElement as HTMLElement | null;
          const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
          if (typing && !el!.hasAttribute('data-scan-through')) return;
          e.preventDefault();
          this.zone.run(() => this.emit(code));
        },
        true,
      ),
    );
  }

  /** Set by the app shell: true while the till is locked or a question is open, when a scan must do nothing. */
  blocked: () => boolean = () => false;

  emit(code: string) {
    if (this.blocked()) return;
    this.lastScan = code;
    this.handlers[this.handlers.length - 1]?.(code.trim());
  }

  /** A screen starts listening; call the returned function when it closes. */
  listen(handler: Handler): () => void {
    this.handlers.push(handler);
    return () => {
      const i = this.handlers.lastIndexOf(handler);
      if (i >= 0) this.handlers.splice(i, 1);
    };
  }
}
