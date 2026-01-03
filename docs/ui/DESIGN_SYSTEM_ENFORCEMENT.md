# ThriftOS Design System Enforcement

## Overview

This document describes the automated enforcement mechanisms that ensure **ZERO DEVIATION** from the ThriftOS design system.

## ESLint Rules

### Rule 1: No Raw HTML in Business Screens

**Forbidden Elements:**
- `<div>` with Tailwind utilities (flex, grid, padding, margin)
- `<section>` outside of app-* primitives
- `<input>`, `<select>`, `<textarea>` without form integration
- `<table>`, `<tr>`, `<td>` outside of app-table

**Error Message:**
```
❌ DESIGN SYSTEM VIOLATION: Raw HTML elements and Tailwind utilities are forbidden.
Use app-* primitives: app-stack, app-grid, app-section, app-input, app-select, app-textarea, app-table.
```

### Rule 2: No Direct Tailwind Usage

**Forbidden:**
- Importing Tailwind directly in component TypeScript
- Using Tailwind utilities in component templates (except in app-* primitives themselves)

**Error Message:**
```
❌ DESIGN SYSTEM VIOLATION: Direct Tailwind usage is forbidden in business screens.
Use app-* primitives only.
```

## Running Linter

```bash
npm run lint
```

This will scan all `.ts` and `.html` files for violations.

## Allowed Components (ODOO-STYLE LOCKED)

### Page & Layout
- `<app-page>`, `<app-page-header>`, `<app-page-body>`
- `<app-section>`, `<app-card>`
- `<app-stack>`, `<app-grid>`

### Navigation
- `<app-breadcrumb>`

### Data Display
- `<app-table>`, `<app-table-column>`
- `<app-kpi-card>`, `<app-badge>`, `<app-icon>`

### Forms
- `<app-form>`, `<app-form-field>`
- `<app-input>`, `<app-select>`, `<app-textarea>`
- `<app-checkbox>`, `<app-radio>`, `<app-switch>`

### Actions
- `<app-button>`, `<app-dropdown>`

### Feedback
- `<app-empty-state>`, `<app-loading>`, `<app-error-state>`

## Pre-Commit Hooks (Recommended)

Install Husky to run lint checks before commits:

```bash
npm install --save-dev husky
npx husky init
echo "npm run lint" > .husky/pre-commit
```

This ensures violations never reach the repository.

## Manual Review Checklist

Before merging any PR, verify:

```
✓ Only app-* components used
✓ Layout grammar followed (page → header → body → section → card)
✓ No raw HTML elements in business UI
✓ No Tailwind utilities at screen level
✓ Colors from tokens only (--app-*)
✓ Typography consistent (text-sm, text-lg)
✓ Spacing controlled by primitives (no m-* or p-*)
✓ Screens look identical in density and style
```

## Reporting Violations

If you find code that violates the design system but passes linting:

1. **Stop immediately**
2. Document the violation
3. Update ESLint rules to catch it
4. Refactor the code to use app-* primitives

## Philosophy

> **If a screen feels different from another screen, it is WRONG.**

Consistency > Creativity  
Predictability > Beauty  
Odoo-class ERP > Marketing Design
