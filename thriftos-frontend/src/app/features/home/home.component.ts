import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { DashboardComponent } from '../workspace-lists/dashboard.component';
import { AuthService } from '../../core/auth';
import { OwnerHomeComponent } from './owner-home.component';
import { RouterLink } from '@angular/router';
import { I18N } from '../../core/i18n/t.pipe';
import { FloorDataService } from '../../shared/floor/floor-data.service';
import { NeedsAttentionComponent } from '../../shared/offline/needs-attention.component';

/** Home: the owner's numbers (people who may see reports), else the floor's work today and entries that need attention. */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, I18N, NeedsAttentionComponent, OwnerHomeComponent, DashboardComponent],
  template: `
    @if (owner() && desktop()) { <app-dashboard /> } @else if (owner()) { <app-owner-home /> } @else {
    <section class="floor">
      <header class="floor-head"><h1>{{ 'home.munshiTitle' | t }}</h1></header>
      <app-needs-attention />
      @if (canSpend()) { <a class="card spend" routerLink="/finance/expenses/new">{{ 'home.recordExpense' | t }}</a> }
      <div class="row2">
        <a class="card stat" routerLink="/sort"><small>{{ 'home.lotsToSort' | t }}</small><strong class="big-number">{{ waiting() | num }}</strong></a>
        <a class="card stat" routerLink="/sort"><small>{{ 'home.openSorting' | t }}</small><strong class="big-number">{{ open() | num }}</strong></a>
      </div>
    </section>
    }
  `,
  styles: [`.stat { color:var(--tos-ink); text-decoration:none; } .stat small { color:var(--tos-ink-soft); font-weight:700; }
    .spend { display:flex; align-items:center; justify-content:center; min-height:56px; color:var(--tos-primary, #6f3f63); font-size:17px; font-weight:700; text-decoration:none; }`],
})
export class HomeComponent implements OnInit {
  private readonly data = inject(FloorDataService);
  private readonly auth = inject(AuthService);
  protected readonly owner = computed(() => this.auth.permissions().includes('REPORTS_VIEW') || !!this.auth.user()?.isSuperAdmin);
  /** Cash paid at the godown (chai, loading, rickshaw) is recorded from here (v2 review). */
  protected readonly canSpend = computed(() => this.auth.permissions().includes('expense.create'));
  /** The laptop workspace (from 1024 px) gets the full dashboard; phones and tablets keep the four numbers. */
  protected readonly desktop = signal(window.innerWidth >= 1024);
  protected readonly waiting = signal(0);
  protected readonly open = signal(0);

  @HostListener('window:resize')
  protected resized(): void {
    this.desktop.set(window.innerWidth >= 1024);
  }

  ngOnInit(): void {
    if (this.owner()) return;
    this.data.lotsToSort().subscribe((lots) => {
      this.waiting.set(lots.filter((l) => l.status === 'NOT_STARTED').length);
      this.open.set(lots.filter((l) => l.status === 'IN_SORTING').length);
    });
  }
}
