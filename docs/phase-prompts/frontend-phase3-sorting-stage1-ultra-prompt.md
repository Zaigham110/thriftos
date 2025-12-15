You are an **expert Angular 21 ERP frontend engineer**.

Your task is to implement **Frontend Phase 3: Sorting Stage 1 UI**, strictly aligned with:

```
docs/architecture/thriftos-v3-architecture.md
docs/phase-prompts/phase3-sorting-stage1-ultra-prompt.md
docs/phase-prompts/frontend-phase0-ultra-prompt.md
docs/phase-prompts/frontend-phase1-auth-shell-ultra-prompt.md
```

Backend APIs are **frozen and authoritative**.

🚫 NO backend logic
🚫 NO assumptions
🚫 NO grading or repack UI

---

# ---------------------------------------------------------

# 🧠 1. PHASE 3 SCOPE (LOCKED)

# ---------------------------------------------------------

In this phase you MUST implement:

✔ Sorting session creation (Rag / Incoming Bale)
✔ Category bucket workspace (live input)
✔ Weight + count capture
✔ Real-time totals & waste calculation
✔ Session close workflow
✔ Read-only category output view
✔ RBAC-aware actions

🚫 No grading
🚫 No inventory
🚫 No reports

---

# ---------------------------------------------------------

# 🧱 2. MODULE STRUCTURE

# ---------------------------------------------------------

Create under:

```
src/app/modules/sorting-stage1/
 ├── sessions/
 ├── buckets/
 ├── category-outputs/
 ├── sorting-stage1.routes.ts
```

Each sub-module MUST include:

* list page
* workflow/detail page
* drawer-based forms
* service.ts
* typed DTOs

---

# ---------------------------------------------------------

# 🧾 3. SORT SESSION UI

# ---------------------------------------------------------

## 📄 List Page — Sort Sessions

Table columns:

* Session ID
* Source Type (Rag / Incoming Bale)
* Source Code
* Input Weight
* Output Weight
* Waste
* Yield %
* Status
* Worker
* Date

Actions:

* View / Continue (OPEN)
* View (CLOSED)

Filters:

* Status
* Source Type
* Date range

RBAC:

```
SORTING_STAGE1_VIEW
SORTING_STAGE1_CREATE
SORTING_STAGE1_CLOSE
```

---

## ➕ Create Sort Session (Drawer)

Fields:

* Source Type (radio)
* Rag OR Incoming Bale selector
* Worker
* Supervisor (optional)

Rules:

* Exactly one source required
* Input weight auto-loaded
* Cannot create duplicate session for same source

---

# ---------------------------------------------------------

# 🧺 4. SORTING WORKSPACE (CORE SCREEN)

# ---------------------------------------------------------

### ⚙️ Layout (MANDATORY)

```
┌───────────────┬─────────────────────┬──────────────┐
│ Categories    │ Active Buckets       │ Summary      │
│ (reference)   │ (editable table)     │ (live)       │
└───────────────┴─────────────────────┴──────────────┘
```

---

### 🟦 Active Buckets Panel

Editable table:

* Category
* Weight (KG)
* Count (optional)
* Remove

Rules:

* Inline editing
* Keyboard-friendly
* Real-time validation

---

### 🟨 Summary Panel (LIVE)

Display:

* Input Weight
* Total Output Weight
* Waste Weight
* Yield %
* Session Status

Waste = Input − Output
Yield = (Output / Input) × 100

🚫 No manual waste entry

---

# ---------------------------------------------------------

# 🔒 5. SESSION CLOSE WORKFLOW

# ---------------------------------------------------------

## Close Button (Primary)

On click:

1. Validate at least one bucket
2. Confirm dialog:

   * “This will lock the session”
3. Call backend close API
4. Redirect to read-only view

After close:

* UI becomes read-only
* Buckets locked
* Show Category Outputs tab

---

# ---------------------------------------------------------

# 📦 6. CATEGORY OUTPUT VIEW (READ-ONLY)

# ---------------------------------------------------------

Table columns:

* Category
* Weight
* Count
* Allocated Cost (read-only)

Purpose:

* Verification
* Input for Grading (Phase 4)

---

# ---------------------------------------------------------

# 🔐 7. RBAC & VISIBILITY

# ---------------------------------------------------------

Rules:

* Hide Create button if no CREATE permission
* Disable Close if no CLOSE permission
* Read-only fallback if VIEW only

Never rely on frontend permissions for security.

---

# ---------------------------------------------------------

# 🧪 8. ERROR & EDGE CASE HANDLING

# ---------------------------------------------------------

Handle:

* Over-allocation (output > input)
* Backend validation errors
* Session already closed
* Cross-tenant access → 403 page
* Network failure → retry

---

# ---------------------------------------------------------

# 🧱 9. UX & PERFORMANCE RULES (VERY IMPORTANT)

# ---------------------------------------------------------

✔ Dense UI (factory-floor friendly)
✔ No unnecessary animations
✔ Keyboard-first data entry
✔ Large numeric inputs
✔ Instant feedback
✔ No page reloads

---

# ---------------------------------------------------------

# 🧱 10. CODE QUALITY RULES

# ---------------------------------------------------------

✔ Standalone components
✔ Typed reactive forms
✔ Services only for API
✔ Signals for live totals
✔ ThriftUI components only
✔ Tailwind utilities only

---

# ---------------------------------------------------------

# 🚀 11. FINAL CURSOR INSTRUCTIONS

# ---------------------------------------------------------

Generate **complete Frontend Phase 3 (Sorting Stage 1 UI)** including:

✔ Routes
✔ Session list
✔ Sorting workspace
✔ Drawer forms
✔ Read-only output view
✔ Permission handling
✔ Error handling

❌ Do NOT implement grading
❌ Do NOT mock data
❌ Do NOT bypass backend rules

Output code directly into project files.