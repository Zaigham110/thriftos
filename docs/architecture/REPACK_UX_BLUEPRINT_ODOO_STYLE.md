# Repack UX Blueprint – Odoo Style

**Status**: Awaiting Approval  
**Date**: 2025-12-25  
**Authority**: Odoo Inventory / Manufacturing Work Order UX Patterns

---

## 1. SCREEN LIST (2 SCREENS ONLY)

### Screen 1: `/app/repack` (Index)
**Purpose**: List view of all repack units  
**Function**: Browse, filter, resume drafts, view sealed units  
**Primary Action**: "Create Repack Unit"

### Screen 2: `/app/repack/workspace/:draftId?` (Workspace)
**Purpose**: Single operational cockpit for repack operations  
**Function**: Allocate sources, manage draft, seal unit  
**Primary Action**: "Seal Repack Unit" (when ready)

---

## 2. WORKSPACE LAYOUT

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TOP ACTION BAR                                                          │
│ ┌─────────────────┬────────────────┬──────────────────┬──────────────┐ │
│ │ ← Back to List  │  Draft: #12345 │  Status: DRAFT   │  [SEAL UNIT] │ │
│ └─────────────────┴────────────────┴──────────────────┴──────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ DEFINITION BAR (Always Visible)                                        │
│ Category: Mixed Rags  |  Grade: A-Grade  |  Target: 500 kg            │
├────────────────────┬────────────────────────┬───────────────────────────┤
│ LEFT PANEL         │ CENTER PANEL           │ RIGHT PANEL               │
│ Available Stock    │ Allocated Sources      │ Summary & Actions         │
│ (Source)           │ (Active Allocation)    │ (Status & Control)        │
│                    │                        │                           │
│ ┌────────────────┐ │ ┌────────────────────┐ │ ┌───────────────────────┐│
│ │ FILTERS        │ │ │ ALLOCATION TABLE   │ │ │ TARGET SUMMARY        ││
│ │ • FIFO / Manual│ │ │                    │ │ │                       ││
│ │ • Category     │ │ │ Container | Amount │ │ │ Target:      500.00kg ││
│ │ • Grade        │ │ │ ───────────────────│ │ │ Allocated:   350.00kg ││
│ │ • Container    │ │ │ C-001     | 150kg  │ │ │ Remaining:   150.00kg ││
│ └────────────────┘ │ │ C-003     | 200kg  │ │ │                       ││
│                    │ │ [+ Add Source]     │ │ │ Status: DRAFT         ││
│ ┌────────────────┐ │ │                    │ │ │                       ││
│ │ AVAILABLE      │ │ │                    │ │ │ Est. Cost: $1,234.56  ││
│ │ STOCK TABLE    │ │ │                    │ │ │                       ││
│ │                │ │ │                    │ │ │ Sources: 2 containers ││
│ │ Container  Qty │ │ │                    │ │ │                       ││
│ │ ──────────────│ │ │                    │ │ │ ┌───────────────────┐ ││
│ │ C-001     150kg│ │ │                    │ │ │ │ [Seal Unit]       │ ││
│ │ C-002     200kg│ │ │                    │ │ │ │ (Primary, large)  │ ││
│ │ C-003     300kg│ │ │                    │ │ │ └───────────────────┘ ││
│ │ C-004     180kg│ │ │                    │ │ │                       ││
│ │ [Select] ──────│ │ └────────────────────┘ │ │ [Save Draft]          ││
│ │                │ │                        │ │ [Delete Draft]        ││
│ └────────────────┘ │                        │ └───────────────────────┘│
│                    │                        │                           │
│ FIFO Mode:         │                        │                           │
│ Auto-selects       │                        │                           │
│ oldest first       │                        │                           │
└────────────────────┴────────────────────────┴───────────────────────────┘
```

---

## 3. USER FLOW (DRAFT → ALLOCATE → SEAL)

### 3.1 CREATE NEW REPACK (Happy Path - FIFO)

```
Step 1: Click "Create Repack Unit" from /app/repack
  ↓
Step 2: Enter workspace (/app/repack/workspace)
  ↓
Step 3: DEFINITION BAR appears (top of workspace)
  - Select Category (dropdown)
  - Select Grade (dropdown)
  - Enter Target Amount (input)
  - Choose Allocation Mode: FIFO (default) / Manual (toggle)
  ↓
Step 4: System loads Available Stock (LEFT PANEL)
  - Shows all eligible outputs
  - Sorted by date (oldest first) if FIFO
  - Shows current available amounts
  ↓
Step 5: FIFO AUTO-ALLOCATION (if FIFO mode)
  - System preview appears in CENTER PANEL
  - Shows which containers will be used
  - Shows amounts from each
  - User reviews allocation
  - Click "Accept Allocation" → Creates DRAFT
  ↓
Step 6: CENTER PANEL now shows locked allocation
  - Sources are listed
  - Amounts are editable (can adjust/remove)
  - RIGHT PANEL shows real-time summary
  ↓
Step 7: When Allocated = Target
  - "Seal Unit" button becomes PRIMARY (green, large)
  - All other actions become secondary
  ↓
Step 8: Click "Seal Unit"
  - Modal appears with:
    * Allocation breakdown table
    * Source containers list
    * Final quantities
    * Warehouse selector (dropdown)
    * WARNING: "This action is irreversible"
  - Click "Confirm Seal"
  ↓
Step 9: Unit sealed
  - Redirect to /app/repack
  - Toast: "Repack unit sealed successfully"
  - Unit now appears in "Sealed Units" tab
```

### 3.2 RESUME DRAFT (Existing Draft)

```
Step 1: From /app/repack, click "Resume" on draft row
  ↓
Step 2: Enter workspace (/app/repack/workspace/:draftId)
  ↓
Step 3: Workspace loads with existing state:
  - DEFINITION BAR shows locked category/grade/target
  - CENTER PANEL shows existing allocations
  - LEFT PANEL shows remaining available stock
  - RIGHT PANEL shows current summary
  ↓
Step 4: User can:
  - Add more sources (if remaining > 0)
  - Remove sources (if over-allocated)
  - Adjust amounts
  ↓
Step 5: When ready → Click "Seal Unit" (same as Step 8 above)
```

### 3.3 MANUAL ALLOCATION MODE

```
Steps 1-4: Same as FIFO
  ↓
Step 5: MANUAL MODE (if Manual selected)
  - LEFT PANEL shows Available Stock table
  - Each row has [Add] button
  - Click [Add] on a container
  - Amount input modal appears
  - Enter amount to allocate
  - Click "Add Allocation"
  ↓
Step 6: Selected source appears in CENTER PANEL
  - Shows container ID, amount
  - [Remove] button available
  - RIGHT PANEL updates in real-time
  ↓
Step 7: Repeat until Allocated = Target
  ↓
Step 8-9: Same as FIFO (Seal flow)
```

---

## 4. BUTTON HIERARCHY

### PRIMARY ACTIONS (ONE AT A TIME)

| State | Primary Action | Appearance | Location |
|-------|---------------|------------|----------|
| Index Screen | Create Repack Unit | Blue, large, top-right | Page header |
| Workspace (Draft incomplete) | (none - prevent premature seal) | - | - |
| Workspace (Draft ready) | Seal Unit | Green, large, prominent | RIGHT PANEL top |
| Workspace (Sealed) | (read-only, no primary action) | - | - |

### SECONDARY ACTIONS

| Action | Appearance | Location |
|--------|------------|----------|
| Save Draft | Gray outline button | RIGHT PANEL bottom |
| Delete Draft | Red text button | RIGHT PANEL bottom |
| Back to List | Gray text + icon | TOP ACTION BAR left |
| Add Source (Manual) | Small blue outline | LEFT PANEL / CENTER PANEL |
| Remove Source | Small red icon | CENTER PANEL row action |

### TERTIARY ACTIONS

| Action | Appearance | Location |
|--------|------------|----------|
| Filter Stock | Small gray button | LEFT PANEL header |
| Adjust Amount | Inline editable | CENTER PANEL cell |

---

## 5. DATA VISIBILITY (WHAT APPEARS WHERE)

### DEFINITION BAR (Top, Always Visible)
- **Category** (selected, read-only after draft creation)
- **Grade** (selected, read-only after draft creation)
- **Target Amount** (number + unit, read-only after draft creation)
- **Allocation Mode** (FIFO/Manual, read-only after draft creation)

### LEFT PANEL (Available Stock)
- **Filters**:
  - Allocation Mode toggle (FIFO / Manual)
  - Category filter (if not locked)
  - Grade filter (if not locked)
  - Container ID search
- **Available Stock Table**:
  - Container ID (clickable)
  - Available Amount (kg or pcs)
  - Date/Age (sortable, for FIFO)
  - [Add] button (Manual mode only)
  - **Depleted items**: Auto-hidden after allocation

### CENTER PANEL (Allocated Sources)
- **Allocation Table** (main workspace):
  - Container ID
  - Allocated Amount (editable if DRAFT)
  - Date/Age
  - Cost
  - [Remove] button (if DRAFT)
- **Status indicator**: "DRAFT" or "SEALED" badge
- **[+ Add Source]** button (if Manual + remaining > 0)

### RIGHT PANEL (Summary & Control)
- **Target Summary** (always visible):
  - Target: 500.00 kg
  - Allocated: 350.00 kg
  - Remaining: 150.00 kg
  - Progress bar (visual)
- **Status**: DRAFT / READY / SEALED badge
- **Estimated Cost**: $X,XXX.XX
- **Source Count**: "2 containers"
- **Actions**:
  - [Seal Unit] (PRIMARY, large, green, when ready)
  - [Save Draft] (secondary)
  - [Delete Draft] (tertiary, danger)

---

## 6. READ-ONLY vs EDITABLE

| Element | Draft State | Sealed State |
|---------|-------------|--------------|
| Category/Grade/Target | Read-only (locked after creation) | Read-only |
| Allocation Mode | Read-only (locked after creation) | Read-only |
| Available Stock (LEFT) | Interactive (add sources) | Hidden |
| Allocated Sources (CENTER) | Editable (amounts, remove) | Read-only (view only) |
| Seal button | Enabled (when ready) | Hidden |
| Save Draft button | Enabled | Hidden |
| Delete Draft button | Enabled | Hidden |

---

## 7. STATE TRANSITIONS

```
┌─────────────┐
│   INDEX     │  User clicks "Create Repack Unit"
│  /repack    │  
└──────┬──────┘
       ↓
┌─────────────────────────────┐
│   WORKSPACE (NEW)           │  User defines Category/Grade/Target/Mode
│   /repack/workspace         │  
└──────┬──────────────────────┘
       ↓
┌─────────────────────────────┐
│   DRAFT (ALLOCATING)        │  User adds sources (FIFO auto / Manual)
│   /repack/workspace/:id     │  Backend creates DRAFT on first allocation
└──────┬──────────────────────┘
       ↓
┌─────────────────────────────┐
│   DRAFT (READY)             │  Allocated = Target
│   /repack/workspace/:id     │  "Seal Unit" becomes PRIMARY
└──────┬──────────────────────┘
       ↓
┌─────────────────────────────┐
│   SEALED CONFIRMATION       │  Modal with breakdown + warehouse selector
│   (Modal overlay)           │  
└──────┬──────────────────────┘
       ↓
┌─────────────────────────────┐
│   SEALED (SUCCESS)          │  Redirect to INDEX
│   /repack                   │  Toast notification
│                             │  Unit appears in "Sealed Units" tab
└─────────────────────────────┘
```

---

## 8. NAVIGATION STRUCTURE

```
/app/repack (Index)
  ├─ Tabs:
  │   ├─ Drafts (default)
  │   └─ Sealed Units
  ├─ Actions:
  │   ├─ Create Repack Unit → /app/repack/workspace
  │   ├─ Resume Draft → /app/repack/workspace/:draftId
  │   └─ View Sealed → /app/repack/units/:sealedId (read-only detail)
  
/app/repack/workspace (NEW DRAFT)
  - Persistent 3-panel layout
  - No sub-routes
  - All actions in-page
  
/app/repack/workspace/:draftId (RESUME DRAFT)
  - Same 3-panel layout
  - Pre-loaded with existing allocations
  - Can edit until sealed
  
/app/repack/units/:sealedId (SEALED VIEW - read-only)
  - Similar layout, all read-only
  - Shows allocation history
  - Shows inventory item link
  - No edit actions
```

---

## 9. CRITICAL UX RULES (NON-NEGOTIABLE)

1. **Single Workspace Rule**
   - All allocation work happens in ONE route: `/app/repack/workspace/:draftId?`
   - No fragmented micro-screens
   - No "next step" navigation

2. **One Primary Action Rule**
   - Only ONE primary action visible at a time
   - "Seal Unit" appears ONLY when draft is ready
   - All other actions are secondary/tertiary

3. **Left → Right Flow Rule**
   - Eyes move: Available Stock (LEFT) → Allocation (CENTER) → Summary (RIGHT)
   - No vertical scrolling for critical actions
   - Primary action always in RIGHT PANEL

4. **State Visibility Rule**
   - User always sees:
     * What's selected (CENTER)
     * What's available (LEFT)
     * What's the status (RIGHT)
   - No hidden state, no surprises

5. **FIFO Transparency Rule**
   - FIFO shows preview BEFORE creating draft
   - User explicitly accepts allocation
   - No "black box" automatic sealing

6. **Manual Control Rule**
   - Manual mode shows all available stock
   - [Add] action is explicit
   - Amount input is explicit
   - No drag-and-drop, no implicit selections

7. **Seal Confirmation Rule**
   - Seal ALWAYS requires:
     * Modal dialog
     * Allocation breakdown review
     * Warehouse selection
     * Explicit "Confirm Seal" button
   - No inline sealing

8. **Draft Persistence Rule**
   - Drafts auto-save on every allocation change
   - "Save Draft" button is explicit reassurance
   - User can leave/return without data loss

---

## 10. WHAT THIS ELIMINATES

❌ **REMOVED**: Separate "Create" vs "Edit Draft" screens  
✅ **REPLACED**: Single workspace for both

❌ **REMOVED**: "Sessions" concept in UI  
✅ **REPLACED**: Direct draft management

❌ **REMOVED**: Multiple action buttons scattered  
✅ **REPLACED**: Clear primary/secondary hierarchy

❌ **REMOVED**: Inline seal buttons  
✅ **REPLACED**: Modal confirmation flow

❌ **REMOVED**: Fragmented state (DRAFT → REVIEW → SEAL)  
✅ **REPLACED**: Continuous workspace (DRAFT → READY → SEALED)

❌ **REMOVED**: Hidden allocation preview (FIFO)  
✅ **REPLACED**: Explicit preview + accept flow

---

## 11. MOBILE / RESPONSIVE STRATEGY

**Desktop First (Priority 1)**
- 3-panel layout works best on ≥1280px
- LEFT/CENTER/RIGHT all visible simultaneously

**Tablet (Priority 2)**
- LEFT panel becomes collapsible sidebar
- CENTER/RIGHT remain visible
- Tap to open LEFT panel overlay

**Mobile (Priority 3)**
- Vertical stack: Definition → Allocation → Summary → Stock
- Tabs for LEFT panel content
- PRIMARY action sticks to bottom

---

## 12. TECHNICAL CONSTRAINTS (BACKEND UNCHANGED)

**What Backend Provides**:
- `/repack/units/draft` (POST) - Create draft
- `/repack/units/draft/:id` (GET/PATCH) - Manage draft
- `/repack/units/draft/:id/seal` (POST) - Seal draft
- `/repack/stock/available` (GET) - Available stock query
- `/repack/preview/fifo` (POST) - FIFO preview

**What Frontend Must Do**:
- Call preview endpoint before creating draft (FIFO mode)
- Create draft on first allocation (Manual mode) or after FIFO accept
- PATCH draft for allocation changes
- POST seal when ready

**What Changes**:
- ❌ No new endpoints
- ✅ New frontend routing structure
- ✅ New component hierarchy
- ✅ New state management pattern

---

## 13. COMPONENT STRUCTURE (HIGH-LEVEL)

```
RepackIndexPage (/app/repack)
  ├─ app-page-header (Create button)
  ├─ app-tabs (Drafts / Sealed)
  ├─ app-table (Draft list)
  └─ app-table (Sealed list)

RepackWorkspacePage (/app/repack/workspace/:draftId?)
  ├─ WorkspaceHeader (Back + Status + Primary Action)
  ├─ DefinitionBar (Category/Grade/Target - always visible)
  ├─ WorkspaceLayout (3-panel grid)
  │   ├─ LeftPanel (AvailableStockPanel)
  │   │   ├─ FiltersPanel
  │   │   └─ StockTable
  │   ├─ CenterPanel (AllocationPanel)
  │   │   ├─ AllocationTable
  │   │   └─ AddSourceButton
  │   └─ RightPanel (SummaryPanel)
  │       ├─ TargetSummary
  │       ├─ StatusBadge
  │       └─ ActionButtons
  └─ SealConfirmationModal

RepackSealedViewPage (/app/repack/units/:sealedId)
  ├─ app-page-header (Read-only indicator)
  ├─ AllocationHistoryTable (read-only)
  └─ InventoryLinkCard
```

---

## 14. APPROVAL CHECKLIST

Before implementation, confirm:

- [ ] User flow is clear: Draft → Allocate → Seal
- [ ] Single workspace pattern accepted
- [ ] Button hierarchy makes sense
- [ ] LEFT/CENTER/RIGHT panel layout approved
- [ ] FIFO preview + accept flow approved
- [ ] Manual allocation [Add] pattern approved
- [ ] Seal confirmation modal structure approved
- [ ] Navigation structure (/repack vs /repack/workspace) approved
- [ ] Data visibility (what shows where) approved
- [ ] Read-only vs editable states clear

---

## 15. IMPLEMENTATION PHASES (AFTER APPROVAL)

**Phase 1**: Navigation + Index Screen
- Create `/app/repack` index
- Implement tabs (Drafts/Sealed)
- Implement tables with Resume/View actions

**Phase 2**: Workspace Shell
- Create `/app/repack/workspace` route
- Implement 3-panel layout
- Implement DefinitionBar

**Phase 3**: FIFO Mode
- Implement preview endpoint call
- Implement LEFT panel stock loading
- Implement FIFO accept → draft creation

**Phase 4**: Manual Mode
- Implement [Add Source] flow
- Implement amount input
- Implement allocation table editing

**Phase 5**: Seal Flow
- Implement seal modal
- Implement confirmation
- Implement success handling

**Phase 6**: Polish
- Responsive breakpoints
- Loading states
- Error handling
- Animation

---

## STATUS: AWAITING APPROVAL

**Do NOT proceed with implementation until this blueprint is explicitly approved.**

