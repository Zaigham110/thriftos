import {
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { RagService } from './rag.service';
import { Rag } from './rag.models';

import {
  AppBadgeComponent,
  AppButtonComponent,
  AppCardComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppStackComponent,
  AppTextareaComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-rag-edit-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
    AppCardComponent,
    AppStackComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppTextareaComponent,
  ],
  template: `
    <app-card>
      <app-stack direction="vertical" spacing="sm">
        <app-stack direction="horizontal" spacing="sm">
          <strong>Edit Rag / Bale</strong>
          <app-badge variant="default">{{ rag().ragCode }}</app-badge>
        </app-stack>

        @if (rag().status !== 'NOT_STARTED') {
          <div>
            <app-badge variant="warning">This rag cannot be edited because its status is {{ rag().status }}.</app-badge>
          </div>
        }

        @if (error()) {
          <div>
            <app-badge variant="danger">{{ error() }}</app-badge>
          </div>
        }

        <app-form
          [formGroup]="form"
          (submitted)="onSubmit()"
          title="Update rag"
          subtitle="Only Not Started rags are editable."
        >
          <app-form-field label="Weight (kg)" [required]="true">
            <app-input type="number" formControlName="weightKg" />
          </app-form-field>

          <app-form-field label="Notes" hint="Optional">
            <app-textarea formControlName="notes" />
          </app-form-field>

          <app-card>
            <app-stack direction="vertical" spacing="xs">
              <div><strong>Allocated Cost:</strong> {{ rag().allocatedCost | currency:(currency() || 'USD'):'symbol':'1.2-2' }}</div>
              <div><strong>Created:</strong> {{ rag().createdAt | date:'medium' }}</div>
            </app-stack>
          </app-card>

          <app-stack direction="horizontal" spacing="sm">
            <app-button variant="secondary" type="button" (click)="onClose()" [disabled]="loading()">Cancel</app-button>
            @if (rag().status === 'NOT_STARTED') {
              <app-button variant="primary" type="submit" [disabled]="form.invalid || loading() || !form.dirty">Save</app-button>
            }
          </app-stack>
        </app-form>
      </app-stack>
    </app-card>
  `,
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

  // Form
  form!: FormGroup;

  ngOnInit(): void {
    const ragData = this.rag();
    this.form = this.fb.group({
      weightKg: [{ value: ragData.weightKg, disabled: ragData.status !== 'NOT_STARTED' }, [Validators.required, Validators.min(0.01)]],
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
      .updateRag(this.rag().id, { weightKg, notes: notes || undefined })
      .subscribe({
        next: (updatedRag) => {
          this.loading.set(false);
          this.updated.emit(updatedRag);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to update rag');
          this.loading.set(false);
        },
      });
  }

  onClose(): void {
    this.closed.emit();
  }

  clearError(): void {
    this.error.set(null);
  }
}
