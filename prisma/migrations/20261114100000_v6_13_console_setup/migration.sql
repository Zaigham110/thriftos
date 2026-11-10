-- A business made with the console's New business form already has its name, currency, language, sorting and
-- lists: its owner skips the setup. Businesses made that way before this change are marked set up too.
UPDATE "Tenant" t SET "setupCompletedAt" = NOW()
WHERE t."setupCompletedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "AuditLog" a
    WHERE a."tenantId" = t."id" AND a."action" = 'TENANT_CREATED' AND (a."metadataJson"->>'quick') = 'true'
  );
