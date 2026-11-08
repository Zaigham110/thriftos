import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth';
import { RouterLink } from '@angular/router';
import { ChevronRight, LucideAngularModule } from 'lucide-angular';
import { I18N } from '../../core/i18n/t.pipe';
import { NeedsAttentionComponent } from '../../shared/offline/needs-attention.component';
import { sessionCache } from '../../core/auth/session-cache';
import { HomeDataService, HomeSummary } from './home-data';
import { FirstWeekComponent } from './first-week.component';
import { CashTodayComponent } from './cash-today.component';

/** Journey 7 — owner home: profit per container, udhaar owed, stock ready, and today's sales. Each taps to its list. */
@Component({
  selector: 'app-owner-home',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N, NeedsAttentionComponent, FirstWeekComponent, CashTodayComponent],
  template: `
    <section class="floor home">
      <header class="floor-head"><h1>{{ 'home.title' | t }}</h1></header>
      <app-needs-attention />
      <app-first-week />
      @if (canSpend()) { <a class="card spend" routerLink="/finance/expenses/new">{{ 'home.recordExpense' | t }}</a> }
      <app-cash-today />
      @if (s(); as s) {
        <a class="card stat" routerLink="/home/containers">
          <small>{{ 'home.profitPerContainer' | t }}</small>
          <strong class="big-number" [class.warn]="+s.profitPerContainer.average < 0">{{ s.profitPerContainer.average | rs }}</strong>
          <span class="hint">{{ 'home.lastN' | t: { n: s.profitPerContainer.containers } }}</span>
          <lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" />
        </a>
        <a class="card stat" routerLink="/khata">
          <small>{{ 'home.udhaar' | t }}</small>
          <strong class="big-number warn">{{ s.udhaar.owed | rs }}</strong>
          <span class="hint">{{ 'home.customersOwing' | t: { n: s.udhaar.customers } }}</span>
          <lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" />
        </a>
        <a class="card stat" routerLink="/stock">
          <small>{{ 'home.stockReady' | t }}</small>
          <strong class="big-number">{{ s.stockReady.kg | kg }}</strong>
          <span class="hint">{{ s.stockReady.bales | num }} {{ 'unit.bales' | t }} · {{ s.stockReady.value | rs }}</span>
          <lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" />
        </a>
        <a class="card stat" routerLink="/home/today">
          <small>{{ 'home.todaySales' | t }}</small>
          <strong class="big-number">{{ s.today.total | rs }}</strong>
          <span class="hint">{{ 'home.salesCount' | t: { n: s.today.sales } }} · {{ 'home.profitSoFar' | t }} {{ s.today.profit | rs }}</span>
          <lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" />
        </a>
      } @else if (failed()) {
        <p class="notice error">{{ 'common.couldNotLoad' | t }}</p>
      }
    </section>
  `,
  styles: [`
    .stat { position:relative; gap:4px; color:var(--tos-ink); text-decoration:none; }
    .stat small { color:var(--tos-ink-soft); font-size:14px; font-weight:700; }
    .stat .go { position:absolute; inset-inline-end:14px; inset-block-start:50%; transform:translateY(-50%); color:var(--tos-ink-soft); }
    html[dir='rtl'] .stat .go { transform:translateY(-50%) scaleX(-1); }
    .spend { display:flex; align-items:center; justify-content:center; min-height:52px; color:var(--tos-primary, #6f3f63); font-size:16px; font-weight:700; text-decoration:none; }
  `],
})
export class OwnerHomeComponent implements OnInit {
  private readonly data = inject(HomeDataService);
  private readonly auth = inject(AuthService);
  /** Record an expense straight from Home (v2 review). */
  protected readonly canSpend = computed(() => this.auth.isSuperAdmin() || this.auth.permissions().includes('expense.create'));
  protected readonly icons = { ChevronRight };
  /** Last numbers on this phone, shown at once (Slow 3G: the fresh ones take a few seconds), then replaced. */
  protected readonly s = signal<HomeSummary | null>(sessionCache.screen<HomeSummary>('home'));
  protected readonly failed = signal(false);

  ngOnInit(): void {
    this.data.summary().subscribe({
      next: (s) => {
        this.s.set(s);
        sessionCache.saveScreen('home', s);
      },
      error: () => this.failed.set(!this.s()),
    });
  }
}
