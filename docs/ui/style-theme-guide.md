# Style & Theme Guide (TalentOS)

**Location:** `docs/current/ux-docs/style-theme-guide.md`
**Last Updated:** 2025-12-20
**Status:** Active

---

## Goal (portable design system)

This document is written so you can **copy/paste it into another project** and immediately build UI that matches TalentOS. It includes:

- The **tech stack + conventions** (Tailwind + Radix + shadcn-style primitives + CVA variants).
- A **copy kit**: required deps + minimal files/snippets to recreate the look.
- The **design tokens** (CSS variables) and how to consume them via Tailwind.
- Component + layout patterns (buttons, cards, dialogs, tables, breadcrumbs, etc.).

## 1) UI tech stack (what you’re inheriting)

### Core styling

- **Tailwind CSS** (utility-first, responsive by default)
- **CSS Variables** (design tokens) + Tailwind semantic mappings
- **PostCSS + Autoprefixer**

Repository sources:
- `tailwind.config.ts`
- `postcss.config.js`
- `shared-components/styles/index.css`
- `client/src/styles-entry.ts`

### Component primitives

- **Radix UI** primitives (Dialog, Dropdown, Tooltip, etc.)
- **shadcn-style wrappers** under `@shared-components/ui/shadcn/*`
- **CVA** (`class-variance-authority`) for variants
- **`cn()`** helper using `clsx + tailwind-merge` for class composition

Repository sources:
- `shared-components/ui/shadcn/*`
- `shared-components/ui/Button.tsx`
- `shared-components/utils/utils.ts` and `shared-components/utils/lib/utils.ts`

## 2) “Lift & shift” setup (copy kit for a new project)

If you want the same frontend style in another repo, this is the minimum recommended setup.

### 2.1 Dependencies to install

Install these (versions can vary, but these are what TalentOS uses conceptually):

- **Tailwind stack**: `tailwindcss`, `postcss`, `autoprefixer`
- **Tailwind plugins**: `tailwindcss-animate`, `@tailwindcss/typography`
- **Class composition**: `clsx`, `tailwind-merge`, `class-variance-authority`
- **Primitives**: `@radix-ui/*` packages you use (Dialog, Tooltip, etc.)
- **Icons**: `lucide-react` (optional but common)
- **Theming**: `next-themes` (optional; used in this repo even though it’s not Next-only)

### 2.2 Required files to copy (recommended)

Copy these concepts (paths can differ in your new repo):

- **Global CSS tokens + base layers**:
  - `shared-components/styles/index.css`
- **Tailwind config** (semantic token mappings):
  - `tailwind.config.ts`
- **PostCSS config**:
  - `postcss.config.js`
- **`cn()` helper**:
  - `shared-components/utils/utils.ts` (or a single `lib/cn.ts`)
- **Core UI primitives** (start with these and expand):
  - `shared-components/ui/Button.tsx`
  - `shared-components/ui/shadcn/dialog.tsx`
  - `shared-components/ui/shadcn/card.tsx`
  - `shared-components/ui/shadcn/input.tsx`
  - `shared-components/ui/shadcn/badge.tsx`
  - `shared-components/ui/shadcn/tooltip.tsx`

### 2.3 Canonical global styles entry

In TalentOS, global CSS is imported once:

- Source: `client/src/styles-entry.ts`

In a new app, create a single global import point and import your token CSS there (do not import token CSS in many components).

## 3) Theme model (how the theme works)

### 3.1 The rule: always use semantic tokens

Use Tailwind semantic tokens so UI automatically supports:

- Light/dark
- Module scoping (via data attributes / wrapper classes)
- Safer refactors (change tokens once, UI updates everywhere)

Use these categories everywhere:

- **Surfaces**: `bg-background`, `bg-card`, `bg-popover`
- **Text**: `text-foreground`, `text-muted-foreground`, `text-card-foreground`
- **Borders**: `border-border`, `border-input`
- **Actions**: `bg-primary`, `bg-secondary`, `bg-destructive`
- **Focus**: `ring-ring`, `ring-offset-background`

### 3.2 Dark mode

Dark mode is class-based:

- Tailwind: `darkMode: ['class']` in `tailwind.config.ts`
- Tokens: `.dark { ... }` overrides in `shared-components/styles/index.css`

## 4) Copy/paste tokens (core theme variables)

These are the **core semantic tokens** that Tailwind maps to.

Paste into your global CSS file (and keep them as HSL triplets to match Tailwind’s `hsl(var(--token))` usage):

```css
/* Core theme tokens (TalentOS baseline) */
:root {
  --background: 0 0% 100%;
  --foreground: 20 14.3% 4.1%;
  --muted: 60 4.8% 95.9%;
  --muted-foreground: 25 5.3% 44.7%;
  --popover: 0 0% 100%;
  --popover-foreground: 20 14.3% 4.1%;
  --card: 0 0% 100%;
  --card-foreground: 20 14.3% 4.1%;
  --border: 20 5.9% 90%;
  --input: 20 5.9% 90%;

  /* Primary Brand Color - Talent OS Teal */
  --primary: 178 60% 50%; /* #14b8a6 */
  --primary-foreground: 0 0% 100%;

  /* Secondary Brand Color - EnableU Lime Green */
  --secondary: 84 81% 44%; /* #84cc16 */
  --secondary-foreground: 0 0% 0%;

  --accent: 60 4.8% 95.9%;
  --accent-foreground: 24 9.8% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 60 9.1% 97.8%;
  --ring: 199 89% 48%;
  --radius: 0.5rem;

  /* Chat Markdown Styling */
  --chat-prose-headings: 20 14.3% 4.1%;
  --chat-prose-body: 25 5.3% 44.7%;
  --chat-prose-bold: 20 14.3% 4.1%;
  --chat-prose-code-bg: 60 4.8% 95.9%;
  --chat-prose-quotes: 178 60% 50%;

  /* AdaptIQ Assistant Brand Colors */
  --adaptiq-gradient-start: 219 91% 54%;
  --adaptiq-gradient-end: 280 73% 58%;
  --adaptiq-text: 0 0% 100%;
  --adaptiq-shadow: 0 0% 0%;

  /* Module Colors - Blue theme mapping */
  --module-yellow: 217 91% 60%;
  --module-yellow-light: 214 100% 97%;
  --module-yellow-border: 213 97% 87%;

  --module-orange: 217 91% 60%;
  --module-orange-light: 214 100% 97%;
  --module-orange-border: 213 97% 87%;

  --module-dark-orange: 217 78% 51%;
  --module-dark-orange-light: 214 100% 97%;
  --module-dark-orange-border: 213 97% 87%;
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;

  /* Primary becomes blue in dark mode (per current repo tokens) */
  --primary: 199 89% 48%;
  --primary-foreground: 211 100% 99%;

  --secondary: 84 81% 44%;
  --secondary-foreground: 0 0% 100%;

  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --ring: 199 89% 48%;
  --radius: 0.5rem;

  --module-yellow: 217 91% 60%;
  --module-yellow-light: 222 84% 5%;
  --module-yellow-border: 215 25% 27%;

  --module-orange: 217 91% 60%;
  --module-orange-light: 222 84% 5%;
  --module-orange-border: 215 25% 27%;

  --module-dark-orange: 217 78% 51%;
  --module-dark-orange-light: 222 84% 5%;
  --module-dark-orange-border: 215 25% 27%;
}
```

Authoritative source (if you want every extra token too): `shared-components/styles/index.css`.

## 5) Tailwind configuration (portable template)

Key points:

- semantic tokens map to `hsl(var(--token))`
- border radius maps to `--radius`
- plugins: `tailwindcss-animate`, `@tailwindcss/typography`

Use this as a starting template:

```ts
// tailwind.config.ts (portable template)
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
} satisfies Config;
```

Authoritative source: `tailwind.config.ts`.

## 6) Class composition (`cn`) and variant system

### 6.1 `cn()` helper (copy/paste)

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Authoritative sources:
- `shared-components/utils/utils.ts`
- `shared-components/utils/lib/utils.ts`

### 6.2 CVA variants (how components are styled)

Components like `Button` define:

- a **base class string** (layout, focus ring, disabled, icon sizing)
- variant enums (`variant`, `size`)
- default variants

Authoritative example: `shared-components/ui/Button.tsx`.

## 7) Typography system (what to use by default)

### 7.1 Font family

- Base font: **Inter**, with system fallbacks.
  - Source: `shared-components/styles/index.css`

### 7.2 Recommended type scale (Tailwind classes)

Use this scale for consistency across pages:

- **Page title (H1)**: `text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold`
- **Section title (H2)**: `text-xl sm:text-2xl font-semibold`
- **Card title**: `text-lg font-semibold`
- **Body**: `text-sm sm:text-base`
- **Muted/supporting**: `text-xs sm:text-sm text-muted-foreground`

Guideline: default to `text-sm` for dense UIs; upgrade to `text-base` for content-heavy screens.

## 8) Spacing + layout system

### 8.1 Containers

Use responsive horizontal padding patterns:

- `px-4 sm:px-6 lg:px-8` (most pages)
- Avoid fixed left gutters unless a sidebar demands it (and make mobile `ml-0`).

### 8.2 Cards

Cards should be:

- surface: `bg-card text-card-foreground`
- border: `border border-border`
- radius: `rounded-lg` (or `rounded-xl` for “hero” cards)
- padding: `p-4 sm:p-6`

### 8.3 Grids

Default grid patterns:

- “auto-fit” behavior: use Tailwind grid breakpoints (e.g., `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`)
- allow overflow on tables: wrap in `overflow-x-auto` and use `min-w-*` inside

## 9) Component patterns (how to build UI that matches)

### 9.1 Buttons

Use the shared `Button` and its variants:

- **Primary**: `variant="default"`
- **Secondary**: `variant="secondary"`
- **Destructive**: `variant="destructive"`
- **Ghost / Link / Outline** for tertiary actions

Key rule: primary actions always use `bg-primary text-primary-foreground` (via the component).

### 9.2 Forms (inputs, labels, validation)

Conventions:

- Inputs use `border-input` + focus ring `ring-ring`
- Inline errors use `text-destructive` + subtle background `bg-destructive/10`

### 9.3 Dialogs / modals (responsive baseline)

Baseline `DialogContent` behavior is:

- centered overlay
- `max-w-lg` by default
- surface: `bg-background`
- border + shadow

For mobile-first dialogs, prefer:

- `w-[92vw] sm:w-[95vw] max-w-* max-h-[85vh] overflow-y-auto`

Authoritative primitive: `shared-components/ui/shadcn/dialog.tsx`.

### 9.4 Breadcrumbs

On mobile:

- prefer truncation + horizontal scroll (`overflow-x-auto`, `whitespace-nowrap`, per-crumb `truncate`)

### 9.5 Tables

Rules:

- always wrap dense tables in `overflow-x-auto`
- use `text-xs sm:text-sm` for headers/cells
- use consistent row padding `p-2 sm:p-3` depending on density

## 10) Responsive system

### 10.1 Breakpoints

Default Tailwind breakpoints (unless your repo overrides them):

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### 10.2 Mobile-first rules of thumb

- Start with the mobile layout as default classes; add `sm:` / `md:` enhancements.
- If something is “desktop-only”, gate with `hidden sm:block` instead of building a second component.
- Avoid fixed heights in content regions; prefer `max-h-[85vh] overflow-y-auto` for overlays.

## 11) Motion + reduced motion

Rules:

- Animations must respect `prefers-reduced-motion: reduce`.
- Prefer subtle transitions (opacity/translate) over aggressive transforms.

Authoritative sources:
- `shared-components/styles/index.css` (global animations + reduced motion rules)
- `industry-modules/excellence/styles/animations.css` (module-specific motion)

## 12) Module theming

### 12.1 Hub theming (optional)

- Source: `shared-components/ui/theme/hubs.css`
- Apply `.hub-theme` (and optionally `.hub-1`, `.hub-2`, …) on a container
- Consume via `text-[var(--hub-title)]`, `bg-[var(--hub-surface)]`, etc.

### 12.2 Excellence theming (isolated module)

Excellence maintains an independent token set:

- tokens + utility classes: `industry-modules/excellence/styles/excellence-module.css`
- scoping: `[data-module='gtm']`, `[data-module='analytics']`, etc.

Use it when you want “Excellence look” outside the main app theme.

## 13) “Don’t break consistency” rules

- Use **semantic tokens** (`bg-background`, `bg-card`, `bg-primary`, etc.) instead of hardcoded hex.
- Use **shared primitives** (`Button`, shadcn Dialog/Card/Input/etc.) instead of custom one-offs.
- For per-page branding, prefer **scoped CSS variable overrides** (`data-page="..."`) rather than rewriting component styles.



