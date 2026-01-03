# 🔒 Design System Enforcement Rules

**Version:** 1.0.0  
**Enforcement Level:** ABSOLUTE  
**Exception Process:** Architecture Review Required

---

## ⚠️ ZERO-TOLERANCE VIOLATIONS

These violations MUST result in **immediate PR rejection**:

### 1️⃣ Screen-Level Styling

❌ **FORBIDDEN:**
```typescript
@Component({
  styles: [`
    .custom-wrapper { padding: 20px; }
    .my-card { background: #f0f0f0; }
  `]
})
```

✅ **REQUIRED:**
```typescript
@Component({
  styles: []  // Empty - all styling from design system
})
```

---

### 2️⃣ Ad-Hoc Layout Wrappers

❌ **FORBIDDEN:**
```html
<div class="flex justify-between p-4">
  <div class="grid grid-cols-3 gap-6">
    ...
  </div>
</div>
```

✅ **REQUIRED:**
```html
<app-section-body class="grid-cols-3">
  ...
</app-section-body>
```

---

### 3️⃣ Spacing Utilities

❌ **FORBIDDEN:**
```html
<div class="p-4 m-6 gap-3 px-8 mb-12">
<div style="padding: 15px; margin: 20px;">
```

✅ **REQUIRED:**
```html
<!-- NO spacing - handled by primitives -->
<app-section-body>
  <app-card>
```

---

### 4️⃣ Custom Colors

❌ **FORBIDDEN:**
```html
<div style="color: #333; background: #f5f5f5;">
<div class="bg-gray-100 text-blue-500">
```

✅ **REQUIRED:**
```scss
// Use design tokens ONLY
color: var(--app-text-primary);
background: var(--app-bg-surface);
```

---

### 5️⃣ Raw HTML Elements

❌ **FORBIDDEN:**
```html
<table class="...">
<form class="...">
<input class="...">
<button class="...">
```

✅ **REQUIRED:**
```html
<app-table>
<app-form>
<app-form-field><input /></app-form-field>
<app-button>
```

---

### 6️⃣ ui-* Primitives in Screens

❌ **FORBIDDEN:**
```typescript
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CardComponent } from '@shared/ui/card/card.component';
```

✅ **REQUIRED:**
```typescript
import { AppButtonComponent } from '@shared/ui/button/app-button.component';
import { AppCardComponent } from '@shared/ui/card/app-card.component';
```

---

### 7️⃣ Font Overrides

❌ **FORBIDDEN:**
```css
font-size: 15px;
font-family: Arial;
font-weight: 700;
```

✅ **REQUIRED:**
```scss
// Use tokens ONLY
font-size: var(--font-size-body);
font-family: var(--font-family);
```

---

### 8️⃣ Layout Without Primitives

❌ **FORBIDDEN:**
```html
<!-- No app-page wrapper -->
<div>
  <h1>Page Title</h1>
  <div>Content</div>
</div>
```

✅ **REQUIRED:**
```html
<app-page>
  <app-page-header>
    <h1 class="page-title">Page Title</h1>
  </app-page-header>
  <app-page-body>
    ...
  </app-page-body>
</app-page>
```

---

## 🛡️ AUTOMATED CHECKS

### ESLint Rules (Recommended)

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["**/ui/button/button.component"],
          "message": "Use AppButtonComponent instead"
        },
        {
          "group": ["**/ui/card/card.component"],
          "message": "Use AppCardComponent instead"
        }
      ]
    }]
  }
}
```

### Grep Violations

```bash
# Search for spacing utilities
grep -r "class=\".*[pm]-[0-9]" src/app/modules/
grep -r "class=\".*gap-[0-9]" src/app/modules/

# Search for raw HTML tables
grep -r "<table" src/app/modules/ | grep -v "app-table"

# Search for inline styles
grep -r "style=\"" src/app/modules/

# Search for component styles
grep -r "@Component" -A 10 src/app/modules/ | grep "styles:"
```

---

## ✅ PRE-COMMIT CHECKLIST

Before committing ANY screen code:

```
☐ Component has NO styles array/object
☐ NO spacing utilities (p-*, m-*, gap-*)
☐ NO inline styles
☐ NO raw <table>, <form>, <input>, <button>
☐ Imports ONLY app-* components
☐ NO custom color values
☐ NO font-family/size overrides
☐ Uses app-page hierarchy
☐ ALL tables wrapped in app-table
☐ ALL buttons are app-button
☐ ALL form fields wrapped in app-form-field
```

**ALL items MUST pass. No exceptions.**

---

## 📋 CODE REVIEW CHECKLIST

Reviewers MUST verify:

### Visual Structure
- [ ] Root element is `<app-page>`
- [ ] Has `<app-page-header>` with title
- [ ] Has `<app-page-body>` wrapping content
- [ ] Content in `<app-section>` groups
- [ ] No arbitrary `<div>` wrappers

### Data Display
- [ ] All tables use `<app-table>`
- [ ] KPIs use `<app-kpi-card>`
- [ ] Cards use `<app-card>` with valid variant

### Forms
- [ ] Forms wrapped in `<app-form>`
- [ ] All inputs wrapped in `<app-form-field>`
- [ ] Form has `.form-actions` with app-buttons

### Actions
- [ ] All buttons are `<app-button>`
- [ ] Variant is 'primary' | 'secondary' | 'danger'

### Styling
- [ ] Component has empty styles array
- [ ] No inline styles
- [ ] No Tailwind spacing utilities
- [ ] No custom colors

### Imports
- [ ] Only imports app-* components
- [ ] No ui-* component imports

---

## 🚨 VIOLATION SEVERITY

| Violation                  | Severity | Action             |
| -------------------------- | -------- | ------------------ |
| Screen-level styles        | CRITICAL | Block merge        |
| Spacing utilities          | CRITICAL | Block merge        |
| Raw HTML elements          | CRITICAL | Block merge        |
| Custom colors              | HIGH     | Block merge        |
| ui-* imports               | HIGH     | Block merge        |
| Missing app-page hierarchy | HIGH     | Block merge        |
| Wrong button variant       | MEDIUM   | Request changes    |
| Missing KPI card           | LOW      | Advisory comment   |

---

## 🎯 ENFORCEMENT PHILOSOPHY

> **"Visual consistency is not optional. It is guaranteed by design."**

### Why Zero Tolerance?

1. **Technical Debt Prevention:** One exception creates a precedent
2. **Visual Consistency:** No "looks different" bugs
3. **Maintainability:** System changes propagate automatically
4. **Onboarding:** New devs cannot create non-compliant UIs
5. **Quality:** Premium appearance by default

---

## 🔄 EXCEPTION PROCESS

If a screen truly cannot be built with current primitives:

### Step 1: Validate Need
- Document what cannot be done
- Provide design mockup
- List alternatives attempted

### Step 2: Design Review
- Submit to Principal Product Designer
- Architecture team review
- Minimum 2 approvals required

### Step 3: System Update
- Update design system (NOT the screen)
- Create new primitive if needed
- Document in design system docs
- Announce to all teams

### Step 4: Implement
- Use new primitive in screen
- Screen remains compliant

**NO screen gets an exception. The system gets an update.**

---

## 📞 REPORTING VIOLATIONS

If you see non-compliant code in production:

1. **Do NOT merge** new code against it
2. **File design system violation ticket**
3. **Tag: `design-system-violation`**
4. **Priority: High**
5. **Assign to screen owner**

---

## 🎓 TRAINING

All developers MUST:
- Read `DESIGN_SYSTEM.md`
- Review `SCREEN_EXAMPLE.md`
- Pass design system quiz
- Build one compliant screen
- Get approval from design system guardian

---

**The system is locked. The system is enforced. The system is the law.**
