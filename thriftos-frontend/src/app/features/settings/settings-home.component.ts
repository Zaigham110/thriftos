import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Building2, ChevronRight, Languages, LucideAngularModule, SlidersHorizontal, Users } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';

/** Settings: business setup (the wizard again), team, language, and the advanced admin screens. */
@Component({
  selector: 'app-settings-home',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head"><h1>{{ 'settings.title' | t }}</h1></header>
      <ul class="list">
        <li><a class="row" routerLink="/setup"><span class="item"><lucide-icon [img]="icons.Building2" [size]="22" /><strong>{{ 'settings.business' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
        <li><a class="row" routerLink="/settings/team"><span class="item"><lucide-icon [img]="icons.Users" [size]="22" /><strong>{{ 'settings.team' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
        <li><button type="button" class="row" (click)="toggleLang()"><span class="item"><lucide-icon [img]="icons.Languages" [size]="22" /><strong>{{ 'setup.language' | t }}</strong></span><span class="amount">{{ 'nav.language' | t }}</span></button></li>
        <li><a class="row" routerLink="/settings/admin"><span class="item"><lucide-icon [img]="icons.SlidersHorizontal" [size]="22" /><strong>{{ 'settings.advanced' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
      </ul>
    </section>
  `,
  styles: [`
    button.row { width:100%; border:0; background:transparent; font:inherit; cursor:pointer; }
    .item { display:flex !important; align-items:center; gap:12px; }
    .item lucide-icon { color:var(--tos-primary); }
    html[dir='rtl'] .go { transform:scaleX(-1); }
  `],
})
export class SettingsHomeComponent {
  private readonly i18n = inject(I18nService);
  protected readonly icons = { Building2, ChevronRight, Languages, SlidersHorizontal, Users };

  protected toggleLang(): void {
    this.i18n.use(this.i18n.lang() === 'ur' ? 'en' : 'ur');
  }
}
