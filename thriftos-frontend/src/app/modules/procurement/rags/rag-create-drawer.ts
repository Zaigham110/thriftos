import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { RagService } from './rag.service';
import { Rag } from './rag.models';
import { TenantService } from '../../../core/tenant/tenant.service';

import {
  AppBadgeComponent,
  AppButtonComponent,
  AppCardComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppSelectComponent,
  AppStackComponent,
  AppTextareaComponent,
} from '../../../shared/ui';

@Component({
  selector: 'app-rag-create-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppCardComponent,
    AppStackComponent,
    AppBadgeComponent,
    AppButtonComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppInputComponent,
    AppSelectComponent,
    AppTextareaComponent,
  ],
  template: `
    <app-card>
      <app-stack direction="vertical" spacing="sm">
        <app-stack direction="horizontal" spacing="sm">
          <strong>Add Rag / Bale</strong>
          <app-badge variant="default">{{ containerNumber() }}</app-badge>
        </app-stack>

        <div>
          <app-badge variant="default">Rag code is auto-generated</app-badge>
        </div>

        @if (error()) {
          <div>
            <app-badge variant="danger">{{ error() }}</app-badge>
          </div>
        }

        <app-form
          [formGroup]="form"
          (submitted)="onSubmit()"
          title="Create Rag / Bale"
          subtitle="Fill in type, category, weight."
        >
          <app-form-field label="Type" [required]="true">
            <app-select formControlName="ragBaleType" [options]="typeOptions" />
          </app-form-field>

          <app-form-field label="Category" [required]="true">
            <app-select formControlName="rawCategoryId" [options]="filteredCategoryOptions()" />
            @if (!form.get('ragBaleType')?.value) {
              <div class="muted">Select type first</div>
            }
          </app-form-field>

          <app-form-field label="Weight (kg)" [required]="true">
            <app-input type="number" formControlName="weightKg" placeholder="0.00" />
            @if (availableWeight() !== null) {
              <div class="muted">Available capacity: {{ availableWeight() | number:'1.2-2' }} kg</div>
            }
          </app-form-field>

          <app-form-field label="Notes" hint="Optional">
            <app-textarea formControlName="notes" />
          </app-form-field>

          <app-stack direction="horizontal" spacing="sm">
            <app-button variant="secondary" type="button" (click)="onClose()" [disabled]="loading()">Cancel</app-button>
            <app-button variant="primary" type="submit" [disabled]="form.invalid || loading()">Create</app-button>
          </app-stack>
        </app-form>
      </app-stack>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagCreateDrawerComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ragService = inject(RagService);
  private readonly tenantService = inject(TenantService);

  // Inputs
  readonly containerId = input.required<string>();
  readonly containerNumber = input.required<string>();
  readonly containerNetWeight = input<number>();
  readonly containerCurrentWeight = input<number>();

  // Outputs
  readonly created = output<Rag>();
  readonly closed = output<void>();

  // State
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly allRawCategories = signal<any[]>([]);

  readonly typeOptions = [
    { value: 'RAG', label: 'Rag' },
    { value: 'BALE', label: 'Bale' },
  ];

  readonly filteredCategoryOptions = signal<{ value: string, label: string }[]>([]);

  // Computed
  readonly availableWeight = computed(() => {
    const net = this.containerNetWeight();
    const current = this.containerCurrentWeight();
    if (net === undefined || current === undefined) return null;
    return net - current;
  });

  // Form
  readonly form: FormGroup = this.fb.group({
    ragBaleType: ['', [Validators.required]],
    rawCategoryId: ['', [Validators.required]],
    weightKg: [null, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  ngOnInit(): void {
    // Disable category field initially until type is selected
    this.form.get('rawCategoryId')?.disable();

    // Load all raw categories
    this.tenantService.loadRawCategories().subscribe((cats) => {
      this.allRawCategories.set(cats);
      // If type is already selected, filter categories
      const currentType = this.form.get('ragBaleType')?.value;
      if (currentType) {
        this.updateFilteredCategories(currentType);
        this.form.get('rawCategoryId')?.enable();
      }
    });

    // Watch ragBaleType changes to filter categories
    this.form.get('ragBaleType')?.valueChanges.subscribe((type) => {
      if (type) {
        this.updateFilteredCategories(type);
        // Enable the category field when type is selected
        this.form.get('rawCategoryId')?.enable();
      } else {
        // Disable and clear category field when no type is selected
        this.form.get('rawCategoryId')?.disable();
        this.filteredCategoryOptions.set([]);
      }
      // Reset rawCategoryId when type changes
      this.form.get('rawCategoryId')?.setValue('');
    });
  }

  private updateFilteredCategories(type: string): void {
    if (!type) {
      this.filteredCategoryOptions.set([]);
      return;
    }

    const filtered = this.allRawCategories()
      .filter((c: any) => {
        // Include categories that match the selected type OR are of type BOTH
        return c.isActive && (c.rawType === type || c.rawType === 'BOTH');
      })
      .map((c: any) => ({
        value: c.id,
        label: c.name + (c.rawType === 'BOTH' ? ' (Both)' : ''),
      }));

    this.filteredCategoryOptions.set(filtered);
  }

  onSubmit(): void {
    // Mark all fields as touched to show validation errors
    this.form.markAllAsTouched();

    // Check if form is valid (note: disabled controls are excluded from validation)
    if (this.form.invalid) {
      return;
    }

    // Get raw values to include disabled fields (though they should be enabled when valid)
    const formData = this.form.getRawValue();

    this.loading.set(true);
    this.error.set(null);

    this.ragService
      .createRag(this.containerId(), {
        ragBaleType: formData.ragBaleType,
        rawCategoryId: formData.rawCategoryId,
        weightKg: formData.weightKg,
        notes: formData.notes || undefined,
      })
      .subscribe({
        next: (rag) => {
          this.loading.set(false);
          this.created.emit(rag);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to create rag');
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
