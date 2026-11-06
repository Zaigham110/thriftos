import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ChevronRight, LucideAngularModule } from 'lucide-angular';
import { TPipe } from '../../../core/i18n/t.pipe';
import { NavService } from '../../../core/nav/nav.service';

/**
 * Where you are, each step a link ("Suppliers › London Clothing Bank › BALE-2026-007"): the way you came when
 * known, else the page's place in the menu. Pages straight from the menu show none.
 */
@Component({
  selector: 'ws-breadcrumbs',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    @if (nav.crumbs().length > 1 && !nav.onMenuPage()) {
      <nav class="crumbs" [attr.aria-label]="'ws.breadcrumbs' | t">
        <ol>
          @for (c of nav.crumbs(); track $index; let last = $last; let i = $index) {
            <li>
              @if (last) { <span aria-current="page">{{ c.raw ? c.label : (c.label | t) }}</span> }
              @else { <a [href]="c.path" (click)="go($event, i)">{{ c.raw ? c.label : (c.label | t) }}</a><lucide-icon [img]="icons.ChevronRight" [size]="14" class="flip" aria-hidden="true" /> }
            </li>
          }
        </ol>
      </nav>
    }
  `,
  styles: [`
    :host { display:block; }
    ol { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ws-1); margin:0 0 var(--ws-3); padding:0; list-style:none; font-family:var(--ws-font); font-size:var(--ws-text-sm); color:var(--ws-ink-3); }
    li { display:inline-flex; align-items:center; gap:var(--ws-1); min-width:0; }
    a { color:var(--ws-ink-2); text-decoration:none; }
    a:hover { color:var(--ws-brand); text-decoration:underline; }
    a:focus-visible { outline:2px solid var(--ws-focus, var(--ws-brand)); outline-offset:2px; border-radius:2px; }
    [aria-current] { color:var(--ws-ink); font-weight:500; }
    :host-context([dir=rtl]) .flip { transform:scaleX(-1); }
    @media print { :host { display:none; } }
  `],
})
export class WsBreadcrumbsComponent {
  protected readonly nav = inject(NavService);
  private readonly router = inject(Router);

  /** A step opens that page as it was (its search, filters and tab are in the path), with the steps before it as its own trail. */
  protected go(e: MouseEvent, i: number): void {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; // a new tab: the browser opens the link
    e.preventDefault();
    const crumbs = this.nav.crumbs();
    void this.router.navigateByUrl(crumbs[i].path, { state: { trail: crumbs.slice(0, i) } });
  }
  protected readonly icons = { ChevronRight };
}
