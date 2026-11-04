import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CircleHelp, LucideAngularModule } from 'lucide-angular';
import { TPipe } from '../../core/i18n/t.pipe';

/** "How does this work?" under an empty list: opens the short help screen for that task (v2 6.4). */
@Component({
  selector: 'app-help-link',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TPipe],
  template: `<a class="tos-help-link" [routerLink]="['/help', topic()]"><lucide-icon [img]="icons.CircleHelp" [size]="18" />{{ 'help.how' | t }}</a>`,
  styles: [`
    :host { display:block; }
    .tos-help-link { display:inline-flex; align-items:center; gap:6px; min-height:40px; color:var(--ws-brand, var(--tos-primary)); font-weight:700; text-decoration:none; }
  `],
})
export class HelpLinkComponent {
  readonly topic = input.required<string>();
  protected readonly icons = { CircleHelp };
}
