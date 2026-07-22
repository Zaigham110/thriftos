/**
 * Rag Edit Drawer / Embedded Form Component
 * Phase 2: Procurement & Intake UI
 * 
 * Form to update weight and notes for an existing intake rag or bale.
 */

import {
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  Save,
  Loader2,
  Package,
  Layers,
  Scale,
  FileText,
  Lock,
  DollarSign,
  Calendar,
} from 'lucide-angular';

import { RagService } from './rag.service';
import { Rag } from './rag.models';
import { MoneyPipe } from '../../../core/money/money.pipe';

@Component({
  selector: 'app-rag-edit-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    MoneyPipe,
    LucideAngularModule,
  ],
  template: `
    <div class="form-container-card">
      
      <!-- Item Info Summary Card -->
      <div class="item-summary-card">
        <div class="card-header">
          <lucide-icon [img]="icons.Package" [size]="18" class="header-icon"></lucide-icon>
          <div class="header-title">
            <h3>{{ rag().ragCode }}</h3>
            <span class="type-pill">{{ rag().ragBaleType }}</span>
          </div>
        </div>

        <div class="summary-grid-2">
          <div class="summary-item">
            <span class="item-label">Raw Category</span>
            <span class="item-val">{{ rag().rawCategory?.name || 'Unassigned' }}</span>
          </div>

          <div class="summary-item">
            <span class="item-label">Allocated Landed Cost</span>
            <span class="item-val cost-text">{{ rag().allocatedCost | money }}</span>
          </div>

          <div class="summary-item">
            <span class="item-label">Intake Date</span>
            <span class="item-val">{{ rag().createdAt | date:'mediumDate' }}</span>
          </div>

          <div class="summary-item">
            <span class="item-label">Sorting Status</span>
            <span 
              class="status-pill"
              [class.status-pending]="rag().status === 'NOT_STARTED'"
              [class.status-sorting]="rag().status === 'IN_SORTING'"
              [class.status-sorted]="rag().status === 'SORTED'"
            >
              <span class="status-dot"></span>
              {{ rag().status }}
            </span>
          </div>
        </div>
      </div>

      <!-- Locked Banner -->
      @if (rag().status !== 'NOT_STARTED') {
        <div class="locked-banner">
          <lucide-icon [img]="icons.Lock" [size]="16" class="banner-icon"></lucide-icon>
          <span>This item is currently <strong>{{ rag().status }}</strong> and locked for sorting audit integrity.</span>
        </div>
      }

      @if (error()) {
        <div class="error-banner">
          <span>{{ error() }}</span>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="rag-edit-form">
        
        <!-- Weight Input -->
        <div class="form-group">
          <label class="form-label required">Intake Weight (KG)</label>
          <div class="input-with-addon">
            <input
              type="number"
              step="0.01"
              min="0.01"
              formControlName="weightKg"
              class="form-input"
              placeholder="0.00"
            />
            <span class="input-addon font-mono">KG</span>
          </div>
          <span class="field-hint">Updating weight automatically recalculates container landed cost allocations.</span>
        </div>

        <!-- Notes -->
        <div class="form-group">
          <label class="form-label">Notes & Comments</label>
          <textarea
            formControlName="notes"
            class="form-input form-textarea"
            rows="3"
            placeholder="Optional handling notes or batch comments..."
          ></textarea>
        </div>

        <!-- Form Actions -->
        <div class="form-footer-actions">
          <button class="btn btn-secondary" type="button" (click)="onClose()" [disabled]="loading()">
            Cancel
          </button>
          @if (rag().status === 'NOT_STARTED') {
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid || loading() || !form.dirty">
              @if (loading()) {
                <lucide-icon [img]="icons.Loader2" [size]="15" class="animate-spin"></lucide-icon>
                Saving Changes...
              } @else {
                <lucide-icon [img]="icons.Save" [size]="15"></lucide-icon>
                Save Changes
              }
            </button>
          }
        </div>
      </form>
    </div>
  `,
  styleUrl: './rag-edit-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagEditDrawerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ragService = inject(RagService);

  // Inputs
  readonly rag = input.required<Rag>();
  readonly currency = input<string>();

  // Outputs
  readonly updated = output<Rag>();
  readonly closed = output<void>();

  // State
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly icons = {
    Save,
    Loader2,
    Package,
    Layers,
    Scale,
    FileText,
    Lock,
    DollarSign,
    Calendar,
  };

  // Form
  form!: FormGroup;

  ngOnInit(): void {
    const ragData = this.rag();
    this.form = this.fb.group({
      weightKg: [
        { value: ragData.weightKg, disabled: ragData.status !== 'NOT_STARTED' },
        [Validators.required, Validators.min(0.01)],
      ],
      notes: [{ value: ragData.notes || '', disabled: ragData.status !== 'NOT_STARTED' }],
    });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.dirty) return;
    if (this.rag().status !== 'NOT_STARTED') return;

    this.loading.set(true);
    this.error.set(null);

    const { weightKg, notes } = this.form.value;

    this.ragService
      .updateRag(this.rag().id, { weightKg: Number(weightKg), notes: notes?.trim() || undefined })
      .subscribe({
        next: (updatedRag) => {
          this.loading.set(false);
          this.updated.emit(updatedRag);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to update rag item');
          this.loading.set(false);
        },
      });
  }

  onClose(): void {
    this.closed.emit();
  }
}
