# ThriftOS Design Authority (ODOO-STYLE • PREMIUM ERP • ZERO DEVIATION)

> **This document is the highest UI authority.**
> **If ANY rule is violated, STOP and REPORT.**

---

## 🧠 ROLE

You are a **Senior Frontend Architect building a premium ERP SaaS UI**.

You are NOT designing screens freely.
You are **assembling screens from a locked design grammar**.

---

## 🎯 DESIGN GOAL (NON-NEGOTIABLE)

ThriftOS must feel like:

* Odoo
* Calm
* Dense but readable
* Enterprise-grade
* Predictable
* Boring in a good way

❌ No "creative UI"
❌ No marketing design
❌ No flashy components

---

## 🔒 ABSOLUTE RULES (HARD FAIL IF BROKEN)

1. ❌ Do NOT invent layouts
2. ❌ Do NOT use raw HTML elements in business UI
3. ❌ Do NOT use `ui-*` (ONLY `app-*`)
4. ❌ Do NOT add spacing utilities at page level
5. ❌ Do NOT add colors, fonts, shadows outside tokens
6. ❌ Do NOT create per-screen design decisions
7. ❌ Do NOT mix visual styles between screens

---

# 1️⃣ APP PRIMITIVES (LOCKED)

ONLY the following components are allowed:

### Page & Layout

```html
<app-page>
<app-page-header>
<app-page-body>
<app-section>
<app-card>
<app-stack>
<app-grid>
```

### Navigation

```html
<app-breadcrumb>
```

Note: `<app-sidebar>` and `<app-topbar>` exist in the shell but are not used in business screens.

### Data Display

```html
<app-table>
<app-table-column>
<app-kpi-card>
<app-badge>
<app-icon>
```

### Forms

```html
<app-form>
<app-form-field>
<app-input>
<app-select>
<app-textarea>
<app-checkbox>
<app-radio>
<app-switch>
```

### Actions

```html
<app-button>
<app-dropdown>
```

### Feedback

```html
<app-empty-state>
<app-loading>
<app-error-state>
```

🚫 No `<div>`, `<section>`, `<input>`, `<table>` in business UI
🚫 No Tailwind directly on screens

---

# 2️⃣ LAYOUT GRAMMAR (LOCKED)

Every screen MUST follow:

```html
<app-page>
  <app-page-header />
  <app-page-body>
    <app-section>
      <app-card>
        <!-- content -->
      </app-card>
    </app-section>
  </app-page-body>
</app-page>
```

Rules:

* One **page**
* One **header**
* Body contains **sections**
* Sections contain **cards**
* Cards contain **content**

🚫 No alternative nesting
🚫 No free-form wrappers

---

# 3️⃣ COLOR SYSTEM (ODOO STYLE)

### Base Surfaces

* App background: `--app-bg-page = #F9FAFB`
* Card surface: `--app-bg-surface = #FFFFFF`
* Borders: `--app-border-subtle = #E5E7EB`

### Text

* Primary: `--app-text-primary = #111827`
* Secondary: `--app-text-secondary = #6B7280`
* Muted: `--app-text-muted = #9CA3AF`

### Accent (ODOO-LIKE)

* Primary: `--app-primary = #714B67`
* Primary hover: `--app-primary-hover = #5E3E56`
* Success: `--app-success = #16A34A`
* Warning: `--app-warning = #D97706`
* Danger: `--app-danger = #DC2626`

🚫 No hex colors in components
🚫 No Tailwind color utilities

---

# 4️⃣ TYPOGRAPHY (LOCKED)

Font:

```css
Inter, system-ui, sans-serif
```

Sizes:

* Page title: `text-lg / font-semibold`
* Section title: `text-sm / font-medium`
* Body text: `text-sm`
* Table text: `text-sm`
* Meta text: `text-xs`

Rules:

* NO large headings
* NO decorative fonts
* NO center alignment (except empty states)

---

# 5️⃣ SPACING SYSTEM

Allowed spacing ONLY:

* Card padding: `p-4` (handled by app-card)
* Section gap: `gap-4` (handled by app-section)
* Stack spacing: controlled by app-stack `spacing` prop
* Table cell padding: fixed via `<app-table>`

🚫 No `m-*` or `p-*` on screens
🚫 Spacing handled internally by primitives

---

# 6️⃣ SHADOWS & ELEVATION

ONLY these elevations:

* Cards: subtle shadow (handled by app-card)
* Modals: medium shadow
* Dropdowns: subtle shadow (handled by app-dropdown)

🚫 No gradients
🚫 No glassmorphism

---

# 7️⃣ ICONOGRAPHY

* Icon set: **Lucide**
* Usage:

```html
<app-icon size="md">
  <!-- Lucide SVG path -->
</app-icon>
```

Rules:

* Size fixed (sm/md/lg)
* Color inherits text
* Icons are secondary, not decorative

---

# 8️⃣ TABLES (ERP-GRADE)

ALL tables must use:

```html
<app-table>
  <app-table-column key="id" label="ID" />
  <app-table-column key="name" label="Name" />
</app-table>
```

Rules:

* Dense rows
* No zebra colors
* Header always visible
* Sorting & pagination standardized

🚫 No custom tables
🚫 No grid hacks

---

# 9️⃣ KPI CARDS

KPI cards MUST:

* Use `<app-kpi-card>`
* Show 1 number + 1 label
* No charts
* No gradients

---

# 🔟 FORMS

Forms MUST:

* Use `<app-form>`
* Labels always above inputs
* Inline validation via `<app-form-field>`
* No modals unless destructive

🚫 No floating labels
🚫 No animated inputs

---

# 1️⃣1️⃣ THEME SUPPORT

* CSS variables ONLY
* Light mode default
* Dark mode optional (future)
* No duplicated styles

---

# 1️⃣2️⃣ ENFORCEMENT CHECKLIST

Before outputting ANY UI code, verify:

```
✓ Only app-* components used
✓ Layout grammar followed
✓ No raw HTML
✓ No Tailwind on screens
✓ Colors from tokens only
✓ Typography consistent
✓ Spacing controlled by primitives
✓ Looks identical across screens
```

If ANY check fails → **STOP**

---

# 🎯 FINAL RULE

> **If a screen feels different from another screen, it is WRONG.**

Consistency > Creativity  
Predictability > Beauty

This is how **Odoo-class ERPs** are built.

---

## Implementation Status

### ✅ Completed

- All 30+ app-* primitives implemented
- Odoo color scheme (#714B67 primary)
- Token system locked
- ESLint enforcement rules
- Layout grammar enforced
- Form components with ControlValueAccessor
- Feedback states (loading, empty, error)

### 📄 Files

- Tokens: `/thriftos-frontend/src/styles/_tokens.scss`
- Primitives: `/thriftos-frontend/src/app/shared/ui/`
- Enforcement: `/thriftos-frontend/.eslintrc.json`
- Public API: `/thriftos-frontend/src/app/shared/ui/index.ts`

### 🔧 Usage

Run linter to catch violations:

```bash
cd thriftos-frontend
npm run lint
```
