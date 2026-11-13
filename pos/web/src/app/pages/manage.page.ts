import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, ROLE_LABEL } from '../core';
import { Shelf } from '../offline/shelf';
import { Icon, IconName } from '../ui/icon';

interface Tile {
  path: string;
  label: string;
  help: string;
  icon: IconName;
  who: 'all' | 'manager' | 'owner';
  badge?: () => number;
}

/** Everything that is not selling, one tap away: big tiles, no menu tree. */
@Component({
  imports: [RouterLink, Icon],
  template: `
    <div class="screen">
      <h1>Manage</h1>
      <p class="text-sm text-stone-500">{{ api.session()?.shop?.name }} · {{ api.branch()?.name }} · {{ api.session()?.user?.name }} ({{ roles[api.role()] }})</p>
      <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        @for (t of tiles(); track t.path) {
          <a [routerLink]="t.path" class="card relative flex min-h-[124px] flex-col p-4 transition hover:border-brand-300 active:scale-[.98]">
            <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><pos-icon [name]="t.icon" size="h-6 w-6" /></span>
            <span class="mt-3 text-base font-semibold">{{ t.label }}</span>
            <span class="text-xs leading-snug text-stone-500">{{ t.help }}</span>
            @if (t.badge && t.badge()) {
              <span class="num absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">{{ t.badge() }}</span>
            }
          </a>
        }
      </div>
    </div>
  `,
})
export class ManagePage {
  readonly api = inject(Api);
  private readonly shelf = inject(Shelf);
  readonly roles = ROLE_LABEL;

  private readonly all: Tile[] = [
    { path: '/drawer', label: 'Cash drawer', help: 'Open, cash in and out, count and close', icon: 'drawer', who: 'all' },
    { path: '/expenses', label: 'Expenses', help: 'Rent, tea, loader, salary', icon: 'wallet', who: 'manager' },
    { path: '/reports', label: 'Reports', help: 'Sales, profit, stock, shifts', icon: 'chart', who: 'manager' },
    { path: '/shipments', label: 'Shipments', help: 'Import a bale list, see what a shipment earned', icon: 'truck', who: 'owner' },
    { path: '/transfers', label: 'Between branches', help: 'Receive and follow bales on the way', icon: 'swap', who: 'all', badge: () => this.shelf.snap()?.incoming ?? 0 },
    { path: '/stock-check', label: 'Stock check', help: 'Scan the shelf, find what is missing', icon: 'count', who: 'all' },
    { path: '/settings/hardware', label: 'Printer and scanner', help: 'Receipt printer, cash drawer, stickers, this till', icon: 'print', who: 'all' },
    { path: '/settings/shop', label: 'Shop and tax', help: 'Bill header, tax, discount limit', icon: 'store', who: 'owner' },
    { path: '/settings/staff', label: 'Staff', help: 'Cashiers, managers, PINs', icon: 'people', who: 'owner' },
    { path: '/settings/branches', label: 'Branches and tills', help: 'Add a branch or a counter', icon: 'manage', who: 'owner' },
    { path: '/settings/me', label: 'My PIN', help: 'Unlock a shared till quickly', icon: 'lock', who: 'all' },
  ];
  readonly tiles = computed(() => this.all.filter((t) => t.who === 'all' || (t.who === 'manager' && this.api.isManager()) || (t.who === 'owner' && this.api.isOwner())));
}
