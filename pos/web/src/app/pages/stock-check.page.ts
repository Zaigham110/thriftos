import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Bale } from '../core';
import { CameraScan } from '../hardware/camera-scan';
import { Scanner } from '../hardware/scanner';
import { Ask } from '../ui/ask';
import { Icon } from '../ui/icon';

interface Check {
  id: string;
  startedByName: string;
  startedAt: string;
  finishedAt: string | null;
  expected: number;
  found: number;
  missing: Bale[];
}

/** Counting the shelf: scan every bale that is really there. What was not scanned is missing. */
@Component({
  imports: [FormsModule, RouterLink, DatePipe, Icon, CameraScan],
  template: `
    <div class="screen max-w-2xl">
      <a routerLink="/stock" class="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand-700"><pos-icon name="back" size="h-4 w-4" /> Stock</a>
      <h1>Stock check</h1>
      @if (check(); as c) {
        <p class="text-sm text-stone-500">Started {{ c.startedAt | date: 'd MMM, h:mm a' }} by {{ c.startedByName }}{{ c.finishedAt ? ' · finished ' + (c.finishedAt | date: 'd MMM, h:mm a') : '' }}</p>
        <div class="mt-4 rounded-3xl bg-brand-950 p-5 text-white">
          <div class="text-xs font-semibold uppercase tracking-widest text-brand-300">Scanned</div>
          <div class="num text-4xl font-extrabold">{{ c.found }} <span class="text-xl font-semibold text-brand-300">of {{ c.expected }}</span></div>
          <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15"><div class="h-full rounded-full bg-pay-500 transition-all" [style.width.%]="c.expected ? (c.found / c.expected) * 100 : 0"></div></div>
        </div>
        @if (!c.finishedAt) {
          <form class="mt-3 flex gap-2" (ngSubmit)="scan(code)">
            <input #box class="input" name="code" [(ngModel)]="code" placeholder="Scan a sticker, or type the bale number" aria-label="Bale number" autocomplete="off" data-scan-through />
            <button type="button" class="icon-btn border border-stone-300 bg-white" (click)="camera.set(true)" aria-label="Scan with the camera"><pos-icon name="camera" /></button>
          </form>
          @if (lastScan(); as l) {
            <div class="mt-3 rounded-2xl px-4 py-3 text-sm font-semibold" [class]="l.bad ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'" role="status">{{ l.text }}</div>
          }
          @if (api.isManager()) { <button class="btn-primary mt-4 w-full" (click)="finish(c)">Finish and see what is missing</button> }
        }
        <h2 class="mb-2 mt-6">{{ c.finishedAt ? 'Missing' : 'Not scanned yet' }} ({{ c.missing.length }})</h2>
        <div class="card divide-y divide-stone-100">
          @for (b of c.missing; track b.id) {
            <a [routerLink]="['/stock', b.id]" class="row"><span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ b.item }}</span><span class="num block text-xs text-stone-500">{{ b.code }}{{ b.baleNo ? ' · ' + b.baleNo : '' }}{{ b.grade ? ' · Grade ' + b.grade : '' }}</span></span><pos-icon name="right" class="text-stone-300" /></a>
          } @empty {
            <p class="px-4 py-8 text-center text-sm font-semibold text-pay-700">Every bale is accounted for.</p>
          }
        </div>
        @if (c.finishedAt) {
          <p class="hint mt-3">Open a missing bale to write it off, or look for it and start a new check.</p>
          @if (api.isManager()) { <button class="btn-soft mt-3 w-full" (click)="start()">Start a new stock check</button> }
        }
      } @else if (loaded()) {
        <div class="card mt-4 p-5">
          <p class="text-sm text-stone-600">Walk the shelf and scan every bale's sticker. At the end you see which bales the system has but the shelf does not.</p>
          @if (api.isManager()) {
            <button class="btn-primary mt-4" (click)="start()">Start a stock check</button>
          } @else {
            <p class="mt-3 text-sm font-semibold">A manager starts the stock check. Then anyone can scan.</p>
          }
        </div>
      }
    </div>
    @if (camera()) {
      <pos-camera-scan (closed)="camera.set(false)" (scanned)="scan($event)" />
    }
  `,
})
export class StockCheckPage implements OnInit, OnDestroy {
  readonly api = inject(Api);
  private readonly scanner = inject(Scanner);
  private readonly ask = inject(Ask);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  readonly check = signal<Check | null>(null);
  readonly loaded = signal(false);
  readonly camera = signal(false);
  readonly lastScan = signal<{ text: string; bad: boolean } | null>(null);
  code = '';
  private stop: (() => void) | undefined;

  async ngOnInit() {
    this.stop = this.scanner.listen((code) => void this.scan(code));
    try {
      const res = await this.api.get<{ current: Check | null; last: Check | null }>('/stock-checks/current');
      this.check.set(res.current);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.loaded.set(true);
    }
  }
  ngOnDestroy() {
    this.stop?.();
  }

  async start() {
    try {
      this.check.set(await this.api.post<Check>('/stock-checks'));
      this.lastScan.set(null);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async scan(code: string) {
    const c = this.check();
    if (!c || c.finishedAt || !code.trim()) return;
    this.code = '';
    try {
      const res = await this.api.post<{ bale: Bale; again: boolean; found: number }>(`/stock-checks/${c.id}/scan`, { code: code.trim() });
      this.lastScan.set({ text: res.again ? `${res.bale.code} was already scanned.` : `${res.bale.code} · ${res.bale.item}`, bad: false });
      this.check.update((x) => (x ? { ...x, found: res.found, missing: x.missing.filter((b) => b.id !== res.bale.id) } : x));
    } catch (e) {
      navigator.vibrate?.([80, 60, 80]);
      this.lastScan.set({ text: this.api.why(e), bad: true });
    }
    this.box()?.nativeElement.focus();
  }

  async finish(c: Check) {
    if (!(await this.ask.confirm('Finish the stock check?', c.missing.length ? `${c.missing.length} bales were not scanned. They will be listed as missing.` : 'Every bale was scanned.', 'Finish'))) return;
    try {
      this.check.set(await this.api.post<Check>(`/stock-checks/${c.id}/finish`));
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }
}
