import { CommonModule, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertTriangle, ArrowRight, BarChart3, Boxes, RefreshCw, Scale, Trash2, LucideAngularModule } from 'lucide-angular';
import { ReportsService } from '../../../modules/reports/reports.service';
import { InventorySnapshotResponse, WasteReportRow, YieldReportRow } from '../../../modules/reports/reports.models';

/** A task-oriented operational summary that stays inside the Flow shell. */
@Component({
  selector: 'app-flow-insights', standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink, LucideAngularModule],
  template: `
    <section class="insights">
      <header class="intro"><div><span>Operational evidence</span><h1>Insights</h1><p>See material yield, stage waste, and sellable inventory without leaving the operating workspace.</p></div><button type="button" (click)="load()" [disabled]="loading()"><lucide-icon [img]="icons.RefreshCw" [size]="16"/>{{loading()?'Refreshing…':'Refresh'}}</button></header>
      @if(error();as message){<div class="error"><lucide-icon [img]="icons.AlertTriangle" [size]="17"/>{{message}}</div>}
      <section class="metrics"><article><lucide-icon [img]="icons.Scale" [size]="19"/><span>Category yield</span><b>{{yieldPercent()|number:'1.0-1'}}%</b><small>{{outputKg()|number:'1.0-1'}} kg output from {{inputKg()|number:'1.0-1'}} kg</small></article><article><lucide-icon [img]="icons.Trash2" [size]="19"/><span>Recorded waste</span><b>{{wasteKg()|number:'1.0-1'}} kg</b><small>Across procurement and sorting stages</small></article><article><lucide-icon [img]="icons.Boxes" [size]="19"/><span>Sellable stock</span><b>{{inventory()?.summary?.totalUnits||0}} units</b><small>{{inventory()?.summary?.totalWeightKg||0|number:'1.0-1'}} kg · current snapshot</small></article></section>
      <section class="panels"><article class="panel"><header><div><span>Yield by category</span><h2>Material conversion</h2></div><a routerLink="/app/reports">Full report <lucide-icon [img]="icons.ArrowRight" [size]="14"/></a></header>@for(row of yield();track row.categoryId){<div class="yield-row"><div><b>{{row.categoryName||'Unclassified'}}</b><small>{{row.outputWeightKg|number:'1.0-1'}} kg from {{row.inputWeightKg|number:'1.0-1'}} kg</small></div><strong>{{row.yieldPct|number:'1.0-1'}}%</strong><i><span [style.width.%]="row.yieldPct"></span></i></div>}@empty{<p class="empty">No yield data is available for the selected tenant.</p>}</article><article class="panel"><header><div><span>Waste by stage</span><h2>Attention points</h2></div></header>@for(row of waste();track row.stage){<div class="waste-row"><span>{{row.stage}}</span><b>{{row.wasteKg||0|number:'1.0-1'}} kg</b></div>}@empty{<p class="empty">No recorded stage waste.</p>}<a class="stock-link" routerLink="/app/flow/stock">Inspect inventory traceability <lucide-icon [img]="icons.ArrowRight" [size]="14"/></a></article></section>
    </section>`,
  styles: [`.insights{display:grid;gap:20px;max-width:1180px;margin:0 auto}.intro{display:flex;align-items:end;justify-content:space-between;gap:16px}.intro span,.panel header span{color:var(--flow-teal);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.intro h1{margin:4px 0;font-size:30px;letter-spacing:-.04em}.intro p,.empty{margin:0;color:var(--flow-ink-soft);font-size:13px}.intro button{min-height:40px;display:flex;align-items:center;gap:7px;border:1px solid var(--flow-line);border-radius:9px;background:#fff;color:var(--flow-ink);font:inherit;font-size:12px;font-weight:800}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metrics article{display:grid;gap:5px;padding:17px;border:1px solid var(--flow-line);border-radius:12px;background:#fff}.metrics lucide-icon{color:var(--flow-teal)}.metrics span{color:var(--flow-ink-soft);font-size:11px;font-weight:750}.metrics b{font-size:24px;letter-spacing:-.04em}.metrics small{color:var(--flow-ink-soft);font-size:11px}.panels{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}.panel{overflow:hidden;border:1px solid var(--flow-line);border-radius:12px;background:#fff}.panel header{display:flex;align-items:center;justify-content:space-between;padding:17px;border-bottom:1px solid var(--flow-line)}.panel h2{margin:4px 0 0;font-size:17px}.panel header a,.stock-link{display:flex;align-items:center;gap:4px;color:var(--flow-teal);font-size:12px;font-weight:800;text-decoration:none}.yield-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;padding:13px 17px;border-bottom:1px solid var(--flow-line)}.yield-row b,.yield-row small{display:block}.yield-row b{font-size:13px}.yield-row small{margin-top:3px;color:var(--flow-ink-soft);font-size:11px}.yield-row strong{font-size:13px}.yield-row i{grid-column:1/-1;height:5px;overflow:hidden;border-radius:999px;background:#edf0ee}.yield-row i span{display:block;height:100%;border-radius:999px;background:var(--flow-teal)}.waste-row{display:flex;justify-content:space-between;padding:14px 17px;border-bottom:1px solid var(--flow-line);font-size:13px}.waste-row b{color:var(--flow-clay)}.stock-link{padding:15px 17px}.empty{padding:28px 17px;text-align:center}.error{display:flex;align-items:center;gap:8px;padding:11px 13px;border:1px solid #e9beb6;border-radius:9px;background:var(--flow-clay-soft);color:var(--flow-clay);font-size:13px}@media(max-width:780px){.metrics,.panels{grid-template-columns:1fr}}@media(max-width:599px){.intro{align-items:flex-start;flex-direction:column}.intro h1{font-size:26px}.intro button{width:100%;justify-content:center}}`],
})
export class FlowInsightsComponent implements OnInit {
  private readonly reports = inject(ReportsService);
  readonly yield = signal<YieldReportRow[]>([]);
  readonly waste = signal<WasteReportRow[]>([]);
  readonly inventory = signal<InventorySnapshotResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly icons = { AlertTriangle, ArrowRight, BarChart3, Boxes, RefreshCw, Scale, Trash2 };
  readonly inputKg = computed(() => this.yield().reduce((total, row) => total + Number(row.inputWeightKg || 0), 0));
  readonly outputKg = computed(() => this.yield().reduce((total, row) => total + Number(row.outputWeightKg || 0), 0));
  readonly wasteKg = computed(() => this.waste().reduce((total, row) => total + Number(row.wasteKg || 0), 0));
  readonly yieldPercent = computed(() => this.inputKg() ? this.outputKg() / this.inputKg() * 100 : 0);
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(''); let remaining = 3;
    const done = () => { remaining -= 1; if (!remaining) this.loading.set(false); };
    this.reports.loadYieldReport().subscribe({ next: rows => { this.yield.set(rows); done(); }, error: error => this.fail(error, done) });
    this.reports.loadWasteByStage().subscribe({ next: rows => { this.waste.set(rows); done(); }, error: error => this.fail(error, done) });
    this.reports.loadInventorySnapshot().subscribe({ next: snapshot => { this.inventory.set(snapshot); done(); }, error: error => this.fail(error, done) });
  }
  private fail(error: any, done: () => void): void { this.error.set(error?.error?.message || error?.message || 'Some insight data could not be loaded.'); done(); }
}
