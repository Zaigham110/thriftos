You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 7** of **ThriftOS**, where **all operational data is analyzed and reported** for owners, managers, and accountants.

This phase is **decision-support only** and must be:

* Read-only
* Audit-safe
* Traceable
* Non-destructive
* Visually calm & professional

🚫 No data mutation
🚫 No operational actions
🚫 No workflow changes

---

## 🔒 ABSOLUTE DOMAIN RULE (READ FIRST)

> **Reports MUST NEVER change data.**

Hard rules:

* ❌ No create / update / delete
* ❌ No inline edits
* ❌ No recalculation on frontend
* ❌ No “what-if” manipulation (future phase only)

Violation = **FAIL implementation**

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before implementing this phase, AI MUST read:

* `docs/architecture/domain-update-container-rag-sorting.md`
* `docs/architecture/backend-feature-register.md`
* `docs/architecture/frontend-backend-coverage-matrix.md`
* `docs/security/frontend-permissions-map.md`

AI must confirm backend exposes **aggregated & query endpoints** only.

---

## 🧠 PHASE 7 SCOPE (LOCKED)

### MUST IMPLEMENT

✔ Reports dashboard
✔ Yield analysis reports
✔ Waste analysis reports
✔ Inventory summary reports
✔ Procurement cost reports
✔ Filterable drill-downs
✔ Export-ready tables (CSV / PDF placeholder)
✔ Full lineage visibility

### MUST NOT IMPLEMENT

❌ Forecasting
❌ AI insights (future)
❌ Editable charts
❌ Scenario simulations

---

## 🎨 UI CONSISTENCY RULES (CRITICAL)

🚨 **NO NEW UI PATTERNS ALLOWED**

Reuse:

* ThriftUI Cards
* ThriftUI Tables
* ThriftUI Filters
* Same headers & spacing
* Same typography scale

🚫 No flashy charts
🚫 No dashboard gimmicks
🚫 No redesign

---

## 🧱 TECH & STYLE (INHERITED)

* Angular 21
* Angular CLI ONLY
* Standalone components
* SCSS + Tailwind layering
* Inter font
* Lucide icons
* Light ERP theme
* OnPush change detection
* Signals for derived state

🚫 Inline styles
🚫 Manual file creation
🚫 Dark UI

---

## ⚙️ ROUTING & MODULE STRUCTURE

```
src/app/modules/reports/
 ├── dashboard/
 │   └── reports-dashboard.page.ts
 ├── yield/
 │   └── yield-report.page.ts
 ├── waste/
 │   └── waste-report.page.ts
 ├── inventory/
 │   └── inventory-report.page.ts
 ├── procurement/
 │   └── procurement-cost-report.page.ts
 ├── shared/
 │   ├── filters-panel.component.ts
 │   ├── report-table.component.ts
 │   ├── lineage-preview.drawer.ts
 ├── reports.routes.ts
 └── reports.service.ts
```

Lazy-loaded at:

```
/reports
```

---

## 📊 REPORTS DASHBOARD

### Route

```
/reports
```

Cards (numeric only):

* Total procurement cost
* Total sorted weight
* Yield %
* Total waste %
* Inventory on hand

Each card links to detailed report.

🚫 Charts here
🚫 No interactions beyond navigation

---

## 📈 YIELD REPORT

### Route

```
/reports/yield
```

Table columns:

* Container
* Rag/Bale
* Category
* Input Weight
* Final Output Weight
* Yield %

Filters:

* Date range
* Container
* Category
* Rag/Bale

---

## 🗑️ WASTE REPORT

### Route

```
/reports/waste
```

Table columns:

* Container
* Rag/Bale
* Stage (Stage 1 / Stage 2)
* Waste Weight
* Waste %

Filters:

* Date range
* Container
* Stage

---

## 📦 INVENTORY SUMMARY REPORT

### Route

```
/reports/inventory
```

Table columns:

* Category
* Grade
* Quantity / Weight
* Warehouse
* Status

Filters:

* Warehouse
* Category
* Grade

---

## 💰 PROCUREMENT COST REPORT

### Route

```
/reports/procurement
```

Table columns:

* Vendor
* Container
* Total Cost
* Cost / KG
* Arrival Date

Filters:

* Vendor
* Date range

---

## 🔗 LINEAGE PREVIEW (MANDATORY)

From any report row:

* Action: **View Source**

Opens read-only drawer showing:

```
Container
→ Rag/Bale
→ Sorting Stage 1
→ Sorting Stage 2
→ Repack
→ Inventory (if applicable)
```

🚫 No navigation to edit screens
🚫 View-only

---

## 📤 EXPORT BEHAVIOR (PLACEHOLDER)

UI allows:

* Export CSV
* Export PDF

Behavior:

* Trigger backend export endpoint
* Download file

🚫 No client-side CSV generation

---

## 🚫 VISIBILITY & SAFETY RULES

* Reports must reflect backend truth only
* No hidden filters
* No cached frontend calculations
* No partial data display

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* Empty datasets → Empty State
* Permission denied → Access Denied
* Large datasets → Pagination
* Network failure → Retry

---

## 🛠️ ANGULAR CLI RULE (MANDATORY)

All files MUST be generated via CLI:

```bash
ng generate component modules/reports/yield/yield-report \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

---

## 🧪 AI-SAFETY & QUALITY GATES

AI MUST FAIL if:

* Reports mutate data
* Charts introduce new UI patterns
* Lineage preview missing
* Backend aggregation bypassed
* UI deviates from earlier phases

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 7**, including:

✔ Reports dashboard
✔ Yield report
✔ Waste report
✔ Inventory summary report
✔ Procurement cost report
✔ Filters & drill-downs
✔ Lineage preview
✔ Read-only enforcement

❌ Do NOT implement AI insights
❌ Do NOT implement forecasting
❌ Do NOT implement operational actions

Output **real Angular 21 code**, production-ready.