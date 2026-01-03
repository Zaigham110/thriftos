# Inventory Module - Quick Reference

## API Endpoints

### `GET /inventory/summary`
Returns KPIs: total items, weight, pcs, warehouse count
```typescript
{ totalItems: 150, totalWeight: 2500.5, totalPcs: 3200, warehouseCount: 3 }
```

### `GET /inventory`
List inventory items with optional filters
**Query Params:**
- `categoryId` - Filter by category
- `gradeId` - Filter by grade
- `warehouseId` - Filter by warehouse
- `status` - Filter by status (AVAILABLE, MOVED, CONSUMED)
- `startDate` - Filter by created after date
- `endDate` - Filter by created before date
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

### `GET /inventory/:id`
Get single inventory item with relations

### `GET /inventory/:id/traceability`
Get full traceability chain back to source

---

## Frontend Routes

- `/inventory` - Index page (card grid)
- `/inventory/:id` - Detail page (traceability)

---

## Permissions Required

- `INVENTORY_VIEW` - Required for ALL endpoints

---

## Data Flow

```
User Seals Repack Unit
        ↓
RepackService.seal()
        ↓
InventoryItem Created (atomic)
        ↓
Visible in /inventory
        ↓
User views detail
        ↓
Traceability loaded
```

---

## Key Design Decisions

1. **Read-Only:** NO mutations allowed
2. **Atomic Creation:** Only created on repack seal
3. **Card-Based UI:** NO dense tables as primary
4. **Traceability:** Full chain back to vendor
5. **Design Match:** Follows Procurement module density

---

## Component Structure

```
inventory/
├── inventory.models.ts (interfaces)
├── inventory.service.ts (HTTP client)
├── inventory.routes.ts (routing)
├── index/
│   ├── inventory-index.page.ts (list component)
│   ├── inventory-index.page.html (card grid template)
│   └── inventory-index.page.scss (styles)
└── detail/
    ├── inventory-detail.page.ts (detail component)
    ├── inventory-detail.page.html (traceability timeline)
    └── inventory-detail.page.scss (styles)
```

---

## Usage Examples

### Backend - Get Inventory List
```typescript
@Get()
@UseGuards(TenantGuard, PermissionGuard)
@RequirePermissions(Permission.INVENTORY_VIEW)
async findAll(@Query() filters: any) {
  return this.inventoryService.findAll(filters);
}
```

### Frontend - Load Items
```typescript
loadItems(): void {
  const params = {
    categoryId: this.filters.categoryId(),
    gradeId: this.filters.gradeId(),
    page: this.currentPage().toString(),
    limit: '20'
  };
  
  this.inventoryService.getAll(params).subscribe({
    next: (items) => this.items.set(items),
    error: (err) => this.error.set(err.message)
  });
}
```

### Frontend - View Detail
```typescript
viewDetails(item: InventoryItem): void {
  this.router.navigate(['/inventory', item.id]);
}
```

---

## Common Patterns

### Signal-Based State
```typescript
readonly items = signal<InventoryItem[]>([]);
readonly loading = signal(false);
readonly error = signal<string | null>(null);
```

### Permission Check
```typescript
readonly hasPermission = computed(() => 
  this.authService.hasPermission(Permission.INVENTORY_VIEW)
);
```

### Filter Application
```typescript
applyFilters(): void {
  this.currentPage.set(1);
  this.loadItems();
}
```

---

## Troubleshooting

### "Permission Denied" Error
- Ensure user has `INVENTORY_VIEW` permission
- Check tenant context is correct

### "No Data" on Index
- Verify repack units have been sealed
- Check filters aren't too restrictive

### Traceability Not Loading
- Verify allocation data exists in database
- Check backend logs for query errors
- Ensure full join chain is populated

---

## Testing Checklist

- [ ] Sealed repack creates inventory item
- [ ] Draft repack does NOT show in inventory
- [ ] Filters work correctly
- [ ] Pagination functions
- [ ] Permission check works
- [ ] Traceability loads full chain
- [ ] Print QR opens print dialog
- [ ] Back button returns to index
- [ ] Mobile responsive
- [ ] Loading/error/empty states display

---

## Performance Notes

- Traceability query is expensive (6+ joins) - only load on demand
- Pagination keeps list queries fast
- Summary query is cached per tenant
- Card rendering optimized with trackBy

---

## Security Notes

- All queries tenant-scoped (TenantGuard)
- Permission required for all endpoints (PermissionGuard)
- NO mutation endpoints exposed
- QR codes do not contain sensitive data
- Traceability respects tenant boundaries
