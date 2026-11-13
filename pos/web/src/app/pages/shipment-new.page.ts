import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Api, MoneyPipe, today, typed } from '../core';

interface PreviewRow {
  line: number;
  baleNo: string | null;
  item: string;
  category: string | null;
  grade: string | null;
  weightKg: string | null;
  pieces: number | null;
  cost: string;
  landedCost: string;
  salePrice: string | null;
  piecePrice: string | null;
  errors: string[];
}
interface Preview {
  fileName: string;
  warnings: string[];
  summary: { bales: number; bad: number; weightKg: string; pieces: number; goodsCost: string; charges: string; landedCost: string; chargesSharedBy: 'weight' | 'bale' };
  rows: PreviewRow[];
}

const CHARGES = [
  { key: 'freight', label: 'Freight' },
  { key: 'customsDuty', label: 'Customs duty' },
  { key: 'clearing', label: 'Clearing agent' },
  { key: 'transport', label: 'Transport to shop' },
  { key: 'otherCharges', label: 'Other' },
] as const;

/** One shipment: its details typed once, its bale list uploaded, checked on screen, then saved into stock. */
@Component({
  imports: [FormsModule, RouterLink, MoneyPipe],
  template: `
    <div class="screen max-w-5xl !pb-44 md:!pb-28">
      <a routerLink="/shipments" class="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700">‹ Shipments</a>
      <h1 class="mt-1">Import a bale list</h1>
      <p class="text-sm text-stone-600">Type the shipment once, then upload its list. One row in the file is one bale.</p>

      <section class="card mt-5 p-5">
        <h2 class="font-semibold">1. Shipment</h2>
        <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="supplier">Supplier</label>
            <input id="supplier" class="input" [(ngModel)]="f.supplierName" list="suppliers" placeholder="Texas Recycling" autocomplete="off" />
            <datalist id="suppliers">
              @for (s of suppliers(); track s) {
                <option [value]="s"></option>
              }
            </datalist>
          </div>
          <div>
            <label class="label" for="arrived">Arrived on</label>
            <input id="arrived" class="input" type="date" [(ngModel)]="f.arrivedOn" />
          </div>
          <div>
            <label class="label" for="country">Country it came from</label>
            <input id="country" class="input" [(ngModel)]="f.originCountry" placeholder="USA" />
          </div>
          <div>
            <label class="label" for="container">Container no.</label>
            <input id="container" class="input" [(ngModel)]="f.containerNo" placeholder="MSKU1234567" autocapitalize="characters" />
          </div>
        </div>

        <button type="button" class="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700 hover:underline" (click)="more.set(!more())" [attr.aria-expanded]="more()">
          {{ more() ? 'Hide' : 'More' }} shipping papers
        </button>
        @if (more()) {
          <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label class="label" for="bl">Bill of lading no.</label><input id="bl" class="input" [(ngModel)]="f.billOfLadingNo" /></div>
            <div><label class="label" for="inv">Supplier invoice no.</label><input id="inv" class="input" [(ngModel)]="f.invoiceNo" /></div>
            <div><label class="label" for="vessel">Vessel</label><input id="vessel" class="input" [(ngModel)]="f.vessel" /></div>
            <div><label class="label" for="shipped">Shipped on</label><input id="shipped" class="input" type="date" [(ngModel)]="f.shippedOn" /></div>
            <div><label class="label" for="pol">Port of loading</label><input id="pol" class="input" [(ngModel)]="f.portOfLoading" placeholder="Houston" /></div>
            <div><label class="label" for="poa">Port of arrival</label><input id="poa" class="input" [(ngModel)]="f.portOfArrival" placeholder="Karachi" /></div>
            <div class="sm:col-span-2"><label class="label" for="notes">Notes</label><input id="notes" class="input" [(ngModel)]="f.notes" /></div>
          </div>
        }
      </section>

      <section class="card mt-4 p-5">
        <h2 class="font-semibold">2. What it cost</h2>
        <p class="mt-0.5 text-sm text-stone-600">Charges are shared between the bales, so every bale knows its full cost and your profit is right.</p>
        <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="sm:col-span-3 sm:max-w-xs">
            <label class="label" for="goods">Cost of goods</label>
            <input id="goods" class="input num" inputmode="decimal" [(ngModel)]="f.goodsCost" (ngModelChange)="stale()" placeholder="0" />
            <p class="hint">Leave empty when the file has a cost for each bale.</p>
          </div>
          @for (c of charges; track c.key) {
            <div>
              <label class="label" [for]="c.key">{{ c.label }}</label>
              <input [id]="c.key" class="input num" inputmode="decimal" [(ngModel)]="f[c.key]" (ngModelChange)="stale()" placeholder="0" />
            </div>
          }
        </div>
      </section>

      <section class="card mt-4 p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold">3. Bale list</h2>
          <button type="button" class="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700 hover:underline" (click)="sample()">Download the sample file</button>
        </div>
        <p class="mt-0.5 text-sm text-stone-600">Excel (.xlsx) or CSV. Columns: Bale no, Item, Category, Grade, Brand, Weight kg, Pieces, Cost, Bale sale price, Piece price, Notes. Only Item is needed.</p>
        <label class="mt-3 flex min-h-[72px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 px-4 text-center text-sm font-medium text-stone-700 hover:border-brand-500 focus-within:border-brand-600">
          <input type="file" class="sr-only" accept=".xlsx,.csv" (change)="pick($event)" />
          {{ file() ? file()!.name + ' — tap to choose another file' : 'Choose the bale list file' }}
        </label>

        @if (reading()) {
          <p class="mt-3 text-sm text-stone-600">Reading the file…</p>
        }
        @if (fileError()) {
          <p class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{{ fileError() }}</p>
        }

        @if (preview(); as p) {
          <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-lg bg-stone-50 p-3"><div class="text-xs text-stone-500">Bales</div><div class="num text-lg font-semibold">{{ p.summary.bales }}</div></div>
            <div class="rounded-lg bg-stone-50 p-3"><div class="text-xs text-stone-500">Weight</div><div class="num text-lg font-semibold">{{ +p.summary.weightKg ? p.summary.weightKg + ' kg' : '—' }}</div></div>
            <div class="rounded-lg bg-stone-50 p-3"><div class="text-xs text-stone-500">Goods</div><div class="num text-lg font-semibold">{{ p.summary.goodsCost | money }}</div></div>
            <div class="rounded-lg bg-stone-50 p-3"><div class="text-xs text-stone-500">Total with charges</div><div class="num text-lg font-semibold">{{ p.summary.landedCost | money }}</div></div>
          </div>
          @if (+p.summary.charges) {
            <p class="mt-2 text-xs text-stone-500">Charges of {{ p.summary.charges | money }} are shared {{ p.summary.chargesSharedBy === 'weight' ? 'by weight' : 'equally between bales (not every bale has a weight)' }}.</p>
          }
          @for (w of p.warnings; track w) {
            <p class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{{ w }}</p>
          }
          @if (p.summary.bad) {
            <p class="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {{ p.summary.bad }} {{ p.summary.bad === 1 ? 'row needs' : 'rows need' }} fixing. Correct the file and choose it again; nothing is saved until every row is right.
            </p>
          }

          <div class="mt-3 max-h-[420px] overflow-auto rounded-lg border border-stone-200">
            <table class="w-full min-w-[720px]">
              <thead class="sticky top-0 bg-stone-50">
                <tr>
                  <th class="th">Row</th><th class="th">Bale no</th><th class="th">Item</th><th class="th">Grade</th>
                  <th class="th text-right">Kg</th><th class="th text-right">Pcs</th><th class="th text-right">Full cost</th><th class="th text-right">Bale price</th><th class="th text-right">Piece price</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-100">
                @for (r of shown(); track r.line) {
                  <tr [class.bg-red-50]="r.errors.length">
                    <td class="td text-stone-500">{{ r.line }}</td>
                    <td class="td whitespace-nowrap">{{ r.baleNo || '—' }}</td>
                    <td class="td">
                      <div class="font-medium">{{ r.item || '—' }}</div>
                      @if (r.category) {
                        <div class="text-xs text-stone-500">{{ r.category }}</div>
                      }
                      @for (e of r.errors; track e) {
                        <div class="text-xs font-medium text-red-800">{{ e }}</div>
                      }
                    </td>
                    <td class="td">{{ r.grade || '—' }}</td>
                    <td class="td num text-right">{{ r.weightKg ?? '—' }}</td>
                    <td class="td num text-right">{{ r.pieces ?? '—' }}</td>
                    <td class="td num text-right">{{ r.landedCost | money }}</td>
                    <td class="td num text-right">{{ r.salePrice | money }}</td>
                    <td class="td num text-right">{{ r.piecePrice | money }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (p.rows.length > shown().length) {
            <p class="mt-2 text-xs text-stone-500">Showing {{ shown().length }} of {{ p.rows.length }} rows{{ p.summary.bad ? ' (rows to fix first)' : '' }}.</p>
          }
        }
      </section>
    </div>

    <div class="no-print fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-10 border-t border-stone-200 bg-white px-4 py-3 shadow-lift md:bottom-0 md:left-[84px]">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p class="hidden text-sm text-stone-600 sm:block">{{ hint() }}</p>
        <button class="btn-primary min-h-[52px] w-full sm:w-auto sm:px-8" [disabled]="!canSave() || saving()" (click)="save()">
          {{ saving() ? 'Saving…' : preview() ? 'Save ' + preview()!.summary.bales + ' bales to stock' : 'Save to stock' }}
        </button>
      </div>
    </div>
  `,
})
export class ShipmentNewPage implements OnInit {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly charges = CHARGES;
  readonly more = signal(false);
  readonly suppliers = signal<string[]>([]);
  readonly file = signal<File | null>(null);
  readonly preview = signal<Preview | null>(null);
  readonly reading = signal(false);
  readonly saving = signal(false);
  readonly fileError = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  f: Record<string, string> = {
    supplierName: '', arrivedOn: today(), originCountry: '', containerNo: '', billOfLadingNo: '', invoiceNo: '', vessel: '', shippedOn: '',
    portOfLoading: '', portOfArrival: '', notes: '', goodsCost: '', freight: '', customsDuty: '', clearing: '', transport: '', otherCharges: '',
  };

  /** Rows to fix come first; a long list shows its first 200 rows. */
  readonly shown = computed(() => {
    const rows = this.preview()?.rows ?? [];
    return [...rows.filter((r) => r.errors.length), ...rows.filter((r) => !r.errors.length)].slice(0, 200);
  });
  readonly canSave = computed(() => !!this.preview() && this.preview()!.summary.bad === 0 && !this.reading());
  readonly hint = computed(() => {
    const p = this.preview();
    if (!p) return 'Choose the bale list file to see it here before saving.';
    if (p.summary.bad) return 'Fix the rows marked in red, then choose the file again.';
    return `${p.summary.bales} bales, ${p.summary.pieces} pieces.`;
  });

  async ngOnInit() {
    try {
      this.suppliers.set((await this.api.get<{ name: string }[]>('/shipments/suppliers')).map((s) => s.name));
    } catch {
      /* the list is only a help while typing */
    }
  }

  private body(): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(this.f)) {
      const money = ['goodsCost', ...CHARGES.map((c) => c.key as string)].includes(key);
      if (value) data.append(key, money ? String(typed(value)) : value.trim());
    }
    data.append('file', this.file()!);
    return data;
  }

  pick(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be chosen again after fixing it
    if (!file) return;
    this.file.set(file);
    void this.read();
  }

  /** A cost changed: work the shares out again, shortly after typing stops. */
  stale() {
    if (!this.file()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.read(), 500);
  }

  private async read() {
    this.reading.set(true);
    this.fileError.set('');
    try {
      this.preview.set(await firstValueFrom(this.http.post<Preview>('/api/shipments/preview', this.body())));
    } catch (e) {
      this.preview.set(null);
      this.fileError.set(this.api.why(e));
    } finally {
      this.reading.set(false);
    }
  }

  async sample() {
    try {
      const url = URL.createObjectURL(await this.api.blob('/shipments/template'));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bale-list-sample.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    }
  }

  async save() {
    if (!this.f['supplierName'].trim()) return this.api.say('Type the supplier first.', true);
    this.saving.set(true);
    try {
      const saved = await firstValueFrom(this.http.post<{ id: string; code: string; bales: number }>('/api/shipments', this.body()));
      this.api.say(`${saved.bales} bales saved to stock as shipment ${saved.code}.`);
      await this.router.navigate(['/shipments', saved.id]);
    } catch (e) {
      this.api.say(this.api.why(e), true);
    } finally {
      this.saving.set(false);
    }
  }
}
