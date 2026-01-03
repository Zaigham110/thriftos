# 🔥 STEP-3 ACTION PLAN — CRITICAL FIXES
**ThriftOS Production Readiness Sprint**

---

## 🎯 OBJECTIVE

Convert ThriftOS from "mostly functional" to "ERP-grade production-safe" by fixing all state visibility, waste handling, and safety gate issues identified in STEP-3 audit.

**Target:** 5 blockers fixed in 2-3 days (20-25 hours engineering)

---

## 📋 BLOCKER #1: WASTE MANAGEMENT UI (CRITICAL)

**Priority:** 🔴 P0  
**Effort:** 8-10 hours  
**Risk:** Data loss, inaccurate yield reports

### Files to Create

#### 1. Waste Category Management (Admin)

**Path:** `thriftos-frontend/src/app/modules/admin/waste-categories/`

**New Files:**
```
waste-category-management.page.html  // Dense table + form drawer
waste-category-management.page.ts    // CRUD logic
waste-category-management.page.scss  // Styling
waste-category-form-drawer.ts        // Add/Edit drawer
```

**Structure:**
```typescript
// waste-category-management.page.ts
export class WasteCategoryManagementPage {
  categories$ = this.wasteService.getCategories();
  
  openDrawer(category?: WasteCategory) {
    this.drawer.open(WasteCategoryFormDrawerComponent, { category });
  }
  
  deleteCategory(id: number) {
    this.confirmationService.confirm({
      message: 'Delete this waste category?',
      accept: () => this.wasteService.delete(id)
    });
  }
}
```

**Template Structure:**
```html
<!-- waste-category-management.page.html -->
<app-page title="Waste Categories" [actions]="actions">
  <app-data-table
    [columns]="columns"
    [data]="categories$ | async"
    [actions]="rowActions"
  ></app-data-table>
</app-page>
```

**Backend Endpoint (VERIFY EXISTS):**
```
GET    /waste-categories          // List for tenant
POST   /waste-categories          // Create
PATCH  /waste-categories/:id      // Update
DELETE /waste-categories/:id      // Delete
```

#### 2. Waste Service (Frontend)

**Path:** `thriftos-frontend/src/app/services/waste.service.ts`

```typescript
export class WasteService {
  private readonly baseUrl = `${environment.apiUrl}/waste-categories`;
  
  getCategories(): Observable<WasteCategory[]> {
    return this.http.get<WasteCategory[]>(this.baseUrl);
  }
  
  create(dto: CreateWasteCategoryDto): Observable<WasteCategory> {
    return this.http.post<WasteCategory>(this.baseUrl, dto);
  }
  
  update(id: number, dto: UpdateWasteCategoryDto): Observable<WasteCategory> {
    return this.http.patch<WasteCategory>(`${this.baseUrl}/${id}`, dto);
  }
  
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
  
  // For sorting/grading workspaces
  getCategoriesForDropdown(): Observable<WasteCategoryOption[]> {
    return this.getCategories().pipe(
      map(cats => cats.map(c => ({ value: c.id, label: c.name })))
    );
  }
}
```

#### 3. Add Waste to Sorting Session

**Path:** `thriftos-frontend/src/app/modules/sorting-stage1/sessions/`

**Files to Modify:**
```
sorting-session-detail.page.html   // Add "Add to Waste" button + waste table
sorting-session-detail.page.ts     // Add waste methods
```

**Template Changes:**
```html
<!-- Add to RIGHT panel (Summary section) -->
<div class="summary-section">
  <h3>Waste Items</h3>
  
  <!-- Add Waste Button (always visible when OPEN) -->
  <button 
    pButton 
    label="Add to Waste" 
    icon="pi pi-trash"
    class="p-button-sm p-button-warning"
    [disabled]="session.status === 'CLOSED'"
    (click)="openWasteModal()"
  ></button>
  
  <!-- Waste Line Items Table -->
  <p-table [value]="session.wasteLineItems">
    <ng-template pTemplate="header">
      <tr>
        <th>Category</th>
        <th>Amount</th>
        <th>Actions</th>
      </tr>
    </ng-template>
    <ng-template pTemplate="body" let-item>
      <tr>
        <td>{{ item.wasteCategory.name }}</td>
        <td>{{ item.amount }} {{ item.unit }}</td>
        <td>
          <button 
            pButton 
            icon="pi pi-trash" 
            class="p-button-sm p-button-text p-button-danger"
            [disabled]="session.status === 'CLOSED'"
            (click)="deleteWasteItem(item.id)"
          ></button>
        </td>
      </tr>
    </ng-template>
  </p-table>
</div>
```

**Component Changes:**
```typescript
// sorting-session-detail.page.ts

// Add to interface
interface SessionWithWaste extends SortSession {
  wasteLineItems: WasteLineItem[];
}

openWasteModal() {
  this.dialog.open(AddWasteModalComponent, {
    data: {
      sessionId: this.session.id,
      availableAmount: this.getRemainingWeight(),
      wasteCategories: this.wasteCategories$ // Load from service
    }
  }).onClose.subscribe(result => {
    if (result) {
      this.loadSession(); // Refresh
    }
  });
}

deleteWasteItem(id: number) {
  this.confirmationService.confirm({
    message: 'Remove this waste item?',
    accept: () => {
      this.sortingService.deleteWasteItem(this.session.id, id).subscribe(() => {
        this.loadSession();
      });
    }
  });
}
```

#### 4. Add Waste Modal Component

**Path:** `thriftos-frontend/src/app/modules/sorting-stage1/sessions/add-waste-modal/`

**New Files:**
```
add-waste-modal.component.html
add-waste-modal.component.ts
add-waste-modal.component.scss
```

**Template:**
```html
<p-dialog header="Add Waste" [(visible)]="visible" [modal]="true">
  <form [formGroup]="form" (ngSubmit)="submit()">
    <div class="field">
      <label for="wasteCategory">Waste Category *</label>
      <p-dropdown 
        id="wasteCategory"
        formControlName="wasteCategoryId"
        [options]="wasteCategories"
        optionLabel="label"
        optionValue="value"
        placeholder="Select category"
      ></p-dropdown>
    </div>
    
    <div class="field">
      <label for="amount">Amount (kg) *</label>
      <input 
        pInputText 
        id="amount" 
        type="number"
        formControlName="amount"
        [max]="data.availableAmount"
      />
      <small>Available: {{ data.availableAmount }} kg</small>
    </div>
    
    <div class="field">
      <label for="remarks">Remarks</label>
      <textarea 
        pInputTextarea 
        id="remarks" 
        formControlName="remarks"
        rows="3"
      ></textarea>
    </div>
  </form>
  
  <ng-template pTemplate="footer">
    <button pButton label="Cancel" class="p-button-text" (click)="cancel()"></button>
    <button pButton label="Add Waste" [disabled]="!form.valid" (click)="submit()"></button>
  </ng-template>
</p-dialog>
```

**Component:**
```typescript
export class AddWasteModalComponent {
  form = this.fb.group({
    wasteCategoryId: [null, Validators.required],
    amount: [null, [Validators.required, Validators.min(0.01)]],
    remarks: ['']
  });
  
  constructor(
    private fb: FormBuilder,
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig
  ) {}
  
  get data() {
    return this.config.data;
  }
  
  submit() {
    if (this.form.valid) {
      this.ref.close(this.form.value);
    }
  }
}
```

#### 5. Close Session with Waste Prompt

**Path:** Modify `sorting-session-detail.page.ts`

**Add Method:**
```typescript
closeSession() {
  const remainingWeight = this.getRemainingWeight();
  
  if (remainingWeight > 0) {
    // Show waste category prompt
    this.dialog.open(CloseSessionConfirmationComponent, {
      data: {
        sessionId: this.session.id,
        remainingWeight,
        wasteCategories: this.wasteCategories$
      }
    }).onClose.subscribe(result => {
      if (result) {
        this.performClose(result.wasteCategoryId);
      }
    });
  } else {
    // No remaining weight, close directly
    this.confirmationService.confirm({
      message: 'Close this session? No further changes will be allowed.',
      accept: () => this.performClose()
    });
  }
}

private performClose(wasteCategoryId?: number) {
  this.sortingService.closeSession(this.session.id, { wasteCategoryId }).subscribe(() => {
    this.messageService.add({
      severity: 'success',
      summary: 'Session closed successfully'
    });
    this.router.navigate(['/sorting/sessions']);
  });
}
```

#### 6. Backend Endpoints (VERIFY/CREATE)

**Path:** `server/src/sorting-stage1/sort-session/`

**New Controller Methods:**
```typescript
// sort-session.controller.ts

@Post(':id/waste')
@UseGuards(JwtAuthGuard, RolePermissionGuard)
@Permissions('sorting:write')
async addWasteItem(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: AddWasteItemDto,
  @CurrentUser() user: User,
) {
  return this.sortSessionService.addWasteItem(id, dto, user);
}

@Delete(':id/waste/:wasteItemId')
@UseGuards(JwtAuthGuard, RolePermissionGuard)
@Permissions('sorting:write')
async deleteWasteItem(
  @Param('id', ParseIntPipe) id: number,
  @Param('wasteItemId', ParseIntPipe) wasteItemId: number,
  @CurrentUser() user: User,
) {
  return this.sortSessionService.deleteWasteItem(id, wasteItemId, user);
}
```

**Service Methods:**
```typescript
// sort-session.service.ts

async addWasteItem(
  sessionId: number,
  dto: AddWasteItemDto,
  user: User,
): Promise<WasteLineItem> {
  const session = await this.prisma.sortSession.findUnique({
    where: { id: sessionId }
  });
  
  if (!session) {
    throw new NotFoundException('Session not found');
  }
  
  if (session.status !== SortStatus.OPEN) {
    throw new ConflictException('Cannot add waste to CLOSED session');
  }
  
  // Create waste line item
  const wasteItem = await this.prisma.wasteLineItem.create({
    data: {
      wasteCategoryId: dto.wasteCategoryId,
      amount: dto.amount,
      unit: WasteUnitType.KG,
      stage: WasteStage.STAGE_1,
      sortSessionId: sessionId,
      tenantId: user.tenantId,
      remarks: dto.remarks,
    },
    include: { wasteCategory: true }
  });
  
  // Audit log
  await this.auditService.log({
    action: AuditAction.WASTE_ITEM_ADDED,
    entityType: 'SortSession',
    entityId: sessionId,
    userId: user.id,
    tenantId: user.tenantId,
    metadataJson: {
      wasteItemId: wasteItem.id,
      amount: dto.amount,
    },
  });
  
  return wasteItem;
}

async deleteWasteItem(
  sessionId: number,
  wasteItemId: number,
  user: User,
): Promise<void> {
  const session = await this.prisma.sortSession.findUnique({
    where: { id: sessionId }
  });
  
  if (session.status !== SortStatus.OPEN) {
    throw new ConflictException('Cannot delete waste from CLOSED session');
  }
  
  await this.prisma.wasteLineItem.delete({
    where: { id: wasteItemId }
  });
  
  await this.auditService.log({
    action: AuditAction.WASTE_ITEM_DELETED,
    entityType: 'SortSession',
    entityId: sessionId,
    userId: user.id,
    tenantId: user.tenantId,
    metadataJson: { wasteItemId },
  });
}
```

---

## 📋 BLOCKER #2: RAG STATUS VISIBILITY (CRITICAL)

**Priority:** 🔴 P0  
**Effort:** 2-3 hours  
**Risk:** Duplicate sorting attempts, data corruption

### Files to Modify

#### 1. Container Detail Page

**Path:** `thriftos-frontend/src/app/modules/procurement/containers/container-detail.page.html`

**Changes:**
```html
<!-- Add status column to rags table -->
<p-table [value]="container.rags">
  <ng-template pTemplate="header">
    <tr>
      <th>Code</th>
      <th>Total Weight</th>
      <th>Status</th>  <!-- NEW -->
      <th>Actions</th>
    </tr>
  </ng-template>
  <ng-template pTemplate="body" let-rag>
    <tr>
      <td>{{ rag.ragCode }}</td>
      <td>{{ rag.totalWeight }} kg</td>
      <td>
        <!-- NEW: Status badge -->
        <p-tag 
          [value]="rag.status" 
          [severity]="getRagStatusSeverity(rag.status)"
        ></p-tag>
      </td>
      <td>
        <button 
          pButton 
          label="Start Sorting" 
          icon="pi pi-arrow-right"
          class="p-button-sm"
          [disabled]="!canStartSorting(rag)"
          [pTooltip]="getSortingTooltip(rag)"
          (click)="startSorting(rag)"
        ></button>
      </td>
    </tr>
  </ng-template>
</p-table>
```

**Component:**
```typescript
// container-detail.page.ts

getRagStatusSeverity(status: RagStatus): string {
  const severityMap = {
    'NOT_STARTED': 'info',
    'IN_SORTING': 'warning',
    'SORTED': 'success'
  };
  return severityMap[status] || 'info';
}

canStartSorting(rag: Rag): boolean {
  return rag.status === 'NOT_STARTED' && this.container.status !== 'CLOSED';
}

getSortingTooltip(rag: Rag): string {
  if (rag.status === 'IN_SORTING') {
    return 'This rag is currently being sorted';
  }
  if (rag.status === 'SORTED') {
    return 'This rag has already been sorted';
  }
  if (this.container.status === 'CLOSED') {
    return 'Container is closed';
  }
  return 'Start sorting session for this rag';
}

startSorting(rag: Rag) {
  if (!this.canStartSorting(rag)) {
    return;
  }
  this.router.navigate(['/sorting/sessions', 'new'], {
    queryParams: { ragId: rag.id }
  });
}
```

---

## 📋 BLOCKER #3: GRADING OUTPUT STATUS (CRITICAL)

**Priority:** 🔴 P0  
**Effort:** 4-6 hours  
**Risk:** Invalid repack data flow

### Files to Modify

#### 1. Sorting Outputs Page

**Path:** `thriftos-frontend/src/app/modules/sorting/outputs/sorting-outputs.page.html`

**Changes:**
```html
<p-table [value]="outputs$ | async">
  <ng-template pTemplate="header">
    <tr>
      <th>Category</th>
      <th>Grade</th>
      <th>Amount</th>
      <th>Status</th>  <!-- NEW -->
      <th>Actions</th>
    </tr>
  </ng-template>
  <ng-template pTemplate="body" let-output>
    <tr>
      <td>{{ output.category.name }}</td>
      <td>{{ output.grade.name }}</td>
      <td>{{ output.allocatedAmount }} kg</td>
      <td>
        <!-- NEW: Status badge -->
        <p-tag 
          [value]="output.status" 
          [severity]="getOutputStatusSeverity(output.status)"
        ></p-tag>
      </td>
      <td>
        <!-- NEW: Mark Ready button -->
        <button 
          pButton 
          label="Mark Ready for Repack" 
          icon="pi pi-check"
          class="p-button-sm p-button-success"
          *ngIf="output.status === 'AVAILABLE'"
          (click)="markReadyForRepack(output.id)"
        ></button>
        
        <button 
          pButton 
          label="Start Grading" 
          icon="pi pi-arrow-right"
          class="p-button-sm"
          [disabled]="output.status !== 'AVAILABLE'"
          (click)="startGrading(output)"
        ></button>
      </td>
    </tr>
  </ng-template>
</p-table>
```

**Component:**
```typescript
// sorting-outputs.page.ts

getOutputStatusSeverity(status: GradingOutputStatus): string {
  const severityMap = {
    'AVAILABLE': 'info',
    'PARTIALLY_USED': 'warning',
    'DEPLETED': 'danger',
    'READY_FOR_REPACK': 'success'
  };
  return severityMap[status] || 'info';
}

markReadyForRepack(outputId: number) {
  this.confirmationService.confirm({
    message: 'Mark this output as READY FOR REPACK? This will make it available in repack workspace.',
    accept: () => {
      this.sortingService.markOutputReadyForRepack(outputId).subscribe(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Output marked as ready for repack'
        });
        this.loadOutputs();
      });
    }
  });
}
```

#### 2. Backend Endpoint

**Path:** `server/src/sorting-stage2/grade-output/grade-output.controller.ts`

**New Endpoint:**
```typescript
@Patch(':id/mark-ready')
@UseGuards(JwtAuthGuard, RolePermissionGuard)
@Permissions('sorting:write')
async markReadyForRepack(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: User,
) {
  return this.gradeOutputService.markReadyForRepack(id, user);
}
```

**Service Method:**
```typescript
// grade-output.service.ts

async markReadyForRepack(id: number, user: User): Promise<GradingOutput> {
  const output = await this.prisma.gradingOutput.findUnique({
    where: { id },
    include: { gradeSession: true }
  });
  
  if (!output) {
    throw new NotFoundException('Output not found');
  }
  
  if (output.gradeSession.status !== GradeStatus.CLOSED) {
    throw new ConflictException('Cannot mark output as ready: grading session is still OPEN');
  }
  
  if (output.status === GradingOutputStatus.DEPLETED) {
    throw new ConflictException('Cannot mark DEPLETED output as ready');
  }
  
  const updated = await this.prisma.gradingOutput.update({
    where: { id },
    data: { status: GradingOutputStatus.READY_FOR_REPACK },
    include: { category: true, grade: true }
  });
  
  await this.auditService.log({
    action: AuditAction.OUTPUT_MARKED_READY,
    entityType: 'GradingOutput',
    entityId: id,
    userId: user.id,
    tenantId: user.tenantId,
  });
  
  return updated;
}
```

#### 3. Repack Available Stock Filter

**Path:** `server/src/repack/shared/repack-allocation.service.ts`

**Update Query (Line ~281):**
```typescript
// FROM:
where: {
  tenantId,
  categoryId,
  gradeId,
  allocatedAmount: { gt: 0 },
  status: { not: GradingOutputStatus.DEPLETED },
}

// TO:
where: {
  tenantId,
  categoryId,
  gradeId,
  allocatedAmount: { gt: 0 },
  status: GradingOutputStatus.READY_FOR_REPACK,  // STRICT filter
}
```

---

## 📋 BLOCKER #4: REPACK SEAL VALIDATION (HIGH)

**Priority:** 🟡 P1  
**Effort:** 2-3 hours  
**Risk:** Premature sealing, inventory errors

### Files to Modify

**Path:** `thriftos-frontend/src/app/modules/repack/workspace/repack-workspace.page.html`

**Changes:**
```html
<!-- Status badges -->
<div class="status-badges">
  <p-tag 
    [value]="unit.status" 
    [severity]="getRepackStatusSeverity(unit.status)"
  ></p-tag>
  
  <!-- Show READY badge when target met -->
  <p-tag 
    value="READY TO SEAL" 
    severity="success"
    *ngIf="isReadyToSeal()"
  ></p-tag>
</div>

<!-- Seal button (only visible when READY) -->
<button 
  pButton 
  label="Seal Unit" 
  icon="pi pi-lock"
  class="p-button-lg p-button-success"
  [disabled]="!isReadyToSeal()"
  [pTooltip]="getSealTooltip()"
  (click)="sealWithConfirmation()"
></button>
```

**Component:**
```typescript
// repack-workspace.page.ts

isReadyToSeal(): boolean {
  return (
    this.unit.status === 'DRAFT' &&
    this.unit.allocatedAmount >= this.unit.targetAmount &&
    this.unit.allocations.length > 0
  );
}

getSealTooltip(): string {
  if (this.unit.status === 'SEALED') {
    return 'Unit is already sealed';
  }
  if (this.unit.allocatedAmount < this.unit.targetAmount) {
    const shortfall = this.unit.targetAmount - this.unit.allocatedAmount;
    return `Cannot seal: ${shortfall} kg short of target`;
  }
  if (this.unit.allocations.length === 0) {
    return 'Cannot seal: No allocations added';
  }
  return 'Seal this unit and create inventory item';
}

sealWithConfirmation() {
  if (!this.isReadyToSeal()) {
    return;
  }
  
  this.confirmationService.confirm({
    header: 'Seal Unit',
    message: `
      Target: ${this.unit.targetAmount} ${this.unit.measurementType}
      Allocated: ${this.unit.allocatedAmount} ${this.unit.measurementType}
      
      Seal this unit? This action is IRREVERSIBLE.
    `,
    accept: () => {
      this.repackService.seal(this.unit.id).subscribe(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Unit sealed successfully',
          detail: 'Inventory item created'
        });
        this.router.navigate(['/repack']);
      });
    }
  });
}
```

---

## 📋 BLOCKER #5: SORTING → REPACK SAFETY GATE (HIGH)

**Priority:** 🟡 P1  
**Effort:** 4-5 hours  
**Risk:** Invalid data flow

### Files to Create

#### 1. Repack Safety Service (Backend)

**Path:** `server/src/repack/v3/repack-safety.service.ts`

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GradingOutputStatus, GradeStatus, WasteStage } from '@prisma/client';

interface SafetyCheckResult {
  safe: boolean;
  issues: string[];
}

@Injectable()
export class RepackSafetyService {
  constructor(private readonly prisma: PrismaService) {}
  
  async validateRepackEntry(
    categoryId: number,
    gradeId: number,
    tenantId: number,
  ): Promise<SafetyCheckResult> {
    const issues: string[] = [];
    
    // Check 1: Ensure grading session is CLOSED
    const openGradeSessions = await this.prisma.gradeSession.count({
      where: {
        tenantId,
        categoryOutputId: {
          in: await this.prisma.categoryOutput.findMany({
            where: { tenantId, categoryId },
            select: { id: true }
          }).then(outputs => outputs.map(o => o.id))
        },
        status: GradeStatus.OPEN,
      }
    });
    
    if (openGradeSessions > 0) {
      issues.push('Open grading sessions exist for this category');
    }
    
    // Check 2: Ensure GradingOutputs are READY_FOR_REPACK
    const notReadyOutputs = await this.prisma.gradingOutput.count({
      where: {
        tenantId,
        categoryId,
        gradeId,
        status: { not: GradingOutputStatus.READY_FOR_REPACK }
      }
    });
    
    if (notReadyOutputs > 0) {
      issues.push(`${notReadyOutputs} grading output(s) not marked as READY_FOR_REPACK`);
    }
    
    // Check 3: Ensure no open waste items in Stage-1
    const openWasteStage1 = await this.prisma.wasteLineItem.count({
      where: {
        tenantId,
        stage: WasteStage.STAGE_1,
        sortSession: {
          rag: { categoryId }
        }
      }
    });
    
    if (openWasteStage1 > 0) {
      issues.push(`${openWasteStage1} unprocessed waste item(s) in Stage-1 for this category`);
    }
    
    return {
      safe: issues.length === 0,
      issues
    };
  }
}
```

#### 2. Repack Safety Controller

**Path:** `server/src/repack/v3/repack-v3.controller.ts`

**Add Endpoint:**
```typescript
@Get('safety-check')
@UseGuards(JwtAuthGuard, RolePermissionGuard)
@Permissions('repack:read')
async safetyCheck(
  @Query('categoryId', ParseIntPipe) categoryId: number,
  @Query('gradeId', ParseIntPipe) gradeId: number,
  @CurrentUser() user: User,
) {
  return this.repackSafetyService.validateRepackEntry(
    categoryId,
    gradeId,
    user.tenantId
  );
}
```

#### 3. Frontend Safety Check

**Path:** `thriftos-frontend/src/app/modules/repack/workspace/repack-workspace.page.ts`

**Add to ngOnInit:**
```typescript
ngOnInit() {
  this.route.queryParams.subscribe(params => {
    if (params['categoryId'] && params['gradeId']) {
      // NEW: Safety check before entering workspace
      this.checkSafetyGate(params['categoryId'], params['gradeId']);
    }
  });
}

private checkSafetyGate(categoryId: number, gradeId: number) {
  this.repackService.safetyCheck(categoryId, gradeId).subscribe(result => {
    if (!result.safe) {
      this.confirmationService.confirm({
        header: 'Cannot Start Repack',
        message: `
          The following issues prevent repack:
          ${result.issues.map(i => `• ${i}`).join('\n')}
          
          Please resolve these issues before starting repack.
        `,
        rejectVisible: false,
        acceptLabel: 'Go Back',
        accept: () => {
          this.router.navigate(['/repack']);
        }
      });
    } else {
      // Safe to proceed
      this.loadWorkspace(categoryId, gradeId);
    }
  });
}
```

---

## ✅ TESTING CHECKLIST

After implementing all fixes, perform these manual tests:

### Test 1: Waste Management End-to-End
- [ ] Navigate to `/admin/waste-categories`
- [ ] Create 3 waste categories: "Unusable", "Damaged", "Mixed"
- [ ] Start sorting session
- [ ] Add 50 kg to category bucket
- [ ] Add 10 kg to waste (category: "Damaged")
- [ ] Verify waste appears in RIGHT panel
- [ ] Close session with 40 kg remaining
- [ ] Verify prompt: "Remaining 40 kg will be marked as waste. Select category:"
- [ ] Select "Unusable" and confirm
- [ ] Verify waste report shows 50 kg total waste

### Test 2: Rag Status Visibility
- [ ] Navigate to container detail with 3 rags
- [ ] Verify all rags show status: NOT_STARTED
- [ ] Start sorting for Rag #1
- [ ] Go back to container detail
- [ ] Verify Rag #1 status: IN_SORTING
- [ ] Verify "Start Sorting" button is disabled with tooltip
- [ ] Close sorting session
- [ ] Verify Rag #1 status: SORTED
- [ ] Verify cannot start sorting again

### Test 3: GradingOutput Status Lifecycle
- [ ] Navigate to sorting outputs
- [ ] Start grading session for a category output
- [ ] Close grading session
- [ ] Verify output status: AVAILABLE
- [ ] Click "Mark Ready for Repack"
- [ ] Verify status changes to READY_FOR_REPACK
- [ ] Navigate to repack workspace
- [ ] Verify only READY_FOR_REPACK outputs appear in available stock

### Test 4: Repack Seal Validation
- [ ] Create new repack unit (target: 100 kg)
- [ ] Verify status: DRAFT
- [ ] Verify "Seal" button is disabled
- [ ] Add 50 kg allocation
- [ ] Verify "Seal" button still disabled (tooltip: "50 kg short")
- [ ] Add 50 kg more
- [ ] Verify status badge: READY TO SEAL
- [ ] Verify "Seal" button is enabled
- [ ] Click "Seal" → verify confirmation dialog shows target vs allocated
- [ ] Confirm seal → verify status: SEALED
- [ ] Verify inventory item created

### Test 5: Safety Gate
- [ ] Start sorting session (Stage-1) for Category A
- [ ] Close session without adding to waste (remaining weight)
- [ ] Try to start repack for Category A, Grade 1
- [ ] Verify blocking dialog: "Unprocessed waste items in Stage-1"
- [ ] Go back, resolve waste
- [ ] Try repack again → verify can proceed

---

## 📅 IMPLEMENTATION TIMELINE

### Day 1 (8 hours)
- **Morning (4h):** Waste Management UI
  - Waste category admin page
  - Waste service
  - Add waste button + modal in sorting workspace
- **Afternoon (4h):** Waste Backend
  - Waste endpoints
  - Close session with waste prompt
  - Testing waste flow

### Day 2 (8 hours)
- **Morning (3h):** Rag Status Visibility
  - Container detail changes
  - Status badges
  - Disabled button logic
- **Afternoon (5h):** GradingOutput Status
  - Sorting outputs page changes
  - Mark ready endpoint
  - Repack available stock filter
  - Testing output lifecycle

### Day 3 (6 hours)
- **Morning (3h):** Repack Seal Validation
  - Status badges (DRAFT | READY | SEALED)
  - Seal confirmation dialog
  - Target vs allocated validation
- **Afternoon (3h):** Safety Gate
  - Repack safety service
  - Safety check endpoint
  - Frontend safety gate logic
  - End-to-end testing

---

## 🎯 COMPLETION CRITERIA

STEP-3 is complete when:

- ✅ All 5 blockers fixed and deployed
- ✅ Manual testing checklist passed (100%)
- ✅ Zero console errors in production build
- ✅ Audit report shows 100% module compliance
- ✅ Operators can complete end-to-end workflow without training

---

**END OF ACTION PLAN**
