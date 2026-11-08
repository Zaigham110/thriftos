import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';

interface TodayCash { expected: string; close: unknown | null; openDays: number }

/**
 * Home reminder (v2 review: Cash close): what should be in the drawer today and a way to close the day, plus how
 * many earlier days were never closed. Only for people who close the cash; gone once today is closed.
 */
@Component({
  selector: 'app-cash-today',
  standalone: true,
  imports: [RouterLink, TPipe],
  template: `
    @if (v(); as v) {
      @if (!v.close) {
        <a class="cash-today" routerLink="/finance/close">
          <span class="text">
            <small>{{ 'home.cashToday' | t }}</small>
            <strong>{{ 'home.cashShould' | t: { amount: i18n.money(v.expected) } }}</strong>
            @if (v.openDays) { <span class="warn">{{ 'home.cashOpenDays' | t: { n: v.openDays } }}</span> }
          </span>
          <span class="go">{{ 'home.closeDay' | t }}</span>
        </a>
      }
    }
  `,
  styles: [`
    :host { display:block; }
    .cash-today { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border:1px solid var(--ws-line, var(--tos-line, #e3dde0)); border-radius:12px; background:var(--ws-surface, var(--tos-surface, #fff)); color:inherit; text-decoration:none; }
    .text { display:grid; gap:2px; }
    small { color:var(--ws-ink-2, var(--tos-ink-soft, #6b6468)); font-size:14px; font-weight:700; }
    strong { font-size:17px; }
    .warn { color:var(--ws-bad, #b42318); font-size:14px; font-weight:600; }
    .go { padding:8px 14px; border-radius:999px; background:var(--ws-brand, var(--tos-primary, #6f3f63)); color:#fff; font-weight:700; white-space:nowrap; }
  `],
})
export class CashTodayComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly allowed = computed(() => {
    const p = this.auth.permissions();
    return p.includes('cash.close') && p.includes('finance.view');
  });
  protected readonly v = signal<TodayCash | null>(null);

  ngOnInit(): void {
    if (!this.allowed()) return;
    this.http.get<TodayCash>('/api/workspace/finance/close').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (v) => this.v.set(v), error: () => this.v.set(null) });
  }
}
