# 🔒 ThriftOS Design System

**Version:** 1.0.0  
**Status:** LOCKED  
**Last Updated:** December 24, 2025

---

## ⚠️ CRITICAL RULES

### ABSOLUTE PROHIBITIONS

The following are **FORBIDDEN** in all ThriftOS screens:

1. ❌ **No screen-level styling** - All visual decisions locked in design system
2. ❌ **No per-page layout logic** - Use app-* primitives ONLY
3. ❌ **No ad-hoc spacing, colors, or fonts** - Use CSS tokens ONLY
4. ❌ **No raw HTML tables, forms, inputs** - Use app-* wrappers ONLY
5. ❌ **No ui-* primitives** - ONLY app-* components allowed
6. ❌ **No dark theme** - Light ERP aesthetic ONLY
7. ❌ **No gradients, illustrations, or visual experiments**

### ENFORCEMENT

**If ANY screen violates these rules, it MUST be rejected.**

Visual consistency is guaranteed by design, not by discipline.

---

## 🎨 DESIGN TOKENS

### Color System (LOCKED)

All colors defined in `_tokens.scss`:

#### Backgrounds
```scss
--app-bg-page: #f8fafc;        // slate-50 - Page background
--app-bg-surface: #ffffff;      // Pure white - Cards, surfaces
```

#### Borders
```scss
--app-border-subtle: #e5e7eb;   // gray-200
--app-border-strong: #cbd5e1;   // slate-300
```

#### Text Hierarchy
```scss
--app-text-primary: #0f172a;    // slate-900 - Primary text
--app-text-secondary: #475569;  // slate-600 - Secondary text
--app-text-muted: #94a3b8;      // slate-400 - Muted text
```

#### Accent Colors
```scss
--app-primary: #2563eb;         // blue-600 - Primary actions
--app-success: #16a34a;         // green-600 - Success states
--app-warning: #d97706;         // amber-600 - Warning states
--app-danger: #dc2626;          // red-600 - Danger actions
```

**🚫 NO additional colors allowed**  
**🚫 NO inline color usage in components**

---

### Typography Scale (LOCKED)

#### Font Family
```scss
--font-family: 'Inter', -apple-system, sans-serif;
```

#### Scale (Fixed Sizes)

| Usage         | Size | Weight | Token                        |
| ------------- | ---- | ------ | ---------------------------- |
| Page Title    | 20px | 600    | `--font-size-page-title`     |
| Section Title | 16px | 600    | `--font-size-section-title`  |
| Body          | 14px | 400    | `--font-size-body`           |
| Table Header  | 13px | 500    | `--font-size-table-header`   |
| Table Cell    | 13px | 400    | `--font-size-table-cell`     |
| Meta / Hint   | 12px | 400    | `--font-size-meta`           |

**🚫 NO font overrides per screen**  
**🚫 NO font-family changes**

---

### Spacing Scale (ABSOLUTE)

**ONLY these values may exist:**

```scss
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 24px;
--space-2xl: 32px;
```

**🚫 Screens MUST NOT apply spacing utilities**  
**🚫 NO arbitrary spacing values (no `padding: 15px` etc.)**

---

## 📐 LAYOUT GRAMMAR (MANDATORY)

### Authoritative Hierarchy

**ALL screens MUST follow this structure:**

```html
<app-page>
  <app-page-header>
    <h1 class="page-title">Page Title</h1>
    <div class="actions">
      <app-button variant="primary">Action</app-button>
    </div>
  </app-page-header>
  
  <app-page-body>
    <app-section>
      <app-section-header>
        <h2 class="section-title">Section Title</h2>
      </app-section-header>
      
      <app-section-body>
        <!-- ONLY: app-card | app-table | app-kpi-card | app-form -->
        <app-card variant="data">
          <app-table>...</app-table>
        </app-card>
      </app-section-body>
    </app-section>
  </app-page-body>
</app-page>
```

**🚫 NO content outside `app-section-body`**  
**🚫 NO arbitrary `<div>` wrappers**

---

### Grid & Flex Rules

* **Page layout** → CSS Grid ONLY
* **Section body** → CSS Grid ONLY
* **Flexbox allowed ONLY for:**
  * Button groups
  * Inline icon + text
  * Small horizontal controls

**🚫 Flexbox for layout = INVALID**

---

## 🧩 APP-* PRIMITIVES (COMPLETE LIST)

### Layout Primitives

| Component              | Purpose                    | File Location                                  |
| ---------------------- | -------------------------- | ---------------------------------------------- |
| `<app-page>`           | Root page container        | `shared/ui/page/app-page.component.ts`         |
| `<app-page-header>`    | Page title + actions       | `shared/ui/page-header/`                       |
| `<app-page-body>`      | Main scrollable area       | `shared/ui/page-body/`                         |
| `<app-section>`        | Content grouping           | `shared/ui/section/app-section.component.ts`   |
| `<app-section-header>` | Section title + actions    | `shared/ui/section-header/`                    |
| `<app-section-body>`   | Section content (CSS Grid) | `shared/ui/section-body/`                      |

### Container Primitives

| Component   | Variants       | Purpose                   | File Location                          |
| ----------- | -------------- | ------------------------- | -------------------------------------- |
| `<app-card>` | `data` \| `info` | Surface container         | `shared/ui/card/app-card.component.ts` |

**Variants:**
* `data` (default) - Tables, forms, content
* `info` - Informational content, help text

### Data Primitives

| Component        | Purpose           | File Location                                  |
| ---------------- | ----------------- | ---------------------------------------------- |
| `<app-table>`    | Table wrapper     | `shared/ui/table/app-table.component.ts`       |
| `<app-kpi-card>` | KPI display (120px) | `shared/ui/kpi-card/app-kpi-card.component.ts` |

### Form Primitives

| Component          | Purpose         | File Location                                        |
| ------------------ | --------------- | ---------------------------------------------------- |
| `<app-form>`       | Form container  | `shared/ui/form/app-form.component.ts`               |
| `<app-form-field>` | Field wrapper   | `shared/ui/form-field/app-form-field.component.ts`   |

### Action Primitives

| Component      | Variants                             | Purpose | File Location                                  |
| -------------- | ------------------------------------ | ------- | ---------------------------------------------- |
| `<app-button>` | `primary` \| `secondary` \| `danger` | Buttons | `shared/ui/button/app-button.component.ts`     |

---

## 📋 COMPONENT CONTRACTS

### app-page

**Contract:**
* Full viewport height
* Background: `var(--app-bg-page)`
* Display: flex column

**Usage:**
```html
<app-page>
  <app-page-header />
  <app-page-body>...</app-page-body>
</app-page>
```

---

### app-page-header

**Contract:**
* Height: 64px
* Padding: `var(--page-padding)`
* Background: `var(--app-bg-surface)`
* Border bottom: `var(--app-border-subtle)`

**Usage:**
```html
<app-page-header>
  <h1 class="page-title">Dashboard</h1>
  <div class="actions">
    <app-button variant="primary">New Item</app-button>
  </div>
</app-page-header>
```

---

### app-section-body

**Contract:**
* Display: CSS Grid
* Gap: `var(--space-lg)`
* Default: 1 column

**Grid Utilities:**
```html
<app-section-body class="grid-cols-2">...</app-section-body>
<app-section-body class="grid-cols-3">...</app-section-body>
<app-section-body class="grid-cols-4">...</app-section-body>
<app-section-body class="grid-cols-auto">...</app-section-body>
```

---

### app-card

**Contract:**
* Background: `var(--app-bg-surface)`
* Border: 1px solid `var(--app-border-subtle)`
* Padding: `var(--card-padding)`
* Shadow: `var(--shadow-sm)`

**Usage:**
```html
<!-- Data card (default) -->
<app-card variant="data">
  <app-table>...</app-table>
</app-card>

<!-- Info card -->
<app-card variant="info">
  <p>Helpful information text</p>
</app-card>
```

---

### app-table

**Contract:**
* Header: 13px, 500 weight, slate-600
* Cell: 13px, 400 weight, slate-900
* Row height: 48px
* Hover: slate-50
* Handles empty/loading states

**Usage:**
```html
<app-table [loading]="isLoading" [empty]="items.length === 0">
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Status</th>
        <th class="actions">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let item of items">
        <td>{{ item.name }}</td>
        <td>{{ item.status }}</td>
        <td class="actions">
          <app-button variant="secondary">Edit</app-button>
        </td>
      </tr>
    </tbody>
  </table>
</app-table>
```

---

### app-kpi-card

**Contract:**
* Height: 120px (FIXED)
* Display: flex column
* NO charts allowed inside
* Structure: label + value + optional change

**Usage:**
```html
<app-kpi-card
  label="Total Revenue"
  value="$125,000"
  change="+12.5%"
  changeType="positive"
/>
```

---

### app-form & app-form-field

**Contract:**
* Form max-width: 600px
* Field gap: `var(--space-lg)`
* Label: 13px, 500 weight
* Required indicator: red asterisk
* Error/hint: 12px

**Usage:**
```html
<app-form>
  <app-form-field 
    label="Username" 
    [required]="true"
    [error]="errors.username"
    hint="Must be unique"
  >
    <input type="text" formControlName="username" />
  </app-form-field>
  
  <div class="form-actions">
    <app-button variant="primary" type="submit">Save</app-button>
    <app-button variant="secondary">Cancel</app-button>
  </div>
</app-form>
```

---

### app-button

**Contract:**
* Height: 36px
* Padding: 0 16px
* Font: 14px, 500 weight
* Border radius: 4px

**Variants:**
* `primary` - Blue, white text - Main actions
* `secondary` - White, gray text - Alternative actions
* `danger` - Red, white text - Destructive actions

**Usage:**
```html
<app-button variant="primary" (clickEvent)="save()">
  Save Changes
</app-button>

<app-button variant="danger" [disabled]="!canDelete" (clickEvent)="delete()">
  Delete Item
</app-button>
```

---

## 🛡️ SCREEN AUTHORING RULES

### Screens MAY:
* Bind data
* Call APIs
* Control visibility
* Handle state management

### Screens MUST NOT:
* Decide layout (use app-* primitives)
* Apply spacing utilities
* Define colors (use CSS tokens)
* Change typography
* Create custom wrappers

---

## ✅ MANDATORY SELF-CHECK

Before committing any screen code:

```
DESIGN SYSTEM COMPLIANCE:
☐ Used app-page hierarchy
☐ No ad-hoc <div> wrappers
☐ No spacing utilities (p-*, m-*, gap-*)
☐ No custom colors (only CSS tokens)
☐ Tables use app-table
☐ Cards use allowed variants only
☐ Buttons use allowed variants only
☐ No raw form inputs (all wrapped in app-form-field)
```

**If ANY item fails → DO NOT COMMIT**

---

## 🚀 MIGRATION PATH

For existing screens:

1. Replace root `<div>` → `<app-page>`
2. Wrap title + actions → `<app-page-header>`
3. Wrap content → `<app-page-body>` + `<app-section>`
4. Replace tables → `<app-table>`
5. Replace forms → `<app-form>` + `<app-form-field>`
6. Replace buttons → `<app-button>`
7. Remove ALL spacing utilities
8. Remove ALL inline colors
9. Run compliance check

---

## 📦 IMPORT EXAMPLE

```typescript
import { AppPageComponent } from '@shared/ui/page/app-page.component';
import { AppPageHeaderComponent } from '@shared/ui/page-header/app-page-header.component';
import { AppPageBodyComponent } from '@shared/ui/page-body/app-page-body.component';
import { AppSectionComponent } from '@shared/ui/section/app-section.component';
import { AppSectionHeaderComponent } from '@shared/ui/section-header/app-section-header.component';
import { AppSectionBodyComponent } from '@shared/ui/section-body/app-section-body.component';
import { AppCardComponent } from '@shared/ui/card/app-card.component';
import { AppTableComponent } from '@shared/ui/table/app-table.component';
import { AppKpiCardComponent } from '@shared/ui/kpi-card/app-kpi-card.component';
import { AppFormComponent } from '@shared/ui/form/app-form.component';
import { AppFormFieldComponent } from '@shared/ui/form-field/app-form-field.component';
import { AppButtonComponent } from '@shared/ui/button/app-button.component';

@Component({
  standalone: true,
  imports: [
    AppPageComponent,
    AppPageHeaderComponent,
    AppPageBodyComponent,
    AppSectionComponent,
    AppSectionHeaderComponent,
    AppSectionBodyComponent,
    AppCardComponent,
    AppTableComponent,
    AppKpiCardComponent,
    AppFormComponent,
    AppFormFieldComponent,
    AppButtonComponent,
  ]
})
export class MyScreenComponent { }
```

---

## 🎯 FINAL GOAL

> **Visual consistency is guaranteed by design, not by discipline.**

Screens should be boring to implement — and beautiful to use.

Every ThriftOS screen should look like the same premium product.

---

## 📞 SUPPORT

For design system questions or exceptions:
* Contact: Principal Product Designer
* Rule Exception Process: Requires architecture review
* NO exceptions for individual screens

**The system is locked. The system is the law.**
