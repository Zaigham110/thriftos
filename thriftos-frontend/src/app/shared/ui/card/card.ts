import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-card, app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.html',
  styleUrl: './card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly padding = input<boolean>(true);
  readonly shadow = input<boolean>(false);

  get cardClasses(): string {
    const classes = ['card'];
    if (this.shadow()) classes.push('card-shadow');
    if (!this.padding()) classes.push('card-no-padding');
    return classes.join(' ');
  }
}
