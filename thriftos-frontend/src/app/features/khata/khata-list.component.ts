import { HelpLinkComponent } from '../help/help-link.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Search, UserPlus } from 'lucide-angular';

import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { KhataRow, KhataService } from '../../modules/sales/khata.service';
import { NumberFieldComponent } from '../../shared/floor/number-field.component';
import { ToastService } from '../../shared/floor/toast.service';

/** Journey 6: customers sorted by what they owe, with days overdue. Add a customer with name + WhatsApp. */
@Component({
  selector: 'app-khata-list',
  standalone: true,
  imports: [HelpLinkComponent, FormsModule, RouterLink, LucideAngularModule, I18N, NumberFieldComponent],
  template: `
    <section class="floor">
      <header class="floor-head">
        <h1>{{ 'khata.title' | t }}<span class="sub">{{ 'khata.owed' | t: { rs: (totalOwed() | rs) } }}</span></h1>
      </header>

      @if (adding()) {
        <form class="card" (ngSubmit)="add()">
          <label class="field">{{ 'common.name' | t }}<input name="name" [(ngModel)]="name" maxlength="200" autocomplete="off" /></label>
          <label class="field">{{ 'common.phone' | t }}<input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" [placeholder]="'common.phonePlaceholder' | t" /></label>
          <tos-number label="khata.oldUdhaar" unit="unit.money" [optional]="true" [(value)]="openingBalance" />
          <div class="row2">
            <button type="button" class="btn" (click)="adding.set(false)">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="btn primary" [disabled]="!name.trim() || !phone.trim() || saving()">{{ 'khata.saveCustomer' | t }}</button>
          </div>
        </form>
      }

      <label class="search"><lucide-icon [img]="icons.Search" [size]="18" /><input name="search" type="search" [(ngModel)]="search" [placeholder]="'khata.search' | t" [attr.aria-label]="'common.search' | t" /></label>
      <ul class="list">
        @for (row of visible(); track row.id) {
          <li><a class="row" [routerLink]="['/khata', row.id]">
            <span><strong>{{ row.name }}</strong><small>{{ row.city || row.phone || '' }}</small></span>
            <span class="amount" [class.warn]="+row.balance > 0">{{ row.balance | rs }}
              @if (row.overdueDays > 0) { <small [class.warn]="row.overdueDays > 30">{{ 'unit.days' | t: { n: row.overdueDays } }}</small> }
            </span>
          </a></li>
        } @empty { <li class="empty">{{ 'khata.noCustomers' | t }}<app-help-link topic="khata" /></li> }
      </ul>

      @if (!adding()) {
        <footer class="action-bar">
          <button type="button" class="btn primary" (click)="adding.set(true)"><lucide-icon [img]="icons.UserPlus" [size]="20" /> {{ 'sell.newCustomer' | t }}</button>
        </footer>
      }
    </section>
  `,
  styles: [`
    .search { display:flex; align-items:center; gap:8px; padding-inline-start:12px; border:1px solid var(--tos-line); border-radius:12px; background:var(--tos-card); }
    .search input { flex:1; min-width:0; min-height:52px; border:0; background:transparent; font:inherit; font-size:17px; }
    .amount small { display:block; font-weight:600; }
  `],
})
export class KhataListComponent implements OnInit {
  private readonly khata = inject(KhataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly icons = { Search, UserPlus };
  protected readonly rows = signal<KhataRow[]>([]);
  protected readonly totalOwed = signal('0');
  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly openingBalance = signal<number | null>(null);
  protected search = '';
  protected name = '';
  protected phone = '';

  ngOnInit(): void {
    this.khata.list().subscribe({
      next: (r) => {
        this.rows.set(r.customers);
        this.totalOwed.set(r.totalOwed);
      },
      error: () => this.toast.error(this.i18n.t('common.couldNotLoad')),
    });
  }

  protected visible(): KhataRow[] {
    const q = this.search.trim().toLowerCase();
    return q ? this.rows().filter((r) => r.name.toLowerCase().includes(q) || (r.phone || '').includes(q) || (r.city || '').toLowerCase().includes(q)) : this.rows();
  }

  protected async add(): Promise<void> {
    this.saving.set(true);
    const body = { name: this.name.trim(), phone: this.phone.trim(), openingBalance: this.openingBalance() ?? 0 };
    try {
      const r = await this.queue.send<{ id: string }>({ kind: 'customer', label: body.name, url: '/api/customers', body });
      if (r.saved) this.router.navigate(['/khata', r.response.id]);
      else {
        this.toast.show(this.i18n.t('sync.savedOnPhone'));
        this.adding.set(false);
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }
}
