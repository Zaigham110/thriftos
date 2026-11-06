import { HttpClient } from '@angular/common/http';
import { Component, HostListener, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { NavService } from '../../core/nav/nav.service';
import { HasUnsavedChanges, warnBeforeUnload } from '../../core/nav/unsaved-changes.guard';
import { ToastService } from '../../shared/floor/toast.service';
import { localPhone } from '../../shared/phone';
import { WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';

/** GET /api/customers/:id (the fields this form uses). */
interface CustomerRow {
  id: string; name: string; phone: string | null; city: string | null; companyName: string | null; billingAddress: string | null;
  notes: string | null; isActive: boolean; openingBalance: string;
}

/**
 * Add or change a customer on the laptop (v2 review): name, WhatsApp number, city, shop name, address and a note.
 * A new customer can start with what they already owed before ThriftOS (opening balance). Saving opens the customer.
 */
@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [FormsModule, TPipe, WsPageHeaderComponent, WsStateComponent],
  template: `
    @if (loadFailed()) {
      <ws-state kind="error" [heading]="'ws.customer.notFound' | t" (retry)="load()" />
    } @else if (loading()) {
      <ws-state kind="loading" />
    } @else {
      <form class="page" (ngSubmit)="save()" (input)="touched = true" (change)="touched = true">
        <ws-page-header [heading]="id() ? ('ws.lf.editTitle' | t: { code: original }) : ('sell.newCustomer' | t)" [subtitle]="'ws.rc.formHint' | t" />
        <section class="card">
          <div class="grid">
            <label class="span2">{{ 'common.name' | t }}<input name="name" required maxlength="200" [(ngModel)]="name" autocomplete="off" /></label>
            <label>{{ 'common.phone' | t }}<input name="phone" type="tel" required maxlength="30" [(ngModel)]="phone" class="ltr" [placeholder]="'common.phonePlaceholder' | t" /></label>
            <label>{{ 'common.city' | t }} · {{ 'common.optional' | t }}<input name="city" maxlength="100" [(ngModel)]="city" autocomplete="off" /></label>
            <label>{{ 'ws.rc.shop' | t }} · {{ 'common.optional' | t }}<input name="company" maxlength="200" [(ngModel)]="company" autocomplete="off" /></label>
            <label>{{ 'ws.rc.address' | t }} · {{ 'common.optional' | t }}<input name="address" maxlength="500" [(ngModel)]="address" autocomplete="off" /></label>
            @if (!id()) {
              <label class="span2">{{ 'ws.rc.opening' | t }} · {{ 'common.optional' | t }}<input name="opening" type="number" min="0" step="1" [(ngModel)]="opening" /><small>{{ 'ws.rc.openingHint' | t }}</small></label>
            }
            <label class="span2">{{ 'ws.customer.note' | t }} · {{ 'common.optional' | t }}<textarea name="notes" rows="2" maxlength="1000" [(ngModel)]="notes"></textarea></label>
            @if (id()) {
              <label class="check span2"><input type="checkbox" name="active" [(ngModel)]="active" />{{ 'ws.rc.active' | t }}</label>
            }
          </div>
          <div class="actions">
            <button type="button" class="ws-btn" (click)="cancel()">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="ws-btn primary" [disabled]="!name.trim() || !phone.trim() || busy()">{{ (busy() ? 'common.saving' : 'common.save') | t }}</button>
          </div>
        </section>
      </form>
    }
  `,
  styles: [`
    :host { display:block; font-family:var(--ws-font); color:var(--ws-ink); }
    .page { max-width:720px; margin-inline:auto; }
    .card { display:grid; gap:var(--ws-4); padding:var(--ws-4); border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:var(--ws-3); }
    .span2 { grid-column:1 / -1; }
    label { display:grid; gap:4px; color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    label small { color:var(--ws-ink-3); }
    input:not([type=checkbox]), textarea { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-size:var(--ws-text-md); }
    .check { display:flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink); font-size:var(--ws-text-md); }
    .actions { display:flex; justify-content:flex-end; gap:var(--ws-2); }
    .ltr { direction:ltr; }
    @media (max-width: 640px) { .grid { grid-template-columns:minmax(0, 1fr); } }
  `],
})
export class CustomerFormComponent implements OnInit, HasUnsavedChanges {
  private readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly nav = inject(NavService);
  /** Absent on "New customer"; the customer's id on its edit page. */
  readonly id = input<string | undefined>();

  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected touched = false;
  protected original = '';
  protected name = '';
  protected phone = '';
  protected city = '';
  protected company = '';
  protected address = '';
  protected notes = '';
  protected opening: number | null = null;
  protected active = true;

  ngOnInit(): void {
    if (this.id()) this.load();
  }

  hasUnsavedChanges(): boolean {
    return this.touched;
  }
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(e: BeforeUnloadEvent): void {
    warnBeforeUnload(e, this.touched);
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.http.get<CustomerRow>(`/api/customers/${this.id()}`).subscribe({
      next: (c) => {
        this.original = c.name;
        this.nav.setName(c.id, c.name);
        this.name = c.name;
        this.phone = localPhone(c.phone);
        this.city = c.city ?? '';
        this.company = c.companyName ?? '';
        this.address = c.billingAddress ?? '';
        this.notes = c.notes ?? '';
        this.active = c.isActive;
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.loadFailed.set(true); },
    });
  }

  protected cancel(): void {
    this.touched = false;
    this.nav.back(this.id() ? ['/khata/records', this.id()] : ['/khata/records']);
  }

  protected async save(): Promise<void> {
    if (!this.name.trim() || !this.phone.trim() || this.busy()) return;
    const body = {
      name: this.name.trim(),
      phone: this.phone.trim(),
      city: this.city.trim(),
      companyName: this.company.trim(),
      billingAddress: this.address.trim(),
      notes: this.notes.trim(),
      ...(this.id() ? { isActive: this.active } : this.opening ? { openingBalance: Number(this.opening) } : {}),
    };
    this.busy.set(true);
    try {
      if (this.id()) {
        await firstValueFrom(this.http.patch(`/api/customers/${this.id()}`, body));
        this.touched = false;
        this.toast.show(this.i18n.t('ws.rc.saved'));
        this.nav.back(['/khata/records', this.id()]);
      } else {
        const c = await firstValueFrom(this.http.post<{ id: string }>('/api/customers', body));
        this.touched = false;
        this.toast.show(this.i18n.t('ws.rc.saved'));
        void this.nav.replace(['/khata/records', c.id]);
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
