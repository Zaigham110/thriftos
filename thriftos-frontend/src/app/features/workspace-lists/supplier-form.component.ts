import { HttpClient } from '@angular/common/http';
import { Component, HostListener, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { NavService } from '../../core/nav/nav.service';
import { HasUnsavedChanges, warnBeforeUnload } from '../../core/nav/unsaved-changes.guard';
import { COUNTRIES } from '../../shared/countries';
import { ToastService } from '../../shared/floor/toast.service';
import { WsPageHeaderComponent, WsStateComponent } from '../../shared/ui/workspace';

/** GET /api/admin/vendors/:id (the fields this form uses). */
interface SupplierRow {
  id: string; name: string; originCountry: string | null; country: string | null; physicalAddress: string | null;
  contactPhone: string | null; contactPerson: string | null; notes: string | null; isActive: boolean;
}

/**
 * Add or change a supplier (v2 review): name, country, city, WhatsApp number, contact person and a note — what
 * a trader keeps about the people they buy from. No payment terms or partner classes. Saving opens the supplier.
 */
@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [FormsModule, TPipe, WsPageHeaderComponent, WsStateComponent],
  template: `
    @if (loadFailed()) {
      <ws-state kind="error" [heading]="'ws.supplier.notFound' | t" (retry)="load()" />
    } @else if (loading()) {
      <ws-state kind="loading" />
    } @else {
      <form class="page" (ngSubmit)="save()" (input)="touched = true" (change)="touched = true">
        <ws-page-header [heading]="id() ? ('ws.lf.editTitle' | t: { code: original }) : ('common.newSupplier' | t)" [subtitle]="'ws.sp.formHint' | t" />
        <section class="card">
          <div class="grid">
            <label class="span2">{{ 'receive.newSupplierName' | t }}<input name="name" required maxlength="100" [(ngModel)]="name" autocomplete="off" /></label>
            <label>{{ 'receive.origin' | t }}<input name="country" list="ws-sf-countries" maxlength="60" [(ngModel)]="country" autocomplete="off" [placeholder]="'ws.cf.countryHint' | t" /></label>
            <label>{{ 'common.city' | t }} · {{ 'common.optional' | t }}<input name="city" maxlength="200" [(ngModel)]="city" autocomplete="off" /></label>
            <label>{{ 'common.phone' | t }} · {{ 'common.optional' | t }}<input name="phone" type="tel" maxlength="30" [(ngModel)]="phone" class="ltr" [placeholder]="'common.phonePlaceholder' | t" /></label>
            <label>{{ 'import.field.contactPerson' | t }} · {{ 'common.optional' | t }}<input name="person" maxlength="100" [(ngModel)]="person" autocomplete="off" /></label>
            <label class="span2">{{ 'ws.customer.note' | t }} · {{ 'common.optional' | t }}<textarea name="notes" rows="2" maxlength="1000" [(ngModel)]="notes"></textarea></label>
            @if (id()) {
              <label class="check span2"><input type="checkbox" name="active" [(ngModel)]="active" />{{ 'ws.sp.active' | t }}</label>
            }
          </div>
          <div class="actions">
            <button type="button" class="ws-btn" (click)="cancel()">{{ 'common.cancel' | t }}</button>
            <button type="submit" class="ws-btn primary" [disabled]="!name.trim() || busy()">{{ (busy() ? 'common.saving' : 'common.save') | t }}</button>
          </div>
        </section>
        <datalist id="ws-sf-countries">@for (c of countries; track c) { <option [value]="c"></option> }</datalist>
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
    input:not([type=checkbox]), textarea { box-sizing:border-box; width:100%; min-height:var(--ws-control-h); padding:var(--ws-2); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-size:var(--ws-text-md); }
    .check { display:flex; align-items:center; gap:var(--ws-2); color:var(--ws-ink); font-size:var(--ws-text-md); }
    .actions { display:flex; justify-content:flex-end; gap:var(--ws-2); }
    .ltr { direction:ltr; }
    @media (max-width: 640px) { .grid { grid-template-columns:minmax(0, 1fr); } }
  `],
})
export class SupplierFormComponent implements OnInit, HasUnsavedChanges {
  private readonly i18n = inject(I18nService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly nav = inject(NavService);
  /** Absent on "New supplier"; the supplier's id on its edit page. */
  readonly id = input<string | undefined>();

  protected readonly countries = COUNTRIES;
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected touched = false;
  protected original = '';
  protected name = '';
  protected country = '';
  protected city = '';
  protected phone = '';
  protected person = '';
  protected notes = '';
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
    this.http.get<SupplierRow>(`/api/admin/vendors/${this.id()}`).subscribe({
      next: (s) => {
        this.original = s.name;
        this.nav.setName(s.id, s.name);
        this.name = s.name;
        this.country = s.originCountry ?? s.country ?? '';
        this.city = s.physicalAddress ?? '';
        this.phone = s.contactPhone ?? '';
        this.person = s.contactPerson ?? '';
        this.notes = s.notes ?? '';
        this.active = s.isActive;
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.loadFailed.set(true); },
    });
  }

  protected cancel(): void {
    this.touched = false;
    this.nav.back(this.id() ? ['/receive/records/suppliers', this.id()] : ['/receive/records/suppliers']);
  }

  protected async save(): Promise<void> {
    if (!this.name.trim() || this.busy()) return;
    const country = this.country.trim();
    const body = {
      name: this.name.trim(),
      originCountry: country || undefined,
      country: country || undefined,
      physicalAddress: this.city.trim(),
      contactPhone: this.phone.trim(),
      contactPerson: this.person.trim(),
      notes: this.notes.trim(),
      ...(this.id() ? { isActive: this.active } : {}),
    };
    this.busy.set(true);
    try {
      if (this.id()) {
        await firstValueFrom(this.http.patch(`/api/admin/vendors/${this.id()}`, body));
        this.touched = false;
        this.toast.show(this.i18n.t('ws.sp.saved'));
        this.nav.back(['/receive/records/suppliers', this.id()]);
      } else {
        const s = await firstValueFrom(this.http.post<{ id: string }>('/api/admin/vendors', body));
        this.touched = false;
        this.toast.show(this.i18n.t('ws.sp.saved'));
        void this.nav.replace(['/receive/records/suppliers', s.id]);
      }
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.busy.set(false);
    }
  }
}
