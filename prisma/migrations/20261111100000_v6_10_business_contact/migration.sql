-- v2 review (Settings): the business's phone, address and city for bills, receipts and WhatsApp messages.
ALTER TABLE "Tenant" ADD COLUMN "phone" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "address" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "city" TEXT;
