import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Check, CircleHelp, LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { COUNTRIES } from '../receive/supplier-picker.component';

type StepKey = 'supplier' | 'container' | 'sale' | 'team';
interface FirstWeek { show: boolean; done: number; steps: Record<StepKey, boolean> }

const STEPS: { key: StepKey; link: string | null; help: string }[] = [
  { key: 'supplier', link: null, help: 'supplier' },
  { key: 'container', link: '/receive/container', help: 'container' },
  { key: 'sale', link: '/sell/new', help: 'sale' },
  { key: 'team', link: '/settings/team', help: 'team' },
];

/**
 * First-week checklist on Home (v2 6.4): supplier → first container → first sale → munshi, each one tap. Ticks itself
 * from what the business has done; goes away when all four are done, after 30 days, or when the owner hides it.
 */
@Component({
  selector: 'app-first-week',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule, TPipe],
  template: `
    @if (state(); as s) {
      @if (s.show) {
        <section class="tos-fw" [attr.aria-label]="'fw.title' | t">
          <header>
            <h2>{{ 'fw.title' | t }}</h2>
            <span class="count">{{ 'fw.progress' | t: { done: i18n.num(s.done) } }}</span>
          </header>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="4" [attr.aria-valuenow]="s.done"><span [style.width.%]="s.done * 25"></span></div>
          <ol>
            @for (step of steps; track step.key) {
              <li [class.done]="s.steps[step.key]">
                @if (s.steps[step.key]) {
                  <div class="step">
                    <span class="tick on" aria-hidden="true"><lucide-icon [img]="icons.Check" [size]="16" /></span>
                    <span class="text"><strong>{{ 'fw.' + step.key + '.title' | t }}</strong><small>{{ 'fw.done' | t }}</small></span>
                  </div>
                } @else {
                  <button type="button" class="step" (click)="go(step.key, step.link)" [attr.aria-expanded]="step.key === 'supplier' ? adding() : null">
                    <span class="tick" aria-hidden="true">{{ i18n.num($index + 1) }}</span>
                    <span class="text"><strong>{{ 'fw.' + step.key + '.title' | t }}</strong><small>{{ 'fw.' + step.key + '.hint' | t }}</small></span>
                  </button>
                  <a class="how" [routerLink]="['/help', step.help]" [attr.aria-label]="('fw.how' | t) + ' ' + ('fw.' + step.key + '.title' | t)"><lucide-icon [img]="icons.CircleHelp" [size]="20" /></a>
                }
                @if (step.key === 'supplier' && adding() && !s.steps.supplier) {
                  <form class="add" (ngSubmit)="saveSupplier()">
                    <label>{{ 'receive.newSupplierName' | t }}<input [(ngModel)]="name" name="fwSupplier" maxlength="120" autocomplete="off" /></label>
                    <div class="countries" role="group" [attr.aria-label]="'common.country' | t">
                      @for (c of countries; track c) { <button type="button" [class.on]="country === c" [attr.aria-pressed]="country === c" (click)="country = c">{{ c }}</button> }
                    </div>
                    @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
                    <div class="row">
                      <button type="button" (click)="adding.set(false)">{{ 'common.cancel' | t }}</button>
                      <button type="submit" class="primary" [disabled]="!name.trim() || saving()">{{ (saving() ? 'common.saving' : 'common.save') | t }}</button>
                    </div>
                  </form>
                }
              </li>
            }
          </ol>
          <footer>
            @if (canImport()) { <a routerLink="/settings/admin/import">{{ 'fw.import' | t }}</a> }
            <button type="button" class="hide" (click)="hide()">{{ 'fw.hide' | t }}</button>
          </footer>
        </section>
      }
    }
  `,
  styles: [`
    :host { display:block; }
    .tos-fw { display:grid; gap:10px; padding:16px; border:1px solid var(--ws-line, var(--tos-line, #e4dde1)); border-radius:16px; background:var(--ws-surface, var(--tos-card, #fff)); color:var(--ws-ink, var(--tos-ink)); }
    .tos-fw header { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
    .tos-fw h2 { margin:0; font-size:18px; }
    .tos-fw .count { color:var(--ws-ink-2, var(--tos-ink-soft)); font-size:14px; font-weight:600; white-space:nowrap; }
    .tos-fw .bar { height:6px; border-radius:3px; background:var(--ws-surface-2, #efe9ec); overflow:hidden; }
    .tos-fw .bar span { display:block; height:100%; border-radius:3px; background:var(--ws-good, #1f8a4c); transition:width .3s; }
    .tos-fw ol { display:grid; gap:2px; margin:0; padding:0; list-style:none; }
    .tos-fw li { display:grid; grid-template-columns:1fr auto; align-items:center; }
    .tos-fw .step { display:flex; align-items:center; gap:12px; min-height:56px; padding:6px 4px; border:0; border-radius:12px; background:transparent; color:inherit; font:inherit; text-align:start; cursor:pointer; }
    .tos-fw button.step:hover { background:var(--ws-surface-2, #f6f2f4); }
    .tos-fw .tick { flex:none; display:grid; place-items:center; width:30px; height:30px; border:2px solid var(--ws-brand, var(--tos-primary)); border-radius:50%; color:var(--ws-brand, var(--tos-primary)); font-weight:800; font-size:14px; }
    .tos-fw .tick.on { border-color:var(--ws-good, #1f8a4c); background:var(--ws-good, #1f8a4c); color:#fff; }
    .tos-fw .text { display:grid; gap:2px; min-width:0; }
    .tos-fw .text strong { font-size:16px; }
    .tos-fw .text small { color:var(--ws-ink-2, var(--tos-ink-soft)); font-size:13px; }
    .tos-fw li.done .text strong { color:var(--ws-ink-2, var(--tos-ink-soft)); text-decoration:line-through; font-weight:600; }
    .tos-fw .how { display:grid; place-items:center; width:44px; height:44px; color:var(--ws-ink-2, var(--tos-ink-soft)); border-radius:50%; }
    .tos-fw .add { grid-column:1 / -1; display:grid; gap:10px; margin:4px 0 8px; padding:12px; border-radius:12px; background:var(--ws-surface-2, #f6f2f4); }
    .tos-fw .add label { display:grid; gap:6px; font-size:14px; font-weight:600; }
    .tos-fw .add input { min-height:44px; padding:0 12px; border:1px solid var(--ws-line, var(--tos-line, #ddd)); border-radius:10px; background:var(--ws-surface, #fff); color:inherit; font:inherit; font-size:16px; }
    .tos-fw .countries { display:flex; flex-wrap:wrap; gap:6px; }
    .tos-fw .countries button { min-height:36px; padding:0 12px; border:1px solid var(--ws-line, var(--tos-line, #ddd)); border-radius:999px; background:var(--ws-surface, #fff); color:inherit; font:inherit; font-size:14px; cursor:pointer; }
    .tos-fw .countries button.on { border-color:var(--ws-brand, var(--tos-primary)); color:var(--ws-brand, var(--tos-primary)); font-weight:700; }
    .tos-fw .row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .tos-fw .row button { min-height:44px; border:1px solid var(--ws-line, var(--tos-line, #ddd)); border-radius:10px; background:var(--ws-surface, #fff); color:inherit; font:inherit; font-weight:700; cursor:pointer; }
    .tos-fw .row .primary { border-color:var(--ws-brand, var(--tos-primary)); background:var(--ws-brand, var(--tos-primary)); color:#fff; }
    .tos-fw .row button:disabled { opacity:.55; cursor:default; }
    @media (min-width: 1024px) { .tos-fw ol { grid-template-columns:repeat(2, minmax(0, 1fr)); column-gap:24px; } .tos-fw li { grid-template-columns:minmax(0, max-content) auto; justify-content:start; column-gap:8px; } }
    .tos-fw .err { margin:0; color:var(--ws-bad, #b3261e); font-size:14px; }
    .tos-fw footer { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; padding-block-start:4px; border-block-start:1px solid var(--ws-line, var(--tos-line, #eee)); }
    .tos-fw footer a { min-height:40px; display:inline-flex; align-items:center; color:var(--ws-brand, var(--tos-primary)); font-size:14px; font-weight:700; text-decoration:none; }
    .tos-fw .hide { min-height:40px; margin-inline-start:auto; padding:0 8px; border:0; background:transparent; color:var(--ws-ink-2, var(--tos-ink-soft)); font:inherit; font-size:14px; cursor:pointer; }
  `],
})
export class FirstWeekComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly icons = { Check, CircleHelp };
  protected readonly steps = STEPS;
  protected readonly countries = COUNTRIES;
  protected readonly state = signal<FirstWeek | null>(null);
  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly canImport = computed(() => this.auth.permissions().includes('data.import'));
  protected name = '';
  protected country = 'USA';

  ngOnInit(): void {
    this.load();
  }

  protected go(key: StepKey, link: string | null): void {
    if (key === 'supplier') {
      this.adding.update((a) => !a);
      return;
    }
    if (link) void this.router.navigateByUrl(link);
  }

  /** Name and country only, the same as "+ New supplier" when receiving a container. */
  protected saveSupplier(): void {
    const name = this.name.trim();
    if (!name) return;
    this.saving.set(true);
    this.error.set('');
    this.http.post(`${API_BASE_URL}/procurement/vendors`, { name, originCountry: this.country, country: this.country }).subscribe({
      next: () => {
        this.saving.set(false);
        this.adding.set(false);
        this.name = '';
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e?.error?.message && typeof e.error.message === 'string' ? e.error.message : this.i18n.t('common.couldNotSave'));
      },
    });
  }

  protected hide(): void {
    this.state.update((s) => (s ? { ...s, show: false } : s));
    this.http.post(`${API_BASE_URL}/home/first-week/hide`, {}).subscribe({ error: () => undefined });
  }

  private load(): void {
    this.http.get<FirstWeek>(`${API_BASE_URL}/home/first-week`).subscribe({ next: (s) => this.state.set(s), error: () => undefined });
  }
}
