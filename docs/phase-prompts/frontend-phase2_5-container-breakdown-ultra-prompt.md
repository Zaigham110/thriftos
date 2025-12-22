You are an **elite Angular 21 enterprise ERP frontend engineer**.

You are implementing **Frontend Phase 2.5** for **ThriftOS**, a **multi-tenant thrift ERP SaaS**.

This phase introduces the **mandatory physical breakdown layer** where:

* Containers are unpacked into **Rags/Bales**
* Each Rag/Bale is tracked independently
* Sorting Stage 1 can ONLY be started from a Rag/Bale
* Fully processed Rags/Bales never reappear

🚫 NO sorting UI
🚫 NO grading
🚫 NO inventory
🚫 NO repack

---

## 🔒 BACKEND COVERAGE RULE (MANDATORY)

Before implementing this phase, the AI agent MUST:

1. Read:

   * `docs/architecture/backend-feature-register.md`
   * `docs/architecture/frontend-backend-coverage-matrix.md`
   * `docs/architecture/domain-update-container-rag-sorting.md`
   * `docs/security/frontend-permissions-map.md`
2. Identify **Phase 2.5 backend features**:

   * Rag/Bale entity
   * Rag status lifecycle
   * One-time sorting enforcement
3. Confirm **100% UI coverage**
4. FAIL if any rule is violated

---

## 🧠 PHASE 2.5 SCOPE (LOCKED)

### MUST IMPLEMENT

✔ Container → Rag/Bale breakdown UI
✔ Create Rag/Bale records
✔ Edit Rag/Bale (weight, notes)
✔ Rag/Bale status visibility
✔ Start Sorting action (Stage 1)
✔ Automatic hiding of processed rags
✔ Full source visibility (income source)

### MUST NOT IMPLEMENT

❌ Sorting logic
❌ Category UI
❌ Grading
❌ Inventory
❌ Reports

---

## 🎨 UI CONSISTENCY RULES (CRITICAL)

🚨 **ABSOLUTE RULE**

> This phase MUST reuse **existing ThriftUI components only**.

* Same tables as Procurement
* Same cards as Phase 2
* Same badges as Phase 1
* Same spacing & typography

🚫 No custom layouts
🚫 No visual redesigns
🚫 No “better looking” experiments

If something is missing → **extend ThriftUI, never bypass it**.

---

## 🧱 TECH & STYLE CONSTRAINTS (INHERITED)

* Angular 21
* Angular CLI ONLY
* Standalone components
* SCSS + Tailwind layering
* Inter font
* Lucide icons
* Light ERP theme
* OnPush change detection
* Signals for derived UI state

🚫 Inline styles
🚫 Dark UI
🚫 Manual file creation

---

## ⚙️ ROUTING & MODULE STRUCTURE

```
src/app/modules/procurement/container-breakdown/
 ├── rag-list.page.ts
 ├── rag-create.drawer.ts
 ├── rag-edit.drawer.ts
 ├── rag-status.badge.ts
 ├── rag-actions.menu.ts
 ├── container-breakdown.routes.ts
 └── rag-bale.service.ts
```

Lazy loaded at:

```
/procurement/containers/:containerId/breakdown
```

---

## 📄 CONTAINER DETAIL — NEW TAB (MANDATORY)

Enhance **Container Detail Page (Phase 2)**:

Tabs:

```
[ Overview ] [ Shipment ] [ Rags / Bales ] [ Costs ]
```

This phase fully implements **[ Rags / Bales ]** tab.

---

## 📦 RAGS / BALES LIST VIEW (CORE SCREEN)

### Table Columns (ERP-DENSE)

* Rag/Bale ID
* Source Type (Container / Loose)
* Weight (KG)
* Status
* Created Date
* Actions

### Status Badges (LOCKED)

```
NOT_STARTED → neutral
IN_SORTING  → warning
SORTED      → success
```

---

## ➕ CREATE RAG / BALE

### Trigger

* Button: **Add Rag / Bale**

### Fields

* Weight (KG) — required
* Notes — optional

Rules:

* Allowed only if container status = RECEIVED
* Default status = NOT_STARTED

---

## ✏️ EDIT RAG / BALE

Allowed ONLY if:

```
status = NOT_STARTED
```

Editable:

* Weight
* Notes

🚫 Editing IN_SORTING or SORTED rags is forbidden.

---

## ▶️ START SORTING (CRITICAL ACTION)

### Visibility Rule

Show **Start Sorting** button ONLY if:

```
rag.status === NOT_STARTED
```

### Action Behavior

1. Call backend:

   ```
   POST /sorting/stage1
   { ragBaleId }
   ```
2. Backend sets:

   ```
   RagStatus → IN_SORTING
   ```
3. Redirect to:

   ```
   /sorting/stage1/:sessionId
   ```

---

## 🚫 HIDE PROCESSED RAGS (MANDATORY)

### Default Behavior

When opening breakdown page:

```
ONLY show rags where status != SORTED
```

Optionally:

* Toggle: “Show completed rags” (read-only)

---

## 🔗 TRACEABILITY DISPLAY (MANDATORY)

Each Rag/Bale row MUST display:

```
Container Number
Rag/Bale ID
Source Type
```

This ensures **income source clarity**.

---

## 🧪 ERROR & EDGE CASE HANDLING

Handle explicitly:

* Duplicate sorting attempt → blocked
* Network failure → retry
* Permission denied → access denied
* Concurrent sorting → show locked state

---

## 🧱 UI / UX RULES (FACTORY-SAFE)

✔ Large click targets
✔ Minimal modal usage
✔ Clear status color
✔ No animations masking state
✔ Dense but readable tables

This screen is used by **floor supervisors**.

---

## 🛠️ ANGULAR CLI GENERATION RULES

Every file MUST be generated via Angular CLI:

```bash
ng generate component modules/procurement/container-breakdown/rag-list \
  --standalone \
  --change-detection=OnPush \
  --style=scss
```

Same rule for drawers, badges, services.

---

## 🧪 QUALITY & AI-SAFETY RULES

* No mock data
* No TODOs
* No UI shortcuts
* No frontend-only enforcement
* Fail if sorted rags appear selectable
* Fail if rag not traceable to source

---

## 🚀 FINAL AI / CURSOR INSTRUCTIONS

Generate **complete Frontend Phase 2.5**, including:

✔ Container → Rag/Bale breakdown UI
✔ Rag creation & editing
✔ Status enforcement
✔ Start Sorting entry point
✔ Hiding of completed rags
✔ Full backend rule compliance
✔ UI consistency with Phase 2 & 3

❌ Do NOT implement sorting UI
❌ Do NOT implement grading
❌ Do NOT implement inventory

Output **real Angular 21 code**, fully compliant with Phase 0 → Phase 2.