# AllocationMode Field Removal - Fix Applied

**Date**: January 3, 2026  
**Issue**: Backend validation error: "allocationMode must be one of the following values: FIFO, MANUAL"  
**Root Cause**: `allocationMode` field still required in CreateRepackUnitV2Dto after FIFO deletion

---

## Problem

After deleting FIFO code, the backend DTO still required clients to send `allocationMode` field with every draft creation request. This was unnecessary since only MANUAL mode is supported now.

**Error Message:**
```
allocationMode must be one of the following values: FIFO, MANUAL
```

---

## Solution Applied

### Backend Changes

**File: `server/src/repack/repack-unit/dto/create-repack-unit-v2.dto.ts`**

**Before:**
```typescript
import { AllocationMode, MeasurementType } from '@prisma/client';

export class CreateRepackUnitV2Dto {
  // ... other fields
  
  @IsEnum(AllocationMode)
  allocationMode: AllocationMode;  // ❌ Required field
  
  @IsOptional()
  @IsArray()
  manualAllocations?: ManualAllocationDto[];
}
```

**After:**
```typescript
import { MeasurementType } from '@prisma/client';  // ✅ Removed AllocationMode import

export class CreateRepackUnitV2Dto {
  // ... other fields
  
  // allocationMode removed - always MANUAL now (FIFO deleted)
  
  @IsOptional()
  @IsArray()
  manualAllocations?: ManualAllocationDto[];
}
```

**File: `server/src/repack/v3/repack-v3.service.ts`**

**Before:**
```typescript
async createDraftManual(tenantId: string, dto: CreateRepackUnitV2Dto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    this.assertDraftInputs(dto);
    if (dto.allocationMode !== AllocationMode.MANUAL) {  // ❌ Validation check
      throw new BadRequestException('allocationMode must be MANUAL');
    }
    // ...
  });
}
```

**After:**
```typescript
async createDraftManual(tenantId: string, dto: CreateRepackUnitV2Dto, userId: string) {
  return this.prisma.$transaction(async (tx) => {
    this.assertDraftInputs(dto);
    // allocationMode validation removed - always MANUAL (FIFO deleted)  ✅
    // ...
  });
}
```

**Note:** The service still creates units with `allocationMode: AllocationMode.MANUAL` hardcoded in the Prisma create statement. The field exists in the database schema but is no longer exposed in the API contract.

### Frontend (No Changes Needed)

The frontend `createDraftWithAllocation()` method was already correct - it never sent `allocationMode`:

```typescript
createDraftWithAllocation(dto, firstAllocation) {
  const body = {
    categoryId: dto.categoryId,
    gradeId: dto.gradeId,
    measurementType: dto.measurementType,
    targetAmount: dto.targetAmount,
    manualAllocations: [firstAllocation]
    // ✅ No allocationMode sent
  };
  return this.http.post(`${API}/units/manual`, body);
}
```

---

## API Contract Change

### Before (Required allocationMode)
```typescript
POST /api/repack/units/manual
{
  "categoryId": "cat-123",
  "gradeId": "grade-456",
  "measurementType": "WEIGHT",
  "targetAmount": 100,
  "allocationMode": "MANUAL",  // ❌ Required
  "manualAllocations": [
    { "gradingOutputId": "go-789", "amountUsed": 50 }
  ]
}
```

### After (allocationMode removed)
```typescript
POST /api/repack/units/manual
{
  "categoryId": "cat-123",
  "gradeId": "grade-456",
  "measurementType": "WEIGHT",
  "targetAmount": 100,
  // allocationMode removed ✅
  "manualAllocations": [
    { "gradingOutputId": "go-789", "amountUsed": 50 }
  ]
}
```

---

## Verification

### Backend Build
```bash
cd server
npm run build
# ✅ SUCCESS - No TypeScript errors
```

### Backend Server
```bash
npm run start
# ✅ Server running on http://localhost:3000/api
# ✅ All routes mapped including POST /api/repack/units/manual
```

### API Endpoint
```
POST /api/repack/units/manual
- No longer requires allocationMode field
- Automatically uses MANUAL mode internally
- Frontend can create drafts without validation error
```

---

## Impact Analysis

### Breaking Change: NO
- Frontend was already not sending `allocationMode`
- Only affects external API clients (if any)
- Migration: Simply remove `allocationMode` from request body

### Database Schema: Unchanged
- `RepackUnit.allocationMode` column still exists in database
- Always set to 'MANUAL' by the service
- Could be removed in future migration if needed

### Related Code: Safe
- No other DTOs affected
- Old FIFO methods already deleted
- Service layer hardcodes MANUAL mode

---

## Files Modified

```
server/src/
├── repack/
│   ├── repack-unit/dto/create-repack-unit-v2.dto.ts  ✅ Removed field + import
│   └── v3/repack-v3.service.ts                       ✅ Removed validation
```

---

## Testing Checklist

### ✅ Backend
- [x] Build successful (no TypeScript errors)
- [x] Server starts successfully
- [x] Endpoint `/api/repack/units/manual` exists
- [ ] POST request without `allocationMode` succeeds
- [ ] Draft created with `allocationMode: 'MANUAL'` in database

### ⏳ Frontend
- [ ] Start Angular dev server
- [ ] Navigate to `/packaging/repack`
- [ ] Click "New Repack Unit"
- [ ] Fill form (category, grade, target)
- [ ] Add first allocation → Draft created successfully
- [ ] No validation error about `allocationMode`

---

## Rollback Plan

If issues arise, revert both files:

```bash
git diff HEAD server/src/repack/repack-unit/dto/create-repack-unit-v2.dto.ts
git diff HEAD server/src/repack/v3/repack-v3.service.ts
git checkout HEAD -- server/src/repack/repack-unit/dto/create-repack-unit-v2.dto.ts
git checkout HEAD -- server/src/repack/v3/repack-v3.service.ts
npm run build
npm run start
```

---

## Next Steps

1. ✅ Backend build successful
2. ✅ Backend server running
3. ⏳ Start frontend server
4. ⏳ Test full workflow:
   - Create new repack unit
   - Add first allocation (creates draft)
   - Verify no `allocationMode` errors
   - Add more allocations
   - Seal unit
5. ⏳ Complete STEP 3 testing checklist

---

**Status**: ✅ Fix Applied and Backend Running  
**Next**: Test frontend integration

