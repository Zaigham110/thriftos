import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OperationalModule, TenantService } from '../../../core/tenant/tenant.service';

/** Mobile-only operational destinations that do not belong in the thumb-bar. */
@Component({
  selector: 'app-mobile-more',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="more-page">
      <header><span>Operational destinations</span><h2>More work</h2><p>Sales, insight, and administration stay available without crowding the task bar.</p></header>
      <nav>
        @if (isModuleEnabled('SALES')) { <a routerLink="/app/lite/quick-sale"><span>¤</span><div><strong>Sales</strong><small>Sell sealed stock, collect payments, and review orders.</small></div><b>›</b></a> }
        @if (isModuleEnabled('INSIGHTS')) { <a routerLink="/app/reports"><span>▥</span><div><strong>Insights</strong><small>Yield, inventory, cost, and waste reporting.</small></div><b>›</b></a> }
        @if (isModuleEnabled('ADMINISTRATION')) { <a routerLink="/app/admin"><span>⚙</span><div><strong>Administration</strong><small>Tenant settings, users, roles, and operational profile.</small></div><b>›</b></a> }
      </nav>
    </section>
  `,
  styles: [`
    .more-page { display: grid; gap: 1rem; }
    header { padding: 1rem; border-radius: 12px; background: #714b67; color: #fff; }
    header span { font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .78; }
    h2 { margin: .25rem 0; font-size: 1.25rem; } p { margin: 0; font-size: .82rem; line-height: 1.45; opacity: .9; }
    nav { display: grid; gap: .65rem; }
    a { min-height: 72px; display: grid; grid-template-columns: 38px 1fr auto; align-items: center; gap: .65rem; padding: .8rem; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; color: #374151; text-decoration: none; }
    a > span { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 9px; background: #f2eaf0; color: #714b67; font-size: 1.25rem; }
    strong, small { display: block; } strong { font-size: .9rem; } small { margin-top: .12rem; color: #6b7280; font-size: .74rem; line-height: 1.35; } b { color: #714b67; font-size: 1.3rem; }
  `],
})
export class MobileMoreComponent {
  private readonly tenantService = inject(TenantService);
  private readonly tenant = computed(() => this.tenantService.tenant());

  protected isModuleEnabled(module: OperationalModule): boolean {
    const enabledModules = this.tenant()?.operationalModules;
    return !enabledModules?.length || enabledModules.includes(module);
  }
}
