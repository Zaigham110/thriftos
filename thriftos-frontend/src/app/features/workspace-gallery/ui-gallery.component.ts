import { Component, computed, inject, signal } from '@angular/core';
import { Boxes, Coins, LucideAngularModule, ShoppingCart } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/theme/theme.service';
import {
  WsActivity,
  WsActivityPanelComponent,
  WsBarChartComponent,
  WsColumn,
  WsCommandBarComponent,
  WsDataGridComponent,
  WsDateRange,
  WsDateRangeComponent,
  WsFilterBarComponent,
  WsFilterChip,
  WsKpiCardComponent,
  WsNote,
  WsPageHeaderComponent,
  WsRow,
  WsSideSheetComponent,
  WsSmartButtonComponent,
  WsSort,
  WsStateComponent,
  WsStatusPipelineComponent,
  WsTab,
  WsTabsComponent,
  rangeFor,
} from '../../shared/ui/workspace';

/**
 * Interface gallery (enterprise plan E1.3): every workspace component with sample data, for reviewing the
 * design in light/dark, comfortable/compact and English/Urdu. Not in the menu; open /settings/ui-gallery.
 * Sample text is English on purpose (it is not a working screen).
 */
@Component({
  selector: 'app-ui-gallery',
  standalone: true,
  imports: [
    LucideAngularModule,
    WsActivityPanelComponent,
    WsBarChartComponent,
    WsCommandBarComponent,
    WsDataGridComponent,
    WsDateRangeComponent,
    WsFilterBarComponent,
    WsKpiCardComponent,
    WsPageHeaderComponent,
    WsSideSheetComponent,
    WsSmartButtonComponent,
    WsStateComponent,
    WsStatusPipelineComponent,
    WsTabsComponent,
  ],
  template: `
    <div class="gallery">
      <ws-page-header heading="Container C-0012 · Global Textile Recyclers, USA" subtitle="Interface gallery: sample data, not a working screen">
        <button actions type="button" class="ws-btn" (click)="theme.toggleTheme()">Theme: {{ theme.theme() }}</button>
        <button actions type="button" class="ws-btn" (click)="theme.setDensity(theme.density() === 'compact' ? 'comfortable' : 'compact')">Rows: {{ theme.density() }}</button>
        <button actions type="button" class="ws-btn primary" (click)="sheetOpen.set(true)">Open side sheet</button>
      </ws-page-header>

      <ws-status-pipeline [steps]="['Received', 'Sorting', 'Baling', 'Selling', 'Closed']" [current]="2" label="Container status" />

      <section class="smart">
        <ws-smart-button label="Lots" value="3" [icon]="icons.Boxes" />
        <ws-smart-button label="Bales" value="22" [icon]="icons.Boxes" />
        <ws-smart-button label="Sales" value="14" [icon]="icons.ShoppingCart" />
        <ws-smart-button label="Profit" [value]="i18n.money(312400)" [icon]="icons.Coins" tone="good" />
      </section>

      <section class="kpis">
        <ws-kpi-card label="Revenue" [value]="i18n.money(2984200)" [delta]="12.4" [trend]="[220, 260, 240, 310, 290, 350, 380]" />
        <ws-kpi-card label="Gross margin" value="31%" [delta]="-2.1" [trend]="[34, 33, 35, 32, 31, 32, 31]" />
        <ws-kpi-card label="Udhaar owed" [value]="i18n.money(811500)" [delta]="5.0" [higherIsBetter]="false" [trend]="[700, 720, 760, 740, 790, 800, 811]" />
        <ws-kpi-card label="Stock ready" [value]="i18n.kg(1040)" hint="18 bales" [trend]="[900, 1100, 980, 1020, 1040]" />
      </section>

      <ws-command-bar>
        <div start class="row">
          <button type="button" class="ws-btn primary">New sale</button>
          <button type="button" class="ws-btn">Export</button>
          <button type="button" class="ws-btn">Print</button>
        </div>
        <ws-date-range end [(value)]="range" />
      </ws-command-bar>

      <ws-filter-bar [(query)]="query" placeholder="Search customers, bales, invoices" [chips]="chips()" (remove)="removeChip($event)" (clearAll)="chips.set([])" />

      <ws-data-grid caption="Sales" [columns]="columns" [rows]="filteredRows()" [(sort)]="sort" [(selected)]="selected" [selectable]="true" [clickable]="true" emptyHeading="No sales match" emptyMessage="Try other words or clear the filters.">
        <button bulk type="button" class="ws-btn small">Send reminders</button>
      </ws-data-grid>

      <div class="two">
        <ws-bar-chart heading="Profit per kg by origin (Rs)" [categories]="['USA', 'UK', 'Korea', 'Canada']" [series]="[{ label: 'Last quarter', values: [27.1, 21.4, 13.2, 19.8] }, { label: 'This quarter', values: [29.7, 22.9, 14.1, 21.0] }]" />
        <ws-activity-panel [items]="activity()" [people]="[{ id: 'u1', name: 'Munshi Aslam' }, { id: 'u2', name: 'Owner' }]" (note)="addNote($event)" />
      </div>

      <section>
        <ws-tabs [tabs]="tabs" [(active)]="tab" label="Record tabs" />
        <div class="panel" role="tabpanel" [id]="'ws-panel-' + tab()" [attr.aria-labelledby]="'ws-tab-' + tab()">Tab: {{ tab() }}</div>
      </section>

      <div class="states">
        <ws-state kind="empty" heading="No bales yet" message="Make a bale from sorted stock, or receive ready stock." />
        <ws-state kind="loading" />
        <ws-state kind="error" message="Check the internet connection." />
      </div>
    </div>

    <ws-side-sheet [open]="sheetOpen()" heading="Quick edit" (close)="sheetOpen.set(false)">
      <p>Side sheets hold quick edits and previews without leaving the list.</p>
      <button footer type="button" class="ws-btn" (click)="sheetOpen.set(false)">Cancel</button>
      <button footer type="button" class="ws-btn primary" (click)="sheetOpen.set(false)">Save</button>
    </ws-side-sheet>
  `,
  styles: [`
    .gallery { display:grid; grid-template-columns:minmax(0, 1fr); gap:var(--ws-5); max-width:var(--ws-content-max); margin-inline:auto; font-family:var(--ws-font); color:var(--ws-ink); }
    .smart, .kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:var(--ws-3); }
    .two { display:grid; grid-template-columns:minmax(0, 2fr) minmax(280px, 1fr); gap:var(--ws-4); align-items:start; }
    .states { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:var(--ws-3); }
    .states > * { border:1px solid var(--ws-line); border-radius:var(--ws-r-lg); background:var(--ws-surface); }
    .row { display:flex; gap:var(--ws-2); }
    .panel { padding:var(--ws-4); color:var(--ws-ink-2); }
    .ws-btn { height:var(--ws-control-h); padding-inline:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; font-weight:500; cursor:pointer; }
    .ws-btn:hover { background:var(--ws-surface-hover); }
    .ws-btn.primary { border-color:var(--ws-brand); background:var(--ws-brand); color:var(--ws-brand-ink); }
    .ws-btn.small { height:28px; }
    @media (max-width: 1200px) { .smart, .kpis { grid-template-columns:repeat(2, minmax(0, 1fr)); } .two { grid-template-columns:1fr; } }
  `],
})
export class UiGalleryComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly icons = { Boxes, Coins, ShoppingCart };
  protected readonly sheetOpen = signal(false);
  protected readonly range = signal<WsDateRange>(rangeFor('30d'));
  protected readonly query = signal('');
  protected readonly chips = signal<WsFilterChip[]>([{ id: 'city', label: 'City', value: 'Karachi' }, { id: 'status', label: 'Status', value: 'Udhaar' }]);
  protected readonly sort = signal<WsSort | null>({ key: 'date', dir: 'desc' });
  protected readonly selected = signal<string[]>([]);
  protected readonly tab = signal('lots');
  protected readonly tabs: WsTab[] = [
    { id: 'cost', label: 'Landed cost' },
    { id: 'lots', label: 'Lots and yield', count: 3 },
    { id: 'bales', label: 'Bales', count: 22 },
    { id: 'sales', label: 'Sales', count: 14 },
  ];
  protected readonly columns: WsColumn[] = [
    { key: 'code', label: 'Sale', sortable: true, width: '120px' },
    { key: 'date', label: 'Date', format: 'date', sortable: true },
    { key: 'customer', label: 'Customer', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'kg', label: 'Weight', format: 'kg', sortable: true, total: true },
    { key: 'total', label: 'Total', format: 'money', sortable: true, total: true },
    { key: 'due', label: 'Due', format: 'money', sortable: true, total: true },
  ];
  private readonly rows: WsRow[] = [
    { id: '1', code: 'SAL-0063', date: '2026-11-03', customer: 'Imran Landa Centre', city: 'Karachi', kg: 450, total: 45000, due: 25000 },
    { id: '2', code: 'SAL-0062', date: '2026-11-03', customer: 'Haji Rafiq & Sons', city: 'Karachi', kg: 410, total: 41500, due: 41500 },
    { id: '3', code: 'SAL-0061', date: '2026-11-02', customer: 'Ali Traders', city: 'Lahore', kg: 615, total: 61600, due: 0 },
    { id: '4', code: 'SAL-0060', date: '2026-11-01', customer: 'Wazir Landa House', city: 'Peshawar', kg: 280, total: 28000, due: 28000 },
    { id: '5', code: 'SAL-0059', date: '2026-10-30', customer: 'Bilal Garments', city: 'Karachi', kg: 349, total: 34900, due: 12000 },
  ];
  protected readonly filteredRows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : this.rows;
  });
  protected readonly activity = signal<WsActivity[]>([
    { id: 'a1', at: '2026-11-03T10:42:00', who: 'Owner', text: 'sold bale B-0347 to Imran Landa Centre', kind: 'change' },
    { id: 'a2', at: '2026-11-02T16:05:00', who: 'Munshi Aslam', text: 'closed lot L-0031 with 150 kg waste', kind: 'change' },
    { id: 'a3', at: '2026-10-28T12:30:00', who: 'Owner', text: 'Transport bill from Qasim came in higher; costs recalculated.', kind: 'note' },
  ]);

  protected removeChip(id: string): void {
    this.chips.set(this.chips().filter((c) => c.id !== id));
  }

  protected addNote(note: WsNote): void {
    this.activity.set([{ id: crypto.randomUUID(), at: new Date().toISOString(), who: 'You', text: note.text, kind: 'note' }, ...this.activity()]);
  }
}
