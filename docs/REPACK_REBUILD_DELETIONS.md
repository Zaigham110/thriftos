# REPACK MODULE REBUILD - STEP 0 DELETIONS

## Date: 2025-01-21
## Reason: Complete rebuild to remove FIFO mode, implement manual-only allocation

---

## BACKEND DELETIONS

### 1. `/server/src/repack/repack-unit/repack-unit.service.ts`
**Methods REMOVED:**
- ❌ `createV2FIFO()` - Lines 316-427 (FIFO allocation with auto-session)
- ❌ `previewFIFOAllocation()` - Lines 548-676 (FIFO preview without creating unit)

**Methods KEPT:**
- ✅ `createForSession()` - Session-based unit creation (legacy, may be deprecated later)
- ✅ `findAll()`, `findOne()` - Query methods
- ✅ `createV2Manual()` - Manual allocation (will be refactored)
- ✅ `sealUnit()` - Sealing logic (will be refactored)
- ✅ `allocateToDraft()`, `deallocateFromDraft()` - Manual allocation helpers
- ✅ `deleteDraft()` - Draft deletion

### 2. `/server/src/repack/repack-unit/repack-unit.controller.ts`
**Endpoints REMOVED:**
- ❌ `GET /repack/units/fifo/preview` - Lines 225-237 (FIFO preview endpoint)
- ❌ `POST /repack/units/fifo` - Lines 239-247 (FIFO creation endpoint)

**Endpoints KEPT:**
- ✅ `GET /repack/available-stock` - Available stock query (will be refactored)
- ✅ `POST /repack/units/manual` - Manual allocation creation
- ✅ `PATCH /repack/units/:id/seal` - Sealing endpoint
- ✅ `PATCH /repack/units/:id/allocate` - Add allocation
- ✅ `PATCH /repack/units/:id/deallocate` - Remove allocation
- ✅ `DELETE /repack/units/:id` - Delete draft
- ✅ `GET /repack/units/drafts` - List drafts
- ✅ `GET /repack/units/sealed` - List sealed units

### 3. `/server/src/repack/v3/repack-v3.service.ts`
**Methods TO BE EVALUATED:**
- ⚠️ `previewFifo()` - If exists, will be removed
- ⚠️ `createDraftFifo()` - If exists, will be removed
- ✅ `getAvailableStock()` - Will be kept and refactored
- ✅ `createDraftManual()` - Will be kept and refactored
- ✅ `sealUnit()` - Will be kept and refactored

---

## FRONTEND DELETIONS

### 1. `/thriftos-frontend/src/app/modules/repack/`

**Current Structure:**
```
repack/
├── index/           ← KEPT (follows golden reference pattern)
├── new/             ← KEPT (clean create form)
├── workspace/       ← KEPT (will be refactored to 3-panel layout)
├── repack.models.ts ← UPDATED (removed fifoTimestamp)
├── repack.routes.ts ← KEPT (routes are clean)
└── repack.service.ts ← KEPT (already clean per comments)
```

**Changes Made:**
- ✅ Removed `fifoTimestamp` field from `AvailableStock` interface
- ✅ No FIFO logic found in any components
- ✅ Components already follow golden reference pattern (app-page, app-data-table)

**Kept (for refactoring):**
- index/ → Will be used as is (already follows spec)
- new/ → Will be merged into workspace (create inline)
- workspace/ → Will be rebuilt with 3-panel layout

**Note:** Frontend was cleaner than expected! Only needed to remove one field.

---

## VALIDATION CRITERIA

After deletions, system should:
1. ❌ NO `/fifo` routes anywhere
2. ❌ NO `previewFIFO` methods anywhere
3. ❌ NO `AllocationMode.FIFO` references
4. ✅ ONLY manual allocation endpoints
5. ✅ Available stock query functional
6. ✅ Draft CRUD operations functional

---

## NEXT STEPS (After STEP 0)

**STEP 1 - Backend Rebuild:**
- Refactor available stock query to match spec
- Simplify draft model (remove session dependency if possible)
- Implement clean allocate/deallocate logic
- Implement seal with inventory creation

**STEP 2 - Frontend Rebuild:**
- Build INDEX component (Drafts/Sealed tabs)
- Build WORKSPACE component (3-panel layout)
- Build panels: Available Stock, Allocations, Summary
- Build seal confirmation modal

**STEP 3 - Self-Audit:**
- Verify no FIFO exists
- Test full flow
- Document changes
