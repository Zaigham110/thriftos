import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { Info, LucideAngularModule } from 'lucide-angular';
import { TPipe } from '../../../core/i18n/t.pipe';

let uid = 0;

/**
 * The small "i" in a card's top-right corner: tap or click opens a short note on what the card shows and how its
 * numbers are worked out; tap again, Escape or a click elsewhere closes it. Hover opens it too on a laptop.
 */
@Component({
  selector: 'ws-info',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    <button type="button" class="i" [class.on]="open()" [attr.aria-label]="'ws.info.label' | t: { name: title() }" [attr.aria-expanded]="open()" [attr.aria-controls]="id"
      (click)="toggle($event)" (mouseenter)="hoverOpen(true)" (mouseleave)="hoverOpen(false)">
      <lucide-icon [img]="icons.Info" [size]="15" aria-hidden="true" />
    </button>
    @if (open()) {
      <div class="pop" role="tooltip" [id]="id" (mouseenter)="hoverOpen(true)" (mouseleave)="hoverOpen(false)">
        @if (title()) { <strong>{{ title() }}</strong> }
        <p>{{ text() }}</p>
      </div>
    }
  `,
  styles: [`
    :host { position:relative; display:inline-flex; flex:none; z-index:2; }
    .i { display:grid; place-items:center; width:24px; height:24px; margin:-4px; padding:0; border:0; border-radius:50%; background:transparent; color:var(--ws-ink-3); cursor:pointer; }
    .i:hover, .i.on { background:var(--ws-surface-2); color:var(--ws-ink); }
    .i:focus-visible { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:1px; }
    .pop { position:absolute; inset-block-start:calc(100% + 8px); inset-inline-end:-8px; z-index:20; width:min(280px, 80vw); padding:var(--ws-3); border:1px solid var(--ws-line); border-radius:var(--ws-r-md); background:var(--ws-surface); box-shadow:var(--ws-shadow-pop); color:var(--ws-ink-2); font-size:var(--ws-text-sm); font-weight:400; line-height:1.5; text-align:start; white-space:normal; letter-spacing:normal; text-transform:none; }
    .pop strong { display:block; margin-block-end:4px; color:var(--ws-ink); font-size:var(--ws-text-sm); font-weight:600; }
    .pop p { margin:0; }
  `],
})
export class WsInfoComponent {
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  /** The card's name, read out with the button ("About Sales") and shown on top of the note. */
  readonly title = input('');
  readonly text = input.required<string>();

  protected readonly icons = { Info };
  protected readonly id = `ws-info-${++uid}`;
  protected readonly open = signal(false);
  private pinned = false;

  protected toggle(e: Event): void {
    // The card around it is often a link: the "i" never opens the card.
    e.preventDefault();
    e.stopPropagation();
    this.pinned = !this.pinned || !this.open();
    this.open.set(this.pinned);
  }
  protected hoverOpen(on: boolean): void {
    if (!this.pinned) this.open.set(on);
  }
  @HostListener('document:click', ['$event'])
  protected outside(e: Event): void {
    if (this.open() && !this.host.contains(e.target as Node)) this.close();
  }
  @HostListener('document:keydown.escape')
  protected close(): void {
    this.pinned = false;
    this.open.set(false);
  }
}
