import { AfterViewInit, Component, ElementRef, OnDestroy, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';

type Detector = { detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>> };

/**
 * Camera QR scanner sheet. Uses the phone's own barcode reader when the browser has one, else the bundled
 * jsQR decoder (loaded only here). The bale code can always be typed instead (camera blocked or label torn).
 */
@Component({
  selector: 'tos-scan-sheet',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe],
  template: `
    <div class="backdrop" (click)="close()"></div>
    <section class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="'stock.scan' | t">
      <header><h2>{{ 'stock.scan' | t }}</h2><button type="button" class="icon-btn" [attr.aria-label]="'common.cancel' | t" (click)="close()"><lucide-icon [img]="icons.X" [size]="22" /></button></header>
      @if (!blocked()) {
        <div class="preview"><video #video autoplay muted playsinline></video><span class="frame"></span></div>
      } @else {
        <p class="notice error">{{ 'stock.cameraBlocked' | t }}</p>
      }
      <form class="manual" (ngSubmit)="submitTyped()">
        <label class="field">{{ 'stock.code' | t }}<input name="code" [(ngModel)]="typed" autocomplete="off" autocapitalize="characters" class="ltr" placeholder="B-0001" /></label>
        <button type="submit" class="btn primary" [disabled]="!typed.trim()">{{ 'common.keypadDone' | t }}</button>
      </form>
    </section>
  `,
  styles: [`
    .backdrop { position:fixed; inset:0; z-index:60; background:rgb(0 0 0 / .45); }
    .sheet { position:fixed; inset-inline:0; inset-block-end:0; z-index:61; display:grid; gap:12px; max-width:520px; margin:0 auto; padding:12px 16px calc(16px + env(safe-area-inset-bottom)); border-radius:18px 18px 0 0; background:#fff; }
    header { display:flex; align-items:center; justify-content:space-between; }
    h2 { margin:0; font-size:18px; }
    .preview { position:relative; aspect-ratio:1; max-height:50vh; border-radius:14px; overflow:hidden; background:#1d1a1c; }
    video { width:100%; height:100%; object-fit:cover; }
    .frame { position:absolute; inset:18%; border:3px solid #fff; border-radius:16px; box-shadow:0 0 0 999px rgb(0 0 0 / .25); }
    .manual { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:8px; }
  `],
})
export class ScanSheetComponent implements AfterViewInit, OnDestroy {
  private readonly i18n = inject(I18nService);
  readonly scanned = output<string>();
  readonly closed = output<void>();
  protected readonly icons = { X };
  protected readonly blocked = signal(false);
  protected typed = '';
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private busy = false;

  async ngAfterViewInit(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) return this.blocked.set(true);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const v = this.video()?.nativeElement;
      if (!v) return;
      v.srcObject = this.stream;
      await v.play();
      await this.detectLoop(v);
    } catch {
      this.blocked.set(true);
      this.stop();
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  protected close(): void {
    this.stop();
    this.closed.emit();
  }

  protected submitTyped(): void {
    const code = this.typed.trim().toUpperCase();
    if (code) this.found(code);
  }

  private async detectLoop(v: HTMLVideoElement): Promise<void> {
    type NativeCtor = (new (o: { formats: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> };
    const Native = (globalThis as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
    // Some browsers have BarcodeDetector without QR support (e.g. desktop Linux); use jsQR there.
    const nativeQr = Native ? (await Native.getSupportedFormats?.().catch(() => [] as string[]))?.includes('qr_code') : false;
    let detect: () => Promise<string | null>;
    if (Native && nativeQr) {
      const d = new Native({ formats: ['qr_code'] });
      detect = async () => (await d.detect(v)).find((r) => r.rawValue)?.rawValue ?? null;
    } else {
      const jsQR = (await import('jsqr')).default;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      detect = async () => {
        if (!v.videoWidth) return null;
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        return jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
      };
    }
    this.timer = window.setInterval(async () => {
      if (this.busy) return;
      this.busy = true;
      try {
        const value = (await detect())?.trim();
        if (value) this.found(value);
      } catch {
        /* a frame can fail to decode; keep scanning */
      } finally {
        this.busy = false;
      }
    }, 300);
  }

  private found(code: string): void {
    this.stop();
    navigator.vibrate?.(40);
    this.scanned.emit(code);
  }

  private stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
