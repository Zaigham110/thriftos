-- Settings review (owner, 2026-11-17): the first godown of a business was made as "Main Warehouse" at
-- "Default Location". The app says godown everywhere, and "Default Location" says nothing. Only rows still
-- carrying exactly those made-up words change; a name or place the owner wrote is left alone.
UPDATE "Warehouse" w SET "name" = 'Main godown'
WHERE w."name" = 'Main Warehouse'
  AND NOT EXISTS (SELECT 1 FROM "Warehouse" o WHERE o."tenantId" = w."tenantId" AND o."name" = 'Main godown');
UPDATE "Warehouse" SET "location" = NULL WHERE "location" = 'Default Location';
