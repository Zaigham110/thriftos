import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/** `{{ 'sell.save' | t }}` or `{{ 'khata.owes' | t: { amount: x } }}`. Re-runs when the language changes. */
@Pipe({ name: 't', standalone: true, pure: false })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}

/** `{{ amount | rs }}` → "Rs 12,500" with Western digits in both languages. */
@Pipe({ name: 'rs', standalone: true, pure: false })
export class RsPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(value: number | string | null | undefined): string {
    return this.i18n.money(value);
  }
}

/** `{{ weight | kg }}` → "12.5 kg". */
@Pipe({ name: 'kg', standalone: true, pure: false })
export class KgPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(value: number | string | null | undefined): string {
    return this.i18n.kg(value);
  }
}

/** `{{ n | num }}` → "1,250" (Western digits). */
@Pipe({ name: 'num', standalone: true, pure: false })
export class NumPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(value: number | string | null | undefined, digits?: number): string {
    return this.i18n.num(value, digits);
  }
}

export const I18N = [TPipe, RsPipe, KgPipe, NumPipe] as const;
