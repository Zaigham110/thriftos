import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { I18N } from '../../core/i18n/t.pipe';
import { TenantService } from '../../core/tenant/tenant.service';

/**
 * Phase 7: one line at the top of every screen when the plan needs attention: the trial's last days, the trial
 * over (Free plan now), the grace period after the paid period, or read-only. The owner gets a link to pay; staff
 * see the line only. Nothing shows for a paid business or one set up by hand.
 */
@Component({
  selector: 'app-plan-banner',
  standalone: true,
  imports: [RouterLink, I18N],
  template: `
    @if (shown(); as b) {
      <div class="plan-banner" [class.bad]="b.state === 'READ_ONLY'" [class.warn]="b.state === 'GRACE' || b.state === 'TRIAL_OVER'" role="status">
        <span>{{ ('banner.' + b.state + (b.daysLeft === 1 && (b.state === 'TRIAL' || b.state === 'GRACE') ? 'One' : '')) | t: { n: b.daysLeft ?? 0, plan: b.plan ?? '' } }}</span>
        @if (owner()) { <a routerLink="/settings/billing">{{ (b.state === 'TRIAL' ? 'banner.choose' : 'banner.pay') | t }}</a> }
      </div>
    }
  `,
  styles: [`
    .plan-banner { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px 12px; padding:8px 16px; background:#eef4ff; color:#1d3a6e; font-size:14px; font-weight:600; border-block-end:1px solid #cbdaf5; }
    .plan-banner.warn { background:#fff8e1; color:#6b4a00; border-color:#f0d27a; }
    .plan-banner.bad { background:#fdecea; color:#8a1c12; border-color:#f3b8b0; }
    .plan-banner a { color:inherit; font-weight:800; text-decoration:underline; white-space:nowrap; }
  `],
})
export class PlanBannerComponent {
  private readonly tenants = inject(TenantService);
  private readonly auth = inject(AuthService);
  protected readonly owner = computed(() => {
    this.auth.permissions();
    return this.auth.hasPermission('tenant.update');
  });
  /** The trial shows in its last 5 days only; grace, trial over and read-only always. */
  protected readonly shown = computed(() => {
    const b = this.tenants.tenant()?.billing;
    if (!b) return null;
    if (b.state === 'TRIAL') return (b.daysLeft ?? 99) <= 5 ? b : null;
    return b.state === 'GRACE' || b.state === 'TRIAL_OVER' || b.state === 'READ_ONLY' ? b : null;
  });
}
