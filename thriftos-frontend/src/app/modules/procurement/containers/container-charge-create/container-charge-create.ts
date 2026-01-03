import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProcurementService } from '../../procurement.service';
import { ChargeType, Container, CreateContainerChargeRequest } from '../../procurement.models';

import {
  AppBreadcrumbComponent,
  AppButtonComponent,
  AppCardComponent,
  AppErrorStateComponent,
  AppFormComponent,
  AppFormFieldComponent,
  AppInputComponent,
  AppLoadingComponent,
  AppPageBodyComponent,
  AppPageComponent,
  AppPageHeaderComponent,
  AppSelectComponent,
  AppStackComponent,
  type BreadcrumbItem,
} from '../../../../shared/ui';

@Component({
  selector: 'app-container-charge-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppStackComponent,
    AppCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppSelectComponent,
    AppInputComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './container-charge-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContainerChargeCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly procurementService = inject(ProcurementService);

  readonly container = signal<Container | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly chargeTypeOptions = [
    { value: 'CIF', label: 'CIF (Cost, Insurance, Freight)' },
    { value: 'FREIGHT', label: 'Freight' },
    { value: 'DUTY', label: 'Duty' },
    { value: 'TAX', label: 'Tax' },
    { value: 'PORT_HANDLING', label: 'Port Handling' },
    { value: 'MISC', label: 'Miscellaneous' },
  ];

  readonly currencyCode = computed(() => this.container()?.purchaseOrder?.currency || 'USD');

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const cont = this.container();
    const label = cont?.containerNumber || 'Container';
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Containers', route: '/procurement/containers' },
      { label, route: cont ? `/procurement/containers/${cont.id}` : '/procurement/containers' },
      { label: 'Add charge', route: '' },
    ];
  });

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      chargeType: ['CIF', Validators.required],
      description: ['', [Validators.required, Validators.maxLength(200)]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
    });

    this.loadContainer();
  }

  loadContainer(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Invalid container ID');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.procurementService.getContainer(id).subscribe({
      next: (container) => {
        this.container.set(container);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load container');
        this.loading.set(false);
      },
    });
  }

  onSubmit(): void {
    const container = this.container();
    if (!container) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.actionLoading.set(true);

    const data: CreateContainerChargeRequest = {
      chargeType: this.form.value.chargeType as ChargeType,
      description: this.form.value.description.trim(),
      amount: Number(this.form.value.amount),
    };

    this.procurementService.addContainerCharge(container.id, data).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.router.navigate(['/procurement/containers', container.id]);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to add charge');
        this.actionLoading.set(false);
      },
    });
  }

  onCancel(): void {
    const container = this.container();
    if (container) {
      this.router.navigate(['/procurement/containers', container.id]);
      return;
    }
    this.router.navigate(['/procurement/containers']);
  }
}
