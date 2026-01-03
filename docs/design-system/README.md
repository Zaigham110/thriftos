# 🎨 ThriftOS Design System

**Version:** 1.0.0  
**Status:** 🔒 LOCKED  
**Date:** December 24, 2025

---

## 📚 Documentation Index

### Quick Start
1. **[Quick Reference](QUICK_REFERENCE.md)** ⚡  
   One-page cheat sheet with tokens, primitives, and templates

### Core Documentation
2. **[Design System](DESIGN_SYSTEM.md)** 📖  
   Complete design system specification with all rules, tokens, and contracts

3. **[Screen Example](SCREEN_EXAMPLE.md)** 💡  
   Full working example of a compliant screen implementation

4. **[Enforcement Rules](ENFORCEMENT.md)** 🛡️  
   Zero-tolerance violations, automated checks, and review checklists

5. **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** ✅  
   Complete deliverables list and design system metrics

---

## 🎯 Three-Minute Onboarding

### 1. Read This First
Start with [Quick Reference](QUICK_REFERENCE.md) - 2 minutes

### 2. See Working Example
Review [Screen Example](SCREEN_EXAMPLE.md) - 3 minutes

### 3. Build Your First Screen
Copy the template from Quick Reference and adapt to your needs

### 4. Before You Commit
Run the checklist from [Enforcement Rules](ENFORCEMENT.md)

---

## 🧩 What's Included

### Design Tokens
- ✅ Color system (9 colors)
- ✅ Typography scale (6 sizes)
- ✅ Spacing scale (6 values)

### Components (13 primitives)

#### Layout (6)
- `app-page`
- `app-page-header`
- `app-page-body`
- `app-section`
- `app-section-header`
- `app-section-body`

#### Container (1)
- `app-card` (variants: data | info)

#### Data (2)
- `app-table`
- `app-kpi-card`

#### Form (2)
- `app-form`
- `app-form-field`

#### Action (1)
- `app-button` (variants: primary | secondary | danger)

### Documentation (5 files)
- Quick reference
- Full specification
- Working example
- Enforcement rules
- Implementation summary

---

## 🚀 Usage

```typescript
// Import primitives
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

```html
<!-- Build screens -->
<app-page>
  <app-page-header>
    <h1 class="page-title">Title</h1>
  </app-page-header>
  
  <app-page-body>
    <app-section>
      <app-section-header>
        <h2 class="section-title">Section</h2>
      </app-section-header>
      
      <app-section-body>
        <app-card variant="data">
          <app-table>...</app-table>
        </app-card>
      </app-section-body>
    </app-section>
  </app-page-body>
</app-page>
```

---

## 🚫 Critical Rules

1. ❌ No screen-level styling
2. ❌ No per-page layout logic
3. ❌ No ad-hoc spacing, colors, or fonts
4. ❌ No raw HTML tables, forms, inputs
5. ❌ No ui-* primitives — ONLY app-*
6. ❌ No dark theme
7. ❌ No gradients, illustrations, or visual experiments

---

## ✅ Pre-Commit Checklist

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

## 🎯 Goal

> **Visual consistency is guaranteed by design, not by discipline.**

Every screen looks like the same premium product.  
Screens are boring to implement — and beautiful to use.

---

## 📞 Support

**Design System Owner:** Principal Product Designer  
**Questions:** See individual documentation files  
**Exceptions:** Require architecture review

---

**The system is locked. The system is the law.**
