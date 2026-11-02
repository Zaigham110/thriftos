import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Search, UserPlus } from 'lucide-angular';

import { CustomersService } from '../../modules/sales/customers.service';
import { KhataRow, KhataService } from '../../modules/sales/khata.service';

/** Journey 6: customers sorted by what they owe, with days overdue. Add a customer with name + phone. */
@Component({
  selector: 'app-khata-list',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <section class="khata">
      <header>
        <div><h1>Khata</h1><p>Udhaar owed: <strong>Rs {{ +totalOwed() | number: '1.0-0' }}</strong></p></div>
        <button type="button" class="primary" (click)="adding.set(!adding())"><lucide-icon [img]="icons.UserPlus" [size]="18" /> Customer</button>
      </header>
      @if (message(); as text) { <p class="notice">{{ text }}</p> }

      @if (adding()) {
        <form class="card" (ngSubmit)="add()">
          <label>Name<input name="name" [(ngModel)]="name" maxlength="200" required /></label>
          <label>WhatsApp number<input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" placeholder="0300 1234567" required /></label>
          <label>Old udhaar from your register (Rs)<input name="opening" type="number" inputmode="decimal" [(ngModel)]="openingBalance" placeholder="0" /></label>
          <button type="submit" class="primary" [disabled]="!name.trim() || !phone.trim() || saving()">Save customer</button>
        </form>
      }

      <label class="search"><lucide-icon [img]="icons.Search" [size]="18" /><input name="search" [(ngModel)]="search" placeholder="Search name, phone or city" /></label>
      <ul>
        @for (row of filteredRows(); track row.id) {
          <li>
            <a [routerLink]="['/khata', row.id]">
              <span><strong>{{ row.name }}</strong><small>{{ row.city || row.phone || '' }}</small></span>
              <span class="amount" [class.owed]="+row.balance > 0">
                <strong>Rs {{ +row.balance | number: '1.0-0' }}</strong>
                @if (row.overdueDays > 0) { <small [class.late]="row.overdueDays > 30">{{ row.overdueDays }} days</small> }
              </span>
            </a>
          </li>
        } @empty { <li class="empty">No customers yet.</li> }
      </ul>
    </section>
  `,
  styles: [`
    .khata { display:grid; gap:14px; max-width:640px; margin:0 auto; }
    header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    h1 { margin:0; font-size:24px; }
    header p { margin:4px 0 0; color:var(--flow-ink-soft); }
    header strong { color:var(--flow-clay); }
    .card { display:grid; gap:12px; padding:16px; border:1px solid var(--flow-line); border-radius:var(--flow-radius); background:#fff; }
    label { display:grid; gap:6px; font-size:14px; font-weight:700; }
    input { min-height:48px; box-sizing:border-box; padding:0 12px; border:1px solid var(--flow-line); border-radius:10px; font:inherit; font-size:18px; }
    .search { display:flex; align-items:center; gap:8px; padding-left:12px; border:1px solid var(--flow-line); border-radius:10px; background:#fff; }
    .search input { flex:1; border:0; }
    ul { margin:0; padding:0; list-style:none; border:1px solid var(--flow-line); border-radius:var(--flow-radius); background:#fff; overflow:hidden; }
    li + li { border-top:1px solid var(--flow-line); }
    li a { min-height:64px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 16px; color:var(--flow-ink); text-decoration:none; }
    li span { display:grid; gap:2px; }
    small { color:var(--flow-ink-soft); font-size:13px; }
    .amount { text-align:right; }
    .amount.owed strong { color:var(--flow-clay); }
    .late { color:var(--flow-clay); font-weight:700; }
    .empty { padding:24px; text-align:center; color:var(--flow-ink-soft); }
    .primary { min-height:48px; display:flex; align-items:center; justify-content:center; gap:6px; padding:0 16px; border:0; border-radius:12px; background:var(--flow-teal); color:#fff; font:inherit; font-weight:800; }
    .primary:disabled { opacity:.5; }
    .notice { margin:0; padding:12px; border-radius:10px; background:var(--flow-clay-soft); color:var(--flow-clay); }
  `],
})
export class KhataListComponent implements OnInit {
  private readonly khata = inject(KhataService);
  private readonly customers = inject(CustomersService);
  private readonly router = inject(Router);
  protected readonly icons = { Search, UserPlus };
  protected readonly rows = signal<KhataRow[]>([]);
  protected readonly totalOwed = signal('0');
  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected search = '';
  protected name = '';
  protected phone = '';
  protected openingBalance: number | null = null;

  ngOnInit(): void {
    this.load();
  }

  protected filteredRows(): KhataRow[] {
    const q = this.search.trim().toLowerCase();
    return q ? this.rows().filter((r) => r.name.toLowerCase().includes(q) || (r.phone || '').includes(q) || (r.city || '').toLowerCase().includes(q)) : this.rows();
  }

  protected add(): void {
    this.saving.set(true);
    this.customers.create({ name: this.name.trim(), phone: this.phone.trim(), openingBalance: this.openingBalance ?? 0 }).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.router.navigate(['/khata', c.id]);
      },
      error: (e) => {
        this.saving.set(false);
        this.message.set(e?.error?.message || 'Could not save the customer.');
      },
    });
  }

  private load(): void {
    this.khata.list().subscribe({
      next: (result) => {
        this.rows.set(result.customers);
        this.totalOwed.set(result.totalOwed);
      },
      error: () => this.message.set('Khata could not be loaded.'),
    });
  }
}
