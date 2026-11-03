import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';
import { I18N } from '../../core/i18n/t.pipe';
import { HomeDataService, TodaySale } from './home-data';

/** Behind "Today's sales": every sale today, newest first; each opens its bill. */
@Component({
  selector: 'app-home-today',
  standalone: true,
  imports: [DatePipe, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head">
        <a class="icon-btn back" routerLink="/home" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
        <h1>{{ 'home.listSales' | t }}</h1>
      </header>
      <ul class="list">
        @for (s of sales(); track s.id) {
          <li><a class="row" [routerLink]="['/sell/records', s.id]">
            <span><strong>{{ s.customer.name }}</strong><small><span class="ltr">{{ s.saleNumber }}</span> · <span class="ltr">{{ s.issuedAt | date: 'HH:mm' : undefined : 'en' }}</span> · {{ 'sell.mode.' + s.paymentMode | t }}</small></span>
            <span class="amount">{{ s.totalAmount | rs }}<small>{{ 'home.profitSoFar' | t }} {{ s.totalProfit | rs }}</small></span>
          </a></li>
        } @empty { <li class="empty">{{ 'home.noSalesToday' | t }}</li> }
      </ul>
    </section>
  `,
  styles: [`.amount small { display:block; font-weight:600; }`],
})
export class HomeTodayComponent implements OnInit {
  private readonly data = inject(HomeDataService);
  protected readonly icons = { ArrowLeft };
  protected readonly sales = signal<TodaySale[]>([]);

  ngOnInit(): void {
    this.data.today().subscribe({ next: (s) => this.sales.set(s), error: () => undefined });
  }
}
