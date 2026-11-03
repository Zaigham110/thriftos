import { Component, ElementRef, HostListener, effect, input, output, viewChild } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { TPipe } from '../../../core/i18n/t.pipe';

/** A panel from the end edge for quick edits and previews without leaving the list. Esc or backdrop closes. */
@Component({
  selector: 'ws-side-sheet',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close.emit()"></div>
      <aside #panel class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="heading()" tabindex="-1">
        <header><h2>{{ heading() }}</h2><button type="button" (click)="close.emit()" [attr.aria-label]="'ws.sheet.close' | t"><lucide-icon [img]="icons.X" [size]="18" aria-hidden="true" /></button></header>
        <div class="body"><ng-content /></div>
        <footer><ng-content select="[footer]" /></footer>
      </aside>
    }
  `,
  styles: [`
    .backdrop { position:fixed; inset:0; z-index:40; background:var(--ws-overlay); }
    .sheet { position:fixed; inset-block:0; inset-inline-end:0; z-index:41; width:min(480px, 100vw); display:grid; grid-template-rows:auto 1fr auto; background:var(--ws-surface); color:var(--ws-ink); box-shadow:var(--ws-shadow-pop); outline:none; }
    header { display:flex; align-items:center; justify-content:space-between; gap:var(--ws-3); padding:var(--ws-4) var(--ws-5); border-block-end:1px solid var(--ws-line); }
    h2 { margin:0; font-size:var(--ws-text-xl); font-weight:600; }
    header button { width:32px; height:32px; display:grid; place-items:center; border:0; border-radius:var(--ws-r-md); background:transparent; color:var(--ws-ink-2); cursor:pointer; }
    header button:hover { background:var(--ws-surface-hover); }
    .body { overflow-y:auto; padding:var(--ws-5); }
    footer { display:flex; justify-content:flex-end; gap:var(--ws-2); padding:var(--ws-3) var(--ws-5); border-block-start:1px solid var(--ws-line); }
    footer:empty { display:none; }
  `],
})
export class WsSideSheetComponent {
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly close = output<void>();
  protected readonly icons = { X };
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    effect(() => this.panel()?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.close.emit();
  }
}
