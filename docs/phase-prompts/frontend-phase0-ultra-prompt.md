You are an **expert Angular 21 architect & enterprise UI engineer**.

Your task is to initialize the **entire frontend foundation** for **ThriftOS V3**, strictly aligned with:

```
docs/architecture/thriftos-v3-architecture.md
```

Backend APIs from Phases 1–8 are already frozen.

NO deviation.
NO business logic.
NO premature UI screens.

This phase sets up **structure, theming, layout, auth, and core UI primitives only**.

---

# ---------------------------------------------------------

# 🧠 1. TECH STACK (LOCKED)

# ---------------------------------------------------------

* Angular **21** (standalone APIs only)
* TypeScript strict mode
* TailwindCSS (latest)
* Angular CDK
* RxJS + Angular Signals
* No Angular Material
* No third-party UI kits

---

# ---------------------------------------------------------

# 🧱 2. PROJECT INITIALIZATION

# ---------------------------------------------------------

Generate:

```
thriftos-frontend/
 ├── src/
 │   ├── app/
 │   │   ├── core/
 │   │   ├── layout/
 │   │   ├── shared/
 │   │   ├── modules/
 │   │   ├── app.routes.ts
 │   │   └── app.config.ts
 │   ├── assets/
 │   ├── styles/
 │   │   └── tailwind.css
 │   └── main.ts
 ├── tailwind.config.ts
 ├── postcss.config.cjs
 └── angular.json
```

Angular configuration MUST:

* Enable standalone components
* Enable route-level lazy loading
* Enable strict type checking

---

# ---------------------------------------------------------

# 🎨 3. TAILWIND CONFIGURATION (ERP-OPTIMIZED)

# ---------------------------------------------------------

Configure Tailwind for:

### Typography

* Inter / System UI font
* Dense text sizing
* Clear hierarchy

### Spacing

* Compact paddings
* 40–44px table rows

### Colors (Neutral ERP Palette)

```
primary    #2563eb
secondary  #0f172a
success    #16a34a
warning    #f59e0b
danger     #dc2626
muted      #64748b
```

### Dark Mode

* Enabled via class strategy
* Default: light

---

# ---------------------------------------------------------

# 🧩 4. THRIFTUI — DESIGN SYSTEM FOUNDATION

# ---------------------------------------------------------

Create a **shared internal UI system** under:

```
src/app/shared/ui/
```

## MUST CREATE THESE CORE COMPONENTS:

### Layout

* `<ui-card>`
* `<ui-divider>`
* `<ui-badge>`
* `<ui-stat>`

### Forms

* `<ui-input>`
* `<ui-select>`
* `<ui-number>`
* `<ui-date>`
* `<ui-textarea>`

### Data

* `<ui-table>`

  * Column config
  * Server-side pagination
  * Sort hooks
  * Row actions slot

### Overlays

* `<ui-drawer>`
* `<ui-modal>`
* `<ui-confirm>`

### Utilities

* `<ui-loading>`
* `<ui-empty>`
* `<ui-error>`

All components must:

* Be standalone
* Accept typed inputs
* Emit typed outputs
* Use Tailwind only
* Be accessible (ARIA)

---

# ---------------------------------------------------------

# 🧭 5. APP SHELL & LAYOUT

# ---------------------------------------------------------

Create:

```
layout/
 ├── app-shell.component.ts
 ├── sidebar.component.ts
 ├── topbar.component.ts
```

### Sidebar

* Collapsible
* Icon + label
* Active state
* Permission-aware (hide menu items)

### Topbar

* Tenant name
* User dropdown
* Dark mode toggle
* Global search (placeholder)

---

# ---------------------------------------------------------

# 🔐 6. AUTH & SECURITY FOUNDATION

# ---------------------------------------------------------

Create in `core/`:

### Services

* AuthService
* SessionService
* PermissionService

### Guards

* AuthGuard
* PermissionGuard

### Interceptors

* JWT interceptor
* Error interceptor (401/403 handling)

JWT storage:

* In memory + refresh strategy
* No localStorage secrets

---

# ---------------------------------------------------------

# 🧠 7. STATE & API ARCHITECTURE

# ---------------------------------------------------------

### API Layer

* Typed HTTP services per module
* BaseApiService
* Strong DTO typing

### State

* Signals for UI state
* RxJS only for async streams

---

# ---------------------------------------------------------

# 🧾 8. ROUTING FOUNDATION

# ---------------------------------------------------------

Configure routing:

```
/login
/app
  ├── dashboard
  ├── procurement
  ├── sorting
  ├── repack
  ├── inventory
  ├── reports
  ├── admin
```

Lazy load all feature modules.

---

# ---------------------------------------------------------

# 🧪 9. QUALITY & STYLE RULES (LOCKED)

# ---------------------------------------------------------

✔ No inline styles
✔ No hardcoded colors
✔ No direct HTTP calls in components
✔ No business logic in UI
✔ Drawer-based CRUD pattern only
✔ Desktop-first responsive design

---

# ---------------------------------------------------------

# 🚀 10. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate **complete frontend foundation code** including:

✔ Angular project setup
✔ Tailwind configured
✔ ThriftUI components scaffolded
✔ Layout & shell
✔ Auth services, guards, interceptors
✔ Routing & lazy modules
✔ Clean folder structure

❌ Do NOT create business screens
❌ Do NOT connect real APIs yet
❌ Do NOT guess future features

Output code directly into project files.