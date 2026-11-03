import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule, Printer } from 'lucide-angular';
import { catchError, map, of, switchMap } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';

/** GET /api/workspace/customers/:id/statement */
export interface Statement {
  business: string;
  customer: { id: string; name: string; phone: string | null; city: string | null; address: string | null };
  from: string | null;
  to: string | null;
  opening: string;
  lines: { date: string; kind: 'OPENING' | 'SALE' | 'PAYMENT'; ref: string | null; debit: string; credit: string; balance: string }[];
  debit: string;
  credit: string;
  closing: string;
  generatedAt: string;
}

/**
 * Statement of account (enterprise plan E3.5): a printable A4 page — balance brought forward, every sale and
 * payment in the period with the running balance, balance carried forward. "Print" saves it as a PDF too.
 */
@Component({
  selector: 'app-statement',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, TPipe],
  template: `
    <div class="bar">
      <a class="ws-btn" [routerLink]="['/khata/records', id()]"><lucide-icon [img]="icons.ArrowLeft" [size]="16" aria-hidden="true" />{{ 'common.back' | t }}</a>
      <label>{{ 'ws.statement.from' | t }}<input type="date" [ngModel]="from() ?? ''" (ngModelChange)="go($event, to())" /></label>
      <label>{{ 'ws.statement.to' | t }}<input type="date" [ngModel]="to() ?? ''" (ngModelChange)="go(from(), $event)" /></label>
      <button type="button" class="ws-btn primary" (click)="print()" [disabled]="!data()"><lucide-icon [img]="icons.Printer" [size]="16" aria-hidden="true" />{{ 'ws.statement.print' | t }}</button>
    </div>
    @if (failed()) {
      <p class="sheet">{{ 'common.couldNotLoad' | t }}</p>
    } @else if (data(); as s) {
      <article class="sheet">
        <header>
          <div><h1>{{ s.business }}</h1><p>{{ 'ws.statement.title' | t }}</p></div>
          <div class="right"><strong>{{ s.customer.name }}</strong><p>{{ [s.customer.city, s.customer.phone, s.customer.address].filter(isText).join(' · ') }}</p><p>{{ period() }}</p></div>
        </header>
        <table>
          <caption class="sr-only">{{ 'ws.statement.title' | t }}</caption>
          <thead><tr><th scope="col">{{ 'ws.col.date' | t }}</th><th scope="col">{{ 'ws.statement.details' | t }}</th><th scope="col" class="num">{{ 'ws.statement.debit' | t }}</th><th scope="col" class="num">{{ 'ws.statement.credit' | t }}</th><th scope="col" class="num">{{ 'ws.collections.balance' | t }}</th></tr></thead>
          <tbody>
            <tr class="carry"><td></td><td>{{ 'ws.statement.broughtForward' | t }}</td><td></td><td></td><td class="num">{{ i18n.money(s.opening) }}</td></tr>
            @for (l of s.lines; track $index) {
              <tr>
                <td>{{ day(l.date) }}</td>
                <td>{{ details(l) }}</td>
                <td class="num">{{ +l.debit ? i18n.money(l.debit) : '' }}</td>
                <td class="num">{{ +l.credit ? i18n.money(l.credit) : '' }}</td>
                <td class="num">{{ i18n.money(l.balance) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">{{ 'ws.statement.nothing' | t }}</td></tr>
            }
          </tbody>
          <tfoot>
            <tr><td></td><td>{{ 'ws.grid.total' | t }}</td><td class="num">{{ i18n.money(s.debit) }}</td><td class="num">{{ i18n.money(s.credit) }}</td><td></td></tr>
            <tr class="carry"><td></td><td>{{ 'ws.statement.carriedForward' | t }}</td><td></td><td></td><td class="num">{{ i18n.money(s.closing) }}</td></tr>
          </tfoot>
        </table>
        <footer>{{ 'ws.statement.generated' | t: { date: day(s.generatedAt) } }}</footer>
      </article>
    } @else {
      <p class="sheet">{{ 'common.loading' | t }}</p>
    }
  `,
  styles: [`
    :host { display:block; min-height:100vh; padding:var(--ws-4, 16px); background:var(--ws-bg, #f4f4f5); color:#111; font-family:var(--ws-font, system-ui); }
    .bar { display:flex; flex-wrap:wrap; align-items:end; gap:12px; max-width:210mm; margin:0 auto 16px; }
    .bar label { display:grid; gap:4px; font-size:13px; color:#555; }
    .bar input { height:36px; padding:0 8px; border:1px solid #d4d4d8; border-radius:8px; font:inherit; }
    .sheet { box-sizing:border-box; max-width:210mm; min-height:200px; margin:0 auto; padding:16mm; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.12); }
    header { display:flex; justify-content:space-between; gap:24px; margin-bottom:12mm; }
    h1 { margin:0; font-size:22px; }
    header p { margin:2px 0 0; color:#555; font-size:13px; }
    .right { text-align:end; }
    table { width:100%; border-collapse:collapse; font-size:13px; font-variant-numeric:tabular-nums; }
    th, td { padding:6px 8px; border-bottom:1px solid #e4e4e7; text-align:start; }
    th { color:#555; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
    .num { text-align:end; white-space:nowrap; }
    .carry td { font-weight:600; background:#fafafa; }
    tfoot td { font-weight:600; }
    .empty { text-align:center; color:#777; }
    footer { margin-top:10mm; color:#777; font-size:11px; }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
    @media print { :host { padding:0; background:#fff; } .bar { display:none; } .sheet { box-shadow:none; padding:0; max-width:none; } @page { size:A4; margin:14mm; } }
  `],
})
export class StatementComponent {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly id = input.required<string>();
  /** ?from=YYYY-MM-DD&to=YYYY-MM-DD */
  readonly from = input<string | undefined>();
  readonly to = input<string | undefined>();
  protected readonly icons = { ArrowLeft, Printer };
  protected readonly data = signal<Statement | null>(null);
  protected readonly failed = signal(false);
  protected readonly isText = (x: string | null): x is string => !!x;

  protected readonly period = computed(() => {
    const s = this.data();
    if (!s) return '';
    if (!s.from && !s.to) return this.i18n.t('ws.statement.allTime');
    return `${s.from ? this.day(s.from + 'T12:00:00Z') : '…'} – ${s.to ? this.day(s.to + 'T12:00:00Z') : this.day(s.generatedAt)}`;
  });

  constructor() {
    const request = computed(() => ({ id: this.id(), from: this.from(), to: this.to() }));
    toObservable(request)
      .pipe(
        switchMap(({ id, from, to }) => {
          let params = new HttpParams();
          if (from) params = params.set('from', from);
          if (to) params = params.set('to', to);
          return this.http.get<Statement>(`/api/workspace/customers/${id}/statement`, { params }).pipe(map((s) => ({ ok: true as const, s })), catchError(() => of({ ok: false as const })));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((x) => {
        this.failed.set(!x.ok);
        if (x.ok) this.data.set(x.s);
      });
  }

  protected day(v: string): string {
    return new Date(v).toLocaleDateString(this.i18n.lang() === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' });
  }

  protected details(l: Statement['lines'][number]): string {
    if (l.kind === 'OPENING') return this.i18n.t('ws.statement.opening');
    if (l.kind === 'SALE') return this.i18n.t('ws.statement.sale', { ref: l.ref ?? '' });
    return this.i18n.t('ws.statement.payment', { method: this.i18n.t(`method.${l.ref}`) });
  }

  protected go(from: string | undefined, to: string | undefined): void {
    void this.router.navigate([], { queryParams: { from: from || null, to: to || null }, replaceUrl: true });
  }

  protected print(): void {
    window.print();
  }
}
