import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, ChevronRight } from 'lucide-angular';

export interface BreadcrumbItem {
  label: string;
  link?: string;
}

@Component({
  selector: 'ui-breadcrumb, app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  readonly items = input<BreadcrumbItem[]>([]);

  protected readonly separatorIcon = ChevronRight;

  isLast(index: number): boolean {
    return index === this.items().length - 1;
  }
}
