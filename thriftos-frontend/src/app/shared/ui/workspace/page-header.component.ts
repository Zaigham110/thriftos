import { Component, DestroyRef, inject, input } from '@angular/core';
import { NavService } from '../../../core/nav/nav.service';
import { WsBreadcrumbsComponent } from './breadcrumbs.component';

/** Breadcrumb, page title with an optional line under it, and actions at the end (project them with [actions]). */
@Component({
  selector: 'ws-page-header',
  standalone: true,
  imports: [WsBreadcrumbsComponent],
  template: `
    @if (crumbs()) { <ws-breadcrumbs /> }
    <header class="head">
      <div class="titles">
        <h1>{{ heading() }}</h1>
        @if (subtitle()) { <p>{{ subtitle() }}</p> }
      </div>
      <div class="actions"><ng-content select="[actions]" /></div>
    </header>
    <ng-content />
  `,
  styles: [`
    :host { display:block; margin-block-end:var(--ws-5); }
    .head { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:var(--ws-4); }
    h1 { margin:0; color:var(--ws-ink); font-size:var(--ws-text-2xl); font-weight:600; line-height:1.25; }
    p { margin:var(--ws-1) 0 0; color:var(--ws-ink-2); font-size:var(--ws-text-md); }
    .actions { display:flex; flex-wrap:wrap; gap:var(--ws-2); }
    .actions:empty { display:none; }
  `],
})
export class WsPageHeaderComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>('');
  /** Off when the page shows the breadcrumb itself (above its tabs). */
  readonly crumbs = input(true);

  constructor() {
    // While this header is on screen the shell leaves the breadcrumb to it (lined up with the heading).
    const nav = inject(NavService);
    nav.headers.update((n) => n + 1);
    inject(DestroyRef).onDestroy(() => nav.headers.update((n) => n - 1));
  }
}
