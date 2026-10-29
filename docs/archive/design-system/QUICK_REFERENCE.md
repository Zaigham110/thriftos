# 📋 ThriftOS Design System - Quick Reference

**Version:** 1.0.0 | **Status:** LOCKED

---

## 🎨 TOKENS

### Colors
```scss
--app-bg-page: #f8fafc;          // Page background
--app-bg-surface: #ffffff;        // Cards, surfaces
--app-border-subtle: #e5e7eb;     // Borders
--app-text-primary: #0f172a;      // Primary text
--app-text-secondary: #475569;    // Secondary text
--app-primary: #2563eb;           // Primary actions
--app-success: #16a34a;           // Success
--app-warning: #d97706;           // Warning
--app-danger: #dc2626;            // Danger
```

### Typography
| Usage         | Size | Weight |
| ------------- | ---- | ------ |
| Page Title    | 20px | 600    |
| Section Title | 16px | 600    |
| Body          | 14px | 400    |
| Table         | 13px | 400    |
| Meta          | 12px | 400    |

### Spacing
```
4px · 8px · 12px · 16px · 24px · 32px
```

---

## 🧩 PRIMITIVES

### Layout
```
app-page
├─ app-page-header
└─ app-page-body
   └─ app-section
      ├─ app-section-header
      └─ app-section-body
```

### Components
- **Container:** `app-card` (variants: data | info)
- **Table:** `app-table`
- **KPI:** `app-kpi-card`
- **Form:** `app-form` + `app-form-field`
- **Button:** `app-button` (variants: primary | secondary | danger)

---

## ✅ TEMPLATE

```html
<app-page>
  <app-page-header>
    <h1 class="page-title">Title</h1>
    <div class="actions">
      <app-button variant="primary">Action</app-button>
    </div>
  </app-page-header>

  <app-page-body>
    <app-section>
      <app-section-header>
        <h2 class="section-title">Section</h2>
      </app-section-header>
      
      <app-section-body class="grid-cols-4">
        <app-kpi-card label="Total" value="100" />
      </app-section-body>
    </app-section>

    <app-section>
      <app-section-header>
        <h2 class="section-title">Data</h2>
      </app-section-header>
      
      <app-section-body>
        <app-card variant="data">
          <app-table>
            <table>...</table>
          </app-table>
        </app-card>
      </app-section-body>
    </app-section>
  </app-page-body>
</app-page>
```

---

## 🚫 FORBIDDEN

- ❌ Custom styles in components
- ❌ Spacing utilities (p-*, m-*, gap-*)
- ❌ Inline styles
- ❌ Raw `<table>`, `<form>`, `<button>`
- ❌ ui-* component imports
- ❌ Custom colors
- ❌ Font overrides
- ❌ Layout wrappers outside primitives

---

## 📦 IMPORTS

```typescript
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
  AppFormComponent,
  AppFormFieldComponent,
  AppButtonComponent,
} from '@shared/ui';
```

---

## ✅ PRE-COMMIT CHECK

```
☐ Empty styles array
☐ Uses app-page hierarchy
☐ No spacing utilities
☐ No inline styles
☐ Only app-* imports
☐ Tables wrapped in app-table
☐ Buttons are app-button
```

---

**Print this. Keep it visible. Ship beautiful UIs.**
