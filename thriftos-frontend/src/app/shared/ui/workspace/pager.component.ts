import { Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChevronLeft, ChevronRight, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

/** "1–25 of 4,812" with previous/next and rows per page. */
@Component({
  selector: 'ws-pager',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, TPipe],
  template: `
    <nav class="pager" [attr.aria-label]="'ws.pager.label' | t">
      <span class="range ws-num" role="status">{{ 'ws.pager.range' | t: { from: from(), to: to(), total: i18n.num(total()) } }}</span>
      <label class="size">{{ 'ws.pager.perPage' | t }}
        <select [ngModel]="pageSize()" (ngModelChange)="pageSize.set(+$event); page.set(1)">
          @for (n of sizes; track n) { <option [value]="n">{{ n }}</option> }
        </select>
      </label>
      <button type="button" (click)="page.set(page() - 1)" [disabled]="page() <= 1" [attr.aria-label]="'ws.pager.previous' | t"><lucide-icon [img]="icons.ChevronLeft" [size]="16" class="flip" aria-hidden="true" /></button>
      <button type="button" (click)="page.set(page() + 1)" [disabled]="page() >= pages()" [attr.aria-label]="'ws.pager.next' | t"><lucide-icon [img]="icons.ChevronRight" [size]="16" class="flip" aria-hidden="true" /></button>
    </nav>
  `,
  styles: [`
    .pager { display:flex; align-items:center; justify-content:flex-end; gap:var(--ws-3); padding-block:var(--ws-2); color:var(--ws-ink-2); font-size:var(--ws-text-sm); }
    .range { margin-inline-end:auto; }
    .size { display:inline-flex; align-items:center; gap:var(--ws-2); }
    select { height:30px; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); font:inherit; }
    button { width:32px; height:32px; display:grid; place-items:center; border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); color:var(--ws-ink); cursor:pointer; }
    button:disabled { opacity:.45; cursor:default; }
    :host-context(html[dir='rtl']) .flip { transform:scaleX(-1); }
  `],
})
export class WsPagerComponent {
  protected readonly i18n = inject(I18nService);
  readonly page = model(1);
  readonly pageSize = model(25);
  readonly total = input(0);
  protected readonly sizes = [25, 50, 100, 200];
  protected readonly icons = { ChevronLeft, ChevronRight };
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly from = computed(() => (this.total() ? this.i18n.num((this.page() - 1) * this.pageSize() + 1) : '0'));
  protected readonly to = computed(() => this.i18n.num(Math.min(this.total(), this.page() * this.pageSize())));
}
