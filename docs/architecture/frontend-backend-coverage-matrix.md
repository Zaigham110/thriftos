# ThriftOS V3 — Frontend-Backend Coverage Matrix

## Overview

This matrix tracks which backend features have corresponding frontend UI implementations. All features must be explicitly accounted for in each frontend phase.

---

## Coverage Status Legend

| Status | Meaning |
|--------|---------|
| ✅ `COVERED` | Frontend UI implemented and connected to API |
| 🔄 `IN_PROGRESS` | Currently being implemented |
| ⏳ `UI_PENDING` | Scheduled for future frontend phase |
| ❌ `NOT_PLANNED` | Intentionally excluded (with justification) |

---

## Phase 0: Foundation (Current)

**Phase Type**: Infrastructure / Design System
**Business Logic**: None
**API Connections**: None

### Coverage Status

| Domain | Feature Count | Covered | Status |
|--------|---------------|---------|--------|
| AUTH | 4 | 0 | ⏳ UI_PENDING (Phase 1) |
| SA (Super Admin) | 13 | 0 | ⏳ UI_PENDING (Phase TBD) |
| RBAC | 15 | 0 | ⏳ UI_PENDING (Phase TBD) |
| CFG (Config) | 12 | 0 | ⏳ UI_PENDING (Phase TBD) |
| PROC (Procurement) | 29 | 0 | ⏳ UI_PENDING (Phase 2) |
| SORT1 (Sorting Stage 1) | 9 | 0 | ⏳ UI_PENDING (Phase 3) |
| SORT2 (Sorting Stage 2) | 9 | 0 | ⏳ UI_PENDING (Phase 4) |
| REPACK | 12 | 0 | ⏳ UI_PENDING (Phase 5) |
| INV (Inventory) | 6 | 0 | ⏳ UI_PENDING (Phase 6) |
| RPT (Reports) | 11 | 0 | ⏳ UI_PENDING (Phase 7) |
| SYS (Health) | 4 | 0 | ❌ NOT_PLANNED (Backend-only monitoring) |

### Phase 0 Deliverables

| Deliverable | Status |
|-------------|--------|
| Angular 21 Project Initialization | ✅ Complete |
| Tailwind + SCSS Architecture | ✅ Complete |
| Inter Font Configuration | ✅ Complete |
| Lucide Icons Integration | ✅ Complete |
| ThriftUI Component Library (19 components) | ✅ Complete |
| Layout Primitives | ✅ Complete |
| Login Screen Visual Foundation | ✅ Complete |

---

## Future Phase Mapping

### Phase 1: Authentication & Shell
- AUTH-001: User Login → Login Form
- AUTH-002: Token Refresh → Token Service
- AUTH-003: User Logout → Logout Action
- AUTH-004: Get Current User → User Context
- App Shell / Navigation Structure
- Route Guards

### Phase 2: Procurement
- PROC-001 to PROC-029 → Procurement Module
- Vendor Management UI
- Purchase Order UI
- Container Management UI
- Incoming Bale UI
- Cost Allocation UI

### Phase 3: Sorting Stage 1
- SORT1-001 to SORT1-009 → Sorting Stage 1 Module
- Sort Session Management UI
- Category Output Recording UI

### Phase 4: Sorting Stage 2
- SORT2-001 to SORT2-009 → Sorting Stage 2 Module
- Grade Session Management UI
- Grade Output Recording UI

### Phase 5: Repack
- REPACK-001 to REPACK-012 → Repack Module
- Repack Session UI
- Repack Unit Management UI
- QR Label Generation UI

### Phase 6: Inventory
- INV-001 to INV-006 → Inventory Module
- Inventory Dashboard
- Stock Movement UI
- Warehouse Management UI

### Phase 7: Reports
- RPT-001 to RPT-011 → Reports Module
- Procurement Reports
- Sorting Reports
- Grading Reports
- Inventory Reports
- Repack Reports

### Phase 8+: Administration
- SA-001 to SA-013 → Super Admin Module
- RBAC-001 to RBAC-015 → User/Role Management UI
- CFG-001 to CFG-012 → Tenant Config UI

---

## Validation Rules

1. **No Silent Omissions**: Every backend feature must appear in this matrix
2. **Explicit Justification**: Any `NOT_PLANNED` status requires justification
3. **Phase Assignment**: Every `UI_PENDING` feature must have a target phase
4. **Continuous Updates**: This matrix is updated at each phase completion

---

## Phase 0 Acknowledgment

✅ **Frontend Phase 0 contains NO business screens**
✅ **All backend features marked as `UI_PENDING (future phase)`**
✅ **No backend features silently ignored**

This phase establishes the visual and architectural foundation for all subsequent phases.
