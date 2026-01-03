import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

@Component({
  selector: 'ui-skeleton, app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('text');
  readonly width = input<string>('100%');
  readonly height = input<string>('1rem');
  readonly lines = input<number>(1);

  get skeletonStyle(): { [key: string]: string } {
    return {
      width: this.width(),
      height: this.height(),
    };
  }

  get skeletonClasses(): string {
    return `skeleton skeleton-${this.variant()}`;
  }

  get lineArray(): number[] {
    return Array.from({ length: this.lines() }, (_, i) => i);
  }
}
