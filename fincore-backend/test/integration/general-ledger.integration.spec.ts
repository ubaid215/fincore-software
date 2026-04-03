/**
 * General ledger integration tests — require Postgres (see invoicing.integration.spec.ts).
 * Set SKIP_INTEGRATION_TESTS=1 in CI without a database.
 */
const skipGlIntegration = ['1', 'true'].includes(String(process.env.SKIP_INTEGRATION_TESTS).toLowerCase());

(skipGlIntegration ? describe.skip : describe)('General Ledger integration', () => {
  it('placeholder — add GL service tests with TEST_DATABASE_URL', () => {
    expect(true).toBe(true);
  });
});
