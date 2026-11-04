import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Building2, Factory, Layers3, LucideAngularModule, Medal, Package, Recycle, ShieldCheck, Tags, Users, Warehouse } from 'lucide-angular';
import { AuthService } from '../../core/auth';
import { TPipe } from '../../core/i18n/t.pipe';
import { WsPageHeaderComponent } from '../../shared/ui/workspace';

type Icon = typeof Building2;
interface Area { key: string; path: string; icon: Icon; permission: string }
interface Group { key: string; areas: Area[] }

/** The business's master data, grouped; each area shown to people who may open it. */
const GROUPS: Group[] = [
  {
    key: 'business',
    areas: [
      { key: 'tenant', path: 'tenant', icon: Building2, permission: 'user.read' },
      { key: 'users', path: 'users', icon: Users, permission: 'user.read' },
      { key: 'roles', path: 'roles', icon: ShieldCheck, permission: 'role.read' },
    ],
  },
  {
    key: 'goods',
    areas: [
      { key: 'rawCategories', path: 'raw-categories', icon: Package, permission: 'category.read' },
      { key: 'categories', path: 'categories', icon: Layers3, permission: 'category.read' },
      { key: 'grades', path: 'grades', icon: Medal, permission: 'grade.read' },
      { key: 'waste', path: 'waste-categories', icon: Recycle, permission: 'category.read' },
    ],
  },
  {
    key: 'partners',
    areas: [
      { key: 'vendors', path: 'vendors', icon: Factory, permission: 'vendor.read' },
      { key: 'godowns', path: 'warehouses', icon: Warehouse, permission: 'warehouse.read' },
      { key: 'prices', path: '/sell/prices', icon: Tags, permission: 'price.manage' },
    ],
  },
];

/**
 * Settings → Advanced on the laptop (enterprise UI pass): the master data the rest of the app uses —
 * business profile, people and roles, what you buy and sort into, suppliers, godowns and price lists.
 */
@Component({
  selector: 'app-admin-index',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe, WsPageHeaderComponent],
  template: `
    <div class="page">
      <ws-page-header [heading]="'ws.adminIdx.title' | t" [subtitle]="'ws.adminIdx.subtitle' | t" />
      @for (g of groups(); track g.key) {
        <section>
          <h2>{{ 'ws.adminIdx.group.' + g.key | t }}</h2>
          <div class="grid">
            @for (a of g.areas; track a.key) {
              <a class="area" [routerLink]="a.path">
                <lucide-icon [img]="a.icon" [size]="20" aria-hidden="true" />
                <strong>{{ 'ws.adminIdx.area.' + a.key + '.name' | t }}</strong>
                <small>{{ 'ws.adminIdx.area.' + a.key + '.hint' | t }}</small>
              </a>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .page { display:grid; gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    section { display:grid; gap:var(--ws-3); }
    h2 { margin:0; color:var(--ws-ink-2); font-size:var(--ws-text-xs); font-weight:600; letter-spacing:.06em; text-transform:uppercase; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:var(--ws-3); }
    .area { display:grid; grid-template-columns:auto 1fr; column-gap:var(--ws-3); row-gap:2px; padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); color:var(--ws-ink); text-decoration:none; }
    .area:hover { border-color:var(--ws-brand); }
    .area lucide-icon { grid-row:span 2; color:var(--ws-brand); }
    .area small { color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
  `],
})
export class AdminIndexComponent {
  private readonly auth = inject(AuthService);
  protected readonly groups = computed(() => {
    const can = (p: string) => this.auth.isSuperAdmin() || this.auth.permissions().includes(p);
    return GROUPS.map((g) => ({ ...g, areas: g.areas.filter((a) => can(a.permission)) })).filter((g) => g.areas.length);
  });
}
