-- CreateEnum
CREATE TYPE "ConnectivityPolicy" AS ENUM ('ONLINE_ONLY', 'OFFLINE_CAPABLE', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "CapturePolicy" AS ENUM ('HARDWARE_SCANNER', 'CAMERA_SCAN', 'MANUAL_ENTRY', 'ALL');

-- CreateEnum
CREATE TYPE "GuidancePolicy" AS ENUM ('GUIDED', 'FLEXIBLE', 'STRICT');

-- AlterTable
ALTER TABLE "Tenant"
  ADD COLUMN "connectivityPolicy" "ConnectivityPolicy" NOT NULL DEFAULT 'AUTOMATIC',
  ADD COLUMN "capturePolicy" "CapturePolicy" NOT NULL DEFAULT 'ALL',
  ADD COLUMN "guidancePolicy" "GuidancePolicy" NOT NULL DEFAULT 'GUIDED';
