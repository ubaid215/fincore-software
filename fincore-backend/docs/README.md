# FinCore Documentation

Welcome to FinCore - Complete Financial Management Software for Pakistani Businesses.

## Documentation Index

### Getting Started
- [Getting Started Guide](./setup/GETTING_STARTED.md) - 15-minute setup
- [Environment Variables](./setup/ENVIRONMENT_VARS.md) - All configuration options
- [Local Development](./setup/LOCAL_DEVELOPMENT.md) - Run locally with Docker

### Database
- [Schema Strategy](./database/SCHEMA_STRATEGY.md) - Split Prisma schema approach
- [Migrations](./database/MIGRATIONS.md) - Managing database changes

### Modules
- [Authentication](./modules/AUTH.md) - JWT, MFA, RBAC
- [Chart of Accounts](./modules/CHART_OF_ACCOUNTS.md) - Account hierarchy, templates
- [General Ledger](./modules/GENERAL_LEDGER.md) - Double-entry engine
- [Invoicing](./modules/INVOICING.md) - 6-state lifecycle, PDF
- [Expenses](./modules/EXPENSES.md) - 3-step approval workflow
- [Bank Reconciliation](./modules/BANK_RECONCILIATION.md) - CSV/OFX import, auto-match
- [Subscriptions](./modules/SUBSCRIPTIONS.md) - Plans, feature flags
- [Manual Payments](./modules/MANUAL_PAYMENTS.md) - Pakistan-first payment collection
- [Financial Reports](./modules/FINANCIAL_REPORTS.md) - BS, P&L, TB, Cash Flow
- [Inventory](./modules/INVENTORY.md) - Stock management, PO/SO
- [Analytics](./modules/ANALYTICS.md) - KPIs, dashboards, insights
- [Onboarding](./modules/ONBOARDING.md) - 6-step wizard

### Testing
- [Testing Guide](./testing/TESTING_GUIDE.md) - Unit, integration, E2E, load
- [Test Coverage](./testing/TEST_COVERAGE.md) - Auto-generated coverage report

### API
- [OpenAPI Specification](./api/openapi.json) - Auto-generated API docs

### DevOps
- [CI/CD Pipeline](./devops/CI_CD.md) - GitHub Actions workflow
- [Infrastructure](./devops/INFRASTRUCTURE.md) - AWS EKS, RDS, S3, Redis

### Performance
- [Load Test Results](./performance/LOAD_TEST_RESULTS.md) - k6 benchmarks

### Operations
- [Runbook](./operations/RUNBOOK.md) - Deployment, monitoring, troubleshooting
- [Payment Operations](./operations/PAYMENT_OPS.md) - Manual payment handling

## Quick Links

| Resource | Link |
|----------|------|
| API (Dev) | http://localhost:3000/v1 |
| Swagger Docs | http://localhost:3000/docs |
| Prisma Studio | http://localhost:5555 |
| MailHog | http://localhost:8025 |
| Health Check | http://localhost:3000/health |

## Support

- **Email**: support@fincore.com
- **Documentation**: docs.fincore.com
- **GitHub**: github.com/fincore/backend