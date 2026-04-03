
## File 5: `docs/database/SCHEMA_STRATEGY.md`

```markdown
# Prisma Schema Strategy

## Overview

FinCore uses **split Prisma schema** - one `.prisma` file per domain. Prisma merges them at generation time via the `prismaSchemaFolder` preview feature.

## File Structure
prisma/
├── schema/
│ ├── base.prisma # generator + datasource (ONLY HERE)
│ ├── auth.prisma # User, RefreshToken, Invite
│ ├── workspace.prisma # Organization, UserOrganization
│ ├── chart-of-accounts.prisma # Account, FiscalPeriod, Contact
│ ├── general-ledger.prisma # JournalEntry, JournalLine
│ ├── invoicing.prisma # Invoice, InvoiceLineItem, InvoicePayment
│ ├── expenses.prisma # Expense, ExpenseLine, Receipt
│ ├── bank-reconciliation.prisma # BankStatement, BankTransaction
│ ├── subscriptions.prisma # Plan, Subscription
│ ├── manual-payments.prisma # ManualPayment
│ ├── inventory.prisma # Product, StockMovement, PO, SO
│ └── audit.prisma # AuditLog
├── migrations/ # Auto-generated
└── seeds/ # Seed data


## Base Configuration

```prisma
// prisma/schema/base.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
Domain Ownership
File	Models	Owner
base.prisma	generator, datasource	DevOps
auth.prisma	User, RefreshToken, Invite	Auth
workspace.prisma	Organization, UserOrganization	Workspace
chart-of-accounts.prisma	Account, FiscalPeriod, Contact	GL
general-ledger.prisma	JournalEntry, JournalLine	GL
invoicing.prisma	Invoice, InvoiceLineItem, InvoicePayment	Billing
expenses.prisma	Expense, ExpenseLine, Receipt	Expenses
bank-reconciliation.prisma	BankStatement, BankTransaction	Recon
subscriptions.prisma	Plan, Subscription	Billing
manual-payments.prisma	ManualPayment	Billing
inventory.prisma	Product, StockMovement, PO, SO	Inventory
audit.prisma	AuditLog	Cross-cutting
Rules
Only base.prisma contains generator and datasource - never repeat them

One domain per file - models that always migrate together stay together

No circular relations across more than 2 files - keep dependency graph a DAG

Migrations are still a single SQL file - Prisma merges before diffing

text

## File 6: `docs/database/MIGRATIONS.md`

```markdown
# Database Migrations

## Creating Migrations

```bash
# Create migration (prompts for name)
npm run db:migrate

# Example names:
# - add-email-verified-to-users
# - create-invoice-table
# - add-fiscal-period-locking
Migration Naming Convention
text
{action}-{what}-to-{table}.sql

Examples:
- add-phone-to-users.sql
- create-invoice-line-items.sql
- add-index-on-organization-id.sql
- alter-subscription-add-plan-id.sql
Migration Workflow
Development
bash
# 1. Edit schema/*.prisma files
# 2. Generate migration
npm run db:migrate

# 3. Apply migration (auto-applied)
# 4. Regenerate client
npm run db:generate

# 5. Update seeds if needed
# 6. Test
npm run test
Staging
bash
# 1. Push migrations
npm run db:migrate:prod

# 2. Verify
npm run db:studio
Production
bash
# 1. Backup database
pg_dump $DATABASE_URL > backup.sql

# 2. Apply migrations
npm run db:migrate:prod

# 3. Verify
curl http://localhost:3000/health
Rollback Strategy
bash
# Rollback last migration (development only)
npx prisma migrate reset

# Manual rollback (production)
# 1. Identify migration file
ls prisma/migrations/

# 2. Run down migration manually
psql $DATABASE_URL -f rollback.sql
Seed Data
bash
# Run all seeds
npm run db:seed

# Seed files (in order):
prisma/seeds/
├── index.ts              # Master runner
├── plans.seed.ts         # Subscription plans
├── coa-gaap.seed.ts      # GAAP Chart of Accounts
└── coa-ifrs.seed.ts      # IFRS Chart of Accounts
Best Practices
Never edit migration files after applying - create new migration

Test migrations on staging first

Keep migrations idempotent (use IF NOT EXISTS)

Backup before production migrations

Use transactions for multi-step migrations

Document breaking changes in CHANGELOG