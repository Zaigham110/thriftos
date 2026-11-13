import { Component, HostListener, input, output } from '@angular/core';

/** A panel over the screen: slides up from the bottom on a phone, sits in the middle on a tablet or laptop. */
@Component({
  selector: 'pos-sheet',
  template: `
    <div class="no-print fixed inset-0 z-40 flex items-end justify-center bg-brand-950/55 md:items-center md:p-6" (mousedown)="outside($event)">
      <div
        class="flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-white shadow-lift md:rounded-3xl"
        [class]="wide() ? 'md:max-w-3xl' : 'md:max-w-md'"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="heading()"
      >
        <header class="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 class="truncate text-lg font-bold">{{ heading() }}</h2>
          <button type="button" class="icon-btn -mr-2" (click)="closed.emit()" aria-label="Close">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class Sheet {
  readonly heading = input.required<string>();
  readonly wide = input(false);
  readonly closed = output<void>();

  /**
   * A press on the dark area around the sheet closes it. This must not return a value: Angular cancels the event
   * when a handler returns false, and a cancelled mousedown stops every box inside the sheet from taking focus.
   */
  outside(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  esc() {
    this.closed.emit();
  }
}
