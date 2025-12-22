You are an **elite enterprise Angular 21 architect and design-system engineer**.

You are implementing **Frontend Phase 0** for **ThriftOS**, a **multi-tenant ERP SaaS for the thrift industry**.

This phase establishes the **entire frontend foundation**:

* Angular project initialization
* Styling architecture (SCSS + Tailwind)
* Design system (ThriftUI)
* Typography & icons
* Layout primitives
* Login screen visual foundation
* AI-agent rules
* Backend feature coverage enforcement

🚫 NO business logic
🚫 NO API calls
🚫 NO feature screens
🚫 NO assumptions

Everything built here is reused across **all future frontend phases**.

---

## 🔒 ABSOLUTE RULE — BACKEND COVERAGE GUARANTEE

Before implementing **any** frontend phase (including this one), the AI agent MUST:

1. Read:

   * `docs/architecture/backend-feature-register.md`
   * `docs/architecture/frontend-backend-coverage-matrix.md`
2. Acknowledge that **Frontend Phase 0 contains no business screens**
3. Mark all backend features as:

   * `UI_PENDING (future phase)`
4. Fail if any backend feature is silently ignored

This rule applies to **all future phases**.

---

## 🧠 CORE UI PHILOSOPHY (LOCKED)

ThriftOS UI must feel:

* Professional
* Calm
* Enterprise-grade
* Trustworthy
* Data-dense but readable
* Suitable for long daily usage

🚫 No dark dashboards
🚫 No flashy gradients
🚫 No neon colors
🚫 No “startup-style” gimmicks

Think:

> **SAP Fiori + Stripe Admin + Linear (ERP mode)**

---

## 🧱 TECH STACK (LOCKED)

* **Angular 21**
* **Angular CLI (MANDATORY)**
* **Standalone components ONLY**
* **SCSS as primary styling layer**
* **TailwindCSS for utilities**
* **Lucide Angular icons**
* **Inter font**
* Signals for UI state
* Typed Reactive Forms

🚫 NgModules
🚫 NgRx
🚫 Font Awesome
🚫 Inline styles
🚫 Dark theme support

---

## ⚙️ PROJECT INITIALIZATION (MANDATORY)

Create the project **only** using Angular CLI:

```bash
ng new thriftos-frontend \
  --standalone \
  --routing \
  --style=scss \
  --strict
```

🚫 No alternative scaffolding
🚫 No manual folder creation

---

## 🎨 DESIGN SYSTEM — COLORS (LIGHT ERP ONLY)

### Backgrounds

```txt
App Background:        #F8FAFC   (slate-50)
Section Background:    #F1F5F9   (slate-100)
Card Background:       #FFFFFF
Border / Divider:      #E2E8F0   (slate-200)
```

### Brand

```txt
Primary:               #2563EB
Primary Hover:         #1D4ED8
Primary Soft:          #DBEAFE
```

### Text

```txt
Primary Text:          #0F172A
Secondary Text:        #475569
Muted Text:            #64748B
```

### Status (Muted, ERP-safe)

```txt
Success:               #16A34A
Warning:               #F59E0B
Danger:                #DC2626
Info:                  #0284C7
```

🚫 No gradients
🚫 No dark panels

---

## 🔤 TYPOGRAPHY (LOCKED)

### Font

* **Inter**
* Fallback: `system-ui`

### Scale

```txt
Page Title:        text-2xl font-semibold
Section Title:     text-lg font-semibold
Card Title:        text-base font-medium
Body Text:         text-sm
Table Text:        text-sm
Meta / Label:      text-xs
```

🚫 Decorative fonts
🚫 Oversized headings

---

## 🧩 ICONOGRAPHY (MANDATORY)

### Icon Library

**Lucide Angular**

```bash
npm install lucide-angular
```

Rules:

* Single icon library
* Stroke-based icons only
* Icons always secondary to text
* Standard sizes: `w-4 h-4`, `w-5 h-5`

🚫 Font Awesome
🚫 Mixed icon sets

---

## 📐 SPACING & LAYOUT SYSTEM

```txt
Page Padding:        p-6
Section Gap:         gap-6
Card Padding:        p-4
Form Gap:            gap-4
Table Row Height:    h-11
```

Layouts:

* Grid-first
* No absolute positioning
* Desktop-first responsiveness

---

## 🧾 TABLE SYSTEM (ERP CRITICAL)

Mandatory features:

* Sticky headers
* Zebra striping
* Dense layout
* Right-aligned numbers
* Left-aligned text

```html
<tr class="odd:bg-white even:bg-slate-50">
```

---

## 🧱 STYLING ARCHITECTURE (SCSS + TAILWIND)

### Final Styling Stack

```
TailwindCSS → utilities, spacing, colors
SCSS        → structure, composition, shared classes
```

### SCSS FILE STRUCTURE (MANDATORY)

```
src/styles/
 ├── _variables.scss
 ├── _mixins.scss
 ├── _base.scss
 ├── _components.scss
 ├── tailwind.scss
 └── styles.scss
```

`styles.scss` MUST import:

```scss
@use 'tailwind';
@use 'base';
@use 'variables';
@use 'mixins';
@use 'components';
```

---

## 🧱 THRIFTUI — BASE UI COMPONENT LIBRARY

Create under:

```
src/app/shared/ui/
```

### Components (MANDATORY)

**Core**

* Button
* Input
* Select
* Textarea
* Checkbox
* Radio
* Toggle
* Badge
* Alert
* Tooltip

**Layout**

* Card
* Table
* Modal
* Drawer
* Tabs
* Breadcrumb

**Feedback**

* Toast
* Loading Skeleton
* Empty State

Rules:

* Generated via Angular CLI
* SCSS per component
* Tailwind for utilities
* No business logic
* Fully typed inputs
* ARIA basics

---

## 🔐 LOGIN SCREEN — VISUAL FOUNDATION ONLY

### Layout

```
┌─────────────────────┬─────────────────────┐
│ Brand Panel         │ Login Form           │
│ Logo + Tagline      │ Inputs & Button     │
└─────────────────────┴─────────────────────┘
```

### Brand Panel Requirements

* SVG logo placeholder
* Product name: **ThriftOS**
* Tagline:

  > *ERP built for the thrift industry*
* Subtle abstract SVG illustration
* Background: `slate-100`

🚫 No auth logic
🚫 No API calls
🚫 No dark UI

---

## ⚙️ ANGULAR ARCHITECTURE RULES (LOCKED)

✔ Standalone components only
✔ Generated via Angular CLI only
✔ `ChangeDetectionStrategy.OnPush`
✔ Signals for derived UI state
✔ Reactive Forms only
✔ Services = API only (future phases)
✔ Lazy-loaded routes

🚫 Manual file creation
🚫 Business logic in components

---

## 🛠️ ANGULAR CLI GENERATION RULES

### Component

```bash
ng generate component shared/ui/button \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

### Service

```bash
ng generate service core/services/example
```

### Guard

```bash
ng generate guard core/guards/auth
```

🚫 No deviation allowed

---

## 🧪 QUALITY, GOVERNANCE & AI-SAFETY RULES

* No TODOs
* No placeholders
* No mock data
* No guessing
* No frontend-only features
* Everything reusable
* Fail if backend coverage rules are violated

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **Frontend Phase 0 completely**, including:

✔ Angular 21 project
✔ Tailwind + SCSS setup
✔ Inter font
✔ Lucide icons
✔ ThriftUI component library
✔ Layout primitives
✔ Login screen visual foundation

❌ Do NOT implement auth logic
❌ Do NOT implement API calls
❌ Do NOT implement business screens

Output **real Angular code**, production-ready for Phase 1.