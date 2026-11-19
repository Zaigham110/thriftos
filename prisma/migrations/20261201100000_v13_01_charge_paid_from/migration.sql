-- How a lot's or container's charge was paid (owner, 2026-11-19: "a mix of both, build the simple version"). A
-- charge paid from the drawer or the bank now leaves that book on the day it is entered; it stays part of the
-- goods' cost and is not an expense. Charges entered before this count as already paid: left empty, in no book.
ALTER TABLE "LotCharge" ADD COLUMN "paidFrom" "PaymentMethod";
ALTER TABLE "LotCharge" ADD COLUMN "paidOn" DATE;
ALTER TABLE "ContainerCharge" ADD COLUMN "paidFrom" "PaymentMethod";
ALTER TABLE "ContainerCharge" ADD COLUMN "paidOn" DATE;
