
## File 10: `docs/testing/TESTING_GUIDE.md`

```markdown
# Testing Guide

## Testing Pyramid

┌─────────────────────────────┐
│ E2E (100+ scenarios) │ Full HTTP stack
├─────────────────────────────┤
│ Integration (30 scenarios) │ Service + real DB
├─────────────────────────────┤
│ Unit (200+ scenarios) │ Mocked, fast
└─────────────────────────────┘


## Unit Tests

```typescript
// src/modules/general-ledger/tests/general-ledger.service.spec.ts
describe('GeneralLedgerService', () => {
  it('creates a valid double-entry journal entry', async () => {
    // Arrange
    const dto = { lines: [{ debit: 1000, credit: 0 }, { debit: 0, credit: 1000 }] };
    
    // Act
    const result = await service.createJournalEntry(orgId, dto);
    
    // Assert
    expect(result.status).toBe('DRAFT');
  });
});

npm run test           # Run once
npm run test:watch     # Watch mode
npm run test:cov       # Coverage report


// test/integration/general-ledger.integration.spec.ts
describe('GeneralLedger Integration', () => {
  it('persists valid journal entry to PostgreSQL', async () => {
    const entry = await service.createJournalEntry(orgId, validDto);
    const fromDb = await prisma.journalEntry.findUnique({ where: { id: entry.id } });
    expect(fromDb).toBeDefined();
  });
});
npm run test:integration

// test/e2e/invoicing.e2e-spec.ts
describe('Invoicing (e2e)', () => {
  it('creates DRAFT invoice with INV- number', async () => {
    const { body } = await api(app)
      .post('/v1/invoices')
      .set(authHeaders(user))
      .send(validDto)
      .expect(201);
    
    expect(body.data.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
  });
});

npm run test:e2e                    # All E2E tests
npm run test:e2e -- --testPathPattern=invoicing  # Single file

Load Tests (k6)
bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io

# Run load test
npm run test:load

# Custom run
k6 run test/load/load-test.js \
  --env BASE_URL=https://staging.fincore.com \
  --env TEST_TOKEN=<token>
Coverage Thresholds
Metric	Threshold
Lines	80%
Branches	80%
Functions	80%
Statements	80%
Test Helpers
typescript
// test/helpers/app.helper.ts
export async function createTestApp(): Promise<INestApplication>

// test/helpers/auth.helper.ts
export async function createTestUser(app, { role }): Promise<TestCredentials>
export function authHeaders(user): Record<string, string>

// test/helpers/db.helper.ts
export async function cleanDb(app): Promise<void>
export function getPrisma(app): PrismaService