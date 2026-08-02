-- CreateEnum
CREATE TYPE "OperationMode" AS ENUM ('FULL_ERP', 'SIMPLIFIED_MOBILE', 'USER_CHOICE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "operationMode" "OperationMode" NOT NULL DEFAULT 'FULL_ERP';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "preferredOperationMode" "OperationMode";
