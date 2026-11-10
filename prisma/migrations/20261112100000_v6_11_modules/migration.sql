-- v2 review: every part of ThriftOS is a module the super admin turns on or off per business.
-- New businesses start with the everyday set; existing businesses keep everything they could already use.
ALTER TABLE "Tenant" ALTER COLUMN "enabledModules" SET DEFAULT ARRAY['RECEIVE', 'STOCK', 'SELL', 'SORT', 'CONTAINERS', 'LOOSE_LOTS', 'READY_STOCK', 'STOCK_COUNTS', 'PRICE_LISTS', 'KHATA', 'EXPENSES', 'CASH_CLOSE', 'PNL', 'MUNSHI', 'IMPORT']::TEXT[];

UPDATE "Tenant"
SET "enabledModules" = (
  SELECT array_agg(m ORDER BY m)
  FROM (SELECT DISTINCT unnest("enabledModules" || ARRAY['CONTAINERS', 'LOOSE_LOTS', 'READY_STOCK', 'STOCK_COUNTS', 'PRICE_LISTS', 'EXPENSES', 'CASH_CLOSE', 'PNL', 'MUNSHI', 'IMPORT']::TEXT[]) AS m) AS all_modules
)
WHERE "companyCode" <> 'SYSTEM';
