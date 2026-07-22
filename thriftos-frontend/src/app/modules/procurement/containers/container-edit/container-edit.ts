/**
 * Container Edit Component
 * Phase 2: Procurement UI
 * 
 * Route: /app/procurement/containers/:id/edit
 * 
 * Form to update container logistics, dates, weights, and shipping agent.
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  LucideAngularModule,
  ArrowLeft,
  Save,
  Loader2,
  Truck,
  Anchor,
  Scale,
  Calendar,
} from 'lucide-angular';

import { ProcurementService } from '../../procurement.service';
import { Container, UpdateContainerRequest, UpdateContainerWeightsRequest } from '../../procurement.models';

import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppBreadcrumbComponent,
  AppLoadingComponent,
  AppErrorStateComponent,
  AppAutocompleteComponent,
  type AutocompleteOption,
} from '../../../../shared/ui';

@Component({
  selector: 'app-container-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppBreadcrumbComponent,
    AppLoadingComponent,
    AppErrorStateComponent,
    AppAutocompleteComponent,
  ],
  templateUrl: './container-edit.html',
  styleUrl: './container-edit.scss',
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

  readonly vendors = this.procurementService.activeVendors;

  // Auto-fetch shipping agents and forwarders
  readonly agentVendors = computed(() => {
    const all = this.vendors();
    const shippers = all.filter((v) => v.vendorType === 'SHIPPER');
    return shippers.length > 0 ? shippers : all;
  });

  readonly agentOptions = computed<AutocompleteOption[]>(() => {
    return this.agentVendors().map((v) => ({
      value: v.name,
      label: v.name,
      sublabel: v.country ? `Origin Country: ${v.country}` : 'Registered Agent',
    }));
  });

  readonly containerTypeOptions = [
    { value: '', label: 'Select type' },
    { value: '20ft', label: '20ft Standard' },
    { value: '40ft', label: '40ft Standard' },
    { value: '40HC', label: '40ft High Cube' },
    { value: '45HC', label: '45ft High Cube' },
  ];

  readonly icons = {
    ArrowLeft,
    Save,
    Loader2,
    Truck,
    Anchor,
    Scale,
    Calendar,
  };

  readonly breadcrumbs = computed(() => {
    const cont = this.container();
    const label = cont?.containerNumber || 'Container';
    return [
      { label: 'Procurement', route: '/app/procurement' },
      { label: 'Containers', route: '/app/procurement/containers' },
      { label, route: cont ? `/app/procurement/containers/${cont.id}` : '/app/procurement/containers' },
      { label: 'Edit' },
    ];
  });

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.procurementService.loadVendors().subscribe();
    this.loadContainer();
  }

  private initForm(): void {
    this.form = this.fb.group({
      referenceNumber: ['', Validators.maxLength(50)],
      containerType: [''],
      eta: [''],
      etd: [''],
      arrivedAt: [''],
      clearedAt: [''],
      releasedAt: [''],
      grossWeightKg: [null, [Validators.min(0)]],
      tareWeightKg: [null, [Validators.min(0)]],
      billOfLadingNumber: ['', Validators.maxLength(50)],
      shipmentReference: ['', Validators.maxLength(50)],
      shippingLine: ['', Validators.maxLength(50)],
      vesselName: ['', Validators.maxLength(50)],
      portOfLoading: ['', Validators.maxLength(50)],
      portOfDischarge: ['', Validators.maxLength(50)],
      forwarder: ['', Validators.maxLength(50)],
      notes: ['', Validators.maxLength(500)],
    });
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
          grossWeightKg: container.grossWeight,
          tareWeightKg: container.tareWeight ?? null,
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

    const forwarderName = this.form.value.forwarder?.trim() || undefined;

    // Auto-save forwarder into Vendors database if it's a new agent name
    if (forwarderName) {
      const existingVendor = this.vendors().find(
        (v) => v.name.toLowerCase() === forwarderName.toLowerCase()
      );
      if (!existingVendor) {
        this.procurementService.createVendor({ name: forwarderName, vendorType: 'SHIPPER' }).subscribe();
      }
    }

    const data: UpdateContainerRequest = {
      referenceNumber: this.form.value.referenceNumber?.trim() || undefined,
      containerType: this.form.value.containerType?.trim() || undefined,
      eta: this.normalizeDate(this.form.value.eta),
      etd: this.normalizeDate(this.form.value.etd),
      arrivedAt: this.normalizeDate(this.form.value.arrivedAt),
      clearedAt: this.normalizeDate(this.form.value.clearedAt),
      releasedAt: this.normalizeDate(this.form.value.releasedAt),
      billOfLadingNumber: this.form.value.billOfLadingNumber?.trim() || undefined,
      shipmentReference: this.form.value.shipmentReference?.trim() || undefined,
      shippingLine: this.form.value.shippingLine?.trim() || undefined,
      vesselName: this.form.value.vesselName?.trim() || undefined,
      portOfLoading: this.form.value.portOfLoading?.trim() || undefined,
      portOfDischarge: this.form.value.portOfDischarge?.trim() || undefined,
      forwarder: forwarderName,
      notes: this.form.value.notes?.trim() || undefined,
    };

    const rawGross = this.form.value.grossWeightKg;
    const rawTare = this.form.value.tareWeightKg;

    const currentGross = Number(container.grossWeight);
    const currentTare = container.tareWeight === null || container.tareWeight === undefined ? 0 : Number(container.tareWeight);

    const grossWeightKg = rawGross === '' || rawGross === null || rawGross === undefined ? currentGross : Number(rawGross);
    const tareWeightKg = rawTare === '' || rawTare === null || rawTare === undefined ? 0 : Number(rawTare);

    const requests = [this.procurementService.updateContainer(container.id, data)];

    const hasChanged = grossWeightKg !== currentGross || tareWeightKg !== currentTare;

    if (hasChanged) {
      const weights: UpdateContainerWeightsRequest = { grossWeightKg, tareWeightKg };
      requests.push(this.procurementService.updateContainerWeights(container.id, weights));
    }

    forkJoin(requests).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.router.navigate(['/app/procurement/containers', container.id]);
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
      this.router.navigate(['/app/procurement/containers', container.id]);
      return;
    }
    this.router.navigate(['/app/procurement/containers']);
  }

  private formatDate(value?: string | null): string {
    return value ? value.split('T')[0] : '';
  }

  private normalizeDate(value?: string | null): string | undefined {
    return value ? value : undefined;
  }
}
