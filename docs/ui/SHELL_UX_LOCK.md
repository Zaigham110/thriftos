# Shell UX Lock (Odoo-Style)

**Status:** ✅ LOCKED - ZERO DEVIATION PERMITTED

## Overview

The shell component (Top Bar + Sidebar) is now locked to Odoo-style specifications. This establishes the foundational UX structure that all modules must respect.

## Top Bar (Contextual Information)

### Purpose
Display current context: where you are, what tenant, who you are.

### Structure (LEFT → RIGHT)

#### Left Section
- **Module Name Only**
  - Font: xl size, medium weight
  - Color: Primary text (#111827)
  - Letter-spacing: -0.01em
  - NO icons, NO breadcrumbs, NO navigation

#### Right Section
1. **Tenant Badge**
   - Font: sm size, regular weight
   - Color: Muted text
   - Background: Subtle grey
   - Padding: xs vertical, sm horizontal
   - Border radius: sm

2. **User Avatar**
   - 36px circle
   - Background: Primary color (#714B67)
   - White text (first letter of name)
   - Subtle scale on hover (1.05)
   - Semibold font

3. **User Menu Dropdown**
   - Width: 240px
   - Shadow: lg
   - Border: 1px app-border
   - Radius: md
   - Items:
     - **Header**: Name (semibold) + Email (sm, muted)
     - **Divider** (1px)
     - Profile (hover: subtle bg)
     - Switch Tenant (hover: subtle bg)
     - **Divider** (1px)
     - Sign Out (red text, red bg on hover)

### Visual Properties
- Height: Auto (determined by page-header primitive)
- Background: White surface
- Border bottom: 1px subtle
- Typography-first (minimal icons)

## Sidebar (Primary Navigation)

### Purpose
Primary navigation across 7 modules. NO nesting, NO badges, NO dynamic content.

### Structure (TOP → BOTTOM)

#### Header Section
- **Logo**: "ThriftOS"
  - Font: xl size, semibold weight
  - Color: Primary text
  - Letter-spacing: -0.02em
- **Tagline**: "Operations Platform"
  - Font: sm size, regular weight
  - Color: Muted text
- Padding: xl vertical, lg horizontal
- Border bottom: 1px app-border

#### Navigation Section
- **7 Fixed Modules** (in exact order):
  1. 📊 Dashboard
  2. 🛒 Procurement
  3. 📦 Sorting
  4. 📦 Packaging
  5. 📋 Inventory
  6. 📊 Reports
  7. ⚙️ Settings

- **Each Item**:
  - Icon (20px, muted color)
  - Label (base font, regular weight)
  - Padding: sm vertical, md horizontal
  - Border radius: md
  - Gap between icon + label: sm

- **States**:
  - **Inactive**: Muted text, transparent bg
  - **Hover**: Subtle bg, secondary text
  - **Active**: Primary light bg, primary text, medium weight

- **Spacing**:
  - Gap between items: 3xs
  - Container padding: md

### Visual Properties
- Width: 240px (FIXED)
- Background: Light surface
- Border right: 1px app-border
- Overflow-y: auto (if needed)

## Workspace (Module Content)

### Purpose
Scrollable area where module content renders via `<router-outlet>`.

### Properties
- Background: Page background (#F9FAFB)
- Overflow-y: auto
- Flex: 1 (takes remaining width after 240px sidebar)

## Layout Grid

```
┌────────────────────────────────────────────┐
│ Top Bar (Full Width)                       │
│ [Module Name]    [Tenant] [👤 User Menu]   │
└────────────────────────────────────────────┘
┌──────────┬─────────────────────────────────┐
│ Sidebar  │ Workspace                       │
│ 240px    │ Flex 1                          │
│          │                                 │
│ ThriftOS │ <router-outlet>                 │
│ Ops...   │                                 │
│          │                                 │
│ 📊 Dash  │ (Module Content)                │
│ 🛒 Proc  │                                 │
│ 📦 Sort  │                                 │
│ 📦 Pack  │                                 │
│ 📋 Inv   │                                 │
│ 📊 Rep   │                                 │
│ ⚙️ Set   │                                 │
└──────────┴─────────────────────────────────┘
```

## Implementation Files

### HTML: [shell.component.html](thriftos-frontend/src/app/features/shell/shell.component.html)
```html
<app-page>
  <app-page-header>
    <div class="topbar">
      <div class="topbar-left">
        <h1 class="module-name">{{ activeModule() }}</h1>
      </div>
      <div class="topbar-right">
        <span class="tenant-badge">{{ tenantName() }}</span>
        <div class="user-menu-container">...</div>
      </div>
    </div>
  </app-page-header>

  <app-page-body>
    <div class="shell-layout">
      <aside class="sidebar">
        <div class="sidebar-header">...</div>
        <nav class="sidebar-nav">
          @for (module of modules; track module.id) {
            <button class="sidebar-item">...</button>
          }
        </nav>
      </aside>
      <main class="workspace">
        <router-outlet />
      </main>
    </div>
  </app-page-body>
</app-page>
```

### SCSS: [shell.component.scss](thriftos-frontend/src/app/features/shell/shell.component.scss)
- Uses ONLY design tokens (--app-*, --space-*, --font-*)
- NO custom colors
- NO magic numbers
- Transitions: 0.12s ease (fast, subtle)

### TypeScript: [shell.component.ts](thriftos-frontend/src/app/features/shell/shell.component.ts)
```typescript
modules = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊', path: 'dashboard' },
  { id: 'procurement', name: 'Procurement', icon: '🛒', path: 'procurement' },
  { id: 'sorting', name: 'Sorting', icon: '📦', path: 'sorting-stage1' },
  { id: 'packaging', name: 'Packaging', icon: '📦', path: 'repack' },
  { id: 'inventory', name: 'Inventory', icon: '📋', path: 'inventory' },
  { id: 'reports', name: 'Reports', icon: '📊', path: 'reports' },
  { id: 'settings', name: 'Settings', icon: '⚙️', path: 'admin' }
];
```

## Design Tokens Used

### Colors
- `--app-primary`: #714B67 (active state, avatar)
- `--app-primary-light`: Light purple (active background)
- `--app-text-primary`: #111827 (primary text)
- `--app-text-secondary`: #4B5563 (secondary text)
- `--app-text-muted`: #9CA3AF (muted text)
- `--app-surface`: White (sidebar background)
- `--app-bg-page`: #F9FAFB (workspace background)
- `--app-bg-subtle`: Light grey (tenant badge)
- `--app-bg-hover`: Hover state background
- `--app-border`: Border color
- `--app-error`: Red (sign out)
- `--app-error-light`: Light red (sign out hover)

### Spacing
- `--space-3xs`: Gap between nav items
- `--space-2xs`: Small spacing
- `--space-xs`: Tiny padding
- `--space-sm`: Small padding
- `--space-md`: Medium padding
- `--space-lg`: Large padding
- `--space-xl`: Extra large padding

### Typography
- `--font-size-sm`: Small text
- `--font-size-base`: Body text
- `--font-size-lg`: Large icons
- `--font-size-xl`: Module name, logo
- `--font-weight-regular`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600

### Other
- `--radius-sm`: Small border radius
- `--radius-md`: Medium border radius
- `--shadow-lg`: Dropdown shadow

## Rules

### ✅ PERMITTED
- Using exact structure as defined
- Using existing design tokens
- Implementing module-specific content in workspace

### ❌ FORBIDDEN
- Adding breadcrumbs to top bar
- Adding icons to module name
- Nesting sidebar items
- Adding badges to sidebar
- Changing sidebar width
- Adding animations beyond 0.12s ease
- Using custom colors outside tokens
- Modifying top bar structure
- Adding extra sections

## Verification

### Build Status
✅ Build successful: 381.91 kB initial, 70+ lazy chunks

### File Locations
- `/thriftos-frontend/src/app/features/shell/shell.component.html`
- `/thriftos-frontend/src/app/features/shell/shell.component.scss`
- `/thriftos-frontend/src/app/features/shell/shell.component.ts`

### Dependencies
- Uses: `AppPageComponent`, `AppPageHeaderComponent`, `AppPageBodyComponent`
- Uses: `ClickOutsideDirective` for dropdown
- Uses: `TitleCasePipe` for module name
- Uses: `RouterOutlet` for module content

## Next Steps

With the shell UX locked, you can now:
1. ✅ Implement Phase 1 (Dashboard) with confidence
2. ✅ Build module-specific features in workspace
3. ✅ Use locked structure as reference for all future work
4. ❌ DO NOT modify shell structure without explicit approval

## Notes

- This lock prevents the "agent improvisation" problem
- All future agents MUST respect this specification
- Any deviation requires updating this document first
- This establishes the "single source of UX truth"
