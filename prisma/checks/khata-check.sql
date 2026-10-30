-- ThriftOS khata check. Returns one row per problem; no rows = sales, payments and stock agree.
-- Balances are never stored (opening balance + sales − payments), so this checks the inputs.
SELECT 'payment in another tenant than its customer' AS problem, p."tenantId", p.id AS ref
FROM "Payment" p JOIN "Customer" c ON c.id = p."customerId" WHERE c."tenantId" <> p."tenantId"
UNION ALL
SELECT 'payment on a sale of another customer', p."tenantId", p.id
FROM "Payment" p JOIN "Sale" s ON s.id = p."saleId" WHERE s."customerId" <> p."customerId"
UNION ALL
SELECT 'draft sale left over', s."tenantId", s."saleNumber" FROM "Sale" s WHERE s.status = 'DRAFT'
UNION ALL
SELECT 'sale total is not the sum of its lines', s."tenantId", s."saleNumber"
FROM "Sale" s
WHERE s.status <> 'CANCELLED'
  AND s."totalAmount" <> COALESCE((SELECT SUM(l."lineTotal") FROM "SaleLine" l WHERE l."saleId" = s.id), 0)
UNION ALL
SELECT 'sale line profit is not price minus cost', s."tenantId", s."saleNumber"
FROM "SaleLine" l JOIN "Sale" s ON s.id = l."saleId" WHERE l.profit <> l."lineTotal" - l."lineCost"
UNION ALL
SELECT 'stock item marked sold with stock left', i."tenantId", i.id
FROM "InventoryItem" i WHERE i.status = 'SOLD' AND i."usedQuantity" < i.quantity
UNION ALL
SELECT 'stock item used up but not marked sold', i."tenantId", i.id
FROM "InventoryItem" i WHERE i.status <> 'SOLD' AND i."usedQuantity" = i.quantity
ORDER BY 1, 2, 3;
