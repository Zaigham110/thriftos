import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
  undo?: () => void;
}

/**
 * Short feedback after a save (docs/v1/05 rule 6) with a short vibration, and "Undo" for 10 seconds
 * instead of "Are you sure?" (rule 7).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  show(text: string, opts: { tone?: 'ok' | 'error'; undo?: () => void } = {}): void {
    clearTimeout(this.timer);
    const toast: Toast = { id: ++this.seq, text, tone: opts.tone ?? 'ok', undo: opts.undo };
    this.current.set(toast);
    if (toast.tone === 'ok') navigator.vibrate?.(30);
    this.timer = setTimeout(() => this.dismiss(toast.id), opts.undo ? 10_000 : 3_500);
  }

  error(text: string): void {
    this.show(text, { tone: 'error' });
  }

  undo(): void {
    const t = this.current();
    this.current.set(null);
    t?.undo?.();
  }

  dismiss(id?: number): void {
    if (id === undefined || this.current()?.id === id) this.current.set(null);
  }
}
