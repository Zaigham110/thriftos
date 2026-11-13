import { Component, ElementRef, OnDestroy, OnInit, output, signal, viewChild } from '@angular/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Scan a sticker with the phone or tablet camera. Uses the browser's own reader, or a bundled one where it has none. */
@Component({
  selector: 'pos-camera-scan',
  template: `
    <div class="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-label="Scan with the camera">
      <div class="flex items-center justify-between px-4 py-3 text-white">
        <div class="text-base font-semibold">Point the camera at the sticker</div>
        <button class="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl" (click)="closed.emit()" aria-label="Close the camera">✕</button>
      </div>
      <div class="relative flex-1 overflow-hidden">
        <video #video class="h-full w-full object-cover" playsinline muted></video>
        <div class="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-2xl border-2 border-white/80"></div>
      </div>
      @if (error()) {
        <p class="bg-red-700 px-4 py-3 text-sm font-medium text-white" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class CameraScan implements OnInit, OnDestroy {
  readonly scanned = output<string>();
  readonly closed = output<void>();
  readonly error = signal('');
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private zxing: { stop(): void } | null = null;
  private last = '';

  async ngOnInit() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('The camera needs a secure address (https) on this device. Use a scanner, or type the number.');
      return;
    }
    try {
      const Detector = (window as any).BarcodeDetector;
      if (Detector) {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = this.video().nativeElement;
        video.srcObject = this.stream;
        await video.play();
        const detector = new Detector({ formats: ['code_128', 'code_39', 'ean_13', 'qr_code'] });
        this.timer = setInterval(async () => {
          try {
            const found = await detector.detect(video);
            if (found[0]?.rawValue) this.got(found[0].rawValue);
          } catch {
            /* a frame that could not be read */
          }
        }, 180);
      } else {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        this.zxing = await new BrowserMultiFormatReader().decodeFromVideoDevice(undefined, this.video().nativeElement, (result) => result && this.got(result.getText()));
      }
    } catch {
      this.error.set('The camera could not be opened. Allow the camera for this page, or type the number.');
    }
  }

  private got(code: string) {
    if (code === this.last) return;
    this.last = code;
    setTimeout(() => (this.last = ''), 1500); // the same sticker held in view is one scan
    navigator.vibrate?.(60);
    this.scanned.emit(code.trim());
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.zxing?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
