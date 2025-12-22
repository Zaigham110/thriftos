import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Inbox, LucideIconData } from 'lucide-angular';

@Component({
  selector: 'ui-empty-state',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly icon = input<LucideIconData>(Inbox);
  readonly title = input<string>('No data found');
  readonly description = input<string>('');
}
