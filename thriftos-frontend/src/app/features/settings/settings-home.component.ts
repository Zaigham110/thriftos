import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Building2, ChevronRight, CircleHelp, Download, FileText, FileUp, KeyRound, Languages, LucideAngularModule, SlidersHorizontal, Users } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { ToastService } from '../../shared/floor/toast.service';
import { LangPickerComponent } from '../../shared/ui/lang-picker.component';

/** Settings: business setup (the wizard again), team, password, language, data export, terms, and the advanced admin screens. */
@Component({
  selector: 'app-settings-home',
  standalone: true,
  imports: [LangPickerComponent, RouterLink, LucideAngularModule, I18N],
  template: `
    <section class="floor">
      <header class="floor-head"><h1>{{ 'settings.title' | t }}</h1></header>
      <ul class="list">
        <li><a class="row" routerLink="/setup"><span class="item"><lucide-icon [img]="icons.Building2" [size]="22" /><strong>{{ 'settings.business' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
        <li><a class="row" routerLink="/settings/team"><span class="item"><lucide-icon [img]="icons.Users" [size]="22" /><strong>{{ 'settings.team' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
        <li><a class="row" routerLink="/settings/password"><span class="item"><lucide-icon [img]="icons.KeyRound" [size]="22" /><strong>{{ 'settings.password' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
        <li><div class="row"><span class="item"><lucide-icon [img]="icons.Languages" [size]="22" /><strong>{{ 'setup.language' | t }}</strong></span><app-lang-picker class="amount" [iconSize]="0" /></div></li>
        <li><a class="row" routerLink="/settings/admin/import"><span class="item"><lucide-icon [img]="icons.FileUp" [size]="22" /><strong>{{ 'import.title' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
        <li><button type="button" class="row" (click)="exportData()" [disabled]="exporting()"><span class="item"><lucide-icon [img]="icons.Download" [size]="22" /><strong>{{ 'settings.export' | t }}</strong></span><span class="amount">{{ (exporting() ? 'common.loading' : 'settings.exportHint') | t }}</span></button></li>
        <li><a class="row" routerLink="/help"><span class="item"><lucide-icon [img]="icons.CircleHelp" [size]="22" /><strong>{{ 'help.title' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
        <li><a class="row" routerLink="/terms"><span class="item"><lucide-icon [img]="icons.FileText" [size]="22" /><strong>{{ 'legal.terms.title' | t }} · {{ 'legal.privacy.title' | t }}</strong></span><lucide-icon [img]="icons.ChevronRight" [size]="20" class="go" /></a></li>
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
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  protected readonly icons = { Building2, ChevronRight, CircleHelp, Download, FileText, FileUp, KeyRound, Languages, SlidersHorizontal, Users };
  protected readonly exporting = signal(false);

  /** Everything this business has, as a zip of CSV files (owners only). */
  protected exportData(): void {
    this.exporting.set(true);
    this.http.get('/api/tenant/export', { observe: 'response', responseType: 'blob' }).subscribe({
      next: (res) => {
        this.exporting.set(false);
        const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'thriftos-export.zip';
        const url = URL.createObjectURL(res.body!);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: (e: { status?: number }) => {
        this.exporting.set(false);
        this.toast.show(this.i18n.t(e.status === 403 ? 'settings.exportNotAllowed' : 'common.couldNotLoad'));
      },
    });
  }

}
