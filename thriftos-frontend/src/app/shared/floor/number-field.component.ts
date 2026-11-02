import { Component, ElementRef, HostListener, computed, input, model, signal, viewChild } from '@angular/core';
import { Delete, LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { inject } from '@angular/core';

/**
 * Weight, money and count input (docs/v1/05 rule 3): a big field showing the unit; tapping it opens
 * a large keypad sheet (no phone keyboard, works with wet or dirty hands). Western digits always.
 */
@Component({
  selector: 'tos-number',
  standalone: true,
  imports: [LucideAngularModule, TPipe],
  template: `
    <button type="button" class="field-btn" [class.empty]="value() === null" [attr.aria-label]="(label() | t) + (value() !== null ? ': ' + shown() : '')" (click)="open()">
      <span class="label">{{ label() | t }}@if (optional()) { <em> · {{ 'common.optional' | t }}</em> }</span>
      <span class="value ltr"><b>{{ value() === null ? '0' : shown() }}</b> <small>{{ unit() | t }}</small></span>
    </button>
    @if (editing()) {
      <div class="backdrop" (click)="close()"></div>
      <section class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="label() | t" #sheet>
        <header><button type="button" class="cancel" (click)="close()">{{ 'common.cancel' | t }}</button><span>{{ label() | t }}</span><output class="ltr" aria-live="polite"><b>{{ draft() || '0' }}</b> <small>{{ unit() | t }}</small></output></header>
        @if (error(); as e) { <p class="err">{{ e }}</p> }
        <div class="keys ltr">
          @for (k of keys; track k) {
            <button type="button" (click)="press(k)" [attr.aria-label]="k === '<' ? ('common.clear' | t) : k">@if (k === '<') { <lucide-icon [img]="icons.Delete" [size]="26" /> } @else { {{ k }} }</button>
          }
        </div>
        <button type="button" class="ok" [disabled]="!valid()" (click)="confirm()">{{ 'common.keypadDone' | t }}</button>
      </section>
    }
  `,
  styles: [`
    :host { display:block; }
    .field-btn { width:100%; min-height:64px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 12px; padding:8px 16px; border:1px solid var(--tos-line); border-radius:14px; background:#fff; color:var(--tos-ink); font:inherit; text-align:start; cursor:pointer; }
    .label { font-size:15px; font-weight:700; }
    .label em { color:var(--tos-ink-soft); font-style:normal; font-weight:600; }
    .value { margin-inline-start:auto; white-space:nowrap; }
    .value b { font-size:24px; font-variant-numeric:tabular-nums; }
    .value small { margin-inline-start:4px; color:var(--tos-ink-soft); font-size:15px; font-weight:700; }
    .empty .value b { color:#b9b1b6; }
    .backdrop { position:fixed; inset:0; z-index:40; background:rgb(0 0 0 / .35); }
    .sheet { position:fixed; inset-inline:0; inset-block-end:0; z-index:41; display:grid; gap:10px; max-width:520px; margin:0 auto; padding:16px 16px calc(16px + env(safe-area-inset-bottom)); border-radius:18px 18px 0 0; background:#fff; }
    header { display:flex; align-items:center; gap:12px; font-weight:700; }
    header span { flex:1; }
    .cancel { min-height:44px; padding-inline:4px; border:0; background:none; color:var(--tos-primary); font:inherit; font-weight:800; }
    output b { font-size:34px; font-variant-numeric:tabular-nums; }
    output small { margin-inline-start:4px; font-size:17px; color:var(--tos-ink-soft); }
    .err { margin:0; color:var(--tos-warn); font-weight:700; }
    .keys { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .keys button { min-height:60px; border:1px solid var(--tos-line); border-radius:14px; background:#faf8f9; color:var(--tos-ink); font:inherit; font-size:26px; font-weight:700; display:grid; place-items:center; }
    .keys button:active { background:var(--tos-primary-soft); }
    .ok { min-height:56px; border:0; border-radius:14px; background:var(--tos-primary); color:#fff; font:inherit; font-size:18px; font-weight:800; }
    .ok:disabled { opacity:.45; }
  `],
})
export class NumberFieldComponent {
  private readonly i18n = inject(I18nService);
  readonly label = input.required<string>();
  /** i18n key of the unit shown in the field (unit.kgShort, unit.pcs…); Rs is shown as a word key too. */
  readonly unit = input('');
  readonly decimals = input(2);
  readonly max = input<number | null>(null);
  /** i18n key for "more than max" (gets {max}); defaults to a generic message. */
  readonly maxMessage = input<string | null>(null);
  readonly optional = input(false);
  readonly value = model<number | null>(null);
  protected readonly icons = { Delete };
  protected readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '<'];
  protected readonly editing = signal(false);
  protected readonly draft = signal('');
  protected readonly shown = computed(() => this.i18n.num(this.value()));
  protected readonly error = computed(() => {
    const n = Number(this.draft());
    const max = this.max();
    if (max !== null && n > max) {
      const m = this.i18n.num(max);
      return this.maxMessage() ? this.i18n.t(this.maxMessage()!, { kg: this.i18n.kg(max), max: m }) : `≤ ${m}`;
    }
    return null;
  });
  protected readonly valid = computed(() => this.draft() !== '' && Number(this.draft()) > 0 && !this.error());
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');

  /** The first key after opening replaces the shown value (like selecting it); Backspace edits it instead. */
  private fresh = false;

  open(): void {
    const v = this.value();
    this.draft.set(v === null ? '' : String(v));
    this.fresh = v !== null;
    this.editing.set(true);
    queueMicrotask(() => this.sheet()?.nativeElement.querySelector<HTMLButtonElement>('.keys button')?.focus());
  }

  protected press(k: string): void {
    if (this.fresh && k !== '<') this.draft.set('');
    this.fresh = false;
    const d = this.draft();
    if (k === '<') return this.draft.set(d.slice(0, -1));
    if (k === '.' && (this.decimals() === 0 || d.includes('.'))) return;
    const [, frac] = (d + k).split('.');
    if (frac !== undefined && frac.length > this.decimals()) return;
    if (d.replace('.', '').length >= 9) return;
    this.draft.set(d === '0' && k !== '.' ? k : d + k);
  }

  protected confirm(): void {
    if (!this.valid()) return;
    this.value.set(Number(this.draft()));
    this.editing.set(false);
  }

  protected close(): void {
    this.editing.set(false);
  }

  /** Hardware keyboards and desktop: digits, dot, Backspace, Enter, Escape. */
  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (!this.editing()) return;
    if (/^[0-9.]$/.test(e.key)) this.press(e.key);
    else if (e.key === 'Backspace') this.press('<');
    else if (e.key === 'Enter') this.confirm();
    else if (e.key === 'Escape') this.close();
    else return;
    e.preventDefault();
  }
}
