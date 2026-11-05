-- v2 review (Purchasing): a container whose lots are being sorted, or are sorted, is here and through customs.
-- Containers still marked "on the way" or "arrived" move to "cleared", with arrival and clearing dates filled
-- in where they were never entered. Data only; nothing else changes. Closing stays the owner's step.
UPDATE "Container" c
SET "status" = 'CLEARED',
    "arrivedAt" = COALESCE(c."arrivedAt", NOW()),
    "clearedAt" = COALESCE(c."clearedAt", NOW())
WHERE c."status" IN ('IN_TRANSIT', 'ARRIVED')
  AND EXISTS (SELECT 1 FROM "Rag" r WHERE r."containerId" = c."id" AND r."status" IN ('IN_SORTING', 'SORTED'));
