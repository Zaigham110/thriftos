/**
 * Rag Create Drawer / Embedded Form Component
 * Phase 2: Procurement & Intake UI
 * 
 * Form to register a new intake rag or bale linked to a specific container.
 */

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
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  Save,
  Loader2,
  Package,
  Layers,
  Scale,
  FileText,
  Info,
} from 'lucide-angular';

import { RagService } from './rag.service';
import { Rag } from './rag.models';
import { TenantService } from '../../../core/tenant/tenant.service';

@Component({
  selector: 'app-rag-create-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DecimalPipe,
    LucideAngularModule,
  ],
  template: `
    <div class="form-container-card">
      
      <!-- Capacity Summary Card -->
      <div class="capacity-info-card">
        <div class="capacity-header">
          <lucide-icon [img]="icons.Scale" [size]="16" class="header-icon"></lucide-icon>
          <span class="capacity-title">Container Intake Capacity</span>
        </div>
        <div class="capacity-stats">
          <div class="stat-item">
            <span class="stat-label">Net Target Weight</span>
            <span class="stat-val">{{ containerNetWeight() ? (containerNetWeight()! | number:'1.2-2') : '0.00' }} KG</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Logged Weight</span>
            <span class="stat-val">{{ containerCurrentWeight() ? (containerCurrentWeight()! | number:'1.2-2') : '0.00' }} KG</span>
          </div>
          <div class="stat-item highlight">
            <span class="stat-label">Remaining Capacity</span>
            <span class="stat-val">{{ availableWeight() !== null ? (availableWeight()! | number:'1.2-2') : '0.00' }} KG</span>
          </div>
        </div>
      </div>

      @if (error()) {
        <div class="error-banner">
          <span>{{ error() }}</span>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="rag-create-form">
        
        <!-- Type Selection Segmented Toggle -->
        <div class="form-group">
          <label class="form-label required">Intake Item Type</label>
          <div class="type-toggle-group">
            <button
              type="button"
              class="toggle-btn"
              [class.active]="form.get('ragBaleType')?.value === 'RAG'"
              (click)="selectType('RAG')"
            >
              <lucide-icon [img]="icons.Package" [size]="14"></lucide-icon>
              Loose Rag
            </button>
            <button
              type="button"
              class="toggle-btn"
              [class.active]="form.get('ragBaleType')?.value === 'BALE'"
              (click)="selectType('BALE')"
            >
              <lucide-icon [img]="icons.Layers" [size]="14"></lucide-icon>
              Compressed Bale
            </button>
          </div>
        </div>

        <!-- Category Select -->
        <div class="form-group">
          <label class="form-label required">Raw Material Category</label>
          <select formControlName="rawCategoryId" class="form-select">
            <option value="">Select Raw Material Category...</option>
            @for (cat of filteredCategoryOptions(); track cat.value) {
              <option [value]="cat.value">{{ cat.label }}</option>
            }
          </select>
          <span class="field-hint">Select the raw category classification for landed cost allocation.</span>
        </div>

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
          <span class="field-hint">Actual measured weight at warehouse intake.</span>
        </div>

        <!-- Notes -->
        <div class="form-group">
          <label class="form-label">Notes & Comments</label>
          <textarea
            formControlName="notes"
            class="form-input form-textarea"
            rows="2"
            placeholder="Optional handling notes or batch comments..."
          ></textarea>
        </div>

        <!-- Form Actions -->
        <div class="form-footer-actions">
          <button class="btn btn-secondary" type="button" (click)="onClose()" [disabled]="loading()">
            Cancel
          </button>
          <button class="btn btn-primary" type="submit" [disabled]="form.invalid || loading()">
            @if (loading()) {
              <lucide-icon [img]="icons.Loader2" [size]="15" class="animate-spin"></lucide-icon>
              Saving Item...
            } @else {
              <lucide-icon [img]="icons.Save" [size]="15"></lucide-icon>
              Register Intake Item
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styleUrl: './rag-create-drawer.scss',
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
  readonly filteredCategoryOptions = signal<{ value: string; label: string }[]>([]);

  readonly icons = {
    Save,
    Loader2,
    Package,
    Layers,
    Scale,
    FileText,
    Info,
  };

  // Computed
  readonly availableWeight = computed(() => {
    const net = this.containerNetWeight();
    const current = this.containerCurrentWeight();
    if (net === undefined || current === undefined) return null;
    return Math.max(0, net - current);
  });

  // Form
  readonly form: FormGroup = this.fb.group({
    ragBaleType: ['RAG', [Validators.required]],
    rawCategoryId: ['', [Validators.required]],
    weightKg: [null, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  ngOnInit(): void {
    // Load raw categories
    this.tenantService.loadRawCategories().subscribe({
      next: (cats) => {
        this.allRawCategories.set(cats);
        this.updateFilteredCategories(this.form.get('ragBaleType')?.value || 'RAG');
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load raw categories');
      },
    });

    // Watch type changes to update filtered categories
    this.form.get('ragBaleType')?.valueChanges.subscribe((type) => {
      this.updateFilteredCategories(type);
      this.form.get('rawCategoryId')?.setValue('');
    });
  }

  selectType(type: 'RAG' | 'BALE'): void {
    this.form.get('ragBaleType')?.setValue(type);
  }

  private updateFilteredCategories(type: string): void {
    if (!type) {
      this.filteredCategoryOptions.set([]);
      return;
    }

    const filtered = this.allRawCategories()
      .filter((c: any) => c.isActive && (c.rawType === type || c.rawType === 'BOTH'))
      .map((c: any) => ({
        value: c.id,
        label: `${c.name} (${c.rawType})`,
      }));

    this.filteredCategoryOptions.set(filtered);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const formData = this.form.getRawValue();

    this.loading.set(true);
    this.error.set(null);

    this.ragService
      .createRag(this.containerId(), {
        ragBaleType: formData.ragBaleType,
        rawCategoryId: formData.rawCategoryId,
        weightKg: Number(formData.weightKg),
        notes: formData.notes?.trim() || undefined,
      })
      .subscribe({
        next: (rag) => {
          this.loading.set(false);
          this.created.emit(rag);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to create rag item');
          this.loading.set(false);
        },
      });
  }

  onClose(): void {
    this.closed.emit();
  }
}
