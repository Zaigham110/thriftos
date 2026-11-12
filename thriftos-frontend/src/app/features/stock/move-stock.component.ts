import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, ScanLine, X } from 'lucide-angular';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ScanSheetComponent } from '../../shared/floor/scan-sheet.component';
import { ToastService } from '../../shared/floor/toast.service';

interface Godown { id: string; name: string; isActive?: boolean }
interface Picked { id: string; code: string | null; name: string | null; unit: 'KG' | 'BALE' | 'PIECE'; left: string; kg: string | null; godown: { id: string; name: string } | null }

/**
 * Move stock between godowns (Phase 9.3): pick where it goes, scan each bale's QR (or type its code), then move
 * them all in one go. Bales already in that godown are said so; a code scanned twice is added once.
 */
@Component({
  selector: 'app-move-stock',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, I18N, ScanSheetComponent],
  template: `
    <section class="floor move">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/stock" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'move.title' | t }}</h1>
      </header>

      <span class="field-label" id="to-godown">{{ 'move.to' | t }}</span>
      <div class="chips" role="radiogroup" aria-labelledby="to-godown">
        @for (g of godowns(); track g.id) {
          <button type="button" class="chip" role="radio" [class.on]="to() === g.id" [attr.aria-checked]="to() === g.id" (click)="to.set(g.id)">{{ g.name }}</button>
        }
        @if (canAddGodown()) { <button type="button" class="chip add-g" (click)="adding.set(!adding())">+ {{ 'move.newGodown' | t }}</button> }
      </div>
      @if (godowns().length === 1 && !adding()) {
        <p class="notice">{{ 'move.oneGodown' | t: { name: godowns()[0].name } }}</p>
      }
      @if (adding()) {
        <!-- A new godown right here (also in Settings → Advanced → Godowns). -->
        <form class="card typed" (ngSubmit)="addGodown()">
          <label class="field">{{ 'move.godownName' | t }}<input name="gname" maxlength="80" [(ngModel)]="newGodown" [placeholder]="'ws.names.warehouses.placeholder' | t" /></label>
          <button type="submit" class="btn primary" [disabled]="!newGodown.trim() || busy()">{{ 'move.addGodown' | t }}</button>
        </form>
      }

      <div class="card add">
        <button type="button" class="btn primary block" (click)="scanning.set(true)"><lucide-icon [img]="icons.ScanLine" [size]="20" /> {{ 'move.scan' | t }}</button>
        <form class="typed" (ngSubmit)="add(code)">
          <label class="field">{{ 'stock.code' | t }}<input name="code" [(ngModel)]="code" autocomplete="off" autocapitalize="characters" class="ltr" placeholder="B-0001" /></label>
          <button type="submit" class="btn" [disabled]="!code.trim() || busy()">{{ 'move.add' | t }}</button>
        </form>
      </div>
      @if (scanning()) { <tos-scan-sheet (scanned)="scanned($event)" (closed)="scanning.set(false)" /> }

      <ul class="list" [attr.aria-label]="'move.list' | t">
        @for (p of picked(); track p.id) {
          <li class="row">
            <span><strong>{{ p.name ?? '—' }}</strong><small><span class="ltr">{{ p.code }}</span> · {{ p.godown?.name ?? ('move.noGodown' | t) }}@if (p.godown?.id === to()) { · {{ 'move.alreadyThere' | t }} }</small></span>
            <span class="amount">@if (p.kg) { {{ i18n.kg(p.kg) }} }<button type="button" class="icon-btn" [attr.aria-label]="'move.remove' | t" (click)="remove(p.id)"><lucide-icon [img]="icons.X" [size]="18" /></button></span>
          </li>
        } @empty { <li class="notice">{{ 'move.empty' | t }}</li> }
      </ul>

      <footer class="action-bar">
        <div class="summary"><small>{{ 'move.count' | t: { n: picked().length } }}</small>@if (totalKg()) { <strong>{{ i18n.kg(totalKg()) }}</strong> }</div>
        <button type="button" class="btn primary" [disabled]="!to() || !picked().length || busy()" (click)="move()">{{ (busy() ? 'common.saving' : 'move.moveTo') | t: { godown: toName() } }}</button>
      </footer>
    </section>
  `,
  styles: [`
    .move .chips { margin-bottom:12px; }
    .add { display:grid; gap:10px; margin-bottom:12px; }
    .typed { display:flex; gap:8px; align-items:flex-end; }
    .typed .field { flex:1; }
    .amount { display:inline-flex; align-items:center; gap:6px; }
  `],
})
export class MoveStockComponent {
  private readonly http = inject(HttpClient);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  protected readonly icons = { ArrowLeft, ScanLine, X };
  protected readonly godowns = signal<Godown[]>([]);
  protected readonly to = signal<string | null>(null);
  protected readonly picked = signal<Picked[]>([]);
  protected readonly scanning = signal(false);
  protected readonly busy = signal(false);
  protected code = '';
  protected newGodown = '';
  protected readonly adding = signal(false);
  private readonly auth = inject(AuthService);
  protected readonly canAddGodown = computed(() => {
    this.auth.permissions();
    return this.auth.hasPermission('warehouse.create');
  });
  protected readonly toName = computed(() => this.godowns().find((g) => g.id === this.to())?.name ?? '');
  protected readonly totalKg = computed(() => this.picked().reduce((t, p) => t + Number(p.kg ?? 0), 0));

  constructor() {
    this.loadGodowns();
  }

  private loadGodowns(pick?: string): void {
    this.http.get<Godown[]>('/api/tenant/warehouses').subscribe({
      next: (g) => {
        this.godowns.set(g.filter((x) => x.isActive !== false));
        if (pick) this.to.set(pick);
      },
      error: () => this.toast.error(this.i18n.t('common.couldNotLoad')),
    });
  }

  /** A new godown from the move screen; it becomes where the bales go. */
  protected addGodown(): void {
    const name = this.newGodown.trim();
    if (!name) return;
    const taken = new Set(this.godowns().map((g) => (g as Godown & { code?: string }).code ?? ''));
    let code = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'G';
    for (let n = 2; taken.has(code); n++) code = `${code.slice(0, 5)}${n}`;
    this.busy.set(true);
    this.http.post<Godown>('/api/admin/warehouses', { name, code }).subscribe({
      next: (g) => {
        this.busy.set(false);
        this.newGodown = '';
        this.adding.set(false);
        this.toast.show(this.i18n.t('move.godownAdded', { name: g.name }));
        this.loadGodowns(g.id);
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.toast.error(e.error?.message ?? this.i18n.t('common.couldNotSave'));
      },
    });
  }

  /** One scan adds one bale; the camera opens again for the next. */
  protected scanned(code: string): void {
    this.scanning.set(false);
    this.add(code, true);
  }

  protected add(raw: string, again = false): void {
    const code = raw.trim();
    if (!code) return;
    this.busy.set(true);
    this.http.get<Picked>(`/api/workspace/stock/scan/${encodeURIComponent(code)}`).subscribe({
      next: (p) => {
        this.busy.set(false);
        this.code = '';
        if (this.picked().some((x) => x.id === p.id)) this.toast.show(this.i18n.t('move.twice', { code: p.code ?? code }));
        else this.picked.update((list) => [p, ...list]);
        if (again) setTimeout(() => this.scanning.set(true), 300);
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.i18n.t('move.notFound', { code }));
      },
    });
  }

  protected remove(id: string): void {
    this.picked.update((list) => list.filter((p) => p.id !== id));
  }

  protected move(): void {
    const to = this.to();
    if (!to || !this.picked().length) return;
    this.busy.set(true);
    this.http.post<{ moved: number; alreadyThere: number; godown: { name: string } }>('/api/workspace/stock/transfer', { godownId: to, itemIds: this.picked().map((p) => p.id) }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.picked.set([]);
        this.toast.show(this.i18n.t(r.alreadyThere ? 'move.doneSome' : 'move.done', { n: r.moved, godown: r.godown.name, there: r.alreadyThere }));
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.toast.error(e.error?.message ?? this.i18n.t('common.couldNotSave'));
      },
    });
  }
}
