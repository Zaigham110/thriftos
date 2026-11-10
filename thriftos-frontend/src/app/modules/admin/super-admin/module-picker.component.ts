import { HttpClient } from '@angular/common/http';
import { Component, Injectable, computed, inject, input, model } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, shareReplay } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/config/api.config';
import type { ModuleCatalogue, ModuleInfo, ModuleKey } from '../../../core/tenant/tenant.service';
import { BUSINESS_TYPES } from './business-type';

/** The module list from the server, fetched once per console visit (v2 modules: not typed into the app). */
@Injectable({ providedIn: 'root' })
export class ModuleCatalogueService {
  private readonly http = inject(HttpClient);
  readonly catalogue$: Observable<ModuleCatalogue> = this.http.get<ModuleCatalogue>(`${API_ENDPOINTS.superadmin}/module-catalogue`).pipe(shareReplay(1));
}

/** Why a choice of modules would be refused, in the console's words (the server checks the same). */
export function moduleProblem(modules: readonly string[], stages: number, buying: readonly string[]): string {
  if (!buying.some((b) => modules.includes(b))) return 'Choose at least one way they buy: containers, loose lots or ready bales.';
  if (stages > 0 && !modules.includes('CONTAINERS') && !modules.includes('LOOSE_LOTS')) return 'Sorting needs containers or loose lots. Turn one on, or choose No sorting.';
  return '';
}

/**
 * Every module of a business as the super admin sets it (v2 modules), used by New business and the business page:
 * how they buy (big tiles), how they sort, then a switch per module in each group. Names come from the server.
 */
@Component({
  selector: 'app-module-picker',
  standalone: true,
  template: `
    @if (cat(); as c) {
      <div class="mp">
        <section class="grp" aria-labelledby="mp-buy">
          <h3 id="mp-buy">How they buy <small>at least one</small></h3>
          <div class="tiles">
            @for (m of buyingTiles(); track m.key) {
              <button type="button" class="tile" [class.on]="has(m.key)" [attr.aria-pressed]="has(m.key)" (click)="toggle(m.key)">
                <span class="tick" aria-hidden="true">{{ has(m.key) ? '✓' : '' }}</span>
                <strong>{{ m.name['en'] }}</strong><small>{{ m.hint['en'] }}</small>
              </button>
            }
          </div>
        </section>

        <section class="grp" aria-labelledby="mp-sort">
          <h3 id="mp-sort">How they sort</h3>
          <div class="seg" role="radiogroup" aria-labelledby="mp-sort">
            @for (ty of sortTypes; track ty.stages) {
              <button type="button" role="radio" [attr.aria-checked]="stages() === ty.stages" [class.on]="stages() === ty.stages"
                [disabled]="ty.stages > 0 && !canSort()" (click)="stages.set(ty.stages)">{{ ty.short }}</button>
            }
          </div>
          <small class="muted">{{ sortHint() }}</small>
        </section>

        @for (g of otherGroups(); track g.id) {
          <section class="grp" [attr.aria-label]="g.name">
            <h3>{{ g.name }}</h3>
            <ul class="rows">
              @for (m of g.modules; track m.key) {
                <li>
                  <label class="row">
                    <span class="txt"><strong>{{ m.name['en'] }}</strong><small>{{ m.hint['en'] }}</small></span>
                    <input type="checkbox" role="switch" class="switch" [checked]="has(m.key)" (change)="toggle(m.key)" [attr.aria-label]="m.name['en']" />
                  </label>
                </li>
              }
            </ul>
          </section>
        }

        @if (problem(); as p) { <p class="err" role="alert">{{ p }}</p> }
      </div>
    } @else {
      <p class="muted">Loading the module list…</p>
    }
  `,
  styles: [`
    :host { display:block; }
    .mp { display:grid; gap:20px; }
    .grp { display:grid; gap:10px; }
    h3 { margin:0; font-size:13px; font-weight:700; letter-spacing:.02em; text-transform:uppercase; color:var(--color-text-secondary, #6b6468); }
    h3 small { margin-inline-start:6px; font-weight:500; text-transform:none; letter-spacing:0; }
    .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; }
    .tile { position:relative; display:grid; gap:4px; align-content:start; min-height:92px; padding:12px 14px; border:1px solid var(--color-border, #d6cfd3); border-radius:10px; background:var(--color-surface, #fff); color:inherit; font:inherit; text-align:start; cursor:pointer; }
    .tile:hover { border-color:var(--color-primary, #6f3f63); }
    .tile.on { border:2px solid var(--color-primary, #6f3f63); padding:11px 13px; background:var(--color-primary-soft, #f7f0f5); }
    .tile strong { font-size:15px; padding-inline-end:22px; }
    .tile small { color:var(--color-text-secondary, #6b6468); font-size:12px; line-height:1.4; }
    .tick { position:absolute; inset-block-start:10px; inset-inline-end:10px; display:grid; place-items:center; width:20px; height:20px; border-radius:50%; border:1px solid var(--color-border, #d6cfd3); font-size:12px; font-weight:700; }
    .tile.on .tick { border-color:var(--color-primary, #6f3f63); background:var(--color-primary, #6f3f63); color:#fff; }
    .seg { display:inline-flex; flex-wrap:wrap; gap:4px; width:max-content; max-width:100%; padding:3px; border:1px solid var(--color-border, #d6cfd3); border-radius:10px; background:var(--color-surface-2, #f6f2f4); }
    .seg button { min-height:34px; padding:0 14px; border:0; border-radius:8px; background:transparent; color:inherit; font:inherit; font-size:14px; font-weight:500; cursor:pointer; }
    .seg button.on { background:var(--color-surface, #fff); color:var(--color-primary, #6f3f63); font-weight:700; box-shadow:0 1px 2px rgba(0,0,0,.08); }
    .seg button:disabled { opacity:.45; cursor:not-allowed; }
    .rows { list-style:none; margin:0; padding:0; border:1px solid var(--color-border, #e3dde0); border-radius:10px; overflow:hidden; }
    .rows li + li { border-top:1px solid var(--color-border, #eee8eb); }
    .row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:10px 14px; cursor:pointer; }
    .row:hover { background:var(--color-surface-2, #faf7f9); }
    .txt { display:grid; gap:2px; }
    .txt strong { font-size:14px; font-weight:600; }
    .txt small { color:var(--color-text-secondary, #6b6468); font-size:12px; }
    .switch { appearance:none; flex:none; position:relative; width:40px; height:22px; margin:0; border-radius:999px; background:#cfc6cb; cursor:pointer; transition:background .15s; }
    .switch::after { content:''; position:absolute; inset-block-start:3px; inset-inline-start:3px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.2); transition:inset-inline-start .15s; }
    .switch:checked { background:var(--color-primary, #6f3f63); }
    .switch:checked::after { inset-inline-start:21px; }
    .switch:focus-visible, .tile:focus-visible, .seg button:focus-visible { outline:2px solid var(--color-primary, #6f3f63); outline-offset:2px; }
    .muted { margin:0; color:var(--color-text-secondary, #6b6468); font-size:12px; }
    .err { margin:0; color:var(--color-danger, #b3261e); font-size:14px; }
  `],
})
export class ModulePickerComponent {
  protected readonly cat = toSignal(inject(ModuleCatalogueService).catalogue$);
  /** 0 = no sorting, 1 = categories, 2 = categories and grades. */
  readonly stages = model(2);
  /** The module keys that are on (SORT follows `stages`, not this list). */
  readonly modules = model<string[]>([]);
  /** The business's current values, to warn when sorting is switched off (business page only). */
  readonly wasSorting = input(false);

  protected readonly sortTypes = BUSINESS_TYPES.map((t) => ({ ...t, short: t.stages === 2 ? 'Categories and grades' : t.stages === 1 ? 'Categories' : 'No sorting' }))
    .sort((a, b) => a.stages - b.stages);

  protected readonly buyingTiles = computed(() => {
    const c = this.cat();
    return c ? c.modules.filter((m) => c.buying.includes(m.key)) : [];
  });

  protected readonly otherGroups = computed(() => {
    const c = this.cat();
    if (!c) return [];
    return c.groups
      .filter((g) => g.id !== 'sorting')
      .map((g) => ({ id: g.id, name: g.id === 'buying' ? 'Also for buying' : g.name['en'], modules: c.modules.filter((m: ModuleInfo) => m.group === g.id && m.key !== 'SORT' && !c.buying.includes(m.key)) }))
      .filter((g) => g.modules.length);
  });

  protected readonly canSort = computed(() => this.modules().includes('CONTAINERS') || this.modules().includes('LOOSE_LOTS'));

  protected readonly sortHint = computed(() => {
    const t = BUSINESS_TYPES.find((x) => x.stages === this.stages());
    const off = this.wasSorting() && this.stages() === 0 ? ' The Sorting tab goes away for everyone; sorting already recorded stays.' : '';
    return (t?.hint ?? '') + off;
  });

  readonly problem = computed(() => {
    const c = this.cat();
    return c ? moduleProblem(this.modules(), this.stages(), c.buying) : '';
  });

  protected has(key: ModuleKey): boolean {
    return this.modules().includes(key);
  }

  protected toggle(key: ModuleKey): void {
    const next = this.has(key) ? this.modules().filter((k) => k !== key) : [...this.modules(), key];
    this.modules.set(next);
    // Sorting needs something to sort: without containers or loose lots it goes back to No sorting.
    if (!next.includes('CONTAINERS') && !next.includes('LOOSE_LOTS') && this.stages() > 0) this.stages.set(0);
  }
}
