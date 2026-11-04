import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, ChevronRight, LucideAngularModule } from 'lucide-angular';
import { I18N } from '../../core/i18n/t.pipe';
import { HELP_TOPICS, helpTopic } from './help-topics';

/**
 * Help (v2 6.4): `/help` lists the guides, `/help/:topic` shows one in four short numbered steps with a button to do
 * it now. Linked from the first-week checklist on Home and from empty lists.
 */
@Component({
  selector: 'app-help',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor help">
      @if (topic(); as t) {
        <header class="floor-head">
          <a class="icon-btn back" routerLink="/help" [attr.aria-label]="'common.back' | t"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></a>
          <h1>{{ 'help.' + t.key + '.title' | t }}</h1>
        </header>
        <ol class="steps">
          @for (n of numbers; track n) {
            <li class="card"><span class="n" aria-hidden="true">{{ n | num }}</span><p>{{ 'help.' + t.key + '.s' + n | t }}</p></li>
          }
        </ol>
        <footer class="action-bar">
          <a class="btn primary" [routerLink]="t.link">{{ 'help.' + t.key + '.go' | t }}</a>
        </footer>
      } @else {
        <header class="floor-head"><h1>{{ 'help.title' | t }}</h1></header>
        <p class="intro">{{ 'help.intro' | t }}</p>
        <ul class="topics">
          @for (t of topics; track t.key) {
            <li><a class="card topic" [routerLink]="['/help', t.key]">
              <lucide-icon [img]="t.icon" [size]="22" class="ic" />
              <strong>{{ 'help.' + t.key + '.title' | t }}</strong>
              <lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" />
            </a></li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .help .intro { margin:0 0 4px; color:var(--tos-ink-soft); }
    .help .steps, .help .topics { display:grid; gap:10px; margin:0; padding:0; list-style:none; }
    .help .steps li { display:flex; gap:14px; align-items:flex-start; flex-direction:row; }
    .help .steps .n { flex:none; display:grid; place-items:center; width:36px; height:36px; border-radius:50%; background:var(--tos-primary); color:#fff; font-weight:800; font-size:18px; }
    .help .steps p { margin:0; padding-block-start:6px; color:var(--tos-ink); font-size:17px; line-height:1.5; }
    .help .topic { display:flex; flex-direction:row; align-items:center; gap:12px; color:var(--tos-ink); text-decoration:none; }
    .help .topic strong { flex:1; }
    .help .topic .ic { color:var(--tos-primary); }
    .help .topic .go { color:var(--tos-ink-soft); }
    html[dir='rtl'] .help .topic .go { transform:scaleX(-1); }
  `],
})
export class HelpComponent {
  /** From the route `/help/:topic`. */
  readonly key = input<string>('', { alias: 'topic' });
  protected readonly topic = computed(() => helpTopic(this.key()));
  protected readonly topics = HELP_TOPICS;
  protected readonly numbers = [1, 2, 3, 4];
  protected readonly icons = { ArrowLeft, ChevronRight };
}
