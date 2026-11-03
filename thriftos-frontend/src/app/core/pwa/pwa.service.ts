import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'thriftos.install-dismissed';

/** Install prompt ("Add ThriftOS to your phone"), app updates, and clearing cached API data on sign-out. */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly updates = inject(SwUpdate);
  private deferred: BeforeInstallPromptEvent | null = null;

  /** True when the browser offers installing and the user has not said "Not now". */
  readonly canInstall = signal(false);
  /** A new version is downloaded and is used after a reload. */
  readonly updateReady = signal(false);

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.canInstall.set(!readFlag(DISMISSED_KEY));
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.canInstall.set(false);
    });
    if (this.updates.isEnabled) {
      this.updates.versionUpdates
        .pipe(filter((e) => e.type === 'VERSION_READY'))
        .subscribe(() => this.updateReady.set(true));
    }
  }

  async install(): Promise<void> {
    const prompt = this.deferred;
    if (!prompt) return;
    this.deferred = null;
    this.canInstall.set(false);
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
  }

  notNow(): void {
    this.canInstall.set(false);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* private mode */
    }
  }

  reload(): void {
    document.location.reload();
  }

  /**
   * Cached API answers (customers, stock, khata) belong to the signed-in user. They are dropped on
   * sign-out so the next person on this phone never sees them.
   */
  async clearDataCaches(): Promise<void> {
    if (!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.includes(':data:') || n.includes('reference-data') || n.includes('live-data')).map((n) => caches.delete(n)));
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
