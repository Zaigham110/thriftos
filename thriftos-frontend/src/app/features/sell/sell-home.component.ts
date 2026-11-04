import { DatePipe } from '@angular/common';
import { HelpLinkComponent } from '../help/help-link.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { I18N } from '../../core/i18n/t.pipe';
import { SaleListItem } from '../../modules/sales/sales.models';
import { SalesService } from '../../modules/sales/sales.service';

/** Becho: recent sales; "New sale" is the one primary action. */
@Component({
  selector: 'app-sell-home',
  standalone: true,
  imports: [HelpLinkComponent, DatePipe, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head"><h1>{{ 'sell.title' | t }}</h1></header>
      <section class="card">
        <h2>{{ 'sell.recent' | t }}</h2>
        <ul class="list">
          @for (s of sales(); track s.id) {
            <li><a class="row" [routerLink]="['/sell/records', s.id]">
              <span><strong>{{ $any(s).customer?.name }}</strong><small><span class="ltr">{{ s.saleNumber }}</span> · {{ (s.issuedAt || s.createdAt) | date: 'd MMM' : undefined : 'en' }}</small></span>
              <span class="amount">{{ s.totalAmount | rs }}<small>{{ 'sell.mode.' + s.paymentMode | t }}</small></span>
            </a></li>
          } @empty { <li class="empty">{{ 'common.empty' | t }}<app-help-link topic="sale" /></li> }
        </ul>
      </section>
      <footer class="action-bar">
        <a class="btn primary" routerLink="/sell/new"><lucide-icon [img]="icons.Plus" [size]="20" /> {{ 'sell.new' | t }}</a>
      </footer>
    </section>
  `,
})
export class SellHomeComponent implements OnInit {
  private readonly salesService = inject(SalesService);
  protected readonly icons = { Plus };
  protected readonly sales = signal<SaleListItem[]>([]);

  ngOnInit(): void {
    this.salesService.list().subscribe({ next: (s) => this.sales.set(s.slice(0, 30)), error: () => undefined });
  }
}
