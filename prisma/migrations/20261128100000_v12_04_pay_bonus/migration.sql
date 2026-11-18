-- A bonus or allowance on a pay line (owner, 2026-11-18: "gaps in what was built"): added on top of the pay,
-- with a word on what it is for (Eid bonus, travel, overtime).
ALTER TABLE "PaySheetLine" ADD COLUMN "bonus" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PaySheetLine" ADD COLUMN "bonusNote" TEXT;
