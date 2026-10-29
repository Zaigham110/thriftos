-- v1: every tenant has a waste type, so a lot with a remainder can always be closed
-- (journey 2: the Waste tile is always present). Tenants without a "Waste/Katran" type get one.

INSERT INTO "WasteCategory" ("id", "tenantId", "name", "unitType", "defaultResalePrice", "isSystemGenerated", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t.id, 'Waste/Katran', 'KG', 0, false, true, now(), now()
FROM "Tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "WasteCategory" w WHERE w."tenantId" = t.id AND w.name = 'Waste/Katran');
