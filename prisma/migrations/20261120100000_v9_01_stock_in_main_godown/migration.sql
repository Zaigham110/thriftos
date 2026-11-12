-- Phase 9.3 (owner, 2026-11-12: "godown work flow is not working"): stock made without a godown (bales made while
-- sorting, kat, imports) belonged to none, so stock per godown and moves did not add up. From now on new stock goes
-- to the business's main godown (its first active one); here, existing stock without one is put there too.
-- Data only; a business without any godown is left as it is.
UPDATE "InventoryItem" i
SET "warehouseId" = (
  SELECT w."id" FROM "Warehouse" w
  WHERE w."tenantId" = i."tenantId" AND w."isActive" = true
  ORDER BY w."createdAt" ASC, w."id" ASC
  LIMIT 1
)
WHERE i."warehouseId" IS NULL
  AND EXISTS (SELECT 1 FROM "Warehouse" w WHERE w."tenantId" = i."tenantId" AND w."isActive" = true);
