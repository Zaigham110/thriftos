import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProcurementService } from '../../procurement.service';
import { Container, UpdateContainerRequest } from '../../procurement.models';

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
  selector: 'app-container-edit',
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
    AppInputComponent,
    AppSelectComponent,
    AppButtonComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
  ],
  templateUrl: './container-edit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContainerEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly procurementService = inject(ProcurementService);

  readonly container = signal<Container | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly containerTypeOptions = [
    { value: '', label: 'Select type' },
    { value: '20ft', label: '20ft Standard' },
    { value: '40ft', label: '40ft Standard' },
    { value: '40HC', label: '40ft High Cube' },
    { value: '45HC', label: '45ft High Cube' },
  ];

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const cont = this.container();
    const label = cont?.containerNumber || 'Container';
    return [
      { label: 'Home', route: '/dashboard' },
      { label: 'Procurement', route: '/procurement/dashboard' },
      { label: 'Containers', route: '/procurement/containers' },
      { label, route: cont ? `/procurement/containers/${cont.id}` : '/procurement/containers' },
      { label: 'Edit', route: '' },
    ];
  });

  form!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      referenceNumber: ['', Validators.maxLength(50)],
      containerType: [''],
      eta: [''],
      etd: [''],
      arrivedAt: [''],
      clearedAt: [''],
      releasedAt: [''],
      grossWeight: [0, [Validators.required, Validators.min(0)]],
      netWeight: [0, [Validators.required, Validators.min(0)]],
      billOfLadingNumber: ['', Validators.maxLength(50)],
      shipmentReference: ['', Validators.maxLength(50)],
      shippingLine: ['', Validators.maxLength(50)],
      vesselName: ['', Validators.maxLength(50)],
      portOfLoading: ['', Validators.maxLength(50)],
      portOfDischarge: ['', Validators.maxLength(50)],
      forwarder: ['', Validators.maxLength(50)],
      notes: ['', Validators.maxLength(500)],
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
        this.form.patchValue({
          referenceNumber: container.referenceNumber || '',
          containerType: container.containerType || '',
          eta: this.formatDate(container.eta),
          etd: this.formatDate(container.etd),
          arrivedAt: this.formatDate(container.arrivedAt),
          clearedAt: this.formatDate(container.clearedAt),
          releasedAt: this.formatDate(container.releasedAt),
          grossWeight: container.grossWeight,
          netWeight: container.netWeight,
          billOfLadingNumber: container.billOfLadingNumber || '',
          shipmentReference: container.shipmentReference || '',
          shippingLine: container.shippingLine || '',
          vesselName: container.vesselName || '',
          portOfLoading: container.portOfLoading || '',
          portOfDischarge: container.portOfDischarge || '',
          forwarder: container.forwarder || '',
          notes: container.notes || '',
        });
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

    const data: UpdateContainerRequest = {
      referenceNumber: this.form.value.referenceNumber?.trim() || undefined,
      containerType: this.form.value.containerType?.trim() || undefined,
      eta: this.normalizeDate(this.form.value.eta),
      etd: this.normalizeDate(this.form.value.etd),
      arrivedAt: this.normalizeDate(this.form.value.arrivedAt),
      clearedAt: this.normalizeDate(this.form.value.clearedAt),
      releasedAt: this.normalizeDate(this.form.value.releasedAt),
      grossWeight: Number(this.form.value.grossWeight),
      netWeight: Number(this.form.value.netWeight),
      billOfLadingNumber: this.form.value.billOfLadingNumber?.trim() || undefined,
      shipmentReference: this.form.value.shipmentReference?.trim() || undefined,
      shippingLine: this.form.value.shippingLine?.trim() || undefined,
      vesselName: this.form.value.vesselName?.trim() || undefined,
      portOfLoading: this.form.value.portOfLoading?.trim() || undefined,
      portOfDischarge: this.form.value.portOfDischarge?.trim() || undefined,
      forwarder: this.form.value.forwarder?.trim() || undefined,
      notes: this.form.value.notes?.trim() || undefined,
    };

    this.procurementService.updateContainer(container.id, data).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.router.navigate(['/procurement/containers', container.id]);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to update container');
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

  private formatDate(value?: string | null): string {
    return value ? value.split('T')[0] : '';
  }

  private normalizeDate(value?: string | null): string | undefined {
    return value ? value : undefined;
  }
}
