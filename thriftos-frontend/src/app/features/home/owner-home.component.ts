import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight, LucideAngularModule } from 'lucide-angular';
import { I18N } from '../../core/i18n/t.pipe';
import { NeedsAttentionComponent } from '../../shared/offline/needs-attention.component';
import { sessionCache } from '../../core/auth/session-cache';
import { HomeDataService, HomeSummary } from './home-data';
import { FirstWeekComponent } from './first-week.component';

/** Journey 7 — owner home: profit per container, udhaar owed, stock ready, and today's sales. Each taps to its list. */
@Component({
  selector: 'app-owner-home',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N, NeedsAttentionComponent, FirstWeekComponent],
  template: `
    <section class="floor home">
      <header class="floor-head"><h1>{{ 'home.title' | t }}</h1></header>
      <app-needs-attention />
      <app-first-week />
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
  `],
})
export class OwnerHomeComponent implements OnInit {
  private readonly data = inject(HomeDataService);
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
