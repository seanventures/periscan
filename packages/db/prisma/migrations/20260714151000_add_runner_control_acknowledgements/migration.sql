ALTER TABLE "runners"
ADD COLUMN "kill_switch_acknowledged_at" TIMESTAMP(3),
ADD COLUMN "revocation_acknowledged_at" TIMESTAMP(3);
