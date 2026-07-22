# ThriftOS Frontend Design & Aesthetic Rules

## 🎯 Locked Design System Guidelines

1. **Brand Primary Color Integrity:**
   - Always stick to the project's primary brand color (`$primary` / `hsl(var(--primary))` / `#714b67` deep plum purple).
   - Never override the primary color with arbitrary blue gradients or unapproved color schemes.

2. **Minimalist Oracle / Odoo Style Enterprise ERP Aesthetics:**
   - **Page Background:** `#f9fafb` (Odoo / Oracle light background).
   - **Cards & Surfaces:** Pure `#ffffff` with subtle 1px border (`#e5e7eb` / `$gray-200`).
   - **Data Density:** High-density table rows (44px height) with 13px Inter font.
   - **Status Badges:** Subtle green/amber/red status pills with status dots.

3. **CTA & Header Icon Alignment:**
   - All page headers, toolbars, and CTA buttons must use Lucide icons.
   - Icons must be centered using flex alignment (`display: inline-flex; align-items: center; gap: 0.5rem;`).
