import { STAFF_ROLES } from '../settings/roles';
import { moduleOn } from '../../core/tenant/module-on';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ArrowLeft, Check, LucideAngularModule, Plus, X } from 'lucide-angular';
import { API_BASE_URL } from '../../core/config/api.config';
import { I18nService, LANGS, Lang } from '../../core/i18n/i18n.service';
import { I18N } from '../../core/i18n/t.pipe';
import { TenantService } from '../../core/tenant/tenant.service';
import { ToastService } from '../../shared/floor/toast.service';
import { LangPickerComponent } from '../../shared/ui/lang-picker.component';

interface SetupDefaults { done: boolean; businessName: string; currency: string; language: Lang; sortingStages: number; categories: string[]; grades: string[] }
type Step = 'business' | 'categories' | 'grades' | 'munshi';

/**
 * Journey 8 — setup in under 5 minutes, one question per screen: business (name, currency, language) →
 * "Do you sort?" → categories (Karachi list: tap to remove, add your own) → grade names (only when grading) →
 * a first staff member with phone + PIN and a role (optional). Saved in one step; everything can be changed later in Settings.
 */
@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [LangPickerComponent, FormsModule, LucideAngularModule, I18N],
  template: `
    <main class="floor setup">
      <header class="floor-head">
        @if (index() > 0) { <button type="button" class="icon-btn back" [attr.aria-label]="'common.back' | t" (click)="back()"><lucide-icon [img]="icons.ArrowLeft" [size]="22" /></button> }
        <h1>{{ 'setup.title' | t }}<span class="sub">{{ 'setup.step' | t: { n: index() + 1, total: steps().length } }}</span></h1>
        <app-lang-picker (changed)="language.set($event)" />
      </header>
      <div class="bar" aria-hidden="true"><i [style.width.%]="((index() + 1) / steps().length) * 100"></i></div>

      @switch (step()) {
        @case ('business') {
          <section class="card">
            <label class="field">{{ 'setup.businessName' | t }}<input name="biz" [(ngModel)]="businessName" maxlength="120" autocomplete="organization" /></label>
            <span class="field">{{ 'setup.currency' | t }}</span>
            <div class="chips">@for (c of currencies; track c) { <button type="button" class="chip" [class.on]="currency() === c" (click)="currency.set(c)">{{ c }}</button> }</div>
            <span class="field">{{ 'setup.language' | t }}</span>
            <div class="chips">@for (l of langs; track l.id) { <button type="button" class="chip" [class.on]="language() === l.id" (click)="setLanguage(l.id)">{{ l.name }}</button> }</div>
          </section>
        }
        @case ('categories') {
          <h2>{{ 'setup.categories' | t }}</h2>
          <p class="hint">{{ 'setup.categoriesHint' | t }}</p>
          <div class="chips">
            @for (c of categories(); track c) { <button type="button" class="chip on" (click)="removeCategory(c)">{{ c }} <lucide-icon [img]="icons.X" [size]="14" /></button> }
          </div>
          <form class="add" (ngSubmit)="addCategory()">
            <input name="newCategory" [(ngModel)]="newCategory" maxlength="60" [placeholder]="'setup.addCategory' | t" [attr.aria-label]="'setup.addCategory' | t" />
            <button type="submit" class="btn" [disabled]="!newCategory.trim()" [attr.aria-label]="'setup.addCategory' | t"><lucide-icon [img]="icons.Plus" [size]="20" /></button>
          </form>
          @if (removed().length) {
            <p class="hint">{{ 'setup.removed' | t }}</p>
            <div class="chips">@for (c of removed(); track c) { <button type="button" class="chip" (click)="restoreCategory(c)"><lucide-icon [img]="icons.Plus" [size]="14" /> {{ c }}</button> }</div>
          }
        }
        @case ('grades') {
          <h2>{{ 'setup.grades' | t }}</h2>
          <p class="hint">{{ 'setup.gradesHint' | t }}</p>
          @for (g of grades(); track $index; let i = $index) {
            <div class="grade"><span class="rank">{{ i + 1 }}</span><input [name]="'grade' + i" [ngModel]="g" (ngModelChange)="setGrade(i, $event)" maxlength="40" [attr.aria-label]="('setup.grades' | t) + ' ' + (i + 1)" />
              <button type="button" class="icon-btn" [attr.aria-label]="'common.remove' | t" (click)="removeGrade(i)"><lucide-icon [img]="icons.X" [size]="18" /></button></div>
          }
          <button type="button" class="btn" (click)="addGrade()"><lucide-icon [img]="icons.Plus" [size]="18" /> {{ 'setup.addGrade' | t }}</button>
        }
        @case ('munshi') {
          <h2>{{ 'setup.munshi' | t }}</h2>
          <section class="card">
            <label class="field">{{ 'setup.munshiName' | t }}<input name="mName" [(ngModel)]="munshiName" maxlength="120" autocomplete="off" /></label>
            <span class="field">{{ 'settings.tm.staffRole' | t }}</span>
            <div class="chips">@for (r of staffRoles; track r) { <button type="button" class="chip" [class.on]="munshiRole === r" (click)="munshiRole = r">{{ 'settings.role.' + r | t }}</button> }</div>
            <p class="hint">{{ 'settings.tm.roleHint.' + munshiRole | t }}</p>
            <label class="field">{{ 'common.phone' | t }}<input name="mPhone" type="tel" inputmode="tel" [(ngModel)]="munshiPhone" [placeholder]="'common.phonePlaceholder' | t" /></label>
            <label class="field">{{ 'setup.munshiPin' | t }} <small>{{ 'auth.pinHint' | t }}</small><input name="mPin" type="tel" inputmode="numeric" maxlength="6" [(ngModel)]="munshiPin" class="ltr" autocomplete="off" /></label>
          </section>
          <p class="hint">{{ 'setup.done' | t }}</p>
        }
      }

      <footer class="action-bar">
        @if (step() === 'munshi' && !munshiStarted()) { <button type="button" class="btn" (click)="finish(false)">{{ 'setup.skip' | t }}</button> }
        <button type="button" class="btn primary" [disabled]="!canGo() || saving()" (click)="next()">{{ (saving() ? 'common.saving' : isLast() ? 'setup.finish' : 'common.next') | t }}</button>
      </footer>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--tos-canvas); }
    .setup { padding:16px; --tos-tabs-h:0px; }
    .bar { height:6px; border-radius:3px; background:var(--tos-line); overflow:hidden; }
    .bar i { display:block; height:100%; background:var(--tos-primary); transition:width .2s; }
    h2 { margin:4px 0 0; font-size:20px; }
    .option { min-height:72px; display:flex; align-items:center; justify-content:space-between; padding:12px 18px; border:1px solid var(--tos-line); border-radius:var(--tos-radius); background:var(--tos-card); color:var(--tos-ink); font:inherit; font-size:17px; text-align:start; cursor:pointer; }
    .option.on { border:2px solid var(--tos-primary); background:var(--tos-primary-soft); color:var(--tos-primary); }
    .chip lucide-icon { vertical-align:middle; }
    .add { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; }
    .add input, .grade input { min-height:52px; min-width:0; box-sizing:border-box; padding-inline:14px; border:1px solid var(--tos-line); border-radius:12px; font:inherit; font-size:17px; }
    .grade { display:grid; grid-template-columns:32px minmax(0,1fr) 48px; align-items:center; gap:8px; }
    .rank { font-weight:800; color:var(--tos-primary); text-align:center; }
    .field small { color:var(--tos-ink-soft); font-weight:600; }
  `],
})
export class SetupComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly tenants = inject(TenantService);
  private readonly toast = inject(ToastService);
  protected readonly icons = { ArrowLeft, Check, Plus, X };
  protected readonly currencies = ['PKR', 'USD', 'AED'];
  protected readonly currency = signal('PKR');
  protected readonly langs = LANGS;
  protected readonly language = signal<Lang>(this.i18n.lang());
  protected readonly stages = signal(2);
  protected readonly categories = signal<string[]>([]);
  protected readonly removed = signal<string[]>([]);
  protected readonly grades = signal<string[]>([]);
  protected readonly index = signal(0);
  protected readonly saving = signal(false);
  protected businessName = '';
  protected newCategory = '';
  protected munshiName = '';
  protected munshiPhone = '';
  protected munshiPin = '';
  /** Their staff role (v2: staff instead of "munshi"). */
  protected munshiRole = 'Sorter';
  protected readonly staffRoles = STAFF_ROLES;
  /** One key for this setup, so a retry after a network error saves it once. */
  private readonly key = crypto.randomUUID();

  private readonly on = moduleOn();
  /**
   * How the business sorts and what it has are set by ThriftOS when it is made (v2 modules): the owner is asked only
   * for the names it needs — categories when it sorts, grades when it grades — and a first staff member when it has staff.
   */
  protected readonly steps = computed<Step[]>(() => [
    'business' as Step,
    ...(this.stages() >= 1 ? (['categories'] as Step[]) : []),
    ...(this.stages() === 2 ? (['grades'] as Step[]) : []),
    ...(this.on('STAFF') ? (['munshi'] as Step[]) : []),
  ]);
  protected readonly step = computed(() => this.steps()[Math.min(this.index(), this.steps().length - 1)]);
  protected readonly isLast = computed(() => this.index() >= this.steps().length - 1);

  ngOnInit(): void {
    this.http.get<SetupDefaults>(`${API_BASE_URL}/tenant/setup`).subscribe({
      next: (d) => {
        this.businessName = d.businessName;
        this.currency.set(d.currency);
        this.stages.set(d.sortingStages);
        this.categories.set(d.categories);
        this.grades.set(d.grades);
        // The language ThriftOS set when it made the business (bills and messages), not whatever this phone shows.
        this.language.set(d.language);
      },
      error: () => this.toast.error(this.i18n.t('common.couldNotLoad')),
    });
  }

  protected munshiStarted(): boolean {
    return !!(this.munshiName.trim() || this.munshiPhone.trim() || this.munshiPin);
  }

  protected canGo(): boolean {
    switch (this.step()) {
      case 'business':
        return !!this.businessName.trim();
      case 'categories':
        return this.categories().length > 0;
      case 'grades':
        return this.grades().some((g) => g.trim());
      case 'munshi':
        return !this.munshiStarted() || (!!this.munshiName.trim() && !!this.munshiPhone.trim() && /^\d{4,6}$/.test(this.munshiPin));
      default:
        return true;
    }
  }

  protected next(): void {
    if (this.isLast()) this.finish(this.munshiStarted());
    else this.index.update((i) => i + 1);
  }

  protected back(): void {
    this.index.update((i) => Math.max(0, i - 1));
  }


  protected setLanguage(l: Lang): void {
    this.language.set(l);
    this.i18n.use(l);
  }

  protected removeCategory(c: string): void {
    this.categories.update((all) => all.filter((x) => x !== c));
    this.removed.update((r) => [c, ...r]);
  }

  protected restoreCategory(c: string): void {
    this.removed.update((r) => r.filter((x) => x !== c));
    this.categories.update((all) => [...all, c]);
  }

  protected addCategory(): void {
    const name = this.newCategory.trim();
    if (name && !this.categories().some((c) => c.toLowerCase() === name.toLowerCase())) this.categories.update((all) => [...all, name]);
    this.newCategory = '';
  }

  protected setGrade(i: number, value: string): void {
    this.grades.update((all) => all.map((g, j) => (j === i ? value : g)));
  }

  protected addGrade(): void {
    this.grades.update((all) => [...all, '']);
  }

  protected removeGrade(i: number): void {
    this.grades.update((all) => all.filter((_, j) => j !== i));
  }

  protected finish(withMunshi: boolean): void {
    this.saving.set(true);
    const body = {
      businessName: this.businessName.trim(),
      currency: this.currency(),
      language: this.language(),
      categories: this.stages() === 0 ? [] : this.categories(),
      grades: this.stages() === 2 ? this.grades().filter((g) => g.trim()) : [],
      ...(withMunshi ? { munshi: { name: this.munshiName.trim(), phone: this.munshiPhone.trim(), pin: this.munshiPin, roleName: this.munshiRole } } : {}),
    };
    this.http.post(`${API_BASE_URL}/tenant/setup`, body, { headers: { 'Idempotency-Key': this.key } }).subscribe({
      next: () => {
        this.toast.show(this.i18n.t('setup.done'));
        this.tenants.loadTenant(true).subscribe({ complete: () => this.router.navigate(['/home']), error: () => this.router.navigate(['/home']) });
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.error?.message || this.i18n.t('common.couldNotSave'));
      },
    });
  }
}
