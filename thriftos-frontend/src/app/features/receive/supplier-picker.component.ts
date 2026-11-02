import { Component, OnInit, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { OfflineQueueService } from '../../core/offline/offline-queue.service';
import { FloorDataService, Supplier, countUse, usageOrder } from '../../shared/floor/floor-data.service';
import { Tile, TilesComponent } from '../../shared/floor/tiles.component';
import { ToastService } from '../../shared/floor/toast.service';

export const COUNTRIES = ['USA', 'UK', 'Korea', 'Canada', 'Germany', 'Japan', 'Australia', 'Pakistan'];

/** Supplier tiles (most used first) and "+ new" with name and country only. A new supplier made offline gets a `local:` id. */
@Component({
  selector: 'app-supplier-picker',
  standalone: true,
  imports: [FormsModule, TPipe, TilesComponent],
  template: `
    @if (adding()) {
      <label class="field">{{ 'receive.newSupplierName' | t }}<input [(ngModel)]="name" name="supplierName" maxlength="120" autocomplete="off" /></label>
      <div class="chips" role="group" [attr.aria-label]="'common.country' | t">
        @for (c of countries; track c) { <button type="button" class="chip" [class.on]="country === c" (click)="country = c">{{ c }}</button> }
      </div>
      <div class="row2">
        <button type="button" class="btn" (click)="adding.set(false)">{{ 'common.cancel' | t }}</button>
        <button type="button" class="btn primary" [disabled]="!name.trim() || saving()" (click)="add()">{{ 'common.save' | t }}</button>
      </div>
    } @else {
      <tos-tiles [items]="tiles()" [selected]="selectedId()" newLabel="common.newSupplier" (pick)="choose($event)" (addNew)="startAdd($event)" />
    }
  `,
})
export class SupplierPickerComponent implements OnInit {
  private readonly data = inject(FloorDataService);
  private readonly queue = inject(OfflineQueueService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  readonly picked = output<Supplier>();
  protected readonly countries = COUNTRIES;
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly tiles = signal<Tile[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected name = '';
  protected country = 'USA';

  ngOnInit(): void {
    this.data.suppliers().subscribe((list) => this.setList(usageOrder(list, 'supplier')));
  }

  protected choose(tile: Tile): void {
    const s = this.suppliers().find((x) => x.id === tile.id);
    if (!s) return;
    this.selectedId.set(s.id);
    if (!s.id.startsWith('local:')) countUse('supplier', s.id);
    this.picked.emit(s);
  }

  protected startAdd(query: string): void {
    this.name = query;
    this.adding.set(true);
  }

  protected async add(): Promise<void> {
    this.saving.set(true);
    const body = { name: this.name.trim(), originCountry: this.country, country: this.country };
    try {
      const r = await this.queue.send<Supplier>({ kind: 'receive', label: body.name, url: '/api/procurement/vendors', body });
      const s: Supplier = r.saved ? r.response : { id: `local:${r.id}`, name: body.name, originCountry: body.originCountry };
      this.setList([s, ...this.suppliers()]);
      this.adding.set(false);
      this.choose({ id: s.id, label: s.name });
    } catch (e: any) {
      this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
    } finally {
      this.saving.set(false);
    }
  }

  private setList(list: Supplier[]): void {
    this.suppliers.set(list);
    this.tiles.set(list.map((s) => ({ id: s.id, label: s.name, sub: s.originCountry || s.country || '' })));
  }
}

/** A supplier id for a request body: a real id, or a reference to the supplier queued offline. */
export function supplierRef(queue: OfflineQueueService, id: string): unknown {
  return id.startsWith('local:') ? queue.ref(id.slice(6)) : id;
}
