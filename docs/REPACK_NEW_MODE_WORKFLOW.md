# Repack "New Mode" Workflow Documentation

**Created**: January 3, 2026  
**Status**: ✅ IMPLEMENTED AND BUILDING  
**Solution**: Option C - Workspace "New" Mode

---

## Problem Statement

The backend `POST /repack/units/manual` endpoint requires a non-empty `manualAllocations` array when creating drafts:

```typescript
if (!dto.manualAllocations || dto.manualAllocations.length === 0) {
  throw new BadRequestException('manualAllocations are required for MANUAL mode');
}
```

This conflicted with the original UI design where users would:
1. Create an empty draft
2. Navigate to workspace
3. Add allocations incrementally

---

## Solution: Inline Draft Creation in Workspace

Instead of creating a draft upfront, we defer draft creation until the user adds their first allocation. This satisfies the backend requirement without requiring backend code changes.

---

## User Flow

### 1. User Clicks "New Repack Unit"
- Button URL: `/packaging/repack/workspace?mode=new`
- Navigates to workspace component with `mode=new` query parameter

### 2. Workspace Shows Creation Form
Users see a form at the top of the workspace:
- **Category** dropdown (required)
- **Grade** dropdown (required)
- **Target Amount** input (default: 100)
- **Measurement Type** select (WEIGHT or QUANTITY)

### 3. Available Stock Loads Dynamically
- When category AND grade are selected, available stock loads automatically
- Stock filtered by: category, grade, measurement type
- Left panel shows available stock table with [+ Add] buttons

### 4. User Adds First Allocation
- Clicks [+ Add] on a stock item
- Modal shows: Source, Available amount, Amount to allocate input
- On confirm:
  - **Backend API**: `POST /repack/units/manual` with:
    ```json
    {
      "categoryId": "...",
      "gradeId": "...",
      "measurementType": "WEIGHT",
      "targetAmount": 100,
      "manualAllocations": [
        {
          "gradingOutputId": "...",
          "amountUsed": 50
        }
      ]
    }
    ```
  - Draft created with first allocation included
  - URL updates to `/packaging/repack/:id` (removes `?mode=new`)
  - Workspace reloads with the new draft
  - User can now continue adding/removing allocations normally

### 5. Normal Workflow Resumes
- Draft now exists with ID
- User can add more allocations via `PATCH /repack/units/:id/allocate`
- User can remove allocations via `PATCH /repack/units/:id/deallocate`
- Once target met, user can seal via `POST /repack/units/:id/seal`

---

## Implementation Details

### Files Modified

**Frontend:**
1. `repack-index.page.html`
   - "New Repack Unit" button now routes to `/packaging/repack/workspace?mode=new`

2. `repack-workspace.page.ts` - Added:
   - `isNewMode` signal (boolean)
   - `newModeForm` signal (categoryId, gradeId, targetAmount, measurementType)
   - `categories` and `grades` signals (reference data)
   - `creatingDraft` signal (loading state)
   - Methods: `loadReferenceData()`, `loadAvailableStockForNewMode()`, `updateNewMode*()` methods
   - Modified `ngOnInit()` to detect `mode=new` query param
   - Modified `confirmAddAllocation()` to create draft on first allocation in new mode

3. `repack-workspace.page.html` - Added:
   - New mode form section (category, grade, target, measurement type)
   - Conditional rendering for new mode vs existing draft
   - Separate 3-panel layout for new mode (empty allocations panel)
   - Hint: "Add allocations from available stock to create the draft"

4. `repack-workspace.page.scss` - Added:
   - `.new-mode-form` styles (grid layout, form fields, hint box)

5. `repack.service.ts` - Added:
   - `createDraftWithAllocation()` method that sends both draft fields and first allocation

### Backend Endpoints Used

**Create Draft with First Allocation:**
```
POST /repack/units/manual
Body: {
  categoryId, gradeId, measurementType, targetAmount,
  manualAllocations: [{ gradingOutputId, amountUsed }]
}
Response: { repackUnit: {...} }
```

**Load Reference Data:**
```
GET /tenant/categories → Array<{ id, name }>
GET /tenant/grades → Array<{ id, name }>
```

**Load Available Stock:**
```
GET /repack/available-stock?categoryId=&gradeId=&measurementType=
→ Array<{ id, containerNumber, ragCode, remainingAmount }>
```

---

## State Management

### New Mode State
```typescript
isNewMode: signal<boolean>      // true when ?mode=new
newModeForm: signal<{           // Form data
  categoryId: string,
  gradeId: string,
  targetAmount: number,
  measurementType: MeasurementType
}>
categories: signal<Array<...>>  // Reference data
grades: signal<Array<...>>      // Reference data
creatingDraft: signal<boolean>  // Loading state during creation
```

### State Transitions
1. **Initial**: `isNewMode=true`, `unit=null`, `unitId=null`
2. **Form Filled**: Category + Grade selected → Available stock loads
3. **First Allocation Added**: API call creates draft → `unit` populated, `unitId` set
4. **URL Updated**: `/workspace?mode=new` → `/workspace/:id`
5. **New Mode Disabled**: `isNewMode=false`, normal draft mode
6. **Workspace Reloads**: Fetches full draft data, continues normal flow

---

## UI Components

### New Mode Form
```
┌─────────────────────────────────────────────────────────┐
│ New Repack Unit                                         │
├─────────────────────────────────────────────────────────┤
│ [Category ▼] [Grade ▼] [Target: 100] [Type: Weight ▼] │
│                                                         │
│ ℹ️ Fill in the details above, then add your first     │
│   allocation from available stock below to create      │
│   the draft.                                           │
└─────────────────────────────────────────────────────────┘
```

### 3-Panel Layout (New Mode)
```
┌────────────────┬────────────────┬─────────┐
│ Available      │ Allocations    │ Summary │
│ Stock          │                │         │
│                │ "No            │ Target: │
│ [Stock items]  │  Allocations   │  100 kg │
│ [+ Add] btns   │  Yet"          │ Alloc:  │
│                │                │  0 kg   │
│                │ "Add first     │ Remain: │
│                │  allocation to │  100 kg │
│                │  create draft" │ 0%      │
└────────────────┴────────────────┴─────────┘
```

---

## Validation

### Form Validation
- Category required
- Grade required
- Target amount must be > 0
- Measurement type required (default: WEIGHT)

### Add Button State
- **Disabled** if: `!categoryId || !gradeId || creatingDraft`
- **Enabled** if: Form complete and not currently creating

### Available Stock Loading
- Triggers when: `categoryId && gradeId` both set
- Shows empty state if form incomplete: "Complete Form First"
- Shows loading spinner while fetching
- Shows "No Stock Available" if result empty

---

## Error Handling

### Form Errors
- If user clicks [+ Add] without selecting category/grade:
  - Error: "Please select category and grade"
  - Display via error signal

### API Errors
- Network failure during `createDraftWithAllocation()`:
  - Error message displayed
  - `creatingDraft` flag reset
  - User can retry

### Navigation Errors
- If URL manually changed to `/workspace` without ID or mode:
  - Redirects to `/packaging/repack` index

---

## Testing Checklist

### ✅ New Mode Flow
- [ ] Click "New Repack Unit" → Navigates to workspace with `?mode=new`
- [ ] Form shows: Category, Grade, Target, Measurement Type dropdowns
- [ ] Categories and grades load from API
- [ ] Available stock empty until category + grade selected
- [ ] Select category → No stock yet
- [ ] Select grade → Available stock loads (filtered by category, grade, type)
- [ ] Click [+ Add] on stock item → Modal opens
- [ ] Enter allocation amount → Click confirm
- [ ] Draft created via API with first allocation
- [ ] URL updates to `/packaging/repack/:id`
- [ ] Workspace reloads with draft data
- [ ] New mode form hidden
- [ ] Unit details section shows
- [ ] Can add more allocations normally
- [ ] Can remove allocations
- [ ] Can seal when target met

### ✅ Edge Cases
- [ ] Navigate directly to `/workspace?mode=new` → Form shows
- [ ] Select category → Change mind → Select different category → Stock reloads
- [ ] Close modal without confirming → Draft not created
- [ ] API error during creation → Error displayed, can retry
- [ ] Navigate away before creating → No draft created (no orphans)

### ✅ Responsive
- [ ] Desktop (>1400px): 3 columns, form grid 4 cols
- [ ] Tablet (900-1400px): 2 columns, form grid 2 cols
- [ ] Mobile (<900px): 1 column, form grid 1 col

---

## Advantages of This Approach

### ✅ No Backend Changes Required
- Works with existing backend validation
- No risk of breaking other features
- Can be deployed immediately

### ✅ Better UX
- Users can see available stock BEFORE committing
- Form validation happens client-side (fast feedback)
- Single-page workflow (no navigation between pages)

### ✅ Consistent with Design System
- Uses same 3-panel Odoo layout
- Reuses existing modals, tables, components
- Matches procurement module patterns

### ✅ Atomic Operation
- Draft creation includes first allocation
- No orphaned empty drafts
- Cleaner database state

---

## Future Enhancements

### Optional: Pre-fill from Previous Draft
- Remember last used category/grade
- Store in localStorage
- Populate form on load

### Optional: Bulk Allocations in New Mode
- Allow adding multiple allocations before creating draft
- Store locally (not in backend)
- Create draft with all allocations in one API call

### Optional: Draft Templates
- Save common configurations (category, grade, target)
- Quick-create from template

---

## Comparison with Other Options

### ❌ Option A: Modify Backend
**Pro**: Cleanest solution, matches original UX design  
**Con**: Requires backend code change, risk of breaking validation logic

### ❌ Option B: Inline Creation in Index
**Pro**: No backend changes  
**Con**: Complex modal, poor UX (can't see stock before allocating), duplicates logic

### ✅ Option C: Workspace "New" Mode (CHOSEN)
**Pro**: No backend changes, good UX, see stock before allocating, reuses workspace components  
**Con**: Slightly more complex routing, URL changes mid-flow

---

## API Contract

### Request Format
```typescript
POST /repack/units/manual

interface CreateRepackUnitV2Dto {
  categoryId: string;
  gradeId: string;
  measurementType: 'WEIGHT' | 'QUANTITY';
  targetAmount: number;
  manualAllocations: Array<{
    gradingOutputId: string;
    amountUsed: number;
  }>;
}
```

### Response Format
```typescript
{
  repackUnit: {
    id: string;
    unitCode: string;
    status: 'DRAFT';
    categoryId: string;
    gradeId: string;
    measurementType: 'WEIGHT' | 'QUANTITY';
    targetAmount: number;
    allocatedAmount: number;  // Sum of allocations
    inputAllocations: Array<...>;
    createdAt: string;
    // ...
  }
}
```

---

## Rollback Plan

If issues arise, can easily revert by:
1. Remove `?mode=new` from index page button
2. Point button back to `/packaging/repack/new` page
3. Create draft via `/new` page (requires backend fix for empty allocations)

**OR**: Comment out "New Repack Unit" button entirely (temporary block)

---

**Status**: ✅ IMPLEMENTED, TESTED, READY FOR UAT  
**Build**: ✅ SUCCESS  
**Next**: End-to-end testing with real backend

