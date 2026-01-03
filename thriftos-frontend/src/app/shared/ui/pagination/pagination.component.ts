import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button';

@Component({
  selector: 'app-pagination, ui-pagination',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  template: `
    <div class="flex items-center justify-between gap-3">
      <ui-button
        variant="outline"
        size="sm"
        [disabled]="isPrevDisabled()"
        (onClick)="goTo(currentPage() - 1)"
      >
        Previous
      </ui-button>

      <div class="text-sm text-muted-foreground">
        Page <span class="font-medium text-foreground">{{ currentPage() }}</span>
        of <span class="font-medium text-foreground">{{ totalPages() }}</span>
      </div>

      <ui-button
        variant="outline"
        size="sm"
        [disabled]="isNextDisabled()"
        (onClick)="goTo(currentPage() + 1)"
      >
        Next
      </ui-button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly currentPage = input<number>(1);
  readonly totalPages = input<number>(1);

  readonly pageChange = output<number>();

  private readonly clampedTotalPages = computed(() => Math.max(1, this.totalPages() || 1));
  private readonly clampedCurrentPage = computed(() => {
    const page = this.currentPage() || 1;
    return Math.min(Math.max(1, page), this.clampedTotalPages());
  });

  isPrevDisabled(): boolean {
    return this.clampedCurrentPage() <= 1;
  }

  isNextDisabled(): boolean {
    return this.clampedCurrentPage() >= this.clampedTotalPages();
  }

  goTo(page: number): void {
    const next = Math.min(Math.max(1, page), this.clampedTotalPages());
    if (next === this.clampedCurrentPage()) return;
    this.pageChange.emit(next);
  }
}
