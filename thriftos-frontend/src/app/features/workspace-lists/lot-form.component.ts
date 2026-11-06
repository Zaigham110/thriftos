import { HttpClient } from '@angular/common/http';
import { Component, HostListener, computed, inject, input, OnInit, signal } from '@angular/core';
import { NavService } from '../../core/nav/nav.service';
import { HasUnsavedChanges, warnBeforeUnload } from '../../core/nav/unsaved-changes.guard';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { COUNTRIES } from '../../shared/countries';
import { ToastService } from '../../shared/floor/toast.service';
import { WsInfoComponent, WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';

interface Option { id: string; name: string; originCountry?: string | null; country?: string | null; rawType?: string }
/** GET /api/procurement/rags/:id (the fields this form uses). */
interface LotRow {
  id: string; ragCode: string; status: string; containerId: string | null; vendorId: string | null; rawCategoryId: string | null;
  weightKg: string; purchaseCost: string | null; notes: string | null; createdAt: string;
}

const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
const day = (v: string) => new Date(new Date(v).getTime() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * The laptop form to buy a loose lot (a gaari or bales bought locally, no container), and to fix one later
 * (v2 review). Supplier, what is inside, the day, kg and price; the side shows the price per kg and what is
 * still missing. Saving opens the lot. Kg and raw type stay as they are once sorting has started.
 */
@Component({
  selector: 'app-lot-form',
  standalone: true,
  imports: [FormsModule, RouterLink, TPipe, WsInfoComponent, WsPageHeaderComponent, WsStateComponent],
  template: `
    @if (loadFailed()) {
      <ws-state kind="error" [heading]="'ws.sortRecord.notFound' | t" (retry)="load()" />
    } @else if (loading()) {
      <ws-state kind="loading" />
    } @else if (containerId()) {
      <ws-state kind="empty" [heading]="'ws.lf.containerLot' | t">
        <a class="ws-btn" [routerLink]="['/receive/records/containers', containerId()]" [state]="nav.trailState()">{{ 'ws.lf.openContainer' | t }}</a>
      </ws-state>
    } @else {
      <form class="page" (ngSubmit)="save()" (input)="touched = true" (change)="touched = true">
        <ws-page-header [heading]="id() ? ('ws.lf.editTitle' | t: { code: code }) : ('ws.new.gaari' | t)" [subtitle]="(id() ? 'ws.lf.editHint' : 'ws.lf.newHint') | t" />
        <div class="cols">
          <div class="main">
            <section class="card">
              <h2>{{ 'ws.cf.whatCame' | t }}</h2>
              <div class="grid">
                <label class="span2">{{ 'common.supplier' | t }} · {{ 'common.optional' | t }}
                  @if (!adding()) {
                    <span class="row">
                      <select name="vendor" [(ngModel)]="vendorId">
                        <option value="">{{ 'ws.lf.noSupplier' | t }}</option>
                        @for (s of suppliers(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                      </select>
                      <button type="button" class="ws-btn" (click)="adding.set(true)">+ {{ 'common.newSupplier' | t }}</button>
                    </span>
                  }
                </label>
                @if (adding()) {
                  <div class="span2 new-supplier">
                    <label>{{ 'receive.newSupplierName' | t }}<input name="newSupplier" maxlength="120" [(ngModel)]="newSupplier" autocomplete="off" /></label>
                    <label>{{ 'common.country' | t }}<input name="newSupplierCountry" list="ws-lf-countries" maxlength="60" [(ngModel)]="newSupplierCountry" autocomplete="off" /></label>
                    <span class="row">
                      <button type="button" class="ws-btn" (click)="adding.set(false)">{{ 'common.cancel' | t }}</button>
                      <button type="button" class="ws-btn primary" [disabled]="!newSupplier.trim() || busy()" (click)="addSupplier()">{{ 'common.save' | t }}</button>
                    </span>
                  </div>
                }
                <label>{{ 'ws.cf.rawType' | t }}
                  <select name="raw" [(ngModel)]="rawCategoryId" [disabled]="locked()">
                    @for (r of rawTypes(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
                  </select>
                  @if (locked()) { <small>{{ 'ws.cf.rawLocked' | t }}</small> }
                </label>
                <label>
                  <span class="lbl">{{ 'ws.lf.date' | t }} <ws-info [title]="'ws.lf.date' | t" [text]="'ws.lf.dateInfo' | t" /></span>
                  <input name="date" type="date" required [max]="maxDay" [(ngModel)]="date" />
                </label>
              </div>
            </section>

            <section class="card">
              <h2>{{ 'ws.cf.weightPrice' | t }}</h2>
              <div class="grid">
                <label>{{ 'receive.lotWeight' | t }} ({{ 'unit.kgShort' | t }})
                  <input name="kg" type="number" min="0.01" step="0.01" required [ngModel]="kg()" (ngModelChange)="kg.set($event)" [disabled]="locked()" />
                  @if (locked()) { <small>{{ 'ws.cf.kgLocked' | t }}</small> }
                </label>
                <label>{{ 'ws.purchaseLots.col.cost' | t }}<input name="cost" type="number" min="0" step="0.01" required [ngModel]="cost()" (ngModelChange)="cost.set($event)" /></label>
                <label class="span2">{{ 'ws.customer.note' | t }} · {{ 'common.optional' | t }}<input name="notes" maxlength="500" [(ngModel)]="notes" [placeholder]="'ws.lf.noteHint' | t" /></label>
              </div>
            </section>
          </div>

          <aside class="side card" aria-live="polite">
            <h2>{{ 'ws.cf.summary' | t }}</h2>
            <dl>
              <div><dt>{{ 'ws.purchaseLots.col.cost' | t }}</dt><dd>{{ cost() === null || cost() === undefined ? '—' : i18n.money(cost()) }}</dd></div>
              <div><dt>{{ 'receive.lotWeight' | t }}</dt><dd>{{ kg() ? i18n.kg(kg()) : '—' }}</dd></div>
              <div class="total big"><dt>{{ 'ws.purchaseLots.col.costPerKg' | t }}</dt><dd>{{ perKg() === null ? '—' : i18n.money(perKg()) }}</dd></div>
            </dl>
            @if (missing().length) {
              <div class="missing" role="status"><strong>{{ 'ws.cf.missing' | t }}</strong><ul>@for (m of missing(); track m) { <li>{{ m | t }}</li> }</ul></div>
            }
            <button type="submit" class="ws-btn primary block" [disabled]="missing().length > 0 || busy()">{{ (busy() ? 'common.saving' : (id() ? 'common.save' : 'receive.saveLot')) | t }}</button>
            <button type="button" class="ws-btn block" (click)="cancel()">{{ 'common.cancel' | t }}</button>
          </aside>
        </div>
        <datalist id="ws-lf-countries">@for (c of countries; track c) { <option [value]="c"></option> }</datalist>
      </form>
    }
  `,
  styles: [`
    :host { display:block; font-family:var(--ws-font); color:var(--ws-ink); }
    .page { max-width:1000px; margin-inline:auto; }
    .cols { display:grid; grid-template-columns:minmax(0, 1fr) 280px; gap:var(--ws-5); align-items:start; }
    .main { display:grid; gap:var(--ws-4); min-width:0; }
    .card { padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    h2 { margin:0 0 var(--ws-3); font-size:var(--ws-text-md); font-weight:600; }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:var(--ws-3); }
    .span2 { grid-column:1 / -1; }
    label { display:grid; gap:4px; align-content:start; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .lbl { display:inline-flex; align-items:center; gap:6px; }
    input, select { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-size:var(--ws-text-md); }
    input:disabled, select:disabled { background:var(--ws-surface-2); color:var(--ws-ink-2); }
    small { color:var(--ws-ink-3); font-size:var(--ws-text-sm); }
    .row { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-2); }
    .row select { flex:1 1 220px; width:auto; }
    .new-supplier { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)) auto; gap:var(--ws-3); align-items:end; padding:var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-surface-2); }
    .side { position:sticky; top:calc(var(--ws-topbar-h) + var(--ws-4)); display:grid; gap:var(--ws-3); }
    .side h2 { margin:0; }
    dl { display:grid; gap:var(--ws-2); margin:0; }
    dl div { display:flex; justify-content:space-between; gap:var(--ws-3); font-size:var(--ws-text-sm); }
    dt { color:var(--ws-ink-2); }
    dd { margin:0; font-variant-numeric:tabular-nums; }
    .total { padding-block-start:var(--ws-2); border-block-start:1px solid var(--ws-line); font-weight:600; }
    .big dd { font-size:var(--ws-text-xl); }
    .missing { padding:var(--ws-3); border-radius:var(--ws-r-md); background:var(--ws-warn-soft, var(--ws-surface-2)); font-size:var(--ws-text-sm); }
    .missing ul { margin:4px 0 0; padding-inline-start:18px; }
    .block { justify-content:center; width:100%; }
    @media (max-width: 1023px) { .cols { grid-template-columns:minmax(0, 1fr); } .side { position:static; } }
    @media (max-width: 640px) { .grid, .new-supplier { grid-template-columns:minmax(0, 1fr); } }
  `],
})
export class LotFormComponent implements OnInit, HasUnsavedChanges {
  protected readonly nav = inject(NavService);
  /** Something was typed or picked and not saved yet (leaving asks first). */
  protected touched = false;
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  /** Absent on "Buy a loose lot"; the lot's id on its edit page. */
  readonly id = input<string | undefined>();

  protected readonly countries = COUNTRIES;
  protected readonly maxDay = today();
  protected readonly suppliers = signal<Option[]>([]);
  protected readonly rawTypes = signal<Option[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly adding = signal(false);
  protected readonly locked = signal(false);
  protected readonly containerId = signal<string | null>(null);
  protected readonly kg = signal<number | null>(null);
  protected readonly cost = signal<number | null>(null);

  protected code = '';
  protected vendorId = '';
  protected rawCategoryId = '';
  protected date = today();
  protected notes = '';
  protected newSupplier = '';
  protected newSupplierCountry = '';

  protected readonly perKg = computed(() => {
    const kg = Number(this.kg());
    const cost = this.cost();
    return kg > 0 && cost !== null && cost !== undefined ? Math.round((Number(cost) / kg) * 100) / 100 : null;
  });
  protected readonly missing = computed(() => {
    const m: string[] = [];
    if (!this.kg() || Number(this.kg()) <= 0) m.push('ws.lf.needKg');
    if (this.cost() === null || this.cost() === undefined || Number(this.cost()) < 0) m.push('ws.lf.needPrice');
    return m;
  });

  ngOnInit(): void {
    // "Buy a loose lot" from a supplier's page arrives with ?supplier= already chosen.
    const from = this.route.snapshot.queryParamMap.get('supplier');
    this.http.get<Option[]>('/api/procurement/vendors').subscribe({
      next: (l) => {
        this.suppliers.set(l ?? []);
        if (from && !this.id() && (l ?? []).some((s) => s.id === from)) this.vendorId = from;
      },
    });
    this.http.get<Option[]>('/api/tenant/raw-categories').subscribe({
      next: (l) => {
        this.rawTypes.set(l ?? []);
        if (!this.id() && !this.rawCategoryId) this.rawCategoryId = (l ?? []).find((r) => r.rawType === 'BALE')?.id ?? l?.[0]?.id ?? '';
      },
    });
    if (this.id()) this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.http.get<LotRow>(`/api/procurement/rags/${this.id()}`).subscribe({
      next: (r) => {
        this.code = r.ragCode;
        this.nav.setName(r.id, r.ragCode);
        this.containerId.set(r.containerId);
        this.vendorId = r.vendorId ?? '';
        this.rawCategoryId = r.rawCategoryId ?? '';
        this.date = day(r.createdAt);
        this.kg.set(Number(r.weightKg));
        this.cost.set(r.purchaseCost === null ? null : Number(r.purchaseCost));
        this.notes = r.notes ?? '';
        this.locked.set(r.status !== 'NOT_STARTED');
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.loadFailed.set(true); },
    });
  }

  hasUnsavedChanges(): boolean {
    return this.touched;
  }
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.touched);
  }
  protected cancel(): void {
    this.touched = false;
    this.nav.back(this.id() ? ['/sort/records', this.id()] : ['/receive/records/lots']);
  }

  protected async addSupplier(): Promise<void> {
    this.busy.set(true);
    const country = this.newSupplierCountry.trim();
    try {
      const s = await firstValueFrom(this.http.post<Option>('/api/procurement/vendors', { name: this.newSupplier.trim(), ...(country ? { originCountry: country, country } : {}) }));
      this.suppliers.update((l) => [s, ...l]);
      this.vendorId = s.id;
      this.adding.set(false);
      this.newSupplier = '';
      this.newSupplierCountry = '';
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.missing().length || this.busy()) return;
    const body = {
      ...(this.vendorId ? { vendorId: this.vendorId } : {}),
      purchaseCost: Number(this.cost()),
      receivedAt: this.date,
      notes: this.notes.trim(),
      ...(this.locked() ? {} : { weightKg: Number(this.kg()), ...(this.rawCategoryId ? { rawCategoryId: this.rawCategoryId } : {}) }),
    };
    this.busy.set(true);
    try {
      let id = this.id();
      if (id) {
        await firstValueFrom(this.http.patch(`/api/procurement/rags/${id}`, body));
        this.toast.show(this.i18n.t('ws.lf.saved'));
        this.touched = false;
        this.nav.back(['/sort/records', id]);
        return;
      } else {
        const r = await firstValueFrom(this.http.post<{ id: string; ragCode: string }>('/api/procurement/rags', { ragBaleType: 'BALE', ...body, notes: body.notes || undefined }));
        id = r.id;
        this.toast.show(this.i18n.t('receive.lotSaved', { code: r.ragCode }));
      }
      this.touched = false;
      void this.nav.replace(['/sort/records', id]);
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
