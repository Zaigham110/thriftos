-- A lot bought by the piece without a weight (owner, 2026-11-12): its sorted entries have no kg, so bales take pieces
-- from them; usedPieces is how many of an entry's pieces are already in bales. Existing entries start at 0.
ALTER TABLE "CategoryOutput" ADD COLUMN "usedPieces" INTEGER NOT NULL DEFAULT 0;
