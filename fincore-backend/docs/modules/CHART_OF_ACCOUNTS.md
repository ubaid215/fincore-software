
## File 8: `docs/modules/CHART_OF_ACCOUNTS.md`

```markdown
# Chart of Accounts Module

## Overview

Hierarchical chart of accounts with 8-level depth, GAAP/IFRS templates, and sub-account support.

## Features

- 8-level hierarchical structure
- Sub-account support (e.g., 1112-01 for HBL)
- GAAP USA & IFRS templates (80+ accounts each)
- Account locking (prevents edits)
- Account archiving (soft delete)
- Parent-child type validation

## Account Types

| Type | Normal Balance | Examples |
|------|---------------|----------|
| ASSET | DEBIT | Cash, Inventory, Receivables |
| LIABILITY | CREDIT | Loans, Payables |
| EQUITY | CREDIT | Capital, Retained Earnings |
| REVENUE | CREDIT | Sales, Service Revenue |
| EXPENSE | DEBIT | Rent, Salaries, Utilities |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/accounts` | Create account |
| POST | `/v1/accounts/sub-account` | Create sub-account |
| POST | `/v1/accounts/import` | Import GAAP/IFRS |
| GET | `/v1/accounts` | List accounts (tree/flat) |
| GET | `/v1/accounts/tree` | Full hierarchy tree |
| GET | `/v1/accounts/sub-accounts/:parentCode` | Get sub-accounts |
| GET | `/v1/accounts/:id` | Get account |
| PATCH | `/v1/accounts/:id` | Update account |
| PATCH | `/v1/accounts/:id/archive` | Archive account |
| PATCH | `/v1/accounts/:id/lock` | Lock account |

## Sub-Account Example

```bash
# Create parent
POST /v1/accounts
{
  "accountCode": "1112",
  "name": "Cash at Bank",
  "type": "ASSET"
}

# Create HBL sub-account
POST /v1/accounts/sub-account
{
  "parentAccountCode": "1112",
  "suffix": "01",
  "name": "HBL Main Branch",
  "bankAccountNumber": "PK36HABB0000000000000001",
  "openingBalance": 500000
}

# Result: accountCode = "1112-01"
# Full name: "Cash at Bank - HBL Main Branch (01)"


Level 1: 1xxx - Assets
Level 2: 11xx - Current Assets
Level 3: 111x - Cash
Level 4: 1112 - Cash at Bank
Level 5: 1112-01 - HBL
Level 5: 1112-02 - UBL

Import Templates
# GAAP USA (80+ accounts)
POST /v1/accounts/import
{ "template": "GAAP_USA" }

# IFRS (80+ accounts)
POST /v1/accounts/import
{ "template": "IFRS" }

# Replace existing (destructive)
POST /v1/accounts/import
{ "template": "GAAP_USA", "replaceExisting": true }

