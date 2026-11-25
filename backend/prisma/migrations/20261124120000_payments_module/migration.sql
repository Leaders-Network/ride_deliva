-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'MOMO', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('TRIP', 'WALLET_TOP_UP');

-- CreateEnum
CREATE TYPE "PayoutAccountType" AS ENUM ('MOMO_PSB', 'BANK');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'MOBILE_MONEY';

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "cashback_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payer_phone" TEXT,
ADD COLUMN     "provider" "PaymentProvider",
ADD COLUMN     "provider_reference" TEXT,
ADD COLUMN     "purpose" "PaymentPurpose" NOT NULL DEFAULT 'TRIP',
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "user_id" UUID,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "type" "PayoutAccountType" NOT NULL,
    "account_number" TEXT NOT NULL,
    "bank_code" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "recipient_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "batch_key" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT NOT NULL,
    "transfer_code" TEXT,
    "destination" JSONB NOT NULL,
    "failure_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "event_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "momo_cashback_enabled" BOOLEAN NOT NULL DEFAULT false,
    "momo_cashback_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.02,
    "momo_cashback_cap" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "momo_cashback_min_fare" DECIMAL(10,2) NOT NULL DEFAULT 1000,
    "payout_minimum" DECIMAL(10,2) NOT NULL DEFAULT 1000,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_driver_id_key" ON "payout_accounts"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_reference_key" ON "payouts"("reference");

-- CreateIndex
CREATE INDEX "payouts_status_created_at_idx" ON "payouts"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_driver_id_batch_key_key" ON "payouts"("driver_id", "batch_key");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_key_key" ON "webhook_events"("provider", "event_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_reference_key" ON "payments"("provider_reference");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: payer of existing trip payments, and each trip's method from its recorded payment.
UPDATE "payments" p SET "user_id" = cp."user_id", "provider" = 'INTERNAL'
FROM "rides" r JOIN "customer_profiles" cp ON cp."id" = r."customer_id"
WHERE p."ride_id" = r."id";

UPDATE "payments" p SET "user_id" = cp."user_id", "provider" = 'INTERNAL'
FROM "deliveries" d JOIN "customer_profiles" cp ON cp."id" = d."customer_id"
WHERE p."delivery_id" = d."id";

UPDATE "rides" r SET "payment_method" = p."method" FROM "payments" p WHERE p."ride_id" = r."id";
UPDATE "deliveries" d SET "payment_method" = p."method" FROM "payments" p WHERE p."delivery_id" = d."id";

INSERT INTO "payment_settings" ("id", "updated_at") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;
