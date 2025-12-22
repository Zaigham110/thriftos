/**
 * Not Found Page - 404 Page Not Found
 * Phase 1: Authentication & Shell
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, FileQuestion, ArrowLeft } from 'lucide-angular';
import { ButtonComponent } from '../../../shared/ui/button/button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, ButtonComponent],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  protected readonly icons = {
    FileQuestion,
    ArrowLeft,
  };
}
