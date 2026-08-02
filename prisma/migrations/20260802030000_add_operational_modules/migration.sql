-- Tenant-admin controlled operational destinations. Existing tenants keep the
-- complete operational surface until an administrator deliberately narrows it.
ALTER TABLE "Tenant"
ADD COLUMN "operationalModules" TEXT[] NOT NULL DEFAULT ARRAY[
  'WORK', 'INTAKE', 'SORTING', 'REPACK', 'STOCK', 'SALES', 'INSIGHTS', 'ADMINISTRATION'
]::TEXT[];
