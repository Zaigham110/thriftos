import { Component, inject, input, output } from '@angular/core';
import { Languages, LucideAngularModule } from 'lucide-angular';
import { I18nService, LANGS, Lang, isLang } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * The language picker: English, اردو or Roman Urdu, each written in its own language. A plain select, so it
 * works the same with a finger, a mouse, a keyboard and a screen reader. It switches the app at once; a screen
 * that also saves the choice (setup) listens to `changed`.
 */
@Component({
  selector: 'app-lang-picker',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    <label class="lp">
      @if (iconSize()) { <lucide-icon [img]="icons.Languages" [size]="iconSize()" aria-hidden="true" /> }
      <select [value]="i18n.lang()" (change)="pick($event)" [attr.aria-label]="'nav.languagePick' | t">
        @for (l of langs; track l.id) { <option [value]="l.id" [selected]="l.id === i18n.lang()">{{ l.name }}</option> }
      </select>
    </label>
  `,
  styles: [`
    :host { display:inline-flex; }
    .lp { position:relative; display:inline-flex; align-items:center; gap:6px; min-height:inherit; color:inherit; cursor:pointer; }
    select { appearance:none; -webkit-appearance:none; min-height:32px; padding-block:0; padding-inline:0 18px; border:0; background:transparent; color:inherit; font:inherit; cursor:pointer;
      background-image:linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
      background-size:4px 4px; background-repeat:no-repeat; background-position:right 6px center, right 2px center; }
    :host-context([dir='rtl']) select { padding-inline:0 18px; background-position:left 2px center, left 6px center; }
    select:focus-visible { outline:2px solid var(--ws-focus, var(--ws-brand, currentColor)); outline-offset:2px; border-radius:4px; }
    option { color:initial; }
  `],
})
export class LangPickerComponent {
  protected readonly i18n = inject(I18nService);
  readonly iconSize = input(16);
  readonly changed = output<Lang>();
  protected readonly langs = LANGS;
  protected readonly icons = { Languages };

  protected pick(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    if (!isLang(v)) return;
    this.i18n.use(v);
    this.changed.emit(v);
  }
}
