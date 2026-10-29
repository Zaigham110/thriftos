import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { AlertTriangle, Camera, LucideAngularModule, X } from 'lucide-angular';

type NativeBarcodeDetector = { detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>> };
type NativeBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector;

/** A self-contained camera capture sheet. It releases the media stream on every
 * close/destroy path and degrades to manual capture when BarcodeDetector is absent. */
@Component({
  selector: 'app-camera-scan-sheet', standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="backdrop" role="presentation" (click)="close()"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="camera-scan-title">
      <header><div><span>Camera capture</span><h2 id="camera-scan-title">Scan source identity</h2></div><button type="button" (click)="close()" aria-label="Close camera scanner"><lucide-icon [img]="icons.X" [size]="19"/></button></header>
      <div class="preview"><video #video autoplay muted playsinline></video><div class="target"><span></span></div></div>
      @if (error(); as message) { <p class="error"><lucide-icon [img]="icons.AlertTriangle" [size]="16"/>{{ message }}</p> }
      <p class="help">{{ supported() ? 'Hold a QR code or barcode inside the frame.' : 'This browser cannot read camera barcodes automatically. Use manual entry or a hardware scanner.' }}</p>
      <button type="button" class="manual" (click)="manual.emit()">Use manual entry</button>
    </section>`,
  styles: [`.backdrop{position:fixed;inset:0;z-index:120;background:rgba(17,30,29,.52)}.sheet{position:fixed;z-index:121;right:max(18px,calc((100vw - 1080px)/2));bottom:18px;width:min(420px,calc(100vw - 36px));overflow:hidden;border:1px solid var(--flow-line);border-radius:16px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.28)}header{display:flex;align-items:flex-start;justify-content:space-between;padding:16px}header span{color:var(--flow-teal);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}h2{margin:4px 0 0;font-size:18px}header button{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--flow-line);border-radius:9px;background:#fff;color:var(--flow-ink)}.preview{position:relative;aspect-ratio:4/3;background:#162622}.preview video{width:100%;height:100%;object-fit:cover}.target{position:absolute;inset:18%;border:2px solid #d9fff2;border-radius:12px;box-shadow:0 0 0 999px rgba(0,0,0,.12)}.target span{position:absolute;top:50%;left:8%;right:8%;height:2px;background:#6cf0c9;box-shadow:0 0 12px #6cf0c9;animation:sweep 1.7s ease-in-out infinite}@keyframes sweep{0%,100%{transform:translateY(-45px)}50%{transform:translateY(45px)}}.help,.error{display:flex;align-items:center;gap:7px;margin:14px 16px;color:var(--flow-ink-soft);font-size:12px;line-height:1.45}.error{color:var(--flow-clay)}.manual{width:calc(100% - 32px);min-height:42px;margin:0 16px 16px;border:1px solid var(--flow-line);border-radius:9px;background:#fff;color:var(--flow-ink);font:inherit;font-size:12px;font-weight:800}@media(max-width:599px){.sheet{right:0;bottom:0;width:100%;border-radius:16px 16px 0 0}}`],
})
export class CameraScanSheetComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') private readonly video?: ElementRef<HTMLVideoElement>;
  @Output() readonly scanned = new EventEmitter<string>();
  @Output() readonly dismissed = new EventEmitter<void>();
  @Output() readonly manual = new EventEmitter<void>();
  readonly icons = { AlertTriangle, Camera, X };
  readonly error = signal('');
  readonly supported = signal(typeof (globalThis as any).BarcodeDetector === 'function');
  private stream: MediaStream | null = null;
  private scanTimer: number | null = null;
  private detecting = false;

  async ngAfterViewInit(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) { this.error.set('Camera access is not available on this device.'); return; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!this.video) return;
      this.video.nativeElement.srcObject = this.stream;
      await this.video.nativeElement.play();
      this.beginDetection();
    } catch {
      this.error.set('Camera permission was not granted. You can use manual entry instead.');
    }
  }

  ngOnDestroy(): void { this.stop(); }
  close(): void { this.stop(); this.dismissed.emit(); }

  private beginDetection(): void {
    const Detector = (globalThis as any).BarcodeDetector as NativeBarcodeDetectorConstructor | undefined;
    if (!Detector || !this.video) return;
    const detector = new Detector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a'] });
    this.scanTimer = window.setInterval(async () => {
      if (this.detecting) return;
      this.detecting = true;
      try {
        const result = await detector.detect(this.video!.nativeElement);
        const value = result.find(code => code.rawValue)?.rawValue?.trim();
        if (value) { this.stop(); this.scanned.emit(value); }
      } catch { /* keep capture available; browser frames may transiently reject */ }
      finally { this.detecting = false; }
    }, 350);
  }

  private stop(): void {
    if (this.scanTimer !== null) window.clearInterval(this.scanTimer);
    this.scanTimer = null;
    this.detecting = false;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
}
