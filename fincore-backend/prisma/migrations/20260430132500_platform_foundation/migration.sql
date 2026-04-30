-- Platform foundation migration:
-- 1) per-plan concurrent session limit
-- 2) org-level entitlement override
-- 3) contact attachments

ALTER TABLE "plan_limits"
ADD COLUMN "max_concurrent_sessions_per_user" INTEGER NOT NULL DEFAULT 2;

CREATE TABLE "org_entitlement_overrides" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "max_users_override" INTEGER,
  "max_concurrent_sessions_override" INTEGER,
  "max_apps_override" INTEGER,
  "allowed_apps_override" "AppKey"[] DEFAULT ARRAY[]::"AppKey"[],
  "reason" TEXT,
  "updated_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "org_entitlement_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_entitlement_overrides_organization_id_key"
ON "org_entitlement_overrides"("organization_id");

CREATE INDEX "org_entitlement_overrides_updated_by_id_idx"
ON "org_entitlement_overrides"("updated_by_id");

ALTER TABLE "org_entitlement_overrides"
ADD CONSTRAINT "org_entitlement_overrides_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "org_entitlement_overrides"
ADD CONSTRAINT "org_entitlement_overrides_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "contact_attachments" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "s3_key" TEXT NOT NULL,
  "uploaded_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contact_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_attachments_organization_id_contact_id_idx"
ON "contact_attachments"("organization_id", "contact_id");

CREATE INDEX "contact_attachments_uploaded_by_id_idx"
ON "contact_attachments"("uploaded_by_id");

ALTER TABLE "contact_attachments"
ADD CONSTRAINT "contact_attachments_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_attachments"
ADD CONSTRAINT "contact_attachments_contact_id_fkey"
FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_attachments"
ADD CONSTRAINT "contact_attachments_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
