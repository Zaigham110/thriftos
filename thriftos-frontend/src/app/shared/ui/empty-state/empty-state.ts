import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, Inbox, LucideIconData } from 'lucide-angular';

import { ButtonComponent } from '../button/button';
import { cn } from '../utils/cn';

@Component({
  selector: 'ui-empty-state, app-empty-state',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, ButtonComponent],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent implements OnInit {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly hostClass = signal<string>('');

  readonly icon = input<LucideIconData>(Inbox);
  readonly title = input<string>('No data found');
  readonly description = input<string>('');

  readonly actionLabel = input<string | undefined>(undefined);
  readonly actionLink = input<string | any[] | undefined>(undefined);

  ngOnInit(): void {
    this.hostClass.set(this.elementRef.nativeElement.className || '');
  }

  get containerClasses(): string {
    return cn('empty-state', this.hostClass());
  }
}
