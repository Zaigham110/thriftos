import { Component, ElementRef, afterNextRender, computed, effect, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';

let nextId = 0;

/**
 * Weight, money and count input (docs/v1/05 rule 3). One plain box on every device: on a phone it opens the
 * phone's own number keyboard (inputmode="decimal"), on a laptop you type. No custom keypad (v2 sorting review).
 * Urdu (۰–۹) and Arabic (٠–٩) digits are read as Western digits; the value is a number above zero or null.
 */
@Component({
  selector: 'tos-number',
  standalone: true,
  imports: [TPipe],
  template: `
    <div class="nf" [class.big]="size() === 'big'" [class.bad]="!!error()">
      <label class="label" [attr.for]="id">{{ label() | t }}@if (optional()) { <em> · {{ 'common.optional' | t }}</em> }</label>
      <div class="box ltr" (click)="focus()">
        <input #box [id]="id" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" autocorrect="off" spellcheck="false"
          [attr.aria-invalid]="!!error()" [attr.aria-describedby]="describedBy()" [attr.aria-required]="!optional()"
          [value]="text()" (input)="typed($event)" (keydown.enter)="onEnter($event)" (focus)="select()" placeholder="0" />
        @if (unit()) { <span class="unit" [id]="id + '-unit'">{{ unit() | t }}</span> }
      </div>
      @if (error(); as e) { <p class="err" role="alert" [id]="id + '-err'">{{ e }}</p> }
      @else if (hint()) { <p class="hint" [id]="id + '-hint'">{{ hint() }}</p> }
    </div>
  `,
  styles: [`
    :host { display:block; }
    .nf { display:grid; grid-template-columns:minmax(0, 1fr) auto; align-items:center; gap:4px 12px; padding:8px 12px; border:1px solid var(--tos-line); border-radius:12px; background:var(--tos-card); color:var(--tos-ink); }
    .nf.bad { border-color:var(--tos-warn); }
    .label { font-size:15px; font-weight:700; cursor:pointer; }
    .label em { color:var(--tos-ink-soft); font-style:normal; font-weight:600; }
    .box { display:inline-flex; align-items:center; gap:6px; min-height:48px; padding:0 12px; border:1px solid var(--tos-line); border-radius:10px; background:var(--tos-card); cursor:text; }
    .box:focus-within { border-color:var(--tos-primary); box-shadow:0 0 0 3px var(--tos-primary-soft, #f3e8ef); }
    .bad .box { border-color:var(--tos-warn); }
    input { width:7.5em; min-width:0; padding:0; border:0; outline:0; background:transparent; color:var(--tos-ink); font:inherit; font-size:20px; font-weight:800; text-align:end; font-variant-numeric:tabular-nums; }
    input::placeholder { color:#b9b1b6; }
    .unit { color:var(--tos-ink-soft); font-size:15px; font-weight:700; }
    .err, .hint { grid-column:1 / -1; margin:0; font-size:14px; }
    .err { color:var(--tos-warn); font-weight:700; }
    .hint { color:var(--tos-ink-soft); font-weight:600; }
    /* The sorting sheet: the label on top, one wide box with large digits. */
    .big { grid-template-columns:minmax(0, 1fr); padding:0; border:0; background:none; gap:6px; }
    .big .box { min-height:64px; padding:0 16px; border-width:2px; border-radius:14px; }
    .big input { flex:1; width:auto; font-size:30px; text-align:start; }
    .big .unit { font-size:18px; }
    @media (max-width:420px) { .nf:not(.big) input { width:6em; } }
  `],
})
export class NumberFieldComponent {
  private readonly i18n = inject(I18nService);
  readonly label = input.required<string>();
  /** i18n key of the unit shown in the field (unit.kgShort, unit.pcs…); Rs is shown as a word key too. */
  readonly unit = input('');
  readonly decimals = input(2);
  readonly max = input<number | null>(null);
  /** i18n key for "more than max" (gets {kg} and {max}); defaults to a generic message. */
  readonly maxMessage = input<string | null>(null);
  readonly optional = input(false);
  /** A line under the box (already translated), e.g. "450 kg left". */
  readonly hint = input<string | null>(null);
  /** 'big': label on top and large digits (the sorting sheet). */
  readonly size = input<'normal' | 'big'>('normal');
  /** Puts the cursor in the box when it appears, so the phone's keyboard is up at once. */
  readonly autofocus = input(false);
  readonly value = model<number | null>(null);
  /** Enter, or the keyboard's Done key, with a valid number: the screen may save. */
  readonly enter = output<number>();

  protected readonly id = `tos-number-${++nextId}`;
  protected readonly text = signal('');
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  /** The number typed so far (NaN when there is none). */
  private readonly typedNumber = computed(() => (this.text() === '' ? NaN : Number(this.text())));
  protected readonly error = computed(() => {
    const n = this.typedNumber();
    const max = this.max();
    if (max === null || !(n > max)) return null;
    const m = this.i18n.num(max);
    return this.maxMessage() ? this.i18n.t(this.maxMessage()!, { kg: this.i18n.kg(max), max: m }) : `≤ ${m}`;
  });
  protected readonly describedBy = computed(() => {
    const ids = [this.unit() ? `${this.id}-unit` : '', this.error() ? `${this.id}-err` : this.hint() ? `${this.id}-hint` : ''].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });

  constructor() {
    // A value set from outside (a remembered bale weight, a cleared form) shows in the box; what is being
    // typed ("12." while on the way to "12.5") is left alone.
    effect(() => {
      const v = this.value();
      untracked(() => {
        if (v !== this.parsed()) this.text.set(v === null ? '' : String(v));
      });
    });
    // The limit can arrive after the number was typed (a slow network): the number then counts, or stops counting.
    effect(() => {
      this.max();
      untracked(() => {
        if (this.text() !== '' && this.parsed() !== this.value()) this.value.set(this.parsed());
      });
    });
    afterNextRender(() => {
      if (this.autofocus()) this.focus();
    });
  }

  /** Puts the cursor in the box (the phone's keyboard opens). */
  focus(): void {
    this.box().nativeElement.focus();
  }

  /** Kept for screens that "open" the field: it now just focuses the box. */
  open(): void {
    this.focus();
  }

  protected select(): void {
    // The first key replaces the number shown (like the old keypad); a tap afterwards places the cursor.
    const el = this.box().nativeElement;
    if (el.value) queueMicrotask(() => el.select());
  }

  protected typed(e: Event): void {
    const el = e.target as HTMLInputElement;
    const clean = this.clean(el.value);
    if (clean !== el.value) el.value = clean;
    this.text.set(clean);
    this.value.set(this.parsed());
  }

  protected onEnter(e: Event): void {
    const v = this.parsed();
    if (v === null) return;
    e.preventDefault();
    this.enter.emit(v);
  }

  /** The value the text stands for: a number above zero, within max, rounded; otherwise null. */
  private parsed(): number | null {
    const n = this.typedNumber();
    const max = this.max();
    if (!Number.isFinite(n) || n <= 0 || (max !== null && n > max)) return null;
    const f = 10 ** this.decimals();
    return Math.round(n * f) / f;
  }

  /** Digits and one dot only (a comma counts as the dot), at most `decimals` after it, Urdu/Arabic digits read as 0–9. */
  private clean(raw: string): string {
    let s = raw
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
      .replace(/[,٫]/g, '.')
      .replace(/[^0-9.]/g, '');
    const dot = s.indexOf('.');
    if (dot >= 0) {
      const frac = s.slice(dot + 1).replace(/\./g, '');
      s = this.decimals() === 0 ? s.slice(0, dot) : s.slice(0, dot + 1) + frac.slice(0, this.decimals());
    }
    return s.slice(0, 12);
  }
}
