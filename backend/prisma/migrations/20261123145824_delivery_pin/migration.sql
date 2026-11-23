-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "delivery_pin_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "delivery_pin_hash" TEXT;
