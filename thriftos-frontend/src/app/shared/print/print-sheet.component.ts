import { Component, ViewEncapsulation, effect, inject, input, output, signal } from '@angular/core';
import { Bluetooth, LucideAngularModule, Printer, Share2, X } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { BluetoothPrinterService } from '../../core/print/bluetooth-printer.service';
import { PAPER_DOTS, PaperWidth, ticketBytes, toMono } from '../../core/print/escpos';
import { Ticket, renderTicket } from '../../core/print/ticket';

const PAPER_KEY = 'thriftos.paper';

function savedPaper(): PaperWidth {
  try {
    return localStorage.getItem(PAPER_KEY) === '80' ? 80 : 58;
  } catch {
    return 58;
  }
}

interface Rendered {
  canvas: HTMLCanvasElement;
  url: string;
}

/**
 * Print a bill, receipt or bale stickers (v2 6.3): a Bluetooth thermal printer where the phone can reach one, otherwise
 * the phone's print dialog (which can also save a PDF), or share the picture on WhatsApp. One picture for all three, so
 * Urdu prints on any printer.
 */
@Component({
  selector: 'app-print-sheet',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="tos-print-backdrop" (click)="closed.emit()"></div>
    <section class="tos-print-sheet" role="dialog" aria-modal="true" [attr.aria-label]="title()">
      <header>
        <h2>{{ title() }}</h2>
        <button type="button" class="x" (click)="closed.emit()" [attr.aria-label]="'common.cancel' | t"><lucide-icon [img]="icons.X" [size]="20" /></button>
      </header>
      @if (kind() === 'receipt') {
        <div class="paper" role="group" [attr.aria-label]="'print.paper' | t">
          <span>{{ 'print.paper' | t }}</span>
          @for (w of widths; track w) {
            <button type="button" [class.on]="paper() === w" [attr.aria-pressed]="paper() === w" (click)="setPaper(w)"><bdi dir="ltr">{{ w }} mm</bdi></button>
          }
        </div>
      }
      <div class="previews" [class.label]="kind() === 'label'">
        @for (r of rendered(); track $index) { <img [src]="r.url" [alt]="title()" /> }
        @if (!rendered().length) { <p class="muted">{{ 'common.loading' | t }}</p> }
      </div>
      @if (message(); as m) { <p class="msg" [class.bad]="m.bad" role="status">{{ m.text }}</p> }
      <div class="buttons">
        @if (printer.supported) {
          <button type="button" class="go" (click)="bluetooth()" [disabled]="busy() || !rendered().length">
            <lucide-icon [img]="icons.Bluetooth" [size]="20" />
            {{ busy() ? ('print.sending' | t) : printer.name() ? ('print.printOn' | t: { name: printer.name()! }) : ('print.bluetooth' | t) }}
          </button>
          @if (printer.name()) { <button type="button" class="link" (click)="changePrinter()" [disabled]="busy()">{{ 'print.change' | t }}</button> }
        }
        <button type="button" (click)="dialog()" [disabled]="!rendered().length"><lucide-icon [img]="icons.Printer" [size]="20" />{{ 'print.dialog' | t }}</button>
        @if (canShare) {
          <button type="button" (click)="share()" [disabled]="!rendered().length"><lucide-icon [img]="icons.Share2" [size]="20" />{{ 'print.share' | t }}</button>
        }
      </div>
      @if (!printer.supported) { <p class="muted small">{{ 'print.noBluetooth' | t }}</p> }
    </section>
    <div class="tos-print-out" [class.label]="kind() === 'label'" aria-hidden="true">
      @for (r of rendered(); track $index) { <img [src]="r.url" alt="" [style.width.mm]="mmWidth()" /> }
    </div>
  `,
  styles: [`
    .tos-print-backdrop { position:fixed; inset:0; z-index:90; background:rgb(0 0 0 / .45); }
    .tos-print-sheet { position:fixed; z-index:91; inset-inline:0; inset-block-end:0; max-height:92vh; overflow:auto; display:grid; gap:12px; padding:16px; padding-block-end:calc(16px + env(safe-area-inset-bottom)); border-radius:16px 16px 0 0; background:var(--ws-surface, var(--tos-card, #fff)); color:var(--ws-ink, var(--tos-ink, #1d1a1c)); box-shadow:0 -8px 30px rgb(0 0 0 / .2); }
    @media (min-width: 720px) { .tos-print-sheet { inset:auto; inset-block-start:50%; inset-inline-start:50%; transform:translate(-50%, -50%); width:min(520px, 92vw); border-radius:16px; } html[dir='rtl'] .tos-print-sheet { transform:translate(50%, -50%); } }
    .tos-print-sheet header { display:flex; align-items:center; justify-content:space-between; }
    .tos-print-sheet h2 { margin:0; font-size:18px; }
    .tos-print-sheet .x { display:grid; place-items:center; width:40px; height:40px; border:0; border-radius:50%; background:transparent; color:inherit; cursor:pointer; }
    .tos-print-sheet .paper { display:flex; align-items:center; gap:8px; font-size:14px; }
    .tos-print-sheet .paper button { min-height:36px; padding:0 14px; border:1px solid var(--ws-line, var(--tos-line, #ddd)); border-radius:999px; background:transparent; color:inherit; font:inherit; cursor:pointer; }
    .tos-print-sheet .paper button.on { border-color:var(--ws-brand, var(--tos-primary)); background:var(--ws-brand-soft, #f1e9ef); color:var(--ws-brand, var(--tos-primary)); font-weight:700; }
    .tos-print-sheet .previews { display:grid; justify-items:center; gap:8px; max-height:42vh; overflow:auto; padding:12px; border-radius:12px; background:var(--ws-surface-2, #f1eef0); }
    .tos-print-sheet .previews img { display:block; width:min(100%, 300px); background:#fff; box-shadow:0 1px 4px rgb(0 0 0 / .15); image-rendering:pixelated; }
    .tos-print-sheet .previews.label img { width:min(100%, 240px); }
    .tos-print-sheet .buttons { display:grid; gap:8px; }
    .tos-print-sheet .buttons button { display:flex; align-items:center; justify-content:center; gap:8px; min-height:48px; border:1px solid var(--ws-line, var(--tos-line, #ddd)); border-radius:12px; background:transparent; color:inherit; font:inherit; font-weight:700; cursor:pointer; }
    .tos-print-sheet .buttons button.go { border-color:var(--ws-brand, var(--tos-primary)); background:var(--ws-brand, var(--tos-primary)); color:#fff; }
    .tos-print-sheet .buttons button.link { min-height:32px; border:0; color:var(--ws-brand, var(--tos-primary)); font-weight:600; }
    .tos-print-sheet button:disabled { opacity:.55; cursor:default; }
    .tos-print-sheet .msg { margin:0; padding:10px 12px; border-radius:10px; background:var(--ws-good-soft, #e3f4ea); font-size:14px; }
    .tos-print-sheet .msg.bad { background:var(--ws-bad-soft, #fbe4e0); }
    .tos-print-sheet .muted { margin:0; color:var(--ws-ink-2, var(--tos-ink-soft)); }
    .tos-print-sheet .small { font-size:13px; }
    .tos-print-out { display:none; }
    @media print {
      body.tos-printing * { visibility:hidden !important; }
      body.tos-printing .tos-print-out, body.tos-printing .tos-print-out * { visibility:visible !important; }
      body.tos-printing .tos-print-out { display:block; position:absolute; inset:0 auto auto 0; }
      body.tos-printing .tos-print-out img { display:block; break-after:page; }
      body.tos-printing .tos-print-out img:last-child { break-after:auto; }
      body.tos-printing .tos-print-sheet, body.tos-printing .tos-print-backdrop { display:none !important; }
    }
  `],
})
export class PrintSheetComponent {
  readonly tickets = input.required<Ticket[]>();
  /** Receipts follow the paper width; labels are always one 50 × 30 mm sticker each. */
  readonly kind = input<'receipt' | 'label'>('receipt');
  readonly title = input('');
  readonly closed = output<void>();

  protected readonly printer = inject(BluetoothPrinterService);
  private readonly i18n = inject(I18nService);
  protected readonly icons = { Bluetooth, Printer, Share2, X };
  protected readonly widths: PaperWidth[] = [58, 80];
  protected readonly paper = signal<PaperWidth>(savedPaper());
  protected readonly rendered = signal<Rendered[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal<{ text: string; bad: boolean } | null>(null);
  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  constructor() {
    effect(() => {
      const tickets = this.tickets();
      const width = this.kind() === 'label' ? 384 : PAPER_DOTS[this.paper()];
      void this.render(tickets, width);
    });
  }

  protected mmWidth(): number {
    return this.kind() === 'label' ? 50 : this.paper() === 80 ? 72 : 48;
  }

  protected setPaper(w: PaperWidth): void {
    this.paper.set(w);
    try {
      localStorage.setItem(PAPER_KEY, String(w));
    } catch {
      /* private window */
    }
  }

  protected async bluetooth(): Promise<void> {
    this.busy.set(true);
    this.message.set(null);
    try {
      for (const r of this.rendered()) {
        const ctx = r.canvas.getContext('2d')!;
        const img = toMono(ctx.getImageData(0, 0, r.canvas.width, r.canvas.height));
        await this.printer.print(ticketBytes(img, { cut: this.kind() === 'receipt', feedLines: this.kind() === 'label' ? 0 : 3 }));
      }
      this.message.set({ text: this.i18n.t('print.sent'), bad: false });
    } catch (e) {
      const code = (e as Error)?.message;
      if (code !== 'cancelled') this.message.set({ text: this.i18n.t(`print.error.${['unsupported', 'notAPrinter'].includes(code) ? code : 'failed'}`), bad: true });
    } finally {
      this.busy.set(false);
    }
  }

  protected async changePrinter(): Promise<void> {
    this.printer.forget();
    await this.bluetooth();
  }

  /** The phone's or computer's print dialog with the page cut to the paper (also "Save as PDF"). */
  protected dialog(): void {
    const first = this.rendered()[0]?.canvas;
    if (!first) return;
    const wMm = this.mmWidth();
    const page = this.kind() === 'label' ? '50mm 30mm' : `${this.paper()}mm ${Math.ceil((first.height / first.width) * wMm) + 8}mm`;
    const style = document.createElement('style');
    style.textContent = `@page { size: ${page}; margin: 0 ${this.kind() === 'label' ? 0 : (this.paper() - wMm) / 2}mm; }`;
    document.head.appendChild(style);
    document.body.classList.add('tos-printing');
    const done = () => {
      document.body.classList.remove('tos-printing');
      style.remove();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  }

  /** Shares the pictures (WhatsApp and others), where the phone can share files. */
  protected async share(): Promise<void> {
    const files = await Promise.all(
      this.rendered().map(
        (r, i) =>
          new Promise<File>((resolve) =>
            r.canvas.toBlob((blob) => resolve(new File([blob!], `thriftos-${this.kind()}-${i + 1}.png`, { type: 'image/png' })), 'image/png'),
          ),
      ),
    );
    if (!navigator.canShare?.({ files })) {
      this.message.set({ text: this.i18n.t('print.error.share'), bad: true });
      return;
    }
    try {
      await navigator.share({ files, title: this.title() });
    } catch {
      /* the person closed the share sheet */
    }
  }

  private async render(tickets: Ticket[], width: number): Promise<void> {
    const out: Rendered[] = [];
    for (const t of tickets) {
      const canvas = await renderTicket(t, width);
      out.push({ canvas, url: canvas.toDataURL('image/png') });
    }
    // Only keep the result of the latest request (paper width may change while drawing).
    const nowWidth = this.kind() === 'label' ? 384 : PAPER_DOTS[this.paper()];
    if (nowWidth === width && tickets === this.tickets()) this.rendered.set(out);
  }
}
