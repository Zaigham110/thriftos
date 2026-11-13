import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Bale, Sale } from '../core';
import { CameraScan } from '../hardware/camera-scan';
import { HardwareConfig, Link, LINKS, Printer } from '../hardware/printer';
import { Scanner } from '../hardware/scanner';
import { Shelf } from '../offline/shelf';
import { Icon } from '../ui/icon';

/** This device's hardware: which till it is, its receipt printer and cash drawer, its sticker printer, its scanner. */
@Component({
  imports: [FormsModule, RouterLink, Icon, CameraScan],
  template: `
    <div class="screen max-w-2xl">
      <a routerLink="/manage" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Manage</a>
      <h1>Printer and scanner</h1>
      <p class="text-sm text-stone-500">These settings belong to this device only. Set each till up once.</p>

      @if (!secure) {
        <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="note">
          <div class="font-semibold">This device opened the shop on a plain http address.</div>
          Browsers only allow USB and Bluetooth printers, the camera, and working offline on an https address or on the shop computer itself. Network printers, the print window and USB / Bluetooth scanners work everywhere. Ask whoever installed the shop server to turn https on.
        </div>
      }

      <section class="card mt-4 p-4">
        <h2>This device is</h2>
        <select class="input mt-2" [ngModel]="api.till()?.id" (ngModelChange)="till($event)" aria-label="Till">
          @for (t of api.branch()?.tills ?? []; track t.id) { <option [value]="t.id">{{ t.name }} ({{ t.code }}) · {{ api.branch()?.name }}</option> }
        </select>
        <p class="hint">One device per till, so each till numbers its own bills.</p>
      </section>

      <section class="card mt-4 grid grid-cols-1 gap-3 p-4">
        <h2>Receipt printer and cash drawer</h2>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Receipt printer connection">
          @for (l of links; track l.key) { <button class="chip" [class.chip-on]="c.receipt.link === l.key" [disabled]="!printer.supports(l.key)" [class.opacity-40]="!printer.supports(l.key)" (click)="c.receipt.link = l.key; save()" role="radio" [attr.aria-checked]="c.receipt.link === l.key">{{ l.label }}</button> }
        </div>
        <p class="hint -mt-1">{{ help(c.receipt.link) }}</p>
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Paper width">
          <button class="chip justify-center" [class.chip-on]="c.receipt.width === 80" (click)="c.receipt.width = 80; save()" role="radio" [attr.aria-checked]="c.receipt.width === 80">80 mm paper</button>
          <button class="chip justify-center" [class.chip-on]="c.receipt.width === 58" (click)="c.receipt.width = 58; save()" role="radio" [attr.aria-checked]="c.receipt.width === 58">58 mm paper</button>
        </div>
        @if (c.receipt.link === 'network') {
          <div class="grid grid-cols-[1fr_110px] gap-3"><div><label class="label" for="rh">Printer address</label><input id="rh" class="input num" [(ngModel)]="c.receipt.host" (change)="save()" placeholder="192.168.1.50" inputmode="decimal" /></div><div><label class="label" for="rp">Port</label><input id="rp" class="input num" type="number" [(ngModel)]="c.receipt.port" (change)="save()" /></div></div>
        }
        @if (c.receipt.link === 'serial') { <div><label class="label" for="rb">Speed (baud)</label><select id="rb" class="input" [(ngModel)]="c.receipt.baud" (change)="save()">@for (b of bauds; track b) { <option [ngValue]="b">{{ b }}</option> }</select></div> }
        @if (c.receipt.link !== 'window') {
          <label class="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" class="h-5 w-5 accent-brand-600" [(ngModel)]="c.receipt.drawer" (change)="save()" /> A cash drawer is plugged into this printer</label>
        }
        <label class="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" class="h-5 w-5 accent-brand-600" [(ngModel)]="c.receipt.auto" (change)="save()" /> Print the bill by itself after every sale</label>
        <div class="flex flex-wrap gap-2">
          @if (needsConnect(c.receipt.link)) { <button class="btn-primary" (click)="connect('receipt')">Connect the printer</button> }
          <button class="btn-soft" (click)="testReceipt()"><pos-icon name="print" /> Print a test bill</button>
          @if (c.receipt.link !== 'window' && c.receipt.drawer) { <button class="btn-soft" (click)="testDrawer()"><pos-icon name="drawer" /> Open the drawer</button> }
        </div>
      </section>

      <section class="card mt-4 grid grid-cols-1 gap-3 p-4">
        <h2>Sticker printer</h2>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Sticker printer connection">
          @for (l of links; track l.key) { <button class="chip" [class.chip-on]="c.label.link === l.key" [disabled]="!printer.supports(l.key)" [class.opacity-40]="!printer.supports(l.key)" (click)="c.label.link = l.key; save()" role="radio" [attr.aria-checked]="c.label.link === l.key">{{ l.label }}</button> }
        </div>
        <p class="hint -mt-1">{{ c.label.link === 'window' ? 'Stickers go through the print window, one sticker per page at the size below.' : 'For TSC and Xprinter type sticker printers (TSPL). ' + help(c.label.link) }}</p>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="label" for="lw">Width mm</label><input id="lw" class="input num" type="number" [(ngModel)]="c.label.widthMm" (change)="save()" /></div>
          <div><label class="label" for="lh">Height mm</label><input id="lh" class="input num" type="number" [(ngModel)]="c.label.heightMm" (change)="save()" /></div>
          <div><label class="label" for="lg">Gap mm</label><input id="lg" class="input num" type="number" [(ngModel)]="c.label.gapMm" (change)="save()" /></div>
        </div>
        @if (c.label.link === 'network') {
          <div class="grid grid-cols-[1fr_110px] gap-3"><div><label class="label" for="lho">Printer address</label><input id="lho" class="input num" [(ngModel)]="c.label.host" (change)="save()" placeholder="192.168.1.51" /></div><div><label class="label" for="lp">Port</label><input id="lp" class="input num" type="number" [(ngModel)]="c.label.port" (change)="save()" /></div></div>
        }
        <div class="flex flex-wrap gap-2">
          @if (needsConnect(c.label.link)) { <button class="btn-primary" (click)="connect('label')">Connect the printer</button> }
          <button class="btn-soft" (click)="testLabel()"><pos-icon name="tag" /> Print a test sticker</button>
        </div>
      </section>

      <section class="card mt-4 grid grid-cols-1 gap-3 p-4">
        <h2>Scanner</h2>
        <p class="text-sm text-stone-600">A USB or Bluetooth scanner needs no setup: plug it in or pair it, and scan. On the till a scan works anywhere on the screen. Try it now:</p>
        <div class="num rounded-2xl px-4 py-4 text-center text-xl font-bold" [class]="scanned() ? 'bg-emerald-50 text-emerald-900' : 'bg-stone-100 text-stone-400'" role="status">{{ scanned() || 'Scan any sticker' }}</div>
        <button class="btn-soft" (click)="camera.set(true)"><pos-icon name="camera" /> Try the camera of this device</button>
      </section>

      <section class="card mt-4 p-4 text-sm">
        <h2>Working offline</h2>
        <p class="mt-1 text-stone-600">{{ shelf.online() ? 'Connected to the shop server.' : 'The shop server cannot be reached right now.' }} This device keeps {{ shelf.bales().length }} bales and {{ shelf.customers().length }} customers to sell from when the connection is down. {{ shelf.waiting().length ? shelf.waiting().length + ' waiting to be sent.' : 'Nothing is waiting to be sent.' }}</p>
        <button class="btn-soft mt-3" (click)="sync()">Refresh this device's copy now</button>
      </section>
    </div>
    @if (camera()) { <pos-camera-scan (closed)="camera.set(false)" (scanned)="scanned.set($event); camera.set(false)" /> }
  `,
})
export class HardwarePage implements OnInit, OnDestroy {
  readonly api = inject(Api);
  readonly printer = inject(Printer);
  readonly shelf = inject(Shelf);
  private readonly scanner = inject(Scanner);
  readonly links = LINKS;
  readonly bauds = [9600, 19200, 38400, 57600, 115200];
  readonly secure = window.isSecureContext;
  readonly scanned = signal('');
  readonly camera = signal(false);
  c: HardwareConfig = structuredClone(this.printer.config());
  private stop: (() => void) | undefined;

  ngOnInit() {
    this.stop = this.scanner.listen((code) => this.scanned.set(code));
  }
  ngOnDestroy() {
    this.stop?.();
  }

  help(link: Link) {
    return LINKS.find((l) => l.key === link)?.help ?? '';
  }
  needsConnect(link: Link) {
    return link === 'usb' || link === 'serial' || link === 'ble';
  }
  save() {
    this.printer.save(structuredClone(this.c));
  }
  till(id: string) {
    this.api.setTill(id);
    void this.shelf.refresh();
    this.api.say('This device is now that till.');
  }

  private async run(work: () => Promise<unknown>, done: string) {
    try {
      await work();
      if (done) this.api.say(done);
    } catch (e) {
      const text = (e as Error)?.name === 'NotFoundError' ? 'No printer was chosen.' : this.api.why(e);
      this.api.say(text, true);
    }
  }
  connect(which: 'receipt' | 'label') {
    void this.run(async () => {
      const name = await this.printer.connect(which);
      this.c = structuredClone(this.printer.config());
      this.api.say(`Connected: ${name}`);
    }, '');
  }

  testReceipt() {
    const now = new Date().toISOString();
    const sale = {
      id: 'test', code: `${this.api.till()?.code ?? 'T1'}-TEST`, customerId: null, customerName: 'Test customer', customerPhone: null, subtotal: '40600', discount: '600', taxName: null, taxRate: '0', taxInclusive: true, taxAmount: '0', total: '40000', paidTotal: '40000', changeGiven: '1000', creditAmount: '0', returnedTotal: '0', note: 'This is a test bill.', status: 'COMPLETED', cancelReason: null, madeOffline: false, needsReview: false, reviewNote: null, soldAt: now, user: { name: this.api.session()?.user.name ?? '' },
      lines: [
        { id: '1', kind: 'BALE', description: 'Mens jeans · A', quantity: 1, unitPrice: '40000', discount: '0', lineTotal: '40000', returnedQty: 0, bale: { code: 'B-00001', baleNo: 'TX-1' } },
        { id: '2', kind: 'PIECE', description: 'Ladies tops · A', quantity: 3, unitPrice: '200', discount: '0', lineTotal: '600', returnedQty: 0, bale: { code: 'B-00002', baleNo: null } },
      ],
      payments: [{ method: 'CASH', amount: '40000' }],
    } as unknown as Sale;
    void this.run(() => this.printer.receipt(sale), this.printer.direct ? 'Sent to the printer.' : '');
  }
  testDrawer() {
    void this.run(async () => {
      await this.printer.drawer();
      await this.api.post('/shifts/no-sale', { reason: 'Drawer test in settings' }).catch(() => undefined);
    }, 'Sent to the drawer.');
  }
  testLabel() {
    const bale = { id: 't', code: 'B-00001', baleNo: 'TX-1', item: 'Mens jeans', category: 'Jeans', grade: 'A', brand: null, weightKg: '30', pieces: 100, piecesSold: 0, piecesLeft: 0, salePrice: '40000', piecePrice: '450', status: 'IN_STOCK' } as Bale;
    void this.run(() => this.printer.labels([bale]), this.c.label.link === 'window' ? '' : 'Sent to the sticker printer.');
  }
  sync() {
    void this.shelf.refresh().then((ok) => this.api.say(ok ? 'This device is up to date.' : 'The shop server cannot be reached.', !ok));
  }
}
