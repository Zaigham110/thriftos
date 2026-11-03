import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';
import { I18N } from '../../core/i18n/t.pipe';
import { Compare, ContainerRow, HomeDataService } from './home-data';

/** Behind "Profit per container": the last containers with profit so far, yield and A-grade %, then supplier and country compared. */
@Component({
  selector: 'app-home-containers',
  standalone: true,
  imports: [DatePipe, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/home" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'home.lastContainers' | t }}</h1>
      </header>
      <ul class="list">
        @for (c of rows(); track c.id) {
          <li class="row">
            <span><strong>{{ c.supplier || c.containerNumber }}</strong>
              <small><span class="ltr">{{ c.containerNumber }}</span> · {{ c.origin || '' }} · <span class="ltr">{{ c.date | date: 'd MMM' : undefined : 'en' }}</span></small>
              <small>@if (c.yieldPercent !== null) { {{ 'home.yieldShort' | t: { n: c.yieldPercent } }} }@if (c.topGradePercent !== null) { · {{ 'home.yield' | t: { n: c.topGradePercent } }} }</small></span>
            <span class="amount" [class.warn]="+c.profit < 0">{{ c.profit | rs }}<small>{{ c.kg | kg }}</small></span>
          </li>
        } @empty { <li class="empty">{{ 'home.noContainers' | t }}</li> }
      </ul>
      @if (bySupplier().length) {
        <section class="card">
          <h2>{{ 'home.bySupplier' | t }}</h2>
          <ul class="list">
            @for (g of bySupplier(); track g.name) { <li class="row"><span><strong>{{ g.name }}</strong><small>@if (g.topGradePercent !== null) { {{ 'home.yield' | t: { n: g.topGradePercent } }} }</small></span><span class="amount">{{ 'home.perKg' | t: { rs: (g.profitPerKg | rs) } }}</span></li> }
          </ul>
        </section>
      }
      @if (byOrigin().length) {
        <section class="card">
          <h2>{{ 'home.byOrigin' | t }}</h2>
          <ul class="list">
            @for (g of byOrigin(); track g.name) { <li class="row"><span><strong>{{ g.name }}</strong><small>@if (g.topGradePercent !== null) { {{ 'home.yield' | t: { n: g.topGradePercent } }} }</small></span><span class="amount">{{ 'home.perKg' | t: { rs: (g.profitPerKg | rs) } }}</span></li> }
          </ul>
        </section>
      }
    </section>
  `,
  styles: [`.amount small { display:block; font-weight:600; }`],
})
export class HomeContainersComponent implements OnInit {
  private readonly data = inject(HomeDataService);
  protected readonly icons = { ArrowLeft };
  protected readonly rows = signal<ContainerRow[]>([]);
  protected readonly bySupplier = signal<Compare[]>([]);
  protected readonly byOrigin = signal<Compare[]>([]);

  ngOnInit(): void {
    this.data.containers().subscribe({
      next: (r) => {
        this.rows.set(r.containers);
        this.bySupplier.set(r.bySupplier);
        this.byOrigin.set(r.byOrigin);
      },
      error: () => undefined,
    });
  }
}
