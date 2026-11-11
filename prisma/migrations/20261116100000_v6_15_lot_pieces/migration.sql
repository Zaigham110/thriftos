-- Loose lot bought by the piece (owner, 2026-11-11: "bought bedsheets per piece, not kg"): how many pieces, and the
-- rate per piece typed (price = pieces × rate). Existing lots have neither, so nothing changes for them.
ALTER TABLE "Rag" ADD COLUMN "pieces" INTEGER;
ALTER TABLE "Rag" ADD COLUMN "ratePerPiece" DECIMAL(14,2);
