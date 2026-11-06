import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TPipe } from '../../core/i18n/t.pipe';
import { NavService } from '../../core/nav/nav.service';
import { WsStateComponent } from '../../shared/ui/workspace';

/**
 * An address that does not exist (an old link, a typo), or a part of ThriftOS this business has turned off:
 * say so inside the app and offer the way back and Home (v2 review). Before, both jumped to Home without a word.
 */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, TPipe, WsStateComponent],
  template: `
    <ws-state kind="empty"
      [heading]="(module ? 'ws.notFound.offTitle' : 'ws.notFound.title') | t"
      [message]="module ? ('ws.notFound.offText' | t: { module: ('ws.module.' + module | t) }) : ('ws.notFound.text' | t: { url: url })">
      <span class="actions">
        <button type="button" class="ws-btn" (click)="nav.back('/home')">{{ 'common.back' | t }}</button>
        <a class="ws-btn primary" routerLink="/home">{{ 'ws.notFound.home' | t }}</a>
      </span>
    </ws-state>
  `,
  styles: [`.actions { display:inline-flex; gap:var(--ws-2); }`],
})
export class NotFoundComponent {
  protected readonly nav = inject(NavService);
  protected readonly url = inject(Router).url;
  /** /unavailable?module=STOCK: the page belongs to a part of ThriftOS this business has turned off. */
  protected readonly module = inject(ActivatedRoute).snapshot.queryParamMap.get('module');
}
