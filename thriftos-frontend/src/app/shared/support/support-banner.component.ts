import { Component, computed, inject, signal } from '@angular/core';
import { Eye, LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth';
import { SUPPORT_NAME_KEY } from '../../core/auth/auth';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * v2 6.5: while a super admin has a business open for support, a bar at the top says so: read-only, which business,
 * and Leave. Nothing can be changed from here; the server refuses every change and logs the attempt.
 */
@Component({
  selector: 'app-support-banner',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    @if (show()) {
      <div class="tos-support" role="status">
        <lucide-icon [img]="icons.Eye" [size]="16" aria-hidden="true" />
        <span>{{ 'support.banner' | t: { name: name() || ('support.thisBusiness' | t) } }}</span>
        <button type="button" (click)="leave()" [disabled]="leaving()">{{ 'support.leave' | t }}</button>
      </div>
    }
  `,
  styles: [`
    .tos-support { position:fixed; z-index:1000; inset-block-start:6px; inset-inline-start:50%; transform:translateX(-50%); display:flex; align-items:center; gap:8px; max-width:calc(100vw - 24px); padding:4px 4px 4px 12px; border-radius:999px; background:#8a4b00; color:#fff; font-size:13px; font-weight:600; box-shadow:0 4px 14px rgb(0 0 0 / .25); }
    html[dir='rtl'] .tos-support { transform:translateX(50%); padding:4px 12px 4px 4px; }
    .tos-support span { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .tos-support button { flex:none; min-height:28px; padding:0 12px; border:0; border-radius:999px; background:#fff; color:#8a4b00; font:inherit; font-weight:700; cursor:pointer; }
    /* Laptop: at the bottom, clear of the toolbar. */
    @media (min-width: 1024px) { .tos-support { inset-block-start:auto; inset-block-end:16px; } }
    @media print { .tos-support { display:none; } }
  `],
})
export class SupportBannerComponent {
  private readonly auth = inject(AuthService);
  protected readonly icons = { Eye };
  protected readonly leaving = signal(false);
  protected readonly show = computed(() => this.auth.isImpersonating() || !!this.auth.impersonatedTenantId());
  protected readonly name = computed(() => {
    this.show();
    try {
      return sessionStorage.getItem(SUPPORT_NAME_KEY) ?? '';
    } catch {
      return '';
    }
  });

  protected leave(): void {
    this.leaving.set(true);
    this.auth.exitImpersonation().subscribe({ complete: () => this.leaving.set(false), error: () => this.leaving.set(false) });
  }
}
