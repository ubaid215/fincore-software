-- =============================================================================
-- FinCore — Manual Migration Patches
-- File: prisma/migrations/manual_patches.sql
--
-- These are changes that require manual SQL because Prisma cannot generate them
-- automatically (partial indexes, renamed columns, data migrations).
-- Run this AFTER running: npx prisma migrate dev
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. BARCODE PARTIAL UNIQUE INDEX
--    Prisma @@unique on a nullable column generates a standard unique constraint
--    which allows multiple NULLs in PostgreSQL anyway (NULLs ≠ NULLs in SQL).
--    The @@unique([organizationId, barcode]) has been removed from the schema.
--    Replace it with a partial index that only enforces uniqueness when barcode
--    IS NOT NULL — the correct business rule.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "product_barcode_unique_not_null"
  ON "Product" ("organization_id", "barcode")
  WHERE "barcode" IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 2. AUDIT LOG — resourceType column rename
--    The @map("resource_type") annotation was inside a comment in audit.prisma,
--    so Prisma created the column as "resourceType" (camelCase) not "resource_type".
--    This renames the column to match the now-correct @map annotation.
--    WARNING: Run this only once. Check with: \d "AuditLog"
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'AuditLog'
       AND column_name = 'resourceType'
  ) THEN
    ALTER TABLE "AuditLog" RENAME COLUMN "resourceType" TO "resource_type";
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 3. SUBSCRIPTIONS — snake_case column renames
--    Plan and Subscription models were missing @map() on all their fields.
--    Prisma generated camelCase column names. This renames them to snake_case
--    to match the now-added @map() annotations.
--    WARNING: Run this only once.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Plan table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Plan' AND column_name = 'displayName') THEN
    ALTER TABLE "Plan" RENAME COLUMN "displayName"  TO "display_name";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Plan' AND column_name = 'priceMonthly') THEN
    ALTER TABLE "Plan" RENAME COLUMN "priceMonthly" TO "price_monthly";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Plan' AND column_name = 'maxSeats') THEN
    ALTER TABLE "Plan" RENAME COLUMN "maxSeats"     TO "max_seats";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Plan' AND column_name = 'isActive') THEN
    ALTER TABLE "Plan" RENAME COLUMN "isActive"     TO "is_active";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Plan' AND column_name = 'createdAt') THEN
    ALTER TABLE "Plan" RENAME COLUMN "createdAt"    TO "created_at";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Plan' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Plan" RENAME COLUMN "updatedAt"    TO "updated_at";
  END IF;

  -- Subscription table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Subscription' AND column_name = 'planId') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "planId"             TO "plan_id";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Subscription' AND column_name = 'trialEndsAt') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "trialEndsAt"        TO "trial_ends_at";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Subscription' AND column_name = 'currentPeriodStart') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "currentPeriodStart" TO "current_period_start";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Subscription' AND column_name = 'currentPeriodEnd') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "currentPeriodEnd"   TO "current_period_end";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Subscription' AND column_name = 'seatCount') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "seatCount"          TO "seat_count";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Subscription' AND column_name = 'createdAt') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "createdAt"          TO "created_at";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Subscription' AND column_name = 'updatedAt') THEN
    ALTER TABLE "Subscription" RENAME COLUMN "updatedAt"          TO "updated_at";
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 4. INVENTORY — rename raw string columns to FK columns
--    StockMovement.created_by → created_by_id (now a FK to User)
--    PurchaseOrder.approved_by → approved_by_id
--    PurchaseOrder.received_by → received_by_id
--    SaleOrder.approved_by    → approved_by_id
--    SaleOrder.shipped_by     → shipped_by_id
--
--    IMPORTANT: These columns currently store user IDs as plain strings.
--    After renaming, Prisma will add the FK constraint automatically via migrate.
--    If existing data has invalid user IDs, the FK constraint will fail — clean
--    the data first by setting invalid values to NULL.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'StockMovement' AND column_name = 'created_by') THEN
    -- Null out any values that are not valid UUIDs before adding FK constraint
    UPDATE "StockMovement" SET "created_by" = NULL WHERE "created_by" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE "StockMovement" RENAME COLUMN "created_by" TO "created_by_id";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PurchaseOrder' AND column_name = 'approved_by') THEN
    UPDATE "PurchaseOrder" SET "approved_by" = NULL WHERE "approved_by" IS NOT NULL AND "approved_by" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE "PurchaseOrder" RENAME COLUMN "approved_by" TO "approved_by_id";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PurchaseOrder' AND column_name = 'received_by') THEN
    UPDATE "PurchaseOrder" SET "received_by" = NULL WHERE "received_by" IS NOT NULL AND "received_by" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE "PurchaseOrder" RENAME COLUMN "received_by" TO "received_by_id";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SaleOrder' AND column_name = 'approved_by') THEN
    UPDATE "SaleOrder" SET "approved_by" = NULL WHERE "approved_by" IS NOT NULL AND "approved_by" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE "SaleOrder" RENAME COLUMN "approved_by" TO "approved_by_id";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SaleOrder' AND column_name = 'shipped_by') THEN
    UPDATE "SaleOrder" SET "shipped_by" = NULL WHERE "shipped_by" IS NOT NULL AND "shipped_by" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE "SaleOrder" RENAME COLUMN "shipped_by" TO "shipped_by_id";
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 5. PurchaseOrder & SaleOrder — drop global unique, add per-org unique
--    poNumber and soNumber were globally unique across all organizations.
--    Two orgs both wanting PO-0001 would collide. Fixed to per-org unique.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'PurchaseOrder' AND indexname = 'PurchaseOrder_po_number_key') THEN
    ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_po_number_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'SaleOrder' AND indexname = 'SaleOrder_so_number_key') THEN
    ALTER TABLE "SaleOrder" DROP CONSTRAINT "SaleOrder_so_number_key";
  END IF;
END $$;
-- Prisma migrate will add the new @@unique([organizationId, poNumber]) constraints.


-- -----------------------------------------------------------------------------
-- 6. User — add new security columns (idempotent)
-- -----------------------------------------------------------------------------
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "is_active"              BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "failed_login_attempts"  INT       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until"           TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "last_login_at"          TIMESTAMP;

-- -----------------------------------------------------------------------------
-- 7. RefreshToken — add device tracking columns (idempotent)
-- -----------------------------------------------------------------------------
ALTER TABLE "RefreshToken"
  ADD COLUMN IF NOT EXISTS "device_label" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "ip_address"   VARCHAR(45);

-- -----------------------------------------------------------------------------
-- 8. Invite — add revocation column and unique constraint (idempotent)
-- -----------------------------------------------------------------------------
ALTER TABLE "Invite"
  ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP;

-- One active invite per email per org
CREATE UNIQUE INDEX IF NOT EXISTS "invite_org_email_unique"
  ON "Invite" ("organization_id", "email")
  WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;

-- -----------------------------------------------------------------------------
-- 9. ManualPayment — add proof tracking columns (idempotent)
-- -----------------------------------------------------------------------------
ALTER TABLE "ManualPayment"
  ADD COLUMN IF NOT EXISTS "submitted_proof_s3_key" TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_at"           TIMESTAMP;

-- Add SUBMITTED to enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SUBMITTED'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ManualPaymentStatus')
  ) THEN
    ALTER TYPE "ManualPaymentStatus" ADD VALUE 'SUBMITTED' AFTER 'PENDING';
  END IF;
END $$;