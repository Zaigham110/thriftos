# 📘 Design System Screen Example

This document shows a complete, compliant screen implementation.

---

## ✅ COMPLIANT EXAMPLE

### Inventory Dashboard Screen

```typescript
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// ✅ Import ONLY app-* primitives
import {
  AppPageComponent,
  AppPageHeaderComponent,
  AppPageBodyComponent,
  AppSectionComponent,
  AppSectionHeaderComponent,
  AppSectionBodyComponent,
  AppCardComponent,
  AppTableComponent,
  AppKpiCardComponent,
  AppButtonComponent,
} from '@shared/ui';

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  status: 'in-stock' | 'low' | 'out';
}

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppCardComponent,
    AppTableComponent,
    AppKpiCardComponent,
    AppButtonComponent,
  ],
  template: `
    <!-- ✅ Root: app-page -->
    <app-page>
      
      <!-- ✅ Page Header: Title + Actions -->
      <app-page-header>
        <h1 class="page-title">Inventory Dashboard</h1>
        <div class="actions">
          <app-button variant="secondary" (clickEvent)="exportData()">
            Export
          </app-button>
          <app-button variant="primary" (clickEvent)="addItem()">
            Add Item
          </app-button>
        </div>
      </app-page-header>

      <!-- ✅ Page Body: Contains sections -->
      <app-page-body>
        
        <!-- ✅ Section 1: KPIs -->
        <app-section>
          <app-section-header>
            <h2 class="section-title">Overview</h2>
          </app-section-header>
          
          <!-- ✅ Grid layout with 4 columns for KPIs -->
          <app-section-body class="grid-cols-4">
            <app-kpi-card
              label="Total Items"
              [value]="kpis.totalItems"
              [change]="kpis.totalItemsChange"
              changeType="positive"
            />
            <app-kpi-card
              label="In Stock"
              [value]="kpis.inStock"
            />
            <app-kpi-card
              label="Low Stock"
              [value]="kpis.lowStock"
              [change]="kpis.lowStockChange"
              changeType="negative"
            />
            <app-kpi-card
              label="Out of Stock"
              [value]="kpis.outOfStock"
              [change]="kpis.outOfStockChange"
              changeType="negative"
            />
          </app-section-body>
        </app-section>

        <!-- ✅ Section 2: Data Table -->
        <app-section>
          <app-section-header>
            <h2 class="section-title">Inventory Items</h2>
            <div class="actions">
              <app-button variant="secondary" (clickEvent)="refresh()">
                Refresh
              </app-button>
            </div>
          </app-section-header>

          <app-section-body>
            <!-- ✅ Card wraps table -->
            <app-card variant="data">
              <!-- ✅ Table with loading/empty states -->
              <app-table [loading]="isLoading" [empty]="items.length === 0">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th class="actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let item of items">
                      <td>{{ item.sku }}</td>
                      <td>{{ item.name }}</td>
                      <td>{{ item.quantity }}</td>
                      <td>{{ item.status }}</td>
                      <td class="actions">
                        <app-button 
                          variant="secondary" 
                          (clickEvent)="editItem(item.id)"
                        >
                          Edit
                        </app-button>
                        <app-button 
                          variant="danger" 
                          (clickEvent)="deleteItem(item.id)"
                        >
                          Delete
                        </app-button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </app-table>
            </app-card>
          </app-section-body>
        </app-section>

      </app-page-body>
    </app-page>
  `,
  styles: []  // ✅ NO STYLES - Everything handled by design system
})
export class InventoryDashboardComponent implements OnInit {
  isLoading = true;
  
  kpis = {
    totalItems: 1248,
    totalItemsChange: '+8.2%',
    inStock: 1102,
    lowStock: 89,
    lowStockChange: '+12',
    outOfStock: 57,
    outOfStockChange: '+5',
  };

  items: InventoryItem[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    // ✅ Screens handle data, NOT layout
    this.isLoading = true;
    // Simulate API call
    setTimeout(() => {
      this.items = [
        { id: 1, sku: 'SKU-001', name: 'Item A', quantity: 150, status: 'in-stock' },
        { id: 2, sku: 'SKU-002', name: 'Item B', quantity: 45, status: 'low' },
        { id: 3, sku: 'SKU-003', name: 'Item C', quantity: 0, status: 'out' },
      ];
      this.isLoading = false;
    }, 500);
  }

  addItem(): void {
    console.log('Add item clicked');
  }

  editItem(id: number): void {
    console.log('Edit item:', id);
  }

  deleteItem(id: number): void {
    console.log('Delete item:', id);
  }

  exportData(): void {
    console.log('Export data');
  }

  refresh(): void {
    this.loadData();
  }
}
```

---

## ✅ COMPLIANCE CHECKLIST

```
☑ Used app-page hierarchy
☑ No ad-hoc <div> wrappers
☑ No spacing utilities
☑ No custom colors
☑ Tables use app-table
☑ Cards use allowed variants
☑ Buttons use allowed variants
☑ NO component styles
☑ NO layout decisions
```

---

## ❌ COMMON VIOLATIONS (DO NOT DO THIS)

### ❌ WRONG: Custom Wrapper

```html
<!-- ❌ INVALID -->
<div class="custom-layout p-4 bg-gray-100">
  <div class="flex justify-between mb-6">
    <h1>Title</h1>
  </div>
</div>
```

### ✅ CORRECT: Design System

```html
<!-- ✅ VALID -->
<app-page>
  <app-page-header>
    <h1 class="page-title">Title</h1>
  </app-page-header>
</app-page>
```

---

### ❌ WRONG: Raw Table

```html
<!-- ❌ INVALID -->
<table class="w-full border">
  <thead class="bg-gray-50">
    ...
  </thead>
</table>
```

### ✅ CORRECT: app-table

```html
<!-- ✅ VALID -->
<app-table [loading]="isLoading">
  <table>
    <thead>
      ...
    </thead>
  </table>
</app-table>
```

---

### ❌ WRONG: Custom Button

```html
<!-- ❌ INVALID -->
<button class="px-4 py-2 bg-blue-500 text-white rounded">
  Save
</button>
```

### ✅ CORRECT: app-button

```html
<!-- ✅ VALID -->
<app-button variant="primary" (clickEvent)="save()">
  Save
</app-button>
```

---

### ❌ WRONG: Custom Spacing

```html
<!-- ❌ INVALID -->
<div class="flex gap-4 p-6">
  <div class="mr-3">...</div>
</div>
```

### ✅ CORRECT: Design System Layout

```html
<!-- ✅ VALID -->
<app-section-body class="grid-cols-3">
  <app-card>...</app-card>
  <app-card>...</app-card>
  <app-card>...</app-card>
</app-section-body>
```

---

## 🎯 KEY PRINCIPLES

1. **Screens compose, never design**
2. **All visual decisions locked in primitives**
3. **NO exceptions for individual screens**
4. **Consistency guaranteed by architecture**

---

Every ThriftOS screen should look like this example.  
Boring to implement. Beautiful to use.
