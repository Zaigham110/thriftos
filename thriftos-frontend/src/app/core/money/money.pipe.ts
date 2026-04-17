import { ChangeDetectionStrategy, Pipe, PipeTransform, inject } from '@angular/core';
import { MoneyService, MoneyFormatOptions } from './money.service';

@Pipe({
  name: 'money',
  standalone: true,
  pure: true,
})
export class MoneyPipe implements PipeTransform {
  private readonly money = inject(MoneyService);

  transform(value: number | string | null | undefined, opts?: MoneyFormatOptions): string {
    return this.money.format(value, opts);
  }
}
